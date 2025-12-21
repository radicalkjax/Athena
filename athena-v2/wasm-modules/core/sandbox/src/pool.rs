use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use anyhow::{Result, anyhow};
use crate::{SandboxInstance, ExecutionPolicy};
use crate::instance::SandboxStatus;

/// Configuration for the instance pool
#[derive(Debug, Clone)]
pub struct PoolConfig {
    /// Minimum number of instances to keep ready
    pub min_ready_instances: usize,
    /// Maximum number of instances to keep in pool
    pub max_pool_size: usize,
    /// Maximum idle time before instance is terminated (in seconds)
    pub max_idle_time_secs: u64,
    /// Enable pre-warming of instances
    pub enable_prewarming: bool,
    /// Instance recycle threshold (number of executions before recycling)
    pub recycle_threshold: u32,
}

impl Default for PoolConfig {
    fn default() -> Self {
        Self {
            min_ready_instances: 2,
            max_pool_size: 10,
            max_idle_time_secs: 300, // 5 minutes
            enable_prewarming: true,
            recycle_threshold: 50,
        }
    }
}

/// Instance metadata for pool management
#[derive(Debug, Clone)]
struct PooledInstance {
    instance: Arc<Mutex<SandboxInstance>>,
    last_used: std::time::Instant,
    execution_count: u32,
    allocated: bool,
}

/// Instance pool for efficient sandbox management
pub struct InstancePool {
    config: PoolConfig,
    /// Ready instances waiting to be used
    ready_instances: Arc<Mutex<VecDeque<String>>>,
    /// All instances in the pool
    instances: Arc<Mutex<HashMap<String, PooledInstance>>>,
    /// Instance ID counter
    next_id: Arc<Mutex<u64>>,
    /// Background cleanup handle
    cleanup_handle: Option<std::thread::JoinHandle<()>>,
}

impl InstancePool {
    /// Create a new instance pool with the given configuration
    pub fn new(config: PoolConfig) -> Result<Self> {
        let pool = Self {
            config,
            ready_instances: Arc::new(Mutex::new(VecDeque::new())),
            instances: Arc::new(Mutex::new(HashMap::new())),
            next_id: Arc::new(Mutex::new(0)),
            cleanup_handle: None,
        };
        
        Ok(pool)
    }
    
    /// Initialize the pool and start background tasks
    pub fn initialize(&mut self, default_policy: ExecutionPolicy) -> Result<()> {
        // Pre-warm instances if enabled
        if self.config.enable_prewarming {
            for _ in 0..self.config.min_ready_instances {
                self.create_instance(default_policy.clone())?;
            }
        }
        
        // Start background cleanup task
        self.start_cleanup_task();
        
        Ok(())
    }
    
    /// Acquire a ready instance from the pool
    pub fn acquire(&self, policy: ExecutionPolicy) -> Result<(String, Arc<Mutex<SandboxInstance>>)> {
        let mut ready_queue = self.ready_instances.lock()
            .map_err(|_| anyhow!("Failed to lock ready queue"))?;
        
        let mut instances = self.instances.lock()
            .map_err(|_| anyhow!("Failed to lock instances"))?;
        
        // Try to find a ready instance with compatible policy
        let instance_id = if let Some(id) = ready_queue.pop_front() {
            // Check if the instance is still valid
            if let Some(pooled) = instances.get_mut(&id) {
                pooled.allocated = true;
                pooled.last_used = std::time::Instant::now();
                id
            } else {
                // Instance was removed, create a new one
                return self.create_and_acquire(policy);
            }
        } else {
            // No ready instances, create a new one
            return self.create_and_acquire(policy);
        };
        
        // Get the instance
        let pooled = instances.get_mut(&instance_id)
            .ok_or_else(|| anyhow!("Instance not found"))?;
        
        // Reset the instance for new execution
        if let Ok(mut instance) = pooled.instance.lock() {
            // Update policy if different
            instance.policy = policy;
            instance.initialize()?;
        }
        
        Ok((instance_id, pooled.instance.clone()))
    }
    
    /// Release an instance back to the pool
    pub fn release(&self, instance_id: String) -> Result<()> {
        let mut instances = self.instances.lock()
            .map_err(|_| anyhow!("Failed to lock instances"))?;
        
        let mut ready_queue = self.ready_instances.lock()
            .map_err(|_| anyhow!("Failed to lock ready queue"))?;
        
        if let Some(pooled) = instances.get_mut(&instance_id) {
            pooled.allocated = false;
            pooled.execution_count += 1;
            pooled.last_used = std::time::Instant::now();
            
            // Check if instance should be recycled
            if pooled.execution_count >= self.config.recycle_threshold {
                // Terminate and remove the instance
                if let Ok(mut instance) = pooled.instance.lock() {
                    let _ = instance.terminate();
                }
                instances.remove(&instance_id);
            } else {
                // Clean up the instance for reuse
                if let Ok(mut instance) = pooled.instance.lock() {
                    // Clear security events
                    if let Ok(mut events) = instance.security_events.lock() {
                        events.clear();
                    }
                    
                    // Reset status to ready
                    if let Ok(mut status) = instance.status.lock() {
                        *status = SandboxStatus::Ready;
                    }
                }
                
                // Add back to ready queue
                ready_queue.push_back(instance_id);
            }
        }
        
        Ok(())
    }
    
    /// Get pool statistics
    pub fn get_stats(&self) -> PoolStats {
        let ready_count = self.ready_instances.lock()
            .map(|q| q.len())
            .unwrap_or(0);
        
        let instances = self.instances.lock()
            .map(|map| {
                let total = map.len();
                let allocated = map.values().filter(|p| p.allocated).count();
                (total, allocated)
            })
            .unwrap_or((0, 0));
        
        PoolStats {
            total_instances: instances.0,
            ready_instances: ready_count,
            allocated_instances: instances.1,
            config: self.config.clone(),
        }
    }
    
    /// Create a new instance and add it to the pool
    fn create_instance(&self, policy: ExecutionPolicy) -> Result<String> {
        let mut next_id = self.next_id.lock()
            .map_err(|_| anyhow!("Failed to lock next_id"))?;
        
        let instance_id = format!("sandbox-{}", *next_id);
        *next_id += 1;
        
        let mut instance = SandboxInstance::new(instance_id.clone(), policy)?;
        instance.initialize()?;
        
        let pooled = PooledInstance {
            instance: Arc::new(Mutex::new(instance)),
            last_used: std::time::Instant::now(),
            execution_count: 0,
            allocated: false,
        };
        
        let mut instances = self.instances.lock()
            .map_err(|_| anyhow!("Failed to lock instances"))?;
        
        let mut ready_queue = self.ready_instances.lock()
            .map_err(|_| anyhow!("Failed to lock ready queue"))?;
        
        instances.insert(instance_id.clone(), pooled);
        ready_queue.push_back(instance_id.clone());
        
        Ok(instance_id)
    }
    
    /// Create a new instance and immediately acquire it
    fn create_and_acquire(&self, policy: ExecutionPolicy) -> Result<(String, Arc<Mutex<SandboxInstance>>)> {
        // Check pool size limit
        let instances = self.instances.lock()
            .map_err(|_| anyhow!("Failed to lock instances"))?;
        
        if instances.len() >= self.config.max_pool_size {
            return Err(anyhow!("Pool size limit reached"));
        }
        
        drop(instances); // Release lock before creating instance
        
        let mut next_id = self.next_id.lock()
            .map_err(|_| anyhow!("Failed to lock next_id"))?;
        
        let instance_id = format!("sandbox-{}", *next_id);
        *next_id += 1;
        
        let mut instance = SandboxInstance::new(instance_id.clone(), policy)?;
        instance.initialize()?;
        
        let pooled = PooledInstance {
            instance: Arc::new(Mutex::new(instance)),
            last_used: std::time::Instant::now(),
            execution_count: 0,
            allocated: true,
        };
        
        let instance_ref = pooled.instance.clone();
        
        let mut instances = self.instances.lock()
            .map_err(|_| anyhow!("Failed to lock instances"))?;
        
        instances.insert(instance_id.clone(), pooled);
        
        Ok((instance_id, instance_ref))
    }
    
    /// Start background cleanup task
    fn start_cleanup_task(&mut self) {
        let instances = Arc::clone(&self.instances);
        let ready_queue = Arc::clone(&self.ready_instances);
        let max_idle_time = self.config.max_idle_time_secs;
        let min_ready = self.config.min_ready_instances;
        
        let handle = std::thread::spawn(move || {
            loop {
                std::thread::sleep(std::time::Duration::from_secs(30));
                
                // Clean up idle instances
                if let Ok(mut instances_map) = instances.lock() {
                    if let Ok(mut queue) = ready_queue.lock() {
                        let now = std::time::Instant::now();
                        let mut to_remove = Vec::new();
                        
                        // Keep at least min_ready instances
                        let removable_count = queue.len().saturating_sub(min_ready);
                        
                        for (id, pooled) in instances_map.iter() {
                            if !pooled.allocated && 
                               removable_count > to_remove.len() &&
                               now.duration_since(pooled.last_used).as_secs() > max_idle_time {
                                to_remove.push(id.clone());
                            }
                        }
                        
                        // Remove idle instances
                        for id in to_remove {
                            if let Some(pooled) = instances_map.remove(&id) {
                                if let Ok(mut instance) = pooled.instance.lock() {
                                    let _ = instance.terminate();
                                }
                                queue.retain(|qid| qid != &id);
                            }
                        }
                    }
                }
            }
        });
        
        self.cleanup_handle = Some(handle);
    }
    
    /// Shutdown the pool and cleanup all instances
    pub fn shutdown(&mut self) -> Result<()> {
        // Stop cleanup task
        if let Some(handle) = self.cleanup_handle.take() {
            // In production, we'd use a proper shutdown mechanism
            // For now, the thread will be terminated when the process exits
            drop(handle);
        }
        
        // Terminate all instances
        if let Ok(mut instances) = self.instances.lock() {
            for (_, pooled) in instances.drain() {
                if let Ok(mut instance) = pooled.instance.lock() {
                    let _ = instance.terminate();
                }
            }
        }
        
        // Clear ready queue
        if let Ok(mut queue) = self.ready_instances.lock() {
            queue.clear();
        }
        
        Ok(())
    }
}

/// Pool statistics
#[derive(Debug, Clone)]
pub struct PoolStats {
    pub total_instances: usize,
    pub ready_instances: usize,
    pub allocated_instances: usize,
    pub config: PoolConfig,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_pool_creation() {
        let config = PoolConfig::default();
        let pool = InstancePool::new(config).unwrap();
        
        let stats = pool.get_stats();
        assert_eq!(stats.total_instances, 0);
        assert_eq!(stats.ready_instances, 0);
        assert_eq!(stats.allocated_instances, 0);
    }
    
    #[test]
    fn test_pool_acquire_release() {
        let config = PoolConfig {
            min_ready_instances: 0,
            max_pool_size: 5,
            max_idle_time_secs: 300,
            enable_prewarming: false,
            recycle_threshold: 10,
        };
        
        let pool = InstancePool::new(config).unwrap();
        let policy = ExecutionPolicy::default();
        
        // Acquire instance
        let (id1, _instance1) = pool.acquire(policy.clone()).unwrap();
        
        let stats = pool.get_stats();
        assert_eq!(stats.total_instances, 1);
        assert_eq!(stats.allocated_instances, 1);
        assert_eq!(stats.ready_instances, 0);
        
        // Release instance
        pool.release(id1.clone()).unwrap();
        
        let stats = pool.get_stats();
        assert_eq!(stats.total_instances, 1);
        assert_eq!(stats.allocated_instances, 0);
        assert_eq!(stats.ready_instances, 1);
        
        // Acquire again - should reuse the same instance
        let (id2, _instance2) = pool.acquire(policy).unwrap();
        assert_eq!(id1, id2);
    }
}