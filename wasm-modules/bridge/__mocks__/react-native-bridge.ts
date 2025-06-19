/**
 * Mock React Native Bridge for testing
 */

import { vi } from 'vitest';
import {
  FileAnalysisResult,
  AnalysisOptions,
  DeobfuscationResult,
  PatternMatch,
  WASMError,
  WASMErrorCode,
  AnalysisProgress,
  AnalysisEventHandlers,
  IAnalysisEngine,
  EngineConfig,
  VulnerabilitySeverity,
  AnalysisResult,
  ThreatInfo,
  AnalysisMetadata
} from './types';

interface BackgroundTaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'cancelled';
  result?: FileAnalysisResult;
  error?: string;
}

interface StreamChunkResult {
  offset: number;
  threats: any[];
  vulnerabilities: any[];
}


export class ReactNativeBridge implements IAnalysisEngine {
  private initialized = false;
  private config: EngineConfig;
  private backgroundTaskCallbacks: Map<string, ((result: BackgroundTaskResult) => void)[]> = new Map();

  constructor(config: EngineConfig = {}) {
    this.config = {
      maxFileSize: 50 * 1024 * 1024,
      timeout: 60000,
      logLevel: 'info',
      ...config
    };
  }

  async initialize(): Promise<boolean> {
    this.initialized = true;
    return true;
  }

  async isInitialized(): Promise<boolean> {
    return this.initialized;
  }

  get_version(): string {
    return '1.0.0-mock';
  }

  async analyze(content: Uint8Array, _options?: AnalysisOptions): Promise<AnalysisResult> {
    if (!this.initialized) {
      throw new WASMError('Engine not initialized', WASMErrorCode.UnknownError);
    }

    const decoder = new TextDecoder();
    const text = decoder.decode(content);
    
    const threats: ThreatInfo[] = [];
    let severity: 'safe' | 'low' | 'medium' | 'high' | 'critical' = 'safe';
    
    // Mock threat detection
    if (text.includes('eval')) {
      threats.push({
        threat_type: 'code-injection',
        confidence: 0.9,
        description: 'Detected eval() usage',
        indicators: ['eval(', 'Function(']
      });
      severity = 'high';
    }
    
    const metadata: AnalysisMetadata = {
      file_hash: 'mock-hash-' + content.length,
      analysis_time_ms: 10,
      engine_version: this.get_version()
    };
    
    return {
      severity,
      threats,
      metadata
    };
  }

  async analyze_buffer(
    buffer: ArrayBuffer,
    _options?: AnalysisOptions
  ): Promise<FileAnalysisResult> {
    if (!this.initialized) {
      throw new WASMError('Engine not initialized', WASMErrorCode.UnknownError);
    }

    const decoder = new TextDecoder();
    const content = decoder.decode(buffer);
    
    const result: FileAnalysisResult = {
      hash: 'mock-hash-' + buffer.byteLength,
      file_size: buffer.byteLength,
      analysis_time_ms: 10,
      vulnerabilities: [],
      metadata: {
        fileSize: buffer.byteLength,
        fileType: 'text/plain',
        entropy: 0.5
      },
      detections: [],
      confidence: 0.95,
      details: {},
      executionTime: 10,
      processingErrors: []
    };
    
    // Mock vulnerability detection
    if (content.includes('eval')) {
      result.vulnerabilities.push({
        category: 'code-injection',
        severity: VulnerabilitySeverity.High,
        description: 'Detected eval() usage',
        type: 'code-injection',
        location: { offset: 0, length: 4 },
        details: {
          recommendation: 'Avoid using eval()',
          confidence: 0.9
        }
      });
    }
    
    return result;
  }

  // Alias for compatibility with tests
  async analyzeBuffer(buffer: ArrayBuffer, options?: AnalysisOptions): Promise<FileAnalysisResult> {
    return this.analyze_buffer(buffer, options);
  }

  async analyzeInBackground(buffer: ArrayBuffer, options?: { taskId?: string }): Promise<BackgroundTaskResult> {
    const taskId = options?.taskId || 'task-' + Date.now();
    
    // Analyze with background-specific description
    const decoder = new TextDecoder();
    const content = decoder.decode(buffer);
    
    const result: FileAnalysisResult = {
      hash: 'mock-hash-' + buffer.byteLength,
      file_size: buffer.byteLength,
      analysis_time_ms: 10,
      vulnerabilities: [],
      metadata: {
        fileSize: buffer.byteLength,
        fileType: 'text/plain',
        entropy: 0.5
      },
      detections: [],
      confidence: 0.95,
      details: {},
      executionTime: 10,
      processingErrors: []
    };
    
    // Mock vulnerability detection for background
    if (content.includes('eval')) {
      result.vulnerabilities.push({
        category: 'code-injection',
        severity: VulnerabilitySeverity.High,
        description: 'Detected eval() usage in background',
        type: 'code-injection',
        location: { offset: 0, length: 4 },
        details: {
          recommendation: 'Avoid using eval()',
          confidence: 0.9
        }
      });
    }
    
    // Simulate background processing
    setTimeout(() => {
      const taskResult: BackgroundTaskResult = {
        taskId,
        status: 'completed',
        result
      };
      
      // Trigger callbacks
      const callbacks = this.backgroundTaskCallbacks.get(taskId) || [];
      callbacks.forEach(cb => cb(taskResult));
    }, 100);
    
    return {
      taskId,
      status: 'completed',
      result
    };
  }

  onBackgroundTaskComplete(taskId: string, callback: (result: BackgroundTaskResult) => void): { remove: () => void } {
    if (!this.backgroundTaskCallbacks.has(taskId)) {
      this.backgroundTaskCallbacks.set(taskId, []);
    }
    
    const callbacks = this.backgroundTaskCallbacks.get(taskId)!;
    callbacks.push(callback);
    
    return {
      remove: () => {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  async cancelBackgroundTask(taskId: string): Promise<boolean> {
    // Mock cancellation
    this.backgroundTaskCallbacks.delete(taskId);
    return true;
  }

  async analyzeBatch(files: any[]): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const buffer = file.buffer || file;
      
      try {
        const analysisResult = await this.analyze_buffer(buffer);
        results.push({
          id: file.id || `file-${i}`,
          result: analysisResult
        });
      } catch (error) {
        results.push({
          id: file.id || `file-${i}`,
          error: error
        });
      }
    }
    
    return results;
  }

  async analyzeStream(
    stream: ReadableStream,
    options: {
      onChunk?: (result: StreamChunkResult) => void;
      onComplete?: (summary: any) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    const reader = stream.getReader();
    let offset = 0;
    let fullContent = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Decode chunk to check for vulnerabilities
        const decoder = new TextDecoder();
        const chunkText = decoder.decode(value);
        fullContent += chunkText;
        
        const chunkResult: StreamChunkResult = {
          offset,
          threats: [],
          vulnerabilities: []
        };
        
        // Check for vulnerabilities in the accumulated content
        if (fullContent.includes('eval')) {
          chunkResult.vulnerabilities.push({
            category: 'code-injection',
            severity: VulnerabilitySeverity.High,
            description: 'Detected eval() usage in stream',
            type: 'code-injection',
            location: { offset: fullContent.indexOf('eval'), length: 4 }
          });
        }
        
        if (options.onChunk) {
          options.onChunk(chunkResult);
        }
        
        offset += value.byteLength;
      }
      
      if (options.onComplete) {
        options.onComplete({
          totalBytes: offset,
          totalThreats: 0,
          totalVulnerabilities: fullContent.includes('eval') ? 1 : 0
        });
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  async deobfuscate(content: string): Promise<DeobfuscationResult> {
    if (!this.initialized) {
      throw new WASMError('Engine not initialized', WASMErrorCode.UnknownError);
    }

    return {
      original: content,
      deobfuscated: content,
      techniques_found: [],
      confidence: 0.8
    };
  }

  async scan_patterns(_content: Uint8Array): Promise<PatternMatch[]> {
    if (!this.initialized) {
      throw new WASMError('Engine not initialized', WASMErrorCode.UnknownError);
    }

    return [];
  }

  set_progress_callback(_callback: (progress: AnalysisProgress) => void): void {
    // Mock implementation
  }

  set_event_handlers(_handlers: AnalysisEventHandlers): void {
    // Mock implementation
  }

  dispose(): void {
    this.initialized = false;
    this.backgroundTaskCallbacks.clear();
  }
}

// Export singleton instance
export const reactNativeBridge = new ReactNativeBridge();

// Helper functions
export async function initializeReactNativeBridge(config?: EngineConfig): Promise<void> {
  if (config) {
    const customBridge = new ReactNativeBridge(config);
    await customBridge.initialize();
    return;
  }

  await reactNativeBridge.initialize();
}

export function createReactNativeBridge(config: EngineConfig): ReactNativeBridge {
  return new ReactNativeBridge(config);
}