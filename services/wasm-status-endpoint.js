/**
 * WASM Status Endpoint
 * Adds a simple endpoint to check WASM module status
 */

const express = require('express');
const router = express.Router();

// WASM status endpoint
router.get('/status/wasm', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Check WASM modules
    const wasmModules = {};
    const coreDir = path.join(__dirname, '../wasm-modules/core');
    
    if (fs.existsSync(coreDir)) {
      const modules = fs.readdirSync(coreDir);
      for (const module of modules) {
        const pkgPath = path.join(coreDir, module, 'pkg');
        const pkgNodePath = path.join(coreDir, module, 'pkg-node');
        const pkgWebPath = path.join(coreDir, module, 'pkg-web');
        
        wasmModules[module] = {
          hasPkg: fs.existsSync(pkgPath),
          hasPkgNode: fs.existsSync(pkgNodePath),
          hasPkgWeb: fs.existsSync(pkgWebPath)
        };
        
        // Check for WASM files
        const wasmFiles = [];
        for (const dir of [pkgPath, pkgNodePath, pkgWebPath]) {
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.wasm'));
            wasmFiles.push(...files);
          }
        }
        wasmModules[module].wasmFiles = [...new Set(wasmFiles)];
      }
    }
    
    // Test WASM loading
    let wasmTestResult = {};
    try {
      const { analysisEngine, initializeAnalysisEngine } = require('../wasm-modules/bridge/analysis-engine-bridge-enhanced');
      await initializeAnalysisEngine();
      const version = analysisEngine.get_version();
      
      wasmTestResult = {
        initialized: true,
        version,
        canAnalyze: typeof analysisEngine.analyze === 'function'
      };
    } catch (error) {
      wasmTestResult = {
        initialized: false,
        error: error.message
      };
    }
    
    res.json({
      status: 'ok',
      wasmModules,
      wasmTest: wasmTestResult,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
    
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;