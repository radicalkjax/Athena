import { APISliceCreator, APIRequest, APIHealthStatus, APIUsageMetrics } from '../types/api';
import { APIProvider } from '@/services/api/gateway';
import { APIError } from '@/services/api/errorHandler';
import { logger } from '@/shared/logging/logger';

const CORS_ERROR_WINDOW = 5 * 60 * 1000; // 5 minutes
const MAX_HISTORY_SIZE = 100;

export const createAPISlice: APISliceCreator = (set, get) => ({
  // Initial state
  activeRequests: new Map(),
  requestHistory: [],
  healthStatus: new Map(),
  usageMetrics: new Map(),
  corsErrorCount: 0,
  lastCorsError: undefined,
  
  // Request management
  startRequest: (requestData) => {
    const id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const request: APIRequest = {
      ...requestData,
      id,
      status: 'pending',
      startTime: Date.now(),
      retryCount: 0,
    };
    
    set((state) => {
      const newRequests = new Map(state.activeRequests);
      newRequests.set(id, request);
      return { activeRequests: newRequests };
    });
    
    logger.debug('API request started', {
      id,
      provider: request.provider,
      endpoint: request.endpoint,
    });
    
    return id;
  },
  
  completeRequest: (requestId, data) => {
    const request = get().activeRequests.get(requestId);
    if (!request) return;
    
    const completedRequest: APIRequest = {
      ...request,
      status: 'success',
      endTime: Date.now(),
      data,
    };
    
    const responseTime = completedRequest.endTime - completedRequest.startTime;
    
    set((state) => {
      const newRequests = new Map(state.activeRequests);
      newRequests.delete(requestId);
      
      const history = [completedRequest, ...state.requestHistory].slice(0, MAX_HISTORY_SIZE);
      
      return {
        activeRequests: newRequests,
        requestHistory: history,
      };
    });
    
    // Update metrics
    get().updateUsageMetrics(request.provider, true, responseTime);
    
    logger.debug('API request completed', {
      id: requestId,
      provider: request.provider,
      responseTime: `${responseTime}ms`,
    });
  },
  
  failRequest: (requestId, error) => {
    const request = get().activeRequests.get(requestId);
    if (!request) return;
    
    const failedRequest: APIRequest = {
      ...request,
      status: 'error',
      endTime: Date.now(),
      error,
    };
    
    const responseTime = failedRequest.endTime - failedRequest.startTime;
    
    set((state) => {
      const newRequests = new Map(state.activeRequests);
      newRequests.delete(requestId);
      
      const history = [failedRequest, ...state.requestHistory].slice(0, MAX_HISTORY_SIZE);
      
      return {
        activeRequests: newRequests,
        requestHistory: history,
      };
    });
    
    // Update metrics
    get().updateUsageMetrics(request.provider, false, responseTime, error);
    
    // Track CORS errors
    if (error.code === 'CORS_ERROR') {
      get().trackCorsError();
    }
    
    logger.error('API request failed', {
      id: requestId,
      provider: request.provider,
      error: error.message,
      code: error.code,
    });
  },
  
  cancelRequest: (requestId) => {
    const request = get().activeRequests.get(requestId);
    if (!request) return;
    
    const cancelledRequest: APIRequest = {
      ...request,
      status: 'cancelled',
      endTime: Date.now(),
    };
    
    set((state) => {
      const newRequests = new Map(state.activeRequests);
      newRequests.delete(requestId);
      
      const history = [cancelledRequest, ...state.requestHistory].slice(0, MAX_HISTORY_SIZE);
      
      return {
        activeRequests: newRequests,
        requestHistory: history,
      };
    });
    
    logger.info('API request cancelled', {
      id: requestId,
      provider: request.provider,
    });
  },
  
  retryRequest: (requestId) => {
    const request = get().activeRequests.get(requestId);
    if (!request) return;
    
    set((state) => {
      const newRequests = new Map(state.activeRequests);
      newRequests.set(requestId, {
        ...request,
        retryCount: request.retryCount + 1,
      });
      return { activeRequests: newRequests };
    });
    
    logger.info('API request retry', {
      id: requestId,
      provider: request.provider,
      retryCount: request.retryCount + 1,
    });
  },
  
  // Health and metrics
  updateHealthStatus: (provider, status) => {
    set((state) => {
      const newHealth = new Map(state.healthStatus);
      const current = newHealth.get(provider) || {
        provider,
        status: 'unknown',
        lastCheck: Date.now(),
      };
      
      newHealth.set(provider, {
        ...current,
        ...status,
        lastCheck: Date.now(),
      });
      
      return { healthStatus: newHealth };
    });
  },
  
  updateUsageMetrics: (provider, success, responseTime, error) => {
    set((state) => {
      const newMetrics = new Map(state.usageMetrics);
      const current = newMetrics.get(provider) || {
        provider,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
      };
      
      const updated: APIUsageMetrics = {
        ...current,
        requestCount: current.requestCount + 1,
        successCount: success ? current.successCount + 1 : current.successCount,
        errorCount: success ? current.errorCount : current.errorCount + 1,
        totalResponseTime: current.totalResponseTime + responseTime,
        averageResponseTime: (current.totalResponseTime + responseTime) / (current.requestCount + 1),
      };
      
      if (error) {
        updated.lastError = error;
        updated.lastErrorTime = Date.now();
      }
      
      newMetrics.set(provider, updated);
      
      // Update health status based on metrics
      const errorRate = updated.errorCount / updated.requestCount;
      let healthStatus: APIHealthStatus['status'] = 'healthy';
      
      if (errorRate > 0.5) healthStatus = 'down';
      else if (errorRate > 0.2) healthStatus = 'degraded';
      else if (updated.averageResponseTime > 5000) healthStatus = 'degraded';
      
      state.updateHealthStatus(provider, {
        status: healthStatus,
        responseTime: updated.averageResponseTime,
        errorRate,
      });
      
      return { usageMetrics: newMetrics };
    });
  },
  
  trackCorsError: () => {
    set((state) => ({
      corsErrorCount: state.corsErrorCount + 1,
      lastCorsError: Date.now(),
    }));
    
    logger.warn('CORS error tracked', {
      count: get().corsErrorCount,
      timestamp: new Date().toISOString(),
    });
  },
  
  clearRequestHistory: () => {
    set({ requestHistory: [] });
  },
  
  resetMetrics: (provider) => {
    set((state) => {
      if (provider) {
        const newMetrics = new Map(state.usageMetrics);
        newMetrics.delete(provider);
        
        const newHealth = new Map(state.healthStatus);
        newHealth.delete(provider);
        
        return {
          usageMetrics: newMetrics,
          healthStatus: newHealth,
        };
      }
      
      // Reset all metrics
      return {
        usageMetrics: new Map(),
        healthStatus: new Map(),
        corsErrorCount: 0,
        lastCorsError: undefined,
      };
    });
  },
  
  // Selectors
  getActiveRequestsForProvider: (provider) => {
    const requests: APIRequest[] = [];
    get().activeRequests.forEach((request) => {
      if (request.provider === provider) {
        requests.push(request);
      }
    });
    return requests;
  },
  
  getHealthStatusForProvider: (provider) => {
    return get().healthStatus.get(provider);
  },
  
  getMetricsForProvider: (provider) => {
    return get().usageMetrics.get(provider);
  },
  
  isProviderHealthy: (provider) => {
    const health = get().healthStatus.get(provider);
    return !health || health.status === 'healthy';
  },
  
  hasRecentCorsErrors: () => {
    const { corsErrorCount, lastCorsError } = get();
    if (!lastCorsError || corsErrorCount === 0) return false;
    
    return Date.now() - lastCorsError < CORS_ERROR_WINDOW;
  },
});