use super::{AIProvider, AIProviderConfig, AnalysisRequest, AnalysisResponse, IOCs, ThreatLevel};
use crate::ai_providers::circuit_breaker::CircuitBreaker;
use crate::ai_providers::retry::{RetryConfig, with_retry};
use crate::metrics::{AI_REQUEST_DURATION, AI_REQUEST_COUNTER, AI_TOKEN_USAGE, AI_COST_ESTIMATE};
use async_trait::async_trait;
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::time::Instant;

pub struct DeepSeekProvider {
    config: AIProviderConfig,
    client: Client,
    circuit_breaker: CircuitBreaker,
    retry_config: RetryConfig,
}

#[derive(Debug, Serialize)]
struct DeepSeekRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct DeepSeekResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

impl DeepSeekProvider {
    pub fn new(config: AIProviderConfig) -> Result<Self, Box<dyn Error + Send + Sync>> {
        // Configure reqwest Client per DeepWiki best practices for production
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_secs))
            .connect_timeout(std::time::Duration::from_secs(10)) // Separate connect timeout
            .pool_idle_timeout(std::time::Duration::from_secs(90)) // Connection pool idle timeout
            .pool_max_idle_per_host(10) // Max idle connections per host
            .use_rustls_tls() // Explicitly use rustls for TLS (more secure, pure Rust)
            .build()
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        let circuit_breaker = CircuitBreaker::new_with_name("deepseek".to_string(), 3, 2, 60);

        // Configure retry with 5 attempts, 1s initial delay, exponential backoff
        let retry_config = RetryConfig {
            max_retries: 5,
            initial_delay_ms: 1000,
            max_delay_ms: 30000,
            backoff_multiplier: 2.0,
        };

        Ok(Self {
            config,
            client,
            circuit_breaker,
            retry_config,
        })
    }

    fn build_system_prompt(&self) -> String {
        "You are a specialized malware analyst with expertise in code analysis and threat detection. \
         Focus on identifying malicious patterns, code obfuscation, and suspicious behaviors. \
         Provide detailed technical analysis with extracted indicators of compromise.".to_string()
    }

    fn build_analysis_prompt(&self, request: &AnalysisRequest) -> String {
        format!(
            r#"Perform deep technical analysis on this file:

File Information:
- Name: {}
- Size: {} bytes
- Type: {}
- SHA-256: {}

Provide a detailed JSON response with:
{{
    "confidence": <0.0-1.0>,
    "threat_level": "Benign|Suspicious|Malicious|Critical",
    "malware_family": "<identified family or null>",
    "malware_type": "<malware category or null>",
    "signatures": ["detected malware signatures"],
    "behaviors": ["suspicious behaviors identified"],
    "iocs": {{
        "domains": ["C2 domains"],
        "ips": ["C2 IPs"],
        "urls": ["malicious URLs"],
        "files": ["dropped files"],
        "registry_keys": ["registry modifications"],
        "processes": ["spawned processes"],
        "mutexes": ["created mutexes"]
    }},
    "recommendations": ["security recommendations"],
    "detailed_analysis": "comprehensive technical analysis"
}}"#,
            request.file_name,
            request.file_size,
            request.file_type,
            request.file_hash
        )
    }

    async fn parse_deepseek_response(&self, response_text: &str) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
        // Extract JSON from response (DeepSeek sometimes includes explanation text)
        let json_start = response_text.find('{').ok_or("No JSON found in response")?;
        let json_end = response_text.rfind('}').ok_or("No closing brace found")? + 1;
        let json_str = &response_text[json_start..json_end];
        
        let parsed: serde_json::Value = serde_json::from_str(json_str)?;
        
        let threat_level = match parsed["threat_level"].as_str().unwrap_or("Suspicious") {
            "Benign" => ThreatLevel::Benign,
            "Malicious" => ThreatLevel::Malicious,
            "Critical" => ThreatLevel::Critical,
            _ => ThreatLevel::Suspicious,
        };
        
        Ok(AnalysisResponse {
            provider: "DeepSeek".to_string(),
            model: self.config.model.clone(),
            timestamp: Utc::now().timestamp(),
            confidence: parsed["confidence"].as_f64().unwrap_or(0.5) as f32,
            threat_level,
            malware_family: parsed["malware_family"].as_str().map(String::from),
            malware_type: parsed["malware_type"].as_str().map(String::from),
            signatures: parsed["signatures"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            behaviors: parsed["behaviors"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            iocs: IOCs {
                domains: parsed["iocs"]["domains"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                ips: parsed["iocs"]["ips"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                urls: parsed["iocs"]["urls"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                files: parsed["iocs"]["files"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                registry_keys: parsed["iocs"]["registry_keys"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                processes: parsed["iocs"]["processes"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
                mutexes: parsed["iocs"]["mutexes"]
                    .as_array()
                    .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                    .unwrap_or_default(),
            },
            recommendations: parsed["recommendations"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(String::from)).collect())
                .unwrap_or_default(),
            detailed_analysis: parsed["detailed_analysis"].as_str().unwrap_or("").to_string(),
            processing_time_ms: 0, // Set by analyze() method after API call completes
        })
    }
}

#[async_trait]
impl AIProvider for DeepSeekProvider {
    fn name(&self) -> &str {
        "DeepSeek"
    }

    async fn analyze(&self, request: &AnalysisRequest) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
        let start_time = Instant::now();

        let analysis_result = self.circuit_breaker.call(async {
            // Wrap the API call with retry logic
            with_retry(
                &self.retry_config,
                || async {
                    let deepseek_request = DeepSeekRequest {
                        model: self.config.model.clone(),
                        messages: vec![
                            Message {
                                role: "system".to_string(),
                                content: self.build_system_prompt(),
                            },
                            Message {
                                role: "user".to_string(),
                                content: self.build_analysis_prompt(request),
                            },
                        ],
                        max_tokens: self.config.max_tokens,
                        temperature: self.config.temperature,
                    };

                    let base_url = self.config.base_url.as_deref().unwrap_or("https://api.deepseek.com");
                    let response = self.client
                        .post(format!("{}/v1/chat/completions", base_url))
                        .header("Authorization", format!("Bearer {}", self.config.api_key))
                        .header("Content-Type", "application/json")
                        .json(&deepseek_request)
                        .send()
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

                    let status = response.status();
                    if !status.is_success() {
                        let error_text = response.text().await
                            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                        return Err(Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            format!("DeepSeek API error ({}): {}", status, error_text)
                        )) as Box<dyn std::error::Error + Send + Sync>);
                    }

                    let deepseek_response: DeepSeekResponse = response.json().await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                    let response_text = deepseek_response.choices.first()
                        .ok_or_else(|| Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            "No choices in DeepSeek response"
                        )) as Box<dyn std::error::Error + Send + Sync>)?
                        .message.content.clone();

                    self.parse_deepseek_response(&response_text).await
                },
                "DeepSeek",
            ).await
        }).await;
        
        let duration = start_time.elapsed();

        match analysis_result {
            Ok(mut response) => {
                response.processing_time_ms = duration.as_millis() as u64;

                // Record Prometheus metrics for successful requests
                AI_REQUEST_DURATION
                    .with_label_values(&["deepseek", "malware_analysis", "success"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["deepseek", "malware_analysis", "success"])
                    .inc();

                // Estimate token usage (DeepSeek uses ~1 token per 4 chars)
                let system_prompt_length = self.build_system_prompt().len();
                let user_prompt_length = self.build_analysis_prompt(request).len();
                let response_length = response.detailed_analysis.len();
                let estimated_prompt_tokens = (system_prompt_length + user_prompt_length) / 4;
                let estimated_completion_tokens = response_length / 4;

                AI_TOKEN_USAGE
                    .with_label_values(&["deepseek", "prompt"])
                    .inc_by(estimated_prompt_tokens as f64);

                AI_TOKEN_USAGE
                    .with_label_values(&["deepseek", "completion"])
                    .inc_by(estimated_completion_tokens as f64);

                // Estimate cost (DeepSeek: ~$0.14/MTok input, ~$0.28/MTok output - very cheap!)
                let estimated_cost = (estimated_prompt_tokens as f64 / 1_000_000.0 * 0.14)
                    + (estimated_completion_tokens as f64 / 1_000_000.0 * 0.28);

                AI_COST_ESTIMATE
                    .with_label_values(&["deepseek"])
                    .inc_by(estimated_cost);

                Ok(response)
            }
            Err(e) => {
                // Record failure metrics
                AI_REQUEST_DURATION
                    .with_label_values(&["deepseek", "malware_analysis", "error"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["deepseek", "malware_analysis", "error"])
                    .inc();

                Err(e)
            }
        }
    }

    async fn health_check(&self) -> Result<bool, Box<dyn Error + Send + Sync>> {
        let test_request = DeepSeekRequest {
            model: self.config.model.clone(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "Reply with 'OK'".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: "Health check".to_string(),
                },
            ],
            max_tokens: 10,
            temperature: 0.0,
        };
        
        let base_url = self.config.base_url.as_deref().unwrap_or("https://api.deepseek.com");
        let response = self.client
            .post(format!("{}/v1/chat/completions", base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&test_request)
            .send()
            .await?;

        Ok(response.status().is_success())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> AIProviderConfig {
        AIProviderConfig {
            api_key: "test-deepseek-key".to_string(),
            base_url: Some("https://api.test-deepseek.com".to_string()),
            model: "deepseek-coder".to_string(),
            max_tokens: 8000,
            temperature: 0.1,
            timeout_secs: 60,
        }
    }

    fn create_test_request() -> AnalysisRequest {
        AnalysisRequest {
            file_name: "suspicious.bin".to_string(),
            file_size: 99999,
            file_type: "Binary".to_string(),
            file_hash: "hash123abc".to_string(),
            file_content: None,
            analysis_type: "malware_analysis".to_string(),
        }
    }

    #[test]
    fn test_deepseek_provider_creation() {
        let config = create_test_config();
        let provider = DeepSeekProvider::new(config);
        assert!(provider.is_ok());

        let provider = provider.unwrap();
        assert_eq!(provider.name(), "DeepSeek");
    }

    #[test]
    fn test_build_system_prompt() {
        let config = create_test_config();
        let provider = DeepSeekProvider::new(config).unwrap();

        let system_prompt = provider.build_system_prompt();

        assert!(system_prompt.contains("malware analyst"));
        assert!(system_prompt.contains("code analysis"));
    }

    #[test]
    fn test_build_analysis_prompt() {
        let config = create_test_config();
        let provider = DeepSeekProvider::new(config).unwrap();
        let request = create_test_request();

        let prompt = provider.build_analysis_prompt(&request);

        assert!(prompt.contains("suspicious.bin"));
        assert!(prompt.contains("99999"));
        assert!(prompt.contains("Binary"));
        assert!(prompt.contains("hash123abc"));
        assert!(prompt.contains("JSON"));
    }

    #[tokio::test]
    async fn test_parse_deepseek_response_valid() {
        let config = create_test_config();
        let provider = DeepSeekProvider::new(config).unwrap();

        let response_text = r#"{
            "confidence": 0.75,
            "threat_level": "Suspicious",
            "malware_family": "Downloader",
            "malware_type": "Dropper",
            "signatures": ["encrypted_payload"],
            "behaviors": ["download_additional_files"],
            "iocs": {
                "domains": ["download.evil.org"],
                "ips": ["192.0.2.1"],
                "urls": ["http://download.evil.org/stage2"],
                "files": ["stage2.exe"],
                "registry_keys": [],
                "processes": [],
                "mutexes": ["DownloaderMutex"]
            },
            "recommendations": ["Block network access", "Analyze in sandbox"],
            "detailed_analysis": "Binary contains obfuscated downloader code."
        }"#;

        let result = provider.parse_deepseek_response(response_text).await;
        assert!(result.is_ok());

        let analysis = result.unwrap();
        assert_eq!(analysis.provider, "DeepSeek");
        assert_eq!(analysis.model, "deepseek-coder");
        assert_eq!(analysis.confidence, 0.75);
        assert!(matches!(analysis.threat_level, ThreatLevel::Suspicious));
        assert_eq!(analysis.malware_family, Some("Downloader".to_string()));
    }

    #[tokio::test]
    async fn test_parse_deepseek_response_with_prefix() {
        let config = create_test_config();
        let provider = DeepSeekProvider::new(config).unwrap();

        // DeepSeek sometimes adds explanatory text before JSON
        let response_text = r#"After analyzing the file, here are my findings:

        {
            "confidence": 0.6,
            "threat_level": "Suspicious",
            "malware_family": null,
            "malware_type": null,
            "signatures": ["packer_detected"],
            "behaviors": ["anti_debugging"],
            "iocs": {
                "domains": [],
                "ips": [],
                "urls": [],
                "files": [],
                "registry_keys": [],
                "processes": [],
                "mutexes": []
            },
            "recommendations": ["Unpack before further analysis"],
            "detailed_analysis": "File appears to be packed or obfuscated."
        }

        Further investigation recommended."#;

        let result = provider.parse_deepseek_response(response_text).await;
        assert!(result.is_ok());

        let analysis = result.unwrap();
        assert_eq!(analysis.confidence, 0.6);
        assert!(analysis.signatures.contains(&"packer_detected".to_string()));
    }

    #[test]
    fn test_deepseek_request_structure() {
        let request = DeepSeekRequest {
            model: "deepseek-coder".to_string(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "System prompt".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: "User query".to_string(),
                },
            ],
            max_tokens: 4096,
            temperature: 0.0,
        };

        assert_eq!(request.model, "deepseek-coder");
        assert_eq!(request.messages.len(), 2);
        assert_eq!(request.temperature, 0.0);
    }

    #[test]
    fn test_deepseek_config_defaults() {
        let config = create_test_config();

        assert_eq!(config.model, "deepseek-coder");
        assert_eq!(config.max_tokens, 8000);
        assert!(config.base_url.is_some());
    }
}