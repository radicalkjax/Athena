import { create } from 'zustand';
import { APISlice } from './types/api';
import { createAPISlice } from './slices/apiSlice';
import { devtools } from './middleware/devtools';
import { zustandLogger } from './middleware/logger';
import { performanceMonitor } from './middleware/performance';

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Create API store with middleware
export const useAPIStore = create<APISlice>()(
  isDevelopment
    ? zustandLogger(
        devtools(
          performanceMonitor(
            createAPISlice,
            'APIStore'
          ),
          { name: 'AthenaAPIStore' }
        ),
        'APIStore'
      )
    : createAPISlice
);

// Convenience hooks for common operations
export const useAPIHealth = () => useAPIStore(state => state.healthStatus);
export const useAPIMetrics = () => useAPIStore(state => state.usageMetrics);
export const useActiveRequests = () => useAPIStore(state => state.activeRequests);
export const useCorsErrorStatus = () => useAPIStore(state => ({
  count: state.corsErrorCount,
  hasRecent: state.hasRecentCorsErrors(),
}));

// Hook to track API request lifecycle
export function useAPIRequest() {
  const {
    startRequest,
    completeRequest,
    failRequest,
    cancelRequest,
  } = useAPIStore();
  
  return {
    start: startRequest,
    complete: completeRequest,
    fail: failRequest,
    cancel: cancelRequest,
  };
}