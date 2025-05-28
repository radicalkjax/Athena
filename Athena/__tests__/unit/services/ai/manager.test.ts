/**
 * Tests for AI Service Manager
 */

import { AIServiceManager } from '@/services/ai/manager';
import { BaseAIService } from '@/services/ai/base';
import { StreamingAnalysis } from '@/services/ai/types';
import { logger } from '@/shared/logging/logger';

// Mock dependencies
jest.mock('@/services/claude', () => ({
  claudeService: {
    hasValidApiKey: jest.fn(),
    deobfuscateCode: jest.fn(),
    analyzeVulnerabilities: jest.fn(),
    deobfuscateCodeStreaming: jest.fn(),
    analyzeVulnerabilitiesStreaming: jest.fn()
  }
}));

jest.mock('@/services/openai', () => ({
  openAIService: {
    hasValidApiKey: jest.fn(),
    deobfuscateCode: jest.fn(),
    analyzeVulnerabilities: jest.fn(),
    deobfuscateCodeStreaming: jest.fn(),
    analyzeVulnerabilitiesStreaming: jest.fn()
  }
}));

jest.mock('@/services/deepseek', () => ({
  deepSeekService: {
    hasValidApiKey: jest.fn(),
    deobfuscateCode: jest.fn(),
    analyzeVulnerabilities: jest.fn(),
    deobfuscateCodeStreaming: jest.fn(),
    analyzeVulnerabilitiesStreaming: jest.fn()
  }
}));

jest.mock('@/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Import mocked services
import { claudeService } from '@/services/claude';
import { openAIService } from '@/services/openai';
import { deepSeekService } from '@/services/deepseek';

describe('AIServiceManager', () => {
  let manager: AIServiceManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (AIServiceManager as any).instance = null;
    manager = AIServiceManager.getInstance();
  });
  
  afterEach(() => {
    manager.cleanup();
  });
  
  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = AIServiceManager.getInstance();
      const instance2 = AIServiceManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });
  
  describe('analyzeWithFailover', () => {
    const mockCode = 'const test = "hello world";';
    const mockDeobfuscationResult = {
      deobfuscatedCode: 'const test = "hello world";',
      analysisReport: 'No obfuscation detected'
    };
    const mockVulnerabilityResult = {
      vulnerabilities: [],
      analysisReport: 'No vulnerabilities found'
    };
    
    beforeEach(() => {
      // Setup default successful responses
      (claudeService.hasValidApiKey as jest.Mock).mockResolvedValue(true);
      (claudeService.deobfuscateCode as jest.Mock).mockResolvedValue(mockDeobfuscationResult);
      (claudeService.analyzeVulnerabilities as jest.Mock).mockResolvedValue(mockVulnerabilityResult);
      
      (openAIService.hasValidApiKey as jest.Mock).mockResolvedValue(true);
      (openAIService.deobfuscateCode as jest.Mock).mockResolvedValue(mockDeobfuscationResult);
      (openAIService.analyzeVulnerabilities as jest.Mock).mockResolvedValue(mockVulnerabilityResult);
      
      (deepSeekService.hasValidApiKey as jest.Mock).mockResolvedValue(true);
      (deepSeekService.deobfuscateCode as jest.Mock).mockResolvedValue(mockDeobfuscationResult);
      (deepSeekService.analyzeVulnerabilities as jest.Mock).mockResolvedValue(mockVulnerabilityResult);
    });
    
    it('should analyze with the first available provider', async () => {
      const result = await manager.analyzeWithFailover(mockCode, 'deobfuscate');
      
      expect(result).toEqual(mockDeobfuscationResult);
      expect(claudeService.deobfuscateCode).toHaveBeenCalledWith(mockCode);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('claude'));
    });
    
    it('should failover to next provider on error', async () => {
      // Make claude fail
      (claudeService.deobfuscateCode as jest.Mock).mockRejectedValue(new Error('Claude failed'));
      
      const result = await manager.analyzeWithFailover(mockCode, 'vulnerabilities');
      
      expect(result).toEqual(mockVulnerabilityResult);
      expect(claudeService.analyzeVulnerabilities).toHaveBeenCalled();
      expect(openAIService.analyzeVulnerabilities).toHaveBeenCalledWith(mockCode);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Provider claude failed'),
        expect.any(Error)
      );
    });
    
    it('should throw error when all providers fail', async () => {
      // Make all providers fail
      const error = new Error('Provider failed');
      (claudeService.deobfuscateCode as jest.Mock).mockRejectedValue(error);
      (openAIService.deobfuscateCode as jest.Mock).mockRejectedValue(error);
      (deepSeekService.deobfuscateCode as jest.Mock).mockRejectedValue(error);
      
      await expect(manager.analyzeWithFailover(mockCode, 'deobfuscate'))
        .rejects.toThrow('Provider failed');
    });
    
    it('should support streaming analysis', async () => {
      const streamingCallbacks: StreamingAnalysis = {
        onProgress: jest.fn(),
        onChunk: jest.fn(),
        onComplete: jest.fn(),
        onError: jest.fn()
      };
      
      (claudeService.deobfuscateCodeStreaming as jest.Mock).mockImplementation(
        async (code, streaming) => {
          streaming.onProgress(50);
          streaming.onChunk({
            type: 'progress',
            data: { stage: 'analyzing' },
            timestamp: Date.now()
          });
          streaming.onComplete(mockDeobfuscationResult);
          return mockDeobfuscationResult;
        }
      );
      
      const result = await manager.analyzeWithFailover(
        mockCode,
        'deobfuscate',
        streamingCallbacks
      );
      
      expect(result).toEqual(mockDeobfuscationResult);
      expect(streamingCallbacks.onProgress).toHaveBeenCalledWith(50);
      expect(streamingCallbacks.onChunk).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'progress',
          data: expect.objectContaining({ provider: 'claude' })
        })
      );
      expect(streamingCallbacks.onComplete).toHaveBeenCalledWith(mockDeobfuscationResult);
    });
  });
  
  describe('getProviderStatus', () => {
    it('should return health status for all providers', () => {
      const status = manager.getProviderStatus();
      
      expect(status.size).toBe(3);
      expect(status.has('claude')).toBe(true);
      expect(status.has('openai')).toBe(true);
      expect(status.has('deepseek')).toBe(true);
      
      const claudeHealth = status.get('claude');
      expect(claudeHealth).toMatchObject({
        status: 'healthy',
        failureCount: 0,
        successRate: 100
      });
    });
  });
  
  describe('getCircuitBreakerStatus', () => {
    it('should return circuit breaker status for all providers', () => {
      const status = manager.getCircuitBreakerStatus();
      
      expect(status.size).toBe(3);
      
      const claudeStatus = status.get('claude');
      expect(claudeStatus).toMatchObject({
        state: 'closed',
        failureCount: 0,
        successCount: 0
      });
    });
  });
});