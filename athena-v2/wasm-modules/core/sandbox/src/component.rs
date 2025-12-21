// Component Model implementation for athena:sandbox

wit_bindgen::generate!({
    world: "sandbox-component",
    path: "wit",
});

use crate::policy::ExecutionPolicy;
use crate::monitor::ResourceMonitor;
use crate::instance::SandboxInstance;
use crate::{SecurityEventType, SecuritySeverity};
use std::cell::RefCell;
use std::collections::HashMap;

// ============================================================================
// Component Implementation
// ============================================================================

struct Component;

// ============================================================================
// Sandbox Manager Instance
// ============================================================================

struct SandboxManagerInstance {
    instances: HashMap<String, SandboxInstance>,
    default_policy: ExecutionPolicy,
    resource_monitor: ResourceMonitor,
    next_instance_id: u64,
}

impl SandboxManagerInstance {
    fn new() -> Self {
        Self {
            instances: HashMap::new(),
            default_policy: ExecutionPolicy::default(),
            resource_monitor: ResourceMonitor::new(),
            next_instance_id: 1,
        }
    }

    fn create_instance_internal(&mut self, _policy: Option<exports::athena::sandbox::sandbox::ExecutionPolicy>) -> std::result::Result<String, String> {
        // Use default policy (complex policy conversion omitted for simplicity)
        let policy = self.default_policy.clone();

        let instance_id = format!("sandbox-{}", self.next_instance_id);
        self.next_instance_id += 1;

        let instance = SandboxInstance::new(instance_id.clone(), policy)
            .map_err(|e| e.to_string())?;

        self.instances.insert(instance_id.clone(), instance);

        Ok(instance_id)
    }

    fn execute_internal(&self, instance_id: &str, code: &[u8]) -> std::result::Result<exports::athena::sandbox::sandbox::ExecutionResult, String> {
        let instance = self.instances.get(instance_id)
            .ok_or_else(|| format!("Instance not found: {}", instance_id))?;

        // Security: Validate code size
        const MAX_CODE_SIZE: usize = 10 * 1024 * 1024; // 10MB
        if code.len() > MAX_CODE_SIZE {
            return Err(format!("Code too large: {} bytes", code.len()));
        }

        // Execute with real monitoring
        use crate::executor::SandboxExecutor;
        let mut executor = SandboxExecutor::new(instance);

        // Execute synchronously (blocking async)
        let result = futures::executor::block_on(executor.execute(code))
            .map_err(|e| e.to_string())?;

        Ok(exports::athena::sandbox::sandbox::ExecutionResult {
            stdout: result.stdout,
            stderr: result.stderr,
            exit_code: result.exit_code,
            resource_usage: exports::athena::sandbox::sandbox::ResourceUsage {
                memory_bytes: result.resource_usage.memory_bytes as u64,
                cpu_time_ms: result.resource_usage.cpu_time_ms,
                syscalls_count: result.resource_usage.file_handles as u32,
            },
            security_events: result.security_events.into_iter().map(|e| {
                exports::athena::sandbox::sandbox::SecurityEvent {
                    timestamp: e.timestamp,
                    event_type: convert_event_type(e.event_type),
                    description: e.description,
                    severity: convert_severity(e.severity),
                }
            }).collect(),
            execution_time_ms: result.execution_time_ms,
            success: result.success,
        })
    }

    fn terminate_instance_internal(&mut self, instance_id: &str) -> std::result::Result<(), String> {
        if let Some(mut instance) = self.instances.remove(instance_id) {
            instance.terminate()
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    fn get_instance_stats_internal(&self, instance_id: &str) -> std::result::Result<exports::athena::sandbox::sandbox::ResourceUsage, String> {
        let _instance = self.instances.get(instance_id)
            .ok_or_else(|| format!("Instance not found: {}", instance_id))?;

        let usage = self.resource_monitor.get_usage(instance_id);

        Ok(exports::athena::sandbox::sandbox::ResourceUsage {
            memory_bytes: usage.memory_bytes as u64,
            cpu_time_ms: usage.cpu_time_ms,
            syscalls_count: 0, // Not tracked in ResourceUsage, using default
        })
    }

    fn list_instances_internal(&self) -> Vec<String> {
        self.instances.keys().cloned().collect()
    }
}

// ============================================================================
// Sandbox Interface Implementation
// ============================================================================

impl exports::athena::sandbox::sandbox::Guest for Component {
    type SandboxManager = SandboxManagerResource;

    fn new() -> exports::athena::sandbox::sandbox::SandboxManager {
        exports::athena::sandbox::sandbox::SandboxManager::new(
            SandboxManagerResource::new(SandboxManagerInstance::new())
        )
    }

    fn create_instance(handle: exports::athena::sandbox::sandbox::SandboxManager, policy: Option<exports::athena::sandbox::sandbox::ExecutionPolicy>) -> std::result::Result<String, String> {
        handle.get::<SandboxManagerResource>().instance.borrow_mut().create_instance_internal(policy)
    }

    fn execute(handle: exports::athena::sandbox::sandbox::SandboxManager, instance_id: String, code: Vec<u8>) -> std::result::Result<exports::athena::sandbox::sandbox::ExecutionResult, String> {
        handle.get::<SandboxManagerResource>().instance.borrow().execute_internal(&instance_id, &code)
    }

    fn terminate_instance(handle: exports::athena::sandbox::sandbox::SandboxManager, instance_id: String) -> std::result::Result<(), String> {
        handle.get::<SandboxManagerResource>().instance.borrow_mut().terminate_instance_internal(&instance_id)
    }

    fn get_instance_stats(handle: exports::athena::sandbox::sandbox::SandboxManager, instance_id: String) -> std::result::Result<exports::athena::sandbox::sandbox::ResourceUsage, String> {
        handle.get::<SandboxManagerResource>().instance.borrow().get_instance_stats_internal(&instance_id)
    }
}

// ============================================================================
// Sandbox Manager Resource Implementation
// ============================================================================

struct SandboxManagerResource {
    instance: RefCell<SandboxManagerInstance>,
}

impl SandboxManagerResource {
    fn new(instance: SandboxManagerInstance) -> Self {
        Self {
            instance: RefCell::new(instance),
        }
    }
}

impl exports::athena::sandbox::sandbox::GuestSandboxManager for SandboxManagerResource {
    fn new() -> Self {
        Self::new(SandboxManagerInstance::new())
    }

    fn create_instance(&self, policy: Option<exports::athena::sandbox::sandbox::ExecutionPolicy>) -> std::result::Result<String, String> {
        self.instance.borrow_mut().create_instance_internal(policy)
    }

    fn execute(&self, instance_id: String, code: Vec<u8>) -> std::result::Result<exports::athena::sandbox::sandbox::ExecutionResult, String> {
        self.instance.borrow().execute_internal(&instance_id, &code)
    }

    fn terminate_instance(&self, instance_id: String) -> std::result::Result<(), String> {
        self.instance.borrow_mut().terminate_instance_internal(&instance_id)
    }

    fn get_instance_stats(&self, instance_id: String) -> std::result::Result<exports::athena::sandbox::sandbox::ResourceUsage, String> {
        self.instance.borrow().get_instance_stats_internal(&instance_id)
    }

    fn list_instances(&self) -> Vec<String> {
        self.instance.borrow().list_instances_internal()
    }
}

// ============================================================================
// Helper Functions - Conversion
// ============================================================================

fn convert_event_type(event_type: SecurityEventType) -> exports::athena::sandbox::sandbox::SecurityEventType {
    use exports::athena::sandbox::sandbox::SecurityEventType as WitType;
    match event_type {
        SecurityEventType::SyscallBlocked => WitType::SyscallBlocked,
        SecurityEventType::MemoryLimitReached => WitType::MemoryLimitReached,
        SecurityEventType::CpuLimitReached => WitType::CpuLimitReached,
        SecurityEventType::NetworkAccessAttempt => WitType::NetworkAccessAttempt,
        SecurityEventType::FileAccessAttempt => WitType::FileAccessAttempt,
        SecurityEventType::SuspiciousBehavior => WitType::SuspiciousBehavior,
    }
}

fn convert_severity(severity: SecuritySeverity) -> exports::athena::sandbox::sandbox::SecuritySeverity {
    use exports::athena::sandbox::sandbox::SecuritySeverity as WitSeverity;
    match severity {
        SecuritySeverity::Low => WitSeverity::Low,
        SecuritySeverity::Medium => WitSeverity::Medium,
        SecuritySeverity::High => WitSeverity::High,
        SecuritySeverity::Critical => WitSeverity::Critical,
    }
}

// ============================================================================
// Export Component Implementations
// ============================================================================

export!(Component);
