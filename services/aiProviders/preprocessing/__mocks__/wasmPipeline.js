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
    // Handle different test cases
    if (input.content && input.content.includes && (
      input.content.includes('injection') || 
      input.content.includes('Ignore all previous instructions')
    )) {
      return {
        safe: false,
        cleaned: '[PROMPT INJECTION DETECTED]',
        threats: [{ type: 'prompt_injection', severity: 'high' }],
        risks: ['prompt_injection'],
        metadata: { processed: true }
      };
    }
    
    if (input.content && input.content.includes && input.content.includes('http')) {
      let cleaned = input.content;
      // Match the test expectations
      cleaned = cleaned.replace(/http:\/\/malicious\.example\.com[^\s]*/g, '[MALICIOUS URL REMOVED]');
      cleaned = cleaned.replace(/evil\.com/g, '[MALICIOUS URL REMOVED]');
      cleaned = cleaned.replace(/bit\.ly\/[^\s]+/g, '[URL SHORTENER REMOVED]');
      return {
        safe: true,
        cleaned,
        risks: [],
        metadata: { processed: true }
      };
    }
    
    if (input.content instanceof ArrayBuffer) {
      return {
        safe: true,
        cleaned: 'binary content',
        risks: [],
        metadata: { 
          processed: true,
          originalSize: input.content.byteLength
        }
      };
    }
    
    return {
      safe: true,
      sanitized: 'test',
      cleaned: input.content || 'test',
      risks: [],
      metadata: { processed: true }
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