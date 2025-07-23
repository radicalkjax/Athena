/**
 * Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const { logger } = require('../../../utils/logger');
const { getCache } = require('../../cache/redis-cache');
const apiKeyRepository = require('../../database/apiKeyRepository');
const { testConnection } = require('../../database/connection');

// Secure API key validation patterns
const VALID_API_KEY_PATTERN = /^[a-zA-Z0-9-_]{32,128}$/;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Check if database is available
let dbAvailable = false;
testConnection().then(available => {
  dbAvailable = available;
  if (available) {
    logger.info('Database authentication enabled');
  } else {
    logger.warn('Database unavailable, falling back to environment variables');
  }
}).catch(err => {
  logger.error('Database connection check failed', { error: err.message });
});

// Legacy API keys from environment (fallback)
const LEGACY_API_KEYS = new Set([
  process.env.ADMIN_API_KEY,
  process.env.CLIENT_API_KEY,
  process.env.ANALYSIS_API_KEY,
].filter(Boolean));

async function validateApiKey(apiKey) {
  if (!apiKey || !VALID_API_KEY_PATTERN.test(apiKey)) {
    return { valid: false, user: null };
  }
  
  // Check against cached revoked keys first
  try {
    const cache = getCache();
    const isRevoked = await cache.get(`revoked:${apiKey}`);
    if (isRevoked) {
      return { valid: false, user: null };
    }
  } catch (error) {
    logger.error('Cache check error during API key validation', { error });
  }
  
  // Try database validation if available
  if (dbAvailable) {
    try {
      const user = await apiKeyRepository.validateApiKey(apiKey);
      if (user) {
        // Cache the validation result for performance
        try {
          const cache = getCache();
          await cache.set(`apikey:${apiKey}`, JSON.stringify(user), 300); // 5 min cache
        } catch (cacheError) {
          logger.warn('Failed to cache API key validation', { error: cacheError.message });
        }
        return { valid: true, user };
      }
    } catch (error) {
      logger.error('Database API key validation failed', { error: error.message });
      // Fall through to legacy validation
    }
  }
  
  // Fallback to legacy environment variable validation
  if (LEGACY_API_KEYS.has(apiKey)) {
    // Generate legacy user object
    const legacyUser = {
      id: `user-${apiKey.substring(0, 8)}`,
      apiKey: apiKey,
      role: getLegacyRole(apiKey),
      permissions: getLegacyPermissions(apiKey)
    };
    return { valid: true, user: legacyUser };
  }
  
  return { valid: false, user: null };
}

// Helper functions for legacy API key handling
function getLegacyRole(apiKey) {
  if (apiKey === process.env.ADMIN_API_KEY) return 'admin';
  if (apiKey === process.env.ANALYSIS_API_KEY) return 'analysis';
  return 'client';
}

function getLegacyPermissions(apiKey) {
  const role = getLegacyRole(apiKey);
  switch (role) {
    case 'admin':
      return ['analyze', 'workflow', 'admin', 'upload', 'wasm'];
    case 'analysis':
      return ['analyze', 'upload', 'wasm', 'workflow'];
    default:
      return ['analyze', 'workflow'];
  }
}

function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'];
  
  // Try JWT token first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = {
        id: payload.id,
        apiKey: payload.apiKey,
        permissions: payload.permissions,
        sessionId: payload.sessionId
      };
      return next();
    } catch (error) {
      logger.warn('Invalid JWT token', { error: error.message || 'Unknown error' });
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }
  }
  
  // Fall back to API key validation
  if (!apiKey) {
    res.status(401).json({ 
      error: 'Authentication required', 
      message: 'Provide API key via X-API-Key header or JWT token via Authorization header' 
    });
    return;
  }
  
  validateApiKey(apiKey).then(result => {
    if (!result.valid) {
      logger.warn('Invalid API key attempt', { 
        apiKey: apiKey.substring(0, 8) + '...', 
        ip: req.ip 
      });
      res.status(403).json({ error: 'Invalid API key' });
      return;
    }
    
    // Use user object from database or legacy validation
    req.user = result.user;
    
    // Log successful authentication
    logger.info('API key authenticated', {
      userId: req.user.id,
      role: req.user.role,
      method: 'api_key'
    });
    
    next();
  }).catch(error => {
    logger.error('Authentication error', { error });
    res.status(500).json({ error: 'Authentication service error' });
    return;
  });
}

// Deprecated: Permission handling now in validateApiKey function

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      logger.warn('Permission denied', { 
        user: req.user && req.user.id, 
        permission, 
        userPermissions: req.user && req.user.permissions 
      });
      res.status(403).json({ 
        error: 'Insufficient permissions', 
        required: permission,
        available: req.user && req.user.permissions || [] 
      });
      return;
    }
    next();
  };
}

// Generate JWT token for validated API key
function generateJWTToken(user) {
  const sessionId = Math.random().toString(36).substring(2, 15);
  const payload = {
    id: user.id,
    apiKey: user.apiKey,
    permissions: user.permissions,
    sessionId
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// Revoke API key (add to cache)
async function revokeApiKey(apiKey) {
  try {
    const cache = getCache();
    await cache.set(`revoked:${apiKey}`, 'true', 86400); // 24 hours
    logger.info('API key revoked', { apiKey: apiKey.substring(0, 8) + '...' });
  } catch (error) {
    logger.error('Error revoking API key', { error });
  }
}

// Optional: Create login endpoint for JWT token generation
function loginEndpoint(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  const token = generateJWTToken(req.user);
  
  res.json({
    token,
    user: {
      id: req.user.id,
      permissions: req.user.permissions
    },
    expiresIn: JWT_EXPIRY
  });
}

// Security audit logging
function auditSecurityEvent(event, req, details) {
  logger.warn('Security audit event', {
    event,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    path: req.path,
    method: req.method,
    ...(details || {})
  });
}

module.exports = {
  authenticate,
  requirePermission,
  generateJWTToken,
  revokeApiKey,
  loginEndpoint,
  auditSecurityEvent
};