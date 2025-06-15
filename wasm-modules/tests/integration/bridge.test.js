"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webStreamingBridge = exports.analysisEngine = void 0;
const globals_1 = require("@jest/globals");
const bridge_1 = require("../../bridge");
Object.defineProperty(exports, "analysisEngine", { enumerable: true, get: function () { return bridge_1.analysisEngine; } });
Object.defineProperty(exports, "webStreamingBridge", { enumerable: true, get: function () { return bridge_1.webStreamingBridge; } });
const type_marshaling_1 = require("../../bridge/type-marshaling");
(0, globals_1.describe)('WASM Bridge Integration Tests', () => {
    (0, globals_1.describe)('Enhanced Bridge Features', () => {
        (0, globals_1.test)('should handle timeout correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create a large buffer that might take time to process
            const largeBuffer = new ArrayBuffer(50 * 1024 * 1024); // 50MB
            // Set a very short timeout
            const promise = bridge_1.analysisEngine.analyzeBuffer(largeBuffer, { timeout: 1 });
            // Should timeout
            yield (0, globals_1.expect)(promise).rejects.toThrow(bridge_1.WASMError);
            yield (0, globals_1.expect)(promise).rejects.toMatchObject({
                code: bridge_1.ErrorCode.TIMEOUT
            });
        }));
        (0, globals_1.test)('should validate input types', () => __awaiter(void 0, void 0, void 0, function* () {
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
                yield (0, globals_1.expect)(bridge_1.analysisEngine.analyzeBuffer(input))
                    .rejects.toThrow(bridge_1.WASMError);
            }
        }));
        (0, globals_1.test)('should handle concurrent requests', () => __awaiter(void 0, void 0, void 0, function* () {
            const buffers = Array(10).fill(null).map((_, i) => {
                const text = `console.log("Test ${i}");`;
                return new TextEncoder().encode(text).buffer;
            });
            // Run concurrent analyses
            const promises = buffers.map(buffer => bridge_1.analysisEngine.analyzeBuffer(buffer));
            const results = yield Promise.all(promises);
            (0, globals_1.expect)(results).toHaveLength(10);
            results.forEach((result, i) => {
                (0, globals_1.expect)(result).toBeDefined();
                (0, globals_1.expect)(result.file_size).toBeGreaterThan(0);
            });
        }));
    });
    (0, globals_1.describe)('Web Streaming Bridge', () => {
        (0, globals_1.test)('should process stream chunks', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const results = [];
            yield bridge_1.webStreamingBridge.analyzeStream(stream, {
                onProgress: (progress) => {
                    (0, globals_1.expect)(progress.processedBytes).toBeGreaterThan(0);
                    (0, globals_1.expect)(progress.totalBytes).toBeGreaterThanOrEqual(progress.processedBytes);
                },
                onChunk: (result) => {
                    results.push(result);
                }
            });
            (0, globals_1.expect)(results.length).toBeGreaterThan(0);
            // Should detect eval in the streamed content
            const hasEvalDetection = results.some(r => {
                var _a;
                return (_a = r.vulnerabilities) === null || _a === void 0 ? void 0 : _a.some((v) => v.description.toLowerCase().includes('eval'));
            });
            (0, globals_1.expect)(hasEvalDetection).toBe(true);
        }));
        (0, globals_1.test)('should handle batch processing', () => __awaiter(void 0, void 0, void 0, function* () {
            const files = [
                { name: 'file1.js', content: 'console.log("safe");' },
                { name: 'file2.js', content: 'eval("dangerous");' },
                { name: 'file3.js', content: 'require("child_process");' }
            ];
            const buffers = files.map(f => ({
                id: f.name,
                buffer: new TextEncoder().encode(f.content).buffer
            }));
            const results = yield bridge_1.webStreamingBridge.analyzeBatch(buffers, {
                concurrency: 2,
                onProgress: (progress) => {
                    (0, globals_1.expect)(progress.completed).toBeLessThanOrEqual(progress.total);
                    (0, globals_1.expect)(progress.percentage).toBeLessThanOrEqual(100);
                }
            });
            (0, globals_1.expect)(results).toHaveLength(3);
            // Check specific results
            const file1Result = results.find(r => r.id === 'file1.js');
            (0, globals_1.expect)(file1Result === null || file1Result === void 0 ? void 0 : file1Result.result.vulnerabilities).toHaveLength(0);
            const file2Result = results.find(r => r.id === 'file2.js');
            (0, globals_1.expect)(file2Result === null || file2Result === void 0 ? void 0 : file2Result.result.vulnerabilities.length).toBeGreaterThan(0);
            const file3Result = results.find(r => r.id === 'file3.js');
            (0, globals_1.expect)(file3Result === null || file3Result === void 0 ? void 0 : file3Result.result.vulnerabilities.length).toBeGreaterThan(0);
        }));
        (0, globals_1.test)('should use transform streams', () => __awaiter(void 0, void 0, void 0, function* () {
            const inputStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(new TextEncoder().encode('eval("test");'));
                    controller.close();
                }
            });
            const transformedStream = bridge_1.webStreamingBridge.createAnalysisTransform(inputStream, {
                includeMetadata: true,
                filterSeverity: bridge_1.VulnerabilitySeverity.High
            });
            const reader = transformedStream.getReader();
            const results = [];
            while (true) {
                const { done, value } = yield reader.read();
                if (done)
                    break;
                results.push(value);
            }
            (0, globals_1.expect)(results.length).toBeGreaterThan(0);
            (0, globals_1.expect)(results[0].metadata).toBeDefined();
        }));
    });
    (0, globals_1.describe)('Type Marshaling', () => {
        (0, globals_1.test)('should marshal complex JavaScript types', () => {
            const marshaler = new type_marshaling_1.TypeMarshaler();
            // Test Map marshaling
            const map = new Map([
                ['key1', 'value1'],
                ['key2', 'value2']
            ]);
            const marshaledMap = marshaler.marshal(map);
            (0, globals_1.expect)(marshaledMap).toEqual({
                __type: 'Map',
                entries: [['key1', 'value1'], ['key2', 'value2']]
            });
            const unmarshaledMap = marshaler.unmarshal(marshaledMap);
            (0, globals_1.expect)(unmarshaledMap).toBeInstanceOf(Map);
            (0, globals_1.expect)(unmarshaledMap.get('key1')).toBe('value1');
            // Test Set marshaling
            const set = new Set(['a', 'b', 'c']);
            const marshaledSet = marshaler.marshal(set);
            (0, globals_1.expect)(marshaledSet.__type).toBe('Set');
            const unmarshaledSet = marshaler.unmarshal(marshaledSet);
            (0, globals_1.expect)(unmarshaledSet).toBeInstanceOf(Set);
            (0, globals_1.expect)(unmarshaledSet.has('b')).toBe(true);
            // Test Date marshaling
            const date = new Date('2025-06-12T10:00:00Z');
            const marshaledDate = marshaler.marshal(date);
            (0, globals_1.expect)(marshaledDate.__type).toBe('Date');
            const unmarshaledDate = marshaler.unmarshal(marshaledDate);
            (0, globals_1.expect)(unmarshaledDate).toBeInstanceOf(Date);
            (0, globals_1.expect)(unmarshaledDate.toISOString()).toBe(date.toISOString());
        });
        (0, globals_1.test)('should handle ArrayBuffer marshaling', () => {
            const marshaler = new type_marshaling_1.TypeMarshaler();
            const buffer = new ArrayBuffer(10);
            const view = new Uint8Array(buffer);
            for (let i = 0; i < 10; i++) {
                view[i] = i;
            }
            const marshaled = marshaler.marshal(buffer);
            (0, globals_1.expect)(marshaled.__type).toBe('ArrayBuffer');
            (0, globals_1.expect)(marshaled.data).toBeDefined();
            const unmarshaled = marshaler.unmarshal(marshaled);
            (0, globals_1.expect)(unmarshaled).toBeInstanceOf(ArrayBuffer);
            (0, globals_1.expect)(unmarshaled.byteLength).toBe(10);
            const unmarshaledView = new Uint8Array(unmarshaled);
            for (let i = 0; i < 10; i++) {
                (0, globals_1.expect)(unmarshaledView[i]).toBe(i);
            }
        });
        (0, globals_1.test)('should handle nested complex types', () => {
            const marshaler = new type_marshaling_1.TypeMarshaler();
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
            (0, globals_1.expect)(unmarshaled.map).toBeInstanceOf(Map);
            (0, globals_1.expect)(unmarshaled.map.get('date')).toBeInstanceOf(Date);
            (0, globals_1.expect)(unmarshaled.set).toBeInstanceOf(Set);
            (0, globals_1.expect)(unmarshaled.buffer).toBeInstanceOf(ArrayBuffer);
            (0, globals_1.expect)(unmarshaled.nested.innerMap).toBeInstanceOf(Map);
        });
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.test)('should provide detailed error information', () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                yield bridge_1.analysisEngine.analyzeBuffer(null);
            }
            catch (error) {
                (0, globals_1.expect)(error).toBeInstanceOf(bridge_1.WASMError);
                const wasmError = error;
                (0, globals_1.expect)(wasmError.code).toBe(bridge_1.ErrorCode.INVALID_INPUT);
                (0, globals_1.expect)(wasmError.message).toBeDefined();
                (0, globals_1.expect)(wasmError.context).toBeDefined();
            }
        }));
        (0, globals_1.test)('should handle WASM module errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            // Test with a buffer that might cause issues
            const problematicBuffer = new ArrayBuffer(1);
            const view = new Uint8Array(problematicBuffer);
            view[0] = 0xFF; // Invalid UTF-8 start byte
            // Should not crash, but handle gracefully
            const result = yield bridge_1.analysisEngine.analyzeBuffer(problematicBuffer);
            (0, globals_1.expect)(result).toBeDefined();
        }));
    });
    (0, globals_1.describe)('Platform Compatibility', () => {
        (0, globals_1.test)('should work in Node.js environment', () => {
            // Check that we're in Node.js
            (0, globals_1.expect)(typeof global).toBe('object');
            (0, globals_1.expect)(typeof window).toBe('undefined');
            // Bridge should still be available
            (0, globals_1.expect)(bridge_1.analysisEngine).toBeDefined();
            (0, globals_1.expect)(bridge_1.analysisEngine.analyzeBuffer).toBeDefined();
        });
        (0, globals_1.test)('should handle Buffer to ArrayBuffer conversion', () => __awaiter(void 0, void 0, void 0, function* () {
            // Node.js Buffer
            const nodeBuffer = Buffer.from('console.log("test");', 'utf-8');
            const arrayBuffer = nodeBuffer.buffer.slice(nodeBuffer.byteOffset, nodeBuffer.byteOffset + nodeBuffer.byteLength);
            const result = yield bridge_1.analysisEngine.analyzeBuffer(arrayBuffer);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.file_size).toBe(nodeBuffer.length);
        }));
    });
    (0, globals_1.describe)('Performance Monitoring', () => {
        (0, globals_1.test)('should track execution metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            const buffer = new TextEncoder().encode('test code').buffer;
            const startMark = performance.now();
            const result = yield bridge_1.analysisEngine.analyzeBuffer(buffer);
            const endMark = performance.now();
            const totalTime = endMark - startMark;
            // WASM reported time should be less than total time
            (0, globals_1.expect)(result.analysis_time_ms).toBeLessThan(totalTime);
            (0, globals_1.expect)(result.analysis_time_ms).toBeGreaterThan(0);
        }));
    });
});
