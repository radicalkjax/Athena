/**
 * Types for request batching system
 */

import { 
  DeobfuscationResult, 
  VulnerabilityAnalysisResult, 
  StreamingAnalysis 
} from '@/services/ai/types';

export type BatchAnalysisType = 'deobfuscate' | 'vulnerabilities';
export type BatchAnalysisResult = DeobfuscationResult | VulnerabilityAnalysisResult;

export interface BatchRequest {
  id: string;
  code: string;
  type: BatchAnalysisType;
  priority: number;
  timestamp: number;
  retryCount: number;
  fileId?: string;
  fileName?: string;
}

export interface BatchResponse {
  requestId: string;
  result?: BatchAnalysisResult;
  error?: Error;
  provider?: string;
  cached?: boolean;
  processingTime: number;
}

export interface BatchProgress {
  batchId: string;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  currentRequestId?: string;
  startTime: number;
  estimatedTimeRemaining?: number;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxConcurrency: number;
  batchTimeout: number;
  retryLimit: number;
  priorityLevels: number;
}

export interface BatchCallbacks {
  onProgress?: (progress: BatchProgress) => void;
  onRequestComplete?: (response: BatchResponse) => void;
  onBatchComplete?: (responses: BatchResponse[]) => void;
  onError?: (error: Error, requestId?: string) => void;
}

export interface BatchQueue {
  add(request: BatchRequest): void;
  remove(requestId: string): boolean;
  peek(): BatchRequest | undefined;
  pop(): BatchRequest | undefined;
  size(): number;
  clear(): void;
  getAll(): BatchRequest[];
}

export interface BatchProcessor {
  submitBatch(requests: BatchRequest[], callbacks?: BatchCallbacks): Promise<BatchResponse[]>;
  submitSingle(request: BatchRequest, callbacks?: BatchCallbacks): Promise<BatchResponse>;
  cancelBatch(batchId: string): void;
  getQueueStatus(): QueueStatus;
  getActiveBatches(): string[];
}

export interface QueueStatus {
  pendingRequests: number;
  activeRequests: number;
  completedRequests: number;
  failedRequests: number;
  averageProcessingTime: number;
  queuedByPriority: Record<number, number>;
}