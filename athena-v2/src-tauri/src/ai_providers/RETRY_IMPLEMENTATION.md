# Retry with Exponential Backoff Implementation

## Overview

This implementation adds robust retry logic with exponential backoff to all AI providers (Claude, OpenAI, DeepSeek) to handle transient failures gracefully.

## Features

### 1. Retry Configuration
- **Max Retries**: 5 attempts (configurable)
- **Initial Delay**: 1000ms (1 second)
- **Max Delay**: 30000ms (30 seconds)
- **Backoff Multiplier**: 2.0 (exponential)

### 2. Error Classification

The retry logic intelligently classifies errors into **retryable** and **non-retryable** categories:

#### Retryable Errors (will retry):
- **Network errors**: timeout, connection issues, DNS failures
- **Rate limiting**: 429 Too Many Requests
- **Server errors**: 500, 502, 503, 504 (5xx responses)
- **Temporary unavailability**: overloaded, capacity issues

#### Non-Retryable Errors (immediate failure):
- **Authentication errors**: 401 Unauthorized, 403 Forbidden
- **Validation errors**: 400 Bad Request, 422 Unprocessable Entity
- **API key issues**: invalid credentials
- **Unknown errors**: default to no retry for safety

### 3. Exponential Backoff

The delay between retries follows an exponential backoff pattern:
- Attempt 1: Immediate
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay
- Attempt 5: 8s delay
- Attempt 6: 16s delay (capped at 30s max)

## Implementation Details

### Module Structure

```
ai_providers/
├── retry.rs           # Retry logic with exponential backoff
├── claude.rs          # Claude provider with retry
├── openai.rs          # OpenAI provider with retry
├── deepseek.rs        # DeepSeek provider with retry
├── circuit_breaker.rs # Existing circuit breaker (unchanged)
└── mod.rs             # Module exports
```

### Integration with Circuit Breaker

The retry logic is integrated **inside** the circuit breaker pattern:

```
Request Flow:
1. Circuit Breaker checks state (Open/Closed/HalfOpen)
2. If allowed, retry wrapper executes
3. Retry logic handles transient failures
4. Circuit Breaker records success/failure
```

This ensures:
- Circuit breaker still protects against cascading failures
- Retry logic handles individual request failures
- Both patterns work together for robust error handling

### Usage Example

```rust
// In provider's analyze() method
let analysis_result = self.circuit_breaker.call(async {
    with_retry(
        &self.retry_config,
        || async {
            // Make API call
            let response = self.client.post(url)
                .send()
                .await?;

            // Check status and return result
            if !response.status().is_success() {
                return Err(format!("API error ({})", response.status()).into());
            }

            // Process response
            Ok(result)
        },
        "ProviderName",
    ).await
}).await;
```

## Logging

The retry logic provides detailed logging:

```
[WARN] Claude request failed on attempt 1/6: Connection timeout - retrying in 1000ms
[WARN] Claude request failed on attempt 2/6: Connection timeout - retrying in 2000ms
[INFO] Claude request succeeded on attempt 3/6
```

Or for non-retryable errors:
```
[WARN] OpenAI request failed with non-retryable error: Unauthorized (401)
```

After exhausting retries:
```
[ERROR] DeepSeek request failed after 6 attempts: Service unavailable (503)
```

## Configuration Customization

Each provider can customize its retry behavior:

```rust
let retry_config = RetryConfig {
    max_retries: 3,              // Fewer retries for faster failure
    initial_delay_ms: 500,       // Start with 500ms delay
    max_delay_ms: 10000,         // Cap at 10s instead of 30s
    backoff_multiplier: 1.5,     // Slower backoff growth
};
```

## Testing Scenarios

### Scenario 1: Success on First Attempt
```
Request → Success
Total attempts: 1
Total time: API response time
```

### Scenario 2: Transient Failure, Then Success
```
Attempt 1 → Timeout (retry after 1s)
Attempt 2 → Timeout (retry after 2s)
Attempt 3 → Success
Total attempts: 3
Total time: API response time + 3s retry delays
```

### Scenario 3: Non-Retryable Error
```
Attempt 1 → 401 Unauthorized
Total attempts: 1
Total time: API response time (no retry)
```

### Scenario 4: All Retries Exhausted
```
Attempt 1 → 503 (retry after 1s)
Attempt 2 → 503 (retry after 2s)
Attempt 3 → 503 (retry after 4s)
Attempt 4 → 503 (retry after 8s)
Attempt 5 → 503 (retry after 16s)
Attempt 6 → 503 (final failure)
Total attempts: 6
Total time: API response times + 31s retry delays
```

## Benefits

1. **Improved Reliability**: Transient network issues don't cause immediate failure
2. **Better User Experience**: Requests succeed more often without user intervention
3. **Cost Efficiency**: Reduces wasted API calls by backing off appropriately
4. **Rate Limit Friendly**: Exponential backoff prevents hammering rate-limited APIs
5. **Fully Implemented**: Smart error classification prevents infinite retries

## Metrics Integration

The retry logic works seamlessly with existing Prometheus metrics:
- Failed attempts are logged but not counted until final failure
- Only the final result (success/failure) increments metrics
- Processing time includes all retry delays

## Performance Impact

### Best Case (Success on First Try)
- No overhead
- Same performance as before

### Typical Case (1-2 Retries)
- 1-3 seconds additional latency
- Much better than user having to retry manually

### Worst Case (All Retries Exhausted)
- ~31 seconds additional latency
- Still better than immediate failure in production

## Future Enhancements

Potential improvements for future versions:
1. Jitter in delay times to prevent thundering herd
2. Adaptive backoff based on error type
3. Per-endpoint retry configuration
4. Retry budget to limit total retry time
5. Structured logging with correlation IDs
