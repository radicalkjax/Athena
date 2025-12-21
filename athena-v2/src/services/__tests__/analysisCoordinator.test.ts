import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analysisCoordinator } from '../analysisCoordinator';
import { mockInvoke, createMockAnalysisResult, flushPromises } from '../../test-setup';
import type { AnalysisFile } from '../../stores/analysisStore';

describe('AnalysisCoordinator', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  afterEach(() => {
    // Clean up any pending tasks
    vi.clearAllTimers();
  });

  describe('Bulkhead initialization', () => {
    it('should initialize bulkheads for all analysis types', () => {
      const queueStatus = analysisCoordinator.getQueueStatus();

      expect(queueStatus).toHaveProperty('static');
      expect(queueStatus).toHaveProperty('dynamic');
      expect(queueStatus).toHaveProperty('ai');
      expect(queueStatus).toHaveProperty('yara');
      expect(queueStatus).toHaveProperty('wasm');
    });

    it('should set correct concurrency limits for each type', () => {
      const queueStatus = analysisCoordinator.getQueueStatus();

      expect(queueStatus.static.maxConcurrent).toBe(3);
      expect(queueStatus.dynamic.maxConcurrent).toBe(1); // Resource intensive
      expect(queueStatus.ai.maxConcurrent).toBe(2);
      expect(queueStatus.yara.maxConcurrent).toBe(2);
      expect(queueStatus.wasm.maxConcurrent).toBe(2);
    });

    it('should start with empty queues', () => {
      const queueStatus = analysisCoordinator.getQueueStatus();

      Object.values(queueStatus).forEach((status: any) => {
        expect(status.queueLength).toBe(0);
        expect(status.activeCount).toBe(0);
      });
    });
  });

  describe('Task creation', () => {
    const mockFile: AnalysisFile = {
      id: 'test-file-1',
      name: 'malware.exe',
      path: '/tmp/malware.exe',
      size: 1024,
      hash: 'test-hash-123',
      type: 'application/x-executable',
      uploadedAt: Date.now(),
      status: 'pending'
    };

    it('should create tasks for all analysis types', async () => {
      mockInvoke.mockResolvedValue(createMockAnalysisResult());

      await analysisCoordinator.analyzeFile(mockFile);
      await flushPromises();

      const taskStatus = analysisCoordinator.getTaskStatus(mockFile.id);

      // Should create tasks for static, yara, wasm, and ai
      expect(taskStatus.total).toBeGreaterThanOrEqual(4);
    });

    it('should set initial task status to pending', async () => {
      mockInvoke.mockResolvedValue(createMockAnalysisResult());

      await analysisCoordinator.analyzeFile(mockFile);

      const taskStatus = analysisCoordinator.getTaskStatus(mockFile.id);
      expect(taskStatus.pending + taskStatus.running + taskStatus.completed).toBe(taskStatus.total);
    });
  });

  describe('Concurrent execution limits', () => {
    it('should respect maxConcurrent limits for static analysis', async () => {
      mockInvoke.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(createMockAnalysisResult()), 100))
      );

      // Create 5 files (more than maxConcurrent of 3)
      const files: AnalysisFile[] = Array.from({ length: 5 }, (_, i) => ({
        id: `file-${i}`,
        name: `malware-${i}.exe`,
        path: `/tmp/malware-${i}.exe`,
        size: 1024,
        hash: `hash-${i}`,
        type: 'application/x-executable',
        uploadedAt: Date.now(),
        status: 'pending' as const
      }));

      // Start analysis for all files
      await Promise.all(files.map(f => analysisCoordinator.analyzeFile(f)));
      await flushPromises();

      const queueStatus = analysisCoordinator.getQueueStatus();

      // Should have at most 3 static analyses running
      expect(queueStatus.static.activeCount).toBeLessThanOrEqual(3);
    });

    it('should queue tasks when concurrent limit is reached', async () => {
      vi.useFakeTimers();

      mockInvoke.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(createMockAnalysisResult()), 1000))
      );

      // Create 4 files (more than maxConcurrent of 3)
      const files: AnalysisFile[] = Array.from({ length: 4 }, (_, i) => ({
        id: `queue-file-${i}`,
        name: `test-${i}.exe`,
        path: `/tmp/test-${i}.exe`,
        size: 1024,
        hash: `queue-hash-${i}`,
        type: 'application/x-executable',
        uploadedAt: Date.now(),
        status: 'pending' as const
      }));

      await Promise.all(files.map(f => analysisCoordinator.analyzeFile(f)));
      await flushPromises();

      const queueStatus = analysisCoordinator.getQueueStatus();

      // Should have some tasks queued
      const totalActive = queueStatus.static.activeCount + queueStatus.static.queueLength;
      expect(totalActive).toBeGreaterThan(3);

      vi.useRealTimers();
    });
  });

  describe('Task completion', () => {
    const mockFile: AnalysisFile = {
      id: 'completion-test-file',
      name: 'test.exe',
      path: '/tmp/test.exe',
      size: 1024,
      hash: 'completion-hash',
      type: 'application/x-executable',
      uploadedAt: Date.now(),
      status: 'pending'
    };

    it('should mark tasks as completed after successful execution', async () => {
      mockInvoke.mockResolvedValue(createMockAnalysisResult());

      await analysisCoordinator.analyzeFile(mockFile);

      // Wait for tasks to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      const taskStatus = analysisCoordinator.getTaskStatus(mockFile.id);
      expect(taskStatus.completed).toBeGreaterThan(0);
    });

    it('should process queued tasks after completion', async () => {
      vi.useFakeTimers();

      let resolveCount = 0;
      mockInvoke.mockImplementation(() =>
        new Promise(resolve => {
          resolveCount++;
          setTimeout(() => resolve(createMockAnalysisResult()), 100);
        })
      );

      // Create multiple files
      const files: AnalysisFile[] = Array.from({ length: 5 }, (_, i) => ({
        id: `process-file-${i}`,
        name: `test-${i}.exe`,
        path: `/tmp/test-${i}.exe`,
        size: 1024,
        hash: `process-hash-${i}`,
        type: 'application/x-executable',
        uploadedAt: Date.now(),
        status: 'pending' as const
      }));

      await Promise.all(files.map(f => analysisCoordinator.analyzeFile(f)));
      await flushPromises();

      // Fast-forward time to allow tasks to complete
      await vi.advanceTimersByTimeAsync(2000);

      // All tasks should eventually be processed
      expect(resolveCount).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it('should handle task failures gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Analysis failed'));

      await analysisCoordinator.analyzeFile(mockFile);

      // Wait for tasks to fail
      await new Promise(resolve => setTimeout(resolve, 500));

      const taskStatus = analysisCoordinator.getTaskStatus(mockFile.id);
      expect(taskStatus.failed).toBeGreaterThan(0);
    });
  });

  describe('Resource monitoring', () => {
    it('should track active analyses', async () => {
      mockInvoke.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(createMockAnalysisResult()), 100))
      );

      const file: AnalysisFile = {
        id: 'resource-file',
        name: 'test.exe',
        path: '/tmp/test.exe',
        size: 1024,
        hash: 'resource-hash',
        type: 'application/x-executable',
        uploadedAt: Date.now(),
        status: 'pending'
      };

      await analysisCoordinator.analyzeFile(file);
      await flushPromises();

      const resourceUsage = analysisCoordinator.getResourceUsage();
      expect(resourceUsage).toHaveProperty('activeAnalyses');
      expect(resourceUsage).toHaveProperty('queuedAnalyses');
      expect(resourceUsage).toHaveProperty('bulkheadStatus');
    });

    it('should return queue status for all bulkheads', () => {
      const resourceUsage = analysisCoordinator.getResourceUsage();

      expect(resourceUsage.bulkheadStatus).toHaveProperty('static');
      expect(resourceUsage.bulkheadStatus).toHaveProperty('dynamic');
      expect(resourceUsage.bulkheadStatus).toHaveProperty('ai');
      expect(resourceUsage.bulkheadStatus).toHaveProperty('yara');
      expect(resourceUsage.bulkheadStatus).toHaveProperty('wasm');
    });
  });

  describe('Analysis cancellation', () => {
    it('should cancel all tasks for a file', async () => {
      vi.useFakeTimers();

      mockInvoke.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(createMockAnalysisResult()), 5000))
      );

      const file: AnalysisFile = {
        id: 'cancel-file',
        name: 'test.exe',
        path: '/tmp/test.exe',
        size: 1024,
        hash: 'cancel-hash',
        type: 'application/x-executable',
        uploadedAt: Date.now(),
        status: 'pending'
      };

      await analysisCoordinator.analyzeFile(file);
      await flushPromises();

      // Cancel before completion
      analysisCoordinator.cancelAnalysis(file.id);
      await flushPromises();

      const taskStatus = analysisCoordinator.getTaskStatus(file.id);

      // Tasks should be removed from queues or failed
      expect(taskStatus.running).toBe(0);

      vi.useRealTimers();
    });
  });
});
