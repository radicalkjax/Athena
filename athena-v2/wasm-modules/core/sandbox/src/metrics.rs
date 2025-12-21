use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Performance metrics collector for the sandbox
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub total_execution_time_ms: u64,
    pub average_execution_time_ms: f64,
    pub min_execution_time_ms: u64,
    pub max_execution_time_ms: u64,
    pub total_memory_allocated: u64,
    pub average_memory_per_execution: f64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub instance_creations: u64,
    pub instance_reuses: u64,
}

/// Instance-specific metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceMetrics {
    pub instance_id: String,
    pub creation_time: u64,
    pub execution_count: u64,
    pub total_cpu_time_ms: u64,
    pub total_memory_bytes: u64,
    pub peak_memory_bytes: u64,
    pub security_events_count: u64,
    pub last_execution_time: u64,
}

/// Advanced metrics collector with performance optimizations
pub struct MetricsCollector {
    global_metrics: Arc<Mutex<PerformanceMetrics>>,
    instance_metrics: Arc<Mutex<HashMap<String, InstanceMetrics>>>,
    execution_cache: Arc<Mutex<HashMap<u64, Duration>>>, // Hash -> execution time cache
}

impl MetricsCollector {
    pub fn new() -> Self {
        MetricsCollector {
            global_metrics: Arc::new(Mutex::new(PerformanceMetrics::default())),
            instance_metrics: Arc::new(Mutex::new(HashMap::new())),
            execution_cache: Arc::new(Mutex::new(HashMap::new())),
        }
    }
    
    /// Record execution start
    pub fn record_execution_start(&self, instance_id: &str) -> Instant {
        Instant::now()
    }
    
    /// Record execution completion
    pub fn record_execution_complete(
        &self, 
        instance_id: &str, 
        start_time: Instant, 
        success: bool,
        memory_used: usize,
        code_hash: u64
    ) {
        let duration = start_time.elapsed();
        let duration_ms = duration.as_millis() as u64;
        
        // Update global metrics
        if let Ok(mut metrics) = self.global_metrics.lock() {
            metrics.total_executions += 1;
            if success {
                metrics.successful_executions += 1;
            } else {
                metrics.failed_executions += 1;
            }
            
            metrics.total_execution_time_ms += duration_ms;
            metrics.average_execution_time_ms = 
                metrics.total_execution_time_ms as f64 / metrics.total_executions as f64;
            
            if duration_ms < metrics.min_execution_time_ms || metrics.min_execution_time_ms == 0 {
                metrics.min_execution_time_ms = duration_ms;
            }
            if duration_ms > metrics.max_execution_time_ms {
                metrics.max_execution_time_ms = duration_ms;
            }
            
            metrics.total_memory_allocated += memory_used as u64;
            metrics.average_memory_per_execution = 
                metrics.total_memory_allocated as f64 / metrics.total_executions as f64;
        }
        
        // Update instance metrics
        if let Ok(mut instances) = self.instance_metrics.lock() {
            let instance = instances.entry(instance_id.to_string())
                .or_insert_with(|| InstanceMetrics {
                    instance_id: instance_id.to_string(),
                    creation_time: chrono::Utc::now().timestamp_millis() as u64,
                    execution_count: 0,
                    total_cpu_time_ms: 0,
                    total_memory_bytes: 0,
                    peak_memory_bytes: 0,
                    security_events_count: 0,
                    last_execution_time: 0,
                });
            
            instance.execution_count += 1;
            instance.total_cpu_time_ms += duration_ms;
            instance.total_memory_bytes += memory_used as u64;
            if memory_used as u64 > instance.peak_memory_bytes {
                instance.peak_memory_bytes = memory_used as u64;
            }
            instance.last_execution_time = chrono::Utc::now().timestamp_millis() as u64;
        }
        
        // Update execution cache
        if let Ok(mut cache) = self.execution_cache.lock() {
            cache.insert(code_hash, duration);
            
            // Keep cache size reasonable
            if cache.len() > 1000 {
                // Remove oldest entries (simple LRU approximation)
                let to_remove: Vec<u64> = cache.keys()
                    .take(100)
                    .cloned()
                    .collect();
                for key in to_remove {
                    cache.remove(&key);
                }
            }
        }
    }
    
    /// Check if we have cached execution time for this code
    pub fn get_cached_execution_time(&self, code_hash: u64) -> Option<Duration> {
        self.execution_cache.lock()
            .ok()
            .and_then(|cache| cache.get(&code_hash).cloned())
    }
    
    /// Record cache hit
    pub fn record_cache_hit(&self) {
        if let Ok(mut metrics) = self.global_metrics.lock() {
            metrics.cache_hits += 1;
        }
    }
    
    /// Record cache miss
    pub fn record_cache_miss(&self) {
        if let Ok(mut metrics) = self.global_metrics.lock() {
            metrics.cache_misses += 1;
        }
    }
    
    /// Record instance creation
    pub fn record_instance_creation(&self, reused: bool) {
        if let Ok(mut metrics) = self.global_metrics.lock() {
            if reused {
                metrics.instance_reuses += 1;
            } else {
                metrics.instance_creations += 1;
            }
        }
    }
    
    /// Record security event
    pub fn record_security_event(&self, instance_id: &str) {
        if let Ok(mut instances) = self.instance_metrics.lock() {
            if let Some(instance) = instances.get_mut(instance_id) {
                instance.security_events_count += 1;
            }
        }
    }
    
    /// Get global performance metrics
    pub fn get_global_metrics(&self) -> PerformanceMetrics {
        self.global_metrics.lock()
            .ok()
            .map(|m| m.clone())
            .unwrap_or_default()
    }
    
    /// Get instance-specific metrics
    pub fn get_instance_metrics(&self, instance_id: &str) -> Option<InstanceMetrics> {
        self.instance_metrics.lock()
            .ok()
            .and_then(|m| m.get(instance_id).cloned())
    }
    
    /// Get all instance metrics
    pub fn get_all_instance_metrics(&self) -> Vec<InstanceMetrics> {
        self.instance_metrics.lock()
            .ok()
            .map(|m| m.values().cloned().collect())
            .unwrap_or_default()
    }
    
    /// Clean up instance metrics
    pub fn cleanup_instance(&self, instance_id: &str) {
        if let Ok(mut instances) = self.instance_metrics.lock() {
            instances.remove(instance_id);
        }
    }
    
    /// Generate performance report
    pub fn generate_report(&self) -> String {
        let metrics = self.get_global_metrics();
        
        format!(
            r#"Sandbox Performance Report
=========================
Total Executions: {}
Successful: {} ({:.1}%)
Failed: {} ({:.1}%)

Execution Time:
  Average: {:.2}ms
  Min: {}ms
  Max: {}ms
  Total: {}ms

Memory Usage:
  Total Allocated: {:.2}MB
  Average per Execution: {:.2}KB

Instance Management:
  Created: {}
  Reused: {} ({:.1}% reuse rate)

Cache Performance:
  Hits: {}
  Misses: {}
  Hit Rate: {:.1}%
"#,
            metrics.total_executions,
            metrics.successful_executions,
            if metrics.total_executions > 0 {
                metrics.successful_executions as f64 / metrics.total_executions as f64 * 100.0
            } else { 0.0 },
            metrics.failed_executions,
            if metrics.total_executions > 0 {
                metrics.failed_executions as f64 / metrics.total_executions as f64 * 100.0
            } else { 0.0 },
            metrics.average_execution_time_ms,
            metrics.min_execution_time_ms,
            metrics.max_execution_time_ms,
            metrics.total_execution_time_ms,
            metrics.total_memory_allocated as f64 / (1024.0 * 1024.0),
            metrics.average_memory_per_execution / 1024.0,
            metrics.instance_creations,
            metrics.instance_reuses,
            if metrics.instance_creations + metrics.instance_reuses > 0 {
                metrics.instance_reuses as f64 / (metrics.instance_creations + metrics.instance_reuses) as f64 * 100.0
            } else { 0.0 },
            metrics.cache_hits,
            metrics.cache_misses,
            if metrics.cache_hits + metrics.cache_misses > 0 {
                metrics.cache_hits as f64 / (metrics.cache_hits + metrics.cache_misses) as f64 * 100.0
            } else { 0.0 }
        )
    }
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        PerformanceMetrics {
            total_executions: 0,
            successful_executions: 0,
            failed_executions: 0,
            total_execution_time_ms: 0,
            average_execution_time_ms: 0.0,
            min_execution_time_ms: 0,
            max_execution_time_ms: 0,
            total_memory_allocated: 0,
            average_memory_per_execution: 0.0,
            cache_hits: 0,
            cache_misses: 0,
            instance_creations: 0,
            instance_reuses: 0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;
    
    #[test]
    fn test_metrics_collection() {
        let collector = MetricsCollector::new();
        let instance_id = "test-1";
        
        // Record successful execution
        let start = collector.record_execution_start(instance_id);
        thread::sleep(Duration::from_millis(10));
        collector.record_execution_complete(instance_id, start, true, 1024 * 1024, 12345);
        
        let metrics = collector.get_global_metrics();
        assert_eq!(metrics.total_executions, 1);
        assert_eq!(metrics.successful_executions, 1);
        assert!(metrics.average_execution_time_ms >= 10.0);
        
        // Check instance metrics
        let instance_metrics = collector.get_instance_metrics(instance_id).unwrap();
        assert_eq!(instance_metrics.execution_count, 1);
        assert_eq!(instance_metrics.total_memory_bytes, 1024 * 1024);
    }
    
    #[test]
    fn test_cache_functionality() {
        let collector = MetricsCollector::new();
        let code_hash = 12345u64;
        
        // Initially no cached time
        assert!(collector.get_cached_execution_time(code_hash).is_none());
        collector.record_cache_miss();
        
        // Record execution
        let start = Instant::now();
        thread::sleep(Duration::from_millis(5));
        collector.record_execution_complete("test", start, true, 1024, code_hash);
        
        // Now should have cached time
        let cached = collector.get_cached_execution_time(code_hash);
        assert!(cached.is_some());
        collector.record_cache_hit();
        
        let metrics = collector.get_global_metrics();
        assert_eq!(metrics.cache_hits, 1);
        assert_eq!(metrics.cache_misses, 1);
    }
    
    #[test]
    fn test_performance_report() {
        let collector = MetricsCollector::new();
        
        // Record some executions
        for i in 0..5 {
            let start = collector.record_execution_start(&format!("test-{}", i));
            thread::sleep(Duration::from_millis(i as u64 + 1));
            collector.record_execution_complete(
                &format!("test-{}", i), 
                start, 
                i % 2 == 0, 
                1024 * (i + 1), 
                i as u64
            );
        }
        
        let report = collector.generate_report();
        assert!(report.contains("Total Executions: 5"));
        assert!(report.contains("Successful: 3"));
        assert!(report.contains("Failed: 2"));
    }
}