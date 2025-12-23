use super::{AIProvider, AIProviderConfig, AnalysisRequest, AnalysisResponse, IOCs, ThreatLevel, ModelInfo, register_circuit_breaker};
use crate::ai_providers::circuit_breaker::CircuitBreaker;
use crate::ai_providers::retry::{RetryConfig, with_retry};
use crate::metrics::{AI_REQUEST_DURATION, AI_REQUEST_COUNTER, AI_TOKEN_USAGE, AI_COST_ESTIMATE};
use async_trait::async_trait;
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::sync::Arc;
use std::time::Instant;

pub struct OpenAIProvider {
    config: AIProviderConfig,
    client: Client,
    circuit_breaker: Arc<CircuitBreaker>,
    retry_config: RetryConfig,
}

#[derive(Debug, Serialize)]
struct OpenAIRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    temperature: f32,
    response_format: ResponseFormat,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    #[serde(rename = "type")]
    format_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Deserialize)]
struct OpenAIResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize)]
struct ModelsResponse {
    data: Vec<ModelData>,
}

#[derive(Debug, Deserialize)]
struct ModelData {
    id: String,
    #[serde(default)]
    owned_by: String,
}

impl OpenAIProvider {
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

        let circuit_breaker = Arc::new(CircuitBreaker::new_with_name("openai".to_string(), 3, 2, 60));

        // Register with global registry (spawn to avoid blocking)
        let breaker_clone = circuit_breaker.clone();
        tokio::spawn(async move {
            register_circuit_breaker("openai", breaker_clone).await;
        });

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
        "You are an expert malware analyst specializing in threat detection and analysis. \
         Analyze files for malicious behavior, identify malware families, extract IOCs, \
         and provide actionable recommendations. Always respond with valid JSON.".to_string()
    }

    fn build_analysis_prompt(&self, request: &AnalysisRequest) -> String {
        format!(
            r#"Analyze this file for malware and provide a comprehensive security assessment:

File Details:
- Name: {}
- Size: {} bytes
- Type: {}
- SHA-256: {}

Respond with a JSON object containing:
{{
    "confidence": <0.0-1.0>,
    "threat_level": "Benign|Suspicious|Malicious|Critical",
    "malware_family": "<family or null>",
    "malware_type": "<type or null>",
    "signatures": ["list of detected signatures"],
    "behaviors": ["list of observed behaviors"],
    "iocs": {{
        "domains": [],
        "ips": [],
        "urls": [],
        "files": [],
        "registry_keys": [],
        "processes": [],
        "mutexes": []
    }},
    "recommendations": ["list of security recommendations"],
    "detailed_analysis": "comprehensive analysis text"
}}"#,
            request.file_name,
            request.file_size,
            request.file_type,
            request.file_hash
        )
    }

    async fn parse_openai_response(&self, response_text: &str) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
        let parsed: serde_json::Value = serde_json::from_str(response_text)?;
        
        let threat_level = match parsed["threat_level"].as_str().unwrap_or("Suspicious") {
            "Benign" => ThreatLevel::Benign,
            "Malicious" => ThreatLevel::Malicious,
            "Critical" => ThreatLevel::Critical,
            _ => ThreatLevel::Suspicious,
        };
        
        Ok(AnalysisResponse {
            provider: "OpenAI".to_string(),
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
impl AIProvider for OpenAIProvider {
    fn name(&self) -> &str {
        "OpenAI"
    }

    async fn analyze(&self, request: &AnalysisRequest) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
        let start_time = Instant::now();

        let analysis_result = self.circuit_breaker.call(async {
            // Wrap the API call with retry logic
            with_retry(
                &self.retry_config,
                || async {
                    let openai_request = OpenAIRequest {
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
                        response_format: ResponseFormat {
                            format_type: "json_object".to_string(),
                        },
                    };

                    let base_url = self.config.base_url.as_deref().unwrap_or("https://api.openai.com");
                    let response = self.client
                        .post(format!("{}/v1/chat/completions", base_url))
                        .header("Authorization", format!("Bearer {}", self.config.api_key))
                        .header("Content-Type", "application/json")
                        .json(&openai_request)
                        .send()
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

                    let status = response.status();
                    if !status.is_success() {
                        let error_text = response.text().await
                            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                        return Err(Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            format!("OpenAI API error ({}): {}", status, error_text)
                        )) as Box<dyn std::error::Error + Send + Sync>);
                    }

                    let openai_response: OpenAIResponse = response.json().await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                    let response_text = openai_response.choices.first()
                        .ok_or_else(|| Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            "No choices in OpenAI response"
                        )) as Box<dyn std::error::Error + Send + Sync>)?
                        .message.content.clone();

                    self.parse_openai_response(&response_text).await
                },
                "OpenAI",
            ).await
        }).await;
        
        let duration = start_time.elapsed();

        match analysis_result {
            Ok(mut response) => {
                response.processing_time_ms = duration.as_millis() as u64;

                // Record Prometheus metrics for successful requests
                AI_REQUEST_DURATION
                    .with_label_values(&["openai", "malware_analysis", "success"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["openai", "malware_analysis", "success"])
                    .inc();

                // Estimate token usage (OpenAI uses ~1 token per 4 chars)
                let system_prompt_length = self.build_system_prompt().len();
                let user_prompt_length = self.build_analysis_prompt(request).len();
                let response_length = response.detailed_analysis.len();
                let estimated_prompt_tokens = (system_prompt_length + user_prompt_length) / 4;
                let estimated_completion_tokens = response_length / 4;

                AI_TOKEN_USAGE
                    .with_label_values(&["openai", "prompt"])
                    .inc_by(estimated_prompt_tokens as f64);

                AI_TOKEN_USAGE
                    .with_label_values(&["openai", "completion"])
                    .inc_by(estimated_completion_tokens as f64);

                // Estimate cost (GPT-4: ~$10/MTok input, ~$30/MTok output)
                let estimated_cost = (estimated_prompt_tokens as f64 / 1_000_000.0 * 10.0)
                    + (estimated_completion_tokens as f64 / 1_000_000.0 * 30.0);

                AI_COST_ESTIMATE
                    .with_label_values(&["openai"])
                    .inc_by(estimated_cost);

                Ok(response)
            }
            Err(e) => {
                // Record failure metrics
                AI_REQUEST_DURATION
                    .with_label_values(&["openai", "malware_analysis", "error"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["openai", "malware_analysis", "error"])
                    .inc();

                Err(e)
            }
        }
    }

    async fn health_check(&self) -> Result<bool, Box<dyn Error + Send + Sync>> {
        let test_request = OpenAIRequest {
            model: self.config.model.clone(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "Reply with {\"status\": \"ok\"}".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: "Status check".to_string(),
                },
            ],
            max_tokens: 20,
            temperature: 0.0,
            response_format: ResponseFormat {
                format_type: "json_object".to_string(),
            },
        };

        let base_url = self.config.base_url.as_deref().unwrap_or("https://api.openai.com");
        let response = self.client
            .post(format!("{}/v1/chat/completions", base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("Content-Type", "application/json")
            .json(&test_request)
            .send()
            .await
            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

        Ok(response.status().is_success())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, Box<dyn Error + Send + Sync>> {
        let base_url = self.config.base_url.as_deref().unwrap_or("https://api.openai.com");
        let response = self.client
            .get(format!("{}/v1/models", base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .send()
            .await
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("Failed to fetch OpenAI models: {}", error_text)
            )));
        }

        let models_response: ModelsResponse = response.json().await
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        // Filter to only chat models (gpt-*) and sort by name
        let mut models: Vec<ModelInfo> = models_response.data
            .into_iter()
            .filter(|m| m.id.starts_with("gpt-") && !m.id.contains("instruct"))
            .map(|m| ModelInfo {
                id: m.id.clone(),
                name: format_model_name(&m.id),
                description: Some(format!("OpenAI model owned by {}", m.owned_by)),
                context_window: get_openai_context_window(&m.id),
                max_output_tokens: get_openai_max_output(&m.id),
            })
            .collect();

        models.sort_by(|a, b| b.id.cmp(&a.id)); // Sort descending so newest models first
        Ok(models)
    }
}

fn format_model_name(id: &str) -> String {
    // Convert model ID to human-readable name
    id.replace("-", " ")
        .split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().chain(chars).collect(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn get_openai_context_window(id: &str) -> Option<u32> {
    match id {
        id if id.contains("gpt-4o") => Some(128000),
        id if id.contains("gpt-4-turbo") => Some(128000),
        id if id.contains("gpt-4-32k") => Some(32768),
        id if id.contains("gpt-4") => Some(8192),
        id if id.contains("gpt-3.5-turbo-16k") => Some(16384),
        id if id.contains("gpt-3.5") => Some(16385),
        _ => None,
    }
}

fn get_openai_max_output(id: &str) -> Option<u32> {
    match id {
        id if id.contains("gpt-4o") => Some(16384),
        id if id.contains("gpt-4-turbo") => Some(4096),
        id if id.contains("gpt-4") => Some(8192),
        id if id.contains("gpt-3.5") => Some(4096),
        _ => Some(4096),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_config() -> AIProviderConfig {
        AIProviderConfig {
            api_key: "test-openai-key".to_string(),
            base_url: Some("https://api.test-openai.com".to_string()),
            model: "gpt-4".to_string(),
            max_tokens: 4000,
            temperature: 0.2,
            timeout_secs: 90,
        }
    }

    fn create_test_request() -> AnalysisRequest {
        AnalysisRequest {
            file_name: "malware.dll".to_string(),
            file_size: 54321,
            file_type: "DLL".to_string(),
            file_hash: "xyz789".to_string(),
            file_content: None,
            analysis_type: "malware_analysis".to_string(),
        }
    }

    #[test]
    fn test_openai_provider_creation() {
        let config = create_test_config();
        let provider = OpenAIProvider::new(config);
        assert!(provider.is_ok());

        let provider = provider.unwrap();
        assert_eq!(provider.name(), "OpenAI");
    }

    #[test]
    fn test_build_system_prompt() {
        let config = create_test_config();
        let provider = OpenAIProvider::new(config).unwrap();

        let system_prompt = provider.build_system_prompt();

        assert!(system_prompt.contains("malware analyst"));
        assert!(system_prompt.contains("JSON"));
    }

    #[test]
    fn test_build_analysis_prompt() {
        let config = create_test_config();
        let provider = OpenAIProvider::new(config).unwrap();
        let request = create_test_request();

        let prompt = provider.build_analysis_prompt(&request);

        assert!(prompt.contains("malware.dll"));
        assert!(prompt.contains("54321"));
        assert!(prompt.contains("DLL"));
        assert!(prompt.contains("xyz789"));
        assert!(prompt.contains("JSON"));
    }

    #[tokio::test]
    async fn test_parse_openai_response_valid() {
        let config = create_test_config();
        let provider = OpenAIProvider::new(config).unwrap();

        let response_text = r#"{
            "confidence": 0.92,
            "threat_level": "Critical",
            "malware_family": "Trojan",
            "malware_type": "Backdoor",
            "signatures": ["sig_a", "sig_b", "sig_c"],
            "behaviors": ["remote_access", "data_exfiltration"],
            "iocs": {
                "domains": ["bad.com", "worse.net"],
                "ips": ["10.0.0.1"],
                "urls": [],
                "files": [],
                "registry_keys": [],
                "processes": ["trojan.exe"],
                "mutexes": []
            },
            "recommendations": ["Isolate system", "Remove immediately"],
            "detailed_analysis": "Critical backdoor trojan detected."
        }"#;

        let result = provider.parse_openai_response(response_text).await;
        assert!(result.is_ok());

        let analysis = result.unwrap();
        assert_eq!(analysis.provider, "OpenAI");
        assert_eq!(analysis.model, "gpt-4");
        assert_eq!(analysis.confidence, 0.92);
        assert!(matches!(analysis.threat_level, ThreatLevel::Critical));
        assert_eq!(analysis.malware_family, Some("Trojan".to_string()));
        assert_eq!(analysis.signatures.len(), 3);
        assert_eq!(analysis.iocs.domains.len(), 2);
    }

    #[tokio::test]
    async fn test_parse_openai_response_benign() {
        let config = create_test_config();
        let provider = OpenAIProvider::new(config).unwrap();

        let response_text = r#"{
            "confidence": 0.98,
            "threat_level": "Benign",
            "malware_family": null,
            "malware_type": null,
            "signatures": [],
            "behaviors": [],
            "iocs": {
                "domains": [],
                "ips": [],
                "urls": [],
                "files": [],
                "registry_keys": [],
                "processes": [],
                "mutexes": []
            },
            "recommendations": [],
            "detailed_analysis": "File appears to be legitimate software."
        }"#;

        let result = provider.parse_openai_response(response_text).await;
        assert!(result.is_ok());

        let analysis = result.unwrap();
        assert!(matches!(analysis.threat_level, ThreatLevel::Benign));
        assert_eq!(analysis.confidence, 0.98);
        assert!(analysis.signatures.is_empty());
    }

    #[test]
    fn test_openai_request_structure() {
        let request = OpenAIRequest {
            model: "gpt-4".to_string(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: "You are an assistant".to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: "Analyze this".to_string(),
                },
            ],
            max_tokens: 2000,
            temperature: 0.1,
            response_format: ResponseFormat {
                format_type: "json_object".to_string(),
            },
        };

        assert_eq!(request.model, "gpt-4");
        assert_eq!(request.messages.len(), 2);
        assert_eq!(request.response_format.format_type, "json_object");
    }
}