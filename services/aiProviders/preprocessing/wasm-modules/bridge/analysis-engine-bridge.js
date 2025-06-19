"use strict";
/**
 * TypeScript bridge for the WASM Analysis Engine
 * Provides a unified interface for both web and Node.js platforms
 */
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
                const wasm = await Promise.resolve().then(() => require('../core/analysis-engine/pkg-web/athena_analysis_engine'));
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
