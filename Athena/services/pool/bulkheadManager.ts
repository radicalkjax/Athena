/**
 * Bulkhead Manager - Centralized management of service isolation
 */

import { Bulkhead, SemaphoreBulkhead, BulkheadConfig } from './bulkhead';
import { logger } from '@/shared/logging/logger';
import { apmManager } from '../apm/manager';
import { featureFlags } from '../config/featureFlags';

export interface BulkheadManagerConfig {
  defaults: {
    maxConcurrent: number;
    maxQueueSize: number;
    queueTimeout: number;
  };
  services: {
    [key: string]: Partial<BulkheadConfig>;
  };
  semaphores: {
    [key: string]: number; // max permits
  };
}

export class BulkheadManager {
  private static instance: BulkheadManager;
  private bulkheads: Map<string, Bulkhead> = new Map();
  private semaphores: Map<string, SemaphoreBulkhead> = new Map();
  private config: BulkheadManagerConfig;
  
  private constructor() {
    this.config = {
      defaults: {
        maxConcurrent: 10,
        maxQueueSize: 50,
        queueTimeout: 30000, // 30 seconds
      },
      services: {
        // AI Services - Higher concurrency for primary providers
        'ai.claude': {
          maxConcurrent: 20,
          maxQueueSize: 100,
          queueTimeout: 60000, // 1 minute
        },
        'ai.openai': {
          maxConcurrent: 20,
          maxQueueSize: 100,
          queueTimeout: 60000,
        },
        'ai.deepseek': {
          maxConcurrent: 10, // Lower for backup service
          maxQueueSize: 50,
          queueTimeout: 90000, // 1.5 minutes (slower service)
        },
        
        // Container Operations - Limited concurrency
        'container.create': {
          maxConcurrent: 5,
          maxQueueSize: 20,
          queueTimeout: 120000, // 2 minutes
        },
        'container.execute': {
          maxConcurrent: 10,
          maxQueueSize: 30,
          queueTimeout: 30000,
        },
        
        // File Operations
        'file.upload': {
          maxConcurrent: 15,
          maxQueueSize: 50,
          queueTimeout: 60000,
        },
        'file.analyze': {
          maxConcurrent: 10,
          maxQueueSize: 40,
          queueTimeout: 45000,
        },
        
        // External APIs
        'api.metasploit': {
          maxConcurrent: 5,
          maxQueueSize: 20,
          queueTimeout: 90000,
        },
        
        // Database Operations
        'db.read': {
          maxConcurrent: 30,
          maxQueueSize: 100,
          queueTimeout: 10000,
        },
        'db.write': {
          maxConcurrent: 15,
          maxQueueSize: 50,
          queueTimeout: 15000,
        },
      },
      semaphores: {
        // Global resource limits
        'global.cpu_intensive': 5,
        'global.memory_intensive': 3,
        'global.network_io': 50,
        'global.disk_io': 20,
        
        // Service-specific semaphores
        'ai.total_requests': 30, // Total AI requests across all providers
        'container.total': 10,   // Total container operations
      },
    };
    
    this.initializeBulkheads();
  }
  
  static getInstance(): BulkheadManager {
    if (!BulkheadManager.instance) {
      BulkheadManager.instance = new BulkheadManager();
    }
    return BulkheadManager.instance;
  }
  
  private initializeBulkheads(): void {
    // Initialize semaphores
    for (const [name, permits] of Object.entries(this.config.semaphores)) {
      this.semaphores.set(name, new SemaphoreBulkhead(permits, name));
      logger.info(`Semaphore ${name} initialized with ${permits} permits`);
    }
  }
  
  /**
   * Get or create a bulkhead for a service
   */
  getBulkhead(service: string): Bulkhead {
    if (!this.bulkheads.has(service)) {
      const serviceConfig = this.config.services[service] || {};
      const config: BulkheadConfig = {
        name: service,
        ...this.config.defaults,
        ...serviceConfig,
      };
      
      this.bulkheads.set(service, new Bulkhead(config));
      logger.info(`Bulkhead created for service: ${service}`, config);
    }
    
    return this.bulkheads.get(service)!;
  }
  
  /**
   * Get a semaphore by name
   */
  getSemaphore(name: string): SemaphoreBulkhead | undefined {
    return this.semaphores.get(name);
  }
  
  /**
   * Execute a task with bulkhead protection
   */
  async execute<T>(
    service: string,
    task: () => Promise<T>,
    options?: {
      semaphores?: string[];
      priority?: 'high' | 'normal' | 'low';
    }
  ): Promise<T> {
    // Check if bulkhead is enabled via feature flag
    if (!featureFlags.isEnabled('enableBulkhead')) {
      return task();
    }
    
    const bulkhead = this.getBulkhead(service);
    const semaphores = options?.semaphores || [];
    
    // Acquire semaphores first
    const acquiredSemaphores: SemaphoreBulkhead[] = [];
    try {
      for (const semaphoreName of semaphores) {
        const semaphore = this.getSemaphore(semaphoreName);
        if (semaphore) {
          await semaphore.acquire(10000); // 10s timeout for semaphores
          acquiredSemaphores.push(semaphore);
        }
      }
      
      // Execute with bulkhead
      return await bulkhead.execute(task);
    } finally {
      // Release semaphores in reverse order
      for (const semaphore of acquiredSemaphores.reverse()) {
        semaphore.release();
      }
    }
  }
  
  /**
   * Execute CPU-intensive task with appropriate isolation
   */
  async executeCpuIntensive<T>(
    service: string,
    task: () => Promise<T>
  ): Promise<T> {
    return this.execute(service, task, {
      semaphores: ['global.cpu_intensive'],
    });
  }
  
  /**
   * Execute memory-intensive task with appropriate isolation
   */
  async executeMemoryIntensive<T>(
    service: string,
    task: () => Promise<T>
  ): Promise<T> {
    return this.execute(service, task, {
      semaphores: ['global.memory_intensive'],
    });
  }
  
  /**
   * Execute AI task with global AI limit
   */
  async executeAITask<T>(
    provider: string,
    task: () => Promise<T>
  ): Promise<T> {
    return this.execute(`ai.${provider}`, task, {
      semaphores: ['ai.total_requests'],
    });
  }
  
  /**
   * Get statistics for all bulkheads
   */
  getAllStats() {
    const stats: Record<string, any> = {
      bulkheads: {},
      semaphores: {},
    };
    
    // Bulkhead stats
    this.bulkheads.forEach((bulkhead, name) => {
      stats.bulkheads[name] = bulkhead.getStats();
    });
    
    // Semaphore stats
    this.semaphores.forEach((semaphore, name) => {
      stats.semaphores[name] = semaphore.getStats();
    });
    
    return stats;
  }
  
  /**
   * Get health summary
   */
  getHealthSummary() {
    const summary = {
      totalBulkheads: this.bulkheads.size,
      totalSemaphores: this.semaphores.size,
      saturated: [] as string[],
      queuedTasks: 0,
      activeTasks: 0,
    };
    
    this.bulkheads.forEach((bulkhead, name) => {
      const stats = bulkhead.getStats();
      summary.queuedTasks += stats.queuedCount;
      summary.activeTasks += stats.activeCount;
      
      // Check if bulkhead is saturated
      const config = this.config.services[name] || this.config.defaults;
      if (stats.activeCount >= config.maxConcurrent && stats.queuedCount > 0) {
        summary.saturated.push(name);
      }
    });
    
    return summary;
  }
  
  /**
   * Update bulkhead configuration
   */
  updateConfig(service: string, config: Partial<BulkheadConfig>): void {
    this.config.services[service] = {
      ...this.config.services[service],
      ...config,
    };
    
    // If bulkhead exists, recreate with new config
    if (this.bulkheads.has(service)) {
      const oldBulkhead = this.bulkheads.get(service)!;
      oldBulkhead.drain().then(() => {
        this.bulkheads.delete(service);
        logger.info(`Bulkhead ${service} configuration updated`, config);
      });
    }
  }
  
  /**
   * Drain all bulkheads (for graceful shutdown)
   */
  async drainAll(): Promise<void> {
    const drainPromises: Promise<void>[] = [];
    
    this.bulkheads.forEach((bulkhead, name) => {
      logger.info(`Draining bulkhead: ${name}`);
      drainPromises.push(bulkhead.drain());
    });
    
    await Promise.all(drainPromises);
    logger.info('All bulkheads drained');
  }
  
  /**
   * Reset specific bulkhead
   */
  reset(service: string): void {
    const bulkhead = this.bulkheads.get(service);
    if (bulkhead) {
      bulkhead.reset();
    }
  }
  
  /**
   * Reset all bulkheads
   */
  resetAll(): void {
    this.bulkheads.forEach(bulkhead => bulkhead.reset());
    logger.info('All bulkheads reset');
  }
}

// Export singleton instance
export const bulkheadManager = BulkheadManager.getInstance();