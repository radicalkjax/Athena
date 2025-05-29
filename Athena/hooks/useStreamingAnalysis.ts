/**
 * Hook for streaming malware analysis with AI providers
 */

import { useCallback, useRef } from 'react';
import { aiServiceManager } from '@/services/ai/manager';
import { useAppStore } from '@/store';
import { MalwareFile } from '@/types';
import { StreamingAnalysis } from '@/services/ai/types';
import { logger } from '@/shared/logging/logger';

export interface UseStreamingAnalysisOptions {
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
}

export function useStreamingAnalysis(options?: UseStreamingAnalysisOptions) {
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const {
    startStreamingAnalysis,
    setAnalysisProgress,
    addAnalysisResult,
    setIsAnalyzing,
    clearAnalysisProgress
  } = useAppStore();
  
  const analyze = useCallback(async (
    file: MalwareFile,
    type: 'deobfuscate' | 'vulnerabilities',
    modelId?: string
  ) => {
    // Cancel any ongoing analysis
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    const analysisId = `${file.id}-${Date.now()}`;
    
    try {
      // Start streaming analysis in store
      startStreamingAnalysis(analysisId);
      
      // Create streaming callbacks
      const streaming: StreamingAnalysis = {
        onProgress: (progress) => {
          setAnalysisProgress({
            progress,
            stage: 'analyzing',
            message: `Analysis progress: ${progress.toFixed(0)}%`,
            timestamp: Date.now()
          });
        },
        
        onChunk: (chunk) => {
          if (chunk.type === 'progress' && chunk.data) {
            setAnalysisProgress({
              progress: chunk.data.progress || 0,
              stage: chunk.data.stage || 'processing',
              message: chunk.data.message || 'Processing...',
              provider: chunk.data.provider,
              timestamp: chunk.timestamp
            });
          }
        },
        
        onComplete: (result) => {
          // Add result to store
          const analysisResult = {
            id: analysisId,
            malwareId: file.id,
            modelId: modelId || 'ai-manager',
            timestamp: Date.now(),
            ...result
          };
          
          addAnalysisResult(analysisResult);
          
          // Call optional complete handler
          if (options?.onComplete) {
            options.onComplete(result);
          }
          
          logger.info('Streaming analysis completed', { analysisId });
        },
        
        onError: (error) => {
          logger.error('Streaming analysis error', { analysisId, error });
          
          // Add error result
          addAnalysisResult({
            id: analysisId,
            malwareId: file.id,
            modelId: modelId || 'ai-manager',
            timestamp: Date.now(),
            error: error.message
          });
          
          // Call optional error handler
          if (options?.onError) {
            options.onError(error);
          }
        },
        
        signal: abortControllerRef.current.signal
      };
      
      // Perform analysis with failover
      await aiServiceManager.analyzeWithFailover(
        file.content || '',
        type,
        streaming
      );
      
    } catch (error) {
      logger.error('Failed to start streaming analysis', { error });
      
      // Ensure we clean up state
      setIsAnalyzing(false);
      clearAnalysisProgress();
      
      if (options?.onError) {
        options.onError(error as Error);
      }
    }
  }, [
    startStreamingAnalysis,
    setAnalysisProgress,
    addAnalysisResult,
    setIsAnalyzing,
    clearAnalysisProgress,
    options
  ]);
  
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsAnalyzing(false);
    clearAnalysisProgress();
  }, [setIsAnalyzing, clearAnalysisProgress]);
  
  const getProviderStatus = useCallback(() => {
    return {
      providers: aiServiceManager.getProviderStatus(),
      circuitBreakers: aiServiceManager.getCircuitBreakerStatus()
    };
  }, []);
  
  return {
    analyze,
    cancel,
    getProviderStatus
  };
}