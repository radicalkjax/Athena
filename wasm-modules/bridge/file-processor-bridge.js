"use strict";
/**
 * TypeScript bridge for the WASM File Processor module
 * Provides type-safe interface and error handling for file processing operations
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
exports.createFileProcessor = createFileProcessor;
const types_1 = require("./types");
const wasm_error_codes_1 = require("./wasm-error-codes");
class FileProcessorBridge {
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
            minStringLength: 4,
            extractMetadata: true,
            deepAnalysis: false,
            ...config
        };
    }
    async initialize() {
        // Return existing initialization promise if already in progress
        if (this.initPromise) {
            return this.initPromise;
        }
        // Guard against multiple initializations
        if (this.isInitialized) {
            return;
        }
        this.initPromise = this.performInitialization();
        return this.initPromise;
    }
    async performInitialization() {
        const startTime = performance.now();
        try {
            // Platform-specific loading
            if (wasm_error_codes_1.isBrowser) {
                await this.loadForWeb();
            }
            else {
                await this.loadForNode();
            }
            // Create processor instance
            this.processor = new this.wasmModule.FileProcessor();
            // Initialize the module
            this.wasmModule.init();
            this.isInitialized = true;
            this.performanceMetrics.initTime = performance.now() - startTime;
            if (this.config.logLevel === 'debug') {
                console.log(`File Processor initialized in ${this.performanceMetrics.initTime}ms`);
            }
        }
        catch (error) {
            throw new types_1.WASMError('Failed to initialize File Processor', wasm_error_codes_1.WASMErrorCode.INIT_FAILED, error);
        }
    }
    async loadForWeb() {
        try {
            // Dynamic import for web platform
            const module = await Promise.resolve().then(() => __importStar(require('../core/file-processor/pkg-web/file_processor')));
            await module.default();
            this.wasmModule = module;
        }
        catch (error) {
            throw new types_1.WASMError('Failed to load WASM module for web', wasm_error_codes_1.WASMErrorCode.LOAD_FAILED, error);
        }
    }
    async loadForNode() {
        try {
            // For Node.js environment - file-processor doesn't have pkg-node yet, use pkg
            const module = require('../core/file-processor/pkg/file_processor');
            this.wasmModule = module;
        }
        catch (error) {
            throw new types_1.WASMError('Failed to load WASM module for Node.js', wasm_error_codes_1.WASMErrorCode.LOAD_FAILED, error);
        }
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new types_1.WASMError('File Processor not initialized. Call initialize() first.', wasm_error_codes_1.WASMErrorCode.NOT_INITIALIZED);
        }
    }
    validateBuffer(buffer) {
        if (!buffer || !(buffer instanceof ArrayBuffer)) {
            throw new types_1.WASMError('Invalid buffer provided', wasm_error_codes_1.WASMErrorCode.INVALID_INPUT);
        }
        if (buffer.byteLength === 0) {
            throw new types_1.WASMError('Empty buffer provided', wasm_error_codes_1.WASMErrorCode.INVALID_INPUT);
        }
        const maxSize = this.config.maxFileSize || types_1.MAX_FILE_SIZE;
        if (buffer.byteLength > maxSize) {
            throw new types_1.WASMError(`File size ${buffer.byteLength} exceeds maximum allowed size ${maxSize}`, wasm_error_codes_1.WASMErrorCode.SIZE_LIMIT_EXCEEDED);
        }
    }
    async detectFormat(buffer, filename) {
        this.ensureInitialized();
        this.validateBuffer(buffer);
        const startTime = performance.now();
        try {
            const uint8Array = new Uint8Array(buffer);
            const resultJson = await this.withTimeout(() => this.processor.detectFormat(uint8Array, filename || null), this.config.timeout || types_1.DEFAULT_TIMEOUT);
            const result = JSON.parse(resultJson);
            // Get MIME type for the detected format
            const mimeType = this.getMimeType(resultJson);
            this.performanceMetrics.lastOperationTime = performance.now() - startTime;
            return {
                format: result,
                confidence: 1.0, // TODO: Add confidence scoring
                mimeType
            };
        }
        catch (error) {
            throw new types_1.WASMError('Failed to detect file format', wasm_error_codes_1.WASMErrorCode.PROCESSING_FAILED, error);
        }
    }
    async parseFile(buffer, formatHint) {
        this.ensureInitialized();
        this.validateBuffer(buffer);
        const startTime = performance.now();
        try {
            const uint8Array = new Uint8Array(buffer);
            const resultJson = await this.withTimeout(() => this.processor.parseFile(uint8Array, formatHint || null), this.config.timeout || types_1.DEFAULT_TIMEOUT);
            const result = JSON.parse(resultJson);
            this.performanceMetrics.lastOperationTime = performance.now() - startTime;
            return result;
        }
        catch (error) {
            throw new types_1.WASMError('Failed to parse file', wasm_error_codes_1.WASMErrorCode.PROCESSING_FAILED, error);
        }
    }
    async validateFile(buffer) {
        this.ensureInitialized();
        this.validateBuffer(buffer);
        const startTime = performance.now();
        try {
            const uint8Array = new Uint8Array(buffer);
            const resultJson = await this.withTimeout(() => this.processor.validateFile(uint8Array), this.config.timeout || types_1.DEFAULT_TIMEOUT);
            const result = JSON.parse(resultJson);
            this.performanceMetrics.lastOperationTime = performance.now() - startTime;
            return result;
        }
        catch (error) {
            throw new types_1.WASMError('Failed to validate file', wasm_error_codes_1.WASMErrorCode.PROCESSING_FAILED, error);
        }
    }
    async extractStrings(buffer, minLength) {
        this.ensureInitialized();
        this.validateBuffer(buffer);
        const startTime = performance.now();
        try {
            const uint8Array = new Uint8Array(buffer);
            const resultJson = await this.withTimeout(() => this.processor.extractStrings(uint8Array, minLength || this.config.minStringLength || null), this.config.timeout || types_1.DEFAULT_TIMEOUT);
            const result = JSON.parse(resultJson);
            this.performanceMetrics.lastOperationTime = performance.now() - startTime;
            return result;
        }
        catch (error) {
            throw new types_1.WASMError('Failed to extract strings', wasm_error_codes_1.WASMErrorCode.PROCESSING_FAILED, error);
        }
    }
    async extractMetadata(buffer) {
        this.ensureInitialized();
        this.validateBuffer(buffer);
        const startTime = performance.now();
        try {
            const uint8Array = new Uint8Array(buffer);
            const resultJson = await this.withTimeout(() => this.processor.extractMetadata(uint8Array), this.config.timeout || types_1.DEFAULT_TIMEOUT);
            const result = JSON.parse(resultJson);
            this.performanceMetrics.lastOperationTime = performance.now() - startTime;
            return result;
        }
        catch (error) {
            throw new types_1.WASMError('Failed to extract metadata', wasm_error_codes_1.WASMErrorCode.PROCESSING_FAILED, error);
        }
    }
    async extractSuspiciousPatterns(content) {
        this.ensureInitialized();
        if (!content || typeof content !== 'string') {
            throw new types_1.WASMError('Invalid content provided', wasm_error_codes_1.WASMErrorCode.INVALID_INPUT);
        }
        const startTime = performance.now();
        try {
            const resultJson = await this.withTimeout(() => this.processor.extractSuspiciousPatterns(content), this.config.timeout || types_1.DEFAULT_TIMEOUT);
            const result = JSON.parse(resultJson);
            this.performanceMetrics.lastOperationTime = performance.now() - startTime;
            return result;
        }
        catch (error) {
            throw new types_1.WASMError('Failed to extract suspicious patterns', wasm_error_codes_1.WASMErrorCode.PROCESSING_FAILED, error);
        }
    }
    async isTextFile(buffer) {
        this.ensureInitialized();
        this.validateBuffer(buffer);
        try {
            const uint8Array = new Uint8Array(buffer);
            return this.processor.isTextFile(uint8Array);
        }
        catch (error) {
            throw new types_1.WASMError('Failed to check if file is text', wasm_error_codes_1.WASMErrorCode.PROCESSING_FAILED, error);
        }
    }
    getMimeType(format) {
        this.ensureInitialized();
        try {
            return this.processor.getMimeType(format);
        }
        catch (error) {
            // Return a default MIME type on error
            return 'application/octet-stream';
        }
    }
    async withTimeout(operation, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new types_1.WASMError('Operation timed out', wasm_error_codes_1.WASMErrorCode.TIMEOUT));
            }, timeout);
            try {
                const result = operation();
                clearTimeout(timer);
                resolve(result);
            }
            catch (error) {
                clearTimeout(timer);
                reject(error);
            }
        });
    }
    destroy() {
        if (this.processor) {
            this.processor.free();
            this.processor = null;
        }
        this.isInitialized = false;
        this.initPromise = undefined;
    }
    getPerformanceMetrics() {
        return {
            initializationTime: this.performanceMetrics.initTime || 0,
            analysisTime: this.performanceMetrics.lastOperationTime || 0,
            totalTime: (this.performanceMetrics.initTime || 0) + (this.performanceMetrics.lastOperationTime || 0),
            memoryUsed: 0, // TODO: Track memory usage
            throughput: 0 // TODO: Calculate throughput
        };
    }
}
// Factory function to create file processor instance
function createFileProcessor(config) {
    return new FileProcessorBridge(config);
}
// Types are already exported as interfaces above
