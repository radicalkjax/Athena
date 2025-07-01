use super::{AIProvider, AIProviderConfig, AnalysisRequest, AnalysisResponse, IOCs, ThreatLevel};
use crate::ai_providers::circuit_breaker::CircuitBreaker;
use async_trait::async_trait;
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::time::Instant;

pub struct OpenAIProvider {
    config: AIProviderConfig,
    client: Client,
    circuit_breaker: CircuitBreaker,
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

impl OpenAIProvider {
    pub fn new(config: AIProviderConfig) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_secs))
            .build()
            .unwrap();
            
        let circuit_breaker = CircuitBreaker::new(3, 2, 60);
        
        Self {
            config,
            client,
            circuit_breaker,
        }
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
            processing_time_ms: 0, // Will be set later
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
                
            if !response.status().is_success() {
                let error_text = response.text().await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("OpenAI API error: {}", error_text)
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
        }).await;
        
        match analysis_result {
            Ok(mut response) => {
                response.processing_time_ms = start_time.elapsed().as_millis() as u64;
                Ok(response)
            }
            Err(e) => Err(e),
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
}