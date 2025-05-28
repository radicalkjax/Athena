/**
 * Hook for batch analysis processing
 */

import { useState, useCallback, useRef } from 'react';
import { batchProcessor } from '@/services/batch/processor';
import { 
  BatchRequest, 
  BatchResponse, 
  BatchProgress, 
  BatchCallbacks 
} from '@/services/batch/types';
import { useStore } from '@/store';
import { logger } from '@/shared/logging/logger';

interface UseBatchAnalysisOptions {
  onProgress?: (progress: BatchProgress) => void;
  onRequestComplete?: (response: BatchResponse) => void;
  onBatchComplete?: (responses: BatchResponse[]) => void;
  onError?: (error: Error, requestId?: string) => void;
}

interface UseBatchAnalysisReturn {
  submitBatch: (files: Array<{ id: string; content: string; name?: string }>, analysisType: 'deobfuscate' | 'vulnerabilities') => Promise<BatchResponse[]>;
  cancelBatch: (batchId: string) => void;
  progress: BatchProgress | null;
  isProcessing: boolean;
  queueStatus: ReturnType<typeof batchProcessor.getQueueStatus>;
}

export function useBatchAnalysis(options: UseBatchAnalysisOptions = {}): UseBatchAnalysisReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const activeBatchId = useRef<string | null>(null);
  const addAnalysisResult = useStore((state) => state.addAnalysisResult);
  
  const submitBatch = useCallback(async (
    files: Array<{ id: string; content: string; name?: string }>,
    analysisType: 'deobfuscate' | 'vulnerabilities'
  ): Promise<BatchResponse[]> => {
    setIsProcessing(true);
    
    try {
      // Create batch requests
      const requests: BatchRequest[] = files.map((file, index) => ({
        id: `req_${file.id}_${Date.now()}`,
        code: file.content,
        type: analysisType,
        priority: 1, // Default priority
        timestamp: Date.now(),
        retryCount: 0,
        fileId: file.id,
        fileName: file.name,
      }));
      
      // Set up callbacks
      const callbacks: BatchCallbacks = {
        onProgress: (batchProgress) => {
          setProgress(batchProgress);
          activeBatchId.current = batchProgress.batchId;
          options.onProgress?.(batchProgress);
        },
        onRequestComplete: (response) => {
          // Store result in Zustand
          if (!response.error && response.result) {
            const analysisResult = {
              id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              malwareId: response.requestId,
              modelId: 'batch',
              timestamp: Date.now(),
              ...response.result,
            };
            
            addAnalysisResult(analysisResult);
          }
          
          options.onRequestComplete?.(response);
        },
        onBatchComplete: (responses) => {
          setProgress(null);
          activeBatchId.current = null;
          options.onBatchComplete?.(responses);
        },
        onError: (error, requestId) => {
          logger.error('Batch analysis error:', error);
          options.onError?.(error, requestId);
        },
      };
      
      // Submit batch
      const responses = await batchProcessor.submitBatch(requests, callbacks);
      
      return responses;
      
    } catch (error) {
      logger.error('Failed to submit batch:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [addAnalysisResult, options]);
  
  const cancelBatch = useCallback((batchId: string) => {
    batchProcessor.cancelBatch(batchId);
    if (activeBatchId.current === batchId) {
      setProgress(null);
      setIsProcessing(false);
      activeBatchId.current = null;
    }
  }, []);
  
  const queueStatus = batchProcessor.getQueueStatus();
  
  return {
    submitBatch,
    cancelBatch,
    progress,
    isProcessing,
    queueStatus,
  };
}