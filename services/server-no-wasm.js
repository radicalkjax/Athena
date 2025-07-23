/**
 * Express Server for Athena AI Services - No WASM Version
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { json, urlencoded } = require('body-parser');

// Mock the WASM preprocessor when disabled
if (process.env.DISABLE_WASM === 'true') {
  console.log('WASM modules disabled - using mock preprocessor');
  require.cache[require.resolve('./aiProviders/preprocessing/wasmPipeline')] = {
    exports: {
      wasmPreprocessor: {
        validateAndClean: async (input) => ({ 
          success: true, 
          data: input,
          metadata: { wasmDisabled: true }
        }),
        initialize: async () => console.log('Mock WASM preprocessor initialized')
      }
    }
  };
}

const aiRouter = require('./aiProviders/api/router').default;
const agentRouter = require('./agents/api/agent-endpoints').default;
const { initializeAIProviders } = require('./aiProviders');
const { logger } = require('../utils/logger');
const { getCache } = require('./cache/redis-cache');
const { aiCacheMiddleware } = require('./aiProviders/cache-integration');
const { register, createMetricsMiddleware, cacheMetrics } = require('./monitoring/metrics');
const { getAgentManager } = require('./agents/agent-manager');

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
app.get('/', (req, res) => {
  res.json({
    service: 'Athena AI Service',
    version: '1.0.0',
    status: 'operational',
    wasmEnabled: process.env.DISABLE_WASM !== 'true'
  });
});

// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
  try {
    const cache = getCache();
    const cacheConnected = await cache.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'operational',
        cache: cacheConnected ? 'connected' : 'disconnected',
        wasm: process.env.DISABLE_WASM !== 'true' ? 'enabled' : 'disabled'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// API documentation redirect
app.get('/api-docs', (req, res) => {
  res.redirect('/api/v1/openapi.json');
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    // Update cache metrics before serving
    const cache = getCache();
    const stats = await cache.getStats();
    cacheMetrics.hits.set(stats.hits);
    cacheMetrics.misses.set(stats.misses);
    cacheMetrics.size.set(stats.size);
    
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Initialize services and start server
async function startServer() {
  try {
    // Initialize AI providers
    await initializeAIProviders();
    logger.info('AI providers initialized');
    
    // Initialize cache
    const cache = getCache();
    await cache.connect();
    logger.info('Cache connected');
    
    // Initialize agent manager
    const agentManager = getAgentManager();
    await agentManager.initialize();
    logger.info('Agent manager initialized');
    
    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`WASM: ${process.env.DISABLE_WASM !== 'true' ? 'enabled' : 'disabled'}`);
      logger.info(`Metrics available at http://localhost:${PORT}/metrics`);
    });
    
    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      
      await cache.disconnect();
      logger.info('Cache disconnected');
      
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();