import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { preloadService } from '../preloadService';
import { flushPromises } from '../../test-setup';

// Mock component loaders
vi.mock('../components/solid/analysis/StaticAnalysis', () => ({
  default: { name: 'StaticAnalysis' }
}));

vi.mock('../components/solid/analysis/DynamicAnalysis', () => ({
  default: { name: 'DynamicAnalysis' }
}));

vi.mock('../components/solid/analysis/AIEnsemble', () => ({
  default: { name: 'AIEnsemble' }
}));

describe('PreloadService', () => {
  beforeEach(() => {
    // Clear cache before each test
    preloadService.clearCache();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component preloading', () => {
    it('should preload component after delay', async () => {
      vi.useFakeTimers();

      preloadService.preloadComponent('static');

      // Should not be loaded immediately
      expect(preloadService.isLoaded('static')).toBe(false);

      // Advance timers past preload delay (default 100ms)
      await vi.advanceTimersByTimeAsync(150);
      await flushPromises();

      // Should be loaded now
      expect(preloadService.isLoaded('static')).toBe(true);

      vi.useRealTimers();
    });

    it('should cancel preload if requested', async () => {
      vi.useFakeTimers();

      preloadService.preloadComponent('dynamic');

      // Cancel before delay expires
      preloadService.cancelPreload('dynamic');

      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      // Should not be loaded
      expect(preloadService.isLoaded('dynamic')).toBe(false);

      vi.useRealTimers();
    });

    it('should not preload already loaded components', async () => {
      vi.useFakeTimers();

      // Load component first
      preloadService.preloadComponent('static');
      await vi.advanceTimersByTimeAsync(150);
      await flushPromises();

      expect(preloadService.isLoaded('static')).toBe(true);

      // Try to preload again
      preloadService.preloadComponent('static');
      await vi.advanceTimersByTimeAsync(150);
      await flushPromises();

      // Should still only be loaded once
      expect(preloadService.isLoaded('static')).toBe(true);

      vi.useRealTimers();
    });

    it('should not preload components already in queue', async () => {
      vi.useFakeTimers();

      preloadService.preloadComponent('ai-ensemble');

      // Try to queue same component again immediately
      preloadService.preloadComponent('ai-ensemble');

      await vi.advanceTimersByTimeAsync(150);
      await flushPromises();

      // Should only load once
      expect(preloadService.isLoaded('ai-ensemble')).toBe(true);

      vi.useRealTimers();
    });
  });

  describe('Module retrieval', () => {
    it('should return loaded module', async () => {
      vi.useFakeTimers();

      preloadService.preloadComponent('static');
      await vi.advanceTimersByTimeAsync(150);
      await flushPromises();

      const module = preloadService.getModule('static');
      expect(module).toBeDefined();
      expect(module.default).toHaveProperty('name', 'StaticAnalysis');

      vi.useRealTimers();
    });

    it('should return undefined for non-loaded module', () => {
      const module = preloadService.getModule('non-existent');
      expect(module).toBeUndefined();
    });
  });

  describe('Critical component preloading', () => {
    it('should preload critical components on startup', async () => {
      await preloadService.preloadCritical();

      // Critical components should be loaded
      expect(preloadService.isLoaded('static')).toBe(true);
      expect(preloadService.isLoaded('ai-ensemble')).toBe(true);
      expect(preloadService.isLoaded('network')).toBe(true);
    });

    it('should handle preload failures gracefully', async () => {
      // This should not throw even if some components fail to load
      await expect(preloadService.preloadCritical()).resolves.not.toThrow();
    });
  });

  describe('Cache management', () => {
    it('should clear preload cache', async () => {
      vi.useFakeTimers();

      // Load some components
      preloadService.preloadComponent('static');
      await vi.advanceTimersByTimeAsync(150);
      await flushPromises();

      expect(preloadService.isLoaded('static')).toBe(true);

      // Clear cache
      preloadService.clearCache();

      // Should no longer be loaded
      expect(preloadService.isLoaded('static')).toBe(false);

      vi.useRealTimers();
    });

    it('should cancel pending preloads when clearing cache', async () => {
      vi.useFakeTimers();

      // Start preloading but don't wait
      preloadService.preloadComponent('dynamic');

      // Clear cache immediately
      preloadService.clearCache();

      // Advance time
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      // Should not be loaded
      expect(preloadService.isLoaded('dynamic')).toBe(false);

      vi.useRealTimers();
    });
  });
});
