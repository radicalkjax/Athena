/**
 * Batch processor for handling multiple analysis requests efficiently
 */

import {
  BatchProcessor,
  BatchRequest,
  BatchResponse,
  BatchConfig,
  BatchCallbacks,
  BatchProgress,
  QueueStatus,
} from './types';
import { PriorityBatchQueue } from './queue';
import { aiServiceManager } from '@/services/ai/manager';
import { logger } from '@/shared/logging/logger';
// Simple ID generator for React Native compatibility
const generateId = () => `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const DEFAULT_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  maxConcurrency: 3,
  batchTimeout: 300000, // 5 minutes
  retryLimit: 2,
  priorityLevels: 3,
};

export class AnalysisBatchProcessor implements BatchProcessor {
  private static instance: AnalysisBatchProcessor;
  private config: BatchConfig;
  private queue: PriorityBatchQueue;
  private activeBatches: Map<string, AbortController>;
  private processingStats: {
    completed: number;
    failed: number;
    totalTime: number;
  };
  private isProcessing: boolean;
  private processTimer: NodeJS.Timeout | null = null;
  
  private constructor(config: Partial<BatchConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queue = new PriorityBatchQueue(this.config.priorityLevels);
    this.activeBatches = new Map();
    this.processingStats = {
      completed: 0,
      failed: 0,
      totalTime: 0,
    };
    this.isProcessing = false;
  }
  
  static getInstance(config?: Partial<BatchConfig>): AnalysisBatchProcessor {
    if (!AnalysisBatchProcessor.instance) {
      AnalysisBatchProcessor.instance = new AnalysisBatchProcessor(config);
    }
    return AnalysisBatchProcessor.instance;
  }
  
  async submitBatch(
    requests: BatchRequest[],
    callbacks?: BatchCallbacks
  ): Promise<BatchResponse[]> {
    const batchId = generateId();
    const abortController = new AbortController();
    this.activeBatches.set(batchId, abortController);
    
    logger.info(`Starting batch ${batchId} with ${requests.length} requests`);
    
    // Add requests to queue
    for (const request of requests) {
      this.queue.add(request);
    }
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
    
    const responses: BatchResponse[] = [];
    const startTime = Date.now();
    const progress: BatchProgress = {
      batchId,
      totalRequests: requests.length,
      completedRequests: 0,
      failedRequests: 0,
      startTime,
    };
    
    try {
      // Process requests with concurrency control
      const chunks = this.chunkRequests(requests, this.config.maxConcurrency);
      
      for (const chunk of chunks) {
        if (abortController.signal.aborted) break;
        
        const chunkPromises = chunk.map(request => 
          this.processRequest(request, abortController.signal)
        );
        
        const chunkResponses = await Promise.all(chunkPromises);
        
        for (const response of chunkResponses) {
          responses.push(response);
          
          if (response.error) {
            progress.failedRequests++;
          } else {
            progress.completedRequests++;
          }
          
          // Update progress
          progress.currentRequestId = response.requestId;
          const elapsed = Date.now() - startTime;
          const avgTime = elapsed / (progress.completedRequests + progress.failedRequests);
          const remaining = requests.length - progress.completedRequests - progress.failedRequests;
          progress.estimatedTimeRemaining = remaining * avgTime;
          
          callbacks?.onProgress?.(progress);
          callbacks?.onRequestComplete?.(response);
        }
      }
      
      callbacks?.onBatchComplete?.(responses);
      return responses;
      
    } catch (error: unknown) {
      logger.error(`Batch ${batchId} failed:`, error);
      callbacks?.onError?.(error as Error);
      throw error;
    } finally {
      this.activeBatches.delete(batchId);
    }
  }
  
  async submitSingle(
    request: BatchRequest,
    callbacks?: BatchCallbacks
  ): Promise<BatchResponse> {
    const responses = await this.submitBatch([request], callbacks);
    return responses[0];
  }
  
  cancelBatch(batchId: string): void {
    const controller = this.activeBatches.get(batchId);
    if (controller) {
      controller.abort();
      this.activeBatches.delete(batchId);
      logger.info(`Cancelled batch ${batchId}`);
    }
  }
  
  getQueueStatus(): QueueStatus {
    const queueSizes = this.queue.getQueueSizes();
    const avgTime = this.processingStats.completed > 0
      ? this.processingStats.totalTime / this.processingStats.completed
      : 0;
    
    return {
      pendingRequests: this.queue.size(),
      activeRequests: this.activeBatches.size,
      completedRequests: this.processingStats.completed,
      failedRequests: this.processingStats.failed,
      averageProcessingTime: avgTime,
      queuedByPriority: queueSizes,
    };
  }
  
  getActiveBatches(): string[] {
    return Array.from(this.activeBatches.keys());
  }
  
  // Private methods
  private async processRequest(
    request: BatchRequest,
    signal: AbortSignal
  ): Promise<BatchResponse> {
    const startTime = Date.now();
    
    try {
      if (signal.aborted) {
        throw new Error('Request aborted');
      }
      
      // Check cache first
      const cacheStats = aiServiceManager.getCacheStats();
      const cachedHitsBefore = cacheStats.hits;
      
      // Process through AI service manager
      const result = await aiServiceManager.analyzeWithFailover(
        request.code,
        request.type
      );
      
      // Check if it was a cache hit
      const newCacheStats = aiServiceManager.getCacheStats();
      const cached = newCacheStats.hits > cachedHitsBefore;
      
      const processingTime = Date.now() - startTime;
      this.processingStats.completed++;
      this.processingStats.totalTime += processingTime;
      
      return {
        requestId: request.id,
        result,
        cached,
        processingTime,
      };
      
    } catch (error: unknown) {
      const processingTime = Date.now() - startTime;
      this.processingStats.failed++;
      
      // Retry logic
      if (request.retryCount < this.config.retryLimit) {
        logger.info(`Retrying request ${request.id}, attempt ${request.retryCount + 1}`);
        request.retryCount++;
        this.queue.add(request);
      }
      
      return {
        requestId: request.id,
        error: error as Error,
        processingTime,
      };
    }
  }
  
  private chunkRequests(requests: BatchRequest[], chunkSize: number): BatchRequest[][] {
    const chunks: BatchRequest[][] = [];
    for (let i = 0; i < requests.length; i += chunkSize) {
      chunks.push(requests.slice(i, i + chunkSize));
    }
    return chunks;
  }
  
  private startProcessing(): void {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processQueue();
  }
  
  private async processQueue(): Promise<void> {
    while (this.queue.size() > 0 && this.isProcessing) {
      const batch: BatchRequest[] = [];
      
      // Build batch up to max size
      while (batch.length < this.config.maxBatchSize && this.queue.size() > 0) {
        const request = this.queue.pop();
        if (request) {
          batch.push(request);
        }
      }
      
      if (batch.length > 0) {
        // Process batch with concurrency control
        const chunks = this.chunkRequests(batch, this.config.maxConcurrency);
        
        for (const chunk of chunks) {
          const promises = chunk.map(request => 
            this.processRequest(request, new AbortController().signal)
          );
          
          await Promise.all(promises);
        }
      }
      
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessing = false;
  }
  
  destroy(): void {
    this.isProcessing = false;
    if (this.processTimer) {
      clearTimeout(this.processTimer);
    }
    this.queue.clear();
    this.activeBatches.clear();
  }
}

// Export singleton instance
export const batchProcessor = AnalysisBatchProcessor.getInstance();