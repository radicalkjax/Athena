import { StateCreator } from 'zustand';
import { APIProvider } from '@/services/api/gateway';
import { APIError } from '@/services/api/errorHandler';

// API request state
export interface APIRequest {
  id: string;
  provider: APIProvider;
  endpoint: string;
  status: 'pending' | 'success' | 'error' | 'cancelled';
  startTime: number;
  endTime?: number;
  error?: APIError;
  retryCount: number;
  data?: any;
}

// API health status
export interface APIHealthStatus {
  provider: APIProvider;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  lastCheck: number;
  responseTime?: number;
  errorRate?: number;
}

// API usage metrics
export interface APIUsageMetrics {
  provider: APIProvider;
  requestCount: number;
  successCount: number;
  errorCount: number;
  totalResponseTime: number;
  averageResponseTime: number;
  lastError?: APIError;
  lastErrorTime?: number;
}

// API slice types
export interface APISlice {
  // State
  activeRequests: Map<string, APIRequest>;
  requestHistory: APIRequest[];
  healthStatus: Map<APIProvider, APIHealthStatus>;
  usageMetrics: Map<APIProvider, APIUsageMetrics>;
  corsErrorCount: number;
  lastCorsError?: number;
  
  // Actions
  startRequest: (request: Omit<APIRequest, 'id' | 'status' | 'startTime' | 'retryCount'>) => string;
  completeRequest: (requestId: string, data?: any) => void;
  failRequest: (requestId: string, error: APIError) => void;
  cancelRequest: (requestId: string) => void;
  retryRequest: (requestId: string) => void;
  
  updateHealthStatus: (provider: APIProvider, status: Partial<APIHealthStatus>) => void;
  updateUsageMetrics: (provider: APIProvider, success: boolean, responseTime: number, error?: APIError) => void;
  
  trackCorsError: () => void;
  clearRequestHistory: () => void;
  resetMetrics: (provider?: APIProvider) => void;
  
  // Selectors
  getActiveRequestsForProvider: (provider: APIProvider) => APIRequest[];
  getHealthStatusForProvider: (provider: APIProvider) => APIHealthStatus | undefined;
  getMetricsForProvider: (provider: APIProvider) => APIUsageMetrics | undefined;
  isProviderHealthy: (provider: APIProvider) => boolean;
  hasRecentCorsErrors: () => boolean;
}

// API slice creator type
export type APISliceCreator = StateCreator<
  APISlice,
  [],
  [],
  APISlice
>;