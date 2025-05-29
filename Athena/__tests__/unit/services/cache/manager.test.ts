/**
 * Tests for the cache manager
 */

import { AnalysisCacheManager, resetCacheManager } from '@/services/cache/manager';
import { CacheConfig } from '@/services/cache/types';

describe('AnalysisCacheManager', () => {
  let cacheManager: AnalysisCacheManager;
  
  beforeEach(() => {
    resetCacheManager();
    const config: Partial<CacheConfig> = {
      maxSize: 1024 * 1024, // 1MB for testing
      ttl: 1000, // 1 second for testing
      maxEntries: 10,
      cleanupInterval: 5000,
    };
    cacheManager = new AnalysisCacheManager({ config });
  });
  
  afterEach(() => {
    cacheManager.destroy();
  });
  
  describe('Basic Operations', () => {
    it('should set and get cached values', async () => {
      const key = 'test-key';
      const value = {
        deobfuscatedCode: 'console.log("test");',
        analysisReport: 'Test report'
      };
      
      await cacheManager.set(key, value);
      const retrieved = await cacheManager.get(key);
      
      expect(retrieved).toEqual(value);
    });
    
    it('should return null for non-existent keys', async () => {
      const result = await cacheManager.get('non-existent');
      expect(result).toBeNull();
    });
    
    it('should delete cached values', async () => {
      const key = 'test-key';
      const value = { deobfuscatedCode: 'test', analysisReport: 'report' };
      
      await cacheManager.set(key, value);
      const deleted = await cacheManager.delete(key);
      expect(deleted).toBe(true);
      
      const retrieved = await cacheManager.get(key);
      expect(retrieved).toBeNull();
    });
    
    it('should clear all cached values', async () => {
      await cacheManager.set('key1', { deobfuscatedCode: 'test1', analysisReport: 'report1' });
      await cacheManager.set('key2', { deobfuscatedCode: 'test2', analysisReport: 'report2' });
      
      await cacheManager.clear();
      
      expect(await cacheManager.get('key1')).toBeNull();
      expect(await cacheManager.get('key2')).toBeNull();
    });
  });
  
  describe('Cache Key Generation', () => {
    it('should generate consistent keys for same parameters', () => {
      const params = {
        fileHash: 'abc123',
        analysisType: 'deobfuscate' as const,
      };
      
      const key1 = cacheManager.generateKey(params);
      const key2 = cacheManager.generateKey(params);
      
      expect(key1).toBe(key2);
    });
    
    it('should generate different keys for different parameters', () => {
      const params1 = {
        fileHash: 'abc123',
        analysisType: 'deobfuscate' as const,
      };
      
      const params2 = {
        fileHash: 'xyz789',
        analysisType: 'deobfuscate' as const,
      };
      
      const key1 = cacheManager.generateKey(params1);
      const key2 = cacheManager.generateKey(params2);
      
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('Cache Statistics', () => {
    it('should track cache hits and misses', async () => {
      const key = 'test-key';
      const value = { deobfuscatedCode: 'test', analysisReport: 'report' };
      
      // Initial stats
      let stats = cacheManager.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      
      // Miss
      await cacheManager.get(key);
      stats = cacheManager.getStats();
      expect(stats.misses).toBe(1);
      
      // Set value
      await cacheManager.set(key, value);
      
      // Hit
      await cacheManager.get(key);
      stats = cacheManager.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
    });
  });
  
  describe('TTL and Expiration', () => {
    it('should expire entries after TTL', async () => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      
      const key = 'test-key';
      const value = { deobfuscatedCode: 'test', analysisReport: 'report' };
      
      // Mock Date.now to return a specific time
      const startTime = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(startTime);
      
      await cacheManager.set(key, value);
      
      // Should exist immediately
      expect(await cacheManager.get(key)).toEqual(value);
      
      // Advance Date.now past TTL
      jest.spyOn(Date, 'now').mockReturnValue(startTime + 1100);
      
      // Should be expired
      expect(await cacheManager.get(key)).toBeNull();
      
      jest.useRealTimers();
    });
    
    it('should prune expired entries', async () => {
      // Mock Date.now for consistent time
      jest.useFakeTimers();
      const startTime = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(startTime);
      
      // Create a custom memory storage mock to control the behavior
      const mockStorage = {
        cache: new Map<string, any>(),
        async get(key: string) {
          return this.cache.get(key);
        },
        async set(key: string, entry: any) {
          this.cache.set(key, entry);
        },
        async delete(key: string) {
          return this.cache.delete(key);
        },
        async clear() {
          this.cache.clear();
        },
        async getKeys() {
          return Array.from(this.cache.keys());
        },
        async getSize() {
          return 100; // Mock size
        }
      };
      
      // Create cache manager with mocked storage
      cacheManager = new AnalysisCacheManager({ 
        config: { ttl: 1000 },
        storage: mockStorage as any
      });
      
      await cacheManager.set('key1', { deobfuscatedCode: 'test1', analysisReport: 'report1' });
      await cacheManager.set('key2', { deobfuscatedCode: 'test2', analysisReport: 'report2' });
      await cacheManager.set('key3', { deobfuscatedCode: 'test3', analysisReport: 'report3' });
      
      // Advance time past TTL (1 second)
      jest.spyOn(Date, 'now').mockReturnValue(startTime + 1100);
      
      // Prune should remove expired entries
      const pruned = await cacheManager.prune();
      expect(pruned).toBe(3);
      
      // Verify all entries are gone
      expect(mockStorage.cache.size).toBe(0);
      
      // Restore Date.now
      jest.useRealTimers();
    });
  });
  
  describe('Memory Management', () => {
    it('should track size and entry count correctly', async () => {
      // Test basic memory tracking without forcing eviction
      const testData = {
        deobfuscatedCode: 'a'.repeat(100),
        analysisReport: 'test report'
      };
      
      await cacheManager.set('test1', testData);
      let stats = cacheManager.getStats();
      expect(stats.entryCount).toBe(1);
      expect(stats.currentSize).toBeGreaterThan(0);
      
      await cacheManager.set('test2', testData);
      stats = cacheManager.getStats();
      expect(stats.entryCount).toBe(2);
      
      await cacheManager.delete('test1');
      stats = cacheManager.getStats();
      expect(stats.entryCount).toBe(1);
    });
    
    it('should handle cache size limits', async () => {
      const config: Partial<CacheConfig> = {
        maxSize: 1000, // Small size for testing
        ttl: 60000,
        maxEntries: 3,
      };
      const limitedCache = new AnalysisCacheManager({ config });
      
      // Add entries up to the limit
      await limitedCache.set('entry1', { 
        deobfuscatedCode: 'x'.repeat(50), 
        analysisReport: 'report1' 
      });
      
      await limitedCache.set('entry2', { 
        deobfuscatedCode: 'y'.repeat(50), 
        analysisReport: 'report2' 
      });
      
      await limitedCache.set('entry3', { 
        deobfuscatedCode: 'z'.repeat(50), 
        analysisReport: 'report3' 
      });
      
      const stats = limitedCache.getStats();
      expect(stats.entryCount).toBeLessThanOrEqual(3);
      expect(stats.currentSize).toBeLessThanOrEqual(config.maxSize!);
      
      limitedCache.destroy();
    });
  });
});