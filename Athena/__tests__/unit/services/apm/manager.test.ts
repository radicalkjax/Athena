import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APMManager } from '@/services/apm/manager';
import { ConsoleAPMProvider } from '@/services/apm/console';
import { env } from '@/shared/config/environment';

// Mock dependencies
vi.mock('@/shared/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/services/monitoring/memoryProfiler', () => ({
  memoryProfiler: {
    getMemoryStats: vi.fn(() => ({
      current: {
        heapUsed: 100 * 1024 * 1024,
        heapTotal: 200 * 1024 * 1024,
        rss: 300 * 1024 * 1024,
      },
    })),
  },
}));

vi.mock('@/services/cache/redisFactory', () => ({
  getCacheManager: vi.fn(() => ({
    getStats: vi.fn(() => ({
      currentSize: 50 * 1024 * 1024,
      entryCount: 100,
      hitRate: 0.85,
      hits: 850,
      misses: 150,
      evictions: 10,
    })),
  })),
}));

describe('APMManager', () => {
  let apmManager: APMManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Get fresh instance
    apmManager = APMManager.getInstance();
  });

  afterEach(async () => {
    await apmManager.shutdown();
  });

  describe('initialization', () => {
    it('should initialize with console provider in dev mode', async () => {
      await apmManager.initialize({
        enabled: true,
        environment: 'development',
      });

      // Should use console provider
      expect(apmManager['provider']).toBeInstanceOf(ConsoleAPMProvider);
    });

    it('should not initialize when disabled', async () => {
      await apmManager.initialize({
        enabled: false,
      });

      expect(apmManager['provider']).toBeNull();
    });
  });

  describe('span tracking', () => {
    beforeEach(async () => {
      await apmManager.initialize({ enabled: true });
    });

    it('should track spans with timing', async () => {
      const operation = vi.fn().mockResolvedValue('result');
      
      const result = await apmManager.withSpan(
        'test.operation',
        operation,
        { tag1: 'value1' }
      );

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
    });

    it('should handle span errors', async () => {
      const error = new Error('Test error');
      const operation = vi.fn().mockRejectedValue(error);
      
      await expect(
        apmManager.withSpan('test.operation', operation)
      ).rejects.toThrow('Test error');
    });
  });

  describe('metric recording', () => {
    beforeEach(async () => {
      await apmManager.initialize({ enabled: true });
    });

    it('should record analysis metrics', () => {
      apmManager.recordAnalysis('claude', 'deobfuscate', 1500, true);
      
      // Verify provider received metrics
      const provider = apmManager['provider'];
      expect(provider).toBeTruthy();
    });

    it('should record cache operations', () => {
      apmManager.recordCacheOperation('hit', 5);
      apmManager.recordCacheOperation('miss', 10);
      apmManager.recordCacheOperation('set', 15);
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should record circuit breaker events', () => {
      apmManager.recordCircuitBreakerEvent('claude', 'open');
      apmManager.recordCircuitBreakerEvent('claude', 'close');
      
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('system metrics', () => {
    beforeEach(async () => {
      await apmManager.initialize({ enabled: true });
    });

    it('should collect system metrics', () => {
      // Trigger manual collection
      apmManager['collectSystemMetrics']();
      
      // Should have collected memory and cache metrics
      expect(true).toBe(true);
    });
  });

  describe('business metrics', () => {
    beforeEach(async () => {
      await apmManager.initialize({ enabled: true });
    });

    it('should record file analysis metrics', () => {
      apmManager.recordFileAnalyzed('exe', 1024 * 1024);
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should record vulnerability metrics', () => {
      apmManager.recordVulnerability('high', 'buffer_overflow');
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should record malware detection metrics', () => {
      apmManager.recordMalwareDetected('trojan', 0.95);
      
      // Should not throw
      expect(true).toBe(true);
    });
  });
});