use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use tauri::command;
use crate::ai_providers::{AIProvider, AIProviderConfig as ProviderConfig, AnalysisRequest as ProviderRequest};
use crate::ai_providers::claude::ClaudeProvider;
use crate::ai_providers::openai::OpenAIProvider;
use crate::ai_providers::deepseek::DeepSeekProvider;
use crate::ai_providers::queue_manager::QueueManager;
use crate::cache::{SqliteCache, CacheConfig};
use lazy_static::lazy_static;

// Global configuration storage
lazy_static! {
    static ref AI_CONFIGS: Arc<Mutex<HashMap<String, AIProviderConfig>>> = Arc::new(Mutex::new(HashMap::new()));
    /// Global queue manager for tracking AI request queue sizes (in-memory per DeepWiki)
    static ref QUEUE_MANAGER: QueueManager = QueueManager::new();
    /// Global SQLite cache for AI analysis results (per DeepWiki)
    static ref AI_CACHE: SqliteCache = SqliteCache::new(CacheConfig::default()).expect("Failed to initialize AI cache");
}

fn get_config_file_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("athena")
        .join("ai_providers.json")
}

fn load_configs() -> Result<HashMap<String, AIProviderConfig>, String> {
    let config_path = get_config_file_path();

    if !config_path.exists() {
        return Ok(HashMap::new());
    }

    let contents = std::fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read config file: {}", e))?;

    serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse config file: {}", e))
}

fn save_configs(configs: &HashMap<String, AIProviderConfig>) -> Result<(), String> {
    let config_path = get_config_file_path();

    // Create directory if it doesn't exist
    if let Some(parent) = config_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {}", e))?;
    }

    let contents = serde_json::to_string_pretty(configs)
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
        api_key: config.api_key.ok_or(format!(
            "API key is missing for provider '{}'. Please configure your API key in the settings.",
            provider
        ))?,
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
        _ => return Err(format!(
            "Unsupported AI provider: '{}'. Please choose from: claude, gpt4, openai, or deepseek.",
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
    if let Ok(Some(cached_result)) = AI_CACHE.get::<AIAnalysisResult>(&cache_key) {
        return Ok(cached_result);
    }

    // Track queue size: increment when request starts (per DeepWiki guidance)
    QUEUE_MANAGER.enqueue(&provider).await;

    // Perform analysis
    let analysis_result = ai_provider.analyze(&provider_request).await;

    // Track queue size: decrement when request completes (per DeepWiki guidance)
    QUEUE_MANAGER.dequeue(&provider).await;

    // Handle result
    let analysis_response = analysis_result
        .map_err(|e| format!(
            "AI analysis failed for file '{}' using provider '{}'. This may be due to network issues, API rate limits, or invalid file content. Error: {}",
            request.file_name,
            provider,
            e
        ))?;
    
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
    let _ = AI_CACHE.set(&cache_key, &result, Some(3600));

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

    // Check each implemented provider
    let providers = vec!["claude", "gpt4", "openai", "deepseek"];

    for provider_name in providers {
        let status = check_provider_status(provider_name, &configs).await;
        status_map.insert(provider_name.to_string(), status);
    }

    // Add unimplemented providers with default status
    for provider_name in &["gemini", "mistral", "llama"] {
        status_map.insert(
            provider_name.to_string(),
            AIProviderStatus {
                configured: false,
                enabled: false,
                circuit_state: "closed".to_string(),
                queue_length: 0,
                avg_latency_ms: None,
                healthy: false,
                last_error: Some("Provider not implemented".to_string()),
            },
        );
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

    let configured = config.as_ref().map(|c| c.api_key.is_some()).unwrap_or(false);
    let enabled = config.as_ref().map(|c| c.enabled).unwrap_or(false);

    // Get queue length from the global queue manager
    let queue_length = QUEUE_MANAGER.get_queue_size(provider_name).await;

    // Get average latency from Prometheus metrics
    let avg_latency_ms = get_provider_avg_latency(provider_name);

    // Perform health check and determine circuit state if provider is configured and enabled
    let (circuit_state, healthy, last_error) = if configured && enabled {
        perform_health_check(provider_name, config.unwrap()).await
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

#[command]
pub async fn clear_ai_cache(file_hash: String, provider: String) -> Result<bool, String> {
    let cache_key = format!("{}:{}", file_hash, provider);
    AI_CACHE.delete(&cache_key)
        .map_err(|e| format!(
            "Could not clear cached analysis for file hash '{}' from provider '{}'. Error: {}",
            file_hash,
            provider,
            e
        ))
}

#[command]
pub fn get_cache_stats() -> Result<crate::cache::CacheStats, String> {
    AI_CACHE.get_stats()
        .map_err(|e| format!(
            "Could not retrieve cache statistics. The cache database may be inaccessible. Error: {}",
            e
        ))
}

#[command]
pub async fn cleanup_cache() -> Result<usize, String> {
    AI_CACHE.cleanup_expired()
        .map_err(|e| format!(
            "Could not clean up expired cache entries. The cache database may be locked. Error: {}",
            e
        ))
}

#[command]
pub fn cache_key_exists(file_hash: String, provider: String) -> Result<bool, String> {
    let cache_key = format!("{}:{}", file_hash, provider);
    AI_CACHE.exists(&cache_key)
        .map_err(|e| format!(
            "Could not check if cache exists for file hash '{}'. Error: {}",
            file_hash,
            e
        ))
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