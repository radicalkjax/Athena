use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use anyhow::{Result, anyhow};
use crate::policy::ExecutionPolicy;
use crate::{SecurityEvent, SecurityEventType, SecuritySeverity};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum SandboxStatus {
    Created,
    Ready,
    Running,
    Paused,
    Terminated,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxSnapshot {
    pub instance_id: String,
    pub timestamp: u64,
    pub status: SandboxStatus,
    pub memory_snapshot: Vec<u8>,
    pub security_events: Vec<SecurityEvent>,
}

#[derive(Debug)]
pub struct SandboxInstance {
    pub id: String,
    pub policy: ExecutionPolicy,
    pub status: Arc<Mutex<SandboxStatus>>,
    pub security_events: Arc<Mutex<Vec<SecurityEvent>>>,
    pub created_at: u64,
    pub memory: Arc<Mutex<Vec<u8>>>,
}

impl SandboxInstance {
    pub fn new(id: String, policy: ExecutionPolicy) -> Result<Self> {
        let created_at = chrono::Utc::now().timestamp_millis() as u64;
        
        // Pre-allocate memory based on policy
        let memory_size = std::cmp::min(policy.resource_limits.max_memory_bytes, 10 * 1024 * 1024);
        let memory = vec![0u8; memory_size];
        
        Ok(SandboxInstance {
            id,
            policy,
            status: Arc::new(Mutex::new(SandboxStatus::Created)),
            security_events: Arc::new(Mutex::new(Vec::new())),
            created_at,
            memory: Arc::new(Mutex::new(memory)),
        })
    }
    
    pub fn initialize(&mut self) -> Result<()> {
        let mut status = self.status.lock()
            .map_err(|_| anyhow!("Failed to lock status"))?;
        
        if *status != SandboxStatus::Created {
            return Err(anyhow!("Cannot initialize sandbox in state: {:?}", *status));
        }
        
        // Perform initialization tasks
        // - Set up memory boundaries
        // - Initialize syscall filters
        // - Configure resource limits
        
        *status = SandboxStatus::Ready;
        
        self.log_security_event(SecurityEvent {
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            event_type: SecurityEventType::SuspiciousBehavior,
            description: format!("Sandbox {} initialized", self.id),
            severity: SecuritySeverity::Low,
        });
        
        Ok(())
    }
    
    pub fn start(&mut self) -> Result<()> {
        let mut status = self.status.lock()
            .map_err(|_| anyhow!("Failed to lock status"))?;
        
        match *status {
            SandboxStatus::Ready | SandboxStatus::Paused => {
                *status = SandboxStatus::Running;
                Ok(())
            }
            _ => Err(anyhow!("Cannot start sandbox in state: {:?}", *status)),
        }
    }
    
    pub fn pause(&mut self) -> Result<()> {
        let mut status = self.status.lock()
            .map_err(|_| anyhow!("Failed to lock status"))?;
        
        if *status != SandboxStatus::Running {
            return Err(anyhow!("Cannot pause sandbox in state: {:?}", *status));
        }
        
        *status = SandboxStatus::Paused;
        Ok(())
    }
    
    pub fn resume(&mut self) -> Result<()> {
        let mut status = self.status.lock()
            .map_err(|_| anyhow!("Failed to lock status"))?;
        
        if *status != SandboxStatus::Paused {
            return Err(anyhow!("Cannot resume sandbox in state: {:?}", *status));
        }
        
        *status = SandboxStatus::Running;
        Ok(())
    }
    
    pub fn terminate(&mut self) -> Result<()> {
        let mut status = self.status.lock()
            .map_err(|_| anyhow!("Failed to lock status"))?;
        
        if *status == SandboxStatus::Terminated {
            return Ok(());
        }
        
        // Cleanup resources
        if let Ok(mut memory) = self.memory.lock() {
            memory.clear();
            memory.shrink_to_fit();
        }
        
        *status = SandboxStatus::Terminated;
        
        self.log_security_event(SecurityEvent {
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            event_type: SecurityEventType::SuspiciousBehavior,
            description: format!("Sandbox {} terminated", self.id),
            severity: SecuritySeverity::Low,
        });
        
        Ok(())
    }
    
    pub fn get_status(&self) -> SandboxStatus {
        self.status.lock()
            .map(|status| *status)
            .unwrap_or(SandboxStatus::Failed)
    }
    
    pub fn is_running(&self) -> bool {
        self.get_status() == SandboxStatus::Running
    }
    
    pub fn log_security_event(&self, event: SecurityEvent) {
        if let Ok(mut events) = self.security_events.lock() {
            events.push(event);
            
            // Keep only last 1000 events
            if events.len() > 1000 {
                events.drain(0..100);
            }
        }
    }
    
    pub fn get_security_events(&self) -> Vec<SecurityEvent> {
        self.security_events.lock()
            .map(|events| events.clone())
            .unwrap_or_default()
    }
    
    pub fn check_syscall(&self, syscall: &str) -> Result<()> {
        match &self.policy.security_policy.syscall_policy {
            crate::policy::SyscallPolicy::AllowList(allowed) => {
                if !allowed.contains(syscall) {
                    self.log_security_event(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::SyscallBlocked,
                        description: format!("Blocked syscall: {}", syscall),
                        severity: SecuritySeverity::High,
                    });
                    return Err(anyhow!("Syscall {} not in allow list", syscall));
                }
            }
            crate::policy::SyscallPolicy::DenyList(denied) => {
                if denied.contains(syscall) {
                    self.log_security_event(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::SyscallBlocked,
                        description: format!("Blocked syscall: {}", syscall),
                        severity: SecuritySeverity::High,
                    });
                    return Err(anyhow!("Syscall {} in deny list", syscall));
                }
            }
            crate::policy::SyscallPolicy::DenyAll => {
                self.log_security_event(SecurityEvent {
                    timestamp: chrono::Utc::now().timestamp_millis() as u64,
                    event_type: SecurityEventType::SyscallBlocked,
                    description: format!("Blocked syscall: {} (deny all policy)", syscall),
                    severity: SecuritySeverity::High,
                });
                return Err(anyhow!("All syscalls are denied"));
            }
        }
        
        Ok(())
    }
    
    pub fn check_network_access(&self, address: &str) -> Result<()> {
        match &self.policy.security_policy.network_policy {
            crate::policy::NetworkPolicy::Disabled => {
                self.log_security_event(SecurityEvent {
                    timestamp: chrono::Utc::now().timestamp_millis() as u64,
                    event_type: SecurityEventType::NetworkAccessAttempt,
                    description: format!("Blocked network access to: {}", address),
                    severity: SecuritySeverity::Critical,
                });
                Err(anyhow!("Network access is disabled"))
            }
            crate::policy::NetworkPolicy::AllowList(allowed) => {
                if !allowed.contains(address) {
                    self.log_security_event(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::NetworkAccessAttempt,
                        description: format!("Blocked network access to: {} (not in allow list)", address),
                        severity: SecuritySeverity::Critical,
                    });
                    return Err(anyhow!("Address {} not in allow list", address));
                }
                Ok(())
            }
            crate::policy::NetworkPolicy::DenyList(denied) => {
                if denied.contains(address) {
                    self.log_security_event(SecurityEvent {
                        timestamp: chrono::Utc::now().timestamp_millis() as u64,
                        event_type: SecurityEventType::NetworkAccessAttempt,
                        description: format!("Blocked network access to: {} (in deny list)", address),
                        severity: SecuritySeverity::Critical,
                    });
                    return Err(anyhow!("Address {} in deny list", address));
                }
                Ok(())
            }
        }
    }
    
    pub fn snapshot(&self) -> Result<SandboxSnapshot> {
        let memory = self.memory.lock()
            .map_err(|_| anyhow!("Failed to lock memory"))?
            .clone();
        
        let security_events = self.get_security_events();
        
        Ok(SandboxSnapshot {
            instance_id: self.id.clone(),
            timestamp: chrono::Utc::now().timestamp_millis() as u64,
            status: self.get_status(),
            memory_snapshot: memory,
            security_events,
        })
    }
    
    pub fn restore(&mut self, snapshot: SandboxSnapshot) -> Result<()> {
        if snapshot.instance_id != self.id {
            return Err(anyhow!("Snapshot is for different instance"));
        }
        
        let mut status = self.status.lock()
            .map_err(|_| anyhow!("Failed to lock status"))?;
        
        if *status == SandboxStatus::Running {
            return Err(anyhow!("Cannot restore while running"));
        }
        
        // Restore memory
        let mut memory = self.memory.lock()
            .map_err(|_| anyhow!("Failed to lock memory"))?;
        *memory = snapshot.memory_snapshot;
        
        // Restore security events
        let mut events = self.security_events.lock()
            .map_err(|_| anyhow!("Failed to lock security events"))?;
        *events = snapshot.security_events;
        
        // Restore status
        *status = snapshot.status;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::policy::ExecutionPolicy;
    
    #[test]
    fn test_instance_lifecycle() {
        let mut instance = SandboxInstance::new(
            "test-1".to_string(),
            ExecutionPolicy::default()
        ).unwrap();
        
        assert_eq!(instance.get_status(), SandboxStatus::Created);
        
        instance.initialize().unwrap();
        assert_eq!(instance.get_status(), SandboxStatus::Ready);
        
        instance.start().unwrap();
        assert_eq!(instance.get_status(), SandboxStatus::Running);
        
        instance.pause().unwrap();
        assert_eq!(instance.get_status(), SandboxStatus::Paused);
        
        instance.resume().unwrap();
        assert_eq!(instance.get_status(), SandboxStatus::Running);
        
        instance.terminate().unwrap();
        assert_eq!(instance.get_status(), SandboxStatus::Terminated);
    }
    
    #[test]
    fn test_security_events() {
        let instance = SandboxInstance::new(
            "test-2".to_string(),
            ExecutionPolicy::default()
        ).unwrap();
        
        instance.log_security_event(SecurityEvent {
            timestamp: 0,
            event_type: SecurityEventType::SyscallBlocked,
            description: "Test event".to_string(),
            severity: SecuritySeverity::High,
        });
        
        let events = instance.get_security_events();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].description, "Test event");
    }
}