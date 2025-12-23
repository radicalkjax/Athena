use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::metrics::AI_QUEUE_SIZE;

/// In-memory queue manager for tracking pending AI analysis requests
/// Per DeepWiki guidance for Tauri desktop apps: use in-memory queues, NOT Redis
pub struct QueueManager {
    /// Track pending request count per provider
    pending_counts: Arc<RwLock<HashMap<String, usize>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        Self {
            pending_counts: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Increment queue size when a request starts
    pub async fn enqueue(&self, provider: &str) {
        let mut counts = self.pending_counts.write().await;
        let count = counts.entry(provider.to_string()).or_insert(0);
        *count += 1;

        // Update Prometheus metric per DeepWiki: use .set() with actual queue length
        AI_QUEUE_SIZE
            .with_label_values(&[provider])
            .set(*count as f64);
    }

    /// Decrement queue size when a request completes
    pub async fn dequeue(&self, provider: &str) {
        let mut counts = self.pending_counts.write().await;
        if let Some(count) = counts.get_mut(provider) {
            if *count > 0 {
                *count -= 1;

                // Update Prometheus metric per DeepWiki: use .set() with actual queue length
                AI_QUEUE_SIZE
                    .with_label_values(&[provider])
                    .set(*count as f64);
            }
        }
    }

    /// Get current queue size for a provider
    pub async fn get_queue_size(&self, provider: &str) -> usize {
        let counts = self.pending_counts.read().await;
        counts.get(provider).copied().unwrap_or(0)
    }

    /// Reset queue size for a provider (useful for error recovery)
    pub async fn reset_queue(&self, provider: &str) {
        let mut counts = self.pending_counts.write().await;
        counts.insert(provider.to_string(), 0);

        AI_QUEUE_SIZE
            .with_label_values(&[provider])
            .set(0.0);
    }
}

impl Default for QueueManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_queue_operations() {
        let qm = QueueManager::new();

        // Test enqueue
        qm.enqueue("claude").await;
        assert_eq!(qm.get_queue_size("claude").await, 1);

        qm.enqueue("claude").await;
        assert_eq!(qm.get_queue_size("claude").await, 2);

        // Test dequeue
        qm.dequeue("claude").await;
        assert_eq!(qm.get_queue_size("claude").await, 1);

        qm.dequeue("claude").await;
        assert_eq!(qm.get_queue_size("claude").await, 0);

        // Test dequeue on empty queue (should not panic)
        qm.dequeue("claude").await;
        assert_eq!(qm.get_queue_size("claude").await, 0);
    }

    #[tokio::test]
    async fn test_multiple_providers() {
        let qm = QueueManager::new();

        qm.enqueue("claude").await;
        qm.enqueue("openai").await;
        qm.enqueue("claude").await;

        assert_eq!(qm.get_queue_size("claude").await, 2);
        assert_eq!(qm.get_queue_size("openai").await, 1);
        assert_eq!(qm.get_queue_size("deepseek").await, 0);
    }
}
