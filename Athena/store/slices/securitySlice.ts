import { SecuritySliceCreator, SecurityAlert, SandboxSession } from '../types/security';
import { logger } from '@/shared/logging/logger';

export const createSecuritySlice: SecuritySliceCreator = (set, get) => ({
  // Initial state
  malwareSamples: [],
  securityAlerts: [],
  activeSandboxSessions: [],
  isQuarantineMode: false,
  
  // Malware sample actions
  addMalwareSample: (sample) => {
    logger.info('Adding malware sample', { sampleId: sample.id, hash: sample.hash });
    
    set((state) => ({
      malwareSamples: [...state.malwareSamples, sample],
    }));
    
    // Auto-generate security alert for new malware
    get().addSecurityAlert({
      type: 'malware_detected',
      severity: 'high',
      message: `New malware sample added: ${sample.metadata.fileName}`,
      details: { sampleId: sample.id, hash: sample.hash },
    });
  },
  
  removeMalwareSample: (id) => {
    logger.info('Removing malware sample', { sampleId: id });
    
    // Terminate any active sandbox sessions for this sample
    const sessions = get().activeSandboxSessions.filter(s => s.malwareId === id);
    sessions.forEach(session => {
      get().endSandboxSession(session.id, 'terminated');
    });
    
    set((state) => ({
      malwareSamples: state.malwareSamples.filter(sample => sample.id !== id),
    }));
  },
  
  clearMalwareSamples: () => {
    logger.warn('Clearing all malware samples');
    
    // Terminate all active sandbox sessions
    const sessions = [...get().activeSandboxSessions];
    sessions.forEach(session => {
      get().endSandboxSession(session.id, 'terminated');
    });
    
    set({
      malwareSamples: [],
    });
    
    get().addSecurityAlert({
      type: 'suspicious_activity',
      severity: 'medium',
      message: 'All malware samples cleared',
    });
  },
  
  // Security alert actions
  addSecurityAlert: (alertData) => {
    const alert: SecurityAlert = {
      ...alertData,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    logger.warn('Security alert', alert);
    
    set((state) => ({
      securityAlerts: [alert, ...state.securityAlerts].slice(0, 100), // Keep last 100 alerts
    }));
    
    // Auto-enable quarantine mode for critical alerts
    if (alert.severity === 'critical' && !get().isQuarantineMode) {
      get().setQuarantineMode(true);
    }
  },
  
  clearSecurityAlerts: () => {
    logger.info('Clearing security alerts');
    set({ securityAlerts: [] });
  },
  
  // Sandbox session actions
  startSandboxSession: (sessionData) => {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session: SandboxSession = {
      ...sessionData,
      id: sessionId,
      startTime: Date.now(),
      status: 'active',
    };
    
    logger.info('Starting sandbox session', session);
    
    set((state) => ({
      activeSandboxSessions: [...state.activeSandboxSessions, session],
    }));
    
    get().addSecurityAlert({
      type: 'suspicious_activity',
      severity: 'low',
      message: `Sandbox session started for malware analysis`,
      details: { sessionId, malwareId: session.malwareId },
    });
    
    return sessionId;
  },
  
  endSandboxSession: (sessionId, status) => {
    logger.info('Ending sandbox session', { sessionId, status });
    
    set((state) => ({
      activeSandboxSessions: state.activeSandboxSessions.map(session =>
        session.id === sessionId
          ? { ...session, status, endTime: Date.now() }
          : session
      ).filter(session => session.status === 'active'),
    }));
    
    if (status === 'quarantined') {
      get().addSecurityAlert({
        type: 'sandbox_breach',
        severity: 'critical',
        message: `Sandbox session quarantined due to potential breach`,
        details: { sessionId },
      });
    }
  },
  
  // Quarantine mode
  setQuarantineMode: (enabled) => {
    logger.warn('Quarantine mode changed', { enabled });
    
    set({ isQuarantineMode: enabled });
    
    if (enabled) {
      // Terminate all active sessions when entering quarantine
      const sessions = [...get().activeSandboxSessions];
      sessions.forEach(session => {
        get().endSandboxSession(session.id, 'quarantined');
      });
      
      get().addSecurityAlert({
        type: 'suspicious_activity',
        severity: 'critical',
        message: 'Quarantine mode activated - all sandbox sessions terminated',
      });
    }
  },
});