"use strict";
/**
 * Response Cache for AI Provider Results
 * Implements LRU cache with TTL support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TieredCache = exports.ResponseCache = void 0;
class ResponseCache {
    constructor(config) {
        this.config = config;
        this.cache = new Map();
        this.accessOrder = [];
    }
    async get(key) {
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
    async set(key, value) {
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
    delete(key) {
        const entry = this.cache.get(key);
        if (entry && this.config.onEvict) {
            this.config.onEvict(key, entry.value);
        }
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        return this.cache.delete(key);
    }
    clear() {
        if (this.config.onEvict) {
            for (const [key, entry] of this.cache.entries()) {
                this.config.onEvict(key, entry.value);
            }
        }
        this.cache.clear();
        this.accessOrder = [];
    }
    getStats() {
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
    updateAccessOrder(key) {
        // Remove from current position
        this.accessOrder = this.accessOrder.filter(k => k !== key);
        // Add to end (most recently used)
        this.accessOrder.push(key);
    }
    evictLRU() {
        // Remove least recently used
        const lruKey = this.accessOrder.shift();
        if (lruKey) {
            this.delete(lruKey);
        }
    }
    calculateHitRate() {
        let hits = 0;
        let total = 0;
        for (const entry of this.cache.values()) {
            hits += entry.hits;
            total += entry.hits + 1; // +1 for initial set
        }
        return total > 0 ? hits / total : 0;
    }
}
exports.ResponseCache = ResponseCache;
/**
 * Multi-tier cache with memory and optional Redis backend
 */
class TieredCache {
    constructor(config, redisClient) {
        this.memoryCache = new ResponseCache(config);
        this.redisClient = redisClient;
    }
    async get(key) {
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
    async set(key, value) {
        // Set in both tiers
        await this.memoryCache.set(key, value);
        if (this.redisClient) {
            await this.setInRedis(key, value);
        }
    }
    async getFromRedis(key) {
        try {
            const data = await this.redisClient.get(key);
            return data ? JSON.parse(data) : null;
        }
        catch (error) {
            console.error('Redis get error:', error);
            return null;
        }
    }
    async setInRedis(key, value) {
        try {
            await this.redisClient.setex(key, Math.floor(this.memoryCache['config'].ttl / 1000), // TTL in seconds
            JSON.stringify(value));
        }
        catch (error) {
            console.error('Redis set error:', error);
        }
    }
}
exports.TieredCache = TieredCache;
