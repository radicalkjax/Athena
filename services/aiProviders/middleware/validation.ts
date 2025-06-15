/**
 * Request Validation Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../../utils/logger';

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean | string;
}

export function validateRequest(rules: ValidationRule[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];
    
    for (const rule of rules) {
      const value = getNestedValue(req.body, rule.field);
      
      // Check required
      if (rule.required && value === undefined) {
        errors.push(`${rule.field} is required`);
        continue;
      }
      
      // Skip further checks if not required and not present
      if (!rule.required && value === undefined) {
        continue;
      }
      
      // Check type
      if (rule.type && typeof value !== rule.type) {
        errors.push(`${rule.field} must be of type ${rule.type}`);
      }
      
      // Check string/array length or number range
      if (rule.min !== undefined) {
        if (typeof value === 'string' || Array.isArray(value)) {
          if (value.length < rule.min) {
            errors.push(`${rule.field} must have at least ${rule.min} characters/elements`);
          }
        } else if (typeof value === 'number' && value < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min}`);
        }
      }
      
      if (rule.max !== undefined) {
        if (typeof value === 'string' || Array.isArray(value)) {
          if (value.length > rule.max) {
            errors.push(`${rule.field} must have at most ${rule.max} characters/elements`);
          }
        } else if (typeof value === 'number' && value > rule.max) {
          errors.push(`${rule.field} must be at most ${rule.max}`);
        }
      }
      
      // Check pattern
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        errors.push(`${rule.field} does not match required pattern`);
      }
      
      // Custom validation
      if (rule.custom) {
        const result = rule.custom(value);
        if (result !== true) {
          errors.push(typeof result === 'string' ? result : `${rule.field} is invalid`);
        }
      }
    }
    
    if (errors.length > 0) {
      res.status(400).json({ 
        error: 'Validation failed', 
        details: errors 
      });
      return;
    }
    
    next();
  };
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Common validation rules
export const commonValidations = {
  analysisRequest: [
    { field: 'content', required: true },
    { field: 'analysisType', type: 'string' as const },
    { field: 'priority', type: 'string' as const, pattern: /^(low|normal|high|critical)$/ }
  ],
  
  workflowRequest: [
    { field: 'agent', required: true, type: 'string' as const },
    { field: 'workflow', required: true, type: 'string' as const },
    { field: 'input', required: true, type: 'object' as const }
  ]
};