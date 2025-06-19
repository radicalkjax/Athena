// Mock WASM module for CI testing
export default {
  // Mock WASM initialization
  default: () => Promise.resolve(),
  
  // Common WASM exports
  memory: new WebAssembly.Memory({ initial: 1 }),
  
  // Analysis Engine exports
  analyze_content: () => JSON.stringify({
    riskScore: 50,
    verdict: 'suspicious',
    indicators: [],
    metadata: {}
  }),
  
  // Crypto exports
  hash_data: () => new Uint8Array(32),
  encrypt_data: () => new Uint8Array(0),
  decrypt_data: () => new Uint8Array(0),
  
  // Deobfuscator exports
  deobfuscate_javascript: () => 'deobfuscated code',
  
  // File Processor exports
  process_file: () => JSON.stringify({
    fileType: 'unknown',
    metadata: {},
    extractedData: []
  }),
  
  // Network exports
  analyze_packet: () => JSON.stringify({
    protocol: 'unknown',
    suspicious: false
  }),
  
  // Pattern Matcher exports
  match_patterns: () => JSON.stringify({
    matches: []
  }),
  
  // Sandbox exports
  execute_sandboxed: () => JSON.stringify({
    success: true,
    output: '',
    errors: []
  })
};