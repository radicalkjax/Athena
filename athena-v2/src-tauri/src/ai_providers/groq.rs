// Groq provider for Llama models - Groq provides fast inference for open-source LLMs
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

pub struct GroqProvider {
    config: AIProviderConfig,
    client: Client,
    circuit_breaker: Arc<CircuitBreaker>,
    retry_config: RetryConfig,
}

#[derive(Debug, Serialize)]
struct GroqRequest {
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
struct GroqResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

impl GroqProvider {
    pub fn new(config: AIProviderConfig) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_secs))
            .connect_timeout(std::time::Duration::from_secs(10))
            .pool_idle_timeout(std::time::Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .use_rustls_tls()
            .build()
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        let circuit_breaker = Arc::new(CircuitBreaker::new_with_name("groq".to_string(), 3, 2, 60));

        // Register with global registry (spawn to avoid blocking)
        let breaker_clone = circuit_breaker.clone();
        tokio::spawn(async move {
            register_circuit_breaker("groq", breaker_clone).await;
        });

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

    async fn parse_response(&self, response_text: &str) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
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
            provider: "Llama (Groq)".to_string(),
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
            processing_time_ms: 0,
        })
    }
}

#[async_trait]
impl AIProvider for GroqProvider {
    fn name(&self) -> &str {
        "Llama (Groq)"
    }

    async fn analyze(&self, request: &AnalysisRequest) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>> {
        let start_time = Instant::now();

        let analysis_result = self.circuit_breaker.call(async {
            with_retry(
                &self.retry_config,
                || async {
                    let groq_request = GroqRequest {
                        model: self.config.model.clone(),
                        messages: vec![
                            Message {
                                role: "system".to_string(),
                                content: "You are an expert malware analyst with deep knowledge of malware families, attack techniques, and threat intelligence.".to_string(),
                            },
                            Message {
                                role: "user".to_string(),
                                content: self.build_analysis_prompt(request),
                            },
                        ],
                        max_tokens: self.config.max_tokens,
                        temperature: self.config.temperature,
                    };

                    let base_url = self.config.base_url.as_deref()
                        .unwrap_or("https://api.groq.com/openai");

                    let response = self.client
                        .post(format!("{}/v1/chat/completions", base_url))
                        .header("Authorization", format!("Bearer {}", self.config.api_key))
                        .header("content-type", "application/json")
                        .json(&groq_request)
                        .send()
                        .await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

                    let status = response.status();
                    if !status.is_success() {
                        let error_text = response.text().await
                            .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                        return Err(Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            format!("Groq API error ({}): {}", status, error_text)
                        )) as Box<dyn std::error::Error + Send + Sync>);
                    }

                    let groq_response: GroqResponse = response.json().await
                        .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;

                    let response_text = groq_response.choices
                        .first()
                        .map(|c| c.message.content.clone())
                        .ok_or_else(|| Box::new(std::io::Error::new(
                            std::io::ErrorKind::Other,
                            "No content in Groq response"
                        )) as Box<dyn std::error::Error + Send + Sync>)?;

                    self.parse_response(&response_text).await
                },
                "Groq",
            ).await
        }).await;

        let duration = start_time.elapsed();

        match analysis_result {
            Ok(mut response) => {
                response.processing_time_ms = duration.as_millis() as u64;

                AI_REQUEST_DURATION
                    .with_label_values(&["groq", "malware_analysis", "success"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["groq", "malware_analysis", "success"])
                    .inc();

                let prompt_length = self.build_analysis_prompt(request).len();
                let response_length = response.detailed_analysis.len();
                let estimated_prompt_tokens = prompt_length / 4;
                let estimated_completion_tokens = response_length / 4;

                AI_TOKEN_USAGE
                    .with_label_values(&["groq", "prompt"])
                    .inc_by(estimated_prompt_tokens as f64);

                AI_TOKEN_USAGE
                    .with_label_values(&["groq", "completion"])
                    .inc_by(estimated_completion_tokens as f64);

                // Groq Llama 70B pricing: ~$0.59/MTok input, ~$0.79/MTok output
                let estimated_cost = (estimated_prompt_tokens as f64 / 1_000_000.0 * 0.59)
                    + (estimated_completion_tokens as f64 / 1_000_000.0 * 0.79);

                AI_COST_ESTIMATE
                    .with_label_values(&["groq"])
                    .inc_by(estimated_cost);

                Ok(response)
            }
            Err(e) => {
                AI_REQUEST_DURATION
                    .with_label_values(&["groq", "malware_analysis", "error"])
                    .observe(duration.as_secs_f64());

                AI_REQUEST_COUNTER
                    .with_label_values(&["groq", "malware_analysis", "error"])
                    .inc();

                Err(e)
            }
        }
    }

    async fn health_check(&self) -> Result<bool, Box<dyn Error + Send + Sync>> {
        let test_request = GroqRequest {
            model: self.config.model.clone(),
            messages: vec![Message {
                role: "user".to_string(),
                content: "Hello".to_string(),
            }],
            max_tokens: 10,
            temperature: 0.0,
        };

        let base_url = self.config.base_url.as_deref()
            .unwrap_or("https://api.groq.com/openai");

        let response = self.client
            .post(format!("{}/v1/chat/completions", base_url))
            .header("Authorization", format!("Bearer {}", self.config.api_key))
            .header("content-type", "application/json")
            .json(&test_request)
            .send()
            .await?;

        Ok(response.status().is_success())
    }

    async fn list_models(&self) -> Result<Vec<ModelInfo>, Box<dyn Error + Send + Sync>> {
        let base_url = self.config.base_url.as_deref()
            .unwrap_or("https://api.groq.com/openai");

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
                format!("Failed to fetch Groq models: {}", error_text)
            )));
        }

        let models_response: GroqModelsResponse = response.json().await
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;

        let models: Vec<ModelInfo> = models_response.data
            .into_iter()
            .map(|m| ModelInfo {
                id: m.id.clone(),
                name: format_groq_model_name(&m.id),
                description: Some(format!("Groq-hosted {} model", m.owned_by)),
                context_window: m.context_window,
                max_output_tokens: None,
            })
            .collect();

        Ok(models)
    }
}

#[derive(Debug, Deserialize)]
struct GroqModelsResponse {
    data: Vec<GroqModelData>,
}

#[derive(Debug, Deserialize)]
struct GroqModelData {
    id: String,
    owned_by: String,
    context_window: Option<u32>,
}

fn format_groq_model_name(id: &str) -> String {
    // Convert llama-3.1-70b-versatile to "Llama 3.1 70B Versatile"
    id.split('-')
        .map(|word| {
            if word.chars().all(|c| c.is_numeric() || c == '.') {
                word.to_string() // Keep version numbers as-is
            } else if word.chars().all(|c| c.is_alphabetic()) {
                // Capitalize first letter
                let mut chars = word.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => first.to_uppercase().chain(chars).collect(),
                }
            } else {
                word.to_uppercase() // All caps for sizes like 70b
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}
