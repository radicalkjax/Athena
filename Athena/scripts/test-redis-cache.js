#!/usr/bin/env node

/**
 * Test script for Redis cache integration
 */

const IORedis = require('ioredis');

async function testRedisConnection() {
  console.log('🔧 Testing Redis cache connection...\n');

  const redis = new IORedis({
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: 3,
  });

  try {
    // Test ping
    const pong = await redis.ping();
    console.log('✅ Redis ping:', pong);

    // Test set/get
    await redis.set('test:key', JSON.stringify({ value: 'Hello Redis!' }));
    const value = await redis.get('test:key');
    console.log('✅ Redis get:', JSON.parse(value));

    // Test TTL
    await redis.setex('test:ttl', 5, 'expires in 5 seconds');
    const ttl = await redis.ttl('test:ttl');
    console.log(`✅ Redis TTL: ${ttl} seconds`);

    // Test memory info
    const info = await redis.info('memory');
    const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
    if (memoryMatch) {
      console.log(`✅ Redis memory usage: ${memoryMatch[1]}`);
    }

    // Clean up
    await redis.del('test:key', 'test:ttl');
    console.log('✅ Test keys cleaned up');

    console.log('\n🎉 Redis cache is working correctly!');
    
    await redis.quit();
    process.exit(0);
  } catch (error) {
    console.error('❌ Redis error:', error.message);
    await redis.quit();
    process.exit(1);
  }
}

testRedisConnection();