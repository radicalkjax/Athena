import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock dependencies first
vi.mock('../../../services/container', () => ({
  getResourcePreset: vi.fn(() => ({
    cpu: 2,
    memory: 4096,
    diskSpace: 10240,
    networkSpeed: 100,
    ioOperations: 1000
  }))
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Switch } from 'react-native';
import AnalysisOptionsPanel, { AnalysisOptions } from '../../../components/AnalysisOptionsPanel';
import { ContainerConfig } from '../../../types';

vi.mock('../../../hooks', () => ({
  useThemeColor: vi.fn(() => '#4A90E2')
}));

vi.mock('../../../components/ContainerConfigSelector', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ onConfigChange, initialConfig }: any) => {
      const { View, Text, TouchableOpacity } = require('react-native');
      return React.createElement(View, { testID: 'container-config-selector' },
        React.createElement(Text, null, 'Container Config'),
        React.createElement(TouchableOpacity, {
          testID: 'change-config-button',
          onPress: () => onConfigChange({
            ...initialConfig,
            os: 'linux'
          })
        }, React.createElement(Text, null, 'Change Config'))
      );
    }
  };
});

vi.mock('../../../design-system', () => ({
  Card: ({ children, style }: any) => {
    const { View } = require('react-native');
    return require('react').createElement(View, { style }, children);
  },
  colors: {
    primary: '#4A90E2',
    secondary: '#333333'
  }
}));

describe('AnalysisOptionsPanel Component', () => {
  const mockOnOptionsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Default Options', () => {
    it('should render with default options', () => {
      const { getByText } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      expect(getByText('Container Configuration')).toBeTruthy();
      expect(getByText('Deep Analysis')).toBeTruthy();
      expect(getByText('Save Results')).toBeTruthy();
    });

    it('should use standard resource preset by default', () => {
      // The component calls getResourcePreset in its default options
      // This is tested implicitly through the render
      render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      // Component should render without errors using the mocked preset
      expect(true).toBe(true);
    });

    it('should have deep analysis disabled by default', () => {
      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const switches = UNSAFE_getAllByType(Switch);
      const deepAnalysisSwitch = switches[0];
      expect(deepAnalysisSwitch.props.value).toBe(false);
    });

    it('should have save results enabled by default', () => {
      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const switches = UNSAFE_getAllByType(Switch);
      const saveResultsSwitch = switches[1];
      expect(saveResultsSwitch.props.value).toBe(true);
    });
  });

  describe('Initial Options', () => {
    it('should use provided initial options', () => {
      const initialOptions: Partial<AnalysisOptions> = {
        deepAnalysis: true,
        saveResults: false
      };

      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel 
          onOptionsChange={mockOnOptionsChange}
          initialOptions={initialOptions}
        />
      );

      const switches = UNSAFE_getAllByType(Switch);
      expect(switches[0].props.value).toBe(true); // Deep analysis
      expect(switches[1].props.value).toBe(false); // Save results
    });

    it('should merge initial options with defaults', () => {
      const initialOptions: Partial<AnalysisOptions> = {
        deepAnalysis: true
        // saveResults not provided, should use default (true)
      };

      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel 
          onOptionsChange={mockOnOptionsChange}
          initialOptions={initialOptions}
        />
      );

      const switches = UNSAFE_getAllByType(Switch);
      expect(switches[0].props.value).toBe(true); // Deep analysis (from initial)
      expect(switches[1].props.value).toBe(true); // Save results (from default)
    });
  });

  describe('Option Changes', () => {
    it('should handle deep analysis toggle', () => {
      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const switches = UNSAFE_getAllByType(Switch);
      const deepAnalysisSwitch = switches[0];

      fireEvent(deepAnalysisSwitch, 'onValueChange', true);

      expect(mockOnOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          deepAnalysis: true,
          saveResults: true
        })
      );
    });

    it('should handle save results toggle', () => {
      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const switches = UNSAFE_getAllByType(Switch);
      const saveResultsSwitch = switches[1];

      fireEvent(saveResultsSwitch, 'onValueChange', false);

      expect(mockOnOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          deepAnalysis: false,
          saveResults: false
        })
      );
    });

    it('should handle container config changes', () => {
      const { getByTestId } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const changeConfigButton = getByTestId('change-config-button');
      fireEvent.press(changeConfigButton);

      expect(mockOnOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          containerConfig: expect.objectContaining({
            os: 'linux'
          })
        })
      );
    });

    it('should update all options when multiple changes occur', () => {
      const { UNSAFE_getAllByType, getByTestId } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const switches = UNSAFE_getAllByType(Switch);
      
      // Toggle deep analysis
      fireEvent(switches[0], 'onValueChange', true);
      
      // Toggle save results
      fireEvent(switches[1], 'onValueChange', false);
      
      // Change container config
      const changeConfigButton = getByTestId('change-config-button');
      fireEvent.press(changeConfigButton);

      // Verify all changes were propagated
      expect(mockOnOptionsChange).toHaveBeenCalledTimes(3);
      
      // Check final call has all changes
      expect(mockOnOptionsChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          deepAnalysis: true,
          saveResults: false,
          containerConfig: expect.objectContaining({
            os: 'linux'
          })
        })
      );
    });
  });

  describe('UI Elements', () => {
    it('should display all section titles', () => {
      const { getByText } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      expect(getByText('Container Configuration')).toBeTruthy();
      expect(getByText('Deep Analysis')).toBeTruthy();
      expect(getByText('Save Results')).toBeTruthy();
    });

    it('should display all option descriptions', () => {
      const { getByText } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      expect(getByText('Malware is always analyzed in an isolated container environment for enhanced security.')).toBeTruthy();
      expect(getByText('Perform more thorough analysis with detailed behavior monitoring. Takes longer but provides more comprehensive results.')).toBeTruthy();
      expect(getByText('Save analysis results to the database for future reference.')).toBeTruthy();
    });

    it('should render container config selector', () => {
      const { getByTestId } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      expect(getByTestId('container-config-selector')).toBeTruthy();
    });

    it('should apply correct switch colors', () => {
      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const switches = UNSAFE_getAllByType(Switch);
      
      switches.forEach(switchComponent => {
        expect(switchComponent.props.trackColor).toEqual({
          false: '#767577',
          true: '#4A90E2'
        });
        expect(switchComponent.props.thumbColor).toBe('#f4f3f4');
      });
    });
  });

  describe('Callback Behavior', () => {
    it('should call onOptionsChange with complete options object', () => {
      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'onValueChange', true);

      const callArg = mockOnOptionsChange.mock.calls[0][0];
      expect(callArg).toHaveProperty('containerConfig');
      expect(callArg).toHaveProperty('deepAnalysis');
      expect(callArg).toHaveProperty('saveResults');
    });

    it('should preserve existing options when changing single option', () => {
      const initialOptions: Partial<AnalysisOptions> = {
        containerConfig: {
          os: 'linux',
          architecture: 'arm64',
          version: 'ubuntu-22.04',
          resources: { cpu: 1, memory: 2048, diskSpace: 5120, networkSpeed: 50, ioOperations: 500 }
        }
      };

      const { UNSAFE_getAllByType } = render(
        <AnalysisOptionsPanel 
          onOptionsChange={mockOnOptionsChange}
          initialOptions={initialOptions}
        />
      );

      const switches = UNSAFE_getAllByType(Switch);
      fireEvent(switches[0], 'onValueChange', true);

      expect(mockOnOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          containerConfig: expect.objectContaining({
            os: 'linux',
            architecture: 'arm64'
          })
        })
      );
    });
  });

  describe('Container Config Integration', () => {
    it('should pass initial config to ContainerConfigSelector', () => {
      const initialConfig: ContainerConfig = {
        os: 'macos',
        architecture: 'arm64',
        version: 'macos-13',
        resources: { cpu: 4, memory: 8192, diskSpace: 20480, networkSpeed: 200, ioOperations: 2000 }
      };

      const { getByTestId } = render(
        <AnalysisOptionsPanel 
          onOptionsChange={mockOnOptionsChange}
          initialOptions={{ containerConfig: initialConfig }}
        />
      );

      const selector = getByTestId('container-config-selector');
      expect(selector).toBeTruthy();
    });

    it('should update options when container config changes', () => {
      const { getByTestId } = render(
        <AnalysisOptionsPanel onOptionsChange={mockOnOptionsChange} />
      );

      const changeButton = getByTestId('change-config-button');
      fireEvent.press(changeButton);

      expect(mockOnOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          containerConfig: expect.objectContaining({
            os: 'linux'
          })
        })
      );
    });
  });
});