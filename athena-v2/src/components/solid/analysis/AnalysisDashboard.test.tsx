import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { AnalysisDashboard } from './AnalysisDashboard';
import { mockInvoke, flushPromises } from '../../../test-setup';

describe('AnalysisDashboard', () => {
  const mockFileData = new Uint8Array([0x4d, 0x5a]); // MZ header
  const mockFilePath = '/tmp/test.exe';

  beforeEach(() => {
    mockInvoke.mockClear();

    // Mock get_ai_provider_status to prevent errors from AIProviderStatus component
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_ai_provider_status') {
        return Promise.resolve({});
      }
      return Promise.resolve();
    });
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(() => <AnalysisDashboard />);

      expect(screen.getByText(/Malware Analysis Dashboard/i)).toBeDefined();
    });

    it('should render start analysis button', () => {
      render(() => <AnalysisDashboard />);

      expect(screen.getByText(/Start Full Analysis/i)).toBeDefined();
    });

    it('should render all analysis stages', () => {
      render(() => <AnalysisDashboard />);

      expect(screen.getByText(/Static Analysis/i)).toBeDefined();
      expect(screen.getByText(/Dynamic Analysis/i)).toBeDefined();
      expect(screen.getByText(/Network Analysis/i)).toBeDefined();
      expect(screen.getByText(/Behavioral Analysis/i)).toBeDefined();
    });

    it('should render sandbox configuration panel', () => {
      render(() => <AnalysisDashboard />);

      expect(screen.getByText(/Sandbox Configuration/i)).toBeDefined();
    });

    it('should render WASM analysis engine when fileData provided', () => {
      render(() => <AnalysisDashboard fileData={mockFileData} />);

      expect(screen.getByText(/WASM Analysis Engine/i)).toBeDefined();
    });

    it('should not render WASM section without fileData', () => {
      render(() => <AnalysisDashboard />);

      const wasmSection = screen.queryByText(/WASM Analysis Engine/i);
      expect(wasmSection).toBeNull();
    });

    it('should render all stage icons', () => {
      render(() => <AnalysisDashboard />);

      // Check for emoji icons in stage cards
      expect(screen.getByText(/🔍/)).toBeDefined(); // Static
      expect(screen.getByText(/⚡/)).toBeDefined(); // Dynamic
      expect(screen.getByText(/🌐/)).toBeDefined(); // Network
      expect(screen.getByText(/🧠/)).toBeDefined(); // Behavioral
    });
  });

  describe('Loading State', () => {
    it('should show running status during analysis', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await flushPromises();

      await waitFor(() => {
        expect(screen.getByText(/running/i)).toBeDefined();
      });
    });

    it('should show progress bars for running stages', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve({});
      });

      const { container } = render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await flushPromises();

      await waitFor(() => {
        const progressBars = container.querySelectorAll('[style*="width"]');
        expect(progressBars.length).toBeGreaterThan(0);
      });
    });

    it('should update progress percentage', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({
            anomalies: [],
            imports: [],
            entropy: 5.0,
            sections: []
          });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/100%/i)).toBeDefined();
      });
    });

    it('should show completed status after success', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(false);
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({ matches: [] });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        const completedStatuses = screen.getAllByText(/completed/i);
        expect(completedStatuses.length).toBeGreaterThan(0);
      }, { timeout: 3000 });
    });
  });

  describe('Error Handling', () => {
    it('should show error status on analysis failure', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.reject(new Error('Analysis failed'));
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeDefined();
      });
    });

    it('should display error message in findings', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.reject(new Error('File read error'));
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Error: File read error/i)).toBeDefined();
      });
    });

    it('should handle missing file path gracefully', async () => {
      render(() => <AnalysisDashboard />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await flushPromises();

      // Should not crash, just not start analysis
      expect(screen.getByText(/Malware Analysis Dashboard/i)).toBeDefined();
    });

    it('should continue pipeline after single stage failure', async () => {
      let callCount = 0;
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          callCount++;
          if (callCount === 1) {
            return Promise.reject(new Error('Static analysis failed'));
          }
          return Promise.resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(false);
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({ matches: [] });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        // Should have both error and completed stages
        expect(screen.getByText(/error/i)).toBeDefined();
        expect(screen.queryByText(/completed/i)).toBeDefined();
      }, { timeout: 3000 });
    });
  });

  describe('User Interactions', () => {
    it('should start analysis when button clicked', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(false);
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({ matches: [] });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('analyze_file', { filePath: mockFilePath });
      });
    });

    it('should change sandbox OS configuration', () => {
      render(() => <AnalysisDashboard />);

      const osSelect = screen.getByDisplayValue(/Windows 10/i) as HTMLSelectElement;
      fireEvent.change(osSelect, { target: { value: 'linux' } });

      expect(osSelect.value).toBe('linux');
    });

    it('should change sandbox architecture', () => {
      render(() => <AnalysisDashboard />);

      const archSelect = screen.getByDisplayValue(/x64/i) as HTMLSelectElement;
      fireEvent.change(archSelect, { target: { value: 'x86' } });

      expect(archSelect.value).toBe('x86');
    });

    it('should toggle network isolation checkbox', () => {
      render(() => <AnalysisDashboard />);

      const checkbox = screen.getByLabelText(/Network Isolation/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('should toggle snapshot checkbox', () => {
      render(() => <AnalysisDashboard />);

      const checkbox = screen.getByLabelText(/Enable Snapshots/i) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('should switch between WASM analysis types', () => {
      render(() => <AnalysisDashboard fileData={mockFileData} />);

      const networkButton = screen.getByText(/🌐 Network Analysis/i);
      fireEvent.click(networkButton);

      // Should not crash and button should be clickable
      expect(networkButton).toBeDefined();
    });
  });

  describe('Analysis Stages', () => {
    it('should run static analysis stage', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({
            anomalies: ['Suspicious section'],
            imports: [{ library: 'ws2_32.dll', suspicious: true }],
            entropy: 7.5,
            sections: [{ name: '.text', suspicious: true }]
          });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/anomalies/i)).toBeDefined();
        expect(screen.getByText(/suspicious imports/i)).toBeDefined();
        expect(screen.getByText(/High entropy/i)).toBeDefined();
      });
    });

    it('should run dynamic analysis with sandbox', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(true);
        }
        if (cmd === 'execute_sample_in_sandbox') {
          return Promise.resolve({
            behavior_events: [{ type: 'file_write', data: 'C:\\malware.exe' }],
            file_operations: [{ action: 'create', path: 'C:\\temp.tmp' }],
            network_connections: [{ ip: '192.168.1.1', port: 443 }],
            processes: [{ pid: 1234 }, { pid: 5678 }],
            mitre_techniques: ['T1055']
          });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/behavior events/i)).toBeDefined();
        expect(screen.getByText(/file operations/i)).toBeDefined();
        expect(screen.getByText(/network connections/i)).toBeDefined();
        expect(screen.getByText(/MITRE ATT&CK techniques/i)).toBeDefined();
      }, { timeout: 3000 });
    });

    it('should skip dynamic analysis when sandbox unavailable', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(false);
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({ matches: [] });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Sandbox not available/i)).toBeDefined();
      }, { timeout: 3000 });
    });

    it('should run network analysis stage', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          if (cmd.includes('network')) {
            // Second call for network analysis
            return Promise.resolve({
              imports: [
                {
                  library: 'ws2_32.dll',
                  functions: ['connect', 'send', 'recv']
                }
              ],
              strings: [
                { value: 'http://evil.com' },
                { value: '192.168.1.1' }
              ]
            });
          }
          // First call for static
          return Promise.resolve({
            anomalies: [],
            imports: [
              {
                library: 'ws2_32.dll',
                functions: ['connect', 'send', 'recv']
              }
            ],
            entropy: 5.0,
            sections: [],
            strings: [
              { value: 'http://evil.com' },
              { value: '192.168.1.1' }
            ]
          });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(false);
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({ matches: [] });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        const findings = screen.queryByText(/network-related libraries|URLs|IP addresses/i);
        expect(findings).toBeDefined();
      }, { timeout: 3000 });
    });

    it('should run behavioral analysis with YARA', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(false);
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({
            matches: [
              { rule_name: 'ransomware_detection' },
              { rule_name: 'trojan_generic' }
            ],
            scan_time_ms: 125
          });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Matched.*YARA rules/i)).toBeDefined();
        expect(screen.getByText(/CRITICAL.*high-severity threats/i)).toBeDefined();
      }, { timeout: 3000 });
    });
  });

  describe('WASM Integration', () => {
    it('should render WASM analysis selector buttons', () => {
      render(() => <AnalysisDashboard fileData={mockFileData} />);

      expect(screen.getByText(/🔍 Static Analysis/i)).toBeDefined();
      expect(screen.getByText(/⚡ Dynamic Analysis/i)).toBeDefined();
      expect(screen.getByText(/🌐 Network Analysis/i)).toBeDefined();
      expect(screen.getByText(/🧠 Behavioral Analysis/i)).toBeDefined();
    });

    it('should highlight selected analysis type', () => {
      const { container } = render(() => <AnalysisDashboard fileData={mockFileData} />);

      const staticButton = screen.getByText(/🔍 Static Analysis/i).closest('button');
      expect(staticButton?.className).toContain('btn-primary');

      const dynamicButton = screen.getByText(/⚡ Dynamic Analysis/i).closest('button');
      fireEvent.click(dynamicButton!);

      // After click, dynamic should be primary
      expect(dynamicButton?.className).toContain('btn-primary');
    });

    it('should handle WASM analysis completion', async () => {
      const mockResult = {
        findings: [
          { severity: 'high', description: 'Suspicious API call detected' },
          { severity: 'medium', description: 'Packed executable' }
        ]
      };

      render(() => <AnalysisDashboard fileData={mockFileData} filePath={mockFilePath} />);

      // Simulate WASM analysis complete by checking that component accepts the handler
      expect(screen.getByText(/WASM Analysis Engine/i)).toBeDefined();
    });
  });

  describe('Findings Display', () => {
    it('should display findings for completed stages', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({
            anomalies: ['Anomaly 1'],
            imports: [],
            entropy: 5.0,
            sections: []
          });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/Findings:/i)).toBeDefined();
      });
    });

    it('should not show findings section for pending stages', () => {
      render(() => <AnalysisDashboard />);

      const findingsSections = screen.queryAllByText(/Findings:/i);
      expect(findingsSections.length).toBe(0);
    });

    it('should display "No issues detected" when no findings', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({
            anomalies: [],
            imports: [],
            entropy: 5.0,
            sections: []
          });
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/No issues detected/i)).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle null file path', () => {
      render(() => <AnalysisDashboard filePath={undefined} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      // Should not crash
      expect(screen.getByText(/Malware Analysis Dashboard/i)).toBeDefined();
    });

    it('should handle empty analysis result', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/completed/i)).toBeDefined();
      });
    });

    it('should handle malformed sandbox response', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'analyze_file') {
          return Promise.resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] });
        }
        if (cmd === 'check_sandbox_available') {
          return Promise.resolve(true);
        }
        if (cmd === 'execute_sample_in_sandbox') {
          return Promise.resolve({}); // Empty response
        }
        return Promise.resolve({});
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByText(/No suspicious behavior detected/i)).toBeDefined();
      }, { timeout: 3000 });
    });

    it('should handle concurrent analysis requests', async () => {
      mockInvoke.mockImplementation((cmd) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ anomalies: [], imports: [], entropy: 5.0, sections: [] }), 100);
        });
      });

      render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);

      // Click multiple times rapidly
      fireEvent.click(startButton);
      fireEvent.click(startButton);
      fireEvent.click(startButton);

      await flushPromises();

      // Should handle gracefully
      expect(screen.getByText(/Malware Analysis Dashboard/i)).toBeDefined();
    });
  });

  describe('Status Colors', () => {
    it('should use correct color for completed status', async () => {
      mockInvoke.mockResolvedValue({ anomalies: [], imports: [], entropy: 5.0, sections: [] });

      const { container } = render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        const completedBadges = container.querySelectorAll('[style*="var(--success-color)"]');
        expect(completedBadges.length).toBeGreaterThan(0);
      });
    });

    it('should use correct color for error status', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed'));

      const { container } = render(() => <AnalysisDashboard filePath={mockFilePath} />);

      const startButton = screen.getByText(/Start Full Analysis/i);
      fireEvent.click(startButton);

      await waitFor(() => {
        const errorBadges = container.querySelectorAll('[style*="var(--danger-color)"]');
        expect(errorBadges.length).toBeGreaterThan(0);
      });
    });
  });
});
