/**
 * AI Service Manager - Handles provider failover and circuit breaker pattern
 */

import { BaseAIService } from './base';
import { claudeService } from '../claude';
import { openAIService } from '../openai';
import { deepSeekService } from '../deepseek';
import { 
  AIProviderInfo, 
  ProviderHealth, 
  StreamingAnalysis,
  DeobfuscationResult,
  VulnerabilityAnalysisResult
} from './types';
import { logger } from '@/shared/logging/logger';
import { circuitBreakerFactory } from './circuitBreakerFactory';
import { getCacheManager } from '../cache/redisFactory';
import { aiClientPool } from '../pool/aiClientPool';
import { bulkheadManager } from '../pool/bulkheadManager';
import { apmManager } from '../apm/manager';
import { featureFlags } from '../config/featureFlags';

export class AIServiceManager {
  private static instance: AIServiceManager;
  private providers: Map<string, AIProviderInfo> = new Map();
  private services: Map<string, BaseAIService> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  
  // Circuit breaker configuration
  private readonly FAILURE_THRESHOLD = 3;
  private readonly RECOVERY_TIME = 60000; // 1 minute
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  
  private constructor() {
    this.initializeProviders();
    this.startHealthChecks();
  }
  
  static getInstance(): AIServiceManager {
    if (!AIServiceManager.instance) {
      AIServiceManager.instance = new AIServiceManager();
    }
    return AIServiceManager.instance;
  }
  
  private initializeProviders() {
    // Initialize provider info
    const providers: Array<[string, BaseAIService, number]> = [
      ['claude', claudeService, 1],
      ['openai', openAIService, 2],
      ['deepseek', deepSeekService, 3],
    ];
    
    providers.forEach(([name, service, priority]) => {
      const providerInfo: AIProviderInfo = {
        name: name as any,
        storageKeyPrefix: `${name}:`,
        defaultModel: '',
        defaultBaseUrl: '',
        envKeyName: `${name.toUpperCase()}_API_KEY`,
        available: true,
        priority,
        health: {
          status: 'healthy',
          lastCheck: Date.now(),
          failureCount: 0,
          successRate: 100,
          averageResponseTime: 0,
        },
      };
      
      this.providers.set(name, providerInfo);
      this.services.set(name, service);
      
      // Circuit breakers are managed by the factory
    });
  }
  
  private startHealthChecks() {
    if (typeof setInterval !== 'undefined') {
      this.healthCheckInterval = setInterval(() => {
        this.checkProviderHealth();
      }, this.HEALTH_CHECK_INTERVAL);
    }
  }
  
  private async checkProviderHealth() {
    for (const [name, provider] of this.providers) {
      try {
        const startTime = Date.now();
        const service = this.services.get(name);
        
        if (!service) continue;
        
        // Simple health check - verify API key exists
        const hasApiKey = await service.hasValidApiKey();
        const responseTime = Date.now() - startTime;
        
        if (hasApiKey) {
          this.updateProviderHealth(name, true, responseTime);
        } else {
          this.updateProviderHealth(name, false, responseTime);
        }
      } catch (error) {
        this.updateProviderHealth(name, false, 0);
      }
    }
  }
  
  private updateProviderHealth(
    providerName: string, 
    success: boolean, 
    responseTime: number
  ) {
    const provider = this.providers.get(providerName);
    if (!provider) return;
    
    const health = provider.health;
    health.lastCheck = Date.now();
    
    if (success) {
      health.failureCount = 0;
      health.status = 'healthy';
      health.averageResponseTime = 
        (health.averageResponseTime * 0.9) + (responseTime * 0.1);
    } else {
      health.failureCount++;
      
      if (health.failureCount >= this.FAILURE_THRESHOLD) {
        health.status = 'unhealthy';
        provider.available = false;
        
        // Schedule recovery check
        setTimeout(() => {
          this.attemptRecovery(providerName);
        }, this.RECOVERY_TIME);
      } else {
        health.status = 'degraded';
      }
    }
    
    // Update success rate
    const totalChecks = 100; // Rolling window
    const successCount = success ? 
      (health.successRate * totalChecks / 100) + 1 : 
      (health.successRate * totalChecks / 100);
    health.successRate = (successCount / totalChecks) * 100;
  }
  
  private async attemptRecovery(providerName: string) {
    const provider = this.providers.get(providerName);
    if (!provider) return;
    
    logger.info(`Attempting recovery for provider: ${providerName}`);
    
    try {
      const service = this.services.get(providerName);
      if (service && await service.hasValidApiKey()) {
        provider.available = true;
        provider.health.status = 'healthy';
        provider.health.failureCount = 0;
        logger.info(`Provider ${providerName} recovered successfully`);
      }
    } catch (error) {
      logger.error(`Recovery failed for provider ${providerName}:`, error);
    }
  }
  
  async analyzeWithFailover(
    code: string,
    type: 'deobfuscate' | 'vulnerabilities',
    streaming?: StreamingAnalysis
  ): Promise<DeobfuscationResult | VulnerabilityAnalysisResult> {
    const span = apmManager.startSpan('ai.analysis', undefined);
    span.tags.type = type;
    span.tags.streaming = !!streaming;
    
    try {
      // Generate cache key
      const fileHash = this.generateFileHash(code);
      const cacheManager = getCacheManager();
      const cacheKey = cacheManager.generateKey({
        fileHash,
        analysisType: type,
      });
      
      // Check cache first (skip for streaming requests)
      if (!streaming) {
        const cacheStart = Date.now();
        const cachedResult = await cacheManager.get(cacheKey);
        const cacheDuration = Date.now() - cacheStart;
        
        if (cachedResult) {
          logger.info(`Cache hit for analysis type: ${type}`);
          apmManager.recordCacheOperation('hit', cacheDuration);
          span.tags.cache_hit = true;
          span.status = 'ok';
          return cachedResult;
        } else {
          apmManager.recordCacheOperation('miss', cacheDuration);
          span.tags.cache_hit = false;
        }
      }
    
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No AI providers are currently available');
    }
    
    let lastError: Error | null = null;
    
    for (const provider of availableProviders) {
      const service = this.services.get(provider.name);
      
      if (!service) continue;
      
      try {
        logger.info(`Attempting analysis with provider: ${provider.name}`);
        
        const startTime = Date.now();
        
        // Execute through circuit breaker and bulkhead
        const endpoint = `ai.${provider.name.toLowerCase()}.analyze`;
        const result = await circuitBreakerFactory.execute(endpoint, async () => {
          // Use bulkhead to limit concurrent requests per provider
          return await bulkheadManager.executeAITask(provider.name.toLowerCase(), async () => {
            if (streaming) {
              return await this.streamingAnalysis(
                service, 
                code, 
                type, 
                streaming,
                provider.name
              );
            } else {
              if (type === 'deobfuscate') {
                return await service.deobfuscateCode(code);
              } else {
                return await service.analyzeVulnerabilities(code);
              }
            }
          });
        });
        
        const responseTime = Date.now() - startTime;
        this.updateProviderHealth(provider.name, true, responseTime);
        
        // Record APM metrics
        apmManager.recordAnalysis(provider.name, type, responseTime, true);
        span.tags.provider = provider.name;
        span.tags.duration = responseTime;
        
        // Cache the result for non-streaming requests
        if (!streaming) {
          const cacheStart = Date.now();
          await cacheManager.set(cacheKey, result, {
            provider: provider.name,
            analysisType: type,
          });
          apmManager.recordCacheOperation('set', Date.now() - cacheStart);
        }
        
        span.status = 'ok';
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.error(`Provider ${provider.name} failed:`, error);
        this.updateProviderHealth(provider.name, false, 0);
        
        // Record failure metrics
        apmManager.recordAnalysis(provider.name, type, 0, false);
        
        // Continue to next provider
        continue;
      }
    }
    
    // All providers failed
    span.status = 'error';
    span.error = lastError || new Error('All AI providers failed');
    throw lastError || new Error('All AI providers failed');
    } catch (error) {
      span.status = 'error';
      span.error = error as Error;
      throw error;
    } finally {
      apmManager.finishSpan(span);
    }
  }
  
  private async streamingAnalysis(
    service: BaseAIService,
    code: string,
    type: 'deobfuscate' | 'vulnerabilities',
    streaming: StreamingAnalysis,
    providerName: string
  ): Promise<DeobfuscationResult | VulnerabilityAnalysisResult> {
    // Create a wrapped streaming object that adds provider info
    const wrappedStreaming: StreamingAnalysis = {
      onProgress: (progress) => {
        streaming.onProgress(progress);
      },
      onChunk: (chunk) => {
        streaming.onChunk({
          ...chunk,
          data: { ...chunk.data, provider: providerName }
        });
      },
      onComplete: streaming.onComplete,
      onError: streaming.onError,
      signal: streaming.signal
    };
    
    // Use the streaming methods from the base service
    if (type === 'deobfuscate') {
      return await service.deobfuscateCodeStreaming(code, wrappedStreaming);
    } else {
      return await service.analyzeVulnerabilitiesStreaming(code, wrappedStreaming);
    }
  }
  
  private getAvailableProviders(): AIProviderInfo[] {
    const providerPriority = featureFlags.flags.aiProviderPriority;
    
    return Array.from(this.providers.values())
      .filter(p => p.available && p.health.status !== 'unhealthy')
      .sort((a, b) => {
        // Sort by health status first
        if (a.health.status === 'healthy' && b.health.status !== 'healthy') return -1;
        if (a.health.status !== 'healthy' && b.health.status === 'healthy') return 1;
        
        // Then sort by feature flag priority
        const aPriority = providerPriority.indexOf(a.name);
        const bPriority = providerPriority.indexOf(b.name);
        
        // If both are in the priority list, sort by their position
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        
        // If only one is in the priority list, it comes first
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        
        // Otherwise, fall back to original priority
        return a.priority - b.priority;
      });
  }
  
  getProviderStatus(): Map<string, ProviderHealth> {
    const status = new Map<string, ProviderHealth>();
    for (const [name, provider] of this.providers) {
      status.set(name, { ...provider.health });
    }
    return status;
  }
  
  getCircuitBreakerStatus(): Map<string, any> {
    const status = new Map<string, any>();
    const allStats = circuitBreakerFactory.getAllStats();
    
    // Filter to only AI-related circuit breakers
    for (const [endpoint, stats] of Object.entries(allStats)) {
      if (endpoint.startsWith('ai.')) {
        const providerName = endpoint.split('.')[1];
        status.set(providerName, stats);
      }
    }
    return status;
  }
  
  private generateFileHash(content: string): string {
    // Simple hash function for React Native compatibility
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  getCacheStats() {
    const cacheManager = getCacheManager();
    return cacheManager.getStats();
  }
  
  async clearCache() {
    const cacheManager = getCacheManager();
    await cacheManager.clear();
    logger.info('Analysis cache cleared');
  }
  
  getPoolStats(provider?: string) {
    return aiClientPool.getPoolStats(provider);
  }
  
  cleanup() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    // Clean up pools
    aiClientPool.clearPools().catch(error => {
      logger.error('Failed to clear AI client pools:', error);
    });
  }
}

// Export singleton instance
export const aiServiceManager = AIServiceManager.getInstance();