/**
 * Enhanced TypeScript bridge for the WASM Analysis Engine
 * Provides comprehensive type safety and error handling
 */

import {
  IAnalysisEngine,
  AnalysisOptions,
  AnalysisResult,
  DeobfuscationResult,
  PatternMatch,
  WASMError,
  WASMErrorCode,
  AnalysisResultType,
  EngineConfig,
  PerformanceMetrics,
  AnalysisEventHandlers,
  AnalysisProgress,
  MAX_FILE_SIZE,
  DEFAULT_TIMEOUT
} from './types';
import { isBrowser } from './wasm-error-codes';
import { wasmTypeMarshaler } from './type-marshaling';

class AnalysisEngineBridge implements IAnalysisEngine {
  private engine: any;
  private wasmModule: any;
  private isInitialized = false;
  private config: EngineConfig;
  private initPromise?: Promise<void>;
  private performanceMetrics: Partial<PerformanceMetrics> = {};

  constructor(config: EngineConfig = {}) {
    this.config = {
      maxFileSize: MAX_FILE_SIZE,
      timeout: DEFAULT_TIMEOUT,
      workerPool: false,
      workerCount: 4,
      cacheResults: true,
      logLevel: 'info',
      ...config
    };
  }

  async initialize(): Promise<void> {
    // Return existing initialization promise if already in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    const startTime = performance.now();

    try {
      this.log('info', 'Initializing WASM Analysis Engine...');

      if (isBrowser) {
        // Dynamic import for web
        this.wasmModule = await import('../core/analysis-engine/pkg-web/athena_analysis_engine');
        await this.wasmModule.default();
        this.engine = new this.wasmModule.AnalysisEngine();
      } else {
        // Node.js import - use pkg-node which should be CommonJS compatible
        this.wasmModule = require('../core/analysis-engine/pkg-node/athena_analysis_engine');
        this.engine = new this.wasmModule.AnalysisEngine();
      }
      
      this.isInitialized = true;
      this.performanceMetrics.initializationTime = performance.now() - startTime;
      
      this.log('info', `Analysis Engine initialized: v${this.get_version()} in ${this.performanceMetrics.initializationTime.toFixed(2)}ms`);
    } catch (error: unknown) {
      this.log('error', 'Failed to initialize WASM Analysis Engine:', error);
      throw new WASMError(
        `WASM initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        WASMErrorCode.InitializationFailed
      );
    } finally {
      this.initPromise = undefined;
    }
  }

  get_version(): string {
    this.ensureInitialized();
    return this.engine.get_version();
  }

  async analyze(
    content: Uint8Array,
    options: AnalysisOptions = {},
    eventHandlers?: AnalysisEventHandlers
  ): Promise<AnalysisResult> {
    await this.ensureInitializedAsync();
    
    // Validate input
    if (!content || content.length === 0) {
      throw new WASMError('Content cannot be empty', WASMErrorCode.InvalidInput);
    }

    if (content.length > this.config.maxFileSize!) {
      throw new WASMError(
        `File size exceeds maximum allowed size of ${this.config.maxFileSize! / 1024 / 1024}MB`,
        WASMErrorCode.InvalidInput
      );
    }

    const startTime = performance.now();
    eventHandlers?.onStart?.({ type: 'start', timestamp: Date.now() });

    try {
      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new WASMError('Analysis timeout exceeded', WASMErrorCode.TimeoutError));
        }, options.maxAnalysisTime || this.config.timeout!);
      });

      // Marshal options for WASM
      const marshaledOptions = wasmTypeMarshaler.marshal(options || {});
      
      // Run analysis with timeout
      const analysisPromise = this.engine.analyze(content, marshaledOptions);
      const wasmResult = await Promise.race([analysisPromise, timeoutPromise]);
      
      // Unmarshal result from WASM
      const result = wasmTypeMarshaler.unmarshalAnalysisResult(wasmResult);

      this.performanceMetrics.analysisTime = performance.now() - startTime;
      this.performanceMetrics.throughput = (content.length / 1024 / 1024) / (this.performanceMetrics.analysisTime / 1000);

      eventHandlers?.onComplete?.(result);
      
      this.log('debug', `Analysis completed in ${this.performanceMetrics.analysisTime.toFixed(2)}ms`);
      
      return result;
    } catch (error: unknown) {
      const wasmError = this.wrapError(error, WASMErrorCode.AnalysisFailed);
      eventHandlers?.onError?.(wasmError);
      throw wasmError;
    }
  }

  async deobfuscate(content: string): Promise<DeobfuscationResult> {
    await this.ensureInitializedAsync();
    
    if (!content || content.trim().length === 0) {
      throw new WASMError('Content cannot be empty', WASMErrorCode.InvalidInput);
    }

    const startTime = performance.now();

    try {
      const wasmResult = await this.engine.deobfuscate(content);
      this.performanceMetrics.deobfuscationTime = performance.now() - startTime;
      
      // Unmarshal result from WASM
      const result = wasmTypeMarshaler.unmarshalDeobfuscationResult(wasmResult);
      
      this.log('debug', `Deobfuscation completed in ${this.performanceMetrics.deobfuscationTime.toFixed(2)}ms`);
      
      return result;
    } catch (error: unknown) {
      throw this.wrapError(error, WASMErrorCode.DeobfuscationFailed);
    }
  }

  async scan_patterns(content: Uint8Array): Promise<PatternMatch[]> {
    await this.ensureInitializedAsync();
    
    if (!content || content.length === 0) {
      throw new WASMError('Content cannot be empty', WASMErrorCode.InvalidInput);
    }

    const startTime = performance.now();

    try {
      const wasmResult = await this.engine.scan_patterns(content);
      this.performanceMetrics.patternScanTime = performance.now() - startTime;
      
      // Unmarshal result from WASM
      const result = (wasmResult as any[]).map(match => 
        wasmTypeMarshaler.unmarshalPatternMatch(match)
      );
      
      this.log('debug', `Pattern scan completed in ${this.performanceMetrics.patternScanTime.toFixed(2)}ms`);
      
      return result;
    } catch (error: unknown) {
      throw this.wrapError(error, WASMErrorCode.PatternScanFailed);
    }
  }

  // Additional utility methods

  async analyzeFile(file: File, options?: AnalysisOptions): Promise<AnalysisResult> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    return this.analyze(uint8Array, options);
  }

  async analyzeString(content: string, options?: AnalysisOptions): Promise<AnalysisResult> {
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(content);
    return this.analyze(uint8Array, options);
  }

  async batchAnalyze(
    files: File[],
    options?: AnalysisOptions,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      if (onProgress) {
        onProgress({
          current: i + 1,
          total,
          currentFile: file.name,
          percentage: ((i + 1) / total) * 100
        });
      }

      try {
        const result = await this.analyzeFile(file, options);
        results.push(result);
      } catch (error: unknown) {
        // Include error in results but continue processing
        this.log('error', `Failed to analyze file ${file.name}:`, error);
        results.push({
          severity: 'critical',
          threats: [{
            threat_type: 'AnalysisError',
            confidence: 1.0,
            description: `Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`,
            indicators: []
          }],
          metadata: {
            file_hash: '',
            analysis_time_ms: 0,
            engine_version: this.get_version()
          }
        });
      }
    }

    return results;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    const totalTime = Object.values(this.performanceMetrics)
      .filter(v => typeof v === 'number')
      .reduce((sum, time) => sum + time, 0);

    return {
      initializationTime: this.performanceMetrics.initializationTime || 0,
      analysisTime: this.performanceMetrics.analysisTime || 0,
      deobfuscationTime: this.performanceMetrics.deobfuscationTime || 0,
      patternScanTime: this.performanceMetrics.patternScanTime || 0,
      totalTime,
      memoryUsed: this.getMemoryUsage(),
      throughput: this.performanceMetrics.throughput || 0
    };
  }

  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new WASMError(
        'Analysis Engine not initialized. Call initialize() first.',
        WASMErrorCode.InitializationFailed
      );
    }
  }

  private async ensureInitializedAsync(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private wrapError(error: any, code: WASMErrorCode): WASMError {
    if (error instanceof WASMError) {
      return error;
    }
    
    const message = error?.message || String(error);
    return new WASMError(message, code);
  }

  private log(level: string, ...args: any[]): void {
    if (this.shouldLog(level)) {
      const consoleMethod = console[level as keyof Console] as Function;
      if (typeof consoleMethod === 'function') {
        consoleMethod('[WASM Analysis Engine]', ...args);
      }
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel || 'info');
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }
}

// Export singleton instance with default config
export const analysisEngine = new AnalysisEngineBridge();

// Export class for custom configurations
export { AnalysisEngineBridge };

// Helper functions
export async function initializeAnalysisEngine(config?: EngineConfig): Promise<void> {
  if (config) {
    // Create new instance with custom config
    const customEngine = new AnalysisEngineBridge(config);
    await customEngine.initialize();
    return;
  }
  
  await analysisEngine.initialize();
}

export function createAnalysisEngine(config: EngineConfig): AnalysisEngineBridge {
  return new AnalysisEngineBridge(config);
}