import { StateCreator } from 'zustand';

// Security-related types
export interface MalwareSample {
  id: string;
  hash: string; // SHA256 hash
  encryptedContent: string; // Base64 encoded encrypted content
  metadata: {
    fileName: string;
    fileSize: number;
    fileType: string;
    captureDate: number;
    source?: string;
  };
}

export interface SecurityAlert {
  id: string;
  timestamp: number;
  type: 'malware_detected' | 'suspicious_activity' | 'sandbox_breach' | 'analysis_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: Record<string, any>;
}

export interface SandboxSession {
  id: string;
  malwareId: string;
  containerId: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'terminated' | 'quarantined';
  isolationLevel: 'standard' | 'enhanced' | 'maximum';
}

// Security store slice
export interface SecuritySlice {
  // State
  malwareSamples: MalwareSample[];
  securityAlerts: SecurityAlert[];
  activeSandboxSessions: SandboxSession[];
  isQuarantineMode: boolean;
  
  // Actions
  addMalwareSample: (sample: MalwareSample) => void;
  removeMalwareSample: (id: string) => void;
  clearMalwareSamples: () => void;
  
  addSecurityAlert: (alert: Omit<SecurityAlert, 'id' | 'timestamp'>) => void;
  clearSecurityAlerts: () => void;
  
  startSandboxSession: (session: Omit<SandboxSession, 'id' | 'startTime' | 'status'>) => string;
  endSandboxSession: (sessionId: string, status: 'completed' | 'terminated' | 'quarantined') => void;
  
  setQuarantineMode: (enabled: boolean) => void;
}

// Security slice creator type
export type SecuritySliceCreator = StateCreator<
  SecuritySlice,
  [],
  [],
  SecuritySlice
>;