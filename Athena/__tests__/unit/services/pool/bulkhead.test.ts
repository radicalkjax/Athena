import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Bulkhead, SemaphoreBulkhead } from '@/services/pool/bulkhead';

// Mock APM manager
vi.mock('@/services/apm/manager', () => ({
  apmManager: {
    counter: vi.fn(),
    gauge: vi.fn(),
    histogram: vi.fn(),
  },
}));

// Mock logger
vi.mock('@/shared/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Bulkhead', () => {
  let bulkhead: Bulkhead;
  
  beforeEach(() => {
    vi.clearAllMocks();
    bulkhead = new Bulkhead({
      name: 'test-bulkhead',
      maxConcurrent: 2,
      maxQueueSize: 3,
      queueTimeout: 1000,
    });
  });
  
  describe('Basic Execution', () => {
    it('should execute tasks within concurrency limit', async () => {
      const task1 = vi.fn().mockResolvedValue('result1');
      const task2 = vi.fn().mockResolvedValue('result2');
      
      const results = await Promise.all([
        bulkhead.execute(task1),
        bulkhead.execute(task2),
      ]);
      
      expect(results).toEqual(['result1', 'result2']);
      expect(task1).toHaveBeenCalled();
      expect(task2).toHaveBeenCalled();
    });
    
    it('should queue tasks when at capacity', async () => {
      const slowTask = () => new Promise(resolve => setTimeout(() => resolve('slow'), 100));
      const fastTask = vi.fn().mockResolvedValue('fast');
      
      // Fill up concurrent capacity
      const promise1 = bulkhead.execute(slowTask);
      const promise2 = bulkhead.execute(slowTask);
      
      // This should be queued
      const promise3 = bulkhead.execute(fastTask);
      
      // Check stats show queued task
      const stats = bulkhead.getStats();
      expect(stats.activeCount).toBe(2);
      expect(stats.queuedCount).toBe(1);
      
      // Wait for all to complete
      await Promise.all([promise1, promise2, promise3]);
      
      expect(fastTask).toHaveBeenCalled();
    });
    
    it('should reject when queue is full', async () => {
      const slowTask = () => new Promise(resolve => setTimeout(() => resolve('slow'), 100));
      
      // Fill up concurrent capacity
      bulkhead.execute(slowTask);
      bulkhead.execute(slowTask);
      
      // Fill up queue
      bulkhead.execute(slowTask);
      bulkhead.execute(slowTask);
      bulkhead.execute(slowTask);
      
      // This should be rejected
      await expect(bulkhead.execute(slowTask)).rejects.toThrow('queue is full');
      
      const stats = bulkhead.getStats();
      expect(stats.totalRejected).toBe(1);
    });
  });
  
  describe('Queue Timeout', () => {
    it('should timeout queued tasks', async () => {
      const slowTask = () => new Promise(resolve => setTimeout(() => resolve('slow'), 2000));
      
      // Fill up concurrent capacity
      bulkhead.execute(slowTask);
      bulkhead.execute(slowTask);
      
      // Queue a task that will timeout
      const timeoutPromise = bulkhead.execute(slowTask);
      
      await expect(timeoutPromise).rejects.toThrow('Task timed out');
      
      const stats = bulkhead.getStats();
      expect(stats.totalTimeout).toBe(1);
    });
  });
  
  describe('Statistics', () => {
    it('should track execution statistics', async () => {
      const task = () => new Promise(resolve => setTimeout(() => resolve('done'), 50));
      
      await bulkhead.execute(task);
      await bulkhead.execute(task);
      
      const stats = bulkhead.getStats();
      expect(stats.totalExecuted).toBe(2);
      expect(stats.averageExecutionTime).toBeGreaterThan(40);
      expect(stats.averageExecutionTime).toBeLessThan(100);
    });
    
    it('should track wait time for queued tasks', async () => {
      const slowTask = () => new Promise(resolve => setTimeout(() => resolve('slow'), 100));
      const fastTask = () => Promise.resolve('fast');
      
      // Fill capacity
      bulkhead.execute(slowTask);
      bulkhead.execute(slowTask);
      
      // Queue task
      await bulkhead.execute(fastTask);
      
      const stats = bulkhead.getStats();
      expect(stats.averageWaitTime).toBeGreaterThan(50);
    });
  });
  
  describe('Drain and Reset', () => {
    it('should drain all tasks', async () => {
      const task = () => new Promise(resolve => setTimeout(() => resolve('done'), 100));
      
      const promises = [
        bulkhead.execute(task),
        bulkhead.execute(task),
        bulkhead.execute(task).catch(() => {}), // queued task might be rejected during drain
      ];
      
      await bulkhead.drain();
      
      // Wait for all promises to settle
      await Promise.allSettled(promises);
      
      const stats = bulkhead.getStats();
      expect(stats.activeCount).toBe(0);
      expect(stats.queuedCount).toBe(0);
    });
    
    it('should reset statistics', () => {
      bulkhead.reset();
      
      const stats = bulkhead.getStats();
      expect(stats.totalExecuted).toBe(0);
      expect(stats.totalRejected).toBe(0);
      expect(stats.totalTimeout).toBe(0);
    });
  });
});

describe('SemaphoreBulkhead', () => {
  let semaphore: SemaphoreBulkhead;
  
  beforeEach(() => {
    vi.clearAllMocks();
    semaphore = new SemaphoreBulkhead(2, 'test-semaphore');
  });
  
  describe('Permit Acquisition', () => {
    it('should acquire permits immediately when available', async () => {
      await semaphore.acquire();
      await semaphore.acquire();
      
      const stats = semaphore.getStats();
      expect(stats.availablePermits).toBe(0);
      expect(stats.totalAcquired).toBe(2);
    });
    
    it('should wait for permits when none available', async () => {
      // Acquire all permits
      await semaphore.acquire();
      await semaphore.acquire();
      
      // This should wait
      let acquired = false;
      const waitPromise = semaphore.acquire().then(() => { acquired = true; });
      
      // Should still be waiting
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(acquired).toBe(false);
      
      // Release one permit
      semaphore.release();
      
      // Now it should acquire
      await waitPromise;
      expect(acquired).toBe(true);
    });
    
    it('should timeout on acquisition', async () => {
      // Acquire all permits
      await semaphore.acquire();
      await semaphore.acquire();
      
      // Try to acquire with timeout
      await expect(semaphore.acquire(100)).rejects.toThrow('acquisition timed out');
      
      const stats = semaphore.getStats();
      expect(stats.totalTimeout).toBe(1);
    });
  });
  
  describe('withPermit Helper', () => {
    it('should execute function with permit', async () => {
      const task = vi.fn().mockResolvedValue('result');
      
      const result = await semaphore.withPermit(task);
      
      expect(result).toBe('result');
      expect(task).toHaveBeenCalled();
      
      // Permit should be released
      const stats = semaphore.getStats();
      expect(stats.availablePermits).toBe(2);
    });
    
    it('should release permit even on error', async () => {
      const task = vi.fn().mockRejectedValue(new Error('task error'));
      
      await expect(semaphore.withPermit(task)).rejects.toThrow('task error');
      
      // Permit should still be released
      const stats = semaphore.getStats();
      expect(stats.availablePermits).toBe(2);
    });
  });
});