import { describe, test, expect, jest, beforeAll } from '@jest/globals';
import { reactNativeBridge } from '../../bridge';
import { VulnerabilitySeverity } from '../../bridge/types';

// Mock React Native modules
jest.mock('react-native', () => ({
  NativeModules: {
    WASMAnalysisEngine: {
      initialize: jest.fn().mockResolvedValue(true),
      analyzeBuffer: jest.fn().mockImplementation((buffer: ArrayBuffer) => {
        // Simulate native module behavior
        const decoder = new TextDecoder();
        const content = decoder.decode(buffer);
        
        const result = {
          vulnerabilities: [],
          hash: 'mock-hash-' + buffer.byteLength,
          file_size: buffer.byteLength,
          analysis_time_ms: 10
        };
        
        if (content.includes('eval')) {
          result.vulnerabilities.push({
            category: 'code-injection',
            severity: VulnerabilitySeverity.High,
            description: 'Detected eval() usage',
            location: 'line 1',
            details: 'Potential code injection vulnerability'
          });
        }
        
        return Promise.resolve(JSON.stringify(result));
      }),
      analyzeInBackground: jest.fn().mockImplementation((taskId: string, buffer: ArrayBuffer) => {
        // Simulate background processing
        setTimeout(() => {
          const decoder = new TextDecoder();
          const content = decoder.decode(buffer);
          
          const result = {
            taskId,
            status: 'completed',
            result: {
              vulnerabilities: content.includes('eval') ? [{
                category: 'code-injection',
                severity: VulnerabilitySeverity.High,
                description: 'Detected eval() usage in background',
                location: 'line 1',
                details: 'Background analysis complete'
              }] : [],
              hash: 'background-hash-' + buffer.byteLength,
              file_size: buffer.byteLength,
              analysis_time_ms: 50
            }
          };
          
          // Simulate native event emission
          if (mockEventEmitter.listeners[`analysis-complete-${taskId}`]) {
            mockEventEmitter.listeners[`analysis-complete-${taskId}`].forEach((cb: any) => 
              cb(result)
            );
          }
        }, 100);
        
        return Promise.resolve(taskId);
      }),
      cancelBackgroundTask: jest.fn().mockResolvedValue(true),
      isInitialized: jest.fn().mockResolvedValue(true)
    }
  },
  DeviceEventEmitter: {
    addListener: jest.fn().mockImplementation((event: string, callback: Function) => {
      if (!mockEventEmitter.listeners[event]) {
        mockEventEmitter.listeners[event] = [];
      }
      mockEventEmitter.listeners[event].push(callback);
      
      return {
        remove: jest.fn(() => {
          const index = mockEventEmitter.listeners[event].indexOf(callback);
          if (index > -1) {
            mockEventEmitter.listeners[event].splice(index, 1);
          }
        })
      };
    })
  }
}));

// Mock event emitter for testing
const mockEventEmitter = {
  listeners: {} as Record<string, Function[]>
};

describe('React Native Bridge Integration Tests', () => {
  beforeAll(async () => {
    await reactNativeBridge.initialize();
  });

  describe('Basic Functionality', () => {
    test('should initialize successfully', async () => {
      const initialized = await reactNativeBridge.initialize();
      expect(initialized).toBe(true);
      
      const isInit = await reactNativeBridge.isInitialized();
      expect(isInit).toBe(true);
    });

    test('should analyze buffer through native module', async () => {
      const code = 'console.log("Hello from React Native");';
      const buffer = new TextEncoder().encode(code).buffer;
      
      const result = await reactNativeBridge.analyzeBuffer(buffer);
      
      expect(result).toBeDefined();
      expect(result.hash).toBe('mock-hash-' + buffer.byteLength);
      expect(result.file_size).toBe(buffer.byteLength);
      expect(result.vulnerabilities).toHaveLength(0);
    });

    test('should detect vulnerabilities through native module', async () => {
      const maliciousCode = 'eval("malicious code");';
      const buffer = new TextEncoder().encode(maliciousCode).buffer;
      
      const result = await reactNativeBridge.analyzeBuffer(buffer);
      
      expect(result.vulnerabilities).toHaveLength(1);
      expect(result.vulnerabilities[0].category).toBe('code-injection');
      expect(result.vulnerabilities[0].severity).toBe(VulnerabilitySeverity.High);
      expect(result.vulnerabilities[0].description).toContain('eval');
    });
  });

  describe('Background Processing', () => {
    test('should analyze in background', async () => {
      const code = 'eval("background test");';
      const buffer = new TextEncoder().encode(code).buffer;
      
      const result = await reactNativeBridge.analyzeInBackground(buffer);
      
      expect(result).toBeDefined();
      expect(result.taskId).toBeDefined();
      expect(result.status).toBe('completed');
      expect(result.result.vulnerabilities).toHaveLength(1);
      expect(result.result.vulnerabilities[0].description).toContain('background');
    });

    test('should handle background task events', async () => {
      const code = 'console.log("event test");';
      const buffer = new TextEncoder().encode(code).buffer;
      
      let eventReceived = false;
      const taskId = 'test-task-' + Date.now();
      
      // Set up event listener
      const subscription = reactNativeBridge.onBackgroundTaskComplete(taskId, (result) => {
        eventReceived = true;
        expect(result.taskId).toBe(taskId);
        expect(result.status).toBe('completed');
      });
      
      // Trigger background analysis
      await reactNativeBridge.analyzeInBackground(buffer, { taskId });
      
      // Wait for event
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(eventReceived).toBe(true);
      
      // Clean up
      subscription.remove();
    });

    test('should cancel background task', async () => {
      const taskId = 'cancel-task-' + Date.now();
      const cancelled = await reactNativeBridge.cancelBackgroundTask(taskId);
      
      expect(cancelled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle native module errors', async () => {
      // Mock an error
      const NativeModules = require('react-native').NativeModules;
      const originalAnalyze = NativeModules.WASMAnalysisEngine.analyzeBuffer;
      
      NativeModules.WASMAnalysisEngine.analyzeBuffer = jest.fn()
        .mockRejectedValueOnce(new Error('Native module error'));
      
      const buffer = new ArrayBuffer(10);
      
      await expect(reactNativeBridge.analyzeBuffer(buffer))
        .rejects.toThrow('Native module error');
      
      // Restore original mock
      NativeModules.WASMAnalysisEngine.analyzeBuffer = originalAnalyze;
    });

    test('should validate input before passing to native', async () => {
      await expect(reactNativeBridge.analyzeBuffer(null as any))
        .rejects.toThrow();
      
      await expect(reactNativeBridge.analyzeBuffer('string' as any))
        .rejects.toThrow();
    });
  });

  describe('Performance Features', () => {
    test('should handle batch processing', async () => {
      const files = [
        { id: 'file1', buffer: new TextEncoder().encode('safe code').buffer },
        { id: 'file2', buffer: new TextEncoder().encode('eval("danger")').buffer },
        { id: 'file3', buffer: new TextEncoder().encode('console.log()').buffer }
      ];
      
      const results = await reactNativeBridge.analyzeBatch(files);
      
      expect(results).toHaveLength(3);
      
      const file1Result = results.find(r => r.id === 'file1');
      expect(file1Result?.result.vulnerabilities).toHaveLength(0);
      
      const file2Result = results.find(r => r.id === 'file2');
      expect(file2Result?.result.vulnerabilities).toHaveLength(1);
    });

    test('should support streaming analysis', async () => {
      const chunks = [
        'function test() {',
        '  eval("streaming");',
        '}'
      ];
      
      const stream = new ReadableStream({
        start(controller) {
          chunks.forEach(chunk => {
            controller.enqueue(new TextEncoder().encode(chunk));
          });
          controller.close();
        }
      });
      
      const results: any[] = [];
      
      await reactNativeBridge.analyzeStream(stream, {
        onChunk: (result) => {
          results.push(result);
        }
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should detect eval in streamed content
      const hasEval = results.some(r => 
        r.vulnerabilities?.some((v: any) => v.description.includes('eval'))
      );
      expect(hasEval).toBe(true);
    });
  });

  describe('Platform-Specific Features', () => {
    test('should handle React Native buffer types', async () => {
      // Simulate React Native ArrayBuffer behavior
      const buffer = new ArrayBuffer(20);
      const view = new Uint8Array(buffer);
      const text = 'React Native test';
      
      for (let i = 0; i < text.length; i++) {
        view[i] = text.charCodeAt(i);
      }
      
      const result = await reactNativeBridge.analyzeBuffer(buffer);
      expect(result.file_size).toBe(20);
    });

    test('should work with large buffers', async () => {
      // Test with 1MB buffer
      const largeBuffer = new ArrayBuffer(1024 * 1024);
      const view = new Uint8Array(largeBuffer);
      
      // Fill with pattern
      for (let i = 0; i < view.length; i++) {
        view[i] = i % 256;
      }
      
      const result = await reactNativeBridge.analyzeBuffer(largeBuffer);
      expect(result.file_size).toBe(1024 * 1024);
      expect(result.analysis_time_ms).toBeGreaterThan(0);
    });
  });

  describe('Event Management', () => {
    test('should manage multiple event listeners', () => {
      const taskId = 'multi-event-test';
      const callbacks: any[] = [];
      
      // Add multiple listeners
      const sub1 = reactNativeBridge.onBackgroundTaskComplete(taskId, (result) => {
        callbacks.push('listener1');
      });
      
      const sub2 = reactNativeBridge.onBackgroundTaskComplete(taskId, (result) => {
        callbacks.push('listener2');
      });
      
      // Clean up
      sub1.remove();
      sub2.remove();
      
      // Verify cleanup
      expect(mockEventEmitter.listeners[`analysis-complete-${taskId}`]?.length || 0).toBe(0);
    });
  });
});

// Export for other tests
export { reactNativeBridge };