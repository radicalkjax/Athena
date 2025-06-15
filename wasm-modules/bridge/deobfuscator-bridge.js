"use strict";
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
exports.StreamingDeobfuscatorBridge = exports.DeobfuscatorBridge = void 0;
exports.deobfuscate = deobfuscate;
exports.detectObfuscation = detectObfuscation;
exports.analyzeEntropy = analyzeEntropy;
exports.extractIOCs = extractIOCs;
// Dynamic imports - will be loaded based on platform
let Deobfuscator;
let StreamingDeobfuscator;
let getSupportedTechniques;
let getVersion;
class WASMError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WASMError';
    }
}
class DeobfuscatorBridge {
    constructor() {
        this.deobfuscator = null;
        this.isInitialized = false;
        this.initPromise = null;
    }
    static getInstance() {
        if (!DeobfuscatorBridge.instance) {
            DeobfuscatorBridge.instance = new DeobfuscatorBridge();
        }
        return DeobfuscatorBridge.instance;
    }
    async initialize(config) {
        if (this.isInitialized) {
            return;
        }
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = this.doInitialize(config);
        await this.initPromise;
    }
    async doInitialize(config) {
        try {
            // Platform-specific loading
            let wasmModule;
            if (typeof window !== 'undefined') {
                // Browser environment
                wasmModule = await Promise.resolve().then(() => __importStar(require('../core/deobfuscator/pkg-web/deobfuscator')));
                await wasmModule.default();
            }
            else {
                // Node.js environment - deobfuscator doesn't have pkg-node yet, use pkg
                wasmModule = require('../core/deobfuscator/pkg/deobfuscator');
            }
            // Store module references
            Deobfuscator = wasmModule.Deobfuscator;
            StreamingDeobfuscator = wasmModule.StreamingDeobfuscator;
            getSupportedTechniques = wasmModule.getSupportedTechniques;
            getVersion = wasmModule.getVersion;
            if (config) {
                this.deobfuscator = Deobfuscator.withConfig(config);
            }
            else {
                this.deobfuscator = new Deobfuscator();
            }
            this.isInitialized = true;
        }
        catch (error) {
            this.isInitialized = false;
            this.initPromise = null;
            throw new WASMError(`Failed to initialize deobfuscator: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    ensureInitialized() {
        if (!this.isInitialized || !this.deobfuscator) {
            throw new WASMError('Deobfuscator not initialized. Call initialize() first.');
        }
    }
    async detectObfuscation(content) {
        this.ensureInitialized();
        try {
            const result = await this.deobfuscator.detectObfuscation(content);
            return result;
        }
        catch (error) {
            throw new WASMError(`Obfuscation detection failed: ${error.message}`);
        }
    }
    async deobfuscate(content) {
        this.ensureInitialized();
        try {
            const result = await this.deobfuscator.deobfuscate(content);
            return result;
        }
        catch (error) {
            throw new WASMError(`Deobfuscation failed: ${error.message}`);
        }
    }
    async analyzeEntropy(content) {
        this.ensureInitialized();
        try {
            const result = await this.deobfuscator.analyzeEntropy(content);
            return result;
        }
        catch (error) {
            throw new WASMError(`Entropy analysis failed: ${error.message}`);
        }
    }
    async extractStrings(content) {
        this.ensureInitialized();
        try {
            const result = await this.deobfuscator.extractStrings(content);
            return result;
        }
        catch (error) {
            throw new WASMError(`String extraction failed: ${error.message}`);
        }
    }
    async extractIOCs(content) {
        this.ensureInitialized();
        try {
            const result = await this.deobfuscator.extractIOCs(content);
            return result;
        }
        catch (error) {
            throw new WASMError(`IOC extraction failed: ${error.message}`);
        }
    }
    async getConfig() {
        this.ensureInitialized();
        try {
            const config = await this.deobfuscator.getConfig();
            return config;
        }
        catch (error) {
            throw new WASMError(`Failed to get config: ${error.message}`);
        }
    }
    async updateConfig(config) {
        this.ensureInitialized();
        try {
            await this.deobfuscator.updateConfig(config);
        }
        catch (error) {
            throw new WASMError(`Failed to update config: ${error.message}`);
        }
    }
    getSupportedTechniques() {
        try {
            return getSupportedTechniques();
        }
        catch (error) {
            throw new WASMError(`Failed to get supported techniques: ${error.message}`);
        }
    }
    getVersion() {
        try {
            return getVersion();
        }
        catch (error) {
            throw new WASMError(`Failed to get version: ${error.message}`);
        }
    }
    createStreamingDeobfuscator(chunkSize) {
        return new StreamingDeobfuscatorBridge(chunkSize);
    }
    destroy() {
        if (this.deobfuscator) {
            // Clean up if needed
            this.deobfuscator = null;
        }
        this.isInitialized = false;
        this.initPromise = null;
        DeobfuscatorBridge.instance = null;
    }
}
exports.DeobfuscatorBridge = DeobfuscatorBridge;
DeobfuscatorBridge.instance = null;
class StreamingDeobfuscatorBridge {
    constructor(chunkSize) {
        this.chunkSize = chunkSize;
        this.streamingDeobfuscator = null;
        this.isInitialized = false;
        this.initialize();
    }
    async initialize() {
        try {
            let wasmModule;
            if (typeof window !== 'undefined') {
                // Browser environment
                wasmModule = await Promise.resolve().then(() => __importStar(require('../core/deobfuscator/pkg-web/deobfuscator')));
                await wasmModule.default();
            }
            else {
                // Node.js environment
                wasmModule = require('../core/deobfuscator/pkg/deobfuscator');
            }
            this.streamingDeobfuscator = new wasmModule.StreamingDeobfuscator(this.chunkSize);
            this.isInitialized = true;
        }
        catch (error) {
            throw new WASMError(`Failed to initialize streaming deobfuscator: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    ensureInitialized() {
        if (!this.isInitialized || !this.streamingDeobfuscator) {
            throw new WASMError('Streaming deobfuscator not initialized.');
        }
    }
    async processChunk(chunk) {
        this.ensureInitialized();
        try {
            const result = await this.streamingDeobfuscator.processChunk(chunk);
            if (result) {
                return result.result;
            }
            return null;
        }
        catch (error) {
            throw new WASMError(`Failed to process chunk: ${error.message}`);
        }
    }
    async flush() {
        this.ensureInitialized();
        try {
            const result = await this.streamingDeobfuscator.flush();
            if (result) {
                return result.result;
            }
            return null;
        }
        catch (error) {
            throw new WASMError(`Failed to flush: ${error.message}`);
        }
    }
    destroy() {
        if (this.streamingDeobfuscator) {
            // Clean up if needed
            this.streamingDeobfuscator = null;
        }
        this.isInitialized = false;
    }
}
exports.StreamingDeobfuscatorBridge = StreamingDeobfuscatorBridge;
// Convenience functions
async function deobfuscate(content, config) {
    const bridge = DeobfuscatorBridge.getInstance();
    await bridge.initialize(config);
    return bridge.deobfuscate(content);
}
async function detectObfuscation(content, config) {
    const bridge = DeobfuscatorBridge.getInstance();
    await bridge.initialize(config);
    return bridge.detectObfuscation(content);
}
async function analyzeEntropy(content) {
    const bridge = DeobfuscatorBridge.getInstance();
    await bridge.initialize();
    return bridge.analyzeEntropy(content);
}
async function extractIOCs(content) {
    const bridge = DeobfuscatorBridge.getInstance();
    await bridge.initialize();
    return bridge.extractIOCs(content);
}
