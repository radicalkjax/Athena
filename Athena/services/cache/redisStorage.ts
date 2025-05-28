import type Redis from 'ioredis';
import { CacheStorage, CacheEntry } from './types';
import { MemoryCacheStorage } from './memoryStorage';
import { logger } from '@/shared/logging/logger';

export interface RedisStorageConfig {
  redis: Redis;
  keyPrefix?: string;
  fallbackToMemory?: boolean;
}

export class RedisCacheStorage implements CacheStorage {
  private redis: Redis;
  private keyPrefix: string;
  private localFallback: MemoryCacheStorage | null;
  private isConnected: boolean = false;

  constructor(config: RedisStorageConfig) {
    this.redis = config.redis;
    this.keyPrefix = config.keyPrefix || 'athena:cache:';
    this.localFallback = config.fallbackToMemory !== false ? new MemoryCacheStorage() : null;

    // Set up connection handlers
    this.redis.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis cache connected');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis cache error:', error);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis cache disconnected');
    });
  }

  private getRedisKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get(key: string): Promise<CacheEntry | null> {
    try {
      if (!this.isConnected && this.localFallback) {
        return this.localFallback.get(key);
      }

      const redisKey = this.getRedisKey(key);
      const value = await this.redis.get(redisKey);
      
      if (!value) {
        // Check local fallback if Redis doesn't have it
        if (this.localFallback) {
          return this.localFallback.get(key);
        }
        return null;
      }

      const entry = JSON.parse(value) as CacheEntry;
      
      // Update local fallback with Redis data
      if (this.localFallback) {
        await this.localFallback.set(key, entry);
      }

      return entry;
    } catch (error) {
      logger.error('Redis get error:', error);
      
      // Fallback to local storage on error
      if (this.localFallback) {
        return this.localFallback.get(key);
      }
      
      throw error;
    }
  }

  async set(key: string, value: CacheEntry): Promise<void> {
    try {
      const redisKey = this.getRedisKey(key);
      const serialized = JSON.stringify(value);
      
      // Set in Redis with TTL if provided
      if (value.ttl) {
        const ttlSeconds = Math.floor(value.ttl / 1000);
        await this.redis.setex(redisKey, ttlSeconds, serialized);
      } else {
        await this.redis.set(redisKey, serialized);
      }

      // Also update local fallback
      if (this.localFallback) {
        await this.localFallback.set(key, value);
      }
    } catch (error) {
      logger.error('Redis set error:', error);
      
      // Still update local fallback on Redis error
      if (this.localFallback) {
        await this.localFallback.set(key, value);
      } else {
        throw error;
      }
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const redisKey = this.getRedisKey(key);
      await this.redis.del(redisKey);

      // Also delete from local fallback
      if (this.localFallback) {
        await this.localFallback.delete(key);
      }
    } catch (error) {
      logger.error('Redis delete error:', error);
      
      // Still delete from local fallback on Redis error
      if (this.localFallback) {
        await this.localFallback.delete(key);
      } else {
        throw error;
      }
    }
  }

  async clear(): Promise<void> {
    try {
      // Find and delete all keys with our prefix
      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      // Also clear local fallback
      if (this.localFallback) {
        await this.localFallback.clear();
      }
    } catch (error) {
      logger.error('Redis clear error:', error);
      
      // Still clear local fallback on Redis error
      if (this.localFallback) {
        await this.localFallback.clear();
      } else {
        throw error;
      }
    }
  }

  async keys(): Promise<string[]> {
    try {
      if (!this.isConnected && this.localFallback) {
        return this.localFallback.getKeys();
      }

      const pattern = `${this.keyPrefix}*`;
      const redisKeys = await this.redis.keys(pattern);
      
      // Remove prefix from keys
      return redisKeys.map(key => key.slice(this.keyPrefix.length));
    } catch (error) {
      logger.error('Redis keys error:', error);
      
      // Fallback to local storage on error
      if (this.localFallback) {
        return this.localFallback.getKeys();
      }
      
      throw error;
    }
  }

  async getKeys(): Promise<string[]> {
    return this.keys();
  }

  async size(): Promise<number> {
    try {
      if (!this.isConnected && this.localFallback) {
        return this.localFallback.getSize();
      }

      const pattern = `${this.keyPrefix}*`;
      const keys = await this.redis.keys(pattern);
      return keys.length;
    } catch (error) {
      logger.error('Redis size error:', error);
      
      // Fallback to local storage on error
      if (this.localFallback) {
        return this.localFallback.getSize();
      }
      
      return 0;
    }
  }

  async getSize(): Promise<number> {
    return this.size();
  }

  /**
   * Synchronize a key from local fallback to Redis
   * Used when Redis comes back online
   */
  async syncToRedis(key: string): Promise<void> {
    if (!this.localFallback || !this.isConnected) {
      return;
    }

    try {
      const localEntry = await this.localFallback.get(key);
      if (localEntry) {
        await this.set(key, localEntry);
      }
    } catch (error) {
      logger.error('Redis sync error:', error);
    }
  }

  /**
   * Synchronize all local fallback entries to Redis
   * Used when Redis comes back online after being down
   */
  async syncAllToRedis(): Promise<void> {
    if (!this.localFallback || !this.isConnected) {
      return;
    }

    try {
      const localKeys = await this.localFallback.keys();
      
      for (const key of localKeys) {
        await this.syncToRedis(key);
      }
      
      logger.info(`Synced ${localKeys.length} entries to Redis`);
    } catch (error) {
      logger.error('Redis sync all error:', error);
    }
  }

  /**
   * Get cache statistics including Redis-specific metrics
   */
  async getStats(): Promise<{
    size: number;
    memoryUsage?: number;
    isConnected: boolean;
    localFallbackSize?: number;
  }> {
    const stats: any = {
      size: await this.size(),
      isConnected: this.isConnected,
    };

    if (this.isConnected) {
      try {
        const info = await this.redis.info('memory');
        const memoryMatch = info.match(/used_memory:(\d+)/);
        if (memoryMatch) {
          stats.memoryUsage = parseInt(memoryMatch[1], 10);
        }
      } catch (error) {
        logger.error('Failed to get Redis memory info:', error);
      }
    }

    if (this.localFallback) {
      stats.localFallbackSize = await this.localFallback.getSize();
    }

    return stats;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
}