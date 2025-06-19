import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies BEFORE importing anything else
vi.mock('@/store', () => ({
  useAppStore: vi.fn()
}));

vi.mock('@/services/ai/manager', () => ({
  aiServiceManager: {
    analyzeWithFailover: vi.fn(),
    getProviderStatus: vi.fn(),
    getCircuitBreakerStatus: vi.fn()
  }
}));

vi.mock('@/shared/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

/**
 * Tests for useStreamingAnalysis hook
 */

import { renderHook, act } from '@testing-library/react-native';
import { useStreamingAnalysis } from '@/hooks/useStreamingAnalysis';
import { aiServiceManager } from '@/services/ai/manager';
import { useAppStore } from '@/store';
import { MalwareFile } from '@/types';

// Note: Mocks are defined above imports to ensure proper hoisting

describe('useStreamingAnalysis', () => {
  const mockFile: MalwareFile = {
    id: 'test-file-1',
    name: 'test.exe',
    size: 1024,
    type: 'application/x-executable',
    uri: 'file://test.exe',
    content: 'test content'
  };
  
  const mockStoreMethods = {
    startStreamingAnalysis: vi.fn(),
    setAnalysisProgress: vi.fn(),
    addAnalysisResult: vi.fn(),
    setIsAnalyzing: vi.fn(),
    clearAnalysisProgress: vi.fn()
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppStore).mockImplementation(() => mockStoreMethods);
    
    vi.mocked(aiServiceManager.getProviderStatus).mockReturnValue(new Map([
      ['claude', { 
        status: 'healthy',
        lastCheck: Date.now(),
        failureCount: 0,
        successRate: 1.0,
        averageResponseTime: 100
      }],
      ['openai', { 
        status: 'healthy',
        lastCheck: Date.now(),
        failureCount: 0,
        successRate: 1.0,
        averageResponseTime: 120
      }]
    ]));
    
    vi.mocked(aiServiceManager.getCircuitBreakerStatus).mockReturnValue(new Map([
      ['claude', { state: 'closed', failures: 0, lastFailure: null }],
      ['openai', { state: 'closed', failures: 0, lastFailure: null }]
    ]));
  });
  
  describe('import', () => {
    it('should import the hook successfully', () => {
      expect(useStreamingAnalysis).toBeDefined();
      expect(typeof useStreamingAnalysis).toBe('function');
    });
  });

  describe('analyze', () => {
    it('should return expected interface', () => {
      const { result } = renderHook(() => useStreamingAnalysis());
      
      expect(result.current).toBeDefined();
      expect(typeof result.current.analyze).toBe('function');
      expect(typeof result.current.cancel).toBe('function');
      expect(typeof result.current.getProviderStatus).toBe('function');
    });

    it('should perform streaming analysis successfully', async () => {
      const mockResult = {
        deobfuscatedCode: 'clean code',
        analysisReport: 'No issues found'
      };
      
      vi.mocked(aiServiceManager.analyzeWithFailover).mockImplementation(
        async (_code, _type, streaming) => {
          // Simulate streaming callbacks
          if (streaming) {
            streaming.onProgress?.(25);
            streaming.onChunk?.({
              type: 'progress',
              data: { stage: 'initializing', progress: 25 },
              timestamp: Date.now()
            });
            
            streaming.onProgress?.(50);
            streaming.onChunk?.({
              type: 'progress',
              data: { stage: 'analyzing', progress: 50 },
              timestamp: Date.now()
            });
            
            streaming.onComplete?.(mockResult);
          }
          return mockResult;
        }
      );
      
      const onComplete = vi.fn();
      const { result } = renderHook(() => {
        // Debug: Check what useAppStore returns inside the hook
        const store = useAppStore();
        console.log('Store inside hook:', Object.keys(store || {}));
        return useStreamingAnalysis({ onComplete });
      });
      
      // Debug: Check what the hook returns
      console.log('Hook result:', result.current);
      
      await act(async () => {
        await result.current?.analyze?.(mockFile, 'deobfuscate');
      });
      
      expect(mockStoreMethods.startStreamingAnalysis).toHaveBeenCalledWith(
        expect.stringContaining(mockFile.id)
      );
      
      expect(mockStoreMethods.setAnalysisProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 25,
          stage: 'analyzing',
          message: 'Analysis progress: 25%'
        })
      );
      
      expect(mockStoreMethods.setAnalysisProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          progress: 50,
          stage: 'analyzing'
        })
      );
      
      expect(mockStoreMethods.addAnalysisResult).toHaveBeenCalledWith(
        expect.objectContaining({
          malwareId: mockFile.id,
          deobfuscatedCode: 'clean code',
          analysisReport: 'No issues found'
        })
      );
      
      expect(onComplete).toHaveBeenCalledWith(mockResult);
    });
    
    it('should handle analysis errors', async () => {
      const error = new Error('Analysis failed');
      
      vi.mocked(aiServiceManager.analyzeWithFailover).mockRejectedValue(error);
      
      const onError = vi.fn();
      const { result } = renderHook(() => useStreamingAnalysis({ onError }));
      
      await act(async () => {
        await result.current.analyze(mockFile, 'vulnerabilities');
      });
      
      expect(mockStoreMethods.setIsAnalyzing).toHaveBeenCalledWith(false);
      expect(mockStoreMethods.clearAnalysisProgress).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(error);
    });
    
    it('should handle streaming errors', async () => {
      const error = new Error('Stream error');
      
      vi.mocked(aiServiceManager.analyzeWithFailover).mockImplementation(
        async (_code, _type, streaming) => {
          if (streaming) {
            streaming.onError?.(error);
          }
          throw error;
        }
      );
      
      const onError = vi.fn();
      const { result } = renderHook(() => useStreamingAnalysis({ onError }));
      
      await act(async () => {
        await result.current.analyze(mockFile, 'deobfuscate');
      });
      
      expect(mockStoreMethods.addAnalysisResult).toHaveBeenCalledWith(
        expect.objectContaining({
          malwareId: mockFile.id,
          error: error.message
        })
      );
      
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
  
  describe('cancel', () => {
    it('should cancel ongoing analysis', () => {
      const { result } = renderHook(() => useStreamingAnalysis());
      
      act(() => {
        result.current.cancel();
      });
      
      expect(mockStoreMethods.setIsAnalyzing).toHaveBeenCalledWith(false);
      expect(mockStoreMethods.clearAnalysisProgress).toHaveBeenCalled();
    });
  });
  
  describe('getProviderStatus', () => {
    it('should return provider and circuit breaker status', () => {
      const { result } = renderHook(() => useStreamingAnalysis());
      
      const status = result.current.getProviderStatus();
      
      expect(status).toEqual({
        providers: expect.any(Map),
        circuitBreakers: expect.any(Map)
      });
      
      expect(aiServiceManager.getProviderStatus).toHaveBeenCalled();
      expect(aiServiceManager.getCircuitBreakerStatus).toHaveBeenCalled();
    });
  });
});