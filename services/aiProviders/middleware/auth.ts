/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { logger } from '../../../utils/logger';
import { getCache } from '../../cache/redis-cache';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    apiKey: string;
    permissions: string[];
    sessionId?: string;
  };
}

interface JWTPayload {
  id: string;
  apiKey: string;
  permissions: string[];
  sessionId: string;
  iat: number;
  exp: number;
}

// Secure API key validation patterns
const VALID_API_KEY_PATTERN = /^[a-zA-Z0-9-_]{32,128}$/;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Predefined API keys for validation (in production, store in database)
const VALID_API_KEYS = new Set([
  process.env.ADMIN_API_KEY,
  process.env.CLIENT_API_KEY,
  process.env.ANALYSIS_API_KEY,
].filter(Boolean));

async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey || !VALID_API_KEY_PATTERN.test(apiKey)) {
    return false;
  }
  
  // Check against predefined keys
  if (VALID_API_KEYS.has(apiKey)) {
    return true;
  }
  
  // Check against cached revoked keys
  const cache = getCache();
  const isRevoked = await cache.get(`revoked:${apiKey}`);
  if (isRevoked) {
    return false;
  }
  
  // In production, validate against database
  // For now, accept keys that match the pattern
  return apiKey.length >= 32;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  const apiKey = req.headers['x-api-key'] as string;
  
  // Try JWT token first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      req.user = {
        id: payload.id,
        apiKey: payload.apiKey,
        permissions: payload.permissions,
        sessionId: payload.sessionId
      };
      return next();
    } catch (error: any) {
      logger.warn('Invalid JWT token', { error: error?.message || 'Unknown error' });
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
  
  validateApiKey(apiKey).then(isValid => {
    if (!isValid) {
      logger.warn('Invalid API key attempt', { 
        apiKey: apiKey.substring(0, 8) + '...', 
        ip: req.ip 
      });
      res.status(403).json({ error: 'Invalid API key' });
      return;
    }
    
    // Generate user info from API key
    req.user = {
      id: 'user-' + apiKey.substring(0, 8),
      apiKey: apiKey,
      permissions: getPermissionsForApiKey(apiKey)
    };
    
    next();
  }).catch(error => {
    logger.error('Authentication error', { error });
    res.status(500).json({ error: 'Authentication service error' });
    return;
  });
}

function getPermissionsForApiKey(apiKey: string): string[] {
  // In production, get permissions from database
  if (apiKey === process.env.ADMIN_API_KEY) {
    return ['analyze', 'workflow', 'admin', 'upload', 'wasm'];
  }
  if (apiKey === process.env.ANALYSIS_API_KEY) {
    return ['analyze', 'upload', 'wasm'];
  }
  return ['analyze', 'workflow'];
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      logger.warn('Permission denied', { 
        user: req.user?.id, 
        permission, 
        userPermissions: req.user?.permissions 
      });
      res.status(403).json({ 
        error: 'Insufficient permissions', 
        required: permission,
        available: req.user?.permissions || [] 
      });
      return;
    }
    next();
  };
}

// Generate JWT token for validated API key
export function generateJWTToken(user: { id: string; apiKey: string; permissions: string[] }): string {
  const sessionId = Math.random().toString(36).substring(2, 15);
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    id: user.id,
    apiKey: user.apiKey,
    permissions: user.permissions,
    sessionId
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
}

// Revoke API key (add to cache)
export async function revokeApiKey(apiKey: string): Promise<void> {
  const cache = getCache();
  await cache.set(`revoked:${apiKey}`, 'true', 86400); // 24 hours
  logger.info('API key revoked', { apiKey: apiKey.substring(0, 8) + '...' });
}

// Optional: Create login endpoint for JWT token generation
export function loginEndpoint(req: AuthenticatedRequest, res: Response): void {
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
export function auditSecurityEvent(event: string, req: Request, details?: any): void {
  logger.warn('Security audit event', {
    event,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    path: req.path,
    method: req.method,
    ...details
  });
}