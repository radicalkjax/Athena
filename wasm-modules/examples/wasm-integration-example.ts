/**
 * Example demonstrating WASM module integration with existing TypeScript code
 */

import { analysisEngine, initializeAnalysisEngine } from '../bridge/analysis-engine-bridge';

// Example 1: Basic initialization and version check
async function exampleBasicUsage() {
  console.log('=== WASM Integration Example ===');
  
  // Initialize the WASM engine
  await initializeAnalysisEngine();
  
  // Get version
  const version = analysisEngine.getVersion();
  console.log(`Analysis Engine Version: ${version}`);
}

// Example 2: Analyze a file
async function exampleFileAnalysis() {
  console.log('\n=== File Analysis Example ===');
  
  // Simulate file content
  const suspiciousScript = `
    eval(atob('ZG9jdW1lbnQud3JpdGUoIjxzY3JpcHQ+YWxlcnQoJ1hTUycpPC9zY3JpcHQ+Iik='));
    const payload = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  `;
  
  const encoder = new TextEncoder();
  const fileContent = encoder.encode(suspiciousScript);
  
  // Analyze the content
  const result = await analysisEngine.analyze(fileContent.buffer, {
    enableDeobfuscation: true,
    maxAnalysisTime: 5000,
  });
  
  console.log('Analysis Result:', JSON.stringify(result, null, 2));
}

// Example 3: Integration with existing service pattern
class MalwareAnalysisService {
  private wasmEngine = analysisEngine;
  
  async initialize() {
    await initializeAnalysisEngine();
  }
  
  async analyzeFile(file: File): Promise<any> {
    const arrayBuffer = await file.arrayBuffer();
    
    return this.wasmEngine.analyze(arrayBuffer, {
      enableDeobfuscation: true,
      patternSets: ['javascript', 'executable'],
    });
  }
  
  getEngineInfo() {
    return {
      version: this.wasmEngine.getVersion(),
      backend: 'WASM',
      capabilities: ['deobfuscation', 'pattern-matching', 'hash-calculation'],
    };
  }
}

// Example 4: Progressive migration pattern
interface IAnalysisEngine {
  analyze(content: ArrayBuffer, options?: any): Promise<any>;
  getVersion(): string;
}

class HybridAnalysisEngine implements IAnalysisEngine {
  private useWasm: boolean = false;
  
  async initialize() {
    try {
      await initializeAnalysisEngine();
      this.useWasm = true;
      console.log('WASM engine loaded successfully');
    } catch (error: unknown) {
      console.warn('Failed to load WASM engine, falling back to JS implementation');
      this.useWasm = false;
    }
  }
  
  async analyze(content: ArrayBuffer, options?: any): Promise<any> {
    if (this.useWasm) {
      return analysisEngine.analyze(content, options);
    } else {
      // Fallback to existing JavaScript implementation
      return this.legacyAnalyze(content, options);
    }
  }
  
  getVersion(): string {
    if (this.useWasm) {
      return `WASM-${analysisEngine.getVersion()}`;
    }
    return 'JS-Legacy-1.0';
  }
  
  private async legacyAnalyze(content: ArrayBuffer, options?: any): Promise<any> {
    // Existing JavaScript implementation
    console.log('Using legacy JavaScript analyzer');
    return {
      severity: 'unknown',
      threats: [],
      metadata: {
        file_hash: 'legacy-hash',
        analysis_time_ms: 500,
        engine_version: 'legacy',
      },
    };
  }
}

// Run examples
if (require.main === module) {
  (async () => {
    try {
      await exampleBasicUsage();
      await exampleFileAnalysis();
      
      // Test service integration
      const service = new MalwareAnalysisService();
      await service.initialize();
      console.log('\nEngine Info:', service.getEngineInfo());
      
      // Test hybrid approach
      const hybrid = new HybridAnalysisEngine();
      await hybrid.initialize();
      console.log('\nHybrid Engine Version:', hybrid.getVersion());
      
    } catch (error: unknown) {
      console.error('Example failed:', error);
    }
  })();
}

export { MalwareAnalysisService, HybridAnalysisEngine };