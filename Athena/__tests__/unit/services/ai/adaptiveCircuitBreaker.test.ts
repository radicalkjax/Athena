import { AdaptiveCircuitBreaker } from '@/services/ai/adaptiveCircuitBreaker';

// Mock APM manager
jest.mock('@/services/apm/manager', () => ({
  apmManager: {
    recordCircuitBreakerEvent: jest.fn(),
    recordMetric: jest.fn(),
    histogram: jest.fn(),
    counter: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('AdaptiveCircuitBreaker', () => {
  let breaker: AdaptiveCircuitBreaker;
  const mockOperation = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    breaker = new AdaptiveCircuitBreaker('test-breaker', {
      failureThreshold: 3,
      successThreshold: 2,
      resetTimeout: 1000,
      targetResponseTime: 100,
      responseTimeThreshold: 2.0,
      minRequestVolume: 5,
      initialBackoff: 100,
      maxBackoff: 5000,
      adaptiveWindow: 60000, // 60 seconds to ensure metrics are retained
    });
  });
  
  describe('Basic Circuit Breaker Functionality', () => {
    it('should execute operations successfully when closed', async () => {
      mockOperation.mockResolvedValue('success');
      const result = await breaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
      expect(breaker.getState()).toBe('closed');
    });
    
    it('should open after failure threshold', async () => {
      mockOperation.mockRejectedValue(new Error('test error'));
      
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (e) {
          // Expected
        }
      }
      
      expect(breaker.getState()).toBe('open');
      
      // Should reject immediately when open
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is open');
    });
    
    it('should transition to half-open after backoff period', async () => {
      mockOperation.mockRejectedValue(new Error('test error'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (e) {
          // Expected
        }
      }
      
      expect(breaker.getState()).toBe('open');
      
      // Wait for backoff
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should transition to half-open on next attempt
      mockOperation.mockResolvedValue('success');
      await breaker.execute(mockOperation);
      
      expect(breaker.getState()).toBe('half-open');
    });
    
    it('should close after success threshold in half-open', async () => {
      // Set up circuit in half-open state
      mockOperation.mockRejectedValue(new Error('test error'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (e) {}
      }
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Succeed twice (success threshold)
      mockOperation.mockResolvedValue('success');
      await breaker.execute(mockOperation);
      await breaker.execute(mockOperation);
      
      expect(breaker.getState()).toBe('closed');
    });
  });
  
  describe('Adaptive Thresholds', () => {
    it('should open based on response time threshold', async () => {
      // First, make enough requests to meet minimum volume
      mockOperation.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('slow'), 250))
      );
      
      // Make 5 slow requests (250ms each, threshold is 200ms)
      for (let i = 0; i < 5; i++) {
        await breaker.execute(mockOperation);
      }
      
      // Next request should find circuit open due to slow response times
      await expect(breaker.execute(mockOperation)).rejects.toThrow('Circuit breaker is open');
    });
    
    it('should not open if request volume is below minimum', async () => {
      mockOperation.mockRejectedValue(new Error('test error'));
      
      // Only 2 failures (below minRequestVolume of 5)
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (e) {}
      }
      
      expect(breaker.getState()).toBe('closed');
    });
  });
  
  describe('Backoff Strategies', () => {
    it('should use exponential backoff', async () => {
      const exponentialBreaker = new AdaptiveCircuitBreaker('exp-breaker', {
        backoffStrategy: 'exponential',
        initialBackoff: 100,
        maxBackoff: 5000,
        backoffJitter: false,
      });
      
      const stats1 = exponentialBreaker.getStats();
      expect(stats1.currentBackoff).toBe(0);
      
      // Open circuit
      mockOperation.mockRejectedValue(new Error('test'));
      for (let i = 0; i < 3; i++) {
        try {
          await exponentialBreaker.execute(mockOperation);
        } catch (e) {}
      }
      
      const stats2 = exponentialBreaker.getStats();
      expect(stats2.currentBackoff).toBe(100); // Initial backoff
      
      // Fail in half-open to increase multiplier
      await new Promise(resolve => setTimeout(resolve, 150));
      try {
        await exponentialBreaker.execute(mockOperation);
      } catch (e) {}
      
      const stats3 = exponentialBreaker.getStats();
      expect(stats3.currentBackoff).toBeGreaterThan(100); // Should be exponentially higher
    });
    
    it('should apply jitter to backoff', async () => {
      const jitterBreaker = new AdaptiveCircuitBreaker('jitter-breaker', {
        initialBackoff: 1000,
        backoffJitter: true,
      });
      
      // Open circuit
      mockOperation.mockRejectedValue(new Error('test'));
      for (let i = 0; i < 3; i++) {
        try {
          await jitterBreaker.execute(mockOperation);
        } catch (e) {}
      }
      
      // Check backoff multiple times - should vary due to jitter
      const backoffs = new Set();
      for (let i = 0; i < 5; i++) {
        const stats = jitterBreaker.getStats();
        backoffs.add(stats.currentBackoff);
      }
      
      // With jitter, we should see some variation
      expect(backoffs.size).toBeGreaterThan(1);
    });
  });
  
  describe('Statistics and Monitoring', () => {
    it('should track request metrics', async () => {
      mockOperation.mockResolvedValue('success');
      
      // Make several requests
      for (let i = 0; i < 10; i++) {
        await breaker.execute(mockOperation);
      }
      
      const stats = breaker.getStats();
      expect(stats.metrics.requestCount).toBeGreaterThan(0);
      expect(stats.metrics.avgResponseTime).toBeGreaterThan(0);
      expect(stats.metrics.errorRate).toBe(0);
    });
    
    it('should calculate error rate correctly', async () => {
      // 3 successes, 2 failures
      mockOperation.mockResolvedValueOnce('success');
      mockOperation.mockResolvedValueOnce('success');
      mockOperation.mockResolvedValueOnce('success');
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      mockOperation.mockRejectedValueOnce(new Error('fail'));
      
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (e) {}
      }
      
      const stats = breaker.getStats();
      expect(stats.metrics.errorRate).toBeCloseTo(0.4, 1); // 40% error rate
    });
  });
  
  describe('Configuration Updates', () => {
    it('should allow dynamic configuration updates', () => {
      breaker.updateConfig({
        failureThreshold: 5,
        targetResponseTime: 200,
      });
      
      // Verify config was updated (would need to make config accessible or test behavior)
      // This is mainly to ensure the method exists and doesn't throw
      expect(() => breaker.updateConfig({})).not.toThrow();
    });
  });
  
  describe('Reset Functionality', () => {
    it('should reset all state', async () => {
      // Put circuit in bad state
      mockOperation.mockRejectedValue(new Error('test'));
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(mockOperation);
        } catch (e) {}
      }
      
      expect(breaker.getState()).toBe('open');
      
      // Reset
      breaker.reset();
      
      const stats = breaker.getStats();
      expect(breaker.getState()).toBe('closed');
      expect(stats.failureCount).toBe(0);
      expect(stats.successCount).toBe(0);
      expect(stats.metrics.requestCount).toBe(0);
    });
  });
});