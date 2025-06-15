/**
 * AI Client connection pooling
 */

import { GenericResourcePool } from './resourcePool';
import { ResourceFactory, ResourcePoolConfig } from './types';
import { BaseAIService } from '../ai/base';
import { claudeService } from '../claude';
import { openAIService } from '../openai';
import { deepSeekService } from '../deepseek';
import { logger } from '@/shared/logging/logger';

export interface AIClientResource {
  provider: string;
  service: BaseAIService;
  connectionId: string;
  created: number;
}

class AIClientFactory implements ResourceFactory<AIClientResource> {
  constructor(private provider: string) {}

  async create(): Promise<AIClientResource> {
    let service: BaseAIService;
    
    switch (this.provider) {
      case 'claude':
        service = claudeService;
        break;
      case 'openai':
        service = openAIService;
        break;
      case 'deepseek':
        service = deepSeekService;
        break;
      default:
        throw new Error(`Unknown provider: ${this.provider}`);
    }

    // Ensure service is initialized
    await service.hasValidApiKey();

    return {
      provider: this.provider,
      service,
      connectionId: `${this.provider}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created: Date.now(),
    };
  }

  async validate(resource: AIClientResource): Promise<boolean> {
    try {
      // Quick validation - check if API key is still valid
      return await resource.service.hasValidApiKey();
    } catch (error: unknown) {
      logger.error(`Validation failed for ${resource.provider}:`, error);
      return false;
    }
  }

  async destroy(resource: AIClientResource): Promise<void> {
    // Nothing specific to destroy for AI services
    // They maintain their own internal state
    logger.info(`Destroying AI client resource: ${resource.connectionId}`);
  }
}

export class AIClientPool {
  private static instance: AIClientPool;
  private pools: Map<string, GenericResourcePool<AIClientResource>> = new Map();
  private config: ResourcePoolConfig = {
    minSize: 1,
    maxSize: 5,
    acquireTimeout: 10000,
    idleTimeout: 600000, // 10 minutes
    evictionInterval: 120000, // 2 minutes
    createRetries: 2,
    validateOnAcquire: true,
  };

  private constructor() {
    this.initializePools();
  }

  static getInstance(): AIClientPool {
    if (!AIClientPool.instance) {
      AIClientPool.instance = new AIClientPool();
    }
    return AIClientPool.instance;
  }

  private initializePools(): void {
    const providers = ['claude', 'openai', 'deepseek'];
    
    for (const provider of providers) {
      const factory = new AIClientFactory(provider);
      const pool = new GenericResourcePool(factory, this.config);
      this.pools.set(provider, pool);
    }
  }

  async acquireClient(provider: string): Promise<AIClientResource> {
    const pool = this.pools.get(provider);
    if (!pool) {
      throw new Error(`No pool for provider: ${provider}`);
    }

    const pooledResource = await pool.acquire();
    return pooledResource.resource;
  }

  releaseClient(provider: string, connectionId: string): void {
    const pool = this.pools.get(provider);
    if (!pool) {
      logger.warn(`No pool for provider: ${provider}`);
      return;
    }

    // Find the resource by connectionId
    const stats = pool.getStats();
    // Note: We need to track resource IDs separately or modify the pool
    // For now, we'll log the release
    logger.info(`Released client: ${connectionId} for provider: ${provider}`);
  }

  getPoolStats(provider?: string): any {
    if (provider) {
      const pool = this.pools.get(provider);
      return pool ? pool.getStats() : null;
    }

    const allStats: any = {};
    for (const [name, pool] of this.pools) {
      allStats[name] = pool.getStats();
    }
    return allStats;
  }

  async clearPools(): Promise<void> {
    const clearPromises: Promise<void>[] = [];
    for (const pool of this.pools.values()) {
      clearPromises.push(pool.clear());
    }
    await Promise.all(clearPromises);
  }

  resizePool(provider: string, minSize: number, maxSize: number): void {
    const pool = this.pools.get(provider);
    if (pool) {
      pool.resize(minSize, maxSize);
    }
  }
}

// Export singleton instance
export const aiClientPool = AIClientPool.getInstance();