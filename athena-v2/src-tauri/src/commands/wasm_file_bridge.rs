use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::State;
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
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    file_path: String,
) -> Result<EnhancedFileAnalysis, String> {
    let _start = std::time::Instant::now();
    
    // First, perform basic file analysis
    let basic_analysis = crate::commands::file_analysis::analyze_file(file_path.clone())
        .await?;
    
    // Read file data for WASM analysis
    let file_data = std::fs::read(&file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    let mut wasm_analyses = Vec::new();
    
    // Check if WASM runtime is initialized
    let has_runtime = {
        let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
        runtime_guard.is_some()
    };
    
    if has_runtime {
        // Run analysis with each WASM module
        
        // 1. Analysis Engine - Core malware analysis
        if let Ok(result) = run_wasm_analysis(
            &runtime,
            ANALYSIS_ENGINE,
            "analyze",
            &file_data,
        ).await {
            wasm_analyses.push(result);
        }
        
        // 2. Crypto Module - Encryption detection
        if let Ok(result) = run_wasm_analysis(
            &runtime,
            CRYPTO_MODULE,
            "detect_encryption",
            &file_data,
        ).await {
            wasm_analyses.push(result);
        }
        
        // 3. Deobfuscator - ML-based deobfuscation
        if let Ok(result) = run_wasm_analysis(
            &runtime,
            DEOBFUSCATOR,
            "deobfuscate",
            &file_data,
        ).await {
            wasm_analyses.push(result);
        }
        
        // 4. File Processor - Format parsing
        if let Ok(result) = run_wasm_analysis(
            &runtime,
            FILE_PROCESSOR,
            "process_file",
            &file_data,
        ).await {
            wasm_analyses.push(result);
        }
        
        // 5. Pattern Matcher - Signature detection
        if let Ok(result) = run_wasm_analysis(
            &runtime,
            PATTERN_MATCHER,
            "match_patterns",
            &file_data,
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

async fn run_wasm_analysis(
    runtime: &State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_name: &str,
    function_name: &str,
    file_data: &[u8],
) -> Result<WasmFileAnalysis, String> {
    let start = std::time::Instant::now();
    
    // Convert file data to JSON value for passing to WASM
    let args = vec![serde_json::json!({
        "data": base64::Engine::encode(&base64::engine::general_purpose::STANDARD, file_data),
        "length": file_data.len(),
    })];
    
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
    // Load actual WASM files from the public directory
    let modules = vec![
        (ANALYSIS_ENGINE, "analysis-engine"),
        (CRYPTO_MODULE, "crypto"),
        (DEOBFUSCATOR, "deobfuscator"),
        (FILE_PROCESSOR, "file-processor"),
        (NETWORK_MODULE, "network"),
        (PATTERN_MATCHER, "pattern-matcher"),
        (SANDBOX_MODULE, "sandbox"),
    ];
    
    let mut loaded_modules = Vec::new();
    
    for (name, module_dir) in modules {
        // Try to load the WASM file
        let wasm_path = format!("../public/wasm/{}/{}_bg.wasm", module_dir, module_dir.replace("-", "_"));
        
        match std::fs::read(&wasm_path) {
            Ok(bytes) => {
                match crate::commands::wasm_runtime::load_wasm_module(
                    runtime.clone(),
                    name.to_string(),
                    bytes,
                ).await {
                    Ok(_) => {
                        loaded_modules.push(name.to_string());
                        println!("Successfully loaded WASM module: {}", name);
                    },
                    Err(e) => eprintln!("Failed to load WASM module {}: {}", name, e),
                }
            },
            Err(e) => {
                eprintln!("Failed to read WASM file at {}: {}", wasm_path, e);
                // For development, continue without the module
            }
        }
    }
    
    Ok(loaded_modules)
}