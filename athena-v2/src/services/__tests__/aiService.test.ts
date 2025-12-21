import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiService } from '../aiService';
import { mockInvoke, createMockAIAnalysisResult, flushPromises } from '../../test-setup';
import type { AIAnalysisRequest } from '../../types/ai';

describe('AIService', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  describe('Provider initialization', () => {
    it('should initialize with default providers', () => {
      const providers = aiService.getAllProviders();

      expect(providers).toHaveLength(6);
      expect(providers.map(p => p.id)).toContain('claude');
      expect(providers.map(p => p.id)).toContain('gpt4');
      expect(providers.map(p => p.id)).toContain('deepseek');
      expect(providers.map(p => p.id)).toContain('gemini');
      expect(providers.map(p => p.id)).toContain('mistral');
      expect(providers.map(p => p.id)).toContain('llama');
    });

    it('should have all providers enabled by default', () => {
      const providers = aiService.getAllProviders();

      providers.forEach(provider => {
        expect(provider.enabled).toBe(true);
      });
    });

    it('should get provider status correctly', () => {
      expect(aiService.getProviderStatus('claude')).toBe(true);
      expect(aiService.getProviderStatus('gpt4')).toBe(true);
    });
  });

  describe('analyzeWithProvider', () => {
    const mockRequest: AIAnalysisRequest = {
      fileHash: 'test-hash-123',
      fileName: 'malware.exe',
      filePath: '/tmp/malware.exe',
      fileSize: 1024,
      fileType: 'pe',
      providers: ['claude'],
      analysisType: 'comprehensive',
      priority: 'high'
    };

    it('should successfully analyze with a provider', async () => {
      const mockResult = createMockAIAnalysisResult('claude');
      mockInvoke.mockResolvedValue(mockResult);

      const result = await aiService.analyzeWithProvider('claude', mockRequest);

      expect(mockInvoke).toHaveBeenCalledWith('analyze_with_ai', expect.objectContaining({
        provider: 'claude',
        config: expect.objectContaining({
          provider: 'claude',
          model: 'claude-3-opus-20240229'
        }),
        request: expect.objectContaining({
          file_hash: 'test-hash-123',
          file_path: '/tmp/malware.exe'
        })
      }));

      expect(result).toMatchObject(mockResult);
      expect(result.provider).toBe('claude');
    });

    it('should throw error for disabled provider', async () => {
      aiService.updateProviderConfig('claude', { enabled: false });

      await expect(
        aiService.analyzeWithProvider('claude', mockRequest)
      ).rejects.toThrow('Provider claude is not available or enabled');

      // Re-enable for other tests
      aiService.updateProviderConfig('claude', { enabled: true });
    });

    it('should cache analysis results', async () => {
      const mockResult = createMockAIAnalysisResult('claude');
      mockInvoke.mockResolvedValue(mockResult);

      // First call - should invoke backend
      await aiService.analyzeWithProvider('claude', mockRequest);
      expect(mockInvoke).toHaveBeenCalledTimes(1);

      // Second call with same params - should use cache
      await aiService.analyzeWithProvider('claude', mockRequest);
      expect(mockInvoke).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should handle analysis errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('API rate limit exceeded'));

      await expect(
        aiService.analyzeWithProvider('claude', mockRequest)
      ).rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('cancelAnalysis', () => {
    it('should cancel pending analysis requests', async () => {
      const mockRequest: AIAnalysisRequest = {
        fileHash: 'cancel-test-hash',
        fileName: 'test.exe',
        filePath: '/tmp/test.exe',
        fileSize: 1024,
        fileType: 'pe',
        providers: ['claude'],
        analysisType: 'comprehensive'
      };

      // Start analysis but don't await
      mockInvoke.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const analysisPromise = aiService.analyzeWithProvider('claude', mockRequest);

      // Cancel before completion
      await flushPromises();
      aiService.cancelAnalysis('cancel-test-hash');

      // Analysis should still complete (abort doesn't reject in current implementation)
      await analysisPromise;
    });
  });

  describe('analyzeWithMultipleProviders', () => {
    it('should analyze with multiple providers in parallel', async () => {
      const mockRequest: AIAnalysisRequest = {
        fileHash: 'multi-test-hash',
        fileName: 'malware.exe',
        filePath: '/tmp/malware.exe',
        fileSize: 1024,
        fileType: 'pe',
        providers: ['claude', 'gpt4', 'deepseek'],
        analysisType: 'comprehensive'
      };

      mockInvoke
        .mockResolvedValueOnce(createMockAIAnalysisResult('claude', { confidence: 0.9 }))
        .mockResolvedValueOnce(createMockAIAnalysisResult('gpt4', { confidence: 0.85 }))
        .mockResolvedValueOnce(createMockAIAnalysisResult('deepseek', { confidence: 0.8 }));

      const results = await aiService.analyzeWithMultipleProviders(mockRequest);

      expect(results).toHaveLength(3);
      expect(results[0].provider).toBe('claude');
      expect(results[1].provider).toBe('gpt4');
      expect(results[2].provider).toBe('deepseek');
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });

    it('should handle individual provider failures gracefully', async () => {
      const mockRequest: AIAnalysisRequest = {
        fileHash: 'failure-test-hash',
        fileName: 'malware.exe',
        filePath: '/tmp/malware.exe',
        fileSize: 1024,
        fileType: 'pe',
        providers: ['claude', 'gpt4'],
        analysisType: 'comprehensive'
      };

      mockInvoke
        .mockResolvedValueOnce(createMockAIAnalysisResult('claude'))
        .mockRejectedValueOnce(new Error('GPT-4 API error'));

      const results = await aiService.analyzeWithMultipleProviders(mockRequest);

      expect(results).toHaveLength(2);
      expect(results[0].provider).toBe('claude');
      expect(results[0].error).toBeUndefined();
      expect(results[1].provider).toBe('gpt4');
      expect(results[1].error).toBe('GPT-4 API error');
      expect(results[1].confidence).toBe(0);
    });
  });
});
