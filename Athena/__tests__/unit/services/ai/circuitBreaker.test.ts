import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Tests for Circuit Breaker
 */

import { CircuitBreaker } from '@/services/ai/circuitBreaker';
import { logger } from '@/shared/logging/logger';

vi.mock('@/shared/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      resetTimeout: 1000,
      halfOpenRequests: 1
    });
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('closed state', () => {
    it('should execute successful operations', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
    });
    
    it('should count failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      try {
        await breaker.execute(operation);
      } catch (e) {
        // Expected
      }
      
      const stats = breaker.getStats();
      expect(stats.failureCount).toBe(1);
      expect(breaker.getState()).toBe('closed');
    });
    
    it('should open after reaching failure threshold', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }
      
      expect(breaker.getState()).toBe('open');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('opening after 3 failures')
      );
    });
  });
  
  describe('open state', () => {
    beforeEach(async () => {
      // Open the breaker
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }
    });
    
    it('should reject operations immediately', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      await expect(breaker.execute(operation))
        .rejects.toThrow('Circuit breaker is open');
      
      expect(operation).not.toHaveBeenCalled();
    });
    
    it('should transition to half-open after reset timeout', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      // Wait for reset timeout
      vi.advanceTimersByTime(1001);
      
      const result = await breaker.execute(operation);
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('transitioning to half-open')
      );
    });
  });
  
  describe('half-open state', () => {
    beforeEach(async () => {
      // Open the breaker
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }
      
      // Transition to half-open
      vi.advanceTimersByTime(1001);
    });
    
    it('should close on successful operation', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await breaker.execute(operation);
      expect(result).toBe('success');
      expect(breaker.getState()).toBe('closed');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('closing after successful half-open test')
      );
    });
    
    it('should reopen on failed operation', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      
      try {
        await breaker.execute(operation);
      } catch (e) {
        // Expected
      }
      
      expect(breaker.getState()).toBe('open');
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('reopening after half-open failure')
      );
    });
    
    it('should limit half-open requests', async () => {
      const successOp = vi.fn().mockResolvedValue('success');
      
      // First request succeeds and closes the breaker
      await breaker.execute(successOp);
      expect(breaker.getState()).toBe('closed');
      
      // Reopen the breaker
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failOp);
        } catch (e) {
          // Expected
        }
      }
      
      // Transition to half-open again
      vi.advanceTimersByTime(1001);
      
      // Configure breaker to stay in half-open
      const breaker2 = new CircuitBreaker('test2', {
        failureThreshold: 3,
        resetTimeout: 1000,
        halfOpenRequests: 2
      });
      
      // Open it
      for (let i = 0; i < 3; i++) {
        try {
          await breaker2.execute(failOp);
        } catch (e) {
          // Expected
        }
      }
      
      vi.advanceTimersByTime(1001);
      
      // First request should work
      await breaker2.execute(successOp);
      expect(breaker2.getState()).toBe('half-open');
      
      // Second request should also work and close the circuit
      await breaker2.execute(successOp);
      expect(breaker2.getState()).toBe('closed');
    });
  });
  
  describe('reset', () => {
    it('should reset all state', async () => {
      // Create some state
      const operation = vi.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(operation);
        } catch (e) {
          // Expected
        }
      }
      
      const statsBefore = breaker.getStats();
      expect(statsBefore.failureCount).toBe(2);
      
      // Reset
      breaker.reset();
      
      const statsAfter = breaker.getStats();
      expect(statsAfter).toEqual({
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        lastFailureTime: 0
      });
    });
  });
});