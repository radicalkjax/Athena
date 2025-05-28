# APM (Application Performance Monitoring) Integration

## Overview

Athena includes comprehensive Application Performance Monitoring (APM) to track performance, errors, and business metrics in production. The APM system provides real-time insights into application behavior and helps identify performance bottlenecks.

## Features

- **Distributed Tracing**: Track requests across multiple services
- **Performance Metrics**: Monitor response times, throughput, and resource usage
- **Error Tracking**: Automatic error detection and reporting
- **Business Metrics**: Track file analyses, vulnerabilities found, and malware detected
- **Circuit Breaker Monitoring**: Track provider health and failover events
- **Cache Performance**: Monitor hit rates and operation times
- **Custom Metrics**: Record application-specific measurements

## Configuration

### Environment Variables

```env
# Enable APM
APM_ENABLED=true

# Choose provider: console, statsd, datadog, newrelic
APM_PROVIDER=statsd

# Provider-specific settings
APM_ENDPOINT=http://localhost:8125
APM_API_KEY=your_api_key_here

# Sampling rate (0.0 to 1.0)
APM_SAMPLE_RATE=0.1  # 10% sampling in production
```

### Providers

#### Console Provider (Development)
- Outputs metrics to console
- No external dependencies
- Good for local development

#### StatsD Provider (Production)
- Compatible with DataDog, New Relic, and other StatsD servers
- UDP-based for low overhead
- Supports custom tags

## Architecture

### APM Manager
Central orchestrator for all monitoring activities:

```typescript
// Automatic initialization
import { initializeAPM } from '@/services/apm/init';
await initializeAPM();

// Manual metric recording
import { apmManager } from '@/services/apm/manager';
apmManager.recordAnalysis('claude', 'deobfuscate', 1500, true);
```

### Instrumentation Points

1. **AI Analysis**
   - Provider used
   - Analysis type
   - Response time
   - Success/failure
   - Cache hit/miss

2. **Cache Operations**
   - Hit/miss rates
   - Operation duration
   - Eviction counts
   - Storage size

3. **Circuit Breakers**
   - State changes (open/close)
   - Failure counts
   - Recovery events

4. **API Requests**
   - Endpoint
   - Method
   - Status code
   - Response time

## Metrics Reference

### System Metrics
- `memory.heap.used` - Heap memory usage
- `memory.heap.total` - Total heap size
- `memory.rss` - Resident set size
- `cache.size` - Cache storage size
- `cache.hit_rate` - Cache hit percentage

### AI Analysis Metrics
- `ai.analysis.duration` - Analysis time by provider/type
- `ai.analysis.total` - Total analyses count
- `ai.analysis.error` - Failed analyses count

### Circuit Breaker Metrics
- `circuit_breaker.event` - State change events
- `circuit_breaker.state.{provider}` - Current state (0=closed, 1=open)

### Business Metrics
- `files.analyzed` - Files analyzed by type
- `vulnerabilities.found` - Vulnerabilities by severity
- `malware.detected` - Malware detections by type

## Usage Examples

### Basic Span Tracking
```typescript
const span = apmManager.startSpan('custom.operation');
try {
  // Your operation
  span.status = 'ok';
} catch (error) {
  span.status = 'error';
  span.error = error;
} finally {
  apmManager.finishSpan(span);
}
```

### Convenience Method
```typescript
const result = await apmManager.withSpan(
  'database.query',
  async () => {
    return await db.query('SELECT * FROM users');
  },
  { query_type: 'select' }
);
```

### Custom Metrics
```typescript
// Counter
apmManager.counter('user.login', 1, { method: 'oauth' });

// Gauge
apmManager.gauge('queue.size', 42);

// Histogram
apmManager.histogram('file.size', 1024 * 1024, { type: 'exe' });

// Timer
apmManager.timer('api.latency', 150, { endpoint: '/analyze' });
```

## DataDog Integration

### Setup
1. Install DataDog Agent
2. Configure StatsD listener (port 8125)
3. Set environment variables:
   ```env
   APM_ENABLED=true
   APM_PROVIDER=statsd
   APM_ENDPOINT=localhost:8125
   ```

### Custom Dashboards
Create dashboards for:
- AI provider performance comparison
- Cache efficiency monitoring
- Circuit breaker health
- Error rates by component

## Performance Impact

- **Minimal Overhead**: ~1-2ms per metric
- **Async Operations**: Non-blocking metric sending
- **Sampling**: Reduce overhead with sampling in production
- **Batching**: Metrics batched before sending

## Best Practices

1. **Use Sampling**: Set `APM_SAMPLE_RATE=0.1` in production
2. **Tag Appropriately**: Add relevant context to metrics
3. **Monitor Key Paths**: Focus on critical user journeys
4. **Set Alerts**: Configure alerts for anomalies
5. **Regular Review**: Analyze trends weekly

## Troubleshooting

### Metrics Not Appearing
1. Check `APM_ENABLED=true`
2. Verify endpoint connectivity
3. Check provider logs
4. Ensure API key is valid

### High Overhead
1. Reduce sample rate
2. Disable verbose metrics
3. Increase flush interval
4. Use UDP transport

### Memory Leaks
APM system monitors itself:
```typescript
const stats = memoryProfiler.getMemoryStats();
if (stats.baseline && stats.current) {
  const growth = stats.current.heapUsed - stats.baseline.heapUsed;
  console.log(`Memory growth: ${growth} bytes`);
}
```

## Future Enhancements

- [ ] OpenTelemetry support
- [ ] Prometheus exporter
- [ ] Real-time alerting
- [ ] Anomaly detection
- [ ] Performance budgets