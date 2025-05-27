import { act, renderHook } from '@testing-library/react-native';
import { useSecurityStore } from '../../../store/securityStore';
import { MalwareSample, SecurityAlert, SandboxSession } from '../../../store/types/security';

// Mock data
const mockMalwareSample: MalwareSample = {
  id: 'sample-123',
  hash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
  encryptedContent: 'ZW5jcnlwdGVkX2NvbnRlbnQ=', // Base64 encoded
  metadata: {
    fileName: 'test-malware.exe',
    fileSize: 1024 * 1024,
    fileType: 'application/x-msdownload',
    captureDate: Date.now(),
    source: 'upload',
  },
};

const mockSecurityAlert: Omit<SecurityAlert, 'id' | 'timestamp'> = {
  type: 'malware_detected',
  severity: 'high',
  message: 'Malware detected in uploaded file',
  details: {
    fileName: 'malicious.exe',
    threatType: 'ransomware',
  },
};

const mockSandboxSession: Omit<SandboxSession, 'id' | 'startTime' | 'status'> = {
  malwareId: 'sample-123',
  containerId: 'container-456',
  isolationLevel: 'maximum',
};

describe('Security Store', () => {
  beforeEach(() => {
    // Reset store before each test
    const { result } = renderHook(() => useSecurityStore());
    act(() => {
      result.current.clearMalwareSamples();
      result.current.clearSecurityAlerts();
      result.current.setQuarantineMode(false);
    });
  });

  describe('Malware Management', () => {
    it('should add malware sample', () => {
      const { result } = renderHook(() => useSecurityStore());

      act(() => {
        result.current.addMalwareSample(mockMalwareSample);
      });

      expect(result.current.malwareSamples).toHaveLength(1);
      expect(result.current.malwareSamples[0]).toEqual(mockMalwareSample);
      // Should also create a security alert
      expect(result.current.securityAlerts).toHaveLength(1);
      expect(result.current.securityAlerts[0].type).toBe('malware_detected');
    });

    it('should remove malware sample', () => {
      const { result } = renderHook(() => useSecurityStore());

      // Add malware first
      act(() => {
        result.current.addMalwareSample(mockMalwareSample);
      });

      act(() => {
        result.current.removeMalwareSample(mockMalwareSample.id);
      });

      expect(result.current.malwareSamples).toHaveLength(0);
    });

    it('should clear all malware samples', () => {
      const { result } = renderHook(() => useSecurityStore());

      // Add multiple samples
      act(() => {
        result.current.addMalwareSample(mockMalwareSample);
        result.current.addMalwareSample({
          ...mockMalwareSample,
          id: 'sample-456',
        });
      });

      act(() => {
        result.current.clearMalwareSamples();
      });

      expect(result.current.malwareSamples).toHaveLength(0);
      // Should also create a security alert for clearing
      expect(result.current.securityAlerts.some(a => a.message.includes('cleared'))).toBe(true);
    });

    it('should toggle quarantine mode', () => {
      const { result } = renderHook(() => useSecurityStore());

      expect(result.current.isQuarantineMode).toBe(false);

      act(() => {
        result.current.setQuarantineMode(true);
      });

      expect(result.current.isQuarantineMode).toBe(true);

      act(() => {
        result.current.setQuarantineMode(false);
      });

      expect(result.current.isQuarantineMode).toBe(false);
    });
  });

  describe('Security Alerts', () => {
    it('should add security alert', () => {
      const { result } = renderHook(() => useSecurityStore());

      act(() => {
        result.current.addSecurityAlert(mockSecurityAlert);
      });

      expect(result.current.securityAlerts).toHaveLength(1);
      expect(result.current.securityAlerts[0]).toMatchObject({
        ...mockSecurityAlert,
        id: expect.any(String),
        timestamp: expect.any(Number),
      });
    });

    it('should clear security alerts', () => {
      const { result } = renderHook(() => useSecurityStore());

      act(() => {
        result.current.addSecurityAlert(mockSecurityAlert);
        result.current.addSecurityAlert({
          ...mockSecurityAlert,
          message: 'Another alert',
        });
      });

      act(() => {
        result.current.clearSecurityAlerts();
      });

      expect(result.current.securityAlerts).toHaveLength(0);
    });

    it('should limit alerts to 100', () => {
      const { result } = renderHook(() => useSecurityStore());

      act(() => {
        // Add 105 alerts
        for (let i = 0; i < 105; i++) {
          result.current.addSecurityAlert({
            ...mockSecurityAlert,
            message: `Alert ${i}`,
          });
        }
      });

      expect(result.current.securityAlerts).toHaveLength(100);
    });

    it('should auto-enable quarantine mode for critical alerts', () => {
      const { result } = renderHook(() => useSecurityStore());

      expect(result.current.isQuarantineMode).toBe(false);

      act(() => {
        result.current.addSecurityAlert({
          ...mockSecurityAlert,
          severity: 'critical',
        });
      });

      expect(result.current.isQuarantineMode).toBe(true);
    });
  });

  describe('Sandbox Sessions', () => {
    it('should start sandbox session', () => {
      const { result } = renderHook(() => useSecurityStore());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.startSandboxSession(mockSandboxSession);
      });

      expect(sessionId).toBeTruthy();
      expect(result.current.activeSandboxSessions).toHaveLength(1);
      expect(result.current.activeSandboxSessions[0]).toMatchObject({
        ...mockSandboxSession,
        id: sessionId,
        status: 'active',
        startTime: expect.any(Number),
      });
    });

    it('should end sandbox session', () => {
      const { result } = renderHook(() => useSecurityStore());

      let sessionId: string = '';
      act(() => {
        sessionId = result.current.startSandboxSession(mockSandboxSession);
      });

      act(() => {
        result.current.endSandboxSession(sessionId, 'completed');
      });

      // Active sessions are filtered out when ended
      expect(result.current.activeSandboxSessions).toHaveLength(0);
    });

    it('should create critical alert when session is quarantined', () => {
      const { result } = renderHook(() => useSecurityStore());

      let sessionId: string = '';
      act(() => {
        result.current.clearSecurityAlerts();
        sessionId = result.current.startSandboxSession(mockSandboxSession);
      });

      act(() => {
        result.current.endSandboxSession(sessionId, 'quarantined');
      });

      const quarantineAlert = result.current.securityAlerts.find(
        alert => alert.type === 'sandbox_breach'
      );
      expect(quarantineAlert).toBeTruthy();
      expect(quarantineAlert?.severity).toBe('critical');
    });

    it('should terminate all sessions when entering quarantine mode', () => {
      const { result } = renderHook(() => useSecurityStore());

      // Start multiple sessions
      act(() => {
        result.current.startSandboxSession(mockSandboxSession);
        result.current.startSandboxSession({
          ...mockSandboxSession,
          malwareId: 'sample-789',
        });
      });

      expect(result.current.activeSandboxSessions).toHaveLength(2);

      act(() => {
        result.current.setQuarantineMode(true);
      });

      expect(result.current.activeSandboxSessions).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle large number of alerts efficiently', () => {
      const { result } = renderHook(() => useSecurityStore());

      const startTime = Date.now();

      act(() => {
        // Add 100 alerts (max limit)
        for (let i = 0; i < 100; i++) {
          result.current.addSecurityAlert({
            ...mockSecurityAlert,
            message: `Alert ${i}`,
          });
        }
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 100ms
      expect(duration).toBeLessThan(100);
      expect(result.current.securityAlerts).toHaveLength(100);
    });
  });
});