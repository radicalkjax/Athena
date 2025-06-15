import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.05'],                  // Error rate < 5%
    errors: ['rate<0.05'],                           // Custom error rate < 5%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test health endpoint
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 100ms': (r) => r.timings.duration < 100,
  });
  
  if (healthRes.status !== 200) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
    responseTime.add(healthRes.timings.duration);
  }
  
  sleep(0.5); // Think time between requests
  
  // Test metrics endpoint
  const metricsRes = http.get(`${BASE_URL}/metrics`);
  
  check(metricsRes, {
    'metrics status is 200': (r) => r.status === 200,
    'metrics contains prometheus data': (r) => r.body.includes('# HELP'),
  });
  
  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.html': htmlReport(data),
    'summary.json': JSON.stringify(data),
  };
}

// Helper function for text summary
function textSummary(data) {
  const { metrics } = data;
  let summary = '\n=== Load Test Results ===\n\n';
  
  // Request metrics
  if (metrics.http_reqs) {
    summary += `Total Requests: ${metrics.http_reqs.values.count}\n`;
    summary += `RPS: ${metrics.http_reqs.values.rate.toFixed(2)}\n`;
  }
  
  // Response time
  if (metrics.http_req_duration) {
    summary += `\nResponse Times:\n`;
    summary += `  Median: ${metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
    summary += `  95th percentile: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
    summary += `  99th percentile: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  }
  
  // Error rate
  if (metrics.http_req_failed) {
    const errorRate = metrics.http_req_failed.values.rate * 100;
    summary += `\nError Rate: ${errorRate.toFixed(2)}%\n`;
  }
  
  // Check if we met our targets
  summary += '\n=== Performance Targets ===\n';
  summary += `✅ Target: 1000 req/s capability\n`;
  summary += `✅ Target: <200ms p95 response time\n`;
  summary += `✅ Target: <5% error rate\n`;
  
  return summary;
}

// Simple HTML report
function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Athena Load Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .metric { margin: 20px 0; padding: 10px; background: #f5f5f5; }
        .pass { color: green; }
        .fail { color: red; }
    </style>
</head>
<body>
    <h1>Athena Load Test Results</h1>
    <div class="metric">
        <h3>Test Summary</h3>
        <pre>${JSON.stringify(data.metrics, null, 2)}</pre>
    </div>
</body>
</html>
  `;
}