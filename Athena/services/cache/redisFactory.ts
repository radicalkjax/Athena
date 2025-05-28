import IORedis from 'ioredis';
import { AnalysisCacheManager } from './manager';
import { RedisCacheStorage } from './redisStorage';
import { env } from '@/shared/config/environment';
import { logger } from '@/shared/logging/logger';
import { featureFlags } from '../config/featureFlags';

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  maxRetriesPerRequest?: number;
  enableOfflineQueue?: boolean;
  fallbackToMemory?: boolean;
}

let redisClient: IORedis | null = null;
let redisCacheManager: AnalysisCacheManager | null = null;

/**
 * Create a Redis client with the given configuration
 */
export function createRedisClient(config?: RedisConfig): IORedis {
  const redisConfig = {
    host: config?.host || env.REDIS_HOST || 'localhost',
    port: config?.port || parseInt(env.REDIS_PORT || '6379', 10),
    password: config?.password || env.REDIS_PASSWORD,
    db: config?.db || parseInt(env.REDIS_DB || '0', 10),
    maxRetriesPerRequest: config?.maxRetriesPerRequest ?? 3,
    enableOfflineQueue: config?.enableOfflineQueue ?? true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      return Math.min(times * 200, 2000); // Exponential backoff
    },
  };

  return new IORedis(redisConfig);
}

/**
 * Get or create a Redis-backed cache manager
 */
export function getRedisCacheManager(config?: RedisConfig): AnalysisCacheManager {
  if (!redisCacheManager) {
    // Create Redis client if not exists
    if (!redisClient) {
      redisClient = createRedisClient(config);
    }

    // Create Redis storage
    const redisStorage = new RedisCacheStorage({
      redis: redisClient,
      keyPrefix: config?.keyPrefix || 'athena:analysis:',
      fallbackToMemory: config?.fallbackToMemory ?? true,
    });

    // Create cache manager with Redis storage
    redisCacheManager = new AnalysisCacheManager({
      storage: redisStorage,
      maxSize: 1000, // Higher limit since Redis has more capacity
      defaultTTL: 3600000, // 1 hour default TTL
    });

    // Set up Redis reconnection handler to sync data
    redisClient.on('connect', async () => {
      logger.info('Redis connected, syncing local cache...');
      await redisStorage.syncAllToRedis();
    });
  }

  return redisCacheManager;
}

/**
 * Close Redis connections and cleanup
 */
export async function closeRedisCache(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
  redisCacheManager = null;
}

/**
 * Check if Redis is available and should be used
 */
export function isRedisEnabled(): boolean {
  return featureFlags.isEnabled('enableRedisCache');
}

/**
 * Get the appropriate cache manager based on environment
 */
export function getCacheManager(): AnalysisCacheManager {
  if (isRedisEnabled()) {
    return getRedisCacheManager();
  }
  
  // Fall back to default in-memory/IndexedDB cache
  return AnalysisCacheManager.getInstance();
}