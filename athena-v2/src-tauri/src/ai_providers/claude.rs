use super::{AIProvider, AIProviderConfig, AnalysisRequest, AnalysisResponse, IOCs, ThreatLevel};
use crate::ai_providers::circuit_breaker::CircuitBreaker;
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
            processing_time_ms: 0, // Will be set later
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
                
            if !response.status().is_success() {
                let error_text = response.text().await
                    .map_err(|e| Box::new(e) as Box<dyn std::error::Error + Send + Sync>)?;
                return Err(Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Claude API error: {}", error_text)
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