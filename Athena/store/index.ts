import { create } from 'zustand';
import { AppState } from './types';
import { createAnalysisSlice } from './slices/analysisSlice';
import { createAIModelSlice } from './slices/aiModelSlice';
import { createContainerSlice } from './slices/containerSlice';
import { createMalwareSlice } from './slices/malwareSlice';
import { zustandLogger } from './middleware/logger';
import { devtools } from './middleware/devtools';
import { performanceMonitor } from './middleware/performance';
import { createPersistMiddleware } from './middleware/persist';

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV === 'development';

// Create the base store configuration
const createStore = (...a: Parameters<typeof createAnalysisSlice>) => ({
  ...createAnalysisSlice(...a),
  ...createAIModelSlice(...a),
  ...createContainerSlice(...a),
  ...createMalwareSlice(...a),
});

export const useAppStore = create<AppState>()(
  isDevelopment
    ? zustandLogger(
        devtools(
          createPersistMiddleware(
            performanceMonitor(
              createStore,
              'AthenaStore'
            )
          ),
          { name: 'AthenaStore' }
        ),
        'AthenaStore'
      )
    : createPersistMiddleware(createStore)
);
