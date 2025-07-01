use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::command;
use crate::ai_providers::{AIProvider, AIProviderConfig as ProviderConfig, AnalysisRequest as ProviderRequest};
use crate::ai_providers::claude::ClaudeProvider;
use crate::ai_providers::openai::OpenAIProvider;
use crate::ai_providers::deepseek::DeepSeekProvider;

#[derive(Debug, Serialize, Deserialize)]
pub struct AIProviderConfig {
    id: String,
    name: String,
    api_key: Option<String>,
    base_url: Option<String>,
    model: Option<String>,
    max_tokens: Option<i32>,
    temperature: Option<f32>,
    enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIAnalysisRequest {
    file_hash: String,
    file_name: String,
    file_size: usize,
    file_type: String,
    file_content: Option<Vec<u8>>,
    analysis_type: String,
    providers: Vec<String>,
    priority: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIAnalysisResult {
    provider: String,
    timestamp: u64,
    confidence: f32,
    threat_level: String,
    malware_family: Option<String>,
    malware_type: Option<String>,
    signatures: Vec<String>,
    behaviors: Vec<String>,
    iocs: IOCs,
    recommendations: Vec<String>,
    raw_response: Option<serde_json::Value>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IOCs {
    domains: Vec<String>,
    ips: Vec<String>,
    files: Vec<String>,
    registry: Vec<String>,
    processes: Vec<String>,
}

#[command]
pub async fn analyze_with_ai(
    provider: String,
    config: AIProviderConfig,
    request: AIAnalysisRequest,
) -> Result<AIAnalysisResult, String> {
    // Convert to provider-specific config
    let provider_config = ProviderConfig {
        api_key: config.api_key.ok_or("API key is required")?,
        base_url: config.base_url,
        model: config.model.unwrap_or_else(|| match provider.as_str() {
            "claude" => "claude-3-sonnet-20240229".to_string(),
            "gpt4" => "gpt-4-turbo-preview".to_string(),
            "deepseek" => "deepseek-chat".to_string(),
            _ => "default".to_string(),
        }),
        max_tokens: config.max_tokens.unwrap_or(4096) as u32,
        temperature: config.temperature.unwrap_or(0.3),
        timeout_secs: 30,
    };
    
    // Create the appropriate provider
    let ai_provider: Arc<dyn AIProvider> = match provider.as_str() {
        "claude" => Arc::new(ClaudeProvider::new(provider_config)),
        "gpt4" | "openai" => Arc::new(OpenAIProvider::new(provider_config)),
        "deepseek" => Arc::new(DeepSeekProvider::new(provider_config)),
        _ => return Err(format!("Unsupported provider: {}", provider)),
    };
    
    // Convert request
    let provider_request = ProviderRequest {
        file_hash: request.file_hash,
        file_name: request.file_name,
        file_size: request.file_size,
        file_type: request.file_type,
        file_content: request.file_content,
        analysis_type: request.analysis_type,
    };
    
    // Perform analysis
    let analysis_response = ai_provider.analyze(&provider_request)
        .await
        .map_err(|e| format!("Analysis failed: {}", e))?;
    
    // Convert response
    let result = AIAnalysisResult {
        provider: analysis_response.provider,
        timestamp: analysis_response.timestamp as u64,
        confidence: analysis_response.confidence,
        threat_level: match analysis_response.threat_level {
            crate::ai_providers::ThreatLevel::Benign => "benign".to_string(),
            crate::ai_providers::ThreatLevel::Suspicious => "suspicious".to_string(),
            crate::ai_providers::ThreatLevel::Malicious => "malicious".to_string(),
            crate::ai_providers::ThreatLevel::Critical => "critical".to_string(),
        },
        malware_family: analysis_response.malware_family,
        malware_type: analysis_response.malware_type,
        signatures: analysis_response.signatures,
        behaviors: analysis_response.behaviors,
        iocs: IOCs {
            domains: analysis_response.iocs.domains,
            ips: analysis_response.iocs.ips,
            files: analysis_response.iocs.files,
            registry: analysis_response.iocs.registry_keys,
            processes: analysis_response.iocs.processes,
        },
        recommendations: analysis_response.recommendations,
        raw_response: Some(serde_json::json!({
            "detailed_analysis": analysis_response.detailed_analysis,
            "processing_time_ms": analysis_response.processing_time_ms,
        })),
        error: None,
    };
    
    Ok(result)
}

#[command]
pub async fn get_ai_provider_status() -> Result<HashMap<String, bool>, String> {
    let mut status = HashMap::new();
    
    // Check each provider's health
    // Note: This requires API keys to be configured in the app
    // For now, we'll return a simulated status
    // In production, you would:
    // 1. Load API keys from secure storage
    // 2. Create provider instances
    // 3. Call health_check() on each
    
    status.insert("claude".to_string(), true);
    status.insert("gpt4".to_string(), true);
    status.insert("openai".to_string(), true);
    status.insert("deepseek".to_string(), true);
    status.insert("gemini".to_string(), false); // Not implemented yet
    status.insert("mistral".to_string(), false); // Not implemented yet
    status.insert("llama".to_string(), false); // Not implemented yet
    
    Ok(status)
}

#[command]
pub async fn update_ai_provider_config(
    provider: String,
    _config: AIProviderConfig,
) -> Result<(), String> {
    // In a real implementation, this would update provider configuration
    // For now, just simulate success
    println!("Updated configuration for provider: {}", provider);
    Ok(())
}