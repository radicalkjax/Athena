"use strict";
/**
 * TypeScript bridge for the WASM Analysis Engine
 * Provides a unified interface for both web and Node.js platforms
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
exports.analysisEngine = void 0;
exports.initializeAnalysisEngine = initializeAnalysisEngine;
const isBrowser = typeof window !== 'undefined';
class AnalysisEngineBridge {
    constructor() {
        this.isInitialized = false;
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            // Check if we're in a browser environment
            if (isBrowser) {
                // Dynamic import for web
                const wasm = await Promise.resolve().then(() => __importStar(require('../core/analysis-engine/pkg-web/athena_analysis_engine')));
                await wasm.default();
                this.engine = new wasm.AnalysisEngine();
            }
            else {
                // Node.js import
                const wasm = require('../core/analysis-engine/pkg-node/athena_analysis_engine');
                this.engine = new wasm.AnalysisEngine();
            }
            this.isInitialized = true;
            console.log(`Analysis Engine initialized: v${this.getVersion()}`);
        }
        catch (error) {
            console.error('Failed to initialize WASM Analysis Engine:', error);
            throw new Error(`WASM initialization failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getVersion() {
        this.ensureInitialized();
        return this.engine.get_version();
    }
    async analyze(content, options = {}) {
        this.ensureInitialized();
        const uint8Array = new Uint8Array(content);
        try {
            const result = await this.engine.analyze(uint8Array, options);
            return result;
        }
        catch (error) {
            console.error('Analysis failed:', error);
            throw new Error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    ensureInitialized() {
        if (!this.isInitialized) {
            throw new Error('Analysis Engine not initialized. Call initialize() first.');
        }
    }
}
// Export singleton instance
exports.analysisEngine = new AnalysisEngineBridge();
// Helper function for easy initialization
async function initializeAnalysisEngine() {
    await exports.analysisEngine.initialize();
}
