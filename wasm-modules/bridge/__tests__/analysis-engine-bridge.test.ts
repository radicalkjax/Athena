import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analysisEngine, initializeAnalysisEngine } from '../analysis-engine-bridge';

// Mock the WASM module
vi.mock('../../core/analysis-engine/pkg-web/athena_analysis_engine', () => ({
  default: vi.fn().mockResolvedValue(undefined),
  AnalysisEngine: vi.fn().mockImplementation(() => ({
    get_version: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: {
        file_hash: 'test-hash',
        analysis_time_ms: 100,
        engine_version: '0.1.0'
      }
    })
  }))
}), { virtual: true });

describe('AnalysisEngineBridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize the engine', async () => {
    await initializeAnalysisEngine();
    expect(analysisEngine.getVersion()).toBe('0.1.0');
  });

  it('should analyze content', async () => {
    await initializeAnalysisEngine();
    
    const testContent = new TextEncoder().encode('test malware content');
    const result = await analysisEngine.analyze(testContent.buffer);
    
    expect(result).toMatchObject({
      severity: 'low',
      threats: [],
      metadata: expect.objectContaining({
        engine_version: '0.1.0'
      })
    });
  });

  it('should throw error if not initialized', () => {
    // Since AnalysisEngineBridge class is not exported, we'll test the instance behavior
    // Reset the engine state and test uninitialized behavior
    const engine = require('../analysis-engine-bridge').analysisEngine;
    // Reset internal state (this is a mock anyway, so we can simulate uninitialized state)
    engine.initialized = false;
    expect(() => engine.getVersion()).toThrow('Analysis Engine not initialized');
  });
});