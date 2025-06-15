/**
 * Rate Limiter for AI Provider APIs
 * Implements token bucket algorithm with sliding window
 */

export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  burstMultiplier?: number;
}

export class RateLimiter {
  private requestBucket: TokenBucket;
  private tokenBucket: TokenBucket;
  
  constructor(config: RateLimitConfig) {
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
  
  async checkLimit(): Promise<void> {
    if (!this.requestBucket.tryConsume(1)) {
      const waitTime = this.requestBucket.getWaitTime(1);
      throw new RateLimitError(`Rate limit exceeded. Retry after ${waitTime}ms`, waitTime);
    }
  }
  
  async checkTokenLimit(tokens: number): Promise<void> {
    if (!this.tokenBucket.tryConsume(tokens)) {
      const waitTime = this.tokenBucket.getWaitTime(tokens);
      throw new RateLimitError(`Token limit exceeded. Retry after ${waitTime}ms`, waitTime);
    }
  }
  
  recordUsage(usage: { requests: number; tokens: number }) {
    // Already consumed in checkLimit, but track for metrics
    this.requestBucket.consume(usage.requests);
    this.tokenBucket.consume(usage.tokens);
  }
  
  getRemaining(): number {
    return Math.floor(this.requestBucket.getAvailable());
  }
  
  getResetTime(): Date {
    const resetMs = this.requestBucket.getResetTime();
    return new Date(Date.now() + resetMs);
  }
}

/**
 * Token Bucket implementation
 */
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  
  constructor(
    private config: {
      capacity: number;
      refillRate: number; // tokens per second
      initialTokens: number;
    }
  ) {
    this.tokens = config.initialTokens;
    this.lastRefill = Date.now();
  }
  
  tryConsume(amount: number): boolean {
    this.refill();
    
    if (this.tokens >= amount) {
      this.tokens -= amount;
      return true;
    }
    
    return false;
  }
  
  consume(amount: number) {
    this.tokens = Math.max(0, this.tokens - amount);
  }
  
  getAvailable(): number {
    this.refill();
    return this.tokens;
  }
  
  getWaitTime(amount: number): number {
    this.refill();
    
    if (this.tokens >= amount) {
      return 0;
    }
    
    const needed = amount - this.tokens;
    return Math.ceil(needed / this.config.refillRate * 1000);
  }
  
  getResetTime(): number {
    const tokensNeeded = this.config.capacity - this.tokens;
    return Math.ceil(tokensNeeded / this.config.refillRate * 1000);
  }
  
  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const refillAmount = elapsed * this.config.refillRate;
    
    this.tokens = Math.min(
      this.config.capacity,
      this.tokens + refillAmount
    );
    
    this.lastRefill = now;
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}