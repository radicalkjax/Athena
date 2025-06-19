// Mock WASM preprocessing pipeline for tests
class WASMPreprocessingPipeline {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return Promise.resolve();
  }

  async preprocess(input) {
    return {
      sanitized: input,
      risks: [],
      metadata: {
        processed: true,
        timestamp: Date.now()
      }
    };
  }

  async detectThreats(content) {
    return {
      threats: [],
      riskScore: 0,
      metadata: {}
    };
  }

  async sanitizeUrls(content) {
    return content;
  }

  cleanup() {
    this.initialized = false;
  }
}

// Create instance to export as wasmPreprocessor
const wasmPreprocessor = new WASMPreprocessingPipeline();

module.exports = { 
  WASMPreprocessingPipeline,
  wasmPreprocessor
};