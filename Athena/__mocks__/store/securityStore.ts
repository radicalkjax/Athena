import { vi } from 'vitest';

// Mock security store implementation
const mockStore = {
  // State
  malwareSamples: [],
  securityAlerts: [],
  isQuarantineMode: false,
  activeSandboxSessions: [],

  // Actions
  addMalwareSample: vi.fn((sample) => {
    mockStore.malwareSamples.push(sample);
    // Also create a security alert like the real store
    mockStore.addSecurityAlert({
      type: 'malware_detected',
      severity: 'high',
      message: `New malware sample added: ${sample.metadata.fileName}`,
      details: { sampleId: sample.id, hash: sample.hash }
    });
  }),
  removeMalwareSample: vi.fn((id) => {
    mockStore.malwareSamples = mockStore.malwareSamples.filter(s => s.id !== id);
  }),
  clearMalwareSamples: vi.fn(() => {
    mockStore.malwareSamples = [];
    // Also create a security alert like the real store
    mockStore.addSecurityAlert({
      type: 'suspicious_activity',
      severity: 'medium',
      message: 'All malware samples cleared'
    });
  }),
  setQuarantineMode: vi.fn((enabled) => {
    mockStore.isQuarantineMode = enabled;
    if (enabled) {
      // Terminate all sessions when entering quarantine
      mockStore.activeSandboxSessions = [];
    }
  }),
  addSecurityAlert: vi.fn((alert) => {
    const newAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    mockStore.securityAlerts.push(newAlert);
    
    // Auto-enable quarantine for critical alerts
    if (alert.severity === 'critical') {
      mockStore.isQuarantineMode = true;
    }
    
    // Limit to 100 alerts
    if (mockStore.securityAlerts.length > 100) {
      mockStore.securityAlerts = mockStore.securityAlerts.slice(-100);
    }
  }),
  clearSecurityAlerts: vi.fn(() => {
    mockStore.securityAlerts = [];
  }),
  startSandboxSession: vi.fn((session) => {
    const newSession = {
      ...session,
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      status: 'active' as const
    };
    mockStore.activeSandboxSessions.push(newSession);
    return newSession.id;
  }),
  endSandboxSession: vi.fn((sessionId, status) => {
    mockStore.activeSandboxSessions = mockStore.activeSandboxSessions.filter(s => s.id !== sessionId);
    
    if (status === 'quarantined') {
      mockStore.addSecurityAlert({
        type: 'sandbox_breach',
        severity: 'critical',
        message: 'Sandbox session quarantined due to potential breach',
        details: { sessionId }
      });
    }
  })
};

// Create a hook that returns the mock store
export const useSecurityStore = vi.fn((selector) => {
  if (!selector) {
    return mockStore;
  }
  return selector(mockStore);
});

// Export helper hooks
export const useQuarantineMode = () => useSecurityStore(state => state.isQuarantineMode);
export const useSecurityAlerts = () => useSecurityStore(state => state.securityAlerts);
export const useActiveSandboxSessions = () => useSecurityStore(state => state.activeSandboxSessions);

// Reset function for tests
export const resetSecurityStore = () => {
  mockStore.malwareSamples = [];
  mockStore.securityAlerts = [];
  mockStore.isQuarantineMode = false;
  mockStore.activeSandboxSessions = [];
  
  // Clear all mock function calls
  Object.values(mockStore).forEach(value => {
    if (typeof value === 'function' && value.mockClear) {
      value.mockClear();
    }
  });
};