/**
 * React hooks for API integration
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { apiGateway, APIProvider, GatewayConfig, GatewayError } from './gateway';
import { APIErrorHandler } from './errorHandler';
import { useAPIRequest, useAPIStore } from '@/store/apiStore';
import { logger } from '@/shared/logging/logger';

export interface UseAPIOptions {
  provider: APIProvider;
  apiKey?: string;
  cache?: boolean;
  onError?: (error: GatewayError) => void;
  onSuccess?: (data: any) => void;
}

export interface UseAPIResult<T = any> {
  data: T | null;
  loading: boolean;
  error: GatewayError | null;
  request: (endpoint: string, options?: any) => Promise<T>;
  cancel: () => void;
  retry: () => void;
}

/**
 * Hook for making API requests with automatic state management
 */
export function useAPI<T = any>(options: UseAPIOptions): UseAPIResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<GatewayError | null>(null);
  
  const requestIdRef = useRef<string | null>(null);
  const lastRequestRef = useRef<{ endpoint: string; options: any } | null>(null);
  
  const apiRequest = useAPIRequest();
  const isProviderHealthy = useAPIStore(state => state.isProviderHealthy);
  
  // Cancel any active request on unmount
  useEffect(() => {
    return () => {
      if (requestIdRef.current) {
        apiRequest.cancel(requestIdRef.current);
      }
    };
  }, [apiRequest]);
  
  const request = useCallback(async (endpoint: string, requestOptions: any = {}) => {
    // Check if provider is healthy
    if (!isProviderHealthy(options.provider)) {
      logger.warn(`Provider ${options.provider} is not healthy, but proceeding with request`);
    }
    
    // Cancel any existing request
    if (requestIdRef.current) {
      apiRequest.cancel(requestIdRef.current);
    }
    
    // Store request details for retry
    lastRequestRef.current = { endpoint, options: requestOptions };
    
    // Start request tracking
    const requestId = apiRequest.start({
      provider: options.provider,
      endpoint,
    });
    requestIdRef.current = requestId;
    
    setLoading(true);
    setError(null);
    
    try {
      const config: GatewayConfig = {
        provider: options.provider,
        apiKey: options.apiKey,
      };
      
      const response = await apiGateway.request<T>(config, endpoint, {
        ...requestOptions,
        cache: options.cache,
      });
      
      // Complete request tracking
      apiRequest.complete(requestId, response.data);
      
      setData(response.data);
      setLoading(false);
      
      // Call success callback
      if (options.onSuccess) {
        options.onSuccess(response.data);
      }
      
      return response.data;
    } catch (err) {
      const gatewayError = err as GatewayError;
      
      // Fail request tracking
      apiRequest.fail(requestId, {
        code: gatewayError.code,
        message: gatewayError.message,
        provider: gatewayError.provider,
        suggestion: gatewayError.suggestion,
      });
      
      setError(gatewayError);
      setLoading(false);
      
      // Call error callback
      if (options.onError) {
        options.onError(gatewayError);
      }
      
      throw gatewayError;
    }
  }, [options, apiRequest, isProviderHealthy]);
  
  const cancel = useCallback(() => {
    if (requestIdRef.current) {
      apiRequest.cancel(requestIdRef.current);
      requestIdRef.current = null;
      setLoading(false);
    }
  }, [apiRequest]);
  
  const retry = useCallback(() => {
    if (lastRequestRef.current) {
      const { endpoint, options } = lastRequestRef.current;
      return request(endpoint, options);
    }
    return Promise.reject(new Error('No request to retry'));
  }, [request]);
  
  return {
    data,
    loading,
    error,
    request,
    cancel,
    retry,
  };
}

/**
 * Hook for monitoring API health across providers
 */
export function useAPIHealth(providers: APIProvider[] = []) {
  const healthStatus = useAPIStore(state => state.healthStatus);
  const [health, setHealth] = useState<Record<APIProvider, boolean>>({} as any);
  
  useEffect(() => {
    const newHealth: Record<APIProvider, boolean> = {} as any;
    
    providers.forEach(provider => {
      const status = healthStatus.get(provider);
      newHealth[provider] = !status || status.status === 'healthy';
    });
    
    setHealth(newHealth);
  }, [healthStatus, providers]);
  
  return health;
}

/**
 * Hook for handling CORS errors with fallback UI
 */
export function useCORSErrorHandler() {
  const { count, hasRecent } = useAPIStore(state => ({
    count: state.corsErrorCount,
    hasRecent: state.hasRecentCorsErrors(),
  }));
  
  const [showCORSWarning, setShowCORSWarning] = useState(false);
  
  useEffect(() => {
    // Show warning after 3 CORS errors
    if (count >= 3 && hasRecent) {
      setShowCORSWarning(true);
    }
  }, [count, hasRecent]);
  
  const dismissWarning = useCallback(() => {
    setShowCORSWarning(false);
  }, []);
  
  return {
    corsErrorCount: count,
    showCORSWarning,
    dismissWarning,
  };
}

/**
 * Hook for API request with automatic retry and fallback
 */
export function useAPIWithFallback<T = any>(
  primaryOptions: UseAPIOptions,
  fallbackProvider?: APIProvider
): UseAPIResult<T> {
  const primary = useAPI<T>(primaryOptions);
  const [useFallback, setUseFallback] = useState(false);
  
  const fallbackOptions: UseAPIOptions = {
    ...primaryOptions,
    provider: fallbackProvider || 'openai',
  };
  
  const fallback = useAPI<T>(fallbackOptions);
  
  // Switch to fallback on primary error
  useEffect(() => {
    if (primary.error && fallbackProvider) {
      const error = primary.error;
      
      // Use fallback for specific errors
      if (
        error.code === 'RATE_LIMIT_ERROR' ||
        error.code === 'SERVER_ERROR' ||
        error.code === 'AUTH_ERROR'
      ) {
        logger.info(`Switching to fallback provider: ${fallbackProvider}`);
        setUseFallback(true);
      }
    }
  }, [primary.error, fallbackProvider]);
  
  // Return appropriate API based on fallback state
  return useFallback ? fallback : primary;
}