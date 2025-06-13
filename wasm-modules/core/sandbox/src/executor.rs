use anyhow::{Result, anyhow};
use std::time::Instant;
use crate::instance::SandboxInstance;
use crate::monitor::ResourceUsage;
use crate::{SecurityEvent, SecurityEventType, SecuritySeverity, ExecutionResult};

pub struct SandboxExecutor<'a> {
    instance: &'a SandboxInstance,
    output_buffer: Vec<u8>,
    error_buffer: Vec<u8>,
}

impl<'a> SandboxExecutor<'a> {
    pub fn new(instance: &'a SandboxInstance) -> Self {
        SandboxExecutor {
            instance,
            output_buffer: Vec::new(),
            error_buffer: Vec::new(),
        }
    }
    
    pub async fn execute(&self, code: &[u8]) -> Result<ExecutionResult> {
        // Check instance status
        if !self.instance.is_running() {
            return Err(anyhow!("Instance is not running"));
        }
        
        let start_time = Instant::now();
        let mut security_events = Vec::new();
        
        // Simulate code execution with security checks
        // In a real implementation, this would:
        // 1. Load code into WASM module
        // 2. Set up resource monitors
        // 3. Execute with syscall filtering
        // 4. Capture output/errors
        
        // For now, we'll simulate various scenarios
        let result = self.simulate_execution(code, &mut security_events).await?;
        
        let execution_time_ms = start_time.elapsed().as_millis() as u64;
        
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
    
    async fn simulate_execution(&self, code: &[u8], events: &mut Vec<SecurityEvent>) -> Result<(String, String, i32)> {
        // Simulate various malware behaviors based on code patterns
        let code_str = String::from_utf8_lossy(code);
        
        // Check for suspicious patterns
        if code_str.contains("socket") || code_str.contains("connect") {
            events.push(SecurityEvent {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                event_type: SecurityEventType::NetworkAccessAttempt,
                description: "Detected network operation attempt".to_string(),
                severity: SecuritySeverity::Critical,
            });
            
            // Check network policy
            if let Err(_) = self.instance.check_network_access("malware.com") {
                return Ok((
                    "".to_string(),
                    "Network access denied".to_string(),
                    1
                ));
            }
        }
        
        if code_str.contains("fork") || code_str.contains("exec") {
            events.push(SecurityEvent {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                event_type: SecurityEventType::SyscallBlocked,
                description: "Blocked process creation attempt".to_string(),
                severity: SecuritySeverity::High,
            });
            
            // Check syscall policy
            if let Err(_) = self.instance.check_syscall("fork") {
                return Ok((
                    "".to_string(),
                    "Syscall blocked: fork".to_string(),
                    1
                ));
            }
        }
        
        if code_str.contains("/etc/passwd") || code_str.contains("/etc/shadow") {
            events.push(SecurityEvent {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                event_type: SecurityEventType::FileAccessAttempt,
                description: "Attempted to access sensitive files".to_string(),
                severity: SecuritySeverity::Critical,
            });
        }
        
        // Simulate successful execution with some output
        if code_str.contains("print") || code_str.contains("echo") {
            return Ok((
                "Hello from sandboxed execution\n".to_string(),
                "".to_string(),
                0
            ));
        }
        
        // Default: simulate benign execution
        Ok((
            format!("Executed {} bytes of code safely\n", code.len()),
            "".to_string(),
            0
        ))
    }
    
    fn get_resource_usage(&self) -> ResourceUsage {
        ResourceUsage {
            memory_bytes: 10 * 1024 * 1024, // 10MB simulated
            cpu_time_ms: 100, // 100ms simulated
            file_handles: 3, // stdin, stdout, stderr
            threads: 1,
            output_size: self.output_buffer.len() + self.error_buffer.len(),
            peak_memory_bytes: 15 * 1024 * 1024, // 15MB simulated peak
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
        
        let executor = SandboxExecutor::new(&instance);
        let result = executor.execute(b"print('hello')").await.unwrap();
        
        assert!(result.success);
        assert!(result.stdout.contains("Hello from sandboxed execution"));
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
        
        let executor = SandboxExecutor::new(&instance);
        let result = executor.execute(b"socket.connect('malware.com')").await.unwrap();
        
        assert!(!result.success);
        assert!(result.stderr.contains("Network access denied"));
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
        
        let executor = SandboxExecutor::new(&instance);
        let result = executor.execute(b"os.fork()").await.unwrap();
        
        assert!(!result.success);
        assert!(result.stderr.contains("Syscall blocked"));
        assert_eq!(result.exit_code, 1);
        
        let events = result.security_events;
        assert!(!events.is_empty());
        assert!(matches!(events[0].event_type, SecurityEventType::SyscallBlocked));
    }
}