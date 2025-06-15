/**
 * Circuit Breaker implementation for AI providers
 */

import { logger } from '@/shared/logging/logger';
import { apmManager } from '../apm/manager';

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenRequests: number;
}

export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private readonly config: CircuitBreakerConfig;
  
  constructor(
    private name: string,
    config: Partial<CircuitBreakerConfig> = {}
  ) {
    this.config = {
      failureThreshold: config.failureThreshold || 3,
      resetTimeout: config.resetTimeout || 60000, // 1 minute
      monitoringPeriod: config.monitoringPeriod || 300000, // 5 minutes
      halfOpenRequests: config.halfOpenRequests || 1,
    };
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        logger.info(`Circuit breaker ${this.name} transitioning to half-open`);
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        apmManager.recordCircuitBreakerEvent(this.name, 'half_open');
      } else {
        throw new Error(`Circuit breaker is open for ${this.name}`);
      }
    }
    
    if (this.state === 'half-open' && this.halfOpenAttempts >= this.config.halfOpenRequests) {
      throw new Error(`Circuit breaker is half-open and max attempts reached for ${this.name}`);
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.config.halfOpenRequests) {
        logger.info(`Circuit breaker ${this.name} closing after successful half-open test`);
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        apmManager.recordCircuitBreakerEvent(this.name, 'close');
      }
    } else {
      this.successCount++;
      // Reset failure count on success in closed state
      if (this.failureCount > 0) {
        this.failureCount = Math.max(0, this.failureCount - 1);
      }
    }
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'half-open') {
      logger.warn(`Circuit breaker ${this.name} reopening after half-open failure`);
      this.state = 'open';
      apmManager.recordCircuitBreakerEvent(this.name, 'open');
    } else if (this.failureCount >= this.config.failureThreshold) {
      logger.warn(`Circuit breaker ${this.name} opening after ${this.failureCount} failures`);
      this.state = 'open';
      apmManager.recordCircuitBreakerEvent(this.name, 'open');
    }
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
  
  reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
  }
}