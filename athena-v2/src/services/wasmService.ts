import { invoke } from '@tauri-apps/api/core';
import { performanceMonitor } from './performanceMonitor';
import { memoryManager } from './memoryManager';
import type { 
  WasmModule, 
  WasmExecutionResult, 
  WasmRuntimeStatus,
  WasmAnalysisRequest,
  WasmAnalysisResult
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
      // Load the appropriate analysis module
      const analyzerModule = await this.loadAnalysisModule(request.analysisType);
      await this.loadModule(moduleId, analyzerModule);

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

  private async loadAnalysisModule(analysisType: string): Promise<Uint8Array> {
    // In a real implementation, this would load the actual WASM module
    // For now, return a placeholder
    const placeholderModule = new Uint8Array([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ]);
    return placeholderModule;
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
}

export const wasmService = new WasmService();