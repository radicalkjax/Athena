use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::State;
use wasmtime::*;
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder};
use chrono::Utc;

struct WasmStore {
    _wasi: WasiCtx,
    limiter: StoreLimits,
}

impl WasmStore {
    fn new() -> Self {
        Self {
            _wasi: WasiCtxBuilder::new()
                .inherit_stdio()
                .build(),
            limiter: StoreLimitsBuilder::new()
                .memory_size(100 * 1024 * 1024) // 100MB limit
                .build(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WasmModule {
    id: String,
    name: String,
    loaded: bool,
    memory_usage: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WasmExecutionResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub execution_time_ms: u64,
    pub memory_used: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmMetrics {
    pub confidence: f64,
    pub memory_used: u64,
    pub throughput: f64,
    pub execution_time_ms: u64,
    pub call_count: u64,
    pub error_count: u64,
    pub last_execution: String,
}

impl Default for WasmMetrics {
    fn default() -> Self {
        Self {
            confidence: 0.0,
            memory_used: 0,
            throughput: 0.0,
            execution_time_ms: 0,
            call_count: 0,
            error_count: 0,
            last_execution: Utc::now().to_rfc3339(),
        }
    }
}

/// Track metrics for a WASM module instance
#[derive(Debug, Clone)]
pub struct MetricsTracker {
    module_name: String,
    call_count: u64,
    error_count: u64,
    total_execution_time: Duration,
    peak_memory: u64,
    total_bytes_processed: u64,
}

impl MetricsTracker {
    pub fn new(module_name: String) -> Self {
        Self {
            module_name,
            call_count: 0,
            error_count: 0,
            total_execution_time: Duration::ZERO,
            peak_memory: 0,
            total_bytes_processed: 0,
        }
    }

    /// Record a function execution
    pub fn record_execution(&mut self, duration: Duration, memory_used: u64, bytes_processed: u64, success: bool) {
        self.call_count += 1;
        self.total_execution_time += duration;
        self.total_bytes_processed += bytes_processed;

        if memory_used > self.peak_memory {
            self.peak_memory = memory_used;
        }

        if !success {
            self.error_count += 1;
        }
    }

    /// Get current metrics
    pub fn get_metrics(&self) -> WasmMetrics {
        WasmMetrics {
            confidence: self.calculate_confidence(),
            memory_used: self.peak_memory,
            throughput: self.calculate_throughput(),
            execution_time_ms: self.total_execution_time.as_millis() as u64,
            call_count: self.call_count,
            error_count: self.error_count,
            last_execution: Utc::now().to_rfc3339(),
        }
    }

    fn calculate_confidence(&self) -> f64 {
        if self.call_count == 0 {
            return 0.0;
        }

        // Confidence based on success rate
        let success_rate = (self.call_count - self.error_count) as f64 / self.call_count as f64;

        // Confidence increases with more successful calls (logarithmic scaling)
        let call_factor = (self.call_count as f64).log10().min(1.0);

        // Combine: 70% success rate + 30% call volume factor
        success_rate * (0.7 + 0.3 * call_factor)
    }

    fn calculate_throughput(&self) -> f64 {
        if self.total_execution_time.is_zero() {
            return 0.0;
        }

        // Bytes per second
        self.total_bytes_processed as f64 / self.total_execution_time.as_secs_f64()
    }
}

// Global metrics storage
lazy_static::lazy_static! {
    static ref METRICS: Arc<Mutex<HashMap<String, MetricsTracker>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

pub struct WasmRuntime {
    engine: Engine,
    modules: Arc<Mutex<HashMap<String, (Module, Store<WasmStore>)>>>,
}

impl WasmRuntime {
    pub fn new() -> Result<Self> {
        let mut config = Config::new();
        config.wasm_simd(true);
        config.wasm_bulk_memory(true);
        config.wasm_reference_types(true);
        config.wasm_multi_value(true);
        
        let engine = Engine::new(&config)?;
        
        Ok(Self {
            engine,
            modules: Arc::new(Mutex::new(HashMap::new())),
        })
    }
}

#[tauri::command]
pub async fn initialize_wasm_runtime(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
) -> Result<String, String> {
    let mut runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    
    if runtime_guard.is_none() {
        let new_runtime = WasmRuntime::new()
            .map_err(|e| format!("Failed to initialize WASM runtime: {}", e))?;
        *runtime_guard = Some(new_runtime);
        Ok("WASM runtime initialized successfully".to_string())
    } else {
        Ok("WASM runtime already initialized".to_string())
    }
}

#[tauri::command]
pub async fn load_wasm_module(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_id: String,
    module_bytes: Vec<u8>,
) -> Result<WasmModule, String> {
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;
    
    let module = Module::new(&runtime.engine, &module_bytes)
        .map_err(|e| format!("Failed to compile WASM module: {}", e))?;
    
    let mut store = Store::new(&runtime.engine, WasmStore::new());
    store.limiter(|state| &mut state.limiter);
    
    let mut modules = runtime.modules.lock().map_err(|e| e.to_string())?;
    modules.insert(module_id.clone(), (module, store));
    
    Ok(WasmModule {
        id: module_id.clone(),
        name: module_id,
        loaded: true,
        memory_usage: 0,
    })
}

/// Convert JSON value to Wasmtime Val based on expected type
fn json_to_val(json_val: &serde_json::Value, expected_type: &ValType) -> Result<Val, String> {
    match (json_val, expected_type) {
        (serde_json::Value::Number(n), ValType::I32) => {
            n.as_i64()
                .and_then(|i| i32::try_from(i).ok())
                .map(Val::I32)
                .ok_or_else(|| format!("Cannot convert {} to i32", n))
        }
        (serde_json::Value::Number(n), ValType::I64) => {
            n.as_i64()
                .map(Val::I64)
                .ok_or_else(|| format!("Cannot convert {} to i64", n))
        }
        (serde_json::Value::Number(n), ValType::F32) => {
            n.as_f64()
                .map(|f| Val::F32((f as f32).to_bits()))
                .ok_or_else(|| format!("Cannot convert {} to f32", n))
        }
        (serde_json::Value::Number(n), ValType::F64) => {
            n.as_f64()
                .map(|f| Val::F64(f.to_bits()))
                .ok_or_else(|| format!("Cannot convert {} to f64", n))
        }
        _ => Err(format!("Unsupported type conversion: {:?} to {:?}", json_val, expected_type))
    }
}

/// Convert Wasmtime Val to JSON value
fn val_to_json(val: &Val) -> serde_json::Value {
    match val {
        Val::I32(v) => serde_json::Value::Number((*v).into()),
        Val::I64(v) => serde_json::Value::Number((*v).into()),
        Val::F32(bits) => serde_json::json!(f32::from_bits(*bits)),
        Val::F64(bits) => serde_json::json!(f64::from_bits(*bits)),
        Val::V128(_) => serde_json::Value::String("<v128>".to_string()),
        _ => serde_json::Value::Null,
    }
}

#[tauri::command]
pub async fn execute_wasm_function(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_id: String,
    function_name: String,
    _args: Vec<serde_json::Value>,
) -> Result<WasmExecutionResult, String> {
    let start = std::time::Instant::now();
    
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;
    
    let mut modules = runtime.modules.lock().map_err(|e| e.to_string())?;
    let (module, store) = modules
        .get_mut(&module_id)
        .ok_or("Module not found")?;
    
    let instance = Instance::new(&mut *store, module, &[])
        .map_err(|e| format!("Failed to instantiate module: {}", e))?;
    
    let func = instance
        .get_func(&mut *store, &function_name)
        .ok_or(format!("Function '{}' not found", function_name))?;

    // Get function type to validate args
    let func_ty = func.ty(&*store);
    let expected_params = func_ty.params();
    let expected_results = func_ty.results();

    // Validate argument count
    if _args.len() != expected_params.len() {
        return Err(format!(
            "Function '{}' expects {} arguments, got {}",
            function_name,
            expected_params.len(),
            _args.len()
        ));
    }

    // Convert JSON args to Wasmtime Vals
    let mut wasm_args = Vec::new();
    for (i, (json_arg, expected_type)) in _args.iter().zip(expected_params).enumerate() {
        let val = json_to_val(json_arg, &expected_type)
            .map_err(|e| format!("Argument {}: {}", i, e))?;
        wasm_args.push(val);
    }

    // Prepare results buffer
    let mut results = vec![Val::I32(0); expected_results.len()];

    // Execute the function
    func.call(&mut *store, &wasm_args, &mut results)
        .map_err(|e| format!("Function execution failed: {}", e))?;

    // Convert results to JSON
    let output_json = if results.len() == 1 {
        val_to_json(&results[0])
    } else if results.len() > 1 {
        serde_json::Value::Array(results.iter().map(val_to_json).collect())
    } else {
        serde_json::Value::Null
    };

    // Calculate memory usage (Wasmtime 26 doesn't expose memory_consumed, use approximation)
    let memory_used = if let Some(memory) = instance.get_memory(&mut *store, "memory") {
        memory.data_size(&store) as u64
    } else {
        0
    };

    let execution_time_ms = start.elapsed().as_millis() as u64;
    let duration = start.elapsed();

    // Estimate bytes processed (use memory size as proxy)
    let bytes_processed = memory_used;

    // Record metrics
    {
        let mut metrics = METRICS.lock().unwrap();
        let tracker = metrics.entry(module_id.clone())
            .or_insert_with(|| MetricsTracker::new(module_id.clone()));

        tracker.record_execution(duration, memory_used, bytes_processed, true);
    }

    Ok(WasmExecutionResult {
        success: true,
        output: Some(output_json.to_string()),
        error: None,
        execution_time_ms,
        memory_used,
    })
}

#[tauri::command]
pub async fn unload_wasm_module(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_id: String,
) -> Result<String, String> {
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;
    
    let mut modules = runtime.modules.lock().map_err(|e| e.to_string())?;
    modules.remove(&module_id);
    
    Ok(format!("Module '{}' unloaded successfully", module_id))
}

#[tauri::command]
pub async fn get_wasm_modules(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
) -> Result<Vec<WasmModule>, String> {
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;
    
    let modules = runtime.modules.lock().map_err(|e| e.to_string())?;
    let module_list: Vec<WasmModule> = modules
        .keys()
        .map(|id| WasmModule {
            id: id.clone(),
            name: id.clone(),
            loaded: true,
            memory_usage: 0,
        })
        .collect();
    
    Ok(module_list)
}

#[tauri::command]
pub async fn get_wasm_memory_usage(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
) -> Result<u64, String> {
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;

    let mut modules = runtime.modules.lock().map_err(|e| e.to_string())?;

    // Calculate actual memory usage by summing memory from all loaded modules
    let mut total_memory: u64 = 0;

    for (module_id, (module, store)) in modules.iter_mut() {
        // Instantiate the module to access memory
        match Instance::new(&mut *store, module, &[]) {
            Ok(instance) => {
                // Get the module's memory if it exports "memory"
                if let Some(memory) = instance.get_memory(&mut *store, "memory") {
                    // Get the actual memory size in bytes
                    let memory_size = memory.data_size(&store) as u64;
                    total_memory += memory_size;
                    // Note: Successfully measured memory for module_id
                    eprintln!("Module '{}': {} bytes", module_id, memory_size);
                } else {
                    // Module doesn't export memory, add base overhead estimate
                    // Typical WASM module overhead is around 64KB for the instance
                    eprintln!("Module '{}': no memory export, using 64KB estimate", module_id);
                    total_memory += 64 * 1024;
                }
            }
            Err(e) => {
                // If we can't instantiate, add a conservative estimate
                // Log the error with module_id for debugging
                eprintln!("Module '{}': failed to instantiate ({}), using 64KB estimate", module_id, e);
                total_memory += 64 * 1024;
            }
        }
    }

    Ok(total_memory)
}

#[tauri::command]
pub async fn get_wasm_metrics(module_id: String) -> Result<WasmMetrics, String> {
    let metrics = METRICS.lock().unwrap();

    metrics.get(&module_id)
        .map(|tracker| tracker.get_metrics())
        .ok_or_else(|| format!("No metrics found for module: {}", module_id))
}

#[tauri::command]
pub async fn get_all_wasm_metrics() -> Result<HashMap<String, WasmMetrics>, String> {
    let metrics = METRICS.lock().unwrap();

    Ok(metrics.iter()
        .map(|(module_id, tracker)| (module_id.clone(), tracker.get_metrics()))
        .collect())
}

#[tauri::command]
pub async fn reset_wasm_metrics(module_id: String) -> Result<String, String> {
    let mut metrics = METRICS.lock().unwrap();

    if metrics.remove(&module_id).is_some() {
        Ok(format!("Metrics reset for module: {}", module_id))
    } else {
        Err(format!("No metrics found for module: {}", module_id))
    }
}

#[tauri::command]
pub async fn reset_all_wasm_metrics() -> Result<String, String> {
    let mut metrics = METRICS.lock().unwrap();
    let count = metrics.len();
    metrics.clear();
    Ok(format!("Reset metrics for {} modules", count))
}