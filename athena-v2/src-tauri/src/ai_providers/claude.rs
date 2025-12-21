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

pub struct ClaudeProvider {
    config: AIProviderConfig,
    client: Client,
    circuit_breaker: CircuitBreaker,
    retry_config: RetryConfig,
}

#[derive(Debug, Serialize)]
struct ClaudeRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    temperature: f32,
    system: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct ClaudeResponse {
    content: Vec<Content>,
}

#[derive(Debug, Deserialize)]
struct Content {
    text: String,
}

impl ClaudeProvider {
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

        let circuit_breaker = CircuitBreaker::new_with_name("claude".to_string(), 3, 2, 60);

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

    fn build_analysis_prompt(&self, request: &AnalysisRequest) -> String {
        format!(
            r#"Analyze this potentially malicious file and provide a detailed security assessment.

File Information:
- Name: {}
- Size: {} bytes
- Type: {}
- SHA-256: {}

Provide your analysis in the following JSON format:
{{
    "confidence": <float between 0 and 1>,
    "threat_level": "Benign" | "Suspicious" | "Malicious" | "Critical",
    "malware_family": "<family name or null>",
    "malware_type": "<type or null>",
    "signatures": ["<signature1>", "<signature2>", ...],
    "behaviors": ["<behavior1>", "<behavior2>", ...],
    "iocs": {{
        "domains": ["<domain1>", "<domain2>", ...],
        "ips": ["<ip1>", "<ip2>", ...],
        "urls": ["<url1>", "<url2>", ...],
        "files": ["<file_path1>", "<file_path2>", ...],
        "registry_keys": ["<key1>", "<key2>", ...],
        "processes": ["<process1>", "<process2>", ...],
        "mutexes": ["<mutex1>", "<mutex2>", ...]
    }},
    "recommendations": ["<recommendation1>", "<recommendation2>", ...],
    "detailed_analysis": "<comprehensive analysis text>"
}}

Base your analysis on file characteristics, known malware patterns, and security best practices."#,
            request.file_name,
            request.file_size,
            request.file_type,
            request.file_hash
        )
    }

    async fn parse_claude_response(&self, response_text: &str) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
        // Extract JSON from response
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
            provider: "Claude".to_string(),
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
impl AIProvider for ClaudeProvider {
    fn name(&self) -> &str {
        "Claude"
    }

    async fn analyze(&self, request: &AnalysisRequest) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
        let start_time = Instant::now();

        let analysis_result = self.circuit_breaker.call(async {
            // Wrap the API call with retry logic
            with_retry(
                &self.retry_config,
                || async {
                    let claude_request = ClaudeRequest {
                        model: self.config.model.clone(),
                        messages: vec![Message {
                            role: "user".to_string(),
                            content: self.build_analysis_prompt(request),
                        }],
                        max_tokens: self.config.max_tokens,
                        temperature: self.config.temperature,
                        system: "You are an expert malware analyst with deep knowledge of malware families, attack techniques, and threat intelligence.".to_string(),
                    };

                    let base_url = self.config.base_url.as_deref().unwrap_or("https://api.anthropic.com");
                    let response = self.client
                        .post(format!("{}/v1/messages", base_url))
                        .header("x-api-key", &self.config.api_key)
                        .header("anthropic-version", "2023-06-01")
                        .header("content-type", "application/json")
                        .json(&claude_request)
                        .send()
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

                    let status = response.status();
                    if !status.is_success() {
                        let error_text = response.text().await
                            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                        return Err(Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            format!("Claude API error ({}): {}", status, error_text)
                        )) as Box<dyn std::error::Error + Send + Sync>);
                    }

                    let claude_response: ClaudeResponse = response.json().await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                    let response_text = claude_response.content.first()
                        .ok_or_else(|| Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            "No content in Claude response"
                        )) as Box<dyn std::error::Error + Send + Sync>)?
                        .text.clone();

                    self.parse_claude_response(&response_text).await
                },
                "Claude",
            ).await
        }).await;
        
        let duration = start_time.elapsed();

        match analysis_result {
            Ok(mut response) => {
                response.processing_time_ms = duration.as_millis() as u64;

                // Record Prometheus metrics for successful requests
                AI_REQUEST_DURATION
                    .with_label_values(&["claude", "malware_analysis", "success"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["claude", "malware_analysis", "success"])
                    .inc();

                // Estimate token usage (Claude models use ~1 token per 4 chars)
                let prompt_length = self.build_analysis_prompt(request).len();
                let response_length = response.detailed_analysis.len();
                let estimated_prompt_tokens = prompt_length / 4;
                let estimated_completion_tokens = response_length / 4;

                AI_TOKEN_USAGE
                    .with_label_values(&["claude", "prompt"])
                    .inc_by(estimated_prompt_tokens as f64);

                AI_TOKEN_USAGE
                    .with_label_values(&["claude", "completion"])
                    .inc_by(estimated_completion_tokens as f64);

                // Estimate cost (Claude Sonnet: ~$3/MTok input, ~$15/MTok output)
                let estimated_cost = (estimated_prompt_tokens as f64 / 1_000_000.0 * 3.0)
                    + (estimated_completion_tokens as f64 / 1_000_000.0 * 15.0);

                AI_COST_ESTIMATE
                    .with_label_values(&["claude"])
                    .inc_by(estimated_cost);

                Ok(response)
            }
            Err(e) => {
                // Record failure metrics
                AI_REQUEST_DURATION
                    .with_label_values(&["claude", "malware_analysis", "error"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["claude", "malware_analysis", "error"])
                    .inc();

                Err(e)
            }
        }
    }

    async fn health_check(&self) -> Result<bool, Box<dyn Error + Send + Sync>> {
        // Simple health check - try to make a request with minimal tokens
        let test_request = ClaudeRequest {
            model: self.config.model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            max_tokens: 10,
            temperature: 0.0,
            system: "Reply with 'OK'".to_string(),
        };
        
        let base_url = self.config.base_url.as_deref().unwrap_or("https://api.anthropic.com");
        let response = self.client
            .post(format!("{}/v1/messages", base_url))
            .header("x-api-key", &self.config.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
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
            api_key: "test-api-key".to_string(),
            base_url: Some("https://api.test.com".to_string()),
            model: "claude-3-sonnet-20240229".to_string(),
            max_tokens: 4000,
            temperature: 0.3,
            timeout_secs: 120,
        }
    }

    fn create_test_request() -> AnalysisRequest {
        AnalysisRequest {
            file_name: "test.exe".to_string(),
            file_size: 12345,
            file_type: "PE32 executable".to_string(),
            file_hash: "abcd1234567890".to_string(),
            file_content: None,
            analysis_type: "malware_analysis".to_string(),
        }
    }

    #[test]
    fn test_claude_provider_creation() {
        let config = create_test_config();
        let provider = ClaudeProvider::new(config);
        assert!(provider.is_ok());

        let provider = provider.unwrap();
        assert_eq!(provider.name(), "Claude");
    }

    #[test]
    fn test_build_analysis_prompt() {
        let config = create_test_config();
        let provider = ClaudeProvider::new(config).unwrap();
        let request = create_test_request();

        let prompt = provider.build_analysis_prompt(&request);

        // Check prompt contains essential information
        assert!(prompt.contains("test.exe"));
        assert!(prompt.contains("12345"));
        assert!(prompt.contains("PE32 executable"));
        assert!(prompt.contains("abcd1234567890"));
        assert!(prompt.contains("JSON format"));
        assert!(prompt.contains("confidence"));
        assert!(prompt.contains("threat_level"));
    }

    #[tokio::test]
    async fn test_parse_claude_response_valid_json() {
        let config = create_test_config();
        let provider = ClaudeProvider::new(config).unwrap();

        let response_text = r#"{
            "confidence": 0.85,
            "threat_level": "Malicious",
            "malware_family": "Ransomware",
            "malware_type": "Crypto-locker",
            "signatures": ["sig1", "sig2"],
            "behaviors": ["file_encryption", "network_communication"],
            "iocs": {
                "domains": ["evil.com"],
                "ips": ["1.2.3.4"],
                "urls": ["http://evil.com/payload"],
                "files": ["dropped.dll"],
                "registry_keys": ["HKLM\\Software\\Malware"],
                "processes": ["evil.exe"],
                "mutexes": ["Global\\MalwareMutex"]
            },
            "recommendations": ["Quarantine immediately"],
            "detailed_analysis": "This is a detailed analysis of the malware."
        }"#;

        let result = provider.parse_claude_response(response_text).await;
        assert!(result.is_ok());

        let analysis = result.unwrap();
        assert_eq!(analysis.provider, "Claude");
        assert_eq!(analysis.confidence, 0.85);
        assert!(matches!(analysis.threat_level, ThreatLevel::Malicious));
        assert_eq!(analysis.malware_family, Some("Ransomware".to_string()));
        assert_eq!(analysis.signatures.len(), 2);
        assert_eq!(analysis.iocs.domains.len(), 1);
    }

    #[tokio::test]
    async fn test_parse_claude_response_with_extra_text() {
        let config = create_test_config();
        let provider = ClaudeProvider::new(config).unwrap();

        let response_text = r#"Here is my analysis:
        {
            "confidence": 0.5,
            "threat_level": "Suspicious",
            "malware_family": null,
            "malware_type": null,
            "signatures": [],
            "behaviors": ["unusual_api_calls"],
            "iocs": {
                "domains": [],
                "ips": [],
                "urls": [],
                "files": [],
                "registry_keys": [],
                "processes": [],
                "mutexes": []
            },
            "recommendations": ["Further analysis needed"],
            "detailed_analysis": "Requires more investigation."
        }
        This is my conclusion."#;

        let result = provider.parse_claude_response(response_text).await;
        assert!(result.is_ok());

        let analysis = result.unwrap();
        assert_eq!(analysis.confidence, 0.5);
        assert!(matches!(analysis.threat_level, ThreatLevel::Suspicious));
    }

    #[test]
    fn test_claude_request_structure() {
        let request = ClaudeRequest {
            model: "claude-3-sonnet-20240229".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Test prompt".to_string(),
            }],
            max_tokens: 1000,
            temperature: 0.3,
            system: "You are a security analyst".to_string(),
        };

        assert_eq!(request.model, "claude-3-sonnet-20240229");
        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.max_tokens, 1000);
    }
}