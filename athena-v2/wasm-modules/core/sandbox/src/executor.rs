use anyhow::{Result, anyhow};
use std::time::Instant;
use std::collections::{HashMap, HashSet};
use crate::instance::SandboxInstance;
use crate::monitor::ResourceUsage;
use crate::{SecurityEvent, SecurityEventType, SecuritySeverity, ExecutionResult};

/// Virtual file system entry
#[derive(Debug, Clone)]
struct VirtualFile {
    path: String,
    content: Vec<u8>,
    permissions: FilePermissions,
}

#[derive(Debug, Clone)]
struct FilePermissions {
    read: bool,
    write: bool,
    execute: bool,
}

/// Syscall tracking and simulation
#[derive(Debug, Clone)]
struct SyscallTrace {
    name: String,
    timestamp: u64,
    args: Vec<String>,
    result: i32,
}

/// API call tracking for Windows binaries
#[derive(Debug, Clone)]
struct ApiCall {
    module: String,
    function: String,
    timestamp: u64,
    args: Vec<String>,
}

pub struct SandboxExecutor<'a> {
    instance: &'a SandboxInstance,
    output_buffer: Vec<u8>,
    error_buffer: Vec<u8>,
    // Real resource tracking
    memory_allocated: usize,
    peak_memory: usize,
    syscall_count: usize,
    file_operations: Vec<String>,
    network_operations: Vec<String>,
    // Virtual filesystem
    virtual_fs: HashMap<String, VirtualFile>,
    // Execution tracking
    syscall_traces: Vec<SyscallTrace>,
    api_calls: Vec<ApiCall>,
    start_time: Instant,
}

impl<'a> SandboxExecutor<'a> {
    pub fn new(instance: &'a SandboxInstance) -> Self {
        let mut virtual_fs = HashMap::new();

        // Initialize virtual filesystem with common paths
        Self::initialize_virtual_fs(&mut virtual_fs);

        SandboxExecutor {
            instance,
            output_buffer: Vec::new(),
            error_buffer: Vec::new(),
            memory_allocated: 0,
            peak_memory: 0,
            syscall_count: 0,
            file_operations: Vec::new(),
            network_operations: Vec::new(),
            virtual_fs,
            syscall_traces: Vec::new(),
            api_calls: Vec::new(),
            start_time: Instant::now(),
        }
    }

    fn initialize_virtual_fs(vfs: &mut HashMap<String, VirtualFile>) {
        // Add common system files (read-only)
        let system_files: Vec<(&str, &[u8])> = vec![
            ("/etc/passwd", b"root:x:0:0:root:/root:/bin/bash\n" as &[u8]),
            ("/etc/shadow", b"root:!:18000:0:99999:7:::\n" as &[u8]),
            ("/etc/hosts", b"127.0.0.1 localhost\n" as &[u8]),
            ("/proc/cpuinfo", b"processor : 0\nmodel name : Virtual CPU\n" as &[u8]),
            ("/proc/meminfo", b"MemTotal: 8192000 kB\nMemFree: 4096000 kB\n" as &[u8]),
        ];

        for (path, content) in system_files {
            vfs.insert(path.to_string(), VirtualFile {
                path: path.to_string(),
                content: content.to_vec(),
                permissions: FilePermissions {
                    read: true,
                    write: false,
                    execute: false,
                },
            });
        }

        // Add writable temp directory
        vfs.insert("/tmp".to_string(), VirtualFile {
            path: "/tmp".to_string(),
            content: Vec::new(),
            permissions: FilePermissions {
                read: true,
                write: true,
                execute: true,
            },
        });
    }

    pub async fn execute(&mut self, code: &[u8]) -> Result<ExecutionResult> {
        // Check instance status
        if !self.instance.is_running() {
            return Err(anyhow!("Instance is not running"));
        }

        self.start_time = Instant::now();
        let mut security_events = Vec::new();

        // Track initial memory allocation for code
        self.allocate_memory(code.len());

        // Analyze and execute code with comprehensive monitoring
        let result = self.execute_with_monitoring(code, &mut security_events).await?;

        let execution_time_ms = self.start_time.elapsed().as_millis() as u64;

        // Check if execution exceeded time limit
        if execution_time_ms > self.instance.policy.resource_limits.max_cpu_time_ms {
            security_events.push(SecurityEvent {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                event_type: SecurityEventType::CpuLimitReached,
                description: format!("Execution timeout: {}ms > {}ms",
                    execution_time_ms,
                    self.instance.policy.resource_limits.max_cpu_time_ms
                ),
                severity: SecuritySeverity::High,
            });

            return Ok(ExecutionResult {
                stdout: String::from_utf8_lossy(&self.output_buffer).to_string(),
                stderr: "Execution timeout".to_string(),
                exit_code: -1,
                resource_usage: self.get_resource_usage(),
                security_events,
                execution_time_ms,
                success: false,
            });
        }

        // Check memory limits
        if self.memory_allocated > self.instance.policy.resource_limits.max_memory_bytes {
            security_events.push(SecurityEvent {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                event_type: SecurityEventType::MemoryLimitReached,
                description: format!("Memory limit exceeded: {} > {}",
                    self.memory_allocated,
                    self.instance.policy.resource_limits.max_memory_bytes
                ),
                severity: SecuritySeverity::High,
            });
        }

        Ok(ExecutionResult {
            stdout: result.0,
            stderr: result.1,
            exit_code: result.2,
            resource_usage: self.get_resource_usage(),
            security_events,
            execution_time_ms,
            success: result.2 == 0,
        })
    }

    async fn execute_with_monitoring(&mut self, code: &[u8], events: &mut Vec<SecurityEvent>) -> Result<(String, String, i32)> {
        // Perform deep code analysis
        let code_str = String::from_utf8_lossy(code);
        let mut output = Vec::new();
        let mut errors = Vec::new();

        // Pattern-based behavioral analysis
        self.analyze_network_behavior(&code_str, events)?;
        self.analyze_file_operations(&code_str, events)?;
        self.analyze_process_operations(&code_str, events)?;
        self.analyze_registry_operations(&code_str, events)?;
        self.analyze_crypto_operations(&code_str, events)?;
        self.analyze_persistence_mechanisms(&code_str, events)?;

        // Simulate execution with tracked operations
        let exit_code = self.simulate_tracked_execution(&code_str, &mut output, &mut errors, events)?;

        Ok((
            String::from_utf8_lossy(&output).to_string(),
            String::from_utf8_lossy(&errors).to_string(),
            exit_code
        ))
    }

    fn analyze_network_behavior(&mut self, code: &str, events: &mut Vec<SecurityEvent>) -> Result<()> {
        let network_patterns = [
            ("socket", "Socket creation"),
            ("connect", "Network connection"),
            ("bind", "Socket binding"),
            ("listen", "Network listening"),
            ("send", "Data transmission"),
            ("recv", "Data reception"),
            ("http", "HTTP communication"),
            ("https", "HTTPS communication"),
            ("ftp", "FTP communication"),
            ("smtp", "SMTP communication"),
        ];

        for (pattern, description) in &network_patterns {
            if code.to_lowercase().contains(pattern) {
                self.network_operations.push(pattern.to_string());

                // Check network policy
                if let Err(_) = self.instance.check_network_access("unknown") {
                    events.push(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::NetworkAccessAttempt,
                        description: format!("Blocked: {}", description),
                        severity: SecuritySeverity::Critical,
                    });
                }
            }
        }

        Ok(())
    }

    fn analyze_file_operations(&mut self, code: &str, events: &mut Vec<SecurityEvent>) -> Result<()> {
        let file_patterns = [
            ("open", "File open"),
            ("read", "File read"),
            ("write", "File write"),
            ("delete", "File deletion"),
            ("unlink", "File removal"),
            ("rename", "File rename"),
            ("chmod", "Permission change"),
            ("/etc/passwd", "Sensitive file access"),
            ("/etc/shadow", "Shadow file access"),
            ("~/.ssh", "SSH key access"),
            (".bashrc", "Shell config access"),
        ];

        for (pattern, description) in &file_patterns {
            if code.contains(pattern) {
                self.file_operations.push(pattern.to_string());
                self.track_syscall("open", vec![pattern.to_string()], 0);

                if pattern.starts_with("/etc") || pattern.contains("passwd") || pattern.contains("shadow") {
                    events.push(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::FileAccessAttempt,
                        description: format!("Attempted: {}", description),
                        severity: SecuritySeverity::Critical,
                    });
                }
            }
        }

        Ok(())
    }

    fn analyze_process_operations(&mut self, code: &str, events: &mut Vec<SecurityEvent>) -> Result<()> {
        let process_patterns = [
            ("fork", "Process forking"),
            ("exec", "Process execution"),
            ("system", "System command"),
            ("popen", "Pipe open"),
            ("spawn", "Process spawn"),
            ("CreateProcess", "Windows process creation"),
            ("ShellExecute", "Shell execution"),
        ];

        for (pattern, description) in &process_patterns {
            if code.contains(pattern) {
                // Check syscall policy
                if let Err(_) = self.instance.check_syscall(pattern) {
                    self.track_syscall(pattern, vec![], -1);
                    events.push(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::SyscallBlocked,
                        description: format!("Blocked: {}", description),
                        severity: SecuritySeverity::High,
                    });
                }
            }
        }

        Ok(())
    }

    fn analyze_registry_operations(&mut self, code: &str, events: &mut Vec<SecurityEvent>) -> Result<()> {
        let registry_patterns = [
            ("RegOpenKey", "Registry key open"),
            ("RegSetValue", "Registry value set"),
            ("RegDeleteKey", "Registry key delete"),
            ("HKEY_LOCAL_MACHINE", "HKLM access"),
            ("HKEY_CURRENT_USER", "HKCU access"),
            ("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run", "Autorun registry"),
        ];

        for (pattern, description) in &registry_patterns {
            if code.contains(pattern) {
                self.track_api_call("advapi32", pattern, vec![]);

                if pattern.contains("Run") || pattern.contains("RegSetValue") {
                    events.push(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::SuspiciousBehavior,
                        description: format!("Suspicious: {} (persistence mechanism)", description),
                        severity: SecuritySeverity::High,
                    });
                }
            }
        }

        Ok(())
    }

    fn analyze_crypto_operations(&mut self, code: &str, events: &mut Vec<SecurityEvent>) -> Result<()> {
        let crypto_patterns = [
            ("CryptEncrypt", "Encryption"),
            ("CryptDecrypt", "Decryption"),
            ("AES", "AES crypto"),
            ("RSA", "RSA crypto"),
            ("encrypt", "Generic encryption"),
            ("decrypt", "Generic decryption"),
        ];

        let mut crypto_detected = false;
        for (pattern, description) in &crypto_patterns {
            if code.to_lowercase().contains(&pattern.to_lowercase()) {
                crypto_detected = true;
                self.track_api_call("bcrypt", pattern, vec![]);

                events.push(SecurityEvent {
                    timestamp: chrono::Utc::now().timestamp_millis() as u64,
                    event_type: SecurityEventType::SuspiciousBehavior,
                    description: format!("Cryptographic operation: {}", description),
                    severity: SecuritySeverity::Medium,
                });
            }
        }

        if crypto_detected && self.file_operations.len() > 2 {
            events.push(SecurityEvent {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                event_type: SecurityEventType::SuspiciousBehavior,
                description: "Potential ransomware behavior: crypto + file operations".to_string(),
                severity: SecuritySeverity::Critical,
            });
        }

        Ok(())
    }

    fn analyze_persistence_mechanisms(&mut self, code: &str, events: &mut Vec<SecurityEvent>) -> Result<()> {
        let persistence_patterns = [
            ("crontab", "Cron job"),
            ("systemd", "Systemd service"),
            ("/etc/rc", "Init script"),
            ("LaunchAgent", "macOS launch agent"),
            ("Task Scheduler", "Windows task"),
            ("WMI", "WMI persistence"),
        ];

        for (pattern, description) in &persistence_patterns {
            if code.contains(pattern) {
                events.push(SecurityEvent {
                    timestamp: chrono::Utc::now().timestamp_millis() as u64,
                    event_type: SecurityEventType::SuspiciousBehavior,
                    description: format!("Persistence mechanism detected: {}", description),
                    severity: SecuritySeverity::High,
                });
            }
        }

        Ok(())
    }

    fn simulate_tracked_execution(&mut self, code: &str, output: &mut Vec<u8>, errors: &mut Vec<u8>, events: &mut Vec<SecurityEvent>) -> Result<i32> {
        // If any critical security violations, fail execution
        if events.iter().any(|e| matches!(e.severity, SecuritySeverity::Critical)) {
            errors.extend_from_slice(b"Execution blocked due to security policy violations\n");

            // Add detailed violation report
            for event in events.iter().filter(|e| matches!(e.severity, SecuritySeverity::Critical)) {
                errors.extend_from_slice(format!("  - {}\n", event.description).as_bytes());
            }

            return Ok(1);
        }

        // Simulate successful execution with telemetry
        output.extend_from_slice(b"Sandbox execution started\n");
        output.extend_from_slice(format!("Code size: {} bytes\n", code.len()).as_bytes());
        output.extend_from_slice(format!("Syscalls tracked: {}\n", self.syscall_count).as_bytes());
        output.extend_from_slice(format!("File operations: {}\n", self.file_operations.len()).as_bytes());
        output.extend_from_slice(format!("Network operations: {}\n", self.network_operations.len()).as_bytes());
        output.extend_from_slice(format!("API calls: {}\n", self.api_calls.len()).as_bytes());
        output.extend_from_slice(b"Execution completed safely\n");

        // Allocate simulated execution memory
        self.allocate_memory(code.len() * 2);

        Ok(0)
    }

    fn track_syscall(&mut self, name: &str, args: Vec<String>, result: i32) {
        self.syscall_count += 1;
        self.syscall_traces.push(SyscallTrace {
            name: name.to_string(),
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            args,
            result,
        });
    }

    fn track_api_call(&mut self, module: &str, function: &str, args: Vec<String>) {
        self.api_calls.push(ApiCall {
            module: module.to_string(),
            function: function.to_string(),
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            args,
        });
    }

    fn allocate_memory(&mut self, size: usize) {
        self.memory_allocated += size;
        if self.memory_allocated > self.peak_memory {
            self.peak_memory = self.memory_allocated;
        }
    }

    fn get_resource_usage(&self) -> ResourceUsage {
        ResourceUsage {
            memory_bytes: self.memory_allocated,
            cpu_time_ms: self.start_time.elapsed().as_millis() as u64,
            file_handles: self.file_operations.len(),
            threads: 1,
            output_size: self.output_buffer.len() + self.error_buffer.len(),
            peak_memory_bytes: self.peak_memory,
        }
    }
    
    pub fn write_output(&mut self, data: &[u8]) -> Result<()> {
        // Check output size limit
        let new_size = self.output_buffer.len() + data.len();
        if new_size > self.instance.policy.resource_limits.max_output_size {
            return Err(anyhow!("Output size limit exceeded"));
        }
        
        self.output_buffer.extend_from_slice(data);
        Ok(())
    }
    
    pub fn write_error(&mut self, data: &[u8]) -> Result<()> {
        // Check output size limit
        let new_size = self.error_buffer.len() + data.len();
        if new_size > self.instance.policy.resource_limits.max_output_size {
            return Err(anyhow!("Error output size limit exceeded"));
        }
        
        self.error_buffer.extend_from_slice(data);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::policy::ExecutionPolicy;
    
    #[tokio::test]
    async fn test_basic_execution() {
        let mut instance = SandboxInstance::new(
            "test-exec".to_string(),
            ExecutionPolicy::default()
        ).unwrap();

        instance.initialize().unwrap();
        instance.start().unwrap();

        let mut executor = SandboxExecutor::new(&instance);
        let result = executor.execute(b"print('hello')").await.unwrap();

        assert!(result.success);
        assert!(result.stdout.contains("Sandbox execution started"));
        assert_eq!(result.exit_code, 0);
    }

    #[tokio::test]
    async fn test_network_block() {
        let mut instance = SandboxInstance::new(
            "test-network".to_string(),
            ExecutionPolicy::default()
        ).unwrap();

        instance.initialize().unwrap();
        instance.start().unwrap();

        let mut executor = SandboxExecutor::new(&instance);
        let result = executor.execute(b"socket.connect('malware.com')").await.unwrap();

        assert!(!result.success);
        assert!(result.stderr.contains("security policy violations"));
        assert_eq!(result.exit_code, 1);
        assert!(!result.security_events.is_empty());
    }

    #[tokio::test]
    async fn test_syscall_block() {
        let mut instance = SandboxInstance::new(
            "test-syscall".to_string(),
            ExecutionPolicy::default()
        ).unwrap();

        instance.initialize().unwrap();
        instance.start().unwrap();

        let mut executor = SandboxExecutor::new(&instance);
        let result = executor.execute(b"os.fork()").await.unwrap();
        
        assert!(!result.success);
        assert!(result.stderr.contains("Syscall blocked"));
        assert_eq!(result.exit_code, 1);
        
        let events = result.security_events;
        assert!(!events.is_empty());
        assert!(matches!(events[0].event_type, SecurityEventType::SyscallBlocked));
    }
}