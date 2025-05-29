import { circuitBreakerFactory } from '@/services/ai/circuitBreakerFactory';
import { AdaptiveCircuitBreaker } from '@/services/ai/adaptiveCircuitBreaker';
import { CircuitBreaker } from '@/services/ai/circuitBreaker';

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

// Mock feature flags
jest.mock('@/services/config/featureFlags', () => ({
  featureFlags: {
    isEnabled: jest.fn((flag) => true), // Enable all features by default for tests
  },
}));

describe('CircuitBreakerFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the factory state
    circuitBreakerFactory.resetAll();
  });
  
  describe('Breaker Creation', () => {
    it('should create adaptive circuit breaker for AI endpoints', () => {
      const breaker = circuitBreakerFactory.getBreaker('ai.claude.analyze');
      expect(breaker).toBeInstanceOf(AdaptiveCircuitBreaker);
    });
    
    it('should create standard circuit breaker for container operations', () => {
      const breaker = circuitBreakerFactory.getBreaker('container.create');
      expect(breaker).toBeInstanceOf(CircuitBreaker);
    });
    
    it('should create default adaptive breaker for unknown endpoints', () => {
      const breaker = circuitBreakerFactory.getBreaker('unknown.endpoint');
      expect(breaker).toBeInstanceOf(AdaptiveCircuitBreaker);
    });
    
    it('should reuse existing breakers', () => {
      const breaker1 = circuitBreakerFactory.getBreaker('ai.claude.analyze');
      const breaker2 = circuitBreakerFactory.getBreaker('ai.claude.analyze');
      expect(breaker1).toBe(breaker2);
    });
  });
  
  describe('Execute Method', () => {
    it('should execute operations through circuit breaker', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result');
      
      const result = await circuitBreakerFactory.execute(
        'ai.openai.analyze',
        mockOperation
      );
      
      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();
    });
    
    it('should handle circuit breaker failures', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakerFactory.execute('ai.deepseek.analyze', mockOperation);
        } catch (e) {
          // Expected
        }
      }
      
      // Circuit should be open
      await expect(
        circuitBreakerFactory.execute('ai.deepseek.analyze', mockOperation)
      ).rejects.toThrow('Circuit breaker is open');
    });
  });
  
  describe('Statistics', () => {
    it('should get all breaker statistics', async () => {
      // Create a few breakers
      circuitBreakerFactory.getBreaker('ai.claude.analyze');
      circuitBreakerFactory.getBreaker('container.create');
      
      const stats = circuitBreakerFactory.getAllStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
      expect(Object.keys(stats)).toContain('ai.claude.analyze');
      expect(Object.keys(stats)).toContain('container.create');
    });
    
    it('should get specific endpoint statistics', () => {
      circuitBreakerFactory.getBreaker('ai.openai.analyze');
      
      const stats = circuitBreakerFactory.getStats('ai.openai.analyze');
      
      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('failureCount');
      expect(stats).toHaveProperty('successCount');
    });
    
    it('should return null for non-existent endpoint stats', () => {
      const stats = circuitBreakerFactory.getStats('non.existent');
      expect(stats).toBeNull();
    });
  });
  
  describe('Health Summary', () => {
    it('should provide health summary', async () => {
      // Create some breakers
      circuitBreakerFactory.getBreaker('ai.claude.analyze');
      circuitBreakerFactory.getBreaker('ai.openai.analyze');
      
      const summary = circuitBreakerFactory.getHealthSummary();
      
      expect(summary.total).toBeGreaterThanOrEqual(2);
      expect(summary.closed).toBeGreaterThanOrEqual(2);
      expect(summary.open).toBeGreaterThanOrEqual(0);
      expect(summary.halfOpen).toBeGreaterThanOrEqual(0);
      expect(summary.unhealthy).toBeDefined();
      expect(Array.isArray(summary.unhealthy)).toBe(true);
    });
    
    it('should track unhealthy breakers', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Open one circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreakerFactory.execute('ai.claude.analyze', mockOperation);
        } catch (e) {}
      }
      
      const summary = circuitBreakerFactory.getHealthSummary();
      
      expect(summary.open).toBe(1);
      expect(summary.unhealthy).toContain('ai.claude.analyze');
    });
  });
  
  describe('Reset Operations', () => {
    it('should reset specific breaker', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Open circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreakerFactory.execute('ai.claude.analyze', mockOperation);
        } catch (e) {}
      }
      
      // Reset
      circuitBreakerFactory.reset('ai.claude.analyze');
      
      const stats = circuitBreakerFactory.getStats('ai.claude.analyze');
      expect(stats?.state).toBe('closed');
    });
    
    it('should reset all breakers', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Open multiple circuits
      for (const endpoint of ['ai.claude.analyze', 'ai.openai.analyze']) {
        for (let i = 0; i < 3; i++) {
          try {
            await circuitBreakerFactory.execute(endpoint, mockOperation);
          } catch (e) {}
        }
      }
      
      // Reset all
      circuitBreakerFactory.resetAll();
      
      const summary = circuitBreakerFactory.getHealthSummary();
      expect(summary.open).toBe(0);
      expect(summary.closed).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('Configuration Updates', () => {
    it('should update endpoint configuration', () => {
      // Create the breaker first
      circuitBreakerFactory.getBreaker('ai.claude.analyze');
      
      // Update config
      circuitBreakerFactory.updateEndpointConfig('ai.claude.analyze', {
        failureThreshold: 10,
        targetResponseTime: 3000,
      });
      
      // Verify update method exists and doesn't throw
      expect(() => 
        circuitBreakerFactory.updateEndpointConfig('ai.claude.analyze', {})
      ).not.toThrow();
    });
  });
});