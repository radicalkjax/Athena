use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tauri::command;
use crate::ai_providers::{AIProvider, AIProviderConfig as ProviderConfig, AnalysisRequest as ProviderRequest, ModelInfo};
use crate::ai_providers::claude::ClaudeProvider;
use crate::ai_providers::openai::OpenAIProvider;
use crate::ai_providers::deepseek::DeepSeekProvider;
use crate::ai_providers::gemini::GeminiProvider;
use crate::ai_providers::mistral::MistralProvider;
use crate::ai_providers::groq::GroqProvider;
use crate::ai_providers::queue_manager::QueueManager;
use crate::cache::{SqliteCache, CacheConfig};
use crate::commands::file_analysis::record_ai_request;
use crate::secure_storage;
use lazy_static::lazy_static;

// Global configuration storage
lazy_static! {
    static ref AI_CONFIGS: Arc<Mutex<HashMap<String, AIProviderConfig>>> = Arc::new(Mutex::new(HashMap::new()));
    /// Global queue manager for tracking AI request queue sizes (in-memory per DeepWiki)
    static ref QUEUE_MANAGER: QueueManager = QueueManager::new();
    /// Global SQLite cache for AI analysis results (per DeepWiki)
    static ref AI_CACHE: Option<Arc<SqliteCache>> = {
        match SqliteCache::new(CacheConfig::default()) {
            Ok(cache) => Some(Arc::new(cache)),
            Err(e) => {
                eprintln!("Warning: Failed to initialize AI cache, using in-memory fallback: {}", e);
                // Create in-memory cache as fallback
                let mut fallback_config = CacheConfig::default();
                fallback_config.db_path = std::path::PathBuf::from(":memory:");
                match SqliteCache::new(fallback_config) {
                    Ok(cache) => Some(Arc::new(cache)),
                    Err(e2) => {
                        eprintln!("Critical: Cannot initialize any cache (file or in-memory): {}. AI caching disabled.", e2);
                        None
                    }
                }
            }
        }
    };
}

fn get_config_file_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("athena")
        .join("ai_providers.json")
}

fn get_ensemble_settings_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("athena")
        .join("ensemble_settings.json")
}

/// Ensemble settings for multi-provider AI analysis with consensus voting
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnsembleSettings {
    /// Enable consensus voting across multiple providers
    pub consensus_voting: bool,
    /// Weight responses by model confidence scores
    pub weight_by_confidence: bool,
    /// Enable cross-validation where models critique each other
    pub cross_validation: bool,
    /// Minimum percentage of providers that must agree (50-100)
    pub consensus_threshold: u8,
    /// List of provider IDs to use in ensemble
    pub enabled_providers: Vec<String>,
}

impl Default for EnsembleSettings {
    fn default() -> Self {
        Self {
            consensus_voting: true,
            weight_by_confidence: true,
            cross_validation: false,
            consensus_threshold: 75,
            enabled_providers: vec![],
        }
    }
}

/// Result from ensemble analysis combining multiple provider responses
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnsembleAnalysisResult {
    /// Individual results from each provider
    pub provider_results: Vec<AIAnalysisResult>,
    /// Aggregated consensus result
    pub consensus: ConsensusResult,
    /// Number of providers that participated
    pub providers_queried: usize,
    /// Number of providers that succeeded
    pub providers_succeeded: usize,
    /// Total processing time in milliseconds
    pub total_time_ms: u64,
}

/// Consensus result from aggregating multiple provider responses
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConsensusResult {
    /// Final threat level (majority vote or weighted)
    pub threat_level: String,
    /// Agreement percentage for threat level
    pub threat_level_agreement: f32,
    /// Weighted average confidence across providers
    pub confidence: f32,
    /// Most common malware family (if detected)
    pub malware_family: Option<String>,
    /// Family agreement percentage
    pub family_agreement: f32,
    /// Union of all detected signatures
    pub all_signatures: Vec<String>,
    /// Signatures that multiple providers agreed on
    pub consensus_signatures: Vec<String>,
    /// Union of all detected behaviors
    pub all_behaviors: Vec<String>,
    /// Behaviors that multiple providers agreed on
    pub consensus_behaviors: Vec<String>,
    /// Aggregated IOCs from all providers
    pub aggregated_iocs: IOCs,
    /// Combined recommendations (deduplicated)
    pub recommendations: Vec<String>,
    /// Whether consensus threshold was met
    pub consensus_reached: bool,
}

fn load_ensemble_settings() -> Result<EnsembleSettings, String> {
    let path = get_ensemble_settings_path();
    if !path.exists() {
        return Ok(EnsembleSettings::default());
    }
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read ensemble settings: {}", e))?;
    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse ensemble settings: {}", e))
}

fn save_ensemble_settings(settings: &EnsembleSettings) -> Result<(), String> {
    let path = get_ensemble_settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }
    let contents = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("Failed to serialize ensemble settings: {}", e))?;
    std::fs::write(&path, contents)
        .map_err(|e| format!("Failed to write ensemble settings: {}", e))
}

fn load_configs() -> Result<HashMap<String, AIProviderConfig>, String> {
    let config_path = get_config_file_path();

    if !config_path.exists() {
        return Ok(HashMap::new());
    }

    let contents = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    let mut configs: HashMap<String, AIProviderConfig> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse config file: {}", e))?;

    // Load API keys from secure storage (keychain)
    // The JSON file only stores non-sensitive config (model, endpoints, etc.)
    for (provider_id, config) in configs.iter_mut() {
        // Check if API key is marked as stored in keychain
        if config.api_key.as_deref() == Some("STORED_IN_KEYCHAIN") {
            // Retrieve from keychain
            match secure_storage::get_api_key(provider_id) {
                Ok(Some(key)) => config.api_key = Some(key),
                Ok(None) => {
                    eprintln!("Warning: API key marked as stored in keychain for '{}' but not found", provider_id);
                    config.api_key = None;
                }
                Err(e) => {
                    eprintln!("Warning: Failed to retrieve API key from keychain for '{}': {}", provider_id, e);
                    config.api_key = None;
                }
            }
        }
        // If api_key is Some and not the placeholder, it might be legacy plain-text
        // Migration: move it to keychain
        else if let Some(ref key) = config.api_key {
            if !key.is_empty() && key != "STORED_IN_KEYCHAIN" {
                eprintln!("Migrating plain-text API key for '{}' to secure storage", provider_id);
                if let Err(e) = secure_storage::store_api_key(provider_id, key) {
                    eprintln!("Warning: Failed to migrate API key to keychain: {}", e);
                }
            }
        }
    }

    Ok(configs)
}

fn save_configs(configs: &HashMap<String, AIProviderConfig>) -> Result<(), String> {
    let config_path = get_config_file_path();

    // Create directory if it doesn't exist
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    // Create a copy of configs with API keys replaced by placeholder
    let mut sanitized_configs = HashMap::new();
    for (provider_id, config) in configs {
        let mut sanitized_config = config.clone();

        // Store API key in keychain if present
        if let Some(ref api_key) = config.api_key {
            if !api_key.is_empty() && api_key != "STORED_IN_KEYCHAIN" {
                // Store in keychain
                secure_storage::store_api_key(provider_id, api_key)
                    .map_err(|e| format!("Failed to store API key in keychain for '{}': {}", provider_id, e))?;

                // Replace with placeholder in JSON
                sanitized_config.api_key = Some("STORED_IN_KEYCHAIN".to_string());
            }
        }

        sanitized_configs.insert(provider_id.clone(), sanitized_config);
    }

    let contents = serde_json::to_string_pretty(&sanitized_configs)
        .map_err(|e| format!("Failed to serialize configs: {}", e))?;

    std::fs::write(&config_path, contents)
        .map_err(|e| format!("Failed to write config file: {}", e))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
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

#[derive(Debug, Serialize, Deserialize, Clone)]
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
        api_key: config.api_key.ok_or(format!(
            "API key is missing for provider '{}'. Please configure your API key in the settings.",
            provider
        ))?,
        base_url: config.base_url,
        model: config.model.unwrap_or_else(|| match provider.as_str() {
            "claude" => "claude-3-sonnet-20240229".to_string(),
            "gpt4" | "openai" => "gpt-4-turbo-preview".to_string(),
            "deepseek" => "deepseek-chat".to_string(),
            "gemini" => "gemini-pro".to_string(),
            "mistral" => "mistral-large-latest".to_string(),
            "llama" => "llama-3.1-70b-versatile".to_string(),
            _ => "default".to_string(),
        }),
        max_tokens: config.max_tokens.unwrap_or(4096) as u32,
        temperature: config.temperature.unwrap_or(0.3),
        timeout_secs: 30,
    };
    
    // Create the appropriate provider (now returns Result per DeepWiki reqwest best practices)
    let ai_provider: Arc<dyn AIProvider> = match provider.as_str() {
        "claude" => Arc::new(ClaudeProvider::new(provider_config)
            .map_err(|e| format!(
                "Could not initialize Claude AI provider. Please check your API key and network connection. Error: {}",
                e
            ))?),
        "gpt4" | "openai" => Arc::new(OpenAIProvider::new(provider_config)
            .map_err(|e| format!(
                "Could not initialize OpenAI provider. Please verify your API key is valid and has sufficient credits. Error: {}",
                e
            ))?),
        "deepseek" => Arc::new(DeepSeekProvider::new(provider_config)
            .map_err(|e| format!(
                "Could not initialize DeepSeek provider. Please check your API key and network connection. Error: {}",
                e
            ))?),
        "gemini" => Arc::new(GeminiProvider::new(provider_config)
            .map_err(|e| format!(
                "Could not initialize Gemini provider. Please check your API key and network connection. Error: {}",
                e
            ))?),
        "mistral" => Arc::new(MistralProvider::new(provider_config)
            .map_err(|e| format!(
                "Could not initialize Mistral provider. Please check your API key and network connection. Error: {}",
                e
            ))?),
        "llama" => Arc::new(GroqProvider::new(provider_config)
            .map_err(|e| format!(
                "Could not initialize Llama (Groq) provider. Please check your API key and network connection. Error: {}",
                e
            ))?),
        _ => return Err(format!(
            "Unsupported AI provider: '{}'. Please choose from: claude, openai, deepseek, gemini, mistral, or llama.",
            provider
        )),
    };
    
    // Convert request
    let provider_request = ProviderRequest {
        file_hash: request.file_hash.clone(),
        file_name: request.file_name.clone(),
        file_size: request.file_size,
        file_type: request.file_type.clone(),
        file_content: request.file_content.clone(),
        analysis_type: request.analysis_type.clone(),
    };

    // Create cache key from file hash and provider
    let cache_key = format!("{}:{}", request.file_hash, provider);

    // Check cache first (per DeepWiki: SQLite for desktop caching)
    if let Some(ref cache) = *AI_CACHE {
        if let Ok(Some(cached_result)) = cache.get::<AIAnalysisResult>(&cache_key) {
            return Ok(cached_result);
        }
    }

    // Track queue size: increment when request starts (per DeepWiki guidance)
    QUEUE_MANAGER.enqueue(&provider).await;

    // Perform analysis
    let analysis_result = ai_provider.analyze(&provider_request).await;

    // Track queue size: decrement when request completes (per DeepWiki guidance)
    QUEUE_MANAGER.dequeue(&provider).await;

    // Handle result
    let analysis_response = match analysis_result {
        Ok(response) => {
            record_ai_request(true);
            response
        },
        Err(e) => {
            record_ai_request(false);
            return Err(format!(
                "AI analysis failed for file '{}' using provider '{}'. This may be due to network issues, API rate limits, or invalid file content. Error: {}",
                request.file_name,
                provider,
                e
            ));
        }
    };
    
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

    // Cache the result with 1 hour TTL (per DeepWiki: SQLite for desktop caching)
    if let Some(ref cache) = *AI_CACHE {
        let _ = cache.set(&cache_key, &result, Some(3600));
    }

    Ok(result)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AIProviderStatus {
    /// Whether the provider is configured with valid API key
    configured: bool,
    /// Whether the provider is enabled in settings
    enabled: bool,
    /// Current circuit breaker state: "closed", "open", "half_open"
    circuit_state: String,
    /// Number of pending requests in queue
    queue_length: usize,
    /// Average latency in milliseconds (from recent requests)
    avg_latency_ms: Option<f64>,
    /// Whether the provider endpoint is reachable
    healthy: bool,
    /// Last known error (if any)
    last_error: Option<String>,
}

#[command]
pub async fn get_ai_provider_status() -> Result<HashMap<String, AIProviderStatus>, String> {
    // Load configurations from storage
    let configs = load_configs()?;

    let mut status_map = HashMap::new();

    // Check all implemented providers
    let providers = vec!["claude", "openai", "deepseek", "gemini", "mistral", "llama"];

    for provider_name in providers {
        let status = check_provider_status(provider_name, &configs).await;
        status_map.insert(provider_name.to_string(), status);
    }

    Ok(status_map)
}

/// Check the status of a single provider
async fn check_provider_status(
    provider_name: &str,
    configs: &HashMap<String, AIProviderConfig>,
) -> AIProviderStatus {
    // Get configuration if exists
    let config = configs.get(provider_name);

    // Check if API key exists in secure storage (keychain)
    let has_key_in_keychain = secure_storage::has_api_key(provider_name).unwrap_or(false);
    // Also check if key is in config (for backwards compatibility during migration)
    let has_key_in_config = config.as_ref()
        .and_then(|c| c.api_key.as_ref())
        .map(|k| !k.is_empty() && k != "STORED_IN_KEYCHAIN")
        .unwrap_or(false);
    let configured = has_key_in_keychain || has_key_in_config;
    let enabled = config.as_ref().map(|c| c.enabled).unwrap_or(false);

    // Get queue length from the global queue manager
    let queue_length = QUEUE_MANAGER.get_queue_size(provider_name).await;

    // Get average latency from Prometheus metrics
    let avg_latency_ms = get_provider_avg_latency(provider_name);

    // Perform health check and determine circuit state if provider is configured and enabled
    let (circuit_state, healthy, last_error) = if configured && enabled {
        // Safe to unwrap here because we already checked configured && enabled
        // which means config.is_some() and config.enabled == true
        if let Some(cfg) = config {
            perform_health_check(provider_name, cfg).await
        } else {
            // Should never happen due to configured check, but handle defensively
            ("closed".to_string(), false, Some("Configuration error".to_string()))
        }
    } else {
        ("closed".to_string(), false, if !configured {
            Some("Not configured".to_string())
        } else {
            Some("Disabled".to_string())
        })
    };

    AIProviderStatus {
        configured,
        enabled,
        circuit_state,
        queue_length,
        avg_latency_ms,
        healthy,
        last_error,
    }
}

/// Perform health check on a provider and return (circuit_state, healthy, error)
async fn perform_health_check(
    provider_name: &str,
    config: &AIProviderConfig,
) -> (String, bool, Option<String>) {
    // Build provider config
    let provider_config = ProviderConfig {
        api_key: config.api_key.clone().unwrap_or_default(),
        base_url: config.base_url.clone(),
        model: config.model.clone().unwrap_or_else(|| match provider_name {
            "claude" => "claude-3-sonnet-20240229".to_string(),
            "gpt4" => "gpt-4-turbo-preview".to_string(),
            "openai" => "gpt-4-turbo-preview".to_string(),
            "deepseek" => "deepseek-chat".to_string(),
            "gemini" => "gemini-pro".to_string(),
            "mistral" => "mistral-large-latest".to_string(),
            "llama" => "llama-3.1-70b-versatile".to_string(),
            _ => "default".to_string(),
        }),
        max_tokens: config.max_tokens.unwrap_or(4096) as u32,
        temperature: config.temperature.unwrap_or(0.3),
        timeout_secs: 10,
    };

    // Create provider instance and check health
    let result = match provider_name {
        "claude" => {
            match ClaudeProvider::new(provider_config) {
                Ok(provider) => {
                    tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        provider.health_check()
                    ).await
                }
                Err(e) => return ("open".to_string(), false, Some(e.to_string())),
            }
        }
        "gpt4" | "openai" => {
            match OpenAIProvider::new(provider_config) {
                Ok(provider) => {
                    tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        provider.health_check()
                    ).await
                }
                Err(e) => return ("open".to_string(), false, Some(e.to_string())),
            }
        }
        "deepseek" => {
            match DeepSeekProvider::new(provider_config) {
                Ok(provider) => {
                    tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        provider.health_check()
                    ).await
                }
                Err(e) => return ("open".to_string(), false, Some(e.to_string())),
            }
        }
        "gemini" => {
            match GeminiProvider::new(provider_config) {
                Ok(provider) => {
                    tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        provider.health_check()
                    ).await
                }
                Err(e) => return ("open".to_string(), false, Some(e.to_string())),
            }
        }
        "mistral" => {
            match MistralProvider::new(provider_config) {
                Ok(provider) => {
                    tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        provider.health_check()
                    ).await
                }
                Err(e) => return ("open".to_string(), false, Some(e.to_string())),
            }
        }
        "llama" => {
            match GroqProvider::new(provider_config) {
                Ok(provider) => {
                    tokio::time::timeout(
                        std::time::Duration::from_secs(5),
                        provider.health_check()
                    ).await
                }
                Err(e) => return ("open".to_string(), false, Some(e.to_string())),
            }
        }
        _ => return ("unknown".to_string(), false, Some("Unsupported provider".to_string())),
    };

    // Process health check result
    match result {
        Ok(Ok(true)) => ("closed".to_string(), true, None),
        Ok(Ok(false)) => ("open".to_string(), false, Some("Health check failed".to_string())),
        Ok(Err(e)) => ("open".to_string(), false, Some(e.to_string())),
        Err(_) => ("open".to_string(), false, Some("Health check timeout".to_string())),
    }
}

/// Get average latency from Prometheus metrics for a provider
fn get_provider_avg_latency(provider: &str) -> Option<f64> {
    // Try to get the histogram for this provider
    // We'll calculate average from all analysis types and statuses
    let metric_families = prometheus::gather();

    for metric_family in metric_families {
        if metric_family.get_name() == "athena_ai_request_duration_seconds" {
            for metric in metric_family.get_metric() {
                // Check if this metric is for our provider
                let labels = metric.get_label();
                let is_provider_match = labels.iter().any(|label| {
                    label.get_name() == "provider" && label.get_value() == provider
                });

                if is_provider_match {
                    if metric.has_histogram() {
                        let histogram = metric.get_histogram();
                        let count = histogram.get_sample_count();
                        if count > 0 {
                            let sum = histogram.get_sample_sum();
                            // Return average in milliseconds
                            return Some((sum / count as f64) * 1000.0);
                        }
                    }
                }
            }
        }
    }

    None
}

#[command]
pub async fn update_ai_provider_config(
    provider: String,
    config: AIProviderConfig,
) -> Result<(), String> {
    // Load existing configurations
    let mut configs = load_configs().unwrap_or_else(|_| HashMap::new());

    // Update or insert the provider configuration
    configs.insert(provider.clone(), config);

    // Save to disk
    save_configs(&configs)
        .map_err(|e| format!(
            "Could not save AI provider configuration for '{}'. Please ensure the configuration directory is writable. Error: {}",
            provider,
            e
        ))?;

    // Update in-memory cache
    let mut ai_configs = AI_CONFIGS.lock()
        .map_err(|e| format!(
            "Internal error: Could not update AI provider configuration in memory. Error: {}",
            e
        ))?;
    *ai_configs = configs;

    Ok(())
}

#[command]
pub async fn get_ai_provider_config(provider: String) -> Result<Option<AIProviderConfig>, String> {
    let configs = load_configs()
        .map_err(|e| format!(
            "Could not load AI provider configurations. Error: {}",
            e
        ))?;
    Ok(configs.get(&provider).cloned())
}

#[command]
pub async fn list_ai_provider_configs() -> Result<HashMap<String, AIProviderConfig>, String> {
    load_configs()
        .map_err(|e| format!(
            "Could not load AI provider configurations from disk. The configuration file may be corrupted. Error: {}",
            e
        ))
}

/// Delete an API key from secure storage
/// This is useful when removing a provider configuration or resetting credentials
#[command]
pub async fn delete_api_key_from_storage(provider: String) -> Result<(), String> {
    secure_storage::delete_api_key(&provider)
        .map_err(|e| format!(
            "Could not delete API key for provider '{}' from secure storage. Error: {}",
            provider,
            e
        ))
}

/// List available models for a specific AI provider by calling its API
#[command]
pub async fn list_ai_models(provider: String) -> Result<Vec<ModelInfo>, String> {
    // Load saved configuration to get API key
    let configs = load_configs().unwrap_or_default();
    let config = configs.get(&provider);

    let api_key = config
        .and_then(|c| c.api_key.clone())
        .ok_or_else(|| format!(
            "No API key configured for provider '{}'. Please add your API key in the settings first.",
            provider
        ))?;

    // Build provider config
    let provider_config = ProviderConfig {
        api_key,
        base_url: config.and_then(|c| c.base_url.clone()),
        model: config.and_then(|c| c.model.clone()).unwrap_or_default(),
        max_tokens: config.and_then(|c| c.max_tokens).unwrap_or(4096) as u32,
        temperature: config.and_then(|c| c.temperature).unwrap_or(0.3),
        timeout_secs: 30,
    };

    // Create provider and fetch models
    let models = match provider.as_str() {
        "claude" => {
            let p = ClaudeProvider::new(provider_config)
                .map_err(|e| format!("Failed to create Claude provider: {}", e))?;
            p.list_models().await
                .map_err(|e| format!("Failed to fetch Claude models: {}", e))?
        }
        "openai" | "gpt4" => {
            let p = OpenAIProvider::new(provider_config)
                .map_err(|e| format!("Failed to create OpenAI provider: {}", e))?;
            p.list_models().await
                .map_err(|e| format!("Failed to fetch OpenAI models: {}", e))?
        }
        "deepseek" => {
            let p = DeepSeekProvider::new(provider_config)
                .map_err(|e| format!("Failed to create DeepSeek provider: {}", e))?;
            p.list_models().await
                .map_err(|e| format!("Failed to fetch DeepSeek models: {}", e))?
        }
        "gemini" => {
            let p = GeminiProvider::new(provider_config)
                .map_err(|e| format!("Failed to create Gemini provider: {}", e))?;
            p.list_models().await
                .map_err(|e| format!("Failed to fetch Gemini models: {}", e))?
        }
        "mistral" => {
            let p = MistralProvider::new(provider_config)
                .map_err(|e| format!("Failed to create Mistral provider: {}", e))?;
            p.list_models().await
                .map_err(|e| format!("Failed to fetch Mistral models: {}", e))?
        }
        "llama" | "groq" => {
            let p = GroqProvider::new(provider_config)
                .map_err(|e| format!("Failed to create Groq/Llama provider: {}", e))?;
            p.list_models().await
                .map_err(|e| format!("Failed to fetch Groq/Llama models: {}", e))?
        }
        _ => return Err(format!(
            "Unknown provider '{}'. Supported providers: claude, openai, deepseek, gemini, mistral, llama",
            provider
        )),
    };

    Ok(models)
}

#[command]
pub async fn clear_ai_cache(file_hash: String, provider: String) -> Result<bool, String> {
    let cache_key = format!("{}:{}", file_hash, provider);
    match *AI_CACHE {
        Some(ref cache) => cache.delete(&cache_key)
            .map_err(|e| format!(
                "Could not clear cached analysis for file hash '{}' from provider '{}'. Error: {}",
                file_hash,
                provider,
                e
            )),
        None => Ok(false), // No cache available, nothing to clear
    }
}

#[command]
pub fn get_cache_stats() -> Result<crate::cache::CacheStats, String> {
    match *AI_CACHE {
        Some(ref cache) => cache.get_stats()
            .map_err(|e| format!(
                "Could not retrieve cache statistics. The cache database may be inaccessible. Error: {}",
                e
            )),
        None => Ok(crate::cache::CacheStats::default()), // Return empty stats if no cache
    }
}

#[command]
pub async fn cleanup_cache() -> Result<usize, String> {
    match *AI_CACHE {
        Some(ref cache) => cache.cleanup_expired()
            .map_err(|e| format!(
                "Could not clean up expired cache entries. The cache database may be locked. Error: {}",
                e
            )),
        None => Ok(0), // No cache available, nothing to clean
    }
}

#[command]
pub fn cache_key_exists(file_hash: String, provider: String) -> Result<bool, String> {
    let cache_key = format!("{}:{}", file_hash, provider);
    match *AI_CACHE {
        Some(ref cache) => cache.exists(&cache_key)
            .map_err(|e| format!(
                "Could not check if cache exists for file hash '{}'. Error: {}",
                file_hash,
                e
            )),
        None => Ok(false), // No cache available
    }
}

/// Get current queue size for an AI provider
#[command]
pub async fn get_ai_queue_size(provider: String) -> Result<usize, String> {
    Ok(QUEUE_MANAGER.get_queue_size(&provider).await)
}

/// Reset queue for an AI provider (admin function for error recovery)
#[command]
pub async fn reset_ai_queue(provider: String) -> Result<(), String> {
    QUEUE_MANAGER.reset_queue(&provider).await;
    Ok(())
}

// ============================================================================
// Ensemble Analysis Commands
// ============================================================================

/// Get current ensemble settings
#[command]
pub fn get_ensemble_settings() -> Result<EnsembleSettings, String> {
    load_ensemble_settings()
}

/// Update ensemble settings
#[command]
pub fn update_ensemble_settings(settings: EnsembleSettings) -> Result<(), String> {
    save_ensemble_settings(&settings)
}

/// Perform ensemble analysis using multiple AI providers with consensus voting
#[command]
pub async fn analyze_with_ensemble(
    request: AIAnalysisRequest,
) -> Result<EnsembleAnalysisResult, String> {
    let start_time = std::time::Instant::now();

    // Load ensemble settings
    let settings = load_ensemble_settings()?;

    // Load provider configs
    let configs = load_configs()?;

    // Determine which providers to use
    let providers_to_query: Vec<String> = if settings.enabled_providers.is_empty() {
        // Use all configured and enabled providers
        configs.iter()
            .filter(|(_, c)| c.enabled && c.api_key.is_some())
            .map(|(id, _)| id.clone())
            .collect()
    } else {
        // Use only the specified providers that are configured
        settings.enabled_providers.iter()
            .filter(|id| {
                configs.get(*id)
                    .map(|c| c.enabled && c.api_key.is_some())
                    .unwrap_or(false)
            })
            .cloned()
            .collect()
    };

    if providers_to_query.is_empty() {
        return Err("No AI providers are configured and enabled. Please configure at least one provider with an API key.".to_string());
    }

    if providers_to_query.len() < 2 && settings.consensus_voting {
        return Err(format!(
            "Ensemble analysis requires at least 2 providers for consensus voting. Only {} provider(s) configured.",
            providers_to_query.len()
        ));
    }

    // Query all providers in parallel using tokio::join_all
    let mut futures = Vec::new();

    for provider_id in &providers_to_query {
        let provider_id = provider_id.clone();
        // Safe to unwrap because providers_to_query only contains IDs that exist in configs
        // (filtered above), but use if-let for defensive programming
        let Some(config) = configs.get(&provider_id).cloned() else {
            eprintln!("Provider config missing for {}, this should not happen", provider_id);
            continue;
        };
        let request = request.clone();

        let future = async move {
            let result = analyze_with_ai(
                provider_id.clone(),
                config,
                request,
            ).await;
            (provider_id, result)
        };

        futures.push(future);
    }

    // Execute all queries in parallel
    let results: Vec<(String, Result<AIAnalysisResult, String>)> =
        futures::future::join_all(futures).await;

    // Separate successes and failures
    let mut successful_results: Vec<AIAnalysisResult> = Vec::new();
    let mut failed_providers: Vec<String> = Vec::new();

    for (provider_id, result) in results {
        match result {
            Ok(analysis) => successful_results.push(analysis),
            Err(e) => {
                eprintln!("Provider {} failed: {}", provider_id, e);
                failed_providers.push(provider_id);
            }
        }
    }

    if successful_results.is_empty() {
        return Err("All AI providers failed to respond. Please check your API keys and network connection.".to_string());
    }

    // Aggregate results into consensus
    let consensus = aggregate_results(&successful_results, &settings);

    let total_time_ms = start_time.elapsed().as_millis() as u64;

    Ok(EnsembleAnalysisResult {
        provider_results: successful_results.clone(),
        consensus,
        providers_queried: providers_to_query.len(),
        providers_succeeded: successful_results.len(),
        total_time_ms,
    })
}

/// Aggregate multiple provider results into a consensus result
fn aggregate_results(results: &[AIAnalysisResult], settings: &EnsembleSettings) -> ConsensusResult {
    if results.is_empty() {
        return ConsensusResult {
            threat_level: "Unknown".to_string(),
            threat_level_agreement: 0.0,
            confidence: 0.0,
            malware_family: None,
            family_agreement: 0.0,
            all_signatures: vec![],
            consensus_signatures: vec![],
            all_behaviors: vec![],
            consensus_behaviors: vec![],
            aggregated_iocs: IOCs {
                domains: vec![],
                ips: vec![],
                files: vec![],
                registry: vec![],
                processes: vec![],
            },
            recommendations: vec![],
            consensus_reached: false,
        };
    }

    let total_providers = results.len() as f32;

    // Defensive check: this should never happen due to early return above, but guard against it
    if total_providers == 0.0 {
        return ConsensusResult {
            threat_level: "Unknown".to_string(),
            threat_level_agreement: 0.0,
            confidence: 0.0,
            malware_family: None,
            family_agreement: 0.0,
            all_signatures: vec![],
            consensus_signatures: vec![],
            all_behaviors: vec![],
            consensus_behaviors: vec![],
            aggregated_iocs: IOCs {
                domains: vec![],
                ips: vec![],
                files: vec![],
                registry: vec![],
                processes: vec![],
            },
            recommendations: vec![],
            consensus_reached: false,
        };
    }

    let threshold = settings.consensus_threshold as f32 / 100.0;

    // Calculate threat level consensus
    let (threat_level, threat_agreement) = calculate_threat_level_consensus(results, settings);

    // Calculate weighted confidence
    let confidence = if settings.weight_by_confidence {
        // Weight by individual confidence scores
        let total_weight: f32 = results.iter().map(|r| r.confidence).sum();
        if total_weight > 0.0 {
            results.iter()
                .map(|r| r.confidence * r.confidence)
                .sum::<f32>() / total_weight
        } else {
            results.iter().map(|r| r.confidence).sum::<f32>() / total_providers
        }
    } else {
        // Simple average
        results.iter().map(|r| r.confidence).sum::<f32>() / total_providers
    };

    // Calculate malware family consensus
    let (malware_family, family_agreement) = calculate_family_consensus(results);

    // Aggregate signatures
    let (all_signatures, consensus_signatures) = aggregate_string_lists(
        results.iter().map(|r| &r.signatures).collect(),
        threshold,
        total_providers,
    );

    // Aggregate behaviors
    let (all_behaviors, consensus_behaviors) = aggregate_string_lists(
        results.iter().map(|r| &r.behaviors).collect(),
        threshold,
        total_providers,
    );

    // Aggregate IOCs
    let aggregated_iocs = aggregate_iocs(results);

    // Aggregate recommendations (deduplicated)
    let mut all_recommendations: Vec<String> = results.iter()
        .flat_map(|r| r.recommendations.iter().cloned())
        .collect();
    all_recommendations.sort();
    all_recommendations.dedup();

    let consensus_reached = threat_agreement >= threshold;

    ConsensusResult {
        threat_level,
        threat_level_agreement: threat_agreement * 100.0,
        confidence,
        malware_family,
        family_agreement: family_agreement * 100.0,
        all_signatures,
        consensus_signatures,
        all_behaviors,
        consensus_behaviors,
        aggregated_iocs,
        recommendations: all_recommendations,
        consensus_reached,
    }
}

/// Calculate threat level consensus using weighted voting
fn calculate_threat_level_consensus(
    results: &[AIAnalysisResult],
    settings: &EnsembleSettings
) -> (String, f32) {
    let mut threat_votes: HashMap<String, f32> = HashMap::new();
    let mut total_weight = 0.0;

    for result in results {
        let weight = if settings.weight_by_confidence {
            result.confidence
        } else {
            1.0
        };

        *threat_votes.entry(result.threat_level.clone()).or_insert(0.0) += weight;
        total_weight += weight;
    }

    // Find the threat level with the highest weighted vote
    let (winning_level, winning_votes) = threat_votes.iter()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(level, votes)| (level.clone(), *votes))
        .unwrap_or(("Unknown".to_string(), 0.0));

    let agreement = if total_weight > 0.0 {
        winning_votes / total_weight
    } else {
        0.0
    };

    (winning_level, agreement)
}

/// Calculate malware family consensus
fn calculate_family_consensus(results: &[AIAnalysisResult]) -> (Option<String>, f32) {
    let families: Vec<&String> = results.iter()
        .filter_map(|r| r.malware_family.as_ref())
        .collect();

    if families.is_empty() {
        return (None, 0.0);
    }

    let mut family_counts: HashMap<&String, usize> = HashMap::new();
    for family in &families {
        *family_counts.entry(family).or_insert(0) += 1;
    }

    let (winning_family, count) = family_counts.iter()
        .max_by_key(|(_, count)| *count)
        .map(|(family, count)| ((*family).clone(), *count))
        .unwrap_or((String::new(), 0));

    let agreement = count as f32 / results.len() as f32;

    if winning_family.is_empty() {
        (None, 0.0)
    } else {
        (Some(winning_family), agreement)
    }
}

/// Aggregate string lists and find consensus items
fn aggregate_string_lists(
    lists: Vec<&Vec<String>>,
    threshold: f32,
    total_providers: f32,
) -> (Vec<String>, Vec<String>) {
    let mut item_counts: HashMap<String, usize> = HashMap::new();

    // Count occurrences of each item
    for list in &lists {
        for item in *list {
            *item_counts.entry(item.clone()).or_insert(0) += 1;
        }
    }

    let min_count = (threshold * total_providers).ceil() as usize;

    let mut all_items: Vec<String> = item_counts.keys().cloned().collect();
    all_items.sort();

    let consensus_items: Vec<String> = item_counts.iter()
        .filter(|(_, count)| **count >= min_count)
        .map(|(item, _)| item.clone())
        .collect();

    (all_items, consensus_items)
}

/// Aggregate IOCs from all providers
fn aggregate_iocs(results: &[AIAnalysisResult]) -> IOCs {
    let mut domains: Vec<String> = results.iter()
        .flat_map(|r| r.iocs.domains.iter().cloned())
        .collect();
    domains.sort();
    domains.dedup();

    let mut ips: Vec<String> = results.iter()
        .flat_map(|r| r.iocs.ips.iter().cloned())
        .collect();
    ips.sort();
    ips.dedup();

    let mut files: Vec<String> = results.iter()
        .flat_map(|r| r.iocs.files.iter().cloned())
        .collect();
    files.sort();
    files.dedup();

    let mut registry: Vec<String> = results.iter()
        .flat_map(|r| r.iocs.registry.iter().cloned())
        .collect();
    registry.sort();
    registry.dedup();

    let mut processes: Vec<String> = results.iter()
        .flat_map(|r| r.iocs.processes.iter().cloned())
        .collect();
    processes.sort();
    processes.dedup();

    IOCs {
        domains,
        ips,
        files,
        registry,
        processes,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ai_provider_status_structure() {
        // Test that AIProviderStatus can be serialized
        let status = AIProviderStatus {
            configured: true,
            enabled: true,
            circuit_state: "closed".to_string(),
            queue_length: 5,
            avg_latency_ms: Some(250.5),
            healthy: true,
            last_error: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("configured"));
        assert!(json.contains("queue_length"));
        assert!(json.contains("avg_latency_ms"));
    }

    #[test]
    fn test_get_provider_avg_latency_no_metrics() {
        // When no metrics exist, should return None
        let latency = get_provider_avg_latency("nonexistent");
        assert!(latency.is_none());
    }

    #[tokio::test]
    async fn test_check_provider_status_not_configured() {
        let configs = HashMap::new();
        let status = check_provider_status("claude", &configs).await;

        assert!(!status.configured);
        assert!(!status.enabled);
        assert!(!status.healthy);
        assert_eq!(status.queue_length, 0);
        assert!(status.last_error.is_some());
        assert_eq!(status.last_error.unwrap(), "Not configured");
    }

    #[tokio::test]
    async fn test_check_provider_status_disabled() {
        let mut configs = HashMap::new();
        configs.insert(
            "claude".to_string(),
            AIProviderConfig {
                id: "claude".to_string(),
                name: "Claude".to_string(),
                api_key: Some("test-key".to_string()),
                base_url: None,
                model: None,
                max_tokens: None,
                temperature: None,
                enabled: false,
            },
        );

        let status = check_provider_status("claude", &configs).await;

        assert!(status.configured);
        assert!(!status.enabled);
        assert!(!status.healthy);
        assert_eq!(status.last_error.unwrap(), "Disabled");
    }

    #[test]
    fn test_perform_health_check_unsupported_provider() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            let config = AIProviderConfig {
                id: "unknown".to_string(),
                name: "Unknown".to_string(),
                api_key: Some("test-key".to_string()),
                base_url: None,
                model: None,
                max_tokens: None,
                temperature: None,
                enabled: true,
            };

            let (circuit_state, healthy, error) = perform_health_check("unknown", &config).await;

            assert_eq!(circuit_state, "unknown");
            assert!(!healthy);
            assert!(error.is_some());
            assert_eq!(error.unwrap(), "Unsupported provider");
        });
    }
}

// ============================================================================
// Circuit Breaker Management Commands
// ============================================================================

/// Check if circuit breaker is open for a provider
#[command]
pub async fn is_circuit_breaker_open(provider: String) -> Result<bool, String> {
    let breaker = crate::ai_providers::get_or_create_circuit_breaker(&provider).await;
    Ok(breaker.is_open().await)
}

/// Reset circuit breaker for a provider (admin function)
#[command]
pub async fn reset_circuit_breaker(provider: String) -> Result<(), String> {
    let breaker = crate::ai_providers::get_or_create_circuit_breaker(&provider).await;
    breaker.reset().await;
    Ok(())
}