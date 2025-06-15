"use strict";
/**
 * Rate Limiter for AI Provider APIs
 * Implements token bucket algorithm with sliding window
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.RateLimiter = void 0;
class RateLimiter {
    constructor(config) {
        const burstMultiplier = config.burstMultiplier || 1.5;
        this.requestBucket = new TokenBucket({
            capacity: Math.floor(config.requestsPerMinute * burstMultiplier),
            refillRate: config.requestsPerMinute / 60, // per second
            initialTokens: config.requestsPerMinute
        });
        this.tokenBucket = new TokenBucket({
            capacity: Math.floor(config.tokensPerMinute * burstMultiplier),
            refillRate: config.tokensPerMinute / 60,
            initialTokens: config.tokensPerMinute
        });
    }
    async checkLimit() {
        if (!this.requestBucket.tryConsume(1)) {
            const waitTime = this.requestBucket.getWaitTime(1);
            throw new RateLimitError(`Rate limit exceeded. Retry after ${waitTime}ms`, waitTime);
        }
    }
    async checkTokenLimit(tokens) {
        if (!this.tokenBucket.tryConsume(tokens)) {
            const waitTime = this.tokenBucket.getWaitTime(tokens);
            throw new RateLimitError(`Token limit exceeded. Retry after ${waitTime}ms`, waitTime);
        }
    }
    recordUsage(usage) {
        // Already consumed in checkLimit, but track for metrics
        this.requestBucket.consume(usage.requests);
        this.tokenBucket.consume(usage.tokens);
    }
    getRemaining() {
        return Math.floor(this.requestBucket.getAvailable());
    }
    getResetTime() {
        const resetMs = this.requestBucket.getResetTime();
        return new Date(Date.now() + resetMs);
    }
}
exports.RateLimiter = RateLimiter;
/**
 * Token Bucket implementation
 */
class TokenBucket {
    constructor(config) {
        this.config = config;
        this.tokens = config.initialTokens;
        this.lastRefill = Date.now();
    }
    tryConsume(amount) {
        this.refill();
        if (this.tokens >= amount) {
            this.tokens -= amount;
            return true;
        }
        return false;
    }
    consume(amount) {
        this.tokens = Math.max(0, this.tokens - amount);
    }
    getAvailable() {
        this.refill();
        return this.tokens;
    }
    getWaitTime(amount) {
        this.refill();
        if (this.tokens >= amount) {
            return 0;
        }
        const needed = amount - this.tokens;
        return Math.ceil(needed / this.config.refillRate * 1000);
    }
    getResetTime() {
        const tokensNeeded = this.config.capacity - this.tokens;
        return Math.ceil(tokensNeeded / this.config.refillRate * 1000);
    }
    refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // seconds
        const refillAmount = elapsed * this.config.refillRate;
        this.tokens = Math.min(this.config.capacity, this.tokens + refillAmount);
        this.lastRefill = now;
    }
}
class RateLimitError extends Error {
    constructor(message, retryAfter) {
        super(message);
        this.retryAfter = retryAfter;
        this.name = 'RateLimitError';
    }
}
exports.RateLimitError = RateLimitError;
