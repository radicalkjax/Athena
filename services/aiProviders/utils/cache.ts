/**
 * Response Cache for AI Provider Results
 * Implements LRU cache with TTL support
 */

import { AnalysisResult } from '../types';

interface CacheEntry {
  value: AnalysisResult;
  timestamp: number;
  hits: number;
}

interface CacheConfig {
  ttl: number; // milliseconds
  maxSize: number;
  onEvict?: (key: string, value: AnalysisResult) => void;
}

export class ResponseCache {
  private cache: Map<string, CacheEntry>;
  private accessOrder: string[];
  private config: CacheConfig;
  
  constructor(config: CacheConfig) {
    this.config = config;
    this.cache = new Map();
    this.accessOrder = [];
  }
  
  async get(key: string): Promise<AnalysisResult | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.config.ttl) {
      this.delete(key);
      return null;
    }
    
    // Update access order (LRU)
    this.updateAccessOrder(key);
    entry.hits++;
    
    return entry.value;
  }
  
  async set(key: string, value: AnalysisResult): Promise<void> {
    // Check size limit
    if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
    
    this.updateAccessOrder(key);
  }
  
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry && this.config.onEvict) {
      this.config.onEvict(key, entry.value);
    }
    
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    return this.cache.delete(key);
  }
  
  clear(): void {
    if (this.config.onEvict) {
      for (const [key, entry] of this.cache.entries()) {
        this.config.onEvict(key, entry.value);
      }
    }
    
    this.cache.clear();
    this.accessOrder = [];
  }
  
  getStats(): CacheStats {
    let totalHits = 0;
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      totalSize += JSON.stringify(entry.value).length;
    }
    
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      totalHits,
      totalSize,
      hitRate: this.calculateHitRate()
    };
  }
  
  private updateAccessOrder(key: string) {
    // Remove from current position
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }
  
  private evictLRU() {
    // Remove least recently used
    const lruKey = this.accessOrder.shift();
    if (lruKey) {
      this.delete(lruKey);
    }
  }
  
  private calculateHitRate(): number {
    let hits = 0;
    let total = 0;
    
    for (const entry of this.cache.values()) {
      hits += entry.hits;
      total += entry.hits + 1; // +1 for initial set
    }
    
    return total > 0 ? hits / total : 0;
  }
}

interface CacheStats {
  size: number;
  maxSize: number;
  totalHits: number;
  totalSize: number;
  hitRate: number;
}

/**
 * Multi-tier cache with memory and optional Redis backend
 */
export class TieredCache {
  private memoryCache: ResponseCache;
  private redisClient?: any; // Would be Redis client
  
  constructor(
    config: CacheConfig,
    redisClient?: any
  ) {
    this.memoryCache = new ResponseCache(config);
    this.redisClient = redisClient;
  }
  
  async get(key: string): Promise<AnalysisResult | null> {
    // Check memory first
    const memResult = await this.memoryCache.get(key);
    if (memResult) {
      return memResult;
    }
    
    // Check Redis if available
    if (this.redisClient) {
      const redisResult = await this.getFromRedis(key);
      if (redisResult) {
        // Promote to memory cache
        await this.memoryCache.set(key, redisResult);
        return redisResult;
      }
    }
    
    return null;
  }
  
  async set(key: string, value: AnalysisResult): Promise<void> {
    // Set in both tiers
    await this.memoryCache.set(key, value);
    
    if (this.redisClient) {
      await this.setInRedis(key, value);
    }
  }
  
  private async getFromRedis(key: string): Promise<AnalysisResult | null> {
    try {
      const data = await this.redisClient.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error: unknown) {
      console.error('Redis get error:', error);
      return null;
    }
  }
  
  private async setInRedis(key: string, value: AnalysisResult): Promise<void> {
    try {
      await this.redisClient.setex(
        key,
        Math.floor(this.memoryCache['config'].ttl / 1000), // TTL in seconds
        JSON.stringify(value)
      );
    } catch (error: unknown) {
      console.error('Redis set error:', error);
    }
  }
}