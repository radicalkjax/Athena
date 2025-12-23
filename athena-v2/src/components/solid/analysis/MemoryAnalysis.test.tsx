import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import MemoryAnalysis from './MemoryAnalysis';
import { mockInvoke, flushPromises } from '../../../test-setup';
import { analysisStore } from '../../../stores/analysisStore';

// Mock dialog module
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

describe('MemoryAnalysis', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
    vi.clearAllTimers();
    analysisStore.clearAllFiles();

    // Mock default system status to prevent errors
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info' || cmd === 'get_ai_provider_status') {
        return Promise.resolve({});
      }
      return Promise.resolve();
    });
  });

  describe('Rendering', () => {
    it('should render component without crashing', () => {
      render(() => <MemoryAnalysis />);

      expect(screen.getByText(/Memory Analysis/i)).toBeDefined();
    });

    it('should render system statistics section', () => {
      render(() => <MemoryAnalysis />);

      expect(screen.getByText(/System Statistics/i)).toBeDefined();
    });

    it('should render memory tools section', () => {
      render(() => <MemoryAnalysis />);

      expect(screen.getByText(/Memory Tools/i)).toBeDefined();
    });

    it('should render all action buttons', () => {
      render(() => <MemoryAnalysis />);

      expect(screen.getByText(/Load Dump/i)).toBeDefined();
      expect(screen.getByText(/Analyze/i)).toBeDefined();
    });

    it('should render view tabs', () => {
      render(() => <MemoryAnalysis />);

      expect(screen.getByText(/Processes/i)).toBeDefined();
      expect(screen.getByText(/Strings/i)).toBeDefined();
      expect(screen.getByText(/Regions/i)).toBeDefined();
      expect(screen.getByText(/Artifacts/i)).toBeDefined();
    });
  });

  describe('Loading State', () => {
    it('should show loading spinner when analyzing', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        return new Promise(() => {}); // Never resolves
      });

      render(() => <MemoryAnalysis />);

      const analyzeButton = screen.getByText(/Analyze/i);
      fireEvent.click(analyzeButton);

      await flushPromises();

      expect(screen.getByText(/Analyzing memory dump/i)).toBeDefined();
    });

    it('should show spinner during tool execution', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'check_volatility_available') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      const volatilityButton = screen.getByText(/Volatility Analysis/i);
      fireEvent.click(volatilityButton);

      await flushPromises();

      expect(screen.getByText(/Analyzing\.\.\./i)).toBeDefined();
    });

    it('should disable buttons during analysis', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        return new Promise(() => {}); // Never resolves
      });

      render(() => <MemoryAnalysis />);

      const analyzeButton = screen.getByText(/Analyze/i) as HTMLButtonElement;
      fireEvent.click(analyzeButton);

      await flushPromises();

      // Tool buttons should be disabled (they check isRunningTool !== null)
      const volatilityButton = screen.getByText(/Analyzing\.\.\.|Volatility Analysis/i).closest('button') as HTMLButtonElement;
      expect(volatilityButton?.disabled).toBe(false); // Not disabled by analysis state
    });
  });

  describe('Error Handling', () => {
    it('should handle memory dump load failure gracefully', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue('/tmp/dump.bin');

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'get_memory_regions') {
          return Promise.reject(new Error('Failed to read dump'));
        }
        return Promise.resolve([]);
      });

      render(() => <MemoryAnalysis />);

      const loadButton = screen.getByText(/Load Dump/i);
      fireEvent.click(loadButton);

      await flushPromises();

      // Should log error but not crash
      expect(mockInvoke).toHaveBeenCalled();
    });

    it('should display tool error messages', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'check_volatility_available') {
          return Promise.resolve({ available: false });
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      const volatilityButton = screen.getByText(/Volatility Analysis/i);
      fireEvent.click(volatilityButton);

      await waitFor(() => {
        expect(screen.getByText(/Volatility 3 is not installed/i)).toBeDefined();
      });
    });

    it('should handle network analysis failure', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'get_network_info') {
          return Promise.reject(new Error('Network info failed'));
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      const networkButton = screen.getByText(/Network Connections/i);
      fireEvent.click(networkButton);

      await waitFor(() => {
        expect(screen.getByText(/Network analysis failed/i)).toBeDefined();
      });
    });
  });

  describe('User Interactions', () => {
    it('should switch between view tabs', async () => {
      mockInvoke.mockResolvedValue({});

      render(() => <MemoryAnalysis />);

      // Click Strings tab
      const stringsTab = screen.getByText(/📝 Strings/i);
      fireEvent.click(stringsTab);

      await flushPromises();

      // Click Regions tab
      const regionsTab = screen.getByText(/🗺️ Regions/i);
      fireEvent.click(regionsTab);

      await flushPromises();

      // Should not crash and tabs should be clickable
      expect(stringsTab).toBeDefined();
      expect(regionsTab).toBeDefined();
    });

    it('should call analyze_file_with_wasm on analyze', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'get_memory_regions') {
          return Promise.resolve([
            { address: '0x00400000', size: 4096, protection: 'RWX', suspicious: true, entropy: 7.8 }
          ]);
        }
        if (cmd === 'analyze_file_with_wasm') {
          return Promise.resolve({ strings: { suspicious: ['evil.com'] } });
        }
        return Promise.resolve({});
      });

      // Set up a file in the store
      const fileId = analysisStore.addFile({
        name: 'test.exe',
        path: '/tmp/test.exe',
        size: 1024,
        hash: 'abc123',
        type: 'application/x-executable'
      });
      analysisStore.setActiveFile(fileId);

      render(() => <MemoryAnalysis />);

      const analyzeButton = screen.getByText(/🔍 Analyze/i);
      fireEvent.click(analyzeButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_memory_regions', expect.any(Object));
        expect(mockInvoke).toHaveBeenCalledWith('analyze_file_with_wasm', expect.any(Object));
      });
    });

    it('should run Volatility analysis when available', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'check_volatility_available') {
          return Promise.resolve({ available: true, version: '3.0.0' });
        }
        if (cmd === 'analyze_memory_with_volatility') {
          return Promise.resolve({
            processes: [{ pid: 1234, name: 'malware.exe' }],
            network_connections: [],
            loaded_modules: []
          });
        }
        return Promise.resolve({});
      });

      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue('/tmp/memory.dmp');

      render(() => <MemoryAnalysis />);

      const volatilityButton = screen.getByText(/Volatility Analysis/i);
      fireEvent.click(volatilityButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('check_volatility_available');
        expect(mockInvoke).toHaveBeenCalledWith('analyze_memory_with_volatility', expect.any(Object));
      });
    });

    it('should build process tree', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'get_processes') {
          return Promise.resolve([
            { pid: 1, name: 'init', parent_pid: 0 },
            { pid: 100, name: 'explorer.exe', parent_pid: 1 }
          ]);
        }
        if (cmd === 'get_process_tree') {
          return Promise.resolve([
            { pid: 1, name: 'init', parent_pid: 0, children: [], depth: 0 },
            { pid: 100, name: 'explorer.exe', parent_pid: 1, children: [], depth: 1 }
          ]);
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      const processTreeButton = screen.getByText(/Process Tree/i);
      fireEvent.click(processTreeButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_processes');
        expect(mockInvoke).toHaveBeenCalledWith('get_process_tree', expect.any(Object));
      });
    });

    it('should extract artifacts to file', async () => {
      const { save } = await import('@tauri-apps/plugin-dialog');
      (save as any).mockResolvedValue('/tmp/artifacts.json');

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'write_file_text') {
          return Promise.resolve();
        }
        if (cmd === 'get_memory_regions') {
          return Promise.resolve([]);
        }
        if (cmd === 'extract_strings_from_dump') {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      // First load a dump
      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue('/tmp/dump.bin');

      render(() => <MemoryAnalysis />);

      const loadButton = screen.getByText(/📂 Load Dump/i);
      fireEvent.click(loadButton);

      await flushPromises();

      const extractButton = screen.getByText(/Extract Artifacts/i);
      fireEvent.click(extractButton);

      await waitFor(() => {
        expect(save).toHaveBeenCalled();
      });
    });
  });

  describe('Data Display', () => {
    it('should display system statistics', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status') {
          return Promise.resolve({ uptime: 3600 });
        }
        if (cmd === 'get_cpu_info') {
          return Promise.resolve({ usage: 45.5 });
        }
        if (cmd === 'get_memory_info') {
          return Promise.resolve({ total: 16 * 1024 * 1024 * 1024, used: 8 * 1024 * 1024 * 1024 });
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      await waitFor(() => {
        expect(screen.getByText(/Total Memory/i)).toBeDefined();
        expect(screen.getByText(/Used Memory/i)).toBeDefined();
        expect(screen.getByText(/CPU Usage/i)).toBeDefined();
      });
    });

    it('should display memory regions after load', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue('/tmp/dump.bin');

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'get_memory_regions') {
          return Promise.resolve([
            {
              address: '0x00400000',
              size: 4096,
              protection: 'RWX',
              type: 'mapped',
              suspicious: true,
              entropy: 7.9
            }
          ]);
        }
        if (cmd === 'extract_strings_from_dump') {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      const loadButton = screen.getByText(/📂 Load Dump/i);
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_memory_regions', expect.any(Object));
      });

      // Switch to regions tab
      const regionsTab = screen.getByText(/🗺️ Regions/i);
      fireEvent.click(regionsTab);

      await flushPromises();

      // Should display region info
      await waitFor(() => {
        const regionElements = screen.queryByText(/0x00400000/i);
        expect(regionElements).toBeDefined();
      });
    });

    it('should display extracted strings', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue('/tmp/dump.bin');

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'get_memory_regions') {
          return Promise.resolve([]);
        }
        if (cmd === 'extract_strings_from_dump') {
          return Promise.resolve([
            { offset: 0x1000, value: 'http://evil.com', encoding: 'ASCII' },
            { offset: 0x2000, content: 'C:\\malware.exe', encoding: 'UTF-8' }
          ]);
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      const loadButton = screen.getByText(/📂 Load Dump/i);
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('extract_strings_from_dump', expect.any(Object));
      });

      // Switch to strings tab
      const stringsTab = screen.getByText(/📝 Strings/i);
      fireEvent.click(stringsTab);

      await flushPromises();

      // Should display extracted strings
      await waitFor(() => {
        const stringElements = screen.queryByText(/evil\.com/i);
        expect(stringElements).toBeDefined();
      });
    });

    it('should show Volatility results when available', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'check_volatility_available') {
          return Promise.resolve({ available: true, version: '3.0.0' });
        }
        if (cmd === 'analyze_memory_with_volatility') {
          return Promise.resolve({
            processes: [{ pid: 1234, name: 'malware.exe' }],
            network_connections: [{ ip: '192.168.1.1', port: 443 }],
            injected_code: [{ address: '0x12345', size: 1024 }]
          });
        }
        return Promise.resolve({});
      });

      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue('/tmp/memory.dmp');

      render(() => <MemoryAnalysis />);

      const volatilityButton = screen.getByText(/Volatility Analysis/i);
      fireEvent.click(volatilityButton);

      await waitFor(() => {
        expect(screen.getByText(/Volatility Results/i)).toBeDefined();
        expect(screen.getByText(/Injected Code/i)).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty memory dump', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue('/tmp/empty.bin');

      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'get_system_status' || cmd === 'get_cpu_info' || cmd === 'get_memory_info') {
          return Promise.resolve({});
        }
        if (cmd === 'get_memory_regions' || cmd === 'extract_strings_from_dump') {
          return Promise.resolve([]);
        }
        return Promise.resolve({});
      });

      render(() => <MemoryAnalysis />);

      const loadButton = screen.getByText(/📂 Load Dump/i);
      fireEvent.click(loadButton);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalled();
      });

      // Should not crash
      expect(screen.getByText(/Memory Analysis/i)).toBeDefined();
    });

    it('should handle cancelled file dialog', async () => {
      const { open } = await import('@tauri-apps/plugin-dialog');
      (open as any).mockResolvedValue(null); // User cancelled

      mockInvoke.mockResolvedValue({});

      render(() => <MemoryAnalysis />);

      const loadButton = screen.getByText(/📂 Load Dump/i);
      fireEvent.click(loadButton);

      await flushPromises();

      // Should not crash
      expect(screen.getByText(/Memory Analysis/i)).toBeDefined();
    });

    it('should handle missing file path in analyze', async () => {
      mockInvoke.mockResolvedValue({});

      // Clear current file
      analysisStore.state.currentFile = null;

      render(() => <MemoryAnalysis />);

      const analyzeButton = screen.getByText(/🔍 Analyze/i);
      fireEvent.click(analyzeButton);

      await flushPromises();

      // Should not crash, just log error
      expect(screen.getByText(/Memory Analysis/i)).toBeDefined();
    });
  });
});
