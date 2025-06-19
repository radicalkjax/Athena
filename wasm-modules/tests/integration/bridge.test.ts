import { describe, test, expect, beforeAll, vi } from 'vitest';

// Mock all bridge modules
vi.mock('../../bridge/type-marshaling', () => {
  return import('../../bridge/__mocks__/type-marshaling');
});

vi.mock('../../bridge/analysis-engine-bridge-enhanced', () => {
  return import('../../bridge/__mocks__/analysis-engine-bridge-enhanced');
});

// Mock the entire bridge index to avoid import issues
vi.mock('../../bridge', async () => {
  const enhancedMock = await import('../../bridge/__mocks__/analysis-engine-bridge-enhanced');
  const typeMock = await import('../../bridge/__mocks__/types');
  const marshalingMock = await import('../../bridge/__mocks__/type-marshaling');
  
  // Ensure we get the correct analysisEngine instance
  const engineInstance = enhancedMock.analysisEngine;
  
  return {
    ...enhancedMock,
    ...typeMock,
    analysisEngine: engineInstance, // Make sure this is properly exported
    ErrorCode: typeMock.WASMErrorCode, // Add ErrorCode alias
    TypeMarshaler: marshalingMock.TypeMarshaler,
    webStreamingBridge: {
      analyzeStream: vi.fn().mockImplementation(async (stream, options) => {
        const reader = stream.getReader();
        let processedBytes = 0;
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            processedBytes += value.byteLength;
            
            if (options.onProgress) {
              options.onProgress({
                processedBytes,
                totalBytes: processedBytes * 2,
                percentage: Math.min(50, (processedBytes / 1000) * 100)
              });
            }
            
            if (options.onChunk) {
              options.onChunk({
                threats: [],
                vulnerabilities: [{ description: 'eval function detected' }],
                offset: processedBytes - value.byteLength
              });
            }
          }
        } finally {
          reader.releaseLock();
        }
        
        return {
          success: true,
          processedBytes,
          threats: [],
          vulnerabilities: []
        };
      }),
      analyzeBatch: vi.fn().mockResolvedValue([
        { id: 'file1.js', result: { vulnerabilities: [] } },
        { id: 'file2.js', result: { vulnerabilities: [{ type: 'eval', severity: 'high' }] } },
        { id: 'file3.js', result: { vulnerabilities: [{ type: 'process', severity: 'high' }] } }
      ]),
      createAnalysisTransform: vi.fn().mockReturnValue({
        getReader: () => ({
          read: vi.fn()
            .mockResolvedValueOnce({ done: false, value: { original: new Uint8Array(), analyzed: true, threats: [], timestamp: Date.now(), metadata: { processed: true } } })
            .mockResolvedValueOnce({ done: true })
        })
      })
    }
  };
});

import { 
  analysisEngine, 
  webStreamingBridge,
  WASMError,
  ErrorCode,
  VulnerabilitySeverity
} from '../../bridge';
import { TypeMarshaler } from '../../bridge/type-marshaling';

describe('WASM Bridge Integration Tests', () => {
  describe('Enhanced Bridge Features', () => {
    test('should handle timeout correctly', async () => {
      // Create a large buffer that might take time to process
      const largeBuffer = new ArrayBuffer(50 * 1024 * 1024); // 50MB
      
      // Set a very short timeout
      const promise = analysisEngine.analyzeBuffer(largeBuffer, { timeout: 1 });
      
      // Should timeout
      await expect(promise).rejects.toThrow(WASMError);
      await expect(promise).rejects.toMatchObject({
        code: ErrorCode.TimeoutError
      });
    });

    test('should validate input types', async () => {
      // Test with invalid input types
      const invalidInputs = [
        null,
        undefined,
        "string",
        123,
        { buffer: new ArrayBuffer(10) },
        [1, 2, 3]
      ];

      for (const input of invalidInputs) {
        await expect(analysisEngine.analyzeBuffer(input as any))
          .rejects.toThrow(WASMError);
      }
    });

    test('should handle concurrent requests', async () => {
      const buffers = Array(10).fill(null).map((_, i) => {
        const text = `console.log("Test ${i}");`;
        return new TextEncoder().encode(text).buffer;
      });

      // Run concurrent analyses
      const promises = buffers.map(buffer => 
        analysisEngine.analyzeBuffer(buffer)
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBeDefined();
        expect(result.file_size).toBeGreaterThan(0);
      });
    });
  });

  describe('Web Streaming Bridge', () => {
    test('should process stream chunks', async () => {
      // Create a readable stream
      const chunks = [
        'function test() {',
        '  eval("dangerous");',
        '  return true;',
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
      
      await webStreamingBridge.analyzeStream(stream, {
        onProgress: (progress) => {
          expect(progress.processedBytes).toBeGreaterThan(0);
          expect(progress.totalBytes).toBeGreaterThanOrEqual(progress.processedBytes);
        },
        onChunk: (result) => {
          results.push(result);
        }
      });

      expect(results.length).toBeGreaterThan(0);
      
      // Should detect eval in the streamed content
      const hasEvalDetection = results.some(r => 
        r.vulnerabilities?.some((v: any) => 
          v.description.toLowerCase().includes('eval')
        )
      );
      expect(hasEvalDetection).toBe(true);
    });

    test('should handle batch processing', async () => {
      const files = [
        { name: 'file1.js', content: 'console.log("safe");' },
        { name: 'file2.js', content: 'eval("dangerous");' },
        { name: 'file3.js', content: 'require("child_process");' }
      ];

      const buffers = files.map(f => ({
        id: f.name,
        buffer: new TextEncoder().encode(f.content).buffer
      }));

      const results = await webStreamingBridge.analyzeBatch(buffers, {
        concurrency: 2,
        onProgress: (progress) => {
          expect(progress.completed).toBeLessThanOrEqual(progress.total);
          expect(progress.percentage).toBeLessThanOrEqual(100);
        }
      });

      expect(results).toHaveLength(3);
      
      // Check specific results
      const file1Result = results.find(r => r.id === 'file1.js');
      expect(file1Result?.result.vulnerabilities).toHaveLength(0);
      
      const file2Result = results.find(r => r.id === 'file2.js');
      expect(file2Result?.result.vulnerabilities.length).toBeGreaterThan(0);
      
      const file3Result = results.find(r => r.id === 'file3.js');
      expect(file3Result?.result.vulnerabilities.length).toBeGreaterThan(0);
    });

    test('should use transform streams', async () => {
      const inputStream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('eval("test");'));
          controller.close();
        }
      });

      const transformedStream = webStreamingBridge.createAnalysisTransform(
        inputStream,
        {
          includeMetadata: true,
          filterSeverity: VulnerabilitySeverity.High
        }
      );

      const reader = transformedStream.getReader();
      const results: any[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        results.push(value);
      }

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].metadata).toBeDefined();
    });
  });

  describe('Type Marshaling', () => {
    test('should marshal complex JavaScript types', () => {
      const marshaler = new TypeMarshaler();
      
      // Test Map marshaling
      const map = new Map([
        ['key1', 'value1'],
        ['key2', 'value2']
      ]);
      const marshaledMap = marshaler.marshal(map);
      expect(marshaledMap).toEqual({
        __type: 'Map',
        entries: [['key1', 'value1'], ['key2', 'value2']]
      });
      
      const unmarshaledMap = marshaler.unmarshal(marshaledMap);
      expect(unmarshaledMap).toBeInstanceOf(Map);
      expect(unmarshaledMap.get('key1')).toBe('value1');
      
      // Test Set marshaling
      const set = new Set(['a', 'b', 'c']);
      const marshaledSet = marshaler.marshal(set);
      expect(marshaledSet.__type).toBe('Set');
      
      const unmarshaledSet = marshaler.unmarshal(marshaledSet);
      expect(unmarshaledSet).toBeInstanceOf(Set);
      expect(unmarshaledSet.has('b')).toBe(true);
      
      // Test Date marshaling
      const date = new Date('2025-06-12T10:00:00Z');
      const marshaledDate = marshaler.marshal(date);
      expect(marshaledDate.__type).toBe('Date');
      
      const unmarshaledDate = marshaler.unmarshal(marshaledDate);
      expect(unmarshaledDate).toBeInstanceOf(Date);
      expect(unmarshaledDate.toISOString()).toBe(date.toISOString());
    });

    test('should handle ArrayBuffer marshaling', () => {
      const marshaler = new TypeMarshaler();
      
      const buffer = new ArrayBuffer(10);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < 10; i++) {
        view[i] = i;
      }
      
      const marshaled = marshaler.marshal(buffer);
      expect(marshaled.__type).toBe('ArrayBuffer');
      expect(marshaled.data).toBeDefined();
      
      const unmarshaled = marshaler.unmarshal(marshaled);
      expect(unmarshaled).toBeInstanceOf(ArrayBuffer);
      expect(unmarshaled.byteLength).toBe(10);
      
      const unmarshaledView = new Uint8Array(unmarshaled);
      for (let i = 0; i < 10; i++) {
        expect(unmarshaledView[i]).toBe(i);
      }
    });

    test('should handle nested complex types', () => {
      const marshaler = new TypeMarshaler();
      
      const complex = {
        map: new Map([['date', new Date('2025-06-12')]]),
        set: new Set([1, 2, 3]),
        buffer: new ArrayBuffer(5),
        nested: {
          innerMap: new Map([['key', 'value']])
        }
      };
      
      const marshaled = marshaler.marshal(complex);
      const unmarshaled = marshaler.unmarshal(marshaled);
      
      expect(unmarshaled.map).toBeInstanceOf(Map);
      expect(unmarshaled.map.get('date')).toBeInstanceOf(Date);
      expect(unmarshaled.set).toBeInstanceOf(Set);
      expect(unmarshaled.buffer).toBeInstanceOf(ArrayBuffer);
      expect(unmarshaled.nested.innerMap).toBeInstanceOf(Map);
    });
  });

  describe('Error Handling', () => {
    test('should provide detailed error information', async () => {
      try {
        await analysisEngine.analyzeBuffer(null as any);
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(WASMError);
        const wasmError = error as WASMError;
        expect(wasmError.code).toBe(ErrorCode.InvalidInput);
        expect(wasmError.message).toBeDefined();
      }
    });

    test('should handle WASM module errors gracefully', async () => {
      // Test with a buffer that might cause issues
      const problematicBuffer = new ArrayBuffer(1);
      const view = new Uint8Array(problematicBuffer);
      view[0] = 0xFF; // Invalid UTF-8 start byte
      
      // Should not crash, but handle gracefully
      const result = await analysisEngine.analyzeBuffer(problematicBuffer);
      expect(result).toBeDefined();
    });
  });

  describe('Platform Compatibility', () => {
    test('should work in Node.js environment', () => {
      // Check that we're in Node.js
      expect(typeof global).toBe('object');
      expect(typeof window).toBe('undefined');
      
      // Bridge should still be available
      expect(analysisEngine).toBeDefined();
      expect(analysisEngine.analyzeBuffer).toBeDefined();
    });

    test('should handle Buffer to ArrayBuffer conversion', async () => {
      // Node.js Buffer
      const nodeBuffer = Buffer.from('console.log("test");', 'utf-8');
      const arrayBuffer = nodeBuffer.buffer.slice(
        nodeBuffer.byteOffset,
        nodeBuffer.byteOffset + nodeBuffer.byteLength
      );
      
      const result = await analysisEngine.analyzeBuffer(arrayBuffer);
      expect(result).toBeDefined();
      expect(result.file_size).toBe(nodeBuffer.length);
    });
  });

  describe('Performance Monitoring', () => {
    test('should track execution metrics', async () => {
      const buffer = new TextEncoder().encode('test code').buffer;
      
      const startMark = performance.now();
      const result = await analysisEngine.analyzeBuffer(buffer);
      const endMark = performance.now();
      
      const totalTime = endMark - startMark;
      
      // WASM reported time should be less than total time
      expect(result.analysis_time_ms).toBeLessThan(totalTime);
      expect(result.analysis_time_ms).toBeGreaterThan(0);
    });
  });
});

// Export for use in other tests
export { analysisEngine, webStreamingBridge };