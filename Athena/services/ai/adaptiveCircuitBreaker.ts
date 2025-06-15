/**
 * Enhanced Circuit Breaker with adaptive thresholds and advanced backoff strategies
 */

import { logger } from '@/shared/logging/logger';
import { apmManager } from '../apm/manager';

export interface AdaptiveCircuitBreakerConfig {
  // Basic thresholds
  failureThreshold: number;
  successThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenRequests: number;
  
  // Adaptive thresholds
  enableAdaptive: boolean;
  targetResponseTime: number; // ms
  responseTimeThreshold: number; // Factor above target (e.g., 2.0 = 2x target)
  adaptiveWindow: number; // Time window for response time calculation
  
  // Backoff strategies
  backoffStrategy: 'exponential' | 'linear' | 'fibonacci';
  initialBackoff: number;
  maxBackoff: number;
  backoffJitter: boolean;
  
  // Volume thresholds
  minRequestVolume: number; // Minimum requests before opening circuit
  volumeWindow: number; // Time window for volume calculation
}

interface RequestMetrics {
  timestamp: number;
  duration: number;
  success: boolean;
}

export class AdaptiveCircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private halfOpenAttempts = 0;
  private backoffMultiplier = 1;
  private requestHistory: RequestMetrics[] = [];
  private readonly config: AdaptiveCircuitBreakerConfig;
  
  constructor(
    private name: string,
    config: Partial<AdaptiveCircuitBreakerConfig> = {}
  ) {
    this.config = {
      // Basic defaults
      failureThreshold: config.failureThreshold || 3,
      successThreshold: config.successThreshold || 2,
      resetTimeout: config.resetTimeout || 60000,
      monitoringPeriod: config.monitoringPeriod || 300000,
      halfOpenRequests: config.halfOpenRequests || 3,
      
      // Adaptive defaults
      enableAdaptive: config.enableAdaptive !== false,
      targetResponseTime: config.targetResponseTime || 1000,
      responseTimeThreshold: config.responseTimeThreshold || 2.0,
      adaptiveWindow: config.adaptiveWindow || 60000,
      
      // Backoff defaults
      backoffStrategy: config.backoffStrategy || 'exponential',
      initialBackoff: config.initialBackoff || 1000,
      maxBackoff: config.maxBackoff || 300000,
      backoffJitter: config.backoffJitter !== false,
      
      // Volume defaults
      minRequestVolume: config.minRequestVolume || 10,
      volumeWindow: config.volumeWindow || 60000,
    };
  }
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    
    // Clean old metrics
    this.cleanOldMetrics();
    
    if (this.state === 'open') {
      const backoffTime = this.calculateBackoff();
      
      if (Date.now() - this.lastFailureTime > backoffTime) {
        logger.info(`Circuit breaker ${this.name} transitioning to half-open after ${backoffTime}ms backoff`);
        this.state = 'half-open';
        this.halfOpenAttempts = 0;
        apmManager.recordCircuitBreakerEvent(this.name, 'half_open');
      } else {
        const error = new Error(`Circuit breaker is open for ${this.name}. Retry in ${backoffTime - (Date.now() - this.lastFailureTime)}ms`);
        apmManager.counter('circuit_breaker.rejected', 1, { circuit: this.name });
        throw error;
      }
    }
    
    if (this.state === 'half-open' && this.halfOpenAttempts >= this.config.halfOpenRequests) {
      throw new Error(`Circuit breaker is half-open and max attempts reached for ${this.name}`);
    }
    
    try {
      const result = await operation();
      const duration = Date.now() - startTime;
      
      this.recordRequest({ timestamp: startTime, duration, success: true });
      this.onSuccess();
      
      // Record response time metric
      apmManager.histogram('circuit_breaker.response_time', duration, {
        circuit: this.name,
        state: this.state,
      });
      
      // Check if circuit should open based on adaptive thresholds after recording metrics
      if (this.config.enableAdaptive && this.state === 'closed' && this.shouldOpenBasedOnMetrics()) {
        this.transitionToOpen('adaptive_threshold');
      }
      
      return result;
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      
      this.recordRequest({ timestamp: startTime, duration, success: false });
      this.onFailure();
      
      throw error;
    }
  }
  
  private onSuccess() {
    if (this.state === 'half-open') {
      this.halfOpenAttempts++;
      this.successCount++;
      
      if (this.successCount >= this.config.successThreshold) {
        logger.info(`Circuit breaker ${this.name} closing after ${this.successCount} successful half-open tests`);
        this.transitionToClosed();
      }
    } else if (this.state === 'closed') {
      this.successCount++;
      
      // Decay failure count on success
      if (this.failureCount > 0) {
        this.failureCount = Math.max(0, this.failureCount - 0.5);
      }
      
      // Reset backoff multiplier on sustained success
      if (this.successCount > this.config.successThreshold * 2) {
        this.backoffMultiplier = 1;
      }
    }
  }
  
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'half-open') {
      logger.warn(`Circuit breaker ${this.name} reopening after half-open failure`);
      this.transitionToOpen('half_open_failure');
      
      // Increase backoff on repeated failures
      this.backoffMultiplier = Math.min(this.backoffMultiplier * 1.5, 10);
    } else if (this.shouldOpenBasedOnFailures()) {
      logger.warn(`Circuit breaker ${this.name} opening after ${this.failureCount} failures`);
      this.transitionToOpen('failure_threshold');
    }
  }
  
  private shouldOpenBasedOnFailures(): boolean {
    return this.failureCount >= this.config.failureThreshold;
  }
  
  private shouldOpenBasedOnMetrics(): boolean {
    if (this.state !== 'closed') {
      return false;
    }
    
    const recentRequests = this.getRecentRequests(this.config.adaptiveWindow);
    if (recentRequests.length < this.config.minRequestVolume) {
      return false;
    }
    
    // Calculate average response time
    const avgResponseTime = recentRequests.reduce((sum, req) => sum + req.duration, 0) / recentRequests.length;
    
    // Calculate error rate
    const errorRate = recentRequests.filter(req => !req.success).length / recentRequests.length;
    
    // Open if response time exceeds threshold OR error rate is high
    const responseTimeExceeded = avgResponseTime > this.config.targetResponseTime * this.config.responseTimeThreshold;
    const highErrorRate = errorRate > 0.5;
    
    if (responseTimeExceeded || highErrorRate) {
      logger.warn(`Circuit breaker ${this.name} opening based on metrics: avgResponseTime=${avgResponseTime}ms, errorRate=${errorRate}`);
      return true;
    }
    
    return false;
  }
  
  private calculateBackoff(): number {
    let baseBackoff: number;
    
    switch (this.config.backoffStrategy) {
      case 'exponential':
        baseBackoff = this.config.initialBackoff * Math.pow(2, this.backoffMultiplier - 1);
        break;
      
      case 'linear':
        baseBackoff = this.config.initialBackoff * this.backoffMultiplier;
        break;
      
      case 'fibonacci':
        baseBackoff = this.config.initialBackoff * this.fibonacci(Math.floor(this.backoffMultiplier));
        break;
      
      default:
        baseBackoff = this.config.resetTimeout;
    }
    
    // Apply max backoff limit
    baseBackoff = Math.min(baseBackoff, this.config.maxBackoff);
    
    // Apply jitter if enabled
    if (this.config.backoffJitter) {
      const jitter = (Math.random() - 0.5) * 0.2; // ±10% jitter
      baseBackoff = baseBackoff * (1 + jitter);
    }
    
    return Math.floor(baseBackoff);
  }
  
  private fibonacci(n: number): number {
    if (n <= 1) return 1;
    let a = 1, b = 1;
    for (let i = 2; i <= n; i++) {
      [a, b] = [b, a + b];
    }
    return b;
  }
  
  private transitionToOpen(reason: string) {
    this.state = 'open';
    this.successCount = 0;
    apmManager.recordCircuitBreakerEvent(this.name, 'open');
    apmManager.counter('circuit_breaker.opened', 1, { circuit: this.name, reason });
  }
  
  private transitionToClosed() {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.backoffMultiplier = 1;
    apmManager.recordCircuitBreakerEvent(this.name, 'close');
  }
  
  private recordRequest(metrics: RequestMetrics) {
    this.requestHistory.push(metrics);
    
    // Keep history size manageable
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-500);
    }
  }
  
  private getRecentRequests(windowMs: number): RequestMetrics[] {
    const cutoff = Date.now() - windowMs;
    return this.requestHistory.filter(req => req.timestamp > cutoff);
  }
  
  private cleanOldMetrics() {
    const cutoff = Date.now() - Math.max(this.config.adaptiveWindow, this.config.volumeWindow) * 2;
    this.requestHistory = this.requestHistory.filter(req => req.timestamp > cutoff);
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  getStats() {
    const recentRequests = this.getRecentRequests(this.config.adaptiveWindow);
    const avgResponseTime = recentRequests.length > 0
      ? recentRequests.reduce((sum, req) => sum + req.duration, 0) / recentRequests.length
      : 0;
    const errorRate = recentRequests.length > 0
      ? recentRequests.filter(req => !req.success).length / recentRequests.length
      : 0;
    
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      backoffMultiplier: this.backoffMultiplier,
      currentBackoff: this.state === 'open' ? this.calculateBackoff() : (this.state === 'closed' ? 0 : this.calculateBackoff()),
      metrics: {
        requestCount: recentRequests.length,
        avgResponseTime: Math.round(avgResponseTime),
        errorRate: Math.round(errorRate * 100) / 100,
      },
    };
  }
  
  reset() {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.halfOpenAttempts = 0;
    this.backoffMultiplier = 1;
    this.requestHistory = [];
  }
  
  // Allow dynamic configuration updates
  updateConfig(updates: Partial<AdaptiveCircuitBreakerConfig>) {
    Object.assign(this.config, updates);
    logger.info(`Circuit breaker ${this.name} configuration updated`, updates);
  }
}