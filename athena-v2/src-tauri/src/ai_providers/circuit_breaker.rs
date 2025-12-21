use std::sync::Arc;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use crate::metrics::AI_RATE_LIMIT_HITS;

#[derive(Debug, Clone)]
pub enum CircuitState {
    Closed,
    Open(Instant),
    HalfOpen,
}

pub struct CircuitBreaker {
    provider_name: String,
    failure_threshold: u32,
    success_threshold: u32,
    timeout: Duration,

    failure_count: AtomicU32,
    success_count: AtomicU32,
    last_failure_time: AtomicU64,
    state: Arc<RwLock<CircuitState>>,
}

impl CircuitBreaker {
    pub fn new_with_name(provider_name: String, failure_threshold: u32, success_threshold: u32, timeout_secs: u64) -> Self {
        Self {
            provider_name,
            failure_threshold,
            success_threshold,
            timeout: Duration::from_secs(timeout_secs),
            failure_count: AtomicU32::new(0),
            success_count: AtomicU32::new(0),
            last_failure_time: AtomicU64::new(0),
            state: Arc::new(RwLock::new(CircuitState::Closed)),
        }
    }

    pub async fn call<F, T>(&self, f: F) -> Result<T, Box<dyn std::error::Error + Send + Sync>>
    where
        F: std::future::Future<Output = Result<T, Box<dyn std::error::Error + Send + Sync>>>,
    {
        let current_state = self.get_state().await;

        match current_state {
            CircuitState::Open(opened_at) => {
                if opened_at.elapsed() >= self.timeout {
                    self.transition_to_half_open().await;
                } else {
                    // Record rate limit hit when circuit is open
                    AI_RATE_LIMIT_HITS
                        .with_label_values(&[&self.provider_name])
                        .inc();

                    return Err(Box::new(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        "Circuit breaker is open",
                    )) as Box<dyn std::error::Error + Send + Sync>);
                }
            }
            _ => {}
        }

        let result = f.await;
        
        match result {
            Ok(value) => {
                self.on_success().await;
                Ok(value)
            }
            Err(error) => {
                self.on_failure().await;
                Err(error)
            }
        }
    }

    async fn get_state(&self) -> CircuitState {
        self.state.read().await.clone()
    }

    async fn on_success(&self) {
        let mut state = self.state.write().await;
        
        match &*state {
            CircuitState::HalfOpen => {
                let success_count = self.success_count.fetch_add(1, Ordering::SeqCst) + 1;
                if success_count >= self.success_threshold {
                    *state = CircuitState::Closed;
                    self.failure_count.store(0, Ordering::SeqCst);
                    self.success_count.store(0, Ordering::SeqCst);
                }
            }
            CircuitState::Closed => {
                self.failure_count.store(0, Ordering::SeqCst);
            }
            _ => {}
        }
    }

    async fn on_failure(&self) {
        let mut state = self.state.write().await;
        
        match &*state {
            CircuitState::Closed => {
                let failure_count = self.failure_count.fetch_add(1, Ordering::SeqCst) + 1;
                if failure_count >= self.failure_threshold {
                    *state = CircuitState::Open(Instant::now());
                    self.last_failure_time.store(
                        std::time::SystemTime::now()
                            .duration_since(std::time::UNIX_EPOCH)
                            .unwrap()
                            .as_secs(),
                        Ordering::SeqCst,
                    );
                }
            }
            CircuitState::HalfOpen => {
                *state = CircuitState::Open(Instant::now());
                self.failure_count.store(0, Ordering::SeqCst);
                self.success_count.store(0, Ordering::SeqCst);
            }
            _ => {}
        }
    }

    async fn transition_to_half_open(&self) {
        let mut state = self.state.write().await;
        *state = CircuitState::HalfOpen;
        self.success_count.store(0, Ordering::SeqCst);
    }

    #[allow(dead_code)]
    pub async fn is_open(&self) -> bool {
        matches!(*self.state.read().await, CircuitState::Open(_))
    }

    /// Get the current state as a string for status reporting
    pub async fn get_state_string(&self) -> String {
        match *self.state.read().await {
            CircuitState::Closed => "closed".to_string(),
            CircuitState::Open(_) => "open".to_string(),
            CircuitState::HalfOpen => "half_open".to_string(),
        }
    }

    #[allow(dead_code)]
    pub async fn reset(&self) {
        let mut state = self.state.write().await;
        *state = CircuitState::Closed;
        self.failure_count.store(0, Ordering::SeqCst);
        self.success_count.store(0, Ordering::SeqCst);
    }
}