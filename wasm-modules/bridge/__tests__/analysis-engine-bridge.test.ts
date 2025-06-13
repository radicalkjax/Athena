import { analysisEngine, initializeAnalysisEngine } from '../analysis-engine-bridge';

// Mock the WASM module
jest.mock('../../core/analysis-engine/pkg-web/athena_analysis_engine', () => ({
  default: jest.fn().mockResolvedValue(undefined),
  AnalysisEngine: jest.fn().mockImplementation(() => ({
    get_version: jest.fn().mockReturnValue('0.1.0'),
    analyze: jest.fn().mockResolvedValue({
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
    jest.clearAllMocks();
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
    const uninitializedEngine = new (require('../analysis-engine-bridge').AnalysisEngineBridge)();
    expect(() => uninitializedEngine.getVersion()).toThrow('Analysis Engine not initialized');
  });
});