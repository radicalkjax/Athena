use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use crate::SandboxError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub memory_bytes: usize,
    pub cpu_time_ms: u64,
    pub file_handles: usize,
    pub threads: usize,
    pub output_size: usize,
    pub peak_memory_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceAlert {
    pub timestamp: u64,
    pub alert_type: ResourceAlertType,
    pub current_value: u64,
    pub limit_value: u64,
    pub instance_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceAlertType {
    MemoryWarning,
    MemoryCritical,
    CpuWarning,
    CpuCritical,
    OutputSizeWarning,
    FileHandleWarning,
}

pub struct ResourceMonitor {
    usage_map: HashMap<String, ResourceUsage>,
    alerts: Vec<ResourceAlert>,
    start_times: HashMap<String, Instant>,
}

impl ResourceMonitor {
    pub fn new() -> Self {
        ResourceMonitor {
            usage_map: HashMap::new(),
            alerts: Vec::new(),
            start_times: HashMap::new(),
        }
    }
    
    pub fn start_monitoring(&mut self, instance_id: &str) {
        self.start_times.insert(instance_id.to_string(), Instant::now());
        self.usage_map.insert(instance_id.to_string(), ResourceUsage::default());
    }
    
    pub fn stop_monitoring(&mut self, instance_id: &str) {
        self.start_times.remove(instance_id);
    }
    
    pub fn update_memory(&mut self, instance_id: &str, memory_bytes: usize) {
        if let Some(usage) = self.usage_map.get_mut(instance_id) {
            usage.memory_bytes = memory_bytes;
            if memory_bytes > usage.peak_memory_bytes {
                usage.peak_memory_bytes = memory_bytes;
            }
        }
    }
    
    pub fn update_cpu_time(&mut self, instance_id: &str) {
        if let Some(start_time) = self.start_times.get(instance_id) {
            let elapsed = start_time.elapsed().as_millis() as u64;
            if let Some(usage) = self.usage_map.get_mut(instance_id) {
                usage.cpu_time_ms = elapsed;
            }
        }
    }
    
    pub fn update_output_size(&mut self, instance_id: &str, size: usize) {
        if let Some(usage) = self.usage_map.get_mut(instance_id) {
            usage.output_size = size;
        }
    }
    
    pub fn update_file_handles(&mut self, instance_id: &str, count: usize) {
        if let Some(usage) = self.usage_map.get_mut(instance_id) {
            usage.file_handles = count;
        }
    }
    
    pub fn update_threads(&mut self, instance_id: &str, count: usize) {
        if let Some(usage) = self.usage_map.get_mut(instance_id) {
            usage.threads = count;
        }
    }
    
    pub fn check_limits(&mut self, instance_id: &str, limits: &crate::policy::ResourceLimits) -> Result<(), SandboxError> {
        let usage = self.usage_map.get(instance_id)
            .ok_or_else(|| SandboxError::InstanceNotFound(instance_id.to_string()))?
            .clone(); // Clone to avoid borrow issues
        
        // Check memory limit
        if usage.memory_bytes > limits.max_memory_bytes {
            self.add_alert(ResourceAlert {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                alert_type: ResourceAlertType::MemoryCritical,
                current_value: usage.memory_bytes as u64,
                limit_value: limits.max_memory_bytes as u64,
                instance_id: instance_id.to_string(),
            });
            return Err(SandboxError::ResourceLimitExceeded(
                format!("Memory limit exceeded: {} > {}", usage.memory_bytes, limits.max_memory_bytes)
            ));
        }
        
        // Check CPU time limit
        if usage.cpu_time_ms > limits.max_cpu_time_ms {
            self.add_alert(ResourceAlert {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                alert_type: ResourceAlertType::CpuCritical,
                current_value: usage.cpu_time_ms,
                limit_value: limits.max_cpu_time_ms,
                instance_id: instance_id.to_string(),
            });
            return Err(SandboxError::ExecutionTimeout(
                Duration::from_millis(usage.cpu_time_ms)
            ));
        }
        
        // Check output size limit
        if usage.output_size > limits.max_output_size {
            self.add_alert(ResourceAlert {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                alert_type: ResourceAlertType::OutputSizeWarning,
                current_value: usage.output_size as u64,
                limit_value: limits.max_output_size as u64,
                instance_id: instance_id.to_string(),
            });
            return Err(SandboxError::ResourceLimitExceeded(
                format!("Output size limit exceeded: {} > {}", usage.output_size, limits.max_output_size)
            ));
        }
        
        // Check file handle limit
        if usage.file_handles > limits.max_file_handles {
            self.add_alert(ResourceAlert {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                alert_type: ResourceAlertType::FileHandleWarning,
                current_value: usage.file_handles as u64,
                limit_value: limits.max_file_handles as u64,
                instance_id: instance_id.to_string(),
            });
            return Err(SandboxError::ResourceLimitExceeded(
                format!("File handle limit exceeded: {} > {}", usage.file_handles, limits.max_file_handles)
            ));
        }
        
        // Add warnings for approaching limits
        if usage.memory_bytes > limits.max_memory_bytes * 8 / 10 {
            self.add_alert(ResourceAlert {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                alert_type: ResourceAlertType::MemoryWarning,
                current_value: usage.memory_bytes as u64,
                limit_value: limits.max_memory_bytes as u64,
                instance_id: instance_id.to_string(),
            });
        }
        
        if usage.cpu_time_ms > limits.max_cpu_time_ms * 8 / 10 {
            self.add_alert(ResourceAlert {
                timestamp: chrono::Utc::now().timestamp_millis() as u64,
                alert_type: ResourceAlertType::CpuWarning,
                current_value: usage.cpu_time_ms,
                limit_value: limits.max_cpu_time_ms,
                instance_id: instance_id.to_string(),
            });
        }
        
        Ok(())
    }
    
    pub fn get_usage(&self, instance_id: &str) -> ResourceUsage {
        self.usage_map.get(instance_id)
            .cloned()
            .unwrap_or_default()
    }
    
    pub fn get_alerts(&self, instance_id: Option<&str>) -> Vec<ResourceAlert> {
        match instance_id {
            Some(id) => self.alerts.iter()
                .filter(|alert| alert.instance_id == id)
                .cloned()
                .collect(),
            None => self.alerts.clone(),
        }
    }
    
    fn add_alert(&mut self, alert: ResourceAlert) {
        self.alerts.push(alert);
        
        // Keep only last 1000 alerts
        if self.alerts.len() > 1000 {
            self.alerts.drain(0..100);
        }
    }
    
    pub fn cleanup(&mut self, instance_id: &str) {
        self.usage_map.remove(instance_id);
        self.start_times.remove(instance_id);
        self.alerts.retain(|alert| alert.instance_id != instance_id);
    }
}

impl Default for ResourceUsage {
    fn default() -> Self {
        ResourceUsage {
            memory_bytes: 0,
            cpu_time_ms: 0,
            file_handles: 0,
            threads: 1,
            output_size: 0,
            peak_memory_bytes: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::policy::ResourceLimits;
    
    #[test]
    fn test_resource_monitoring() {
        let mut monitor = ResourceMonitor::new();
        let instance_id = "test-instance";
        
        monitor.start_monitoring(instance_id);
        monitor.update_memory(instance_id, 1024 * 1024); // 1MB
        monitor.update_output_size(instance_id, 1024); // 1KB
        
        let usage = monitor.get_usage(instance_id);
        assert_eq!(usage.memory_bytes, 1024 * 1024);
        assert_eq!(usage.output_size, 1024);
        assert_eq!(usage.peak_memory_bytes, 1024 * 1024);
    }
    
    #[test]
    fn test_resource_limits() {
        let mut monitor = ResourceMonitor::new();
        let instance_id = "test-instance";
        
        monitor.start_monitoring(instance_id);
        monitor.update_memory(instance_id, 200 * 1024 * 1024); // 200MB
        
        let limits = ResourceLimits {
            max_memory_bytes: 100 * 1024 * 1024, // 100MB limit
            ..Default::default()
        };
        
        let result = monitor.check_limits(instance_id, &limits);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), SandboxError::ResourceLimitExceeded(_)));
    }
}