/**
 * Web Platform Bridge with Streaming Support
 * Provides real-time analysis progress and streaming capabilities
 */

import {
  AnalysisResult,
  AnalysisOptions,
  AnalysisProgress,
  WASMError,
  WASMErrorCode,
  AnalysisEventHandlers
} from './types';
import { AnalysisEngineBridge } from './analysis-engine-bridge-enhanced';

interface StreamingOptions extends AnalysisOptions {
  chunkSize?: number;
  onChunkProcessed?: (bytesProcessed: number, totalBytes: number) => void;
}

export class WebStreamingBridge {
  private engine: AnalysisEngineBridge;
  private worker?: Worker;
  private useWebWorker: boolean;

  constructor(useWebWorker: boolean = true) {
    this.engine = new AnalysisEngineBridge({
      logLevel: 'info',
      workerPool: useWebWorker
    });
    this.useWebWorker = useWebWorker && typeof Worker !== 'undefined';
  }

  async initialize(): Promise<void> {
    await this.engine.initialize();
    
    if (this.useWebWorker) {
      try {
        // Create worker for background processing
        this.worker = new Worker(
          new URL('./workers/analysis-worker.js', import.meta.url),
          { type: 'module' }
        );
      } catch (error) {
        console.warn('Failed to create Web Worker, falling back to main thread:', error);
        this.useWebWorker = false;
      }
    }
  }

  /**
   * Analyze file with streaming progress updates
   */
  async analyzeStream(
    file: File,
    options: StreamingOptions = {},
    handlers: AnalysisEventHandlers = {}
  ): Promise<AnalysisResult> {
    const chunkSize = options.chunkSize || 1024 * 1024; // 1MB chunks
    const totalSize = file.size;
    let processedSize = 0;

    // Notify start
    handlers.onStart?.({ type: 'start', timestamp: Date.now() });

    try {
      // For small files, process directly
      if (totalSize < chunkSize) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        return await this.engine.analyze(uint8Array, options, handlers);
      }

      // For large files, use streaming
      if (this.useWebWorker && this.worker) {
        return await this.analyzeWithWorker(file, options, handlers);
      } else {
        return await this.analyzeInChunks(file, chunkSize, options, handlers);
      }
    } catch (error) {
      const wasmError = error instanceof WASMError ? error : 
        new WASMError(String(error), WASMErrorCode.AnalysisFailed);
      handlers.onError?.(wasmError);
      throw wasmError;
    }
  }

  /**
   * Analyze file in chunks for progress reporting
   */
  private async analyzeInChunks(
    file: File,
    chunkSize: number,
    options: StreamingOptions,
    handlers: AnalysisEventHandlers
  ): Promise<AnalysisResult> {
    const stream = file.stream();
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        totalBytes += value.length;
        
        // Report progress
        const progress: AnalysisProgress = {
          current: totalBytes,
          total: file.size,
          currentFile: file.name,
          percentage: (totalBytes / file.size) * 100
        };
        
        handlers.onProgress?.(progress);
        options.onChunkProcessed?.(totalBytes, file.size);
      }

      // Combine chunks
      const fullContent = new Uint8Array(totalBytes);
      let offset = 0;
      for (const chunk of chunks) {
        fullContent.set(chunk, offset);
        offset += chunk.length;
      }

      // Analyze complete content
      return await this.engine.analyze(fullContent, options, handlers);
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Analyze file using Web Worker for non-blocking operation
   */
  private async analyzeWithWorker(
    file: File,
    options: AnalysisOptions,
    handlers: AnalysisEventHandlers
  ): Promise<AnalysisResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new WASMError('Worker not initialized', WASMErrorCode.InitializationFailed));
        return;
      }

      const messageHandler = (event: MessageEvent) => {
        const { type, data } = event.data;

        switch (type) {
          case 'progress':
            handlers.onProgress?.(data);
            break;
          case 'complete':
            this.worker!.removeEventListener('message', messageHandler);
            handlers.onComplete?.(data);
            resolve(data);
            break;
          case 'error':
            this.worker!.removeEventListener('message', messageHandler);
            const error = new WASMError(data.message, data.code);
            handlers.onError?.(error);
            reject(error);
            break;
        }
      };

      this.worker.addEventListener('message', messageHandler);

      // Send file to worker
      this.worker.postMessage({
        type: 'analyze',
        file,
        options
      });
    });
  }

  /**
   * Stream analysis results as they become available
   */
  async *analyzeGenerator(
    files: File[],
    options: AnalysisOptions = {}
  ): AsyncGenerator<{ file: string; result: AnalysisResult | WASMError }, void, unknown> {
    for (const file of files) {
      try {
        const result = await this.analyzeStream(file, options);
        yield { file: file.name, result };
      } catch (error) {
        yield { 
          file: file.name, 
          result: error instanceof WASMError ? error : 
            new WASMError(String(error), WASMErrorCode.AnalysisFailed)
        };
      }
    }
  }

  /**
   * Create analysis pipeline with transform streams
   */
  createAnalysisPipeline(options: AnalysisOptions = {}): TransformStream<File, AnalysisResult> {
    const engine = this.engine;
    
    return new TransformStream<File, AnalysisResult>({
      async transform(file, controller) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const result = await engine.analyze(uint8Array, options);
          controller.enqueue(result);
        } catch (error) {
          controller.error(error);
        }
      }
    });
  }

  /**
   * Batch analyze with concurrency control
   */
  async batchAnalyzeWithConcurrency(
    files: File[],
    concurrency: number = 3,
    options: AnalysisOptions = {},
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<Map<string, AnalysisResult | WASMError>> {
    const results = new Map<string, AnalysisResult | WASMError>();
    const queue = [...files];
    const inProgress = new Set<Promise<void>>();
    let completed = 0;

    const processFile = async (file: File) => {
      try {
        const result = await this.analyzeStream(file, options);
        results.set(file.name, result);
      } catch (error) {
        results.set(
          file.name,
          error instanceof WASMError ? error : 
            new WASMError(String(error), WASMErrorCode.AnalysisFailed)
        );
      } finally {
        completed++;
        onProgress?.({
          current: completed,
          total: files.length,
          currentFile: file.name,
          percentage: (completed / files.length) * 100
        });
      }
    };

    while (queue.length > 0 || inProgress.size > 0) {
      // Start new tasks up to concurrency limit
      while (inProgress.size < concurrency && queue.length > 0) {
        const file = queue.shift()!;
        const promise = processFile(file).then(() => {
          inProgress.delete(promise);
        });
        inProgress.add(promise);
      }

      // Wait for at least one task to complete
      if (inProgress.size > 0) {
        await Promise.race(inProgress);
      }
    }

    return results;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
  }
}

// Singleton instance for web platform
export const webStreamingBridge = new WebStreamingBridge();

// Helper functions
export async function analyzeFileWithProgress(
  file: File,
  onProgress: (progress: AnalysisProgress) => void
): Promise<AnalysisResult> {
  await webStreamingBridge.initialize();
  return webStreamingBridge.analyzeStream(file, {}, { onProgress });
}

export async function batchAnalyzeFiles(
  files: File[],
  options?: {
    concurrency?: number;
    onProgress?: (progress: AnalysisProgress) => void;
  }
): Promise<Map<string, AnalysisResult | WASMError>> {
  await webStreamingBridge.initialize();
  return webStreamingBridge.batchAnalyzeWithConcurrency(
    files,
    options?.concurrency,
    {},
    options?.onProgress
  );
}