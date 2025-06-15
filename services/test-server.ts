import express from 'express';
import { createClient } from 'redis';
import promClient from 'prom-client';

const app = express();
app.use(express.json());

// Redis client
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  }
});

redis.on('error', (err) => console.error('Redis error:', err));
redis.connect().then(() => console.log('✅ Redis connected'));

// Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const cacheHits = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  registers: [register]
});

const cacheMisses = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  registers: [register]
});

// Health endpoint
app.get('/api/v1/health', async (req, res) => {
  const redisStatus = redis.isReady ? 'connected' : 'disconnected';
  res.json({
    status: 'healthy',
    version: '1.0.0',
    services: {
      redis: redisStatus
    },
    timestamp: new Date().toISOString()
  });
});

// Test cache endpoint
app.post('/api/v1/test-cache', async (req, res): Promise<void> => {
  const { key, value } = req.body;
  
  try {
    // Check cache
    const cached = await redis.get(key);
    if (cached) {
      cacheHits.inc();
      res.json({
        source: 'cache',
        value: JSON.parse(cached),
        cached: true
      });
      return;
    }
    
    // Cache miss
    cacheMisses.inc();
    
    // Store in cache with 5 minute TTL
    await redis.setex(key, 300, JSON.stringify(value));
    
    res.json({
      source: 'computed',
      value,
      cached: false
    });
  } catch (error: unknown) {
    console.error('Cache error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
});