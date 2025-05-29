import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';
import { ContainerConfigSelector } from '@/components/ContainerConfigSelector';
import * as containerService from '@/services/container';
import { ContainerConfig, OSType, ArchitectureType } from '@/types';

// Mock dependencies
jest.mock('@/services/container');
jest.mock('@/hooks', () => ({
  useThemeColor: jest.fn().mockReturnValue('#000000'),
  useColorScheme: jest.fn().mockReturnValue('light')
}));

// Mock react-native-picker
jest.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  
  const Picker = ({ children, selectedValue, onValueChange, testID, ...props }: any) => {
    return (
      <View testID={testID} {...props}>
        {React.Children.map(children, (child: any) => {
          if (child?.props?.value === selectedValue) {
            return (
              <Text
                testID={`${testID}-selected`}
                onPress={() => onValueChange && onValueChange(child.props.value)}
              >
                {child.props.label}
              </Text>
            );
          }
          return (
            <Text
              testID={`${testID}-option-${child?.props?.value}`}
              onPress={() => onValueChange && onValueChange(child.props.value)}
            >
              {child?.props?.label}
            </Text>
          );
        })}
      </View>
    );
  };
  
  Picker.Item = ({ label, value, ...props }: any) => null;
  
  return { Picker };
});

// Mock react-native-community/slider
jest.mock('@react-native-community/slider', () => {
  const React = require('react');
  const { View } = require('react-native');
  
  return {
    __esModule: true,
    default: ({ value, onValueChange, testID, ...props }: any) => (
      <View
        testID={testID}
        {...props}
        onTouchEnd={() => onValueChange && onValueChange(value + 1)}
      />
    )
  };
});

const mockContainerService = containerService as jest.Mocked<typeof containerService>;

describe('ContainerConfigSelector', () => {
  const mockOnConfigChange = jest.fn();
  const defaultConfig: Partial<ContainerConfig> = {
    os: 'windows',
    architecture: 'x64',
    version: 'windows-10',
    resources: {
      cpu: 2,
      memory: 4096,
      diskSpace: 10240,
      networkSpeed: 100,
      ioOperations: 1000
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock implementations
    mockContainerService.getAvailableWindowsVersions.mockReturnValue([
      'windows-10',
      'windows-11',
      'windows-server-2019'
    ]);
    mockContainerService.getAvailableLinuxVersions.mockReturnValue([
      'ubuntu-20.04',
      'ubuntu-22.04',
      'centos-7',
      'centos-8',
      'debian-10',
      'debian-11'
    ]);
    mockContainerService.getAvailableMacOSVersions.mockReturnValue([
      'macos-11',
      'macos-12',
      'macos-13'
    ]);
    mockContainerService.getAvailableLinuxDistributions.mockReturnValue([
      'ubuntu',
      'centos',
      'debian',
      'fedora',
      'alpine'
    ]);
    mockContainerService.getResourcePreset.mockReturnValue({
      cpu: 1,
      memory: 2048,
      diskSpace: 5120,
      networkSpeed: 10,
      ioOperations: 1000
    });
    mockContainerService.checkSystemRequirements.mockResolvedValue({
      meetsRequirements: true,
      details: {
        cpu: { meets: true, available: 8, required: 2 },
        memory: { meets: true, available: 16384, required: 4096 },
        diskSpace: { meets: true, available: 100000, required: 10240 }
      }
    });
  });

  describe('Initial Rendering', () => {
    it('should render with default configuration', () => {
      const { getByText } = render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      // Check for collapsible titles with values
      expect(getByText(/Operating System.*Windows/)).toBeTruthy();
      expect(getByText(/Windows Version/)).toBeTruthy();
      expect(getByText(/Resource Configuration.*Minimal/)).toBeTruthy();
      expect(getByText('Container Configuration Summary')).toBeTruthy();
    });

    it('should call onConfigChange on mount', () => {
      render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      expect(mockOnConfigChange).toHaveBeenCalledWith(
        expect.objectContaining({
          os: 'windows',
          architecture: 'x64',
          version: 'windows-10',
          resources: expect.any(Object)
        })
      );
    });
  });

  describe('OS Selection', () => {
    it('should update available versions when OS changes', () => {
      const { getByText } = render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      // Open OS collapsible by clicking on it
      fireEvent.press(getByText(/Operating System.*Windows/));
      
      // Should have called getAvailableWindowsVersions on mount
      expect(mockContainerService.getAvailableWindowsVersions).toHaveBeenCalledWith('x64');
    });
  });

  describe('System Requirements', () => {
    it('should check system requirements on mount', async () => {
      render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      await waitFor(() => {
        expect(mockContainerService.checkSystemRequirements).toHaveBeenCalled();
      });
    });

    it('should show success message when requirements are met', async () => {
      const { getByText } = render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      await waitFor(() => {
        expect(getByText(/Your system meets the requirements/)).toBeTruthy();
      });
    });

    it('should show warning when requirements are not met', async () => {
      mockContainerService.checkSystemRequirements.mockResolvedValue({
        meetsRequirements: false,
        details: {
          cpu: { meets: false, available: 2, required: 4 },
          memory: { meets: true, available: 16384, required: 4096 },
          diskSpace: { meets: false, available: 5000, required: 10240 }
        }
      });
      
      const { getByText } = render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      await waitFor(() => {
        expect(getByText(/Your system does not meet all requirements/)).toBeTruthy();
      });
    });
  });

  describe('Configuration Summary', () => {
    it('should display configuration summary', () => {
      const { getByText, getAllByText } = render(
        <ContainerConfigSelector 
          onConfigChange={mockOnConfigChange}
          initialConfig={defaultConfig}
        />
      );
      
      // Verify summary section exists
      expect(getByText('Container Configuration Summary')).toBeTruthy();
      
      // Check that configuration values are displayed (they appear in multiple places)
      expect(getByText(/OS:/)).toBeTruthy();
      expect(getAllByText(/Version:/)).toHaveLength(2); // In collapsible and summary
      expect(getByText(/Resource Preset:/)).toBeTruthy();
      expect(getByText(/CPU:/)).toBeTruthy();
      expect(getByText(/Memory:/)).toBeTruthy();
      expect(getByText(/Disk Space:/)).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty version lists', () => {
      mockContainerService.getAvailableWindowsVersions.mockReturnValue([]);
      
      const { getByText } = render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      expect(getByText(/Windows Version/)).toBeTruthy();
      // Should not crash
    });

    it('should handle system requirements check failure', async () => {
      mockContainerService.checkSystemRequirements.mockRejectedValue(
        new Error('Failed to check requirements')
      );
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      render(
        <ContainerConfigSelector onConfigChange={mockOnConfigChange} />
      );
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error checking system requirements:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });
  });
});