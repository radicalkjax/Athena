import { create } from 'zustand';
import { SecuritySlice } from './types/security';
import { createSecuritySlice } from './slices/securitySlice';
import { devtools } from './middleware/devtools';
import { zustandLogger } from './middleware/logger';

// Security store is separate from main store for isolation
// This prevents accidental exposure of sensitive data through the main store
const isDevelopment = process.env.NODE_ENV === 'development';

export const useSecurityStore = create<SecuritySlice>()(
  isDevelopment
    ? zustandLogger(
        devtools(
          createSecuritySlice,
          { name: 'AthenaSecurityStore' }
        ),
        'SecurityStore'
      )
    : createSecuritySlice
);

// Helper hooks for specific security concerns
export const useQuarantineMode = () => useSecurityStore(state => state.isQuarantineMode);
export const useSecurityAlerts = () => useSecurityStore(state => state.securityAlerts);
export const useActiveSandboxSessions = () => useSecurityStore(state => state.activeSandboxSessions);