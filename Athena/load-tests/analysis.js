import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const analysisErrors = new Rate('analysis_errors');
const analysisDuration = new Trend('analysis_duration');
const cacheHitRate = new Rate('cache_hit_rate');

// Test configuration
export let options = {
  stages: [
    { duration: '30s', target: 10 },   // Warm-up
    { duration: '2m', target: 50 },    // Ramp-up
    { duration: '5m', target: 100 },   // Sustained load
    { duration: '2m', target: 150 },   // Peak load
    { duration: '1m', target: 50 },    // Cool-down
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'], // 95% of requests under 3s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    analysis_errors: ['rate<0.05'],    // Analysis error rate under 5%
  },
};

// Test data
const TEST_FILES = [
  { name: 'small.exe', size: 1024 * 100, type: 'application/x-msdownload' },
  { name: 'medium.bin', size: 1024 * 1024, type: 'application/octet-stream' },
  { name: 'large.iso', size: 1024 * 1024 * 5, type: 'application/x-iso9660-image' },
];

const AI_MODELS = ['claude-3-haiku', 'gpt-4-turbo', 'deepseek-coder'];

const CONTAINER_CONFIGS = ['ubuntu-sandbox', 'windows-sandbox', 'alpine-minimal'];

// Helper functions
function generateFileContent(size) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}

// API endpoints
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Randomly select test parameters
  const file = getRandomElement(TEST_FILES);
  const aiModel = getRandomElement(AI_MODELS);
  const containerConfig = getRandomElement(CONTAINER_CONFIGS);
  
  // Prepare multipart form data
  const formData = {
    file: http.file(generateFileContent(file.size), file.name, file.type),
    aiModel: aiModel,
    containerConfig: containerConfig,
    enableNetworkCapture: Math.random() > 0.5 ? 'true' : 'false',
    enableFileSystemCapture: Math.random() > 0.5 ? 'true' : 'false',
    enableProcessCapture: 'true',
    analysisDepth: getRandomElement(['quick', 'standard', 'deep']),
  };

  // Start timing
  const startTime = new Date();
  
  // Submit analysis
  const submitResponse = http.post(`${BASE_URL}/api/analysis/submit`, formData);
  
  // Check submission response
  const submitCheck = check(submitResponse, {
    'submission successful': (r) => r.status === 200 || r.status === 201,
    'has analysis ID': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.analysisId !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (!submitCheck) {
    analysisErrors.add(1);
    return;
  }

  // Extract analysis ID
  let analysisId;
  try {
    const body = JSON.parse(submitResponse.body);
    analysisId = body.analysisId;
  } catch {
    analysisErrors.add(1);
    return;
  }

  // Poll for results with exponential backoff
  let attempts = 0;
  const maxAttempts = 30;
  let backoff = 1;
  let resultReceived = false;

  while (attempts < maxAttempts && !resultReceived) {
    sleep(backoff);
    
    const statusResponse = http.get(`${BASE_URL}/api/analysis/status/${analysisId}`);
    
    const statusCheck = check(statusResponse, {
      'status check successful': (r) => r.status === 200,
      'has valid status': (r) => {
        try {
          const body = JSON.parse(r.body);
          return ['pending', 'processing', 'completed', 'failed'].includes(body.status);
        } catch {
          return false;
        }
      },
    });

    if (statusCheck) {
      try {
        const body = JSON.parse(statusResponse.body);
        
        // Track cache hits
        if (body.fromCache) {
          cacheHitRate.add(1);
        } else {
          cacheHitRate.add(0);
        }
        
        if (body.status === 'completed') {
          resultReceived = true;
          analysisDuration.add(new Date() - startTime);
          
          // Verify result structure
          check(body, {
            'has analysis results': (b) => b.results !== undefined,
            'has threat level': (b) => b.results && b.results.threatLevel !== undefined,
            'has recommendations': (b) => b.results && Array.isArray(b.results.recommendations),
          });
        } else if (body.status === 'failed') {
          analysisErrors.add(1);
          return;
        }
      } catch {
        analysisErrors.add(1);
        return;
      }
    }
    
    attempts++;
    backoff = Math.min(backoff * 1.5, 10); // Exponential backoff with cap
  }

  if (!resultReceived) {
    analysisErrors.add(1);
  } else {
    analysisErrors.add(0);
  }
  
  // Small delay between iterations
  sleep(Math.random() * 2);
}

// Setup function to warm up connections
export function setup() {
  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  check(healthCheck, {
    'API is healthy': (r) => r.status === 200,
  });
  
  return { startTime: new Date() };
}

// Teardown function to generate summary
export function teardown(data) {
  console.log(`Load test completed. Duration: ${new Date() - data.startTime}ms`);
}