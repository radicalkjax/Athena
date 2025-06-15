/**
 * Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    apiKey: string;
    permissions: string[];
  };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }
  
  // In production, validate against stored API keys
  // For now, just check if it exists
  if (!apiKey || apiKey.length < 10) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }
  
  // Attach user info to request
  req.user = {
    id: 'user-' + (typeof apiKey === 'string' ? apiKey.substring(0, 8) : 'unknown'),
    apiKey: apiKey as string,
    permissions: ['analyze', 'workflow']
  };
  
  next();
}

export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}