/**
 * Tests for useStreamingAnalysis hook
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { useStreamingAnalysis } from '@/hooks/useStreamingAnalysis';
import { aiServiceManager } from '@/services/ai/manager';
import { useAnalysisStore } from '@/store';
import { MalwareFile } from '@/types';

// Mock dependencies
jest.mock('@/services/ai/manager', () => ({
  aiServiceManager: {
    analyzeWithFailover: jest.fn(),
    getProviderStatus: jest.fn(),
    getCircuitBreakerStatus: jest.fn()
  }
}));

jest.mock('@/store', () => ({
  useAnalysisStore: jest.fn()
}));

jest.mock('@/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

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
    startStreamingAnalysis: jest.fn(),
    setAnalysisProgress: jest.fn(),
    addAnalysisResult: jest.fn(),
    setIsAnalyzing: jest.fn(),
    clearAnalysisProgress: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalysisStore as jest.Mock).mockReturnValue(mockStoreMethods);
    
    (aiServiceManager.getProviderStatus as jest.Mock).mockReturnValue(new Map([
      ['claude', { status: 'healthy' }],
      ['openai', { status: 'healthy' }]
    ]));
    
    (aiServiceManager.getCircuitBreakerStatus as jest.Mock).mockReturnValue(new Map([
      ['claude', { state: 'closed' }],
      ['openai', { state: 'closed' }]
    ]));
  });
  
  describe('analyze', () => {
    it('should perform streaming analysis successfully', async () => {
      const mockResult = {
        deobfuscatedCode: 'clean code',
        analysisReport: 'No issues found'
      };
      
      (aiServiceManager.analyzeWithFailover as jest.Mock).mockImplementation(
        async (code, type, streaming) => {
          // Simulate streaming callbacks
          streaming.onProgress(25);
          streaming.onChunk({
            type: 'progress',
            data: { stage: 'initializing', progress: 25 },
            timestamp: Date.now()
          });
          
          streaming.onProgress(50);
          streaming.onChunk({
            type: 'progress',
            data: { stage: 'analyzing', progress: 50 },
            timestamp: Date.now()
          });
          
          streaming.onComplete(mockResult);
          return mockResult;
        }
      );
      
      const onComplete = jest.fn();
      const { result } = renderHook(() => useStreamingAnalysis({ onComplete }));
      
      await act(async () => {
        await result.current.analyze(mockFile, 'deobfuscate');
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
      
      (aiServiceManager.analyzeWithFailover as jest.Mock).mockRejectedValue(error);
      
      const onError = jest.fn();
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
      
      (aiServiceManager.analyzeWithFailover as jest.Mock).mockImplementation(
        async (code, type, streaming) => {
          streaming.onError(error);
          throw error;
        }
      );
      
      const onError = jest.fn();
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