pub mod circuit_breaker;
pub mod claude;
pub mod openai;
pub mod deepseek;
pub mod gemini;
pub mod mistral;
pub mod groq;
pub mod queue_manager;
pub mod retry;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use lazy_static::lazy_static;
use circuit_breaker::CircuitBreaker;

lazy_static! {
    /// Global registry of circuit breakers for all AI providers
    static ref CIRCUIT_BREAKERS: Arc<RwLock<HashMap<String, Arc<CircuitBreaker>>>> =
        Arc::new(RwLock::new(HashMap::new()));
}

/// Register a circuit breaker for a provider in the global registry
pub async fn register_circuit_breaker(provider: &str, breaker: Arc<CircuitBreaker>) {
    let mut breakers = CIRCUIT_BREAKERS.write().await;
    breakers.insert(provider.to_string(), breaker);
}

/// Get or create a circuit breaker for a provider
pub async fn get_or_create_circuit_breaker(provider: &str) -> Arc<CircuitBreaker> {
    // First try to get existing breaker
    {
        let breakers = CIRCUIT_BREAKERS.read().await;
        if let Some(breaker) = breakers.get(provider) {
            return breaker.clone();
        }
    }

    // If not found, create and register a new one
    let mut breakers = CIRCUIT_BREAKERS.write().await;
    breakers.entry(provider.to_string())
        .or_insert_with(|| {
            Arc::new(CircuitBreaker::new_with_name(
                provider.to_string(),
                3,  // failure_threshold
                2,  // success_threshold
                60  // timeout_secs
            ))
        })
        .clone()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIProviderConfig {
    pub api_key: String,
    pub base_url: Option<String>,
    pub model: String,
    pub max_tokens: u32,
    pub temperature: f32,
    pub timeout_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisRequest {
    pub file_hash: String,
    pub file_name: String,
    pub file_size: usize,
    pub file_type: String,
    pub file_content: Option<Vec<u8>>,
    pub analysis_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResponse {
    pub provider: String,
    pub model: String,
    pub timestamp: i64,
    pub confidence: f32,
    pub threat_level: ThreatLevel,
    pub malware_family: Option<String>,
    pub malware_type: Option<String>,
    pub signatures: Vec<String>,
    pub behaviors: Vec<String>,
    pub iocs: IOCs,
    pub recommendations: Vec<String>,
    pub detailed_analysis: String,
    pub processing_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ThreatLevel {
    Benign,
    Suspicious,
    Malicious,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IOCs {
    pub domains: Vec<String>,
    pub ips: Vec<String>,
    pub urls: Vec<String>,
    pub files: Vec<String>,
    pub registry_keys: Vec<String>,
    pub processes: Vec<String>,
    pub mutexes: Vec<String>,
}

/// Information about an AI model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub context_window: Option<u32>,
    pub max_output_tokens: Option<u32>,
}

#[async_trait]
pub trait AIProvider: Send + Sync {
    #[allow(dead_code)]
    fn name(&self) -> &str;
    async fn analyze(&self, request: &AnalysisRequest) -> Result<AnalysisResponse, Box<dyn Error + Send + Sync>>;
    #[allow(dead_code)]
    async fn health_check(&self) -> Result<bool, Box<dyn Error + Send + Sync>>;
    /// List available models from this provider's API
    async fn list_models(&self) -> Result<Vec<ModelInfo>, Box<dyn Error + Send + Sync>>;
}

impl Default for AIProviderConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            base_url: None,
            model: String::new(),
            max_tokens: 4096,
            temperature: 0.3,
            timeout_secs: 30,
        }
    }
}

impl Default for IOCs {
    fn default() -> Self {
        Self {
            domains: Vec::new(),
            ips: Vec::new(),
            urls: Vec::new(),
            files: Vec::new(),
            registry_keys: Vec::new(),
            processes: Vec::new(),
            mutexes: Vec::new(),
        }
    }
}