use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{State, AppHandle};
use tauri::path::SafePathBuf;
use std::sync::Mutex;
use crate::commands::wasm_runtime::WasmRuntime;
use crate::commands::file_analysis::FileAnalysisResult;

#[derive(Debug, Serialize, Deserialize)]
pub struct WasmFileAnalysis {
    pub module_name: String,
    pub analysis_type: String,
    pub results: serde_json::Value,
    pub execution_time_ms: u64,
    pub memory_used: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnhancedFileAnalysis {
    pub basic_analysis: FileAnalysisResult,
    pub wasm_analyses: Vec<WasmFileAnalysis>,
    pub combined_risk_score: f64,
    pub ml_predictions: Option<MlPredictions>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MlPredictions {
    pub malware_probability: f64,
    pub family_predictions: Vec<FamilyPrediction>,
    pub behavior_predictions: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FamilyPrediction {
    pub family: String,
    pub confidence: f64,
}

// WASM module names for the 7 security modules
const ANALYSIS_ENGINE: &str = "analysis-engine";
const CRYPTO_MODULE: &str = "crypto";
const DEOBFUSCATOR: &str = "deobfuscator";
const FILE_PROCESSOR: &str = "file-processor";
const NETWORK_MODULE: &str = "network";
const PATTERN_MATCHER: &str = "pattern-matcher";
const SANDBOX_MODULE: &str = "sandbox";

#[tauri::command]
pub async fn analyze_file_with_wasm(
    _app: AppHandle,
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    file_path: SafePathBuf,
) -> Result<EnhancedFileAnalysis, String> {
    let _start = std::time::Instant::now();

    // SafePathBuf automatically validates that path doesn't contain ".." to prevent traversal
    let validated_path = file_path.as_ref();

    // Create a new SafePathBuf for the analyze_file call
    let safe_path_for_analysis = SafePathBuf::new(validated_path.to_path_buf())
        .map_err(|e| format!("Invalid path: {}", e))?;

    // First, perform basic file analysis
    let basic_analysis = crate::commands::file_analysis::analyze_file(safe_path_for_analysis, None)
        .await?;

    // Read file data for WASM analysis
    let file_data = std::fs::read(validated_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let mut wasm_analyses = Vec::new();

    // Check if WASM runtime is initialized
    let has_runtime = {
        let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
        runtime_guard.is_some()
    };

    if has_runtime {
        // ========================================================================
        // STATELESS MODULES - Simple function calls, no resources needed
        // ========================================================================

        // 1. Analysis Engine - Core malware analysis
        // WIT: athena:analysis-engine/analyzer exports analyze(content: list<u8>)
        if let Ok(result) = run_wasm_analysis(
            &runtime,
            ANALYSIS_ENGINE,
            "analyze",  // Will try "analyzer#analyze" via fallback
            &file_data,
        ).await {
            wasm_analyses.push(result);
        }

        // 2. Crypto Module - Hash calculation
        // WIT: athena:crypto/hash exports sha256(data: list<u8>)
        if let Ok(result) = run_wasm_analysis(
            &runtime,
            CRYPTO_MODULE,
            "sha256",  // Will try "hash#sha256" via fallback
            &file_data,
        ).await {
            wasm_analyses.push(result);
        }

        // 3. File Processor - Parse file
        // WIT: athena:file-processor/parser exports parse-file(buffer: list<u8>, format-hint: option<file-format>)
        if let Ok(result) = run_wasm_analysis_with_option(
            &runtime,
            FILE_PROCESSOR,
            "parse-file",  // Will try "parser#parse-file" via fallback
            &file_data,
            None, // No format hint - let the parser detect
        ).await {
            wasm_analyses.push(result);
        }

        // ========================================================================
        // RESOURCE-BASED MODULES - Require session for resource lifecycle
        // ========================================================================

        // 4. Deobfuscator - Uses resource-based API
        // WIT: athena:deobfuscator/deobfuscator resource with detect() method
        if let Ok(result) = run_resource_analysis(
            &runtime,
            DEOBFUSCATOR,
            "new",              // Constructor function to create resource
            "detect",           // Method to call on resource (deobfuscator#detect)
            &file_data,
            true,               // Convert bytes to string for deobfuscator
        ).await {
            wasm_analyses.push(result);
        }

        // 5. Pattern Matcher - Uses resource-based API
        // WIT: athena:pattern-matcher/pattern-matcher resource with scan() method
        if let Ok(result) = run_resource_analysis(
            &runtime,
            PATTERN_MATCHER,
            "new",              // Constructor function to create matcher resource
            "scan",             // Method to call on resource (pattern-matcher#scan)
            &file_data,
            false,              // Keep as bytes for pattern matching
        ).await {
            wasm_analyses.push(result);
        }
    }

    // Calculate combined risk score
    let combined_risk_score = calculate_combined_risk_score(&basic_analysis, &wasm_analyses);

    // Generate ML predictions if deobfuscator module provided results
    let ml_predictions = generate_ml_predictions(&wasm_analyses);

    Ok(EnhancedFileAnalysis {
        basic_analysis,
        wasm_analyses,
        combined_risk_score,
        ml_predictions,
    })
}

/// Run stateless WASM analysis with simple function call
async fn run_wasm_analysis(
    runtime: &State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_name: &str,
    function_name: &str,
    file_data: &[u8],
) -> Result<WasmFileAnalysis, String> {
    let start = std::time::Instant::now();

    // Pass data as list<u8> (JSON array of bytes)
    let args = vec![serde_json::json!(file_data)];

    // Execute WASM function
    let result = crate::commands::wasm_runtime::execute_wasm_function(
        runtime.clone(),
        module_name.to_string(),
        function_name.to_string(),
        args,
    ).await?;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    Ok(WasmFileAnalysis {
        module_name: module_name.to_string(),
        analysis_type: function_name.to_string(),
        results: serde_json::json!({
            "success": result.success,
            "output": result.output,
            "error": result.error,
        }),
        execution_time_ms,
        memory_used: result.memory_used,
    })
}

/// Run stateless WASM analysis with an optional second parameter
async fn run_wasm_analysis_with_option(
    runtime: &State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_name: &str,
    function_name: &str,
    file_data: &[u8],
    option_value: Option<serde_json::Value>,
) -> Result<WasmFileAnalysis, String> {
    let start = std::time::Instant::now();

    // Build args: first is the file data, second is optional parameter
    let args = vec![
        serde_json::json!(file_data),
        match option_value {
            Some(v) => serde_json::json!({"_some": v}),
            None => serde_json::json!({"_none": true}),
        },
    ];

    // Execute WASM function
    let result = crate::commands::wasm_runtime::execute_wasm_function(
        runtime.clone(),
        module_name.to_string(),
        function_name.to_string(),
        args,
    ).await?;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    Ok(WasmFileAnalysis {
        module_name: module_name.to_string(),
        analysis_type: function_name.to_string(),
        results: serde_json::json!({
            "success": result.success,
            "output": result.output,
            "error": result.error,
        }),
        execution_time_ms,
        memory_used: result.memory_used,
    })
}

/// Run resource-based WASM analysis using session API
/// This creates a session, instantiates the resource, calls a method, and cleans up
async fn run_resource_analysis(
    runtime: &State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_name: &str,
    constructor_name: &str,
    method_name: &str,
    file_data: &[u8],
    convert_to_string: bool,
) -> Result<WasmFileAnalysis, String> {
    let start = std::time::Instant::now();

    // 1. Create a session for this module
    let session_info = crate::commands::wasm_runtime::create_wasm_session(
        runtime.clone(),
        module_name.to_string(),
    ).await?;

    let session_id = session_info.session_id.clone();

    // 2. Call the constructor to create the resource
    let constructor_result = crate::commands::wasm_runtime::execute_session_function(
        session_id.clone(),
        constructor_name.to_string(),
        vec![], // No args for constructor
    ).await;

    let resource_handle = match constructor_result {
        Ok(result) => {
            // Parse the output to get the resource handle
            if let Some(output) = result.output.as_ref() {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(output) {
                    if let Some(handle) = parsed.get("_resource_handle").and_then(|v| v.as_str()) {
                        handle.to_string()
                    } else {
                        // Constructor might return the resource directly
                        // Clean up and return error
                        let _ = crate::commands::wasm_runtime::destroy_wasm_session(session_id).await;
                        return Err("Constructor did not return a resource handle".to_string());
                    }
                } else {
                    let _ = crate::commands::wasm_runtime::destroy_wasm_session(session_id).await;
                    return Err("Failed to parse constructor output".to_string());
                }
            } else {
                let _ = crate::commands::wasm_runtime::destroy_wasm_session(session_id).await;
                return Err("Constructor returned no output".to_string());
            }
        }
        Err(e) => {
            let _ = crate::commands::wasm_runtime::destroy_wasm_session(session_id).await;
            return Err(format!("Constructor failed: {}", e));
        }
    };

    // 3. Call the method on the resource
    let method_args = if convert_to_string {
        let content = String::from_utf8_lossy(file_data);
        vec![
            serde_json::json!({"_resource_handle": resource_handle}),
            serde_json::json!(content),
        ]
    } else {
        vec![
            serde_json::json!({"_resource_handle": resource_handle}),
            serde_json::json!(file_data),
        ]
    };

    let method_result = crate::commands::wasm_runtime::execute_session_function(
        session_id.clone(),
        method_name.to_string(),
        method_args,
    ).await;

    // 4. Clean up the session (this will drop all resources)
    let _ = crate::commands::wasm_runtime::destroy_wasm_session(session_id).await;

    let execution_time_ms = start.elapsed().as_millis() as u64;

    // 5. Return the result
    match method_result {
        Ok(result) => Ok(WasmFileAnalysis {
            module_name: module_name.to_string(),
            analysis_type: method_name.to_string(),
            results: serde_json::json!({
                "success": result.success,
                "output": result.output,
                "error": result.error,
            }),
            execution_time_ms,
            memory_used: result.memory_used,
        }),
        Err(e) => Err(format!("Method {} failed: {}", method_name, e)),
    }
}

fn calculate_combined_risk_score(
    basic_analysis: &FileAnalysisResult,
    wasm_analyses: &[WasmFileAnalysis],
) -> f64 {
    let mut score = 0.0;
    let mut factors = 0;
    
    // Factor in entropy
    if basic_analysis.entropy > 7.0 {
        score += 20.0;
        factors += 1;
    }
    
    // Factor in suspicious imports
    let suspicious_imports = basic_analysis.imports.iter()
        .filter(|i| i.suspicious)
        .count();
    if suspicious_imports > 0 {
        score += (suspicious_imports as f64) * 5.0;
        factors += 1;
    }
    
    // Factor in suspicious strings
    let suspicious_strings = basic_analysis.strings.iter()
        .filter(|s| s.suspicious)
        .count();
    if suspicious_strings > 0 {
        score += (suspicious_strings as f64).min(30.0);
        factors += 1;
    }
    
    // Factor in anomalies
    score += (basic_analysis.anomalies.len() as f64) * 10.0;
    factors += basic_analysis.anomalies.len();
    
    // Factor in WASM analysis results
    for analysis in wasm_analyses {
        if let Some(obj) = analysis.results.as_object() {
            if let Some(success) = obj.get("success").and_then(|v| v.as_bool()) {
                if success {
                    score += 15.0;
                    factors += 1;
                }
            }
        }
    }
    
    // Normalize score to 0-100
    if factors > 0 {
        (score / factors as f64).min(100.0)
    } else {
        0.0
    }
}

fn generate_ml_predictions(wasm_analyses: &[WasmFileAnalysis]) -> Option<MlPredictions> {
    // Look for deobfuscator results which would contain ML predictions
    for analysis in wasm_analyses {
        if analysis.module_name == DEOBFUSCATOR {
            // Parse actual ML predictions from deobfuscator WASM module output
            if let Some(output_str) = analysis.results.get("output").and_then(|v| v.as_str()) {
                // The output is a JSON string containing DeobfuscationResult
                if let Ok(deobfuscation_result) = serde_json::from_str::<serde_json::Value>(output_str) {
                    // Extract ml_analysis from the deobfuscation result
                    if let Some(ml_analysis) = deobfuscation_result.get("ml_analysis") {
                        let malware_probability = ml_analysis.get("malware_probability")
                            .and_then(|v| v.as_f64())
                            .unwrap_or(0.0);

                        let family_predictions = ml_analysis.get("family_predictions")
                            .and_then(|v| v.as_array())
                            .map(|families| {
                                families.iter().filter_map(|f| {
                                    let family = f.get("family")?.as_str()?.to_string();
                                    let confidence = f.get("confidence")?.as_f64()?;
                                    Some(FamilyPrediction { family, confidence })
                                }).collect()
                            })
                            .unwrap_or_else(Vec::new);

                        let behavior_predictions = ml_analysis.get("behavior_predictions")
                            .and_then(|v| v.as_array())
                            .map(|behaviors| {
                                behaviors.iter()
                                    .filter_map(|b| b.as_str().map(|s| s.to_string()))
                                    .collect()
                            })
                            .unwrap_or_else(Vec::new);

                        return Some(MlPredictions {
                            malware_probability,
                            family_predictions,
                            behavior_predictions,
                        });
                    }
                }
            }
        }
    }

    None
}

#[tauri::command]
pub async fn load_wasm_security_modules(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
) -> Result<Vec<String>, String> {
    // Load Component Model WASM files from wasm-modules directory
    let modules = vec![
        (ANALYSIS_ENGINE, "analysis-engine", "athena_analysis_engine"),
        (CRYPTO_MODULE, "crypto", "athena_crypto"),
        (DEOBFUSCATOR, "deobfuscator", "athena_deobfuscator"),
        (FILE_PROCESSOR, "file-processor", "athena_file_processor"),
        (NETWORK_MODULE, "network", "athena_network"),
        (PATTERN_MATCHER, "pattern-matcher", "athena_pattern_matcher"),
        (SANDBOX_MODULE, "sandbox", "athena_sandbox"),
    ];

    let mut loaded_modules = Vec::new();

    for (name, module_dir, wasm_name) in modules {
        // Component Model WASM path (relative to athena-v2/src-tauri/src/commands/ working directory)
        let wasm_path = format!("../../wasm-modules/core/{}/target/wasm32-wasip1/release/{}.wasm",
            module_dir, wasm_name);

        // Use Component::from_file approach (recommended by Wasmtime docs)
        let safe_path = match SafePathBuf::new(wasm_path.clone().into()) {
            Ok(p) => p,
            Err(e) => {
                eprintln!("Invalid WASM path {}: {}", wasm_path, e);
                continue;
            }
        };

        match crate::commands::wasm_runtime::load_wasm_module_from_file(
            runtime.clone(),
            name.to_string(),
            safe_path,
        ).await {
            Ok(_) => {
                loaded_modules.push(name.to_string());
                println!("Successfully loaded Component Model WASM module: {} from {}", name, wasm_path);
            },
            Err(e) => {
                eprintln!("Failed to load WASM module {} from {}: {}", name, wasm_path, e);
                // For development, continue without the module
            }
        }
    }

    Ok(loaded_modules)
}