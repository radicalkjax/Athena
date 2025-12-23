import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import YaraScanner from './YaraScanner';
import { mockInvoke, flushPromises } from '../../../test-setup';
import { analysisStore } from '../../../stores/analysisStore';

describe('YaraScanner', () => {
  const mockLocalStorage = (() => {
    let store: Record<string, string> = {};
    return {
      getItem: vi.fn((key: string) => store[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value;
      }),
      clear: vi.fn(() => {
        store = {};
      }),
    };
  })();

  beforeEach(() => {
    mockInvoke.mockClear();
    analysisStore.clearAllFiles();

    // Mock default commands
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_ai_provider_status') {
        return Promise.resolve({});
      }
      if (cmd === 'initialize_yara_scanner' || cmd === 'load_default_yara_rules') {
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    mockLocalStorage.clear();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(() => <YaraScanner />);

      expect(screen.getByText(/YARA Rules/i)).toBeDefined();
    });

    it('should render rule editor', () => {
      render(() => <YaraScanner />);

      expect(screen.getByText(/YARA Rule Editor/i)).toBeDefined();
    });

    it('should render default YARA rule template', () => {
      render(() => <YaraScanner />);

      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('rule My_Custom_Rule');
      expect(textarea.value).toContain('meta:');
      expect(textarea.value).toContain('strings:');
      expect(textarea.value).toContain('condition:');
    });

    it('should render action buttons', () => {
      render(() => <YaraScanner />);

      expect(screen.getByText(/➕ New/i)).toBeDefined();
      expect(screen.getByText(/📄 Save/i)).toBeDefined();
      expect(screen.getByText(/✅ Test Rule/i)).toBeDefined();
    });

    it('should render scanner status section', () => {
      render(() => <YaraScanner />);

      expect(screen.getByText(/Scanner Status/i)).toBeDefined();
    });

    it('should render saved rules section', () => {
      render(() => <YaraScanner />);

      expect(screen.getByText(/Saved Rules/i)).toBeDefined();
    });
  });

  describe('Loading State', () => {
    it('should show "Initializing..." when scanner not ready', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'initialize_yara_scanner') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      await flushPromises();

      expect(screen.getByText(/Initializing\.\.\./i)).toBeDefined();
    });

    it('should show "Testing..." when rule is being tested', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await flushPromises();

      expect(screen.getByText(/⏳ Testing\.\.\./i)).toBeDefined();
    });

    it('should show "Scanning..." when actively scanning', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'initialize_yara_scanner' || cmd === 'load_default_yara_rules') {
          return Promise.resolve();
        }
        if (cmd === 'scan_file_with_yara') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve();
      });

      // Set up a file for scanning
      analysisStore.addFile({
        name: 'test.exe',
        path: '/tmp/test.exe',
        size: 1024,
        hash: 'abc123',
        type: 'application/x-executable'
      });

      render(() => <YaraScanner />);

      await flushPromises();

      expect(screen.getByText(/⏳ Scanning\.\.\./i)).toBeDefined();
    });

    it('should disable test button during testing', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return new Promise(() => {}); // Never resolves
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const testButton = screen.getByText(/✅ Test Rule/i) as HTMLButtonElement;
      fireEvent.click(testButton);

      await flushPromises();

      const disabledButton = screen.getByText(/⏳ Testing\.\.\./i).closest('button') as HTMLButtonElement;
      expect(disabledButton.disabled).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should display error when testing empty rule', async () => {
      render(() => <YaraScanner />);

      // Clear the textarea
      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      fireEvent.input(textarea, { target: { value: '' } });

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await flushPromises();

      expect(screen.getByText(/Please enter a YARA rule to test/i)).toBeDefined();
    });

    it('should display error when rule validation fails', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return Promise.reject(new Error('Syntax error on line 5'));
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Rule validation failed/i)).toBeDefined();
      });
    });

    it('should display error when saving empty rule', async () => {
      render(() => <YaraScanner />);

      // Clear the textarea
      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      fireEvent.input(textarea, { target: { value: '' } });

      const saveButton = screen.getByText(/📄 Save/i);
      fireEvent.click(saveButton);

      await flushPromises();

      expect(screen.getByText(/No rule to save/i)).toBeDefined();
    });

    it('should handle scan failure gracefully', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'initialize_yara_scanner' || cmd === 'load_default_yara_rules') {
          return Promise.resolve();
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.reject(new Error('Scan failed'));
        }
        return Promise.resolve();
      });

      analysisStore.addFile({
        name: 'test.exe',
        path: '/tmp/test.exe',
        size: 1024,
        hash: 'abc123',
        type: 'application/x-executable'
      });

      render(() => <YaraScanner />);

      await flushPromises();

      // Should not crash
      expect(screen.getByText(/YARA Rules/i)).toBeDefined();
    });

    it('should clear error on new test', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return Promise.resolve({ compilation: 'Success', string_count: 2 });
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      // First, trigger an error
      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      fireEvent.input(textarea, { target: { value: '' } });

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await flushPromises();
      expect(screen.getByText(/Please enter a YARA rule to test/i)).toBeDefined();

      // Now test a valid rule
      fireEvent.input(textarea, { target: { value: 'rule Test { condition: true }' } });
      fireEvent.click(testButton);

      await waitFor(() => {
        const errorElement = screen.queryByText(/Please enter a YARA rule to test/i);
        expect(errorElement).toBeNull();
      });
    });
  });

  describe('User Interactions', () => {
    it('should update rule text when typing', () => {
      render(() => <YaraScanner />);

      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      const newRule = 'rule NewRule { condition: true }';

      fireEvent.input(textarea, { target: { value: newRule } });

      expect(textarea.value).toBe(newRule);
    });

    it('should test rule and show results', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return Promise.resolve({
            compilation: 'Success',
            string_count: 3,
            warnings: [],
            errors: []
          });
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/TEST RESULTS/i)).toBeDefined();
        expect(screen.getByText(/✅ Compilation:/i)).toBeDefined();
      });
    });

    it('should save rule to localStorage and download', async () => {
      // Mock URL.createObjectURL and click
      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = vi.fn();

      const mockClick = vi.fn();
      const mockLink = { click: mockClick, href: '', download: '' };
      vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);

      render(() => <YaraScanner />);

      const saveButton = screen.getByText(/📄 Save/i);
      fireEvent.click(saveButton);

      await flushPromises();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'athena-yara-rules',
        expect.stringContaining('My_Custom_Rule')
      );
      expect(mockClick).toHaveBeenCalled();
    });

    it('should load saved rule when clicked', async () => {
      const savedRule = {
        name: 'TestRule',
        content: 'rule TestRule { condition: true }'
      };

      mockLocalStorage.setItem('athena-yara-rules', JSON.stringify([savedRule]));

      render(() => <YaraScanner />);

      await flushPromises();

      const ruleLink = screen.getByText(/TestRule/i);
      fireEvent.click(ruleLink);

      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe(savedRule.content);
    });

    it('should delete saved rule', async () => {
      const savedRules = [
        { name: 'Rule1', content: 'rule Rule1 { condition: true }' },
        { name: 'Rule2', content: 'rule Rule2 { condition: true }' }
      ];

      mockLocalStorage.setItem('athena-yara-rules', JSON.stringify(savedRules));

      render(() => <YaraScanner />);

      await flushPromises();

      const deleteButtons = screen.getAllByText('×');
      fireEvent.click(deleteButtons[0]);

      await flushPromises();

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'athena-yara-rules',
        expect.stringContaining('Rule2')
      );
    });

    it('should create new rule template', async () => {
      render(() => <YaraScanner />);

      // Modify the existing rule
      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      fireEvent.input(textarea, { target: { value: 'modified rule' } });

      // Click New button
      const newButton = screen.getByText(/➕ New/i);
      fireEvent.click(newButton);

      await flushPromises();

      // Should reset to new template
      expect(textarea.value).toContain('rule New_Rule');
    });

    it('should scan file automatically when uploaded', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'initialize_yara_scanner') {
          return Promise.resolve();
        }
        if (cmd === 'load_default_yara_rules') {
          return Promise.resolve();
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({
            matches: [
              { rule_name: 'MalwareDetection', offset: 0x1000 }
            ]
          });
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      await flushPromises();

      // Simulate file upload by adding to store
      analysisStore.addFile({
        name: 'malware.exe',
        path: '/tmp/malware.exe',
        size: 2048,
        hash: 'def456',
        type: 'application/x-executable'
      });

      // Trigger effect by forcing a re-render
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('scan_file_with_yara', expect.any(Object));
      }, { timeout: 2000 });
    });
  });

  describe('Rule Validation', () => {
    it('should show recommendations for simple rules', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return Promise.resolve({
            compilation: 'Success',
            string_count: 1,
            warnings: [],
            errors: []
          });
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      fireEvent.input(textarea, { target: { value: 'rule Simple { strings: $a = "test" condition: $a }' } });

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/RECOMMENDATIONS/i)).toBeDefined();
        expect(screen.getByText(/Add more specific strings/i)).toBeDefined();
      });
    });

    it('should calculate false positive risk based on string count', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return Promise.resolve({
            compilation: 'Success',
            string_count: 5,
            warnings: [],
            errors: []
          });
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/⚠️ FP Risk:/i)).toBeDefined();
        expect(screen.getByText(/Low/i)).toBeDefined();
      });
    });

    it('should display compilation errors', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return Promise.reject(new Error('syntax error: unexpected token'));
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/Failed/i)).toBeDefined();
      });
    });

    it('should show performance metrics', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'validate_yara_rule') {
          return Promise.resolve({
            compilation: 'Success',
            string_count: 3,
            warnings: [],
            errors: []
          });
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      const testButton = screen.getByText(/✅ Test Rule/i);
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/⚡ Performance:/i)).toBeDefined();
        expect(screen.getByText(/Good/i)).toBeDefined();
      });
    });
  });

  describe('Scanner Status', () => {
    it('should show scanner initialization status', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'initialize_yara_scanner') {
          return Promise.resolve();
        }
        if (cmd === 'load_default_yara_rules') {
          return Promise.resolve();
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      await waitFor(() => {
        expect(screen.getByText(/✅ Scanner Ready/i)).toBeDefined();
        expect(screen.getByText(/✅ Rules Loaded/i)).toBeDefined();
      });
    });

    it('should show match count after scan', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'initialize_yara_scanner' || cmd === 'load_default_yara_rules') {
          return Promise.resolve();
        }
        if (cmd === 'scan_file_with_yara') {
          return Promise.resolve({
            matches: [
              { rule_name: 'Rule1' },
              { rule_name: 'Rule2' }
            ]
          });
        }
        return Promise.resolve();
      });

      analysisStore.addFile({
        name: 'test.exe',
        path: '/tmp/test.exe',
        size: 1024,
        hash: 'abc123',
        type: 'application/x-executable'
      });

      render(() => <YaraScanner />);

      await waitFor(() => {
        expect(screen.getByText(/Matches: 2/i)).toBeDefined();
      }, { timeout: 2000 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle corrupted localStorage data', () => {
      mockLocalStorage.setItem('athena-yara-rules', 'invalid json{');

      render(() => <YaraScanner />);

      // Should not crash
      expect(screen.getByText(/YARA Rules/i)).toBeDefined();
    });

    it('should handle empty saved rules array', () => {
      mockLocalStorage.setItem('athena-yara-rules', '[]');

      render(() => <YaraScanner />);

      expect(screen.getByText(/No saved rules yet/i)).toBeDefined();
    });

    it('should handle rule with missing name', async () => {
      render(() => <YaraScanner />);

      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      fireEvent.input(textarea, { target: { value: 'strings: $a = "test" condition: $a' } });

      const saveButton = screen.getByText(/📄 Save/i);
      fireEvent.click(saveButton);

      await flushPromises();

      // Should use timestamp as fallback
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should handle scanner initialization failure', async () => {
      mockInvoke.mockImplementation((cmd) => {
        if (cmd === 'initialize_yara_scanner') {
          return Promise.reject(new Error('Scanner init failed'));
        }
        return Promise.resolve();
      });

      render(() => <YaraScanner />);

      await flushPromises();

      // Should still render, just not be ready
      expect(screen.getByText(/YARA Rules/i)).toBeDefined();
    });

    it('should update existing rule when saving with same name', async () => {
      const ruleName = 'DuplicateRule';
      const existingRules = [
        { name: ruleName, content: 'rule DuplicateRule { condition: false }' }
      ];

      mockLocalStorage.setItem('athena-yara-rules', JSON.stringify(existingRules));

      render(() => <YaraScanner />);

      const textarea = screen.getByPlaceholderText(/Enter your YARA rule here/i) as HTMLTextAreaElement;
      fireEvent.input(textarea, { target: { value: 'rule DuplicateRule { condition: true }' } });

      const saveButton = screen.getByText(/📄 Save/i);
      fireEvent.click(saveButton);

      await flushPromises();

      const savedRulesArg = mockLocalStorage.setItem.mock.calls.find(
        call => call[0] === 'athena-yara-rules'
      )?.[1];

      const parsedRules = JSON.parse(savedRulesArg || '[]');
      expect(parsedRules.length).toBe(1); // Should not duplicate
      expect(parsedRules[0].content).toContain('condition: true'); // Should be updated
    });
  });
});
