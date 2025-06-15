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
exports.reactNativeBridge = void 0;
const globals_1 = require("@jest/globals");
const bridge_1 = require("../../bridge");
Object.defineProperty(exports, "reactNativeBridge", { enumerable: true, get: function () { return bridge_1.reactNativeBridge; } });
const types_1 = require("../../bridge/types");
// Mock React Native modules
globals_1.jest.mock('react-native', () => ({
    NativeModules: {
        WASMAnalysisEngine: {
            initialize: globals_1.jest.fn().mockResolvedValue(true),
            analyzeBuffer: globals_1.jest.fn().mockImplementation((buffer) => {
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
                        severity: types_1.VulnerabilitySeverity.High,
                        description: 'Detected eval() usage',
                        location: 'line 1',
                        details: 'Potential code injection vulnerability'
                    });
                }
                return Promise.resolve(JSON.stringify(result));
            }),
            analyzeInBackground: globals_1.jest.fn().mockImplementation((taskId, buffer) => {
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
                                    severity: types_1.VulnerabilitySeverity.High,
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
                        mockEventEmitter.listeners[`analysis-complete-${taskId}`].forEach((cb) => cb(result));
                    }
                }, 100);
                return Promise.resolve(taskId);
            }),
            cancelBackgroundTask: globals_1.jest.fn().mockResolvedValue(true),
            isInitialized: globals_1.jest.fn().mockResolvedValue(true)
        }
    },
    DeviceEventEmitter: {
        addListener: globals_1.jest.fn().mockImplementation((event, callback) => {
            if (!mockEventEmitter.listeners[event]) {
                mockEventEmitter.listeners[event] = [];
            }
            mockEventEmitter.listeners[event].push(callback);
            return {
                remove: globals_1.jest.fn(() => {
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
    listeners: {}
};
(0, globals_1.describe)('React Native Bridge Integration Tests', () => {
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield bridge_1.reactNativeBridge.initialize();
    }));
    (0, globals_1.describe)('Basic Functionality', () => {
        (0, globals_1.test)('should initialize successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const initialized = yield bridge_1.reactNativeBridge.initialize();
            (0, globals_1.expect)(initialized).toBe(true);
            const isInit = yield bridge_1.reactNativeBridge.isInitialized();
            (0, globals_1.expect)(isInit).toBe(true);
        }));
        (0, globals_1.test)('should analyze buffer through native module', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'console.log("Hello from React Native");';
            const buffer = new TextEncoder().encode(code).buffer;
            const result = yield bridge_1.reactNativeBridge.analyzeBuffer(buffer);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.hash).toBe('mock-hash-' + buffer.byteLength);
            (0, globals_1.expect)(result.file_size).toBe(buffer.byteLength);
            (0, globals_1.expect)(result.vulnerabilities).toHaveLength(0);
        }));
        (0, globals_1.test)('should detect vulnerabilities through native module', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousCode = 'eval("malicious code");';
            const buffer = new TextEncoder().encode(maliciousCode).buffer;
            const result = yield bridge_1.reactNativeBridge.analyzeBuffer(buffer);
            (0, globals_1.expect)(result.vulnerabilities).toHaveLength(1);
            (0, globals_1.expect)(result.vulnerabilities[0].category).toBe('code-injection');
            (0, globals_1.expect)(result.vulnerabilities[0].severity).toBe(types_1.VulnerabilitySeverity.High);
            (0, globals_1.expect)(result.vulnerabilities[0].description).toContain('eval');
        }));
    });
    (0, globals_1.describe)('Background Processing', () => {
        (0, globals_1.test)('should analyze in background', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'eval("background test");';
            const buffer = new TextEncoder().encode(code).buffer;
            const result = yield bridge_1.reactNativeBridge.analyzeInBackground(buffer);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.taskId).toBeDefined();
            (0, globals_1.expect)(result.status).toBe('completed');
            (0, globals_1.expect)(result.result.vulnerabilities).toHaveLength(1);
            (0, globals_1.expect)(result.result.vulnerabilities[0].description).toContain('background');
        }));
        (0, globals_1.test)('should handle background task events', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'console.log("event test");';
            const buffer = new TextEncoder().encode(code).buffer;
            let eventReceived = false;
            const taskId = 'test-task-' + Date.now();
            // Set up event listener
            const subscription = bridge_1.reactNativeBridge.onBackgroundTaskComplete(taskId, (result) => {
                eventReceived = true;
                (0, globals_1.expect)(result.taskId).toBe(taskId);
                (0, globals_1.expect)(result.status).toBe('completed');
            });
            // Trigger background analysis
            yield bridge_1.reactNativeBridge.analyzeInBackground(buffer, { taskId });
            // Wait for event
            yield new Promise(resolve => setTimeout(resolve, 150));
            (0, globals_1.expect)(eventReceived).toBe(true);
            // Clean up
            subscription.remove();
        }));
        (0, globals_1.test)('should cancel background task', () => __awaiter(void 0, void 0, void 0, function* () {
            const taskId = 'cancel-task-' + Date.now();
            const cancelled = yield bridge_1.reactNativeBridge.cancelBackgroundTask(taskId);
            (0, globals_1.expect)(cancelled).toBe(true);
        }));
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.test)('should handle native module errors', () => __awaiter(void 0, void 0, void 0, function* () {
            // Mock an error
            const NativeModules = require('react-native').NativeModules;
            const originalAnalyze = NativeModules.WASMAnalysisEngine.analyzeBuffer;
            NativeModules.WASMAnalysisEngine.analyzeBuffer = globals_1.jest.fn()
                .mockRejectedValueOnce(new Error('Native module error'));
            const buffer = new ArrayBuffer(10);
            yield (0, globals_1.expect)(bridge_1.reactNativeBridge.analyzeBuffer(buffer))
                .rejects.toThrow('Native module error');
            // Restore original mock
            NativeModules.WASMAnalysisEngine.analyzeBuffer = originalAnalyze;
        }));
        (0, globals_1.test)('should validate input before passing to native', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, globals_1.expect)(bridge_1.reactNativeBridge.analyzeBuffer(null))
                .rejects.toThrow();
            yield (0, globals_1.expect)(bridge_1.reactNativeBridge.analyzeBuffer('string'))
                .rejects.toThrow();
        }));
    });
    (0, globals_1.describe)('Performance Features', () => {
        (0, globals_1.test)('should handle batch processing', () => __awaiter(void 0, void 0, void 0, function* () {
            const files = [
                { id: 'file1', buffer: new TextEncoder().encode('safe code').buffer },
                { id: 'file2', buffer: new TextEncoder().encode('eval("danger")').buffer },
                { id: 'file3', buffer: new TextEncoder().encode('console.log()').buffer }
            ];
            const results = yield bridge_1.reactNativeBridge.analyzeBatch(files);
            (0, globals_1.expect)(results).toHaveLength(3);
            const file1Result = results.find(r => r.id === 'file1');
            (0, globals_1.expect)(file1Result === null || file1Result === void 0 ? void 0 : file1Result.result.vulnerabilities).toHaveLength(0);
            const file2Result = results.find(r => r.id === 'file2');
            (0, globals_1.expect)(file2Result === null || file2Result === void 0 ? void 0 : file2Result.result.vulnerabilities).toHaveLength(1);
        }));
        (0, globals_1.test)('should support streaming analysis', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const results = [];
            yield bridge_1.reactNativeBridge.analyzeStream(stream, {
                onChunk: (result) => {
                    results.push(result);
                }
            });
            (0, globals_1.expect)(results.length).toBeGreaterThan(0);
            // Should detect eval in streamed content
            const hasEval = results.some(r => { var _a; return (_a = r.vulnerabilities) === null || _a === void 0 ? void 0 : _a.some((v) => v.description.includes('eval')); });
            (0, globals_1.expect)(hasEval).toBe(true);
        }));
    });
    (0, globals_1.describe)('Platform-Specific Features', () => {
        (0, globals_1.test)('should handle React Native buffer types', () => __awaiter(void 0, void 0, void 0, function* () {
            // Simulate React Native ArrayBuffer behavior
            const buffer = new ArrayBuffer(20);
            const view = new Uint8Array(buffer);
            const text = 'React Native test';
            for (let i = 0; i < text.length; i++) {
                view[i] = text.charCodeAt(i);
            }
            const result = yield bridge_1.reactNativeBridge.analyzeBuffer(buffer);
            (0, globals_1.expect)(result.file_size).toBe(20);
        }));
        (0, globals_1.test)('should work with large buffers', () => __awaiter(void 0, void 0, void 0, function* () {
            // Test with 1MB buffer
            const largeBuffer = new ArrayBuffer(1024 * 1024);
            const view = new Uint8Array(largeBuffer);
            // Fill with pattern
            for (let i = 0; i < view.length; i++) {
                view[i] = i % 256;
            }
            const result = yield bridge_1.reactNativeBridge.analyzeBuffer(largeBuffer);
            (0, globals_1.expect)(result.file_size).toBe(1024 * 1024);
            (0, globals_1.expect)(result.analysis_time_ms).toBeGreaterThan(0);
        }));
    });
    (0, globals_1.describe)('Event Management', () => {
        (0, globals_1.test)('should manage multiple event listeners', () => {
            var _a;
            const taskId = 'multi-event-test';
            const callbacks = [];
            // Add multiple listeners
            const sub1 = bridge_1.reactNativeBridge.onBackgroundTaskComplete(taskId, (result) => {
                callbacks.push('listener1');
            });
            const sub2 = bridge_1.reactNativeBridge.onBackgroundTaskComplete(taskId, (result) => {
                callbacks.push('listener2');
            });
            // Clean up
            sub1.remove();
            sub2.remove();
            // Verify cleanup
            (0, globals_1.expect)(((_a = mockEventEmitter.listeners[`analysis-complete-${taskId}`]) === null || _a === void 0 ? void 0 : _a.length) || 0).toBe(0);
        });
    });
});
