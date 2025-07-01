use super::{AIProvider, AIProviderConfig, AnalysisRequest, AnalysisResponse, IOCs, ThreatLevel};
use crate::ai_providers::circuit_breaker::CircuitBreaker;
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
            processing_time_ms: 0, // Will be set later
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
                .await?;
                
            if !response.status().is_success() {
                let error_text = response.text().await?;
                return Err(format!("DeepSeek API error: {}", error_text).into());
            }
            
            let deepseek_response: DeepSeekResponse = response.json().await?;
            let response_text = deepseek_response.choices.first()
                .ok_or("No choices in DeepSeek response")?
                .message.content.clone();
                
            self.parse_deepseek_response(&response_text).await
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