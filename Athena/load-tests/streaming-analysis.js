import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const streamingErrors = new Rate('streaming_errors');
const messageLatency = new Trend('message_latency');
const connectionDuration = new Trend('connection_duration');

// Test configuration
export let options = {
  stages: [
    { duration: '30s', target: 20 },   // Warm-up
    { duration: '2m', target: 100 },   // Ramp-up
    { duration: '5m', target: 200 },   // Sustained load
    { duration: '2m', target: 300 },   // Peak load
    { duration: '1m', target: 100 },   // Cool-down
    { duration: '30s', target: 0 },    // Ramp-down
  ],
  thresholds: {
    ws_connecting: ['p(95)<1000'],     // 95% connect under 1s
    streaming_errors: ['rate<0.05'],   // Error rate under 5%
    message_latency: ['p(95)<500'],    // 95% messages under 500ms
  },
};

// Test data
const ANALYSIS_TYPES = ['behavior', 'static', 'dynamic', 'hybrid'];
const TEST_SAMPLES = [
  { hash: 'a1b2c3d4e5f6', name: 'trojan.exe', size: 245760 },
  { hash: 'f6e5d4c3b2a1', name: 'ransomware.bin', size: 1048576 },
  { hash: '1a2b3c4d5e6f', name: 'adware.dll', size: 524288 },
];

// WebSocket URL
const WS_URL = __ENV.WS_URL || 'ws://localhost:3000';

export default function () {
  const sample = TEST_SAMPLES[Math.floor(Math.random() * TEST_SAMPLES.length)];
  const analysisType = ANALYSIS_TYPES[Math.floor(Math.random() * ANALYSIS_TYPES.length)];
  const connectionStart = new Date();
  let messagesReceived = 0;
  let analysisComplete = false;
  
  const res = ws.connect(`${WS_URL}/ws/analysis`, {}, function (socket) {
    socket.on('open', () => {
      // Send analysis request
      socket.send(JSON.stringify({
        type: 'start_analysis',
        payload: {
          fileHash: sample.hash,
          fileName: sample.name,
          fileSize: sample.size,
          analysisType: analysisType,
          stream: true,
        },
      }));
    });

    socket.on('message', (msg) => {
      const messageTime = new Date();
      messagesReceived++;
      
      try {
        const data = JSON.parse(msg);
        
        // Track message latency
        if (data.timestamp) {
          const latency = messageTime - new Date(data.timestamp);
          messageLatency.add(latency);
        }
        
        // Handle different message types
        switch (data.type) {
          case 'progress':
            check(data, {
              'has progress percentage': (d) => d.payload && typeof d.payload.percentage === 'number',
              'progress in valid range': (d) => d.payload && d.payload.percentage >= 0 && d.payload.percentage <= 100,
            });
            break;
            
          case 'partial_result':
            check(data, {
              'has partial data': (d) => d.payload !== undefined,
              'has analysis phase': (d) => d.payload && d.payload.phase !== undefined,
            });
            break;
            
          case 'complete':
            analysisComplete = true;
            check(data, {
              'has final results': (d) => d.payload && d.payload.results !== undefined,
              'has threat score': (d) => d.payload && d.payload.results && typeof d.payload.results.threatScore === 'number',
              'has classifications': (d) => d.payload && d.payload.results && Array.isArray(d.payload.results.classifications),
            });
            
            // Close connection after completion
            socket.close();
            break;
            
          case 'error':
            streamingErrors.add(1);
            socket.close();
            break;
            
          default:
            // Unknown message type
            break;
        }
      } catch (e) {
        streamingErrors.add(1);
        socket.close();
      }
    });

    socket.on('close', () => {
      const duration = new Date() - connectionStart;
      connectionDuration.add(duration);
      
      if (!analysisComplete && messagesReceived > 0) {
        streamingErrors.add(1);
      } else {
        streamingErrors.add(0);
      }
    });

    socket.on('error', (e) => {
      streamingErrors.add(1);
    });

    // Keep connection open for analysis
    socket.setTimeout(() => {
      if (!analysisComplete) {
        socket.close();
      }
    }, 30000); // 30 second timeout
  });
  
  check(res, {
    'WebSocket connection established': (r) => r && r.status === 101,
  });
  
  // Small delay between connections
  sleep(Math.random() * 1);
}

// Batch analysis load test
export function batchAnalysisTest() {
  const batchSize = Math.floor(Math.random() * 10) + 5; // 5-15 files
  const files = [];
  
  for (let i = 0; i < batchSize; i++) {
    const sample = TEST_SAMPLES[Math.floor(Math.random() * TEST_SAMPLES.length)];
    files.push({
      hash: sample.hash + '_' + i,
      name: sample.name.replace('.', `_${i}.`),
      size: sample.size,
    });
  }
  
  const res = ws.connect(`${WS_URL}/ws/batch-analysis`, {}, function (socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({
        type: 'batch_analysis',
        payload: {
          files: files,
          analysisType: 'quick',
          parallel: true,
        },
      }));
    });

    socket.on('message', (msg) => {
      try {
        const data = JSON.parse(msg);
        
        if (data.type === 'batch_progress') {
          check(data, {
            'has completed count': (d) => d.payload && typeof d.payload.completed === 'number',
            'has total count': (d) => d.payload && typeof d.payload.total === 'number',
            'progress is valid': (d) => d.payload && d.payload.completed <= d.payload.total,
          });
        } else if (data.type === 'batch_complete') {
          check(data, {
            'all files analyzed': (d) => d.payload && d.payload.results && Object.keys(d.payload.results).length === batchSize,
          });
          socket.close();
        }
      } catch (e) {
        streamingErrors.add(1);
        socket.close();
      }
    });
  });
  
  sleep(Math.random() * 2);
}