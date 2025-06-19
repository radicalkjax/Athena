"use strict";
/**
 * Enhanced TypeScript bridge for the WASM Analysis Engine
 * Provides comprehensive type safety and error handling
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalysisEngineBridge = exports.analysisEngine = void 0;
exports.initializeAnalysisEngine = initializeAnalysisEngine;
exports.createAnalysisEngine = createAnalysisEngine;
const types_1 = require("./types");
const wasm_error_codes_1 = require("./wasm-error-codes");
const type_marshaling_1 = require("./type-marshaling");
class AnalysisEngineBridge {
    constructor(config = {}) {
        this.isInitialized = false;
        this.performanceMetrics = {};
        this.config = {
            maxFileSize: types_1.MAX_FILE_SIZE,
            timeout: types_1.DEFAULT_TIMEOUT,
            workerPool: false,
            workerCount: 4,
            cacheResults: true,
            logLevel: 'info',
            ...config
        };
    }
    async initialize() {
        // Return existing initialization promise if already in progress
        if (this.initPromise) {
            return this.initPromise;
        }
        if (this.isInitialized) {
            return Promise.resolve();
        }
        this.initPromise = this.performInitialization();
        return this.initPromise;
    }
    async performInitialization() {
        const startTime = performance.now();
        try {
            this.log('info', 'Initializing WASM Analysis Engine...');
            if (wasm_error_codes_1.isBrowser) {
                // Dynamic import for web
                this.wasmModule = await Promise.resolve().then(() => __importStar(require('../core/analysis-engine/pkg-web/athena_analysis_engine')));
                await this.wasmModule.default();
                this.engine = new this.wasmModule.AnalysisEngine();
            }
            else {
                // Node.js import - use pkg-node which should be CommonJS compatible
                this.wasmModule = require('../core/analysis-engine/pkg-node/athena_analysis_engine');
                this.engine = new this.wasmModule.AnalysisEngine();
            }
            this.isInitialized = true;
            this.performanceMetrics.initializationTime = performance.now() - startTime;
            this.log('info', `Analysis Engine initialized: v${this.get_version()} in ${this.performanceMetrics.initializationTime.toFixed(2)}ms`);
        }
        catch (error) {
            this.log('error', 'Failed to initialize WASM Analysis Engine:', error);
            throw new types_1.WASMError(`WASM initialization failed: ${error instanceof Error ? error.message : String(error)}`, types_1.WASMErrorCode.InitializationFailed);
        }
        finally {
            this.initPromise = undefined;
        }
    }
    get_version() {
        this.ensureInitialized();
        return this.engine.get_version();
    }
    async analyze(content, options = {}, eventHandlers) {
        await this.ensureInitializedAsync();
        // Validate input
        if (!content || content.length === 0) {
            throw new types_1.WASMError('Content cannot be empty', types_1.WASMErrorCode.InvalidInput);
        }
        if (content.length > this.config.maxFileSize) {
            throw new types_1.WASMError(`File size exceeds maximum allowed size of ${this.config.maxFileSize / 1024 / 1024}MB`, types_1.WASMErrorCode.InvalidInput);
        }
        const startTime = performance.now();
        eventHandlers?.onStart?.({ type: 'start', timestamp: Date.now() });
        try {
            // Set up timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new types_1.WASMError('Analysis timeout exceeded', types_1.WASMErrorCode.TimeoutError));
                }, options.maxAnalysisTime || this.config.timeout);
            });
            // Marshal options for WASM
            const marshaledOptions = type_marshaling_1.wasmTypeMarshaler.marshal(options || {});
            // Run analysis with timeout
            const analysisPromise = this.engine.analyze(content, marshaledOptions);
            const wasmResult = await Promise.race([analysisPromise, timeoutPromise]);
            // Unmarshal result from WASM
            const result = type_marshaling_1.wasmTypeMarshaler.unmarshalAnalysisResult(wasmResult);
            this.performanceMetrics.analysisTime = performance.now() - startTime;
            this.performanceMetrics.throughput = (content.length / 1024 / 1024) / (this.performanceMetrics.analysisTime / 1000);
            eventHandlers?.onComplete?.(result);
            this.log('debug', `Analysis completed in ${this.performanceMetrics.analysisTime.toFixed(2)}ms`);
            return result;
        }
        catch (error) {
            const wasmError = this.wrapError(error, types_1.WASMErrorCode.AnalysisFailed);
            eventHandlers?.onError?.(wasmError);
            throw wasmError;
        }
    }
    async deobfuscate(content) {
        await this.ensureInitializedAsync();
        if (!content || content.trim().length === 0) {
            throw new types_1.WASMError('Content cannot be empty', types_1.WASMErrorCode.InvalidInput);
        }
        const startTime = performance.now();
        try {
            const wasmResult = await this.engine.deobfuscate(content);
            this.performanceMetrics.deobfuscationTime = performance.now() - startTime;
            // Unmarshal result from WASM
            const result = type_marshaling_1.wasmTypeMarshaler.unmarshalDeobfuscationResult(wasmResult);
            this.log('debug', `Deobfuscation completed in ${this.performanceMetrics.deobfuscationTime.toFixed(2)}ms`);
            return result;
        }
        catch (error) {
            throw this.wrapError(error, types_1.WASMErrorCode.DeobfuscationFailed);
        }
    }
    async scan_patterns(content) {
        await this.ensureInitializedAsync();
        if (!content || content.length === 0) {
            throw new types_1.WASMError('Content cannot be empty', types_1.WASMErrorCode.InvalidInput);
        }
        const startTime = performance.now();
        try {
            const wasmResult = await this.engine.scan_patterns(content);
            this.performanceMetrics.patternScanTime = performance.now() - startTime;
            // Unmarshal result from WASM
            const result = wasmResult.map(match => type_marshaling_1.wasmTypeMarshaler.unmarshalPatternMatch(match));
            this.log('debug', `Pattern scan completed in ${this.performanceMetrics.patternScanTime.toFixed(2)}ms`);
            return result;
        }
        catch (error) {
            throw this.wrapError(error, types_1.WASMErrorCode.PatternScanFailed);
        }
    }
    // Additional utility methods
    async analyzeFile(file, options) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        return this.analyze(uint8Array, options);
    }
    async analyzeString(content, options) {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(content);
        return this.analyze(uint8Array, options);
    }
    async batchAnalyze(files, options, onProgress) {
        const results = [];
        const total = files.length;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total,
                    currentFile: file.name,
                    percentage: ((i + 1) / total) * 100
                });
            }
            try {
                const result = await this.analyzeFile(file, options);
                results.push(result);
            }
            catch (error) {
                // Include error in results but continue processing
                this.log('error', `Failed to analyze file ${file.name}:`, error);
                results.push({
                    severity: 'critical',
                    threats: [{
                            threat_type: 'AnalysisError',
                            confidence: 1.0,
                            description: `Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`,
                            indicators: []
                        }],
                    metadata: {
                        file_hash: '',
                        analysis_time_ms: 0,
                        engine_version: this.get_version()
                    }
                });
            }
        }
        return results;
    }
    getPerformanceMetrics() {
        const totalTime = Object.values(this.performanceMetrics)
            .filter(v => typeof v === 'number')
            .reduce((sum, time) => sum + time, 0);
        return {
            initializationTime: this.performanceMetrics.initializationTime || 0,
            analysisTime: this.performanceMetrics.analysisTime || 0,
            deobfuscationTime: this.performanceMetrics.deobfuscationTime || 0,
            patternScanTime: this.performanceMetrics.patternScanTime || 0,
            totalTime,
            memoryUsed: this.getMemoryUsage(),
            throughput: this.performanceMetrics.throughput || 0
        };
    }
    getMemoryUsage() {
        if (typeof performance !== 'undefined' && 'memory' in performance) {
            return performance.memory.usedJSHeapSize / 1024 / 1024; // MB
        }
        return 0;
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new types_1.WASMError('Analysis Engine not initialized. Call initialize() first.', types_1.WASMErrorCode.InitializationFailed);
        }
    }
    async ensureInitializedAsync() {
        if (!this.isInitialized) {
            await this.initialize();
        }
    }
    wrapError(error, code) {
        if (error instanceof types_1.WASMError) {
            return error;
        }
        const message = error?.message || String(error);
        return new types_1.WASMError(message, code);
    }
    log(level, ...args) {
        if (this.shouldLog(level)) {
            const consoleMethod = console[level];
            if (typeof consoleMethod === 'function') {
                consoleMethod('[WASM Analysis Engine]', ...args);
            }
        }
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const configLevel = levels.indexOf(this.config.logLevel || 'info');
        const messageLevel = levels.indexOf(level);
        return messageLevel >= configLevel;
    }
}
exports.AnalysisEngineBridge = AnalysisEngineBridge;
// Export singleton instance with default config
exports.analysisEngine = new AnalysisEngineBridge();
// Helper functions
async function initializeAnalysisEngine(config) {
    if (config) {
        // Create new instance with custom config
        const customEngine = new AnalysisEngineBridge(config);
        await customEngine.initialize();
        return;
    }
    await exports.analysisEngine.initialize();
}
function createAnalysisEngine(config) {
    return new AnalysisEngineBridge(config);
}
