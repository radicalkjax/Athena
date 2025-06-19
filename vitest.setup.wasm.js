import { vi } from 'vitest';

// Mock all WASM core modules
const mockWasmModule = {
  default: vi.fn().mockResolvedValue({}),
  memory: new WebAssembly.Memory({ initial: 1 }),
  
  // Analysis Engine exports
  analyze_content: vi.fn().mockReturnValue(JSON.stringify({
    riskScore: 50,
    verdict: 'suspicious',
    indicators: [],
    metadata: {}
  })),
  
  // Crypto exports
  hash_data: vi.fn().mockReturnValue(new Uint8Array(32)),
  encrypt_data: vi.fn().mockReturnValue(new Uint8Array(0)),
  decrypt_data: vi.fn().mockReturnValue(new Uint8Array(0)),
  
  // Deobfuscator exports
  deobfuscate_javascript: vi.fn().mockReturnValue('deobfuscated code'),
  
  // File Processor exports
  process_file: vi.fn().mockReturnValue(JSON.stringify({
    fileType: 'unknown',
    metadata: {},
    extractedData: []
  })),
  
  // Network exports
  analyze_packet: vi.fn().mockReturnValue(JSON.stringify({
    protocol: 'unknown',
    suspicious: false
  })),
  
  // Pattern Matcher exports
  match_patterns: vi.fn().mockReturnValue(JSON.stringify({
    matches: []
  })),
  
  // Sandbox exports
  execute_sandboxed: vi.fn().mockReturnValue(JSON.stringify({
    success: true,
    output: '',
    errors: []
  }))
};

// Mock all WASM module paths
vi.mock('../core/analysis-engine/pkg-node/athena_analysis_engine', () => mockWasmModule);
vi.mock('../core/crypto/pkg-node/athena_crypto', () => mockWasmModule);
vi.mock('../core/deobfuscator/pkg-node/athena_deobfuscator', () => mockWasmModule);
vi.mock('../core/file-processor/pkg-node/athena_file_processor', () => mockWasmModule);
vi.mock('../core/network/pkg-node/athena_network', () => mockWasmModule);
vi.mock('../core/pattern-matcher/pkg-node/athena_pattern_matcher', () => mockWasmModule);
vi.mock('../core/sandbox/pkg-node/athena_sandbox', () => mockWasmModule);

// Mock WASM bridge initialization
vi.mock('./wasm-modules/bridge/analysis-engine-bridge-enhanced.js', () => ({
  AnalysisEngineBridge: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: {
        engine_version: '0.1.0'
      }
    })
  })),
  analysisEngine: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: {
        engine_version: '0.1.0'
      }
    })
  },
  initializeAnalysisEngine: vi.fn().mockResolvedValue(undefined),
  createAnalysisEngine: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: {
        engine_version: '0.1.0'
      }
    })
  })
}));

vi.mock('./wasm-modules/bridge/analysis-engine-bridge.js', () => ({
  AnalysisEngineBridge: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: {
        engine_version: '0.1.0'
      }
    })
  })),
  analysisEngine: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: {
        engine_version: '0.1.0'
      }
    })
  },
  initializeAnalysisEngine: vi.fn().mockResolvedValue(undefined)
}));