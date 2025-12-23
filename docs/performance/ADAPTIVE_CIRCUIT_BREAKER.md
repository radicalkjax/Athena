# Adaptive Circuit Breaker Implementation

**Last Updated:** December 2025
**Architecture:** Tauri 2.0 Desktop Application
**Implementation:** Rust (`src-tauri/src/ai_providers/circuit_breaker.rs`)
**Status:** Implemented

## Overview

The Athena platform implements a **Rust-based circuit breaker pattern** with automatic failure detection, state management, and recovery testing. The implementation protects AI provider integrations from cascading failures using three states (Closed, Open, HalfOpen) with configurable thresholds and Prometheus metrics integration.

## Key Features (December 2025)

### 1. Rust Implementation
- **Thread-Safe**: Uses `Arc<RwLock<CircuitState>>` for concurrent access
- **Atomic Counters**: `AtomicU32` for lock-free failure/success tracking
- **Type-Safe**: Leverages Rust's type system for state management
- **Zero-Cost Abstractions**: No runtime overhead

### 2. Three-State Machine
- **Closed**: Normal operation, tracks failures
- **Open**: Blocks requests, returns fast-fail errors
- **HalfOpen**: Tests recovery with limited requests

### 3. Automatic Recovery
- **Failure Threshold**: Opens after 3 consecutive failures
- **Success Threshold**: Closes after 2 successes in HalfOpen
- **Reset Timeout**: 30 seconds before HalfOpen retry
- **Provider-Specific**: Separate circuit per AI provider (Claude, OpenAI, DeepSeek, Gemini, Mistral, Groq)

### 4. Prometheus Metrics
- **AI_RATE_LIMIT_HITS**: Counter per provider when circuit is open
- **State Changes**: Logged for monitoring
- **Failure Counts**: Tracked for alerting

## Architecture

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#333333',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#333333',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#333333',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
graph TB
    subgraph "Circuit Breaker System"
        CB[AdaptiveCircuitBreaker<br/>━━━━━━━━<br/>• State Management<br/>• Failure Tracking<br/>• Adaptive Logic]
        
        subgraph "States"
            CLOSED[CLOSED<br/>━━━━━━━━<br/>• Normal Operation<br/>• Track Failures<br/>• Monitor Response Time]
            OPEN[OPEN<br/>━━━━━━━━<br/>• Block Requests<br/>• Fast Fail<br/>• Wait for Reset]
            HALF[HALF_OPEN<br/>━━━━━━━━<br/>• Test Requests<br/>• Limited Traffic<br/>• Evaluate Health]
        end
        
        subgraph "Features"
            ADAPT[Adaptive Thresholds<br/>━━━━━━━━<br/>• Response Time<br/>• Volume Based<br/>• Dynamic Adjust]
            BACKOFF[Backoff Strategies<br/>━━━━━━━━<br/>• Exponential<br/>• Linear<br/>• Fibonacci]
            METRICS[Metrics Collection<br/>━━━━━━━━<br/>• Success Rate<br/>• Response Time<br/>• State Changes]
        end
    end
    
    subgraph "Management Layer"
        FACTORY[CircuitBreakerFactory<br/>━━━━━━━━<br/>• Per-Endpoint Config<br/>• Instance Management<br/>• Centralized Control]
        APM[APM Integration<br/>━━━━━━━━<br/>• Observability<br/>• Alerting<br/>• Dashboards]
    end
    
    CB --> CLOSED
    CB --> OPEN
    CB --> HALF
    
    CLOSED --> OPEN
    OPEN --> HALF
    HALF --> CLOSED
    HALF --> OPEN
    
    CB --> ADAPT
    CB --> BACKOFF
    CB --> METRICS
    
    FACTORY --> CB
    METRICS --> APM
    
    style CB fill:#6d105a,color:#fff
    style CLOSED fill:#e8f4d4
    style OPEN fill:#f9d0c4
    style HALF fill:#f9d0c4
    style ADAPT fill:#6d105a,color:#fff
    style BACKOFF fill:#6d105a,color:#fff
    style METRICS fill:#6d105a,color:#fff
    style FACTORY fill:#e8f4d4
    style APM fill:#e8f4d4
```

## State Transitions

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#333333',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#333333',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#333333',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
stateDiagram-v2
    [*] --> CLOSED: Initial State
    
    CLOSED --> OPEN: Failure Threshold Exceeded OR Response Time Degraded
    CLOSED --> CLOSED: Success OR Acceptable Response Time
    
    OPEN --> HALF_OPEN: Reset Timeout Elapsed
    OPEN --> OPEN: Request Rejected (Fast Fail)
    
    HALF_OPEN --> CLOSED: Success Threshold Met
    HALF_OPEN --> OPEN: Any Failure OR Slow Response
    
    note right of CLOSED
        Normal operation
        Tracks failures and response times
    end note
    
    note right of OPEN
        Blocks all requests
        Returns immediate error
        Waits for reset timeout
    end note
    
    note right of HALF_OPEN
        Allows limited test traffic
        Evaluates service health
        Quick decision on state
    end note
```

### Components

1. **AdaptiveCircuitBreaker**: Enhanced circuit breaker with metrics
2. **CircuitBreakerFactory**: Manages per-endpoint instances
3. **Integration with APM**: Full observability

### Configuration

```typescript
// Default configuration
{
  // Basic thresholds
  failureThreshold: 3,
  successThreshold: 2,
  resetTimeout: 60000,
  
  // Adaptive features
  enableAdaptive: true,
  targetResponseTime: 1000,
  responseTimeThreshold: 2.0,
  
  // Backoff settings
  backoffStrategy: 'exponential',
  initialBackoff: 1000,
  maxBackoff: 300000,
  backoffJitter: true,
  
  // Volume thresholds
  minRequestVolume: 10,
  volumeWindow: 60000
}
```

### Per-Service Configuration

```typescript
// AI Services
'ai.claude.analyze': {
  targetResponseTime: 2000,
  responseTimeThreshold: 2.5,
  maxBackoff: 300000,
}

'ai.openai.analyze': {
  targetResponseTime: 1500,
  responseTimeThreshold: 3.0,
}

'ai.deepseek.analyze': {
  targetResponseTime: 3000,
  failureThreshold: 5, // More tolerant
}
```

## Usage

### Basic Usage

```typescript
import { circuitBreakerFactory } from '@/services/ai/circuitBreakerFactory';

// Execute with circuit breaker
const result = await circuitBreakerFactory.execute(
  'ai.claude.analyze',
  async () => {
    return await claudeService.analyze(data);
  }
);
```

### Direct Access

```typescript
// Get specific breaker
const breaker = circuitBreakerFactory.getBreaker('ai.openai.analyze');

// Execute operation
const result = await breaker.execute(async () => {
  return await openAIService.analyze(data);
});

// Check state
const state = breaker.getState(); // 'closed' | 'open' | 'half-open'

// Get statistics
const stats = breaker.getStats();
// {
//   state: 'closed',
//   failureCount: 0,
//   metrics: {
//     requestCount: 150,
//     avgResponseTime: 1250,
//     errorRate: 0.02
//   }
// }
```

## Request Flow

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#333333',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#333333',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#333333',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
sequenceDiagram
    participant Client
    participant Factory as CircuitBreakerFactory
    participant CB as CircuitBreaker
    participant Service as AI Service
    participant APM as APM System
    
    Client->>Factory: execute('ai.claude.analyze', fn)
    Factory->>CB: Get or create breaker
    
    alt Circuit is CLOSED
        CB->>CB: Check current state
        CB->>Service: Execute request
        Service-->>CB: Response
        CB->>CB: Update metrics
        CB->>APM: Track response time
        CB-->>Client: Return result
    else Circuit is OPEN
        CB->>CB: Check state
        CB->>APM: Track rejection
        CB-->>Client: Throw CircuitOpenError
    else Circuit is HALF_OPEN
        CB->>CB: Check test request
        CB->>Service: Execute test request
        alt Success
            Service-->>CB: Success response
            CB->>CB: Transition to CLOSED
            CB-->>Client: Return result
        else Failure
            Service-->>CB: Error
            CB->>CB: Transition to OPEN
            CB-->>Client: Throw error
        end
    end
```

## Monitoring

### Health Dashboard

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#333333',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#333333',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#333333',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
graph TB
    subgraph "Circuit Breaker Health"
        SUMMARY[Health Summary<br/>━━━━━━━━<br/>• Total Breakers: 6<br/>• Healthy: 5<br/>• Unhealthy: 1]
        
        subgraph "Per-Endpoint Status"
            E1[ai.claude.analyze<br/>━━━━━━━━<br/>State: OPEN ⚠️<br/>Error Rate: 15%<br/>Avg Response: 3500ms]
            E2[ai.openai.analyze<br/>━━━━━━━━<br/>State: CLOSED ✓<br/>Error Rate: 2%<br/>Avg Response: 1200ms]
            E3[ai.deepseek.analyze<br/>━━━━━━━━<br/>State: CLOSED ✓<br/>Error Rate: 3%<br/>Avg Response: 2800ms]
        end
        
        subgraph "Metrics"
            METRICS[Real-time Metrics<br/>━━━━━━━━<br/>• Request Count<br/>• Success Rate<br/>• Response Times<br/>• State Changes]
        end
    end
    
    SUMMARY --> E1
    SUMMARY --> E2
    SUMMARY --> E3
    
    E1 --> METRICS
    E2 --> METRICS
    E3 --> METRICS
    
    style SUMMARY fill:#6d105a,color:#fff
    style E1 fill:#f9d0c4
    style E2 fill:#e8f4d4
    style E3 fill:#e8f4d4
    style METRICS fill:#6d105a,color:#fff
```

### APM Integration

Circuit breaker events are automatically tracked:
- `circuit_breaker.opened` - When circuit opens
- `circuit_breaker.rejected` - Rejected requests
- `circuit_breaker.response_time` - Response time histogram

### Metrics Dashboard

```typescript
const health = circuitBreakerFactory.getHealthSummary();
const allStats = circuitBreakerFactory.getAllStats();
```

## Failure Scenarios

### 1. Threshold-Based Opening
- After 3 consecutive failures (configurable)
- Circuit opens immediately
- Backoff period begins

### 2. Adaptive Opening
- Response time exceeds 2x target
- With minimum 10 requests in window
- Prevents performance degradation

### 3. Recovery Process
1. **Open State**: All requests fail fast
2. **Half-Open State**: Limited test requests
3. **Closed State**: Normal operation resumes

## Backoff Strategies

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#333333',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#333333',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#333333',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
graph LR
    subgraph "Backoff Types"
        EXP[Exponential<br/>━━━━━━━━<br/>1s → 2s → 4s → 8s<br/>Multiplier: 2.0]
        LIN[Linear<br/>━━━━━━━━<br/>1s → 2s → 3s → 4s<br/>Increment: 1s]
        FIB[Fibonacci<br/>━━━━━━━━<br/>1s → 1s → 2s → 3s → 5s<br/>Natural growth]
    end
    
    subgraph "Enhancements"
        JITTER[Jitter<br/>━━━━━━━━<br/>±20% random<br/>Prevents thundering herd]
        MAX[Max Backoff<br/>━━━━━━━━<br/>Cap at 5 minutes<br/>Prevents infinite wait]
    end
    
    EXP --> JITTER
    LIN --> JITTER
    FIB --> JITTER
    
    JITTER --> MAX
    
    style EXP fill:#6d105a,color:#fff
    style LIN fill:#6d105a,color:#fff
    style FIB fill:#6d105a,color:#fff
    style JITTER fill:#f9d0c4
    style MAX fill:#e8f4d4
```

## Best Practices

### 1. Configuration
- Set realistic response time targets
- Use higher thresholds for backup services
- Enable jitter for distributed systems

### 2. Monitoring
- Track circuit breaker metrics
- Alert on sustained open states
- Monitor recovery patterns

### 3. Testing
- Load test with circuit breakers enabled
- Verify failover behavior
- Test recovery scenarios

## Load Testing

Use the k6 load tests to verify circuit breaker behavior:

```bash
# Test AI failover scenarios
npm run load-test:failover

# Full stress test
npm run load-test:stress
```

## Troubleshooting

### Circuit Won't Close
1. Check if service is actually healthy
2. Verify success threshold is reasonable
3. Check backoff multiplier hasn't grown too large

### Too Many Rejections
1. Increase failure threshold
2. Adjust response time targets
3. Consider disabling adaptive thresholds

### Performance Impact
- Circuit breaker adds <1ms overhead
- Metrics collection is asynchronous
- Memory usage scales with request history

## Future Enhancements

1. **Machine Learning**: Predict failures before they occur
2. **Distributed State**: Share circuit state across instances
3. **Custom Strategies**: Plugin architecture for backoff
4. **Advanced Metrics**: Percentile tracking, SLO integration