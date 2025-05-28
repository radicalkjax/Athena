/**
 * Bulkhead Pattern Implementation for Service Isolation
 * Prevents resource exhaustion by isolating services in separate pools
 */

import { logger } from '@/shared/logging/logger';
import { apmManager } from '../apm/manager';

export interface BulkheadConfig {
  maxConcurrent: number;
  maxQueueSize: number;
  queueTimeout: number;
  name: string;
}

export interface BulkheadStats {
  activeCount: number;
  queuedCount: number;
  totalExecuted: number;
  totalRejected: number;
  totalTimeout: number;
  averageWaitTime: number;
  averageExecutionTime: number;
}

interface QueuedTask<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  enqueueTime: number;
  timeout: NodeJS.Timeout;
}

export class Bulkhead<T = any> {
  private activeCount = 0;
  private queue: QueuedTask<T>[] = [];
  private stats = {
    totalExecuted: 0,
    totalRejected: 0,
    totalTimeout: 0,
    totalWaitTime: 0,
    totalExecutionTime: 0,
  };
  
  constructor(private config: BulkheadConfig) {
    logger.info(`Bulkhead ${config.name} initialized`, {
      maxConcurrent: config.maxConcurrent,
      maxQueueSize: config.maxQueueSize,
    });
  }
  
  async execute<R>(task: () => Promise<R>): Promise<R> {
    // Check if we can execute immediately
    if (this.activeCount < this.config.maxConcurrent) {
      return this.executeTask(task);
    }
    
    // Check if queue is full
    if (this.queue.length >= this.config.maxQueueSize) {
      this.stats.totalRejected++;
      apmManager.counter('bulkhead.rejected', 1, { bulkhead: this.config.name });
      throw new Error(`Bulkhead ${this.config.name} queue is full`);
    }
    
    // Queue the task
    return this.queueTask(task);
  }
  
  private async executeTask<R>(task: () => Promise<R>): Promise<R> {
    this.activeCount++;
    const startTime = Date.now();
    
    apmManager.gauge('bulkhead.active', this.activeCount, { bulkhead: this.config.name });
    
    try {
      const result = await task();
      
      const executionTime = Date.now() - startTime;
      this.stats.totalExecuted++;
      this.stats.totalExecutionTime += executionTime;
      
      apmManager.histogram('bulkhead.execution_time', executionTime, { 
        bulkhead: this.config.name 
      });
      
      return result;
    } catch (error) {
      apmManager.counter('bulkhead.error', 1, { bulkhead: this.config.name });
      throw error;
    } finally {
      this.activeCount--;
      apmManager.gauge('bulkhead.active', this.activeCount, { bulkhead: this.config.name });
      
      // Process next queued task
      this.processQueue();
    }
  }
  
  private queueTask<R>(task: () => Promise<R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const enqueueTime = Date.now();
      
      // Set up timeout
      const timeout = setTimeout(() => {
        // Remove from queue
        const index = this.queue.findIndex(item => item.timeout === timeout);
        if (index !== -1) {
          this.queue.splice(index, 1);
          this.stats.totalTimeout++;
          
          apmManager.counter('bulkhead.timeout', 1, { bulkhead: this.config.name });
          reject(new Error(`Task timed out in bulkhead ${this.config.name} queue`));
        }
      }, this.config.queueTimeout);
      
      // Add to queue
      const queuedTask: QueuedTask<R> = {
        execute: task,
        resolve: resolve as any,
        reject,
        enqueueTime,
        timeout,
      };
      
      this.queue.push(queuedTask as any);
      apmManager.gauge('bulkhead.queued', this.queue.length, { bulkhead: this.config.name });
      
      logger.debug(`Task queued in bulkhead ${this.config.name}`, {
        queueLength: this.queue.length,
        activeCount: this.activeCount,
      });
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0 || this.activeCount >= this.config.maxConcurrent) {
      return;
    }
    
    const queuedTask = this.queue.shift();
    if (!queuedTask) return;
    
    // Clear timeout
    clearTimeout(queuedTask.timeout);
    
    // Update wait time stats
    const waitTime = Date.now() - queuedTask.enqueueTime;
    this.stats.totalWaitTime += waitTime;
    
    apmManager.histogram('bulkhead.wait_time', waitTime, { bulkhead: this.config.name });
    apmManager.gauge('bulkhead.queued', this.queue.length, { bulkhead: this.config.name });
    
    // Execute the queued task
    try {
      const result = await this.executeTask(queuedTask.execute);
      queuedTask.resolve(result);
    } catch (error) {
      queuedTask.reject(error as Error);
    }
  }
  
  getStats(): BulkheadStats {
    return {
      activeCount: this.activeCount,
      queuedCount: this.queue.length,
      totalExecuted: this.stats.totalExecuted,
      totalRejected: this.stats.totalRejected,
      totalTimeout: this.stats.totalTimeout,
      averageWaitTime: this.stats.totalExecuted > 0 
        ? Math.round(this.stats.totalWaitTime / this.stats.totalExecuted)
        : 0,
      averageExecutionTime: this.stats.totalExecuted > 0
        ? Math.round(this.stats.totalExecutionTime / this.stats.totalExecuted)
        : 0,
    };
  }
  
  async drain(): Promise<void> {
    // Reject all queued tasks
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        clearTimeout(task.timeout);
        task.reject(new Error(`Bulkhead ${this.config.name} is draining`));
      }
    }
    
    // Wait for active tasks to complete
    while (this.activeCount > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  reset(): void {
    // Clear queue
    this.queue.forEach(task => {
      clearTimeout(task.timeout);
      task.reject(new Error(`Bulkhead ${this.config.name} was reset`));
    });
    this.queue = [];
    
    // Reset stats
    this.stats = {
      totalExecuted: 0,
      totalRejected: 0,
      totalTimeout: 0,
      totalWaitTime: 0,
      totalExecutionTime: 0,
    };
    
    logger.info(`Bulkhead ${this.config.name} reset`);
  }
}

/**
 * Semaphore-based bulkhead for lighter weight isolation
 */
export class SemaphoreBulkhead {
  private permits: number;
  private waitQueue: Array<() => void> = [];
  private stats = {
    totalAcquired: 0,
    totalReleased: 0,
    totalTimeout: 0,
  };
  
  constructor(
    private maxPermits: number,
    private name: string
  ) {
    this.permits = maxPermits;
  }
  
  async acquire(timeoutMs?: number): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      this.stats.totalAcquired++;
      apmManager.gauge('semaphore.available', this.permits, { semaphore: this.name });
      return;
    }
    
    // Wait for permit
    return new Promise<void>((resolve, reject) => {
      let timeoutHandle: NodeJS.Timeout | undefined;
      
      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const index = this.waitQueue.indexOf(resolver);
        if (index !== -1) this.waitQueue.splice(index, 1);
      };
      
      const resolver = () => {
        cleanup();
        this.permits--;
        this.stats.totalAcquired++;
        apmManager.gauge('semaphore.available', this.permits, { semaphore: this.name });
        resolve();
      };
      
      this.waitQueue.push(resolver);
      
      if (timeoutMs) {
        timeoutHandle = setTimeout(() => {
          cleanup();
          this.stats.totalTimeout++;
          apmManager.counter('semaphore.timeout', 1, { semaphore: this.name });
          reject(new Error(`Semaphore ${this.name} acquisition timed out`));
        }, timeoutMs);
      }
    });
  }
  
  release(): void {
    this.permits++;
    this.stats.totalReleased++;
    apmManager.gauge('semaphore.available', this.permits, { semaphore: this.name });
    
    // Process wait queue
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) next();
    }
  }
  
  async withPermit<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    await this.acquire(timeoutMs);
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
  
  getStats() {
    return {
      availablePermits: this.permits,
      waitingCount: this.waitQueue.length,
      ...this.stats,
    };
  }
}