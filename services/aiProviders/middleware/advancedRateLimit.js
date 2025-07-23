/**
 * Advanced Rate Limiting with express-rate-limit and Redis
 */

const rateLimit = require('express-rate-limit');
const { getCache } = require('../../cache/redis-cache');
const { logger } = require('../../../utils/logger');

// Handler for rate limit exceeded
function onLimitReached(req, res) {
  const key = generateKey(req);
  
  logger.warn('Rate limit exceeded', {
    key: key.substring(0, 32) + '...',
    ip: req.ip,
    path: req.path,
    method: req.method,
    userAgent: req.get('user-agent')
  });
  
  // Security audit logging
  logger.warn('Security audit event', {
    event: 'RATE_LIMIT_EXCEEDED',
    ip: req.ip,
    userAgent: req.get('user-agent'),
    path: req.path,
    method: req.method,
    endpoint: req.path
  });
}

// Key generator that considers API key or IP
function generateKey(req) {
  const apiKey = req.headers['x-api-key'];
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

// Skip rate limiting for certain conditions
function skipRateLimit(req) {
  // Skip for health checks
  if (req.path === '/api/v1/health' || req.path === '/metrics') {
    return true;
  }
  
  // Skip for trusted internal services (based on API key)
  const apiKey = req.headers['x-api-key'];
  if (apiKey === process.env.ADMIN_API_KEY) {
    return true;
  }
  
  return false;
}

// Rate limit configurations for different endpoint types
const rateLimitConfigs = {
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
    handler: onLimitReached
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
  constructor() {
    this.blockedIPs = new Set();
    this.suspiciousActivity = new Map();
  }
  
  isBlocked(ip) {
    return this.blockedIPs.has(ip);
  }
  
  addSuspiciousActivity(ip) {
    const current = this.suspiciousActivity.get(ip) || 0;
    const newCount = current + 1;
    this.suspiciousActivity.set(ip, newCount);
    
    // Block IP after 10 suspicious activities
    if (newCount >= 10) {
      this.blockIP(ip, 'Excessive suspicious activity');
    }
  }
  
  blockIP(ip, reason) {
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
  
  middleware = (req, res, next) => {
    if (this.isBlocked(req.ip || '')) {
      logger.warn('Security audit event', {
        event: 'BLOCKED_IP_ACCESS',
        ip: req.ip,
        userAgent: req.get('user-agent'),
        path: req.path,
        method: req.method
      });
      
      res.status(403).json({
        error: 'IP address blocked due to suspicious activity',
        contact: 'security@athena.ai'
      });
      return;
    }
    next();
  };
}

const ipBlocker = new IPBlocker();

// Export a convenience function to create custom rate limiters
function createCustomRateLimit(options) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    skip: (req) => {
      if (skipRateLimit(req)) return true;
      return options.skipPaths && options.skipPaths.includes(req.path) || false;
    },
    handler: onLimitReached
  });
}

module.exports = {
  rateLimitConfigs,
  ipBlocker,
  createCustomRateLimit
};