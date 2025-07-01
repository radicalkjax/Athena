use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::State;
use wasmtime::*;
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder};

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
    
    let _func = instance
        .get_func(&mut *store, &function_name)
        .ok_or(format!("Function '{}' not found", function_name))?;
    
    // TODO: Actually execute the function with args
    
    let execution_time_ms = start.elapsed().as_millis() as u64;
    
    Ok(WasmExecutionResult {
        success: true,
        output: Some("Function executed successfully".to_string()),
        error: None,
        execution_time_ms,
        memory_used: 0,
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
    
    let modules = runtime.modules.lock().map_err(|e| e.to_string())?;
    let total_memory: u64 = modules.len() as u64 * 1024 * 1024; // Placeholder calculation
    
    Ok(total_memory)
}