"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisCache = void 0;
exports.getCache = getCache;
exports.Cacheable = Cacheable;
exports.CacheInvalidate = CacheInvalidate;
const ioredis_1 = __importDefault(require("ioredis"));
const crypto_1 = require("crypto");
const logger_1 = require("../../utils/logger");
class RedisCache {
    constructor(config = {}) {
        this.isConnected = false;
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
        this.config = {
            host: config.host || process.env.REDIS_HOST || 'localhost',
            port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
            password: config.password || process.env.REDIS_PASSWORD || undefined,
            db: config.db || 0,
            ttl: config.ttl || 300, // 5 minutes default
            keyPrefix: config.keyPrefix || 'athena:',
            enableOfflineQueue: config.enableOfflineQueue ?? false,
            maxRetriesPerRequest: config.maxRetriesPerRequest || 3
        };
        this.client = new ioredis_1.default({
            host: this.config.host,
            port: this.config.port,
            password: this.config.password,
            db: this.config.db,
            keyPrefix: this.config.keyPrefix,
            enableOfflineQueue: this.config.enableOfflineQueue,
            maxRetriesPerRequest: this.config.maxRetriesPerRequest,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            }
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.client.on('connect', () => {
            this.isConnected = true;
            logger_1.logger.info('Redis cache connected');
        });
        this.client.on('error', (err) => {
            this.stats.errors++;
            logger_1.logger.error('Redis cache error:', err);
        });
        this.client.on('close', () => {
            this.isConnected = false;
            logger_1.logger.warn('Redis cache connection closed');
        });
    }
    /**
     * Generate cache key from various inputs
     */
    generateKey(...parts) {
        const keyData = parts.map(part => {
            if (typeof part === 'object') {
                return JSON.stringify(part);
            }
            return String(part);
        }).join(':');
        // For long keys, use a hash
        if (keyData.length > 200) {
            return (0, crypto_1.createHash)('sha256').update(keyData).digest('hex');
        }
        return keyData;
    }
    /**
     * Get value from cache
     */
    async get(key) {
        try {
            const cacheKey = Array.isArray(key) ? this.generateKey(...key) : key;
            const value = await this.client.get(cacheKey);
            if (!value) {
                this.stats.misses++;
                return null;
            }
            this.stats.hits++;
            const entry = JSON.parse(value);
            return entry.data;
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache get error:', error);
            return null;
        }
    }
    /**
     * Set value in cache
     */
    async set(key, value, ttl, tags) {
        try {
            const cacheKey = Array.isArray(key) ? this.generateKey(...key) : key;
            const entry = {
                data: value,
                timestamp: Date.now(),
                ttl: ttl || this.config.ttl,
                tags
            };
            const result = await this.client.setex(cacheKey, ttl || this.config.ttl, JSON.stringify(entry));
            // Index tags if provided
            if (tags && tags.length > 0) {
                await this.indexTags(cacheKey, tags);
            }
            this.stats.sets++;
            return result === 'OK';
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache set error:', error);
            return false;
        }
    }
    /**
     * Delete value from cache
     */
    async delete(key) {
        try {
            const cacheKey = Array.isArray(key) ? this.generateKey(...key) : key;
            const result = await this.client.del(cacheKey);
            this.stats.deletes++;
            return result > 0;
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache delete error:', error);
            return false;
        }
    }
    /**
     * Clear all cache entries with a specific pattern
     */
    async clearPattern(pattern) {
        try {
            const keys = await this.client.keys(`${this.config.keyPrefix}${pattern}`);
            if (keys.length === 0)
                return 0;
            // Remove prefix from keys before deleting
            const keysToDelete = keys.map(k => k.replace(this.config.keyPrefix, ''));
            const result = await this.client.del(...keysToDelete);
            this.stats.deletes += result;
            return result;
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache clear pattern error:', error);
            return 0;
        }
    }
    /**
     * Clear cache entries by tag
     */
    async clearByTag(tag) {
        try {
            const members = await this.client.smembers(`tag:${tag}`);
            if (members.length === 0)
                return 0;
            const pipeline = this.client.pipeline();
            members.forEach(key => {
                pipeline.del(key.replace(this.config.keyPrefix, ''));
            });
            pipeline.del(`tag:${tag}`);
            await pipeline.exec();
            this.stats.deletes += members.length;
            return members.length;
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache clear by tag error:', error);
            return 0;
        }
    }
    /**
     * Get or set cache value (memoization helper)
     */
    async getOrSet(key, factory, ttl, tags) {
        // Try to get from cache first
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }
        // Generate value and cache it
        const value = await factory();
        await this.set(key, value, ttl, tags);
        return value;
    }
    /**
     * Batch get multiple keys
     */
    async mget(keys) {
        try {
            const cacheKeys = keys.map(key => Array.isArray(key) ? this.generateKey(...key) : key);
            const values = await this.client.mget(...cacheKeys);
            return values.map((value, index) => {
                if (!value) {
                    this.stats.misses++;
                    return null;
                }
                this.stats.hits++;
                try {
                    const entry = JSON.parse(value);
                    return entry.data;
                }
                catch {
                    return null;
                }
            });
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache mget error:', error);
            return keys.map(() => null);
        }
    }
    /**
     * Check if key exists
     */
    async exists(key) {
        try {
            const cacheKey = Array.isArray(key) ? this.generateKey(...key) : key;
            const result = await this.client.exists(cacheKey);
            return result > 0;
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache exists error:', error);
            return false;
        }
    }
    /**
     * Get remaining TTL for a key
     */
    async ttl(key) {
        try {
            const cacheKey = Array.isArray(key) ? this.generateKey(...key) : key;
            return await this.client.ttl(cacheKey);
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache ttl error:', error);
            return -1;
        }
    }
    /**
     * Extend TTL for a key
     */
    async expire(key, ttl) {
        try {
            const cacheKey = Array.isArray(key) ? this.generateKey(...key) : key;
            const result = await this.client.expire(cacheKey, ttl);
            return result === 1;
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache expire error:', error);
            return false;
        }
    }
    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
            : 0;
        return {
            ...this.stats,
            hitRate: hitRate.toFixed(2) + '%',
            isConnected: this.isConnected
        };
    }
    /**
     * Reset cache statistics
     */
    resetStats() {
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
    }
    /**
     * Clear entire cache (use with caution!)
     */
    async flush() {
        try {
            await this.client.flushdb();
            logger_1.logger.warn('Cache flushed');
        }
        catch (error) {
            this.stats.errors++;
            logger_1.logger.error('Cache flush error:', error);
        }
    }
    /**
     * Close Redis connection
     */
    async close() {
        await this.client.quit();
    }
    /**
     * Index tags for a cache entry
     */
    async indexTags(key, tags) {
        const pipeline = this.client.pipeline();
        tags.forEach(tag => {
            pipeline.sadd(`tag:${tag}`, `${this.config.keyPrefix}${key}`);
            // Set expiry on tag set to match the longest possible TTL
            pipeline.expire(`tag:${tag}`, 86400); // 24 hours
        });
        await pipeline.exec();
    }
}
exports.RedisCache = RedisCache;
// Singleton instance
let cacheInstance = null;
/**
 * Get or create cache instance
 */
function getCache(config) {
    if (!cacheInstance) {
        cacheInstance = new RedisCache(config);
    }
    return cacheInstance;
}
// Export cache decorators
function Cacheable(keyGenerator, ttl, tags) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const cache = getCache();
            // Generate cache key
            const key = keyGenerator
                ? keyGenerator(...args)
                : [target.constructor.name, propertyKey, ...args];
            // Try to get from cache
            const cached = await cache.get(key);
            if (cached !== null) {
                return cached;
            }
            // Execute original method
            const result = await originalMethod.apply(this, args);
            // Cache the result
            await cache.set(key, result, ttl, tags);
            return result;
        };
        return descriptor;
    };
}
function CacheInvalidate(keyGenerator) {
    return function (target, propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            const cache = getCache();
            // Execute original method first
            const result = await originalMethod.apply(this, args);
            // Invalidate cache
            if (keyGenerator) {
                const invalidation = keyGenerator(...args);
                if (typeof invalidation === 'string' || Array.isArray(invalidation)) {
                    await cache.delete(invalidation);
                }
                else {
                    if (invalidation.pattern) {
                        await cache.clearPattern(invalidation.pattern);
                    }
                    if (invalidation.tags) {
                        for (const tag of invalidation.tags) {
                            await cache.clearByTag(tag);
                        }
                    }
                }
            }
            return result;
        };
        return descriptor;
    };
}
