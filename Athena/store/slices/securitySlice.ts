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
    
    // Create security alert data first
    const alert = {
      type: 'malware_detected' as const,
      severity: 'high' as const,
      message: `New malware sample added: ${sample.metadata.fileName}`,
      details: { sampleId: sample.id, hash: sample.hash },
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
    };
    
    // Update both state and alerts atomically
    set((state) => ({
      malwareSamples: [...state.malwareSamples, sample],
      securityAlerts: [alert, ...state.securityAlerts].slice(0, 100),
    }));
    
    logger.warn('Security alert', alert);
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
    
    // Create security alert data first
    const alert = {
      type: 'suspicious_activity' as const,
      severity: 'medium' as const,
      message: 'All malware samples cleared',
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    // Update state atomically - terminate sessions and clear samples
    set((state) => ({
      malwareSamples: [],
      activeSandboxSessions: [], // Clear all sessions when clearing samples
      securityAlerts: [alert, ...state.securityAlerts].slice(0, 100),
    }));
    
    logger.warn('Security alert', alert);
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
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    const session: SandboxSession = {
      ...sessionData,
      id: sessionId,
      startTime: Date.now(),
      status: 'active',
    };
    
    // Create security alert
    const alert = {
      type: 'suspicious_activity' as const,
      severity: 'low' as const,
      message: `Sandbox session started for malware analysis`,
      details: { sessionId, malwareId: session.malwareId },
      id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: Date.now(),
    };
    
    logger.info('Starting sandbox session', session);
    
    // Update state atomically
    set((state) => ({
      activeSandboxSessions: [...state.activeSandboxSessions, session],
      securityAlerts: [alert, ...state.securityAlerts].slice(0, 100),
    }));
    
    logger.warn('Security alert', alert);
    
    return sessionId;
  },
  
  endSandboxSession: (sessionId, status) => {
    logger.info('Ending sandbox session', { sessionId, status });
    
    const currentState = get();
    
    // Create alert if quarantined
    const alerts = [...currentState.securityAlerts];
    if (status === 'quarantined') {
      const alert = {
        type: 'sandbox_breach' as const,
        severity: 'critical' as const,
        message: `Sandbox session quarantined due to potential breach`,
        details: { sessionId },
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp: Date.now(),
      };
      alerts.unshift(alert);
      logger.warn('Security alert', alert);
    }
    
    // Remove the session from active sessions
    set((state) => ({
      activeSandboxSessions: state.activeSandboxSessions.filter(session => session.id !== sessionId),
      securityAlerts: alerts.slice(0, 100),
    }));
  },
  
  // Quarantine mode
  setQuarantineMode: (enabled) => {
    logger.warn('Quarantine mode changed', { enabled });
    
    if (enabled) {
      // Create alert for quarantine activation
      const alert = {
        type: 'suspicious_activity' as const,
        severity: 'critical' as const,
        message: 'Quarantine mode activated - all sandbox sessions terminated',
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        timestamp: Date.now(),
      };
      
      // Terminate all sessions and enable quarantine atomically
      set((state) => ({
        isQuarantineMode: true,
        activeSandboxSessions: [], // Clear all sessions
        securityAlerts: [alert, ...state.securityAlerts].slice(0, 100),
      }));
      
      logger.warn('Security alert', alert);
    } else {
      set({ isQuarantineMode: false });
    }
  },
});