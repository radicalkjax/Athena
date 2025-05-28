import IORedis from 'ioredis';
import { RedisCacheStorage } from '@/services/cache/redisStorage';
import { MemoryCacheStorage } from '@/services/cache/memoryStorage';
import { CacheEntry } from '@/services/cache/types';

// Mock ioredis
jest.mock('ioredis', () => {
  const mockRedis = {
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    info: jest.fn(),
    quit: jest.fn(),
  };

  return jest.fn(() => mockRedis);
});

// Mock logger
jest.mock('@/shared/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('RedisCacheStorage', () => {
  let redisStorage: RedisCacheStorage;
  let mockRedis: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis = new IORedis();
    redisStorage = new RedisCacheStorage({
      redis: mockRedis,
      keyPrefix: 'test:',
      fallbackToMemory: true,
    });

    // Simulate Redis connection
    const connectHandler = mockRedis.on.mock.calls.find(call => call[0] === 'connect');
    if (connectHandler && connectHandler[1]) {
      connectHandler[1](); // Call the connect handler
    }
  });

  describe('get', () => {
    it('should get value from Redis', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        value: { deobfuscatedCode: 'test code' },
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
        hits: 0,
        size: 100,
        analysisType: 'deobfuscate',
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(entry));

      const result = await redisStorage.get('test-key');
      expect(result).toEqual(entry);
      expect(mockRedis.get).toHaveBeenCalledWith('test:test-key');
    });

    it('should return null when key not found', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await redisStorage.get('non-existent');
      expect(result).toBeNull();
    });

    it('should fallback to memory storage on Redis error', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis error'));

      const result = await redisStorage.get('test-key');
      expect(result).toBeNull(); // Memory storage is empty
    });
  });

  describe('set', () => {
    it('should set value in Redis with TTL', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        value: { deobfuscatedCode: 'test code' },
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
        hits: 0,
        size: 100,
        analysisType: 'deobfuscate',
        ttl: 3600000,
      };

      await redisStorage.set('test-key', entry);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'test:test-key',
        3600,
        JSON.stringify(entry)
      );
    });

    it('should set value in Redis without TTL', async () => {
      const entry: CacheEntry = {
        key: 'test-key',
        value: { deobfuscatedCode: 'test code' },
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
        hits: 0,
        size: 100,
        analysisType: 'deobfuscate',
      };

      await redisStorage.set('test-key', entry);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'test:test-key',
        JSON.stringify(entry)
      );
    });
  });

  describe('delete', () => {
    it('should delete key from Redis', async () => {
      mockRedis.del.mockResolvedValue(1);

      await redisStorage.delete('test-key');
      expect(mockRedis.del).toHaveBeenCalledWith('test:test-key');
    });
  });

  describe('clear', () => {
    it('should clear all keys with prefix', async () => {
      mockRedis.keys.mockResolvedValue(['test:key1', 'test:key2']);
      mockRedis.del.mockResolvedValue(2);

      await redisStorage.clear();

      expect(mockRedis.keys).toHaveBeenCalledWith('test:*');
      expect(mockRedis.del).toHaveBeenCalledWith('test:key1', 'test:key2');
    });
  });

  describe('keys', () => {
    it('should return keys without prefix', async () => {
      mockRedis.keys.mockResolvedValue(['test:key1', 'test:key2']);

      const keys = await redisStorage.keys();
      expect(keys).toEqual(['key1', 'key2']);
    });
  });

  describe('sync methods', () => {
    it('should sync single key from memory to Redis', async () => {
      // Access private field through any type
      const storage = redisStorage as any;
      storage.isConnected = true;

      const entry: CacheEntry = {
        key: 'test-key',
        value: { deobfuscatedCode: 'test code' },
        timestamp: Date.now(),
        expiresAt: Date.now() + 3600000,
        hits: 0,
        size: 100,
        analysisType: 'deobfuscate',
      };

      // Set in memory storage
      if (storage.localFallback) {
        await storage.localFallback.set('test-key', entry);
      }

      await redisStorage.syncToRedis('test-key');
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      mockRedis.keys.mockResolvedValue(['test:key1', 'test:key2']);
      mockRedis.info.mockResolvedValue('used_memory:1048576\r\n');

      const stats = await redisStorage.getStats();

      expect(stats).toEqual({
        size: 2,
        isConnected: true, // Connected after simulate connection
        memoryUsage: 1048576,
        localFallbackSize: 0,
      });
    });
  });
});