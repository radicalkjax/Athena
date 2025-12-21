import { invoke } from '@tauri-apps/api/core';
import { performanceMonitor } from './performanceMonitor';
import { memoryManager } from './memoryManager';
import type {
  WasmModule,
  WasmExecutionResult,
  WasmRuntimeStatus,
  WasmAnalysisRequest,
  WasmAnalysisResult,
  WasmMetrics
} from '../types/wasm';

class WasmService {
  private initialized = false;

  async initializeRuntime(): Promise<string> {
    try {
      const result = await invoke<string>('initialize_wasm_runtime');
      this.initialized = true;
      return result;
    } catch (error) {
      console.error('Failed to initialize WASM runtime:', error);
      throw error;
    }
  }

  async loadModule(moduleId: string, moduleBytes: Uint8Array): Promise<WasmModule> {
    if (!this.initialized) {
      await this.initializeRuntime();
    }

    return performanceMonitor.measureAsync('wasm_module_load', async () => {
      try {
        // Allocate memory for the module
        const moduleSize = moduleBytes.length;
        const allocated = memoryManager.allocate(
          `wasm_module_${moduleId}`,
          moduleSize,
          'wasm',
          `WASM module: ${moduleId}`,
          () => {
            // Cleanup callback when module is unloaded
            console.log(`Memory freed for module ${moduleId}`);
          }
        );

        if (!allocated) {
          throw new Error('Insufficient memory to load WASM module');
        }

        const result = await invoke<WasmModule>('load_wasm_module', {
          moduleId,
          moduleBytes: Array.from(moduleBytes),
        });
        return result;
      } catch (error) {
        // Deallocate on error
        memoryManager.deallocate(`wasm_module_${moduleId}`);
        console.error('Failed to load WASM module:', error);
        throw error;
      }
    });
  }

  async executeFunction(
    moduleId: string,
    functionName: string,
    args: any[]
  ): Promise<WasmExecutionResult> {
    return performanceMonitor.measureAsync('wasm_execution', async () => {
      try {
        const result = await invoke<WasmExecutionResult>('execute_wasm_function', {
          moduleId,
          functionName,
          args,
        });
        
        // Record specific function execution time
        performanceMonitor.recordMetric(
          `wasm_function_${functionName}`,
          result.execution_time_ms,
          'ms'
        );
        
        return result;
      } catch (error) {
        console.error('Failed to execute WASM function:', error);
        throw error;
      }
    });
  }

  async unloadModule(moduleId: string): Promise<string> {
    try {
      const result = await invoke<string>('unload_wasm_module', { moduleId });
      
      // Free allocated memory
      memoryManager.deallocate(`wasm_module_${moduleId}`);
      
      return result;
    } catch (error) {
      console.error('Failed to unload WASM module:', error);
      throw error;
    }
  }

  async getModules(): Promise<WasmModule[]> {
    try {
      const modules = await invoke<WasmModule[]>('get_wasm_modules');
      return modules;
    } catch (error) {
      console.error('Failed to get WASM modules:', error);
      throw error;
    }
  }

  async getMemoryUsage(): Promise<number> {
    try {
      const usage = await invoke<number>('get_wasm_memory_usage');
      return usage;
    } catch (error) {
      console.error('Failed to get WASM memory usage:', error);
      throw error;
    }
  }

  async getRuntimeStatus(): Promise<WasmRuntimeStatus> {
    try {
      const [modules, totalMemory] = await Promise.all([
        this.getModules(),
        this.getMemoryUsage(),
      ]);

      return {
        initialized: this.initialized,
        totalMemory,
        modules,
      };
    } catch (error) {
      console.error('Failed to get runtime status:', error);
      throw error;
    }
  }

  // Analysis-specific methods
  async analyzeWithWasm(request: WasmAnalysisRequest): Promise<WasmAnalysisResult> {
    const analysisId = `analysis_${Date.now()}`;
    const moduleId = `${request.analysisType}_analyzer`;

    try {
      // Load the appropriate analysis module from file
      const moduleName = await this.loadAnalysisModule(request.analysisType);
      const filePath = await this.getModulePath(moduleName);
      await this.loadModuleFromFile(moduleId, filePath);

      // Execute analysis
      const startTime = Date.now();
      const result = await this.executeFunction(moduleId, 'analyze', [
        Array.from(request.fileData),
        request.options || {},
      ]);

      const executionTime = Date.now() - startTime;

      // Parse results and create analysis result
      const analysisResult: WasmAnalysisResult = {
        analysisId,
        type: request.analysisType,
        timestamp: Date.now(),
        findings: this.parseFindings(result.output),
        metrics: {
          executionTime,
          memoryUsed: result.memory_used,
        },
      };

      // Cleanup
      await this.unloadModule(moduleId);

      return analysisResult;
    } catch (error) {
      console.error('WASM analysis failed:', error);
      throw error;
    }
  }

  async loadModuleFromFile(moduleId: string, filePath: string): Promise<WasmModule> {
    if (!this.initialized) {
      await this.initializeRuntime();
    }

    return performanceMonitor.measureAsync('wasm_module_load_from_file', async () => {
      try {
        const result = await invoke<WasmModule>('load_wasm_module_from_file', {
          moduleId,
          filePath,
        });
        return result;
      } catch (error) {
        console.error('Failed to load WASM module from file:', error);
        throw error;
      }
    });
  }

  private async getModulePath(moduleName: string): Promise<string> {
    // Get the module path from backend - this will resolve to the correct location
    // The backend knows where the WASM modules are located
    try {
      const result = await invoke<string>('get_wasm_module_path', { moduleName });
      return result;
    } catch (error) {
      // Fallback to module-relative path if command doesn't exist yet
      // The backend will resolve this relative to the project root
      return `${moduleName}/target/wasm32-wasip1/release/athena_${moduleName.replace(/-/g, '_')}.wasm`;
    }
  }

  private async loadAnalysisModule(analysisType: string): Promise<string> {
    // Map analysis types to actual WASM module names
    const modulePathMap: Record<string, string> = {
      'static': 'analysis-engine',
      'dynamic': 'sandbox',
      'network': 'network',
      'behavioral': 'analysis-engine',
      'crypto': 'crypto',
      'file-processor': 'file-processor',
      'pattern-matcher': 'pattern-matcher',
      'deobfuscator': 'deobfuscator',
    };

    const moduleName = modulePathMap[analysisType] || 'analysis-engine';

    // Return the module name - backend resolves the full path
    return moduleName;
  }

  private parseFindings(output?: string): WasmAnalysisResult['findings'] {
    if (!output) return [];

    try {
      const parsed = JSON.parse(output);
      return parsed.findings || [];
    } catch {
      return [];
    }
  }

  // Metrics tracking methods
  async getMetrics(moduleId: string): Promise<WasmMetrics> {
    try {
      const metrics = await invoke<WasmMetrics>('get_wasm_metrics', { moduleId });
      return metrics;
    } catch (error) {
      console.error(`Failed to get metrics for module ${moduleId}:`, error);
      throw error;
    }
  }

  async getAllMetrics(): Promise<Record<string, WasmMetrics>> {
    try {
      const metrics = await invoke<Record<string, WasmMetrics>>('get_all_wasm_metrics');
      return metrics;
    } catch (error) {
      console.error('Failed to get all WASM metrics:', error);
      throw error;
    }
  }

  async resetMetrics(moduleId: string): Promise<string> {
    try {
      const result = await invoke<string>('reset_wasm_metrics', { moduleId });
      return result;
    } catch (error) {
      console.error(`Failed to reset metrics for module ${moduleId}:`, error);
      throw error;
    }
  }

  async resetAllMetrics(): Promise<string> {
    try {
      const result = await invoke<string>('reset_all_wasm_metrics');
      return result;
    } catch (error) {
      console.error('Failed to reset all WASM metrics:', error);
      throw error;
    }
  }

  // Session-based execution for stateful WASM components
  async createSession(moduleId: string): Promise<SessionInfo> {
    try {
      const session = await invoke<SessionInfo>('create_wasm_session', { moduleId });
      return session;
    } catch (error) {
      console.error('Failed to create WASM session:', error);
      throw error;
    }
  }

  async executeSessionFunction(
    sessionId: string,
    functionName: string,
    args: any[]
  ): Promise<WasmExecutionResult> {
    return performanceMonitor.measureAsync('wasm_session_execution', async () => {
      try {
        const result = await invoke<WasmExecutionResult>('execute_session_function', {
          sessionId,
          functionName,
          args,
        });

        performanceMonitor.recordMetric(
          `wasm_session_function_${functionName}`,
          result.execution_time_ms,
          'ms'
        );

        return result;
      } catch (error) {
        console.error('Failed to execute session function:', error);
        throw error;
      }
    });
  }

  async destroySession(sessionId: string): Promise<string> {
    try {
      const result = await invoke<string>('destroy_wasm_session', { sessionId });
      return result;
    } catch (error) {
      console.error('Failed to destroy WASM session:', error);
      throw error;
    }
  }

  async listSessions(): Promise<SessionInfo[]> {
    try {
      const sessions = await invoke<SessionInfo[]>('list_wasm_sessions');
      return sessions;
    } catch (error) {
      console.error('Failed to list WASM sessions:', error);
      throw error;
    }
  }

  async getSessionInfo(sessionId: string): Promise<any> {
    try {
      const info = await invoke<any>('get_session_info', { sessionId });
      return info;
    } catch (error) {
      console.error('Failed to get session info:', error);
      throw error;
    }
  }

  async dropSessionResource(sessionId: string, handleId: string): Promise<string> {
    try {
      const result = await invoke<string>('drop_session_resource', {
        sessionId,
        handleId
      });
      return result;
    } catch (error) {
      console.error('Failed to drop session resource:', error);
      throw error;
    }
  }

  // High-level module bindings
  async loadCryptoModule(): Promise<CryptoModule> {
    const moduleId = 'crypto';
    const filePath = await this.getModulePath('crypto');
    await this.loadModuleFromFile(moduleId, filePath);
    return new CryptoModule(this, moduleId);
  }

  async loadFileProcessorModule(): Promise<FileProcessorModule> {
    const moduleId = 'file-processor';
    const filePath = await this.getModulePath('file-processor');
    await this.loadModuleFromFile(moduleId, filePath);
    return new FileProcessorModule(this, moduleId);
  }

  async loadAnalysisEngineModule(): Promise<AnalysisEngineModule> {
    const moduleId = 'analysis-engine';
    const filePath = await this.getModulePath('analysis-engine');
    await this.loadModuleFromFile(moduleId, filePath);
    return new AnalysisEngineModule(this, moduleId);
  }

  async loadPatternMatcherModule(): Promise<PatternMatcherModule> {
    const moduleId = 'pattern-matcher';
    const filePath = await this.getModulePath('pattern-matcher');
    await this.loadModuleFromFile(moduleId, filePath);
    return new PatternMatcherModule(this, moduleId);
  }

  async loadNetworkModule(): Promise<NetworkModule> {
    const moduleId = 'network';
    const filePath = await this.getModulePath('network');
    await this.loadModuleFromFile(moduleId, filePath);
    return new NetworkModule(this, moduleId);
  }

  async loadSandboxModule(): Promise<SandboxModule> {
    const moduleId = 'sandbox';
    const filePath = await this.getModulePath('sandbox');
    await this.loadModuleFromFile(moduleId, filePath);
    return new SandboxModule(this, moduleId);
  }

  async loadDeobfuscatorModule(): Promise<DeobfuscatorModule> {
    const moduleId = 'deobfuscator';
    const filePath = await this.getModulePath('deobfuscator');
    await this.loadModuleFromFile(moduleId, filePath);
    return new DeobfuscatorModule(this, moduleId);
  }
}

// Session info interface
interface SessionInfo {
  session_id: string;
  module_id: string;
  created_at: string;
}

// Base class for WASM module bindings
class WasmModuleBinding {
  constructor(
    protected service: WasmService,
    protected moduleId: string
  ) {}

  protected async execute(functionName: string, ...args: any[]): Promise<any> {
    const result = await this.service.executeFunction(this.moduleId, functionName, args);
    if (!result.success) {
      throw new Error(result.error || 'Function execution failed');
    }
    return result.output ? JSON.parse(result.output) : null;
  }

  async unload(): Promise<void> {
    await this.service.unloadModule(this.moduleId);
  }
}

// Crypto module bindings
class CryptoModule extends WasmModuleBinding {
  // Hash functions
  async sha256(data: Uint8Array): Promise<string> {
    return this.execute('sha256', Array.from(data));
  }

  async sha256Base64(data: Uint8Array): Promise<string> {
    return this.execute('sha256-base64', Array.from(data));
  }

  async sha512(data: Uint8Array): Promise<string> {
    return this.execute('sha512', Array.from(data));
  }

  async md5(data: Uint8Array): Promise<string> {
    return this.execute('md5', Array.from(data));
  }

  // HMAC functions
  async hmacSha256(key: Uint8Array, data: Uint8Array): Promise<string> {
    return this.execute('hmac-sha256', Array.from(key), Array.from(data));
  }

  async verifyHmac(key: Uint8Array, data: Uint8Array, expectedHmac: string): Promise<boolean> {
    return this.execute('verify-hmac', Array.from(key), Array.from(data), expectedHmac);
  }

  // Utility functions
  async generateRandomBytes(length: number): Promise<Uint8Array> {
    const result = await this.execute('generate-random-bytes', length);
    return new Uint8Array(result);
  }

  async base64Encode(data: Uint8Array): Promise<string> {
    return this.execute('base64-encode', Array.from(data));
  }

  async base64Decode(encoded: string): Promise<Uint8Array> {
    const result = await this.execute('base64-decode', encoded);
    return new Uint8Array(result);
  }
}

// File Processor module bindings
class FileProcessorModule extends WasmModuleBinding {
  async detectFormat(buffer: Uint8Array, filename?: string): Promise<string> {
    return this.execute('detect-format', Array.from(buffer), filename || null);
  }

  async isTextFile(buffer: Uint8Array): Promise<boolean> {
    return this.execute('is-text-file', Array.from(buffer));
  }

  async parseFile(buffer: Uint8Array, formatHint?: string): Promise<any> {
    return this.execute('parse-file', Array.from(buffer), formatHint || null);
  }

  async extractMetadata(buffer: Uint8Array, format: string): Promise<any> {
    return this.execute('extract-metadata', Array.from(buffer), format);
  }

  async extractStrings(buffer: Uint8Array, minLength: number = 4): Promise<any[]> {
    return this.execute('extract-strings', Array.from(buffer), minLength);
  }

  async extractSuspiciousPatterns(content: string): Promise<any[]> {
    return this.execute('extract-suspicious-patterns', content);
  }

  async validateFile(buffer: Uint8Array, format: string): Promise<any> {
    return this.execute('validate-file', Array.from(buffer), format);
  }
}

// Analysis Engine module bindings
class AnalysisEngineModule extends WasmModuleBinding {
  async analyze(content: Uint8Array): Promise<any> {
    return this.execute('analyze', Array.from(content));
  }

  async getVersion(): Promise<string> {
    return this.execute('get-version');
  }

  async disassemble(code: Uint8Array, offset: number, options: any): Promise<any> {
    return this.execute('disassemble', Array.from(code), offset, options);
  }

  async analyzeControlFlow(code: Uint8Array, entryPoint: number, arch: string): Promise<any> {
    return this.execute('analyze-control-flow', Array.from(code), entryPoint, arch);
  }

  async findFunctions(code: Uint8Array, entryPoints: number[], arch: string): Promise<any> {
    return this.execute('find-functions', Array.from(code), entryPoints, arch);
  }

  async deobfuscate(content: string, options?: any): Promise<any> {
    return this.execute('deobfuscate', content, options || null);
  }

  async isObfuscated(content: string): Promise<boolean> {
    return this.execute('is-obfuscated', content);
  }
}

// Pattern Matcher module bindings
class PatternMatcherModule extends WasmModuleBinding {
  async scan(content: Uint8Array): Promise<any[]> {
    return this.execute('scan', Array.from(content));
  }

  async scanWithRules(content: Uint8Array, rules: string): Promise<any[]> {
    return this.execute('scan-with-rules', Array.from(content), rules);
  }

  async compileRules(rulesText: string): Promise<string> {
    return this.execute('compile-rules', rulesText);
  }

  async getStats(): Promise<any> {
    return this.execute('get-stats');
  }
}

// Network module bindings
class NetworkModule extends WasmModuleBinding {
  async parseDns(packet: Uint8Array): Promise<any> {
    return this.execute('parse-dns', Array.from(packet));
  }

  async parseHttp(data: Uint8Array): Promise<any> {
    return this.execute('parse-http', Array.from(data));
  }

  async extractUrls(content: string): Promise<string[]> {
    return this.execute('extract-urls', content);
  }

  async analyzeTraffic(packets: Uint8Array[]): Promise<any> {
    return this.execute('analyze-traffic', packets.map(p => Array.from(p)));
  }
}

// Sandbox module bindings
class SandboxModule extends WasmModuleBinding {
  async executeSandboxed(code: Uint8Array, options?: any): Promise<any> {
    return this.execute('execute-sandboxed', Array.from(code), options || null);
  }

  async getExecutionLog(): Promise<any[]> {
    return this.execute('get-execution-log');
  }

  async terminateExecution(): Promise<void> {
    await this.execute('terminate-execution');
  }
}

// Deobfuscator module bindings
class DeobfuscatorModule extends WasmModuleBinding {
  async deobfuscate(content: string, options?: any): Promise<any> {
    return this.execute('deobfuscate', content, options || null);
  }

  async isObfuscated(content: string): Promise<boolean> {
    return this.execute('is-obfuscated', content);
  }

  async detectObfuscationTechniques(content: string): Promise<string[]> {
    return this.execute('detect-obfuscation-techniques', content);
  }
}

export const wasmService = new WasmService();

// Export module binding classes
export {
  CryptoModule,
  FileProcessorModule,
  AnalysisEngineModule,
  PatternMatcherModule,
  NetworkModule,
  SandboxModule,
  DeobfuscatorModule,
};