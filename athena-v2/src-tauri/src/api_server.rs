/**
 * Axum HTTP API Server
 * Provides REST API endpoints for external access to WASM functionality
 *
 * This server runs embedded within the Tauri application and provides
 * HTTP access to the Wasmtime Component Model WASM modules.
 *
 * Implementation based on Tauri 2.0 and Axum 0.8 best practices:
 * - AppHandle is Clone, so we clone before moving into async blocks
 * - State is wrapped in Arc for cheap cloning (Axum requirement)
 * - Tauri commands are called directly via app_handle.state()
 */

use axum::{
    extract::{Json, State},
    http::{StatusCode, Method, header},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri::path::SafePathBuf;
use tokio::net::TcpListener;
use tower_http::cors::{CorsLayer, AllowOrigin};
use axum::http::HeaderValue;

use crate::commands::wasm_runtime::WasmRuntime;
use crate::metrics;

/// API server state containing Tauri app handle (Arc for Axum State compatibility)
#[derive(Clone)]
pub struct ApiState {
    pub app_handle: AppHandle,
}

/// Request body for WASM analysis
#[derive(Debug, Deserialize)]
pub struct AnalyzeRequest {
    pub file_path: String,
}

/// Request body for WASM function execution
#[derive(Debug, Deserialize)]
pub struct ExecuteRequest {
    pub module_id: String,
    pub function_name: String,
    pub args: Vec<serde_json::Value>,
}

/// Response for capabilities endpoint
#[derive(Debug, Serialize)]
pub struct CapabilitiesResponse {
    pub modules: Vec<String>,
    pub architecture: String,
    pub runtime: String,
}

/// Generic API error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

/// Convert Result to HTTP response
impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(self)).into_response()
    }
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "Athena WASM API",
        "version": env!("CARGO_PKG_VERSION"),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "services": {
            "api": "healthy",
            "cache": "healthy",
            "wasm": "healthy"
        }
    }))
}

/// Get WASM capabilities
async fn get_capabilities() -> impl IntoResponse {
    // List of available WASM modules (owned Strings per Rust conventions)
    let modules = vec![
        "analysis-engine".to_string(),
        "crypto".to_string(),
        "deobfuscator".to_string(),
        "file-processor".to_string(),
        "network".to_string(),
        "pattern-matcher".to_string(),
        "sandbox".to_string(),
    ];

    Json(CapabilitiesResponse {
        modules,
        architecture: "Wasmtime Component Model".to_string(),
        runtime: "WASI Preview 2".to_string(),
    })
}

/// Analyze file with WASM modules
async fn analyze_file(
    State(state): State<ApiState>,
    Json(request): Json<AnalyzeRequest>,
) -> Result<impl IntoResponse, ErrorResponse> {
    // Clone AppHandle before moving into async block (AppHandle implements Clone)
    let app_handle = state.app_handle.clone();

    // Check if runtime is initialized
    // Per DeepWiki: Use std::sync::Mutex when not holding lock across .await points
    let runtime_state = app_handle.state::<Arc<std::sync::Mutex<Option<WasmRuntime>>>>();
    let is_initialized = {
        let lock = runtime_state.lock().map_err(|e| ErrorResponse {
            error: "Lock poisoned".to_string(),
            message: format!("Runtime state mutex poisoned: {:?}", e),
        })?;
        lock.is_some()
    };

    if !is_initialized {
        return Err(ErrorResponse {
            error: "WASM runtime not initialized".to_string(),
            message: "Runtime not available".to_string(),
        });
    }

    // Convert String path to SafePathBuf for security validation
    let safe_path = SafePathBuf::new(PathBuf::from(&request.file_path))
        .map_err(|e| ErrorResponse {
            error: "Invalid path".to_string(),
            message: format!("Path validation failed: {}", e),
        })?;

    // Call Tauri command - app_handle.state() returns State<T> automatically
    match crate::commands::wasm_file_bridge::analyze_file_with_wasm(
        app_handle.clone(),
        app_handle.state(),
        safe_path,
    )
    .await
    {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ErrorResponse {
            error: "Analysis failed".to_string(),
            message: e,
        }),
    }
}

/// Execute WASM function
async fn execute_function(
    State(state): State<ApiState>,
    Json(request): Json<ExecuteRequest>,
) -> Result<impl IntoResponse, ErrorResponse> {
    // Clone AppHandle before moving
    let app_handle = state.app_handle.clone();

    match crate::commands::wasm_runtime::execute_wasm_function(
        app_handle.state(),
        request.module_id,
        request.function_name,
        request.args,
    )
    .await
    {
        Ok(result) => Ok(Json(result)),
        Err(e) => Err(ErrorResponse {
            error: "Function execution failed".to_string(),
            message: e,
        }),
    }
}

/// Get WASM metrics
async fn get_metrics() -> Result<impl IntoResponse, ErrorResponse> {
    // get_all_wasm_metrics() takes no arguments - accesses global METRICS
    match crate::commands::wasm_runtime::get_all_wasm_metrics().await {
        Ok(metrics) => Ok(Json(metrics)),
        Err(e) => Err(ErrorResponse {
            error: "Failed to get metrics".to_string(),
            message: e,
        }),
    }
}

/// Initialize WASM runtime
async fn initialize_runtime(
    State(state): State<ApiState>,
) -> Result<impl IntoResponse, ErrorResponse> {
    // Clone AppHandle before moving
    let app_handle = state.app_handle.clone();

    match crate::commands::wasm_runtime::initialize_wasm_runtime(app_handle.state()).await {
        Ok(message) => Ok(Json(serde_json::json!({
            "status": "ok",
            "message": message
        }))),
        Err(e) => Err(ErrorResponse {
            error: "Initialization failed".to_string(),
            message: e,
        }),
    }
}

/// Load WASM security modules
async fn load_modules(
    State(state): State<ApiState>,
) -> Result<impl IntoResponse, ErrorResponse> {
    // Clone AppHandle before moving
    let app_handle = state.app_handle.clone();

    match crate::commands::wasm_file_bridge::load_wasm_security_modules(app_handle.state()).await
    {
        Ok(modules) => Ok(Json(serde_json::json!({
            "status": "ok",
            "loaded": modules.len(),
            "modules": modules
        }))),
        Err(e) => Err(ErrorResponse {
            error: "Failed to load modules".to_string(),
            message: e,
        }),
    }
}

/// Create API router with all endpoints
fn create_router(state: ApiState) -> Router {
    // SECURITY: Configure CORS to only allow localhost origins
    // This prevents CSRF attacks from external websites making API calls
    // These are hardcoded localhost URLs that are guaranteed to be valid HeaderValues
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::list([
            "http://127.0.0.1:1420".parse::<HeaderValue>().expect("valid localhost URL"),  // Tauri dev server
            "http://localhost:1420".parse::<HeaderValue>().expect("valid localhost URL"),
            "http://127.0.0.1:3000".parse::<HeaderValue>().expect("valid localhost URL"),  // API server itself
            "http://localhost:3000".parse::<HeaderValue>().expect("valid localhost URL"),
            "http://127.0.0.1:5173".parse::<HeaderValue>().expect("valid localhost URL"),  // Vite dev server
            "http://localhost:5173".parse::<HeaderValue>().expect("valid localhost URL"),
            "tauri://localhost".parse::<HeaderValue>().expect("valid Tauri protocol"),      // Tauri protocol
        ]))
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_credentials(true);

    Router::new()
        .route("/health", get(health_check))
        .route("/api/v1/health", get(health_check))  // Frontend uses this endpoint
        .route("/api/v1/wasm/capabilities", get(get_capabilities))
        .route("/api/v1/wasm/analyze", post(analyze_file))
        .route("/api/v1/wasm/execute", post(execute_function))
        .route("/api/v1/wasm/metrics", get(get_metrics))
        .route("/api/v1/wasm/init", post(initialize_runtime))
        .route("/api/v1/wasm/load", post(load_modules))
        .route("/metrics", get(metrics::metrics_handler))  // Prometheus metrics endpoint
        .layer(cors)
        .with_state(state)
}

/// Start the API server on the specified port
pub async fn start_api_server(
    app_handle: AppHandle,
    port: u16,
) -> Result<(), Box<dyn std::error::Error>> {
    let state = ApiState {
        app_handle: app_handle.clone(),
    };
    let app = create_router(state);

    let addr = format!("127.0.0.1:{}", port);
    let listener = TcpListener::bind(&addr).await?;

    println!("🚀 API server listening on http://{}", addr);
    println!("   Endpoints:");
    println!("   - GET  /health");
    println!("   - GET  /api/v1/wasm/capabilities");
    println!("   - POST /api/v1/wasm/init");
    println!("   - POST /api/v1/wasm/load");
    println!("   - POST /api/v1/wasm/analyze");
    println!("   - POST /api/v1/wasm/execute");
    println!("   - GET  /api/v1/wasm/metrics");
    println!("   - GET  /metrics (Prometheus)");

    axum::serve(listener, app).await?;

    Ok(())
}
