/**
 * Prometheus Metrics Module
 * Port of Node.js prom-client implementation to Rust prometheus crate
 * Based on Prometheus best practices
 */

use prometheus::{
    register_counter_vec, register_gauge_vec, register_histogram_vec,
    CounterVec, GaugeVec, HistogramVec, Encoder, TextEncoder,
};
use once_cell::sync::Lazy;

/// WASM operation metrics
pub static WASM_INIT_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_wasm_initialization_duration_seconds",
        "Duration of WASM module initialization",
        &["module"],
        vec![0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0]
    )
    .expect("Failed to register WASM_INIT_DURATION metric")
});

pub static WASM_OPERATION_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_wasm_operation_duration_seconds",
        "Duration of WASM operations",
        &["module", "operation"],
        vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
    )
    .expect("Failed to register WASM_OPERATION_DURATION metric")
});

pub static WASM_OPERATION_COUNTER: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_wasm_operations_total",
        "Total number of WASM operations",
        &["module", "operation", "status"]
    )
    .expect("Failed to register WASM_OPERATION_COUNTER metric")
});

pub static WASM_MODULE_SIZE: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "athena_wasm_module_size_bytes",
        "Size of WASM modules in bytes",
        &["module"]
    )
    .expect("Failed to register WASM_MODULE_SIZE metric")
});

pub static WASM_MEMORY_USAGE: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "athena_wasm_memory_usage_bytes",
        "Memory usage of WASM modules",
        &["module"]
    )
    .expect("Failed to register WASM_MEMORY_USAGE metric")
});

/// AI Provider metrics
pub static AI_REQUEST_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_ai_request_duration_seconds",
        "Duration of AI provider requests",
        &["provider", "analysis_type", "status"],
        vec![0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 30.0]
    )
    .expect("Failed to register AI_REQUEST_DURATION metric")
});

pub static AI_REQUEST_COUNTER: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_ai_requests_total",
        "Total number of AI requests",
        &["provider", "analysis_type", "status"]
    )
    .expect("Failed to register AI_REQUEST_COUNTER metric")
});

pub static AI_TOKEN_USAGE: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_ai_tokens_used_total",
        "Total tokens used by AI providers",
        &["provider", "type"]
    )
    .expect("Failed to register AI_TOKEN_USAGE metric")
});

/// Estimated AI cost tracking (used in claude.rs, openai.rs, deepseek.rs)
pub static AI_COST_ESTIMATE: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_ai_cost_estimate_dollars",
        "Estimated cost in dollars",
        &["provider"]
    )
    .expect("Failed to register AI_COST_ESTIMATE metric")
});

/// AI request queue size tracking (used in queue_manager.rs via ai_analysis.rs)
pub static AI_QUEUE_SIZE: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "athena_ai_queue_size",
        "Number of requests in queue",
        &["provider"]
    )
    .expect("Failed to register AI_QUEUE_SIZE metric")
});

/// AI rate limit hit tracking (used in circuit_breaker.rs)
pub static AI_RATE_LIMIT_HITS: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_ai_rate_limit_hits_total",
        "Number of rate limit hits",
        &["provider"]
    )
    .expect("Failed to register AI_RATE_LIMIT_HITS metric")
});

/// Cache metrics (used in cache/mod.rs)
pub static CACHE_HIT_RATE: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "athena_cache_hit_rate",
        "Cache hit rate percentage",
        &["cache_type"]
    )
    .expect("Failed to register CACHE_HIT_RATE metric")
});

pub static CACHE_OPERATIONS: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_cache_operations_total",
        "Total cache operations",
        &["operation", "status"]
    )
    .expect("Failed to register CACHE_OPERATIONS metric")
});

/// File operation metrics
pub static FILE_OPERATION_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_file_operation_duration_seconds",
        "Duration of file operations",
        &["operation", "status"],
        vec![0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0]
    )
    .expect("Failed to register FILE_OPERATION_DURATION metric")
});

pub static FILE_OPERATION_COUNTER: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_file_operations_total",
        "Total number of file operations",
        &["operation", "status"]
    )
    .expect("Failed to register FILE_OPERATION_COUNTER metric")
});

pub static FILE_SIZE_HISTOGRAM: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_file_size_bytes",
        "File size distribution",
        &["operation"],
        vec![1024.0, 10240.0, 102400.0, 1048576.0, 10485760.0, 104857600.0]
    )
    .expect("Failed to register FILE_SIZE_HISTOGRAM metric")
});

/// Network analysis metrics
pub static NETWORK_OPERATION_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_network_operation_duration_seconds",
        "Duration of network operations",
        &["operation", "status"],
        vec![0.001, 0.01, 0.1, 0.5, 1.0, 5.0, 10.0]
    )
    .expect("Failed to register NETWORK_OPERATION_DURATION metric")
});

pub static NETWORK_PACKETS_ANALYZED: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_network_packets_analyzed_total",
        "Total packets analyzed",
        &["protocol", "status"]
    )
    .expect("Failed to register NETWORK_PACKETS_ANALYZED metric")
});

pub static ACTIVE_PACKET_CAPTURES: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "athena_active_packet_captures",
        "Number of active packet captures",
        &["interface"]
    )
    .expect("Failed to register ACTIVE_PACKET_CAPTURES metric")
});

/// Workflow execution metrics
pub static WORKFLOW_EXECUTION_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_workflow_execution_duration_seconds",
        "Duration of workflow executions",
        &["workflow_type", "status"],
        vec![1.0, 5.0, 10.0, 30.0, 60.0, 300.0, 600.0]
    )
    .expect("Failed to register WORKFLOW_EXECUTION_DURATION metric")
});

pub static WORKFLOW_JOB_COUNTER: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_workflow_jobs_total",
        "Total workflow jobs",
        &["workflow_type", "status"]
    )
    .expect("Failed to register WORKFLOW_JOB_COUNTER metric")
});

pub static ACTIVE_WORKFLOW_JOBS: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "athena_active_workflow_jobs",
        "Number of active workflow jobs",
        &["workflow_type"]
    )
    .expect("Failed to register ACTIVE_WORKFLOW_JOBS metric")
});

/// Disassembly metrics
pub static DISASSEMBLY_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_disassembly_duration_seconds",
        "Duration of disassembly operations",
        &["architecture", "status"],
        vec![0.1, 0.5, 1.0, 5.0, 10.0, 30.0]
    )
    .expect("Failed to register DISASSEMBLY_DURATION metric")
});

pub static INSTRUCTIONS_DISASSEMBLED: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_instructions_disassembled",
        "Number of instructions disassembled",
        &["architecture"],
        vec![100.0, 1000.0, 10000.0, 100000.0, 1000000.0]
    )
    .expect("Failed to register INSTRUCTIONS_DISASSEMBLED metric")
});

/// YARA scanner metrics
pub static YARA_SCAN_DURATION: Lazy<HistogramVec> = Lazy::new(|| {
    register_histogram_vec!(
        "athena_yara_scan_duration_seconds",
        "Duration of YARA scans",
        &["ruleset", "status"],
        vec![0.01, 0.1, 0.5, 1.0, 5.0, 10.0]
    )
    .expect("Failed to register YARA_SCAN_DURATION metric")
});

pub static YARA_MATCHES_FOUND: Lazy<CounterVec> = Lazy::new(|| {
    register_counter_vec!(
        "athena_yara_matches_total",
        "Total YARA rule matches",
        &["ruleset", "severity"]
    )
    .expect("Failed to register YARA_MATCHES_FOUND metric")
});

pub static YARA_RULES_LOADED: Lazy<GaugeVec> = Lazy::new(|| {
    register_gauge_vec!(
        "athena_yara_rules_loaded",
        "Number of YARA rules loaded",
        &["ruleset"]
    )
    .expect("Failed to register YARA_RULES_LOADED metric")
});

/// Collect and encode all metrics to Prometheus text format
pub fn gather_metrics() -> Result<String, Box<dyn std::error::Error>> {
    let encoder = TextEncoder::new();
    let metric_families = prometheus::gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer)?;
    Ok(String::from_utf8(buffer)?)
}

/// Middleware for Axum to expose /metrics endpoint (HTTP scraping for development)
pub async fn metrics_handler() -> Result<String, (axum::http::StatusCode, String)> {
    gather_metrics()
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

/// Push metrics to Pushgateway (recommended for desktop apps per DeepWiki)
pub fn push_to_gateway(
    job: &str,
    pushgateway_url: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let metric_families = prometheus::gather();

    // Use hostname_grouping_key for instance differentiation (per DeepWiki)
    let grouping = prometheus::hostname_grouping_key();

    // Push metrics with PUT (replaces all previous metrics for this job)
    prometheus::push_metrics(
        job,
        grouping,
        pushgateway_url,
        metric_families,
        None, // No basic auth
    )?;

    Ok(())
}

/// Tauri command to push metrics on demand
#[tauri::command]
pub async fn push_metrics_to_gateway(pushgateway_url: String) -> Result<(), String> {
    push_to_gateway("athena-desktop", &pushgateway_url)
        .map_err(|e| format!("Failed to push metrics: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_collection() {
        // Test WASM metrics
        WASM_OPERATION_COUNTER
            .with_label_values(&["test-module", "test-op", "success"])
            .inc();

        WASM_MODULE_SIZE
            .with_label_values(&["test-module"])
            .set(1024.0);

        // Test gathering metrics
        let metrics_text = gather_metrics().unwrap();
        assert!(metrics_text.contains("athena_wasm_operations_total"));
        assert!(metrics_text.contains("athena_wasm_module_size_bytes"));
    }
}
