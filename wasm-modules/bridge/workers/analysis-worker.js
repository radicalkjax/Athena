/**
 * Web Worker for WASM Analysis Engine
 * Handles analysis in background thread to prevent UI blocking
 */

// Import WASM module
importScripts('../core/analysis-engine/pkg-web/athena_analysis_engine.js');

let engine = null;
let initialized = false;

// Initialize WASM module
async function initialize() {
  if (initialized) return;
  
  try {
    await wasm_bindgen('../core/analysis-engine/pkg-web/athena_analysis_engine_bg.wasm');
    engine = new wasm_bindgen.AnalysisEngine();
    initialized = true;
    postMessage({ type: 'initialized' });
  } catch (error) {
    postMessage({ 
      type: 'error', 
      data: { 
        message: `Worker initialization failed: ${error.message}`,
        code: 'INITIALIZATION_FAILED' 
      }
    });
  }
}

// Handle messages from main thread
self.onmessage = async function(event) {
  const { type, file, options } = event.data;
  
  switch (type) {
    case 'initialize':
      await initialize();
      break;
      
    case 'analyze':
      await analyzeFile(file, options);
      break;
      
    case 'batch':
      await batchAnalyze(event.data.files, options);
      break;
      
    default:
      postMessage({ 
        type: 'error', 
        data: { 
          message: `Unknown message type: ${type}`,
          code: 'UNKNOWN_MESSAGE' 
        }
      });
  }
};

// Analyze single file
async function analyzeFile(file, options) {
  try {
    if (!initialized) {
      await initialize();
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Report progress
    postMessage({
      type: 'progress',
      data: {
        current: 0,
        total: 1,
        currentFile: file.name,
        percentage: 0
      }
    });
    
    // Run analysis
    const result = await engine.analyze(uint8Array, options || {});
    
    // Report completion
    postMessage({
      type: 'progress',
      data: {
        current: 1,
        total: 1,
        currentFile: file.name,
        percentage: 100
      }
    });
    
    postMessage({ type: 'complete', data: result });
  } catch (error) {
    postMessage({ 
      type: 'error', 
      data: { 
        message: error.message,
        code: 'ANALYSIS_FAILED' 
      }
    });
  }
}

// Analyze multiple files
async function batchAnalyze(files, options) {
  try {
    if (!initialized) {
      await initialize();
    }
    
    const results = [];
    const total = files.length;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Report progress
      postMessage({
        type: 'progress',
        data: {
          current: i,
          total: total,
          currentFile: file.name,
          percentage: (i / total) * 100
        }
      });
      
      // Analyze file
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const result = await engine.analyze(uint8Array, options || {});
      
      results.push({
        file: file.name,
        result: result
      });
    }
    
    // Report completion
    postMessage({
      type: 'progress',
      data: {
        current: total,
        total: total,
        currentFile: 'Complete',
        percentage: 100
      }
    });
    
    postMessage({ type: 'complete', data: results });
  } catch (error) {
    postMessage({ 
      type: 'error', 
      data: { 
        message: error.message,
        code: 'BATCH_ANALYSIS_FAILED' 
      }
    });
  }
}

// Initialize on load
initialize();