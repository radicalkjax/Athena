/**
 * Express Server for Athena AI Services
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { json, urlencoded } from 'body-parser';
import aiRouter from './aiProviders/api/router';
import agentRouter from './agents/api/agent-endpoints';
import { initializeAIProviders } from './aiProviders';
import { logger } from '../utils/logger';
import { getCache } from './cache/redis-cache';
import { aiCacheMiddleware } from './aiProviders/cache-integration';
import { register, createMetricsMiddleware, cacheMetrics } from './monitoring/metrics';
import { getAgentManager } from './agents/agent-manager';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true
}));
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true, limit: '10mb' }));

// Metrics middleware
app.use(createMetricsMiddleware());

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Cache middleware for specific routes
app.use('/api/v1/analyze', aiCacheMiddleware(300)); // 5 minute cache
app.use('/api/v1/workflows', aiCacheMiddleware(600)); // 10 minute cache

// Routes
app.use('/api/v1', aiRouter);
app.use('/api/v1', agentRouter);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Athena AI Services',
    version: '1.0.0',
    endpoints: {
      health: '/api/v1/health',
      analyze: '/api/v1/analyze',
      workflows: '/api/v1/workflows/:agentId',
      providers: '/api/v1/providers',
      agents: '/api/v1/agents',
      metrics: '/metrics'
    }
  });
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error: unknown) {
    res.status(500).end(error);
  }
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err, path: req.path });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize Redis cache
    logger.info('Initializing Redis cache...');
    const cache = getCache();
    
    // Initialize AI providers
    logger.info('Initializing AI providers...');
    await initializeAIProviders();
    
    // Initialize Agent Manager
    logger.info('Initializing Agent Manager...');
    const agentManager = getAgentManager();
    await agentManager.initialize();
    
    // Log cache stats periodically and update metrics
    setInterval(() => {
      const stats = cache.getStats();
      logger.info('Cache statistics', stats);
      
      // Update cache metrics
      const hitRate = parseFloat(stats.hitRate.replace('%', ''));
      cacheMetrics.hitRate.set(hitRate);
    }, 60000); // Every minute
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Athena AI Services running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Redis cache enabled');
    });
    
  } catch (error: unknown) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  const cache = getCache();
  const agentManager = getAgentManager();
  await agentManager.shutdown();
  await cache.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  const cache = getCache();
  const agentManager = getAgentManager();
  await agentManager.shutdown();
  await cache.close();
  process.exit(0);
});

// Start the server
startServer();