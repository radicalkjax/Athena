//! # Athena Sandbox - WASM-based Malware Analysis Sandbox
//!
//! This module provides a secure sandbox environment for analyzing potentially malicious code.
//! Since it runs as a WASM Component, true OS-level isolation is handled by the Wasmtime runtime.
//! This sandbox focuses on:
//!
//! - **Resource Monitoring**: Track CPU time, memory usage, and execution metrics
//! - **Behavior Analysis**: Pattern-based detection of suspicious operations
//! - **Virtual Filesystem**: Simulated file system for safe file operations
//! - **Syscall Tracking**: Monitor and filter system calls
//! - **API Call Monitoring**: Track Windows API calls in analyzed binaries
//! - **Security Event Logging**: Detailed logging of security-relevant operations
//!
//! ## Architecture
//!
//! The sandbox operates at multiple layers:
//!
//! 1. **Wasmtime Isolation**: The WASM runtime provides memory safety and isolation
//! 2. **Resource Limits**: Configurable limits on memory, CPU time, and output
//! 3. **Policy Enforcement**: Syscall filtering and network/filesystem policies
//! 4. **Behavioral Analysis**: Pattern matching for malware indicators
//!
//! ## Usage
//!
//! ```rust,no_run
//! use athena_sandbox::{SandboxInstance, ExecutionPolicy};
//! use athena_sandbox::executor::SandboxExecutor;
//!
//! # async fn example() -> anyhow::Result<()> {
//! // Create instance with default policy
//! let mut instance = SandboxInstance::new(
//!     "analysis-1".to_string(),
//!     ExecutionPolicy::default()
//! )?;
//!
//! instance.initialize()?;
//! instance.start()?;
//!
//! // Execute code with monitoring
//! let mut executor = SandboxExecutor::new(&instance);
//! let code = b"print('hello')";
//! let result = executor.execute(code).await?;
//!
//! println!("Output: {}", result.stdout);
//! println!("Security events: {:?}", result.security_events);
//! # Ok(())
//! # }
//! ```

// Component Model implementation
mod component;

use serde::{Deserialize, Serialize};
use std::time::Duration;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::instance::SandboxInstance;
    use crate::policy::ExecutionPolicy;
    use crate::monitor::ResourceUsage;

    #[test]
    fn test_sandbox_instance_creation() {
        let policy = ExecutionPolicy::default();
        let result = SandboxInstance::new("test-instance".to_string(), policy);

        assert!(result.is_ok());
        let instance = result.unwrap();
        assert_eq!(instance.id, "test-instance");
    }

    #[test]
    fn test_execution_result_serialization() {
        let result = ExecutionResult {
            stdout: "Test output".to_string(),
            stderr: String::new(),
            exit_code: 0,
            resource_usage: ResourceUsage {
                memory_bytes: 1024,
                cpu_time_ms: 100,
                file_handles: 2,
                threads: 1,
                output_size: 128,
                peak_memory_bytes: 2048,
            },
            security_events: vec![],
            execution_time_ms: 150,
            success: true,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("Test output"));

        let deserialized: ExecutionResult = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.exit_code, 0);
        assert!(deserialized.success);
    }

    #[test]
    fn test_security_event_types() {
        let events = vec![
            SecurityEventType::SyscallBlocked,
            SecurityEventType::MemoryLimitReached,
            SecurityEventType::CpuLimitReached,
            SecurityEventType::NetworkAccessAttempt,
            SecurityEventType::FileAccessAttempt,
            SecurityEventType::SuspiciousBehavior,
        ];

        // All event types should be serializable
        for event_type in events {
            let json = serde_json::to_string(&event_type).unwrap();
            assert!(!json.is_empty());
        }
    }

    #[test]
    fn test_security_severity_levels() {
        let severities = vec![
            SecuritySeverity::Low,
            SecuritySeverity::Medium,
            SecuritySeverity::High,
            SecuritySeverity::Critical,
        ];

        for severity in severities {
            let json = serde_json::to_string(&severity).unwrap();
            assert!(!json.is_empty());
        }
    }

    #[test]
    fn test_security_event_creation() {
        let event = SecurityEvent {
            timestamp: 1234567890,
            event_type: SecurityEventType::NetworkAccessAttempt,
            description: "Attempted connection to malicious domain".to_string(),
            severity: SecuritySeverity::Critical,
        };

        assert_eq!(event.timestamp, 1234567890);
        assert!(matches!(event.event_type, SecurityEventType::NetworkAccessAttempt));
        assert!(matches!(event.severity, SecuritySeverity::Critical));
        assert!(event.description.contains("malicious"));
    }

    #[test]
    fn test_resource_usage_tracking() {
        let usage = ResourceUsage {
            memory_bytes: 1024 * 1024, // 1MB
            cpu_time_ms: 500,
            file_handles: 5,
            threads: 2,
            output_size: 4096,
            peak_memory_bytes: 2 * 1024 * 1024, // 2MB
        };

        assert_eq!(usage.memory_bytes, 1024 * 1024);
        assert!(usage.peak_memory_bytes > usage.memory_bytes);
        assert_eq!(usage.cpu_time_ms, 500);
        assert_eq!(usage.threads, 2);
    }

    #[test]
    fn test_sandbox_error_types() {
        use std::time::Duration;

        let errors = vec![
            SandboxError::ResourceLimitExceeded("memory".to_string()),
            SandboxError::SecurityViolation("blocked syscall".to_string()),
            SandboxError::ExecutionTimeout(Duration::from_secs(30)),
            SandboxError::InstanceNotFound("test-123".to_string()),
            SandboxError::InvalidState("not initialized".to_string()),
            SandboxError::CreationFailed("insufficient resources".to_string()),
        ];

        for error in errors {
            let error_msg = format!("{}", error);
            assert!(!error_msg.is_empty());
        }
    }
}
