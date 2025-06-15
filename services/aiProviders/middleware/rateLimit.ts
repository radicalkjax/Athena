/**
 * Rate Limiting Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  
  constructor(
    private windowMs: number = 60000, // 1 minute default
    private maxRequests: number = 60
  ) {}
  
  middleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = this.getKey(req);
    const now = Date.now();
    
    // Clean up old entries
    this.cleanup(now);
    
    const entry = this.limits.get(key);
    
    if (!entry || entry.resetTime < now) {
      // New window
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
      return next();
    }
    
    if (entry.count >= this.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter,
        limit: this.maxRequests,
        windowMs: this.windowMs
      });
      
      logger.warn('Rate limit exceeded', { key, count: entry.count });
      return;
    }
    
    entry.count++;
    next();
  };
  
  private getKey(req: Request): string {
    // Try to get API key first, fallback to IP
    const apiKeyHeader = req.headers['x-api-key'];
    const authHeader = req.headers['authorization'];
    
    let apiKey: string | undefined;
    if (apiKeyHeader) {
      apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    } else if (authHeader) {
      const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      apiKey = auth.replace('Bearer ', '');
    }
    
    return apiKey || req.ip || 'unknown';
  }
  
  private cleanup(now: number): void {
    // Remove expired entries
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetTime < now) {
        this.limits.delete(key);
      }
    }
  }
}

// Pre-configured rate limiters for different endpoints
export const rateLimiters = {
  strict: new RateLimiter(60000, 10),     // 10 req/min
  standard: new RateLimiter(60000, 60),   // 60 req/min
  relaxed: new RateLimiter(60000, 120),   // 120 req/min
  burst: new RateLimiter(10000, 20)       // 20 req/10sec
};

// Convenience function for standard rate limiting
export function rateLimit(requestsPerMinute: number = 60) {
  const limiter = new RateLimiter(60000, requestsPerMinute);
  return limiter.middleware;
}