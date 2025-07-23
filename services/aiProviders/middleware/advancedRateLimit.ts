/**
 * Advanced Rate Limiting with express-rate-limit and Redis
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { getCache } from '../../cache/redis-cache';
import { logger } from '../../../utils/logger';
import { auditSecurityEvent } from './auth';

// Custom store using Redis for distributed rate limiting
class RedisStore {
  private cache = getCache();

  async increment(key: string): Promise<{ count: number; resetTime: Date }> {
    const now = Date.now();
    const window = 60000; // 1 minute window
    const resetTime = new Date(now + window);
    
    try {
      // Get current count
      const current = await this.cache.get(key);
      const count = current ? parseInt(current) + 1 : 1;
      
      // Set with expiration
      await this.cache.set(key, count.toString(), Math.ceil(window / 1000));
      
      return { count, resetTime };
    } catch (error) {
      logger.error('Redis rate limit error', { error, key });
      // Fallback to allowing request if Redis fails
      return { count: 1, resetTime };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      const current = await this.cache.get(key);
      if (current) {
        const count = Math.max(0, parseInt(current) - 1);
        if (count === 0) {
          await this.cache.delete(key);
        } else {
          await this.cache.set(key, count.toString(), 60); // 1 minute TTL
        }
      }
    } catch (error) {
      logger.error('Redis rate limit decrement error', { error, key });
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await this.cache.delete(key);
    } catch (error) {
      logger.error('Redis rate limit reset error', { error, key });
    }
  }
}

// Key generator that considers API key or IP
function generateKey(req: Request): string {
  const apiKey = req.headers['x-api-key'] as string;
  const authHeader = req.headers['authorization'];
  
  if (apiKey) {
    return `rate_limit:api:${apiKey}`;
  }
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Extract user ID from JWT if possible (simplified)
    const token = authHeader.replace('Bearer ', '');
    return `rate_limit:jwt:${token.substring(0, 16)}`; // Use part of token as key
  }
  
  return `rate_limit:ip:${req.ip}`;
}

// Handler for rate limit exceeded
function onLimitReached(req: Request, res: Response) {
  const key = generateKey(req);
  
  logger.warn('Rate limit exceeded', {
    key: key.substring(0, 32) + '...',
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent')
  });
  
  auditSecurityEvent('RATE_LIMIT_EXCEEDED', req, {
    endpoint: req.path,
    method: req.method
  });
}

// Skip rate limiting for certain conditions
function skipRateLimit(req: Request): boolean {
  // Skip for health checks
  if (req.path === '/api/v1/health' || req.path === '/metrics') {
    return true;
  }
  
  // Skip for trusted internal services (based on API key)
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey === process.env.ADMIN_API_KEY) {
    return true;
  }
  
  return false;
}

// Rate limit configurations for different endpoint types
export const rateLimitConfigs = {
  // Strict limits for authentication endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
      error: 'Too many authentication attempts',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipRateLimit,
    handler: onLimitReached,
    // Custom store would go here in production
    // store: new RedisStore()
  }),

  // Standard limits for analysis endpoints
  analysis: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: {
      error: 'Analysis rate limit exceeded',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipRateLimit,
    handler: onLimitReached
  }),

  // Relaxed limits for file uploads (they take longer)
  upload: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute
    message: {
      error: 'Upload rate limit exceeded',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipRateLimit,
    handler: onLimitReached
  }),

  // Very strict limits for WASM direct access
  wasm: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: {
      error: 'WASM analysis rate limit exceeded',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipRateLimit,
    handler: onLimitReached
  }),

  // General API rate limit
  general: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: {
      error: 'General rate limit exceeded',
      retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipRateLimit,
    handler: onLimitReached
  }),

  // Burst protection for rapid requests
  burst: rateLimit({
    windowMs: 1000, // 1 second
    max: 5, // 5 requests per second
    message: {
      error: 'Request burst limit exceeded',
      retryAfter: '1 second'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: skipRateLimit,
    handler: onLimitReached
  })
};

// IP-based blocking for suspicious behavior
class IPBlocker {
  private blockedIPs = new Set<string>();
  private suspiciousActivity = new Map<string, number>();
  
  isBlocked(ip: string): boolean {
    return this.blockedIPs.has(ip);
  }
  
  addSuspiciousActivity(ip: string): void {
    const current = this.suspiciousActivity.get(ip) || 0;
    const newCount = current + 1;
    this.suspiciousActivity.set(ip, newCount);
    
    // Block IP after 10 suspicious activities
    if (newCount >= 10) {
      this.blockIP(ip, 'Excessive suspicious activity');
    }
  }
  
  blockIP(ip: string | undefined, reason: string): void {
    if (!ip) return;
    
    this.blockedIPs.add(ip);
    logger.warn('IP blocked', { ip, reason });
    
    // Auto-unblock after 1 hour
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      this.suspiciousActivity.delete(ip);
      logger.info('IP unblocked', { ip });
    }, 60 * 60 * 1000);
  }
  
  middleware = (req: Request, res: Response, next: Function): void => {
    if (this.isBlocked(req.ip || '')) {
      auditSecurityEvent('BLOCKED_IP_ACCESS', req);
      res.status(403).json({
        error: 'IP address blocked due to suspicious activity',
        contact: 'security@athena.ai'
      });
      return;
    }
    next();
  };
}

export const ipBlocker = new IPBlocker();

// Export a convenience function to create custom rate limiters
export function createCustomRateLimit(options: {
  windowMs: number;
  max: number;
  message?: string;
  skipPaths?: string[];
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: (req) => {
      if (skipRateLimit(req)) return true;
      return options.skipPaths?.includes(req.path) || false;
    },
    handler: onLimitReached
  });
}