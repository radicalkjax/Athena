use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionPolicy {
    pub resource_limits: ResourceLimits,
    pub security_policy: SecurityPolicy,
    pub monitoring: MonitoringPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceLimits {
    pub max_memory_bytes: usize,
    pub max_cpu_time_ms: u64,
    pub max_file_handles: usize,
    pub max_threads: usize,
    pub max_output_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPolicy {
    pub syscall_policy: SyscallPolicy,
    pub network_policy: NetworkPolicy,
    pub file_system_policy: FileSystemPolicy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringPolicy {
    pub trace_execution: bool,
    pub collect_metrics: bool,
    pub snapshot_interval_ms: Option<u64>,
    pub log_security_events: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyscallPolicy {
    AllowList(HashSet<String>),
    DenyList(HashSet<String>),
    DenyAll,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NetworkPolicy {
    Disabled,
    AllowList(HashSet<String>), // Allowed domains/IPs
    DenyList(HashSet<String>),  // Blocked domains/IPs
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileSystemPolicy {
    Disabled,
    ReadOnly(Vec<String>),     // Read-only paths
    ReadWrite(Vec<String>),    // Read-write paths
    Virtual,                   // Virtual file system only
}

impl Default for ExecutionPolicy {
    fn default() -> Self {
        ExecutionPolicy {
            resource_limits: ResourceLimits::default(),
            security_policy: SecurityPolicy::default(),
            monitoring: MonitoringPolicy::default(),
        }
    }
}

impl Default for ResourceLimits {
    fn default() -> Self {
        ResourceLimits {
            max_memory_bytes: 100 * 1024 * 1024,  // 100MB
            max_cpu_time_ms: 30000,               // 30 seconds
            max_file_handles: 10,
            max_threads: 1,
            max_output_size: 10 * 1024 * 1024,    // 10MB
        }
    }
}

impl Default for SecurityPolicy {
    fn default() -> Self {
        SecurityPolicy {
            syscall_policy: SyscallPolicy::DenyAll,
            network_policy: NetworkPolicy::Disabled,
            file_system_policy: FileSystemPolicy::Virtual,
        }
    }
}

impl Default for MonitoringPolicy {
    fn default() -> Self {
        MonitoringPolicy {
            trace_execution: false,
            collect_metrics: true,
            snapshot_interval_ms: None,
            log_security_events: true,
        }
    }
}

impl ExecutionPolicy {
    pub fn relaxed() -> Self {
        ExecutionPolicy {
            resource_limits: ResourceLimits {
                max_memory_bytes: 500 * 1024 * 1024,  // 500MB
                max_cpu_time_ms: 60000,               // 60 seconds
                max_file_handles: 50,
                max_threads: 4,
                max_output_size: 50 * 1024 * 1024,    // 50MB
            },
            security_policy: SecurityPolicy {
                syscall_policy: SyscallPolicy::DenyList(
                    vec!["fork", "exec", "kill", "ptrace", "mount"]
                        .iter()
                        .map(|s| s.to_string())
                        .collect()
                ),
                network_policy: NetworkPolicy::Disabled,
                file_system_policy: FileSystemPolicy::Virtual,
            },
            monitoring: MonitoringPolicy {
                trace_execution: false,
                collect_metrics: true,
                snapshot_interval_ms: Some(1000),
                log_security_events: true,
            },
        }
    }
    
    pub fn strict() -> Self {
        ExecutionPolicy {
            resource_limits: ResourceLimits {
                max_memory_bytes: 50 * 1024 * 1024,   // 50MB
                max_cpu_time_ms: 10000,               // 10 seconds
                max_file_handles: 5,
                max_threads: 1,
                max_output_size: 5 * 1024 * 1024,     // 5MB
            },
            security_policy: SecurityPolicy {
                syscall_policy: SyscallPolicy::DenyAll,
                network_policy: NetworkPolicy::Disabled,
                file_system_policy: FileSystemPolicy::Disabled,
            },
            monitoring: MonitoringPolicy {
                trace_execution: true,
                collect_metrics: true,
                snapshot_interval_ms: Some(500),
                log_security_events: true,
            },
        }
    }
    
    pub fn debug() -> Self {
        ExecutionPolicy {
            resource_limits: ResourceLimits {
                max_memory_bytes: 1024 * 1024 * 1024, // 1GB
                max_cpu_time_ms: 300000,              // 5 minutes
                max_file_handles: 100,
                max_threads: 8,
                max_output_size: 100 * 1024 * 1024,   // 100MB
            },
            security_policy: SecurityPolicy {
                // Security: Debug mode should still have restrictions
                syscall_policy: SyscallPolicy::AllowList({
                    let mut allowed = HashSet::new();
                    allowed.insert("read".to_string());
                    allowed.insert("write".to_string());
                    allowed.insert("open".to_string());
                    allowed.insert("close".to_string());
                    allowed.insert("stat".to_string());
                    allowed.insert("fstat".to_string());
                    allowed.insert("lseek".to_string());
                    allowed.insert("mmap".to_string());
                    allowed.insert("munmap".to_string());
                    allowed.insert("brk".to_string());
                    allowed.insert("getpid".to_string());
                    allowed.insert("gettimeofday".to_string());
                    allowed.insert("clock_gettime".to_string());
                    allowed
                }),
                network_policy: NetworkPolicy::Disabled,
                file_system_policy: FileSystemPolicy::Virtual,
            },
            monitoring: MonitoringPolicy {
                trace_execution: true,
                collect_metrics: true,
                snapshot_interval_ms: Some(100),
                log_security_events: true,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_default_policy() {
        let policy = ExecutionPolicy::default();
        assert_eq!(policy.resource_limits.max_memory_bytes, 100 * 1024 * 1024);
        assert_eq!(policy.resource_limits.max_cpu_time_ms, 30000);
        assert!(matches!(policy.security_policy.syscall_policy, SyscallPolicy::DenyAll));
    }
    
    #[test]
    fn test_strict_policy() {
        let policy = ExecutionPolicy::strict();
        assert_eq!(policy.resource_limits.max_memory_bytes, 50 * 1024 * 1024);
        assert_eq!(policy.resource_limits.max_cpu_time_ms, 10000);
        assert!(policy.monitoring.trace_execution);
    }
    
    #[test]
    fn test_relaxed_policy() {
        let policy = ExecutionPolicy::relaxed();
        assert_eq!(policy.resource_limits.max_memory_bytes, 500 * 1024 * 1024);
        assert!(matches!(policy.security_policy.syscall_policy, SyscallPolicy::DenyList(_)));
    }
}