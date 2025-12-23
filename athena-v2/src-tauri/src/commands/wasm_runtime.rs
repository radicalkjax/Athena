use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::State;
use tauri::path::SafePathBuf;
use wasmtime::*;
use wasmtime::component::{Component, Linker, ResourceTable, Val as ComponentVal, InstancePre, Instance, ResourceAny};
use wasmtime_wasi::{WasiCtx, WasiCtxBuilder, WasiView, WasiCtxView};
use chrono::Utc;
use uuid::Uuid;
use crate::metrics::{WASM_INIT_DURATION, WASM_OPERATION_DURATION, WASM_OPERATION_COUNTER, WASM_MODULE_SIZE, WASM_MEMORY_USAGE};

/// Default fuel units for WASM execution (prevents infinite loops)
/// 10 million fuel units ≈ ~1 second of execution on typical hardware
/// Adjust based on actual workload requirements
const DEFAULT_FUEL_UNITS: u64 = 10_000_000;

/// Maximum session age before cleanup (30 minutes)
const SESSION_TTL_SECS: i64 = 30 * 60;

/// Session for managing stateful WASM component interactions
/// This allows resources created in one call to be used in subsequent calls
pub struct WasmSession {
    pub session_id: String,
    pub module_id: String,
    pub(crate) store: Store<WasmStore>,
    pub(crate) instance: Instance,
    /// Maps handle IDs to ResourceAny values within this session
    pub resource_handles: HashMap<String, ResourceAny>,
    pub created_at: chrono::DateTime<Utc>,
}

impl WasmSession {
    /// Store a resource and return its handle ID
    pub fn store_resource(&mut self, resource: ResourceAny) -> String {
        let handle_id = format!("res-{}", Uuid::new_v4());
        self.resource_handles.insert(handle_id.clone(), resource);
        handle_id
    }

    /// Get a resource by handle ID
    pub fn get_resource(&self, handle_id: &str) -> Option<&ResourceAny> {
        self.resource_handles.get(handle_id)
    }

    /// Remove a resource by handle ID
    pub fn remove_resource(&mut self, handle_id: &str) -> Option<ResourceAny> {
        self.resource_handles.remove(handle_id)
    }
}

/// Response when creating a new session
#[derive(Debug, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub module_id: String,
    pub created_at: String,
}

/// Response when a function returns a resource
#[derive(Debug, Serialize, Deserialize)]
pub struct ResourceHandle {
    pub handle_id: String,
    pub resource_type: String,
    pub session_id: String,
}

// Global session storage - manages active WASM sessions
lazy_static::lazy_static! {
    static ref SESSIONS: Arc<Mutex<HashMap<String, WasmSession>>> =
        Arc::new(Mutex::new(HashMap::new()));
}

pub(crate) struct WasmStore {
    wasi: WasiCtx,
    limiter: StoreLimits,
    table: ResourceTable,
    memory_consumed: u64,
}

impl WasmStore {
    fn new() -> Self {
        // Configure WASI Preview 2 for secure malware analysis environment (per DeepWiki v38)
        let mut builder = WasiCtxBuilder::new();

        // Inherit stdio for logging and output (safe for analysis)
        builder.inherit_stdio();

        // Controlled environment - no host environment variables by default
        // (malware analysis should be isolated from host)
        builder.env("MALWARE_ANALYSIS", "true");
        builder.env("SANDBOXED", "true");

        // No command-line arguments by default (set per-analysis if needed)
        builder.args(&[] as &[&str]);

        // Network isolation for malware analysis safety (DeepWiki security best practice)
        builder.allow_tcp(false);  // Disable TCP - prevent network communication
        builder.allow_udp(false);  // Disable UDP - prevent network communication
        builder.allow_ip_name_lookup(false);  // Disable DNS lookups - prevent reconnaissance

        // Blocking operations control (DeepWiki recommendation for timeout enforcement)
        builder.allow_blocking_current_thread(false);  // Prevent timeout bypass via blocking

        // No preopened directories by default (filesystem isolation)
        // Specific directories can be added per-analysis as needed with restricted permissions

        Self {
            wasi: builder.build(),
            limiter: StoreLimitsBuilder::new()
                .memory_size(100 * 1024 * 1024) // 100MB limit
                .build(),
            table: ResourceTable::new(),
            memory_consumed: 0,
        }
    }
}

impl ResourceLimiter for WasmStore {
    fn memory_growing(
        &mut self,
        current: usize,
        desired: usize,
        maximum: Option<usize>,
    ) -> anyhow::Result<bool> {
        // First check against WASM module's declared maximum
        if let Some(max) = maximum {
            if desired > max {
                anyhow::bail!(
                    "Memory growth to {} pages exceeds module maximum of {} pages",
                    desired,
                    max
                );
            }
        }

        let delta = (desired - current) as u64;
        self.memory_consumed += delta;

        // Check against our 100MB limit
        if self.memory_consumed > 100 * 1024 * 1024 {
            anyhow::bail!("Memory limit of 100MB exceeded (currently: {} MB)",
                self.memory_consumed / (1024 * 1024));
        }

        Ok(true)
    }

    fn table_growing(
        &mut self,
        current: usize,
        desired: usize,
        maximum: Option<usize>,
    ) -> anyhow::Result<bool> {
        // Enforce table size limits to prevent resource exhaustion
        const MAX_TABLE_SIZE: usize = 10_000; // Maximum 10,000 table entries

        // Check against maximum if specified
        if let Some(max) = maximum {
            if desired > max {
                anyhow::bail!("Table size {} exceeds maximum {}", desired, max);
            }
        }

        // Check against our hard limit
        if desired > MAX_TABLE_SIZE {
            anyhow::bail!("Table size {} exceeds hard limit {}", desired, MAX_TABLE_SIZE);
        }

        // Verify the growth is reasonable (not a huge jump)
        let growth = desired.saturating_sub(current);
        if growth > MAX_TABLE_SIZE / 2 {
            anyhow::bail!("Table growth {} is suspiciously large", growth);
        }

        Ok(true)
    }

    fn memory_grow_failed(&mut self, error: anyhow::Error) -> anyhow::Result<()> {
        // Log the memory growth failure for malware analysis tracking
        eprintln!("WASM memory growth failed: {}", error);
        Ok(())
    }

    fn table_grow_failed(&mut self, error: anyhow::Error) -> anyhow::Result<()> {
        // Log the table growth failure for malware analysis tracking
        eprintln!("WASM table growth failed: {}", error);
        Ok(())
    }

    fn instances(&self) -> usize {
        // Maximum instances per Store (malware analysis isolation)
        100
    }

    fn tables(&self) -> usize {
        // Maximum tables per Store
        100
    }

    fn memories(&self) -> usize {
        // Maximum linear memories per Store
        10
    }
}

// Implement WasiView trait for Component Model WASI support
impl WasiView for WasmStore {
    fn ctx(&mut self) -> WasiCtxView<'_> {
        WasiCtxView {
            ctx: &mut self.wasi,
            table: &mut self.table,
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
    pub module_name: String,
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
            module_name: String::new(),
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

        // Record to Prometheus metrics
        let status = if success { "success" } else { "error" };

        WASM_OPERATION_DURATION
            .with_label_values(&[&self.module_name, "execute", status])
            .observe(duration.as_secs_f64());

        WASM_OPERATION_COUNTER
            .with_label_values(&[&self.module_name, "execute", status])
            .inc();

        WASM_MEMORY_USAGE
            .with_label_values(&[&self.module_name])
            .set(memory_used as f64);
    }

    /// Get current metrics
    pub fn get_metrics(&self) -> WasmMetrics {
        WasmMetrics {
            module_name: self.module_name.clone(),
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
    linker: Arc<Linker<WasmStore>>,
    modules: Arc<Mutex<HashMap<String, InstancePre<WasmStore>>>>,
}

impl WasmRuntime {
    pub fn new() -> Result<Self> {
        let mut config = Config::new();

        // Enable Component Model and essential WASM features
        config.wasm_component_model(true); // Enable Component Model
        config.wasm_simd(true);
        config.wasm_bulk_memory(true);
        config.wasm_reference_types(true);
        config.wasm_multi_value(true);
        config.wasm_multi_memory(false); // Not needed for our use case
        config.wasm_memory64(false); // Not needed for malware analysis

        // Security settings for malware analysis environment (per DeepWiki v38 docs)
        config.max_wasm_stack(512 * 1024); // 512KB max stack (prevent stack exhaustion)
        config.memory_guard_size(64 * 1024); // 64KB guard pages after linear memory
        config.guard_before_linear_memory(true); // Extra guard before memory (protection against bugs)
        config.memory_reservation(1024 * 1024 * 1024); // 1GB virtual reservation (elide bounds checks)
        config.memory_reservation_for_growth(100 * 1024 * 1024); // 100MB growth space
        config.memory_init_cow(true); // CoW initialization (faster instantiation, less memory)
        config.signals_based_traps(true); // OS signals for traps (performance optimization)

        // Optimization settings for production
        config.cranelift_opt_level(wasmtime::OptLevel::Speed); // Optimize for speed
        config.parallel_compilation(true); // Use multiple threads for compilation
        config.cranelift_nan_canonicalization(false); // No need for deterministic NaN

        // Debug and profiling (configured for production error reporting)
        config.debug_info(false); // No debug info in production
        config.wasm_backtrace(true); // Enable backtraces for error reporting
        config.native_unwind_info(false); // Don't need native unwind in production
        config.generate_address_map(true); // Map native addresses to Wasm (for backtraces)

        // Trap handling
        config.coredump_on_trap(false); // Don't generate coredumps

        // CRITICAL: Enable fuel consumption for CPU time limiting
        // This prevents infinite loops and denial-of-service attacks in malicious WASM
        config.consume_fuel(true);

        // Configure PoolingInstanceAllocator for production (DeepWiki v38 recommendation)
        // Provides faster instantiation, security isolation, and predictable resource usage
        let mut pooling_config = PoolingAllocationConfig::new();

        // Component-level limits (security isolation per component)
        pooling_config.total_component_instances(50); // Max concurrent component instances
        pooling_config.max_memories_per_component(5); // Max memories per component
        pooling_config.max_tables_per_component(2); // Max tables per component
        pooling_config.max_core_instances_per_component(10); // Cap core instances per component
        pooling_config.max_component_instance_size(1024 * 1024); // 1MB component metadata limit

        // Core module limits
        pooling_config.total_core_instances(100); // Max core module instances
        pooling_config.max_memories_per_module(1); // Limit memories per module (security)
        pooling_config.max_tables_per_module(1); // Limit tables per module (security)

        // Global resource limits
        pooling_config.total_memories(250); // Total memories across all instances
        pooling_config.total_tables(50); // Total tables across all instances
        pooling_config.max_memory_size(100 * 1024 * 1024); // 100MB max per memory
        pooling_config.table_elements(10_000); // Max table elements

        // Memory residency optimizations (Linux-specific, per DeepWiki best practices)
        pooling_config.linear_memory_keep_resident(64 * 1024); // Keep 64KB resident
        pooling_config.table_keep_resident(1024); // Keep 1KB resident for tables
        pooling_config.max_unused_warm_slots(10); // Retain up to 10 warm slots

        config.allocation_strategy(wasmtime::InstanceAllocationStrategy::Pooling(pooling_config));

        let engine = Engine::new(&config)?;

        // Create linker and add WASI Preview 2 support for components
        let mut linker = Linker::new(&engine);
        wasmtime_wasi::p2::add_to_linker_sync(&mut linker)
            .map_err(|e| anyhow::anyhow!("Failed to add WASI to linker: {}", e))?;

        Ok(Self {
            engine,
            linker: Arc::new(linker),
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

    // Compile as Component Model component (not legacy module)
    let component = Component::new(&runtime.engine, &module_bytes)
        .map_err(|e| format!("Failed to compile component: {}", e))?;

    // Pre-instantiate the component (DeepWiki best practice)
    let instance_pre = runtime.linker.instantiate_pre(&component)
        .map_err(|e| format!("Failed to pre-instantiate component: {}", e))?;

    let mut modules = runtime.modules.lock().map_err(|e| e.to_string())?;

    // Store the InstancePre for fast repeated instantiation
    modules.insert(module_id.clone(), instance_pre);

    Ok(WasmModule {
        id: module_id.clone(),
        name: module_id,
        loaded: true,
        memory_usage: 0, // Memory usage will be tracked per-execution
    })
}

/// Load WASM module from file path (recommended approach per Wasmtime docs)
#[tauri::command]
pub async fn load_wasm_module_from_file(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_id: String,
    file_path: SafePathBuf,
) -> Result<WasmModule, String> {
    let start_time = Instant::now();

    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;

    // Use Component::from_file - the recommended approach per Wasmtime 37.0 docs
    let component = Component::from_file(&runtime.engine, file_path.as_ref())
        .map_err(|e| {
            // Record failed initialization
            WASM_INIT_DURATION
                .with_label_values(&[&module_id])
                .observe(start_time.elapsed().as_secs_f64());
            WASM_OPERATION_COUNTER
                .with_label_values(&[&module_id, "init", "error"])
                .inc();
            format!("Failed to load component from file: {}", e)
        })?;

    // Pre-instantiate the component (DeepWiki best practice)
    // This performs import resolution and type-checking once, allowing fast instantiation later
    let instance_pre = runtime.linker.instantiate_pre(&component)
        .map_err(|e| {
            // Record failed pre-instantiation
            WASM_INIT_DURATION
                .with_label_values(&[&module_id])
                .observe(start_time.elapsed().as_secs_f64());
            WASM_OPERATION_COUNTER
                .with_label_values(&[&module_id, "init", "error"])
                .inc();
            format!("Failed to pre-instantiate component: {}", e)
        })?;

    // Record module size from file metadata
    if let Ok(metadata) = std::fs::metadata(&file_path) {
        WASM_MODULE_SIZE
            .with_label_values(&[&module_id])
            .set(metadata.len() as f64);
    }

    let mut modules = runtime.modules.lock().map_err(|e| e.to_string())?;

    // Store the InstancePre for fast repeated instantiation
    modules.insert(module_id.clone(), instance_pre);

    // Record successful initialization
    WASM_INIT_DURATION
        .with_label_values(&[&module_id])
        .observe(start_time.elapsed().as_secs_f64());
    WASM_OPERATION_COUNTER
        .with_label_values(&[&module_id, "init", "success"])
        .inc();

    Ok(WasmModule {
        id: module_id.clone(),
        name: module_id,
        loaded: true,
        memory_usage: 0, // Memory usage will be tracked per-execution
    })
}

/// Convert JSON value to Component Model Val
/// This handles the common types used in our WIT interfaces
fn json_to_component_val(json_val: &serde_json::Value, arg_index: usize) -> Result<ComponentVal, String> {
    json_to_component_val_internal(json_val, arg_index, None)
}

/// Convert JSON value to Component Model Val with optional session for resource lookups
fn json_to_component_val_with_session(
    json_val: &serde_json::Value,
    arg_index: usize,
    session: &WasmSession,
) -> Result<ComponentVal, String> {
    json_to_component_val_internal(json_val, arg_index, Some(session))
}

/// Internal implementation of JSON to ComponentVal conversion
fn json_to_component_val_internal(
    json_val: &serde_json::Value,
    arg_index: usize,
    session: Option<&WasmSession>,
) -> Result<ComponentVal, String> {
    match json_val {
        // Booleans
        serde_json::Value::Bool(b) => Ok(ComponentVal::Bool(*b)),

        // Numbers - try to infer type
        serde_json::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                // Try i32 first, then i64
                if let Ok(i32_val) = i32::try_from(i) {
                    Ok(ComponentVal::S32(i32_val))
                } else {
                    Ok(ComponentVal::S64(i))
                }
            } else if let Some(u) = n.as_u64() {
                // Try u32 first, then u64
                if let Ok(u32_val) = u32::try_from(u) {
                    Ok(ComponentVal::U32(u32_val))
                } else {
                    Ok(ComponentVal::U64(u))
                }
            } else if let Some(f) = n.as_f64() {
                Ok(ComponentVal::Float64(f))
            } else {
                Err(format!("Argument {}: Cannot convert number {} to ComponentVal", arg_index, n))
            }
        }

        // Strings
        serde_json::Value::String(s) => Ok(ComponentVal::String(s.clone().into())),

        // Arrays - treat as list<u8> (common for binary data)
        serde_json::Value::Array(arr) => {
            let bytes: Result<Vec<u8>, _> = arr.iter().enumerate().map(|(i, v)| {
                v.as_u64()
                    .and_then(|n| u8::try_from(n).ok())
                    .ok_or_else(|| format!("Argument {}, array element {}: {} is not a valid u8", arg_index, i, v))
            }).collect();

            let byte_vec = bytes?;
            Ok(ComponentVal::List(
                byte_vec.into_iter().map(ComponentVal::U8).collect()
            ))
        }

        // Null - use Option::None represented as empty Option
        serde_json::Value::Null => Ok(ComponentVal::Option(None)),

        // Objects - handle resource references, options, and records
        serde_json::Value::Object(obj) => {
            // Check for resource handle reference
            if let Some(handle_id) = obj.get("_resource_handle").and_then(|v| v.as_str()) {
                if let Some(session) = session {
                    if let Some(resource) = session.get_resource(handle_id) {
                        // Clone the ResourceAny to pass it
                        return Ok(ComponentVal::Resource(resource.clone()));
                    } else {
                        return Err(format!("Argument {}: Resource handle '{}' not found in session", arg_index, handle_id));
                    }
                } else {
                    return Err(format!("Argument {}: Resource handles require a session context", arg_index));
                }
            }

            // Check for Option wrapper: {"_option": value} or {"_some": value} or {"_none": true}
            if let Some(inner) = obj.get("_some") {
                let inner_val = json_to_component_val_internal(inner, arg_index, session)?;
                return Ok(ComponentVal::Option(Some(Box::new(inner_val))));
            }
            if obj.get("_none").is_some() {
                return Ok(ComponentVal::Option(None));
            }

            // Check for Result wrapper: {"_ok": value} or {"_err": value}
            if let Some(ok_val) = obj.get("_ok") {
                let inner = json_to_component_val_internal(ok_val, arg_index, session)?;
                return Ok(ComponentVal::Result(Ok(Some(Box::new(inner)))));
            }
            if let Some(err_val) = obj.get("_err") {
                let inner = json_to_component_val_internal(err_val, arg_index, session)?;
                return Ok(ComponentVal::Result(Err(Some(Box::new(inner)))));
            }

            // Otherwise treat as a Record with named fields
            let mut fields: Vec<(String, ComponentVal)> = Vec::new();
            for (key, value) in obj {
                let field_val = json_to_component_val_internal(value, arg_index, session)?;
                fields.push((key.clone(), field_val));
            }
            Ok(ComponentVal::Record(fields))
        }
    }
}

/// Convert Component Model Val to JSON value (without session - resources become placeholders)
fn component_val_to_json(val: &ComponentVal) -> serde_json::Value {
    component_val_to_json_internal(val, None)
}

/// Convert Component Model Val to JSON value with session for resource storage
/// Resources are stored in the session and a handle reference is returned
fn component_val_to_json_with_session(val: ComponentVal, session: &mut WasmSession) -> serde_json::Value {
    component_val_to_json_internal_owned(val, Some(session))
}

/// Internal implementation (borrowed, no resource storage)
fn component_val_to_json_internal(val: &ComponentVal, _session: Option<&mut WasmSession>) -> serde_json::Value {
    match val {
        ComponentVal::Bool(b) => serde_json::Value::Bool(*b),
        ComponentVal::S8(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::U8(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::S16(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::U16(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::S32(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::U32(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::S64(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::U64(v) => serde_json::Value::Number((*v).into()),
        ComponentVal::Float32(f) => serde_json::json!(*f),
        ComponentVal::Float64(f) => serde_json::json!(*f),
        ComponentVal::Char(c) => serde_json::Value::String(c.to_string()),
        ComponentVal::String(s) => serde_json::Value::String(s.to_string()),
        ComponentVal::List(items) => {
            serde_json::Value::Array(items.iter().map(|v| component_val_to_json_internal(v, None)).collect())
        }
        ComponentVal::Record(fields) => {
            let mut map = serde_json::Map::new();
            for (name, value) in fields {
                map.insert(name.to_string(), component_val_to_json_internal(value, None));
            }
            serde_json::Value::Object(map)
        }
        ComponentVal::Tuple(items) => {
            serde_json::Value::Array(items.iter().map(|v| component_val_to_json_internal(v, None)).collect())
        }
        ComponentVal::Variant(name, val) => {
            let mut map = serde_json::Map::new();
            map.insert("_variant".to_string(), serde_json::Value::String(name.to_string()));
            if let Some(v) = val {
                map.insert("_value".to_string(), component_val_to_json_internal(v, None));
            }
            serde_json::Value::Object(map)
        }
        ComponentVal::Enum(name) => {
            serde_json::Value::String(name.to_string())
        }
        ComponentVal::Option(opt) => {
            match opt {
                Some(v) => {
                    let mut map = serde_json::Map::new();
                    map.insert("_some".to_string(), component_val_to_json_internal(v, None));
                    serde_json::Value::Object(map)
                }
                None => serde_json::json!({"_none": true}),
            }
        }
        ComponentVal::Result(res) => {
            match res {
                Ok(Some(v)) => {
                    let mut map = serde_json::Map::new();
                    map.insert("_ok".to_string(), component_val_to_json_internal(v, None));
                    serde_json::Value::Object(map)
                }
                Ok(None) => serde_json::json!({"_ok": null}),
                Err(Some(e)) => {
                    let mut map = serde_json::Map::new();
                    map.insert("_err".to_string(), component_val_to_json_internal(e, None));
                    serde_json::Value::Object(map)
                }
                Err(None) => serde_json::json!({"_err": null}),
            }
        }
        ComponentVal::Flags(flags) => {
            serde_json::Value::Array(
                flags.iter().map(|f| serde_json::Value::String(f.to_string())).collect()
            )
        }
        ComponentVal::Resource(_) => {
            // Without session, we can't store resources - return placeholder
            serde_json::json!({
                "_resource": true,
                "_error": "Resource returned without session context - use session-based execution"
            })
        }
        // Handle new component model types in Wasmtime 38.0
        ComponentVal::Future(_) => serde_json::json!({"_future": true}),
        ComponentVal::Stream(_) => serde_json::json!({"_stream": true}),
        ComponentVal::ErrorContext(_) => serde_json::json!({"_error_context": true}),
    }
}

/// Internal implementation (owned values, can store resources in session)
fn component_val_to_json_internal_owned(val: ComponentVal, session: Option<&mut WasmSession>) -> serde_json::Value {
    match val {
        ComponentVal::Bool(b) => serde_json::Value::Bool(b),
        ComponentVal::S8(v) => serde_json::Value::Number(v.into()),
        ComponentVal::U8(v) => serde_json::Value::Number(v.into()),
        ComponentVal::S16(v) => serde_json::Value::Number(v.into()),
        ComponentVal::U16(v) => serde_json::Value::Number(v.into()),
        ComponentVal::S32(v) => serde_json::Value::Number(v.into()),
        ComponentVal::U32(v) => serde_json::Value::Number(v.into()),
        ComponentVal::S64(v) => serde_json::Value::Number(v.into()),
        ComponentVal::U64(v) => serde_json::Value::Number(v.into()),
        ComponentVal::Float32(f) => serde_json::json!(f),
        ComponentVal::Float64(f) => serde_json::json!(f),
        ComponentVal::Char(c) => serde_json::Value::String(c.to_string()),
        ComponentVal::String(s) => serde_json::Value::String(s.to_string()),
        ComponentVal::List(items) => {
            serde_json::Value::Array(items.into_iter().map(|v| component_val_to_json_internal_owned(v, None)).collect())
        }
        ComponentVal::Record(fields) => {
            let mut map = serde_json::Map::new();
            for (name, value) in fields {
                map.insert(name, component_val_to_json_internal_owned(value, None));
            }
            serde_json::Value::Object(map)
        }
        ComponentVal::Tuple(items) => {
            serde_json::Value::Array(items.into_iter().map(|v| component_val_to_json_internal_owned(v, None)).collect())
        }
        ComponentVal::Variant(name, val) => {
            let mut map = serde_json::Map::new();
            map.insert("_variant".to_string(), serde_json::Value::String(name));
            if let Some(v) = val {
                map.insert("_value".to_string(), component_val_to_json_internal_owned(*v, None));
            }
            serde_json::Value::Object(map)
        }
        ComponentVal::Enum(name) => {
            serde_json::Value::String(name)
        }
        ComponentVal::Option(opt) => {
            match opt {
                Some(v) => {
                    let mut map = serde_json::Map::new();
                    map.insert("_some".to_string(), component_val_to_json_internal_owned(*v, None));
                    serde_json::Value::Object(map)
                }
                None => serde_json::json!({"_none": true}),
            }
        }
        ComponentVal::Result(res) => {
            match res {
                Ok(Some(v)) => {
                    let mut map = serde_json::Map::new();
                    map.insert("_ok".to_string(), component_val_to_json_internal_owned(*v, None));
                    serde_json::Value::Object(map)
                }
                Ok(None) => serde_json::json!({"_ok": null}),
                Err(Some(e)) => {
                    let mut map = serde_json::Map::new();
                    map.insert("_err".to_string(), component_val_to_json_internal_owned(*e, None));
                    serde_json::Value::Object(map)
                }
                Err(None) => serde_json::json!({"_err": null}),
            }
        }
        ComponentVal::Flags(flags) => {
            serde_json::Value::Array(
                flags.into_iter().map(|f| serde_json::Value::String(f)).collect()
            )
        }
        ComponentVal::Resource(resource) => {
            // Store resource in session and return handle
            if let Some(session) = session {
                let handle_id = session.store_resource(resource);
                serde_json::json!({
                    "_resource_handle": handle_id,
                    "_session_id": session.session_id.clone()
                })
            } else {
                serde_json::json!({
                    "_resource": true,
                    "_error": "Resource returned without session context"
                })
            }
        }
        ComponentVal::Future(_) => serde_json::json!({"_future": true}),
        ComponentVal::Stream(_) => serde_json::json!({"_stream": true}),
        ComponentVal::ErrorContext(_) => serde_json::json!({"_error_context": true}),
    }
}

#[tauri::command]
pub async fn execute_wasm_function(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_id: String,
    function_name: String,
    args: Vec<serde_json::Value>,
) -> Result<WasmExecutionResult, String> {
    let start = std::time::Instant::now();
    
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;

    // Get the InstancePre from HashMap
    let modules = runtime.modules.lock().map_err(|e| e.to_string())?;
    let instance_pre = modules
        .get(&module_id)
        .ok_or("Module not found")?;

    // Create a new Store for this execution (per-request pattern per DeepWiki)
    let mut store = Store::new(&runtime.engine, WasmStore::new());
    store.limiter(|state| &mut state.limiter);

    // CRITICAL: Set fuel limit to prevent infinite loops and CPU exhaustion
    // This is the enforcement mechanism - config.consume_fuel(true) only enables tracking
    store.set_fuel(DEFAULT_FUEL_UNITS)
        .map_err(|e| format!("Failed to set fuel limit: {}", e))?;

    // Fast instantiation using pre-instantiated component
    let instance = instance_pre.instantiate(&mut store)
        .map_err(|e| format!("Failed to instantiate component: {}", e))?;

    // Drop the lock ASAP to avoid holding it during execution
    drop(modules);

    // Get the function from the instance
    // Try direct function name first, then try nested interfaces
    let func = instance.get_func(&mut store, &function_name)
        .or_else(|| {
            // Try common interface patterns for our modules
            // WIT interfaces like "athena:crypto/hash#sha256" become nested exports
            for interface in ["hash", "hmac", "aes", "rsa", "utils", "ecdsa",
                            "analyzer", "pattern-matcher", "deobfuscator", "disassembler"] {
                // Try interface.function_name pattern
                let qualified_name = format!("{}#{}", interface, function_name);
                if let Some(f) = instance.get_func(&mut store, &qualified_name) {
                    return Some(f);
                }
            }
            None
        })
        .ok_or(format!("Function '{}' not found in component exports", function_name))?;

    // Convert JSON args to Component Model Val types
    let mut params: Vec<ComponentVal> = Vec::new();
    for (i, json_arg) in args.iter().enumerate() {
        let param = json_to_component_val(json_arg, i)?;
        params.push(param);
    }

    // Prepare results buffer - we'll allocate enough space
    // Component Model functions typically return 0 or 1 value, rarely more
    let mut results = vec![ComponentVal::Bool(false); 4]; // Allocate for up to 4 results

    // Call the component function (synchronous)
    // Per DeepWiki: Trap handling - distinguish between traps and host errors
    let call_result = func.call(&mut store, &params, &mut results);

    if let Err(e) = call_result {
        // Check if this is a Wasm trap or a host error (per DeepWiki error handling)
        if e.downcast_ref::<wasmtime::Trap>().is_some() {
            // This is a WebAssembly trap (e.g., unreachable, stack overflow, OOB)
            return Err(format!("WebAssembly trap during execution: {}", e));
        } else {
            // This is a host-defined error
            return Err(format!("Function execution failed: {}", e));
        }
    }

    // Post-return cleanup (required for Component Model per DeepWiki)
    // This deallocates resources like returned strings within the Wasm instance
    func.post_return(&mut store)
        .map_err(|e| format!("Post-return cleanup failed: {}", e))?;

    // Convert Component Model results to JSON
    let output_json = if results.len() == 1 {
        component_val_to_json(&results[0])
    } else if results.len() > 1 {
        serde_json::Value::Array(results.iter().map(component_val_to_json).collect())
    } else {
        serde_json::Value::Null
    };

    // Get actual memory consumed from the store's ResourceLimiter
    let memory_used = store.data().memory_consumed;

    let execution_time_ms = start.elapsed().as_millis() as u64;
    let duration = start.elapsed();

    // Estimate bytes processed (use memory size as proxy)
    let bytes_processed = memory_used;

    // Record metrics
    {
        let mut metrics = METRICS.lock().unwrap_or_else(|poisoned| {
            eprintln!("METRICS mutex was poisoned, recovering...");
            poisoned.into_inner()
        });
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
        .iter()
        .map(|(id, _instance_pre)| WasmModule {
            id: id.clone(),
            name: id.clone(),
            loaded: true,
            memory_usage: 0, // Memory is tracked per-execution, not stored
        })
        .collect();

    Ok(module_list)
}

#[tauri::command]
pub async fn get_wasm_memory_usage(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
) -> Result<u64, String> {
    // Ensure runtime is initialized
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;

    // Since we create Store per-execution and don't store them,
    // we return the peak memory usage from metrics instead
    let metrics = METRICS.lock().unwrap_or_else(|poisoned| {
        eprintln!("METRICS mutex was poisoned, recovering...");
        poisoned.into_inner()
    });

    let total_memory: u64 = metrics.values()
        .map(|tracker| tracker.get_metrics().memory_used)
        .sum();

    Ok(total_memory)
}

#[tauri::command]
pub async fn get_wasm_metrics(module_id: String) -> Result<WasmMetrics, String> {
    let metrics = METRICS.lock().unwrap_or_else(|poisoned| {
        eprintln!("METRICS mutex was poisoned, recovering...");
        poisoned.into_inner()
    });

    metrics.get(&module_id)
        .map(|tracker| tracker.get_metrics())
        .ok_or_else(|| format!("No metrics found for module: {}", module_id))
}

#[tauri::command]
pub async fn get_all_wasm_metrics() -> Result<HashMap<String, WasmMetrics>, String> {
    let metrics = METRICS.lock().unwrap_or_else(|poisoned| {
        eprintln!("METRICS mutex was poisoned, recovering...");
        poisoned.into_inner()
    });

    Ok(metrics.iter()
        .map(|(module_id, tracker)| (module_id.clone(), tracker.get_metrics()))
        .collect())
}

#[tauri::command]
pub async fn reset_wasm_metrics(module_id: String) -> Result<String, String> {
    let mut metrics = METRICS.lock().unwrap_or_else(|poisoned| {
        eprintln!("METRICS mutex was poisoned, recovering...");
        poisoned.into_inner()
    });

    if metrics.remove(&module_id).is_some() {
        Ok(format!("Metrics reset for module: {}", module_id))
    } else {
        Err(format!("No metrics found for module: {}", module_id))
    }
}

#[tauri::command]
pub async fn reset_all_wasm_metrics() -> Result<String, String> {
    let mut metrics = METRICS.lock().unwrap_or_else(|poisoned| {
        eprintln!("METRICS mutex was poisoned, recovering...");
        poisoned.into_inner()
    });
    let count = metrics.len();
    metrics.clear();
    Ok(format!("Reset metrics for {} modules", count))
}

// ============================================================================
// Session-based WASM execution for stateful/resource-based components
// ============================================================================

/// Create a new WASM session for a module
/// Sessions allow resources to persist across multiple function calls
#[tauri::command]
pub async fn create_wasm_session(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_id: String,
) -> Result<SessionInfo, String> {
    let runtime_guard = runtime.lock().map_err(|e| e.to_string())?;
    let runtime_ref = runtime_guard
        .as_ref()
        .ok_or("WASM runtime not initialized")?;

    // Get the InstancePre for the module
    let modules = runtime_ref.modules.lock().map_err(|e| e.to_string())?;
    let instance_pre = modules
        .get(&module_id)
        .ok_or(format!("Module '{}' not found. Load it first.", module_id))?
        .clone();
    drop(modules);

    // Create a new Store for this session
    let mut store = Store::new(&runtime_ref.engine, WasmStore::new());
    store.limiter(|state| &mut state.limiter);

    // CRITICAL: Set fuel limit for session-based execution
    store.set_fuel(DEFAULT_FUEL_UNITS)
        .map_err(|e| format!("Failed to set fuel limit: {}", e))?;

    // Instantiate the component
    let instance = instance_pre.instantiate(&mut store)
        .map_err(|e| format!("Failed to instantiate component: {}", e))?;

    // Create session
    let session_id = format!("session-{}", Uuid::new_v4());
    let created_at = Utc::now();

    let session = WasmSession {
        session_id: session_id.clone(),
        module_id: module_id.clone(),
        store,
        instance,
        resource_handles: HashMap::new(),
        created_at,
    };

    // Store session
    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
    sessions.insert(session_id.clone(), session);

    Ok(SessionInfo {
        session_id,
        module_id,
        created_at: created_at.to_rfc3339(),
    })
}

/// Execute a function within an existing session
/// This preserves resources across calls - returned resources can be passed to subsequent calls
#[tauri::command]
pub async fn execute_session_function(
    session_id: String,
    function_name: String,
    args: Vec<serde_json::Value>,
) -> Result<WasmExecutionResult, String> {
    let start = std::time::Instant::now();

    // Get mutable access to the session
    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&session_id)
        .ok_or(format!("Session '{}' not found", session_id))?;

    // Check session age and reject if too old (security: prevent resource exhaustion)
    let age = Utc::now().signed_duration_since(session.created_at);
    if age.num_seconds() > SESSION_TTL_SECS {
        // Remove the expired session
        let expired_id = session_id.clone();
        drop(sessions);
        let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
        sessions.remove(&expired_id);
        return Err(format!("Session '{}' has expired (max age: {} minutes)", expired_id, SESSION_TTL_SECS / 60));
    }

    // CRITICAL: Refill fuel before each execution (sessions reuse the same store)
    session.store.set_fuel(DEFAULT_FUEL_UNITS)
        .map_err(|e| format!("Failed to set fuel limit: {}", e))?;

    // Get the function from the instance
    let func = session.instance.get_func(&mut session.store, &function_name)
        .or_else(|| {
            // Try common interface patterns for our modules
            for interface in ["hash", "hmac", "aes", "rsa", "utils", "ecdsa",
                            "analyzer", "pattern-matcher", "deobfuscator", "disassembler",
                            "detector", "validator", "parser", "extractor",
                            "network", "sandbox"] {
                let qualified_name = format!("{}#{}", interface, function_name);
                if let Some(f) = session.instance.get_func(&mut session.store, &qualified_name) {
                    return Some(f);
                }
            }
            None
        })
        .ok_or(format!("Function '{}' not found in component exports", function_name))?;

    // Convert JSON args to Component Model Val types (with session for resource lookups)
    let mut params: Vec<ComponentVal> = Vec::new();
    for (i, json_arg) in args.iter().enumerate() {
        let param = json_to_component_val_with_session(json_arg, i, session)?;
        params.push(param);
    }

    // Prepare results buffer
    let mut results = vec![ComponentVal::Bool(false); 4];

    // Call the component function
    let call_result = func.call(&mut session.store, &params, &mut results);

    if let Err(e) = call_result {
        if e.downcast_ref::<wasmtime::Trap>().is_some() {
            return Err(format!("WebAssembly trap during execution: {}", e));
        } else {
            return Err(format!("Function execution failed: {}", e));
        }
    }

    // Post-return cleanup
    func.post_return(&mut session.store)
        .map_err(|e| format!("Post-return cleanup failed: {}", e))?;

    // Convert results to JSON (with session for resource storage)
    let output_json = if results.len() == 1 {
        component_val_to_json_with_session(results.remove(0), session)
    } else if results.len() > 1 {
        serde_json::Value::Array(
            results.into_iter()
                .map(|v| component_val_to_json_with_session(v, session))
                .collect()
        )
    } else {
        serde_json::Value::Null
    };

    let memory_used = session.store.data().memory_consumed;
    let execution_time_ms = start.elapsed().as_millis() as u64;
    let duration = start.elapsed();

    // Record metrics
    {
        let mut metrics = METRICS.lock().unwrap_or_else(|poisoned| {
            eprintln!("METRICS mutex was poisoned, recovering...");
            poisoned.into_inner()
        });
        let tracker = metrics.entry(session.module_id.clone())
            .or_insert_with(|| MetricsTracker::new(session.module_id.clone()));
        tracker.record_execution(duration, memory_used, memory_used, true);
    }

    Ok(WasmExecutionResult {
        success: true,
        output: Some(output_json.to_string()),
        error: None,
        execution_time_ms,
        memory_used,
    })
}

/// Destroy a WASM session, cleaning up all resources
#[tauri::command]
pub async fn destroy_wasm_session(session_id: String) -> Result<String, String> {
    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;

    if sessions.remove(&session_id).is_some() {
        Ok(format!("Session '{}' destroyed successfully", session_id))
    } else {
        Err(format!("Session '{}' not found", session_id))
    }
}

/// List all active WASM sessions
#[tauri::command]
pub async fn list_wasm_sessions() -> Result<Vec<SessionInfo>, String> {
    let sessions = SESSIONS.lock().map_err(|e| e.to_string())?;

    Ok(sessions.values().map(|s| SessionInfo {
        session_id: s.session_id.clone(),
        module_id: s.module_id.clone(),
        created_at: s.created_at.to_rfc3339(),
    }).collect())
}

/// Get info about a specific session including resource count
#[tauri::command]
pub async fn get_session_info(session_id: String) -> Result<serde_json::Value, String> {
    let sessions = SESSIONS.lock().map_err(|e| e.to_string())?;

    if let Some(session) = sessions.get(&session_id) {
        Ok(serde_json::json!({
            "session_id": session.session_id,
            "module_id": session.module_id,
            "created_at": session.created_at.to_rfc3339(),
            "resource_count": session.resource_handles.len(),
            "resource_handles": session.resource_handles.keys().collect::<Vec<_>>(),
        }))
    } else {
        Err(format!("Session '{}' not found", session_id))
    }
}

/// Clean up expired sessions (call periodically or on-demand)
/// Returns the number of sessions cleaned up
#[tauri::command]
pub async fn cleanup_expired_sessions() -> Result<u32, String> {
    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;
    let now = Utc::now();

    // Find expired sessions
    let expired_ids: Vec<String> = sessions
        .iter()
        .filter_map(|(id, session)| {
            let age = now.signed_duration_since(session.created_at);
            if age.num_seconds() > SESSION_TTL_SECS {
                Some(id.clone())
            } else {
                None
            }
        })
        .collect();

    let count = expired_ids.len() as u32;

    // Remove expired sessions
    for id in expired_ids {
        sessions.remove(&id);
    }

    Ok(count)
}

/// Drop a specific resource from a session
#[tauri::command]
pub async fn drop_session_resource(
    session_id: String,
    handle_id: String,
) -> Result<String, String> {
    let mut sessions = SESSIONS.lock().map_err(|e| e.to_string())?;

    if let Some(session) = sessions.get_mut(&session_id) {
        if let Some(resource) = session.remove_resource(&handle_id) {
            // Drop the resource - this will call resource_drop on the component
            if let Err(e) = resource.resource_drop(&mut session.store) {
                return Err(format!("Failed to drop resource: {}", e));
            }
            Ok(format!("Resource '{}' dropped successfully", handle_id))
        } else {
            Err(format!("Resource '{}' not found in session", handle_id))
        }
    } else {
        Err(format!("Session '{}' not found", session_id))
    }
}