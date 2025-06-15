/**
 * Minimal WASM Test Server
 * Tests WASM functionality without the cache decorator issues
 */

const express = require('express');
const cors = require('cors');
const { logger } = require('../utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'wasm-test-server',
    timestamp: new Date().toISOString()
  });
});

// WASM test endpoint
app.post('/api/v1/wasm-test', async (req, res) => {
  try {
    logger.info('Loading WASM modules...');
    
    // Load the analysis engine
    const { analysisEngine, initializeAnalysisEngine } = require('../wasm-modules/bridge/analysis-engine-bridge-enhanced');
    logger.info('Bridge module loaded');
    
    // Initialize the engine
    await initializeAnalysisEngine();
    
    logger.info('WASM Analysis Engine initialized');
    
    // Get version from the singleton instance
    const version = analysisEngine.get_version();
    
    // Test with sample content
    const testContent = new TextEncoder().encode(req.body.content || 'console.log("test");');
    const result = await analysisEngine.analyze(testContent, {
      enablePatternMatching: true,
      enableDeobfuscation: true
    });
    
    res.json({
      success: true,
      wasm: {
        version,
        initialized: true
      },
      analysis: result
    });
    
  } catch (error) {
    logger.error('WASM test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// List available WASM modules
app.get('/api/v1/wasm-modules', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const wasmModules = {};
    const coreDir = path.join(__dirname, '../wasm-modules/core');
    
    if (fs.existsSync(coreDir)) {
      const modules = fs.readdirSync(coreDir);
      modules.forEach(module => {
        const pkgPath = path.join(coreDir, module, 'pkg');
        const pkgNodePath = path.join(coreDir, module, 'pkg-node');
        const pkgWebPath = path.join(coreDir, module, 'pkg-web');
        
        wasmModules[module] = {
          hasPkg: fs.existsSync(pkgPath),
          hasPkgNode: fs.existsSync(pkgNodePath),
          hasPkgWeb: fs.existsSync(pkgWebPath)
        };
      });
    }
    
    res.json({
      modules: wasmModules,
      bridgeExists: fs.existsSync(path.join(__dirname, '../wasm-modules/bridge'))
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  logger.info(`WASM Test Server running on port ${PORT}`);
  logger.info('Available endpoints:');
  logger.info('  GET  /api/v1/health');
  logger.info('  GET  /api/v1/wasm-modules');
  logger.info('  POST /api/v1/wasm-test');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down...');
  process.exit(0);
});