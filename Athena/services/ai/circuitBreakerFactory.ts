/**
 * Circuit Breaker Factory for managing per-endpoint circuit breakers
 */

import { AdaptiveCircuitBreaker, AdaptiveCircuitBreakerConfig } from './adaptiveCircuitBreaker';
import { CircuitBreaker, CircuitBreakerConfig } from './circuitBreaker';
import { logger } from '@/shared/logging/logger';
import { featureFlags } from '../config/featureFlags';

export type CircuitBreakerType = 'standard' | 'adaptive';

export interface EndpointConfig {
  type?: CircuitBreakerType;
  config?: Partial<AdaptiveCircuitBreakerConfig | CircuitBreakerConfig>;
}

export interface CircuitBreakerFactoryConfig {
  defaultType: CircuitBreakerType;
  defaultConfig: Partial<AdaptiveCircuitBreakerConfig>;
  endpoints: Record<string, EndpointConfig>;
}

export class CircuitBreakerFactory {
  private static instance: CircuitBreakerFactory;
  private breakers: Map<string, CircuitBreaker | AdaptiveCircuitBreaker> = new Map();
  private config: CircuitBreakerFactoryConfig;
  
  private constructor() {
    this.config = {
      defaultType: 'adaptive',
      defaultConfig: {
        failureThreshold: 3,
        successThreshold: 2,
        resetTimeout: 60000,
        enableAdaptive: true,
        targetResponseTime: 1000,
        backoffStrategy: 'exponential',
        backoffJitter: true,
      },
      endpoints: {
        // AI Service endpoints
        'ai.claude.analyze': {
          type: 'adaptive',
          config: {
            targetResponseTime: 2000,
            responseTimeThreshold: 2.5,
            maxBackoff: 300000,
          },
        },
        'ai.openai.analyze': {
          type: 'adaptive',
          config: {
            targetResponseTime: 1500,
            responseTimeThreshold: 3.0,
            maxBackoff: 300000,
          },
        },
        'ai.deepseek.analyze': {
          type: 'adaptive',
          config: {
            targetResponseTime: 3000,
            responseTimeThreshold: 2.0,
            failureThreshold: 5, // More tolerant for backup service
          },
        },
        
        // Container operations
        'container.create': {
          type: 'standard',
          config: {
            failureThreshold: 2,
            resetTimeout: 120000,
          },
        },
        'container.execute': {
          type: 'adaptive',
          config: {
            targetResponseTime: 500,
            minRequestVolume: 5,
          },
        },
        
        // External APIs
        'api.metasploit': {
          type: 'adaptive',
          config: {
            targetResponseTime: 5000,
            failureThreshold: 5,
            backoffStrategy: 'fibonacci',
          },
        },
      },
    };
  }
  
  static getInstance(): CircuitBreakerFactory {
    if (!CircuitBreakerFactory.instance) {
      CircuitBreakerFactory.instance = new CircuitBreakerFactory();
    }
    return CircuitBreakerFactory.instance;
  }
  
  /**
   * Get or create a circuit breaker for an endpoint
   */
  getBreaker(endpoint: string): CircuitBreaker | AdaptiveCircuitBreaker {
    if (!this.breakers.has(endpoint)) {
      this.breakers.set(endpoint, this.createBreaker(endpoint));
    }
    return this.breakers.get(endpoint)!;
  }
  
  /**
   * Create a new circuit breaker based on endpoint configuration
   */
  private createBreaker(endpoint: string): CircuitBreaker | AdaptiveCircuitBreaker {
    const endpointConfig = this.config.endpoints[endpoint] || {};
    let type = endpointConfig.type || this.config.defaultType;
    
    // Check feature flags to determine if adaptive circuit breaker should be used
    if (type === 'adaptive' && !featureFlags.isEnabled('enableAdaptiveCircuitBreaker')) {
      type = 'standard';
    }
    
    const config = {
      ...this.config.defaultConfig,
      ...endpointConfig.config,
    };
    
    logger.info(`Creating ${type} circuit breaker for endpoint: ${endpoint}`, config);
    
    if (type === 'adaptive') {
      return new AdaptiveCircuitBreaker(endpoint, config as Partial<AdaptiveCircuitBreakerConfig>);
    } else {
      return new CircuitBreaker(endpoint, config as Partial<CircuitBreakerConfig>);
    }
  }
  
  /**
   * Execute an operation with the appropriate circuit breaker
   */
  async execute<T>(endpoint: string, operation: () => Promise<T>): Promise<T> {
    // Check if circuit breaker is enabled via feature flag
    if (!featureFlags.isEnabled('enableCircuitBreaker')) {
      return operation();
    }
    
    const breaker = this.getBreaker(endpoint);
    return breaker.execute(operation);
  }
  
  /**
   * Get statistics for all circuit breakers
   */
  getAllStats() {
    const stats: Record<string, any> = {};
    
    this.breakers.forEach((breaker, endpoint) => {
      stats[endpoint] = breaker.getStats();
    });
    
    return stats;
  }
  
  /**
   * Get statistics for a specific endpoint
   */
  getStats(endpoint: string) {
    const breaker = this.breakers.get(endpoint);
    return breaker ? breaker.getStats() : null;
  }
  
  /**
   * Reset a specific circuit breaker
   */
  reset(endpoint: string) {
    const breaker = this.breakers.get(endpoint);
    if (breaker) {
      breaker.reset();
      logger.info(`Circuit breaker reset for endpoint: ${endpoint}`);
    }
  }
  
  /**
   * Reset all circuit breakers
   */
  resetAll() {
    this.breakers.forEach((breaker, endpoint) => {
      breaker.reset();
    });
    logger.info('All circuit breakers reset');
  }
  
  /**
   * Update configuration for a specific endpoint
   */
  updateEndpointConfig(endpoint: string, config: Partial<AdaptiveCircuitBreakerConfig>) {
    const breaker = this.breakers.get(endpoint);
    
    if (breaker && 'updateConfig' in breaker) {
      breaker.updateConfig(config);
    }
    
    // Update stored config
    if (!this.config.endpoints[endpoint]) {
      this.config.endpoints[endpoint] = {};
    }
    this.config.endpoints[endpoint].config = {
      ...this.config.endpoints[endpoint].config,
      ...config,
    };
  }
  
  /**
   * Get a summary of circuit breaker health
   */
  getHealthSummary() {
    const summary = {
      total: this.breakers.size,
      open: 0,
      halfOpen: 0,
      closed: 0,
      unhealthy: [] as string[],
    };
    
    this.breakers.forEach((breaker, endpoint) => {
      const state = breaker.getState();
      summary[state === 'half-open' ? 'halfOpen' : state]++;
      
      if (state !== 'closed') {
        summary.unhealthy.push(endpoint);
      }
    });
    
    return summary;
  }
}

// Export singleton instance
export const circuitBreakerFactory = CircuitBreakerFactory.getInstance();