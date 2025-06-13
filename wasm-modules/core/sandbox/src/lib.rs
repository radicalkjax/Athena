use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use anyhow::Result;
use thiserror::Error;

pub mod policy;
pub mod monitor;
pub mod instance;
pub mod executor;
pub mod pool;
pub mod metrics;

use policy::ExecutionPolicy;
use monitor::{ResourceMonitor, ResourceUsage};
use instance::{SandboxInstance, SandboxSnapshot};
use executor::SandboxExecutor;
use pool::{InstancePool, PoolConfig};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    
    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Error, Debug)]
pub enum SandboxError {
    #[error("Resource limit exceeded: {0}")]
    ResourceLimitExceeded(String),
    
    #[error("Security policy violation: {0}")]
    SecurityViolation(String),
    
    #[error("Execution timeout after {0:?}")]
    ExecutionTimeout(Duration),
    
    #[error("Instance not found: {0}")]
    InstanceNotFound(String),
    
    #[error("Invalid execution state: {0}")]
    InvalidState(String),
    
    #[error("Sandbox creation failed: {0}")]
    CreationFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub resource_usage: ResourceUsage,
    pub security_events: Vec<SecurityEvent>,
    pub execution_time_ms: u64,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub timestamp: u64,
    pub event_type: SecurityEventType,
    pub description: String,
    pub severity: SecuritySeverity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityEventType {
    SyscallBlocked,
    MemoryLimitReached,
    CpuLimitReached,
    NetworkAccessAttempt,
    FileAccessAttempt,
    SuspiciousBehavior,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecuritySeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[wasm_bindgen]
pub struct SandboxManager {
    instances: Arc<Mutex<HashMap<String, SandboxInstance>>>,
    default_policy: ExecutionPolicy,
    resource_monitor: Arc<Mutex<ResourceMonitor>>,
    next_instance_id: Arc<Mutex<u64>>,
}

#[wasm_bindgen]
impl SandboxManager {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<SandboxManager, JsValue> {
        console_log!("Initializing Sandbox Manager");
        
        let default_policy = ExecutionPolicy::default();
        let resource_monitor = ResourceMonitor::new();
        
        Ok(SandboxManager {
            instances: Arc::new(Mutex::new(HashMap::new())),
            default_policy,
            resource_monitor: Arc::new(Mutex::new(resource_monitor)),
            next_instance_id: Arc::new(Mutex::new(1)),
        })
    }
    
    pub fn create_instance(&mut self, policy_js: JsValue) -> Result<String, JsValue> {
        let policy = if policy_js.is_undefined() || policy_js.is_null() {
            self.default_policy.clone()
        } else {
            serde_wasm_bindgen::from_value(policy_js)
                .map_err(|e| JsValue::from_str(&format!("Invalid policy: {}", e)))?
        };
        
        let instance_id = format!("sandbox-{}", self.next_instance_id);
        self.next_instance_id += 1;
        
        console_log!("Creating sandbox instance: {}", instance_id);
        
        let instance = SandboxInstance::new(instance_id.clone(), policy)
            .map_err(|e| JsValue::from_str(&format!("Failed to create instance: {}", e)))?;
        
        self.instances.insert(instance_id.clone(), instance);
        
        Ok(instance_id)
    }
    
    pub async fn execute(&self, instance_id: &str, code: &[u8]) -> Result<JsValue, JsValue> {
        let instance = self.instances.get(instance_id)
            .ok_or_else(|| JsValue::from_str(&format!("Instance not found: {}", instance_id)))?;
        
        console_log!("Executing code in instance: {}", instance_id);
        
        let start_time = Instant::now();
        let executor = SandboxExecutor::new(instance);
        
        let result = executor.execute(code).await
            .map_err(|e| JsValue::from_str(&format!("Execution failed: {}", e)))?;
        
        let execution_time_ms = start_time.elapsed().as_millis() as u64;
        
        let execution_result = ExecutionResult {
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
            resource_usage: result.resource_usage,
            security_events: result.security_events,
            execution_time_ms,
            success: result.exit_code == 0,
        };
        
        serde_wasm_bindgen::to_value(&execution_result)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize result: {}", e)))
    }
    
    pub fn get_instance_status(&self, instance_id: &str) -> Result<JsValue, JsValue> {
        let instance = self.instances.get(instance_id)
            .ok_or_else(|| JsValue::from_str(&format!("Instance not found: {}", instance_id)))?;
        
        serde_wasm_bindgen::to_value(&instance.get_status())
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize status: {}", e)))
    }
    
    pub fn get_resource_usage(&self, instance_id: &str) -> Result<JsValue, JsValue> {
        let _instance = self.instances.get(instance_id)
            .ok_or_else(|| JsValue::from_str(&format!("Instance not found: {}", instance_id)))?;
        
        let usage = self.resource_monitor.get_usage(instance_id);
        
        serde_wasm_bindgen::to_value(&usage)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize usage: {}", e)))
    }
    
    pub fn terminate_instance(&mut self, instance_id: &str) -> Result<(), JsValue> {
        console_log!("Terminating instance: {}", instance_id);
        
        if let Some(mut instance) = self.instances.remove(instance_id) {
            instance.terminate()
                .map_err(|e| JsValue::from_str(&format!("Failed to terminate: {}", e)))?;
        }
        
        Ok(())
    }
    
    pub fn terminate_all(&mut self) -> Result<(), JsValue> {
        console_log!("Terminating all instances");
        
        let instance_ids: Vec<String> = self.instances.keys().cloned().collect();
        
        for id in instance_ids {
            self.terminate_instance(&id)?;
        }
        
        Ok(())
    }
    
    pub fn list_instances(&self) -> Result<JsValue, JsValue> {
        let instances: Vec<String> = self.instances.keys().cloned().collect();
        
        serde_wasm_bindgen::to_value(&instances)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize instances: {}", e)))
    }
    
    pub fn get_default_policy(&self) -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&self.default_policy)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize policy: {}", e)))
    }
    
    // Snapshot/restore functionality
    pub fn create_snapshot(&self, instance_id: &str) -> Result<JsValue, JsValue> {
        let instance = self.instances.get(instance_id)
            .ok_or_else(|| JsValue::from_str(&format!("Instance {} not found", instance_id)))?;
        
        let snapshot = instance.snapshot()
            .map_err(|e| JsValue::from_str(&format!("Failed to create snapshot: {}", e)))?;
        
        serde_wasm_bindgen::to_value(&snapshot)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize snapshot: {}", e)))
    }
    
    pub fn restore_snapshot(&mut self, instance_id: &str, snapshot_js: JsValue) -> Result<(), JsValue> {
        let instance = self.instances.get_mut(instance_id)
            .ok_or_else(|| JsValue::from_str(&format!("Instance {} not found", instance_id)))?;
        
        let snapshot: SandboxSnapshot = serde_wasm_bindgen::from_value(snapshot_js)
            .map_err(|e| JsValue::from_str(&format!("Invalid snapshot: {}", e)))?;
        
        instance.restore(snapshot)
            .map_err(|e| JsValue::from_str(&format!("Failed to restore snapshot: {}", e)))?;
        
        Ok(())
    }
    
    // Enhanced multi-instance support
    pub fn get_all_instances_status(&self) -> Result<JsValue, JsValue> {
        let mut statuses = HashMap::new();
        
        for (id, instance) in &self.instances {
            let status = instance.get_status();
            let usage = self.resource_monitor.get_usage(id);
            
            let instance_info = serde_json::json!({
                "id": id,
                "status": format!("{:?}", status),
                "resource_usage": usage,
                "created_at": instance.created_at,
            });
            
            statuses.insert(id.clone(), instance_info);
        }
        
        serde_wasm_bindgen::to_value(&statuses)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize statuses: {}", e)))
    }
    
    pub fn pause_instance(&mut self, instance_id: &str) -> Result<(), JsValue> {
        let instance = self.instances.get_mut(instance_id)
            .ok_or_else(|| JsValue::from_str(&format!("Instance {} not found", instance_id)))?;
        
        instance.pause()
            .map_err(|e| JsValue::from_str(&format!("Failed to pause instance: {}", e)))?;
        
        Ok(())
    }
    
    pub fn resume_instance(&mut self, instance_id: &str) -> Result<(), JsValue> {
        let instance = self.instances.get_mut(instance_id)
            .ok_or_else(|| JsValue::from_str(&format!("Instance {} not found", instance_id)))?;
        
        instance.resume()
            .map_err(|e| JsValue::from_str(&format!("Failed to resume instance: {}", e)))?;
        
        Ok(())
    }
}

// Quick execution API for one-off sandboxed execution
#[wasm_bindgen]
pub async fn sandbox_execute(code: &[u8], policy_js: JsValue) -> Result<JsValue, JsValue> {
    let mut manager = SandboxManager::new()?;
    let instance_id = manager.create_instance(policy_js)?;
    
    let result = manager.execute(&instance_id, code).await;
    
    // Always cleanup
    let _ = manager.terminate_instance(&instance_id);
    
    result
}

#[cfg(all(test, target_arch = "wasm32"))]
mod tests {
    use super::*;
    use wasm_bindgen_test::*;
    
    wasm_bindgen_test_configure!(run_in_browser);
    
    #[wasm_bindgen_test]
    fn test_sandbox_creation() {
        let manager = SandboxManager::new().unwrap();
        assert_eq!(manager.instances.len(), 0);
    }
    
    #[wasm_bindgen_test]
    fn test_default_policy() {
        let manager = SandboxManager::new().unwrap();
        let policy = manager.default_policy.clone();
        
        assert_eq!(policy.resource_limits.max_memory_bytes, 100 * 1024 * 1024); // 100MB
        assert_eq!(policy.resource_limits.max_cpu_time_ms, 30000); // 30s
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_policy_creation() {
        let policy = ExecutionPolicy::default();
        assert_eq!(policy.resource_limits.max_memory_bytes, 100 * 1024 * 1024); // 100MB
        assert_eq!(policy.resource_limits.max_cpu_time_ms, 30000); // 30s
    }
}