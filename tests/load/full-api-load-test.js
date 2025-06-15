import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { SharedArray } from 'k6/data';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const wasmLoadTime = new Trend('wasm_load_time');
const analysisTime = new Trend('analysis_time');
const cacheHitRate = new Rate('cache_hits');
const aiProviderErrors = new Counter('ai_provider_errors');

// Test configuration for full integration test
export const options = {
  scenarios: {
    // Scenario 1: Gradual ramp-up
    gradual_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },    // Warm up
        { duration: '2m', target: 200 },   // Ramp to normal load
        { duration: '3m', target: 500 },   // Increase load
        { duration: '2m', target: 1000 },  // Peak load (1000 req/s target)
        { duration: '2m', target: 500 },   // Scale down
        { duration: '1m', target: 0 },     // Cool down
      ],
      gracefulRampDown: '30s',
    },
    // Scenario 2: Spike test
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '10s', target: 1500 },  // Sudden spike
        { duration: '30s', target: 1500 },  // Maintain spike
        { duration: '10s', target: 100 },   // Drop back
        { duration: '30s', target: 0 },
      ],
      startTime: '12m',  // Start after gradual load test
    },
    // Scenario 3: Sustained load
    sustained_load: {
      executor: 'constant-vus',
      vus: 300,
      duration: '5m',
      startTime: '20m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // Response time targets
    http_req_failed: ['rate<0.05'],                   // Error rate < 5%
    errors: ['rate<0.05'],                            // Custom error rate
    wasm_load_time: ['p(95)<100'],                   // WASM load < 100ms
    analysis_time: ['p(95)<2000'],                   // Analysis < 2s
    cache_hits: ['rate>0.5'],                         // Cache hit rate > 50%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-api-key';

// Sample files for analysis (base64 encoded small samples)
const testFiles = new SharedArray('files', function () {
  return [
    {
      name: 'test.exe',
      content: 'TVqQAAMAAAAEAAAA//8AALgAAAAAAAAAQAAAAAAAAAA=', // PE header
      type: 'application/octet-stream',
    },
    {
      name: 'script.js',
      content: Buffer.from('console.log("test malware");').toString('base64'),
      type: 'text/javascript',
    },
    {
      name: 'doc.pdf',
      content: 'JVBERi0xLjQKJeLjz9MKCg==', // PDF header
      type: 'application/pdf',
    },
  ];
});

// Headers for API requests
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

export default function () {
  const file = testFiles[Math.floor(Math.random() * testFiles.length)];
  const testId = `test-${Date.now()}-${Math.random()}`;
  
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`, { tags: { name: 'health' } });
  
  check(healthRes, {
    'health check ok': (r) => r.status === 200,
  }) || errorRate.add(1);
  
  sleep(0.1);
  
  // Test 2: Upload file for analysis
  const uploadPayload = JSON.stringify({
    file: {
      name: file.name,
      content: file.content,
      type: file.type,
    },
    options: {
      deepAnalysis: Math.random() > 0.5,
      aiProvider: ['claude', 'deepseek', 'openai'][Math.floor(Math.random() * 3)],
      enableSandbox: Math.random() > 0.7,
    },
  });
  
  const uploadStart = Date.now();
  const uploadRes = http.post(
    `${BASE_URL}/api/v1/analysis/upload`,
    uploadPayload,
    { 
      headers,
      tags: { name: 'upload' },
      timeout: '30s',
    }
  );
  
  const uploadSuccess = check(uploadRes, {
    'upload successful': (r) => r.status === 200 || r.status === 201,
    'upload returns analysis id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.analysisId !== undefined;
      } catch {
        return false;
      }
    },
  });
  
  if (!uploadSuccess) {
    errorRate.add(1);
    aiProviderErrors.add(1);
    return;
  }
  
  const uploadDuration = Date.now() - uploadStart;
  analysisTime.add(uploadDuration);
  
  // Parse response
  let analysisId;
  try {
    const body = JSON.parse(uploadRes.body);
    analysisId = body.analysisId;
  } catch {
    errorRate.add(1);
    return;
  }
  
  sleep(0.5);
  
  // Test 3: Check analysis status (polling)
  let analysisComplete = false;
  let attempts = 0;
  const maxAttempts = 20;
  
  while (!analysisComplete && attempts < maxAttempts) {
    const statusRes = http.get(
      `${BASE_URL}/api/v1/analysis/${analysisId}/status`,
      { 
        headers,
        tags: { name: 'status' },
      }
    );
    
    const statusCheck = check(statusRes, {
      'status check ok': (r) => r.status === 200,
      'status has progress': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.status !== undefined;
        } catch {
          return false;
        }
      },
    });
    
    if (!statusCheck) {
      errorRate.add(1);
      break;
    }
    
    try {
      const body = JSON.parse(statusRes.body);
      if (body.status === 'completed' || body.status === 'failed') {
        analysisComplete = true;
      }
      
      // Check for cache hit
      if (body.cached) {
        cacheHitRate.add(1);
      } else {
        cacheHitRate.add(0);
      }
    } catch {
      errorRate.add(1);
      break;
    }
    
    attempts++;
    sleep(1);
  }
  
  // Test 4: Get full analysis results
  if (analysisComplete) {
    const resultsRes = http.get(
      `${BASE_URL}/api/v1/analysis/${analysisId}/results`,
      { 
        headers,
        tags: { name: 'results' },
      }
    );
    
    check(resultsRes, {
      'results retrieved': (r) => r.status === 200,
      'results contain threat data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.threatLevel !== undefined && body.analysis !== undefined;
        } catch {
          return false;
        }
      },
    }) || errorRate.add(1);
  }
  
  sleep(0.2);
  
  // Test 5: WASM module performance
  const wasmStart = Date.now();
  const wasmRes = http.post(
    `${BASE_URL}/api/v1/wasm/analyze`,
    JSON.stringify({
      module: 'pattern-matcher',
      data: file.content,
    }),
    { 
      headers,
      tags: { name: 'wasm' },
    }
  );
  
  const wasmDuration = Date.now() - wasmStart;
  
  check(wasmRes, {
    'wasm analysis ok': (r) => r.status === 200,
    'wasm response fast': (r) => r.timings.duration < 100,
  }) || errorRate.add(1);
  
  wasmLoadTime.add(wasmDuration);
  
  // Test 6: Batch analysis
  if (Math.random() > 0.8) {  // 20% of requests
    const batchPayload = JSON.stringify({
      files: testFiles.map(f => ({
        name: f.name,
        content: f.content,
        type: f.type,
      })),
      options: {
        deepAnalysis: false,
        aiProvider: 'claude',
      },
    });
    
    const batchRes = http.post(
      `${BASE_URL}/api/v1/analysis/batch`,
      batchPayload,
      { 
        headers,
        tags: { name: 'batch' },
        timeout: '60s',
      }
    );
    
    check(batchRes, {
      'batch analysis accepted': (r) => r.status === 202 || r.status === 200,
    }) || errorRate.add(1);
  }
  
  // Test 7: Metrics endpoint (Prometheus)
  if (Math.random() > 0.9) {  // 10% of requests
    const metricsRes = http.get(`${BASE_URL}/metrics`, { tags: { name: 'metrics' } });
    
    check(metricsRes, {
      'metrics available': (r) => r.status === 200,
      'metrics valid prometheus': (r) => r.body.includes('# HELP'),
    });
  }
}

export function handleSummary(data) {
  const summary = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'full-load-test-results.json': JSON.stringify(data, null, 2),
    'full-load-test-results.html': generateHTMLReport(data),
  };
  
  // Add custom summary
  console.log('\n=== Athena Load Test Summary ===\n');
  console.log(`Total Requests: ${data.metrics.http_reqs?.values?.count || 0}`);
  console.log(`Average RPS: ${data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0}`);
  console.log(`Error Rate: ${(data.metrics.errors?.values?.rate * 100)?.toFixed(2) || 0}%`);
  console.log(`Cache Hit Rate: ${(data.metrics.cache_hits?.values?.rate * 100)?.toFixed(2) || 0}%`);
  console.log(`P95 Response Time: ${data.metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms`);
  console.log(`P95 WASM Load Time: ${data.metrics.wasm_load_time?.values?.['p(95)']?.toFixed(2) || 0}ms`);
  
  // Check if we met our targets
  const targets = {
    rps: data.metrics.http_reqs?.values?.rate >= 1000,
    errorRate: data.metrics.errors?.values?.rate < 0.05,
    responseTime: data.metrics.http_req_duration?.values?.['p(95)'] < 500,
    wasmPerf: data.metrics.wasm_load_time?.values?.['p(95)'] < 100,
  };
  
  console.log('\n=== Performance Targets ===');
  console.log(`${targets.rps ? '✅' : '❌'} 1000+ req/s capability`);
  console.log(`${targets.errorRate ? '✅' : '❌'} <5% error rate`);
  console.log(`${targets.responseTime ? '✅' : '❌'} <500ms p95 response time`);
  console.log(`${targets.wasmPerf ? '✅' : '❌'} <100ms WASM load time`);
  
  return summary;
}

function generateHTMLReport(data) {
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html>
<head>
    <title>Athena Full Load Test Report</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            background: #1a1a1a; 
            color: white; 
            padding: 30px; 
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .metric-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value { 
            font-size: 2em; 
            font-weight: bold; 
            margin: 10px 0;
        }
        .metric-label { 
            color: #666; 
            text-transform: uppercase;
            font-size: 0.8em;
        }
        .pass { color: #22c55e; }
        .fail { color: #ef4444; }
        .chart { 
            background: white; 
            padding: 20px; 
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        table { 
            width: 100%; 
            border-collapse: collapse;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #eee;
        }
        th { 
            background: #f8f9fa; 
            font-weight: 600;
            color: #333;
        }
        .scenario-section {
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Athena Load Test Report</h1>
            <p>Generated: ${new Date().toISOString()}</p>
        </div>
        
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-label">Total Requests</div>
                <div class="metric-value">${metrics.http_reqs?.values?.count || 0}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Average RPS</div>
                <div class="metric-value">${metrics.http_reqs?.values?.rate?.toFixed(2) || 0}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Error Rate</div>
                <div class="metric-value ${metrics.errors?.values?.rate < 0.05 ? 'pass' : 'fail'}">
                    ${(metrics.errors?.values?.rate * 100)?.toFixed(2) || 0}%
                </div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Cache Hit Rate</div>
                <div class="metric-value ${metrics.cache_hits?.values?.rate > 0.5 ? 'pass' : 'fail'}">
                    ${(metrics.cache_hits?.values?.rate * 100)?.toFixed(2) || 0}%
                </div>
            </div>
        </div>
        
        <div class="chart">
            <h2>Response Time Distribution</h2>
            <table>
                <tr>
                    <th>Percentile</th>
                    <th>Response Time (ms)</th>
                    <th>Target</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>Median (p50)</td>
                    <td>${metrics.http_req_duration?.values?.med?.toFixed(2) || 0}</td>
                    <td>-</td>
                    <td>-</td>
                </tr>
                <tr>
                    <td>p95</td>
                    <td>${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}</td>
                    <td>&lt; 500ms</td>
                    <td class="${metrics.http_req_duration?.values?.['p(95)'] < 500 ? 'pass' : 'fail'}">
                        ${metrics.http_req_duration?.values?.['p(95)'] < 500 ? '✅ PASS' : '❌ FAIL'}
                    </td>
                </tr>
                <tr>
                    <td>p99</td>
                    <td>${metrics.http_req_duration?.values?.['p(99)']?.toFixed(2) || 0}</td>
                    <td>&lt; 1000ms</td>
                    <td class="${metrics.http_req_duration?.values?.['p(99)'] < 1000 ? 'pass' : 'fail'}">
                        ${metrics.http_req_duration?.values?.['p(99)'] < 1000 ? '✅ PASS' : '❌ FAIL'}
                    </td>
                </tr>
            </table>
        </div>
        
        <div class="chart">
            <h2>WASM Performance</h2>
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Target</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>p95 Load Time</td>
                    <td>${metrics.wasm_load_time?.values?.['p(95)']?.toFixed(2) || 0}ms</td>
                    <td>&lt; 100ms</td>
                    <td class="${metrics.wasm_load_time?.values?.['p(95)'] < 100 ? 'pass' : 'fail'}">
                        ${metrics.wasm_load_time?.values?.['p(95)'] < 100 ? '✅ PASS' : '❌ FAIL'}
                    </td>
                </tr>
                <tr>
                    <td>p95 Analysis Time</td>
                    <td>${metrics.analysis_time?.values?.['p(95)']?.toFixed(2) || 0}ms</td>
                    <td>&lt; 2000ms</td>
                    <td class="${metrics.analysis_time?.values?.['p(95)'] < 2000 ? 'pass' : 'fail'}">
                        ${metrics.analysis_time?.values?.['p(95)'] < 2000 ? '✅ PASS' : '❌ FAIL'}
                    </td>
                </tr>
            </table>
        </div>
        
        <div class="scenario-section">
            <h2>Test Scenarios</h2>
            <div class="chart">
                <h3>Gradual Load Test</h3>
                <p>Ramped from 0 to 1000 virtual users over 10 minutes to test system scalability.</p>
            </div>
            <div class="chart">
                <h3>Spike Test</h3>
                <p>Sudden spike to 1500 users to test system resilience under unexpected load.</p>
            </div>
            <div class="chart">
                <h3>Sustained Load Test</h3>
                <p>Maintained 300 concurrent users for 5 minutes to test system stability.</p>
            </div>
        </div>
    </div>
</body>
</html>
  `;
}