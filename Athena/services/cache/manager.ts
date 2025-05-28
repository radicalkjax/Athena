/**
 * Cache manager implementation for performance optimization
 */

import { createHash } from 'crypto';
import {
  CacheManager,
  CacheConfig,
  CacheStats,
  CacheEntry,
  CacheKeyParams,
  CachePolicyOptions,
  CacheStorage,
  CacheableResult
} from './types';
import { MemoryCacheStorage } from './memoryStorage';
import { IndexedDBCacheStorage } from './indexedDBStorage';

const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 100 * 1024 * 1024, // 100MB
  ttl: 3600 * 1000, // 1 hour
  maxEntries: 1000,
  cleanupInterval: 300 * 1000 // 5 minutes
};

const DEFAULT_POLICY: CachePolicyOptions = {
  includeFileHash: true,
  includeAnalysisType: true,
  includeProvider: false
};

export class AnalysisCacheManager implements CacheManager {
  private storage: CacheStorage;
  private config: CacheConfig;
  private policy: CachePolicyOptions;
  private stats: CacheStats;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(options: {
    config?: Partial<CacheConfig>;
    policy?: Partial<CachePolicyOptions>;
    storage?: CacheStorage;
    useIndexedDB?: boolean;
  } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.policy = { ...DEFAULT_POLICY, ...options.policy };
    
    // Use provided storage or create default based on platform
    if (options.storage) {
      this.storage = options.storage;
    } else if (options.useIndexedDB && typeof indexedDB !== 'undefined') {
      this.storage = new IndexedDBCacheStorage();
    } else {
      this.storage = new MemoryCacheStorage();
    }

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: this.config.maxSize,
      hitRate: 0,
      entryCount: 0
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  async get<T = CacheableResult>(key: string): Promise<T | null> {
    const entry = await this.storage.get<T>(key);
    
    if (entry) {
      this.stats.hits++;
      this.updateHitRate();
      return entry.value;
    }

    this.stats.misses++;
    this.updateHitRate();
    return null;
  }

  async set<T = CacheableResult>(
    key: string,
    value: T,
    options: Partial<CacheEntry> = {}
  ): Promise<void> {
    const size = this.estimateSize(value);
    
    // Check if we need to evict entries
    const currentSize = await this.storage.getSize();
    if (currentSize + size > this.config.maxSize) {
      await this.evictLRU(size);
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      expiresAt: options.expiresAt || Date.now() + (options.ttl || this.config.ttl),
      hits: 0,
      size,
      analysisType: options.analysisType || 'deobfuscate',
      provider: options.provider,
      ttl: options.ttl
    };

    await this.storage.set(key, entry);
    this.stats.entryCount++;
    this.stats.currentSize = await this.storage.getSize();
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.storage.delete(key);
    if (result) {
      this.stats.entryCount--;
      this.stats.currentSize = await this.storage.getSize();
    }
    return result;
  }

  async clear(): Promise<void> {
    await this.storage.clear();
    this.stats.entryCount = 0;
    this.stats.currentSize = 0;
    this.stats.evictions = 0;
  }

  generateKey(params: CacheKeyParams): string {
    if (this.policy.keyGenerator) {
      return this.policy.keyGenerator(params);
    }

    const parts: string[] = [];
    
    if (this.policy.includeFileHash) {
      parts.push(params.fileHash);
    }
    
    if (this.policy.includeAnalysisType) {
      parts.push(params.analysisType);
    }
    
    if (this.policy.includeProvider && params.provider) {
      parts.push(params.provider);
    }

    if (params.additionalParams) {
      parts.push(JSON.stringify(params.additionalParams));
    }

    return this.hashKey(parts.join(':'));
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  async has(key: string): Promise<boolean> {
    const entry = await this.storage.get(key);
    return entry !== null;
  }

  async prune(): Promise<number> {
    const keys = await this.storage.getKeys();
    let pruned = 0;

    for (const key of keys) {
      const entry = await this.storage.get(key);
      if (entry && entry.expiresAt < Date.now()) {
        await this.storage.delete(key);
        pruned++;
      }
    }

    this.stats.entryCount -= pruned;
    this.stats.currentSize = await this.storage.getSize();
    return pruned;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // Private methods
  private hashKey(input: string): string {
    // For React Native compatibility, use a simple hash function
    // In production, you might want to use a proper crypto library
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `cache_${Math.abs(hash).toString(36)}`;
  }

  private estimateSize(value: any): number {
    // Simple size estimation - can be improved
    const str = JSON.stringify(value);
    return str.length * 2; // Assuming 2 bytes per character
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.prune().catch(console.error);
    }, this.config.cleanupInterval);
  }

  /**
   * Get singleton instance - for backward compatibility
   */
  static getInstance(
    config?: Partial<CacheConfig>,
    policy?: Partial<CachePolicyOptions>
  ): AnalysisCacheManager {
    return getAnalysisCacheManager(config, policy);
  }

  private async evictLRU(requiredSpace: number): Promise<void> {
    if (!(this.storage instanceof MemoryCacheStorage)) {
      // For IndexedDB, we need to implement getAllEntries
      const indexedStorage = this.storage as IndexedDBCacheStorage;
      const entries = await indexedStorage.getAllEntries();
      
      // Sort by hits (LRU) and timestamp
      entries.sort((a, b) => {
        if (a[1].hits === b[1].hits) {
          return a[1].timestamp - b[1].timestamp;
        }
        return a[1].hits - b[1].hits;
      });

      let freedSpace = 0;
      for (const [key] of entries) {
        if (freedSpace >= requiredSpace) break;
        
        const entry = await this.storage.get(key);
        if (entry) {
          freedSpace += entry.size;
          await this.storage.delete(key);
          this.stats.evictions++;
          this.stats.entryCount--;
        }
      }
    } else {
      // Memory storage implementation
      const memoryStorage = this.storage as MemoryCacheStorage;
      const entries = await memoryStorage.getAllEntries();
      
      // Sort by hits (LRU) and timestamp
      entries.sort((a, b) => {
        if (a[1].hits === b[1].hits) {
          return a[1].timestamp - b[1].timestamp;
        }
        return a[1].hits - b[1].hits;
      });

      let freedSpace = 0;
      for (const [key] of entries) {
        if (freedSpace >= requiredSpace) break;
        
        const entry = await this.storage.get(key);
        if (entry) {
          freedSpace += entry.size;
          await this.storage.delete(key);
          this.stats.evictions++;
          this.stats.entryCount--;
        }
      }
    }

    this.stats.currentSize = await this.storage.getSize();
  }
}

// Singleton instance
let cacheManagerInstance: AnalysisCacheManager | null = null;

export function getAnalysisCacheManager(
  config?: Partial<CacheConfig>,
  policy?: Partial<CachePolicyOptions>
): AnalysisCacheManager {
  if (!cacheManagerInstance) {
    const useIndexedDB = typeof document !== 'undefined'; // Web platform
    cacheManagerInstance = new AnalysisCacheManager({
      config,
      policy,
      useIndexedDB
    });
  }
  return cacheManagerInstance;
}

export function resetCacheManager(): void {
  if (cacheManagerInstance) {
    cacheManagerInstance.destroy();
    cacheManagerInstance = null;
  }
}