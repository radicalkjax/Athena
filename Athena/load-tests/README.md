# Athena Load Testing Suite

This directory contains comprehensive load tests for the Athena malware analysis platform using [k6](https://k6.io/).

## Prerequisites

### 1. Install k6
```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6
```

### 2. Start Required Services
```bash
# From the Athena directory
cd /workspaces/Athena/Athena

# Start Redis (required for cache testing)
docker-compose up -d redis

# Start the application
npm run dev
```

## Test Scenarios

### 1. Analysis Endpoint Load Test (`analysis.js`)
Tests the main malware analysis API with:
- File upload simulation
- Multiple AI models
- Various container configurations
- Result polling with exponential backoff
- Cache hit tracking

**Stages:**
- 30s warm-up (10 users)
- 2m ramp-up (50 users)
- 5m sustained load (100 users)
- 2m peak load (150 users)
- 1m cool-down (50 users)
- 30s ramp-down

### 2. Streaming Analysis Test (`streaming-analysis.js`)
Tests WebSocket-based real-time analysis:
- WebSocket connection management
- Progress tracking
- Partial result handling
- Batch analysis scenarios

**Stages:**
- Similar to analysis test but with up to 300 concurrent connections

### 3. AI Failover Test (`ai-failover.js`)
Tests AI service resilience:
- Primary service failures
- Automatic failover to secondary models
- Circuit breaker behavior
- Cache effectiveness
- Recovery patterns

**Scenarios:**
- Normal load: Constant 10 req/s
- Spike load: Ramps to 100 req/s
- Sustained load: Constant 50 req/s for 3 minutes

## Running Tests

### Quick Start
```bash
# Run the test runner
./run-tests.sh

# Or run individual tests
k6 run analysis.js
k6 run streaming-analysis.js
k6 run ai-failover.js
```

### With Custom Parameters
```bash
# Custom base URL
k6 run -e BASE_URL=https://staging.athena.app analysis.js

# Custom VUs and duration
k6 run --vus 50 --duration 10m analysis.js

# Export metrics to JSON
k6 run --out json=results.json analysis.js
```

### Using Docker
```bash
docker run --rm -i \
  --network host \
  -v "$PWD:/scripts" \
  grafana/k6 run /scripts/analysis.js
```

## Interpreting Results

### Key Metrics

1. **http_req_duration**: Response time percentiles
   - Target: p(95) < 3000ms

2. **http_req_failed**: Overall failure rate
   - Target: < 10%

3. **analysis_errors**: Analysis-specific failures
   - Target: < 5%

4. **cache_hit_rate**: Cache effectiveness
   - Target: > 80% after warm-up

5. **failover_events**: Number of AI service failovers
   - Target: < 50 during entire test

### Example Output
```
✓ submission successful
✓ has analysis ID
✓ status check successful
✓ has valid status

checks.........................: 98.45% ✓ 12834  ✗ 198
data_received..................: 2.1 GB 6.8 MB/s
data_sent......................: 892 MB 2.9 MB/s
http_req_blocked...............: avg=1.2ms   p(95)=3.4ms
http_req_duration..............: avg=823ms   p(95)=2.1s
  { expected_response:true }...: avg=798ms   p(95)=1.9s
http_req_failed................: 2.10%  ✓ 273    ✗ 12761
http_reqs......................: 13034  42.3/s
iteration_duration.............: avg=4.2s    p(95)=8.7s
iterations.....................: 3258   10.6/s
vus............................: 1      min=1    max=150
vus_max........................: 150    min=150  max=150
```

## Performance Targets

Based on Phase 9 objectives:

| Metric | Target | Current |
|--------|--------|---------|
| Concurrent Analyses | 100+ | TBD |
| P95 Response Time | < 3s | TBD |
| Error Rate | < 5% | TBD |
| Cache Hit Rate | > 80% | TBD |
| Failover Success | > 90% | TBD |

## Troubleshooting

### "Connection refused" errors
- Ensure the application is running on the expected port
- Check `BASE_URL` environment variable
- Verify Docker containers are running

### WebSocket connection failures
- Check `WS_URL` is correct
- Ensure WebSocket support is enabled
- Check for proxy/firewall issues

### High error rates
- Monitor application logs for errors
- Check Redis connectivity
- Verify AI service API keys are configured

### Memory issues during tests
```bash
# Increase k6 memory limit
k6 run --max-memory 2G analysis.js
```

## Continuous Load Testing

For production monitoring, consider:

1. **Scheduled runs**: Use cron or CI/CD pipelines
2. **Grafana Cloud k6**: SaaS solution for continuous testing
3. **Custom dashboards**: Export metrics to Prometheus/Grafana

## Next Steps

1. **Baseline Performance**: Run tests to establish current metrics
2. **Identify Bottlenecks**: Use APM data to find slow paths
3. **Optimize**: Implement improvements based on findings
4. **Re-test**: Verify improvements with load tests
5. **Monitor**: Set up continuous testing in production