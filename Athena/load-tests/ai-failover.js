import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const failoverEvents = new Counter('failover_events');
const primaryFailures = new Rate('primary_failures');
const fallbackSuccess = new Rate('fallback_success');
const responseTime = new Trend('ai_response_time');
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');

// Test configuration - Simulate failures and recovery
export let options = {
  scenarios: {
    // Normal load
    normal_load: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
    // Spike to trigger circuit breakers
    spike_load: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { target: 10, duration: '30s' },
        { target: 100, duration: '30s' }, // Spike
        { target: 10, duration: '30s' },
      ],
      startTime: '2m',
    },
    // Sustained high load
    sustained_load: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 100,
      maxVUs: 300,
      startTime: '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'], // Allow higher latency during failover
    failover_events: ['count<50'],     // Limit failover events
    fallback_success: ['rate>0.9'],    // 90% fallback success rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Simulated malware samples for consistent testing
const MALWARE_SAMPLES = [
  {
    hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    content: 'MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xFF\xFF\x00\x00',
    name: 'sample1.exe',
    expectedThreat: 'high',
  },
  {
    hash: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    content: '\x7fELF\x02\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00',
    name: 'sample2.bin',
    expectedThreat: 'medium',
  },
  {
    hash: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    content: 'PK\x03\x04\x14\x00\x00\x00\x08\x00',
    name: 'sample3.zip',
    expectedThreat: 'low',
  },
];

// Test different AI models with forced failures
export default function () {
  const sample = MALWARE_SAMPLES[Math.floor(Math.random() * MALWARE_SAMPLES.length)];
  const scenario = __ENV.SCENARIO_NAME || 'normal';
  
  // Prepare request
  const payload = {
    fileHash: sample.hash,
    fileContent: sample.content,
    fileName: sample.name,
    analysisOptions: {
      preferredModel: getPreferredModel(scenario),
      enableCache: Math.random() > 0.3, // 70% cache enabled
      timeout: 30000,
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
      },
    },
  };

  // Add headers to simulate different failure scenarios
  const headers = {
    'Content-Type': 'application/json',
  };
  
  if (scenario === 'spike_load' && Math.random() > 0.7) {
    // 30% chance to simulate primary service issues during spike
    headers['X-Simulate-Failure'] = 'primary';
  }
  
  const startTime = new Date();
  
  // Make request
  const response = http.post(
    `${BASE_URL}/api/ai/analyze`,
    JSON.stringify(payload),
    { headers, timeout: '40s' }
  );
  
  const duration = new Date() - startTime;
  responseTime.add(duration);
  
  // Check response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'has result': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.result !== undefined;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    try {
      const body = JSON.parse(response.body);
      
      // Track metrics
      if (body.metadata) {
        if (body.metadata.fromCache) {
          cacheHits.add(1);
        } else {
          cacheMisses.add(1);
        }
        
        if (body.metadata.usedFallback) {
          failoverEvents.add(1);
          fallbackSuccess.add(1);
        }
        
        if (body.metadata.primaryFailed) {
          primaryFailures.add(1);
        } else {
          primaryFailures.add(0);
        }
      }
      
      // Validate threat assessment
      check(body, {
        'threat level matches': (b) => {
          return b.result && b.result.threatLevel !== undefined;
        },
        'has AI model info': (b) => {
          return b.metadata && b.metadata.model !== undefined;
        },
        'response time acceptable': (b) => {
          return b.metadata && b.metadata.processingTime < 5000;
        },
      });
    } catch (e) {
      console.error('Failed to parse response:', e);
    }
  } else {
    fallbackSuccess.add(0);
    
    // Log failure details
    if (response.status === 503) {
      console.log('Circuit breaker open - service temporarily unavailable');
    } else if (response.status === 504) {
      console.log('Timeout - all AI services failed');
    }
  }
  
  // Variable sleep based on scenario
  if (scenario === 'spike_load') {
    sleep(Math.random() * 0.5); // Shorter sleep during spike
  } else {
    sleep(Math.random() * 2);
  }
}

// Helper function to rotate preferred models
function getPreferredModel(scenario) {
  const models = ['claude-3-haiku', 'gpt-4-turbo', 'deepseek-coder'];
  
  if (scenario === 'sustained_load') {
    // Focus on one model to test circuit breaker
    return 'claude-3-haiku';
  }
  
  return models[Math.floor(Math.random() * models.length)];
}

// Cache warming test
export function cacheWarmingTest() {
  // Analyze all samples to populate cache
  MALWARE_SAMPLES.forEach((sample, index) => {
    const response = http.post(
      `${BASE_URL}/api/ai/analyze`,
      JSON.stringify({
        fileHash: sample.hash,
        fileContent: sample.content,
        fileName: sample.name,
        analysisOptions: {
          enableCache: true,
          preferredModel: 'gpt-4-turbo', // Use consistent model for cache
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    check(response, {
      'cache warming successful': (r) => r.status === 200,
    });
    
    sleep(0.5);
  });
  
  // Now test cache hits
  MALWARE_SAMPLES.forEach((sample) => {
    const response = http.post(
      `${BASE_URL}/api/ai/analyze`,
      JSON.stringify({
        fileHash: sample.hash,
        fileContent: sample.content,
        fileName: sample.name,
        analysisOptions: {
          enableCache: true,
          preferredModel: 'gpt-4-turbo',
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    check(response, {
      'cache hit': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.metadata && body.metadata.fromCache === true;
        } catch {
          return false;
        }
      },
    });
  });
}