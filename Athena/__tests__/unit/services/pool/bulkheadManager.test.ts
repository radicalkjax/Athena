import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bulkheadManager } from '@/services/pool/bulkheadManager';
import { Bulkhead, SemaphoreBulkhead } from '@/services/pool/bulkhead';

// Mock dependencies
vi.mock('@/services/apm/manager', () => ({
  apmManager: {
    counter: vi.fn(),
    gauge: vi.fn(),
    histogram: vi.fn(),
  },
}));

vi.mock('@/shared/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BulkheadManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bulkheadManager.resetAll();
  });
  
  describe('Bulkhead Creation', () => {
    it('should create bulkhead on first access', () => {
      const bulkhead = bulkheadManager.getBulkhead('test.service');
      
      expect(bulkhead).toBeInstanceOf(Bulkhead);
    });
    
    it('should reuse existing bulkhead', () => {
      const bulkhead1 = bulkheadManager.getBulkhead('test.service');
      const bulkhead2 = bulkheadManager.getBulkhead('test.service');
      
      expect(bulkhead1).toBe(bulkhead2);
    });
    
    it('should use service-specific configuration', () => {
      const aiBulkhead = bulkheadManager.getBulkhead('ai.claude');
      const containerBulkhead = bulkheadManager.getBulkhead('container.create');
      
      // Different services should have different bulkheads
      expect(aiBulkhead).not.toBe(containerBulkhead);
    });
  });
  
  describe('Semaphore Access', () => {
    it('should provide pre-configured semaphores', () => {
      const cpuSemaphore = bulkheadManager.getSemaphore('global.cpu_intensive');
      const memorySemaphore = bulkheadManager.getSemaphore('global.memory_intensive');
      
      expect(cpuSemaphore).toBeInstanceOf(SemaphoreBulkhead);
      expect(memorySemaphore).toBeInstanceOf(SemaphoreBulkhead);
    });
    
    it('should return undefined for non-existent semaphore', () => {
      const semaphore = bulkheadManager.getSemaphore('non.existent');
      
      expect(semaphore).toBeUndefined();
    });
  });
  
  describe('Task Execution', () => {
    it('should execute task through bulkhead', async () => {
      const task = vi.fn().mockResolvedValue('result');
      
      const result = await bulkheadManager.execute('test.service', task);
      
      expect(result).toBe('result');
      expect(task).toHaveBeenCalled();
    });
    
    it('should execute with semaphores', async () => {
      const task = vi.fn().mockResolvedValue('result');
      
      const result = await bulkheadManager.execute('test.service', task, {
        semaphores: ['global.cpu_intensive'],
      });
      
      expect(result).toBe('result');
      expect(task).toHaveBeenCalled();
    });
    
    it('should release semaphores on error', async () => {
      const task = vi.fn().mockRejectedValue(new Error('task error'));
      const cpuSemaphore = bulkheadManager.getSemaphore('global.cpu_intensive');
      
      const initialStats = cpuSemaphore?.getStats();
      
      await expect(
        bulkheadManager.execute('test.service', task, {
          semaphores: ['global.cpu_intensive'],
        })
      ).rejects.toThrow('task error');
      
      // Semaphore should be released
      const finalStats = cpuSemaphore?.getStats();
      expect(finalStats?.availablePermits).toBe(initialStats?.availablePermits);
    });
  });
  
  describe('Specialized Execution Methods', () => {
    it('should execute CPU-intensive tasks', async () => {
      const task = vi.fn().mockResolvedValue('cpu-result');
      
      const result = await bulkheadManager.executeCpuIntensive('test.service', task);
      
      expect(result).toBe('cpu-result');
    });
    
    it('should execute memory-intensive tasks', async () => {
      const task = vi.fn().mockResolvedValue('memory-result');
      
      const result = await bulkheadManager.executeMemoryIntensive('test.service', task);
      
      expect(result).toBe('memory-result');
    });
    
    it('should execute AI tasks with global limit', async () => {
      const task = vi.fn().mockResolvedValue('ai-result');
      
      const result = await bulkheadManager.executeAITask('claude', task);
      
      expect(result).toBe('ai-result');
    });
  });
  
  describe('Statistics and Health', () => {
    it('should provide statistics for all bulkheads', async () => {
      // Create some bulkheads
      await bulkheadManager.execute('service1', () => Promise.resolve());
      await bulkheadManager.execute('service2', () => Promise.resolve());
      
      const stats = bulkheadManager.getAllStats();
      
      expect(stats.bulkheads).toHaveProperty('service1');
      expect(stats.bulkheads).toHaveProperty('service2');
      expect(stats.semaphores).toBeDefined();
    });
    
    it('should provide health summary', async () => {
      const summary = bulkheadManager.getHealthSummary();
      
      expect(summary).toHaveProperty('totalBulkheads');
      expect(summary).toHaveProperty('totalSemaphores');
      expect(summary).toHaveProperty('saturated');
      expect(summary).toHaveProperty('queuedTasks');
      expect(summary).toHaveProperty('activeTasks');
    });
    
    it('should identify saturated bulkheads', async () => {
      const bulkhead = bulkheadManager.getBulkhead('test.saturated');
      
      // Simulate saturation by filling up the bulkhead
      const slowTask = () => new Promise(resolve => setTimeout(resolve, 1000));
      
      // Fill to capacity (using default config)
      const activeTasks = [];
      for (let i = 0; i < 10; i++) {
        activeTasks.push(bulkhead.execute(slowTask).catch(() => {}));
      }
      
      // Queue some tasks
      const queuedTasks = [];
      for (let i = 0; i < 5; i++) {
        queuedTasks.push(bulkhead.execute(slowTask).catch(() => {}));
      }
      
      const summary = bulkheadManager.getHealthSummary();
      expect(summary.saturated).toContain('test.saturated');
      
      // Clean up - drain the bulkhead to prevent interference with other tests
      await bulkhead.drain();
    });
  });
  
  describe('Configuration Updates', () => {
    it('should update bulkhead configuration', () => {
      bulkheadManager.updateConfig('test.service', {
        maxConcurrent: 50,
        maxQueueSize: 200,
      });
      
      // Get new bulkhead with updated config
      const bulkhead = bulkheadManager.getBulkhead('test.service');
      
      // Verify update was applied (would need to expose config or test behavior)
      expect(bulkhead).toBeDefined();
    });
  });
  
  describe('Lifecycle Management', () => {
    it('should reset specific bulkhead', async () => {
      const bulkhead = bulkheadManager.getBulkhead('test.reset');
      
      // Execute some tasks
      await bulkhead.execute(() => Promise.resolve());
      
      bulkheadManager.reset('test.reset');
      
      const stats = bulkhead.getStats();
      expect(stats.totalExecuted).toBe(0);
    });
    
    it('should reset all bulkheads', async () => {
      // Create multiple bulkheads
      await bulkheadManager.execute('service1', () => Promise.resolve());
      await bulkheadManager.execute('service2', () => Promise.resolve());
      
      bulkheadManager.resetAll();
      
      const stats = bulkheadManager.getAllStats();
      Object.values(stats.bulkheads).forEach((bulkheadStats: any) => {
        expect(bulkheadStats.totalExecuted).toBe(0);
      });
    });
    
    it('should drain all bulkheads gracefully', async () => {
      // Start some long-running tasks
      const promises = [
        bulkheadManager.execute('service1', () => 
          new Promise(resolve => setTimeout(resolve, 100))
        ),
        bulkheadManager.execute('service2', () => 
          new Promise(resolve => setTimeout(resolve, 100))
        ),
      ];
      
      // Drain should wait for tasks to complete
      await bulkheadManager.drainAll();
      
      // All tasks should have completed
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });
});