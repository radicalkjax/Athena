/**
 * Integration Test: Container Configuration and Deployment Flow
 * Tests the complete flow of configuring a container and deploying malware for analysis
 */

import React from 'react';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { renderWithProviders, resetStores, mockServices, generateContainerConfig, generateMalwareFile } from './setup';
import { ContainerConfigSelector } from '@/components/ContainerConfigSelector';
import { ContainerMonitoring } from '@/components/ContainerMonitoring';
import { useAppStore } from '@/store';
import * as containerService from '@/services/container';
import * as monitoringService from '@/services/monitoring';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/design-system';

// Mock dependencies
jest.mock('@/services/container');
jest.mock('@/services/monitoring');
jest.mock('@/services/fileManager');
jest.mock('@/hooks', () => ({
  useColorScheme: jest.fn().mockReturnValue('light'),
  useThemeColor: jest.fn().mockReturnValue('#000000')
}));
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialIcons: () => null,
  FontAwesome: () => null
}));

// Container deployment flow component
const ContainerDeploymentFlow = () => {
  const { 
    selectedMalwareId,
    malwareFiles,
    containerConfig,
    setContainerConfig 
  } = useAppStore();

  const [container, setContainer] = React.useState<any>(null);
  const [deploymentStatus, setDeploymentStatus] = React.useState<string>('');
  const [isDeploying, setIsDeploying] = React.useState(false);
  const [metrics, setMetrics] = React.useState<any>(null);

  const handleConfigChange = (config: any) => {
    setContainerConfig(config);
  };

  const handleCreateContainer = async () => {
    if (!containerConfig) return;

    setIsDeploying(true);
    setDeploymentStatus('Creating container...');
    
    try {
      // Create container
      const newContainer = await containerService.createContainer(containerConfig);
      setContainer(newContainer);
      setDeploymentStatus('Container created successfully');

      // Deploy malware file if selected
      if (selectedMalwareId) {
        const file = malwareFiles.find(f => f.id === selectedMalwareId);
        if (file) {
          setDeploymentStatus('Deploying malware file...');
          await containerService.deployFile(newContainer.id, file);
          setDeploymentStatus('Malware deployed successfully');
        }
      }

      // Start monitoring
      setDeploymentStatus('Starting monitoring...');
      await monitoringService.startMonitoring(newContainer.id, (newMetrics) => {
        setMetrics(newMetrics);
      });
      setDeploymentStatus('Container ready for analysis');

    } catch (error) {
      setDeploymentStatus(`Error: ${error.message}`);
      console.error('Container deployment failed:', error);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleStopContainer = async () => {
    if (!container) return;

    try {
      await monitoringService.stopMonitoring(container.id);
      await containerService.stopContainer(container.id);
      setContainer(null);
      setMetrics(null);
      setDeploymentStatus('Container stopped');
    } catch (error) {
      console.error('Failed to stop container:', error);
    }
  };

  return (
    <ThemedView testID="container-deployment-flow">
      {!container ? (
        <>
          <ThemedView testID="config-section">
            <ThemedText>Configure Analysis Container</ThemedText>
            <ContainerConfigSelector
              onChange={handleConfigChange}
              initialConfig={containerConfig || generateContainerConfig()}
            />
          </ThemedView>

          {containerConfig && (
            <ThemedView testID="deployment-section">
              <Button
                variant="primary"
                onPress={handleCreateContainer}
                disabled={isDeploying}
                testID="create-container-button"
              >
                Create Container
              </Button>
              {deploymentStatus && (
                <ThemedText testID="deployment-status">{deploymentStatus}</ThemedText>
              )}
            </ThemedView>
          )}
        </>
      ) : (
        <ThemedView testID="monitoring-section">
          <ThemedText>Container Status: Running</ThemedText>
          <ThemedText testID="container-id">ID: {container.id}</ThemedText>
          
          {metrics && (
            <ContainerMonitoring
              containerId={container.id}
              initialMetrics={metrics}
            />
          )}
          
          <Button
            variant="secondary"
            onPress={handleStopContainer}
            testID="stop-container-button"
          >
            Stop Container
          </Button>
        </ThemedView>
      )}
    </ThemedView>
  );
};

describe('Container Configuration and Deployment Flow', () => {
  beforeEach(() => {
    resetStores();
    jest.clearAllMocks();
    
    // Setup service mocks
    Object.assign(containerService, mockServices.containerService);
    Object.assign(monitoringService, {
      startMonitoring: jest.fn().mockImplementation((containerId, callback) => {
        // Simulate periodic metrics updates
        const interval = setInterval(() => {
          callback({
            cpuUsage: Math.random() * 100,
            memoryUsage: Math.random() * 100,
            networkActivity: [
              { type: 'outbound', bytes: Math.floor(Math.random() * 1000) }
            ],
            timestamp: new Date().toISOString()
          });
        }, 1000);
        
        return () => clearInterval(interval);
      }),
      stopMonitoring: jest.fn().mockResolvedValue(undefined)
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Basic Container Configuration', () => {
    it('should configure and create a container', async () => {
      const { getByTestId, getByText } = renderWithProviders(<ContainerDeploymentFlow />);

      // Step 1: Verify initial configuration UI
      expect(getByTestId('config-section')).toBeTruthy();
      expect(getByText('Configure Analysis Container')).toBeTruthy();

      // Step 2: Select OS
      fireEvent.press(getByText('Linux'));
      
      // Step 3: Select resource preset
      fireEvent.press(getByText('Standard'));

      // Step 4: Verify deployment section appears
      await waitFor(() => {
        expect(getByTestId('deployment-section')).toBeTruthy();
      });

      // Step 5: Create container
      const createButton = getByTestId('create-container-button');
      fireEvent.press(createButton);

      // Step 6: Verify deployment status updates
      await waitFor(() => {
        expect(getByText('Creating container...')).toBeTruthy();
      });

      await waitFor(() => {
        expect(getByText('Container ready for analysis')).toBeTruthy();
      }, { timeout: 5000 });

      // Step 7: Verify monitoring section appears
      expect(getByTestId('monitoring-section')).toBeTruthy();
      expect(getByTestId('container-id')).toBeTruthy();
      expect(getByText(/ID: container-123/)).toBeTruthy();
    });

    it('should handle different OS configurations', async () => {
      const { getByText, getByTestId } = renderWithProviders(<ContainerDeploymentFlow />);

      // Test Windows configuration
      fireEvent.press(getByText('Windows'));
      fireEvent.press(getByText('High Performance'));
      
      await waitFor(() => expect(getByTestId('deployment-section')).toBeTruthy());
      fireEvent.press(getByTestId('create-container-button'));

      await waitFor(() => {
        expect(containerService.createContainer).toHaveBeenCalledWith(
          expect.objectContaining({
            os: 'windows',
            resourcePreset: 'performance'
          })
        );
      });

      // Verify container was created with correct config
      const containerCall = (containerService.createContainer as jest.Mock).mock.calls[0][0];
      expect(containerCall.cpuCores).toBe(4); // High performance preset
      expect(containerCall.memoryGB).toBe(8);
    });
  });

  describe('Container with Malware Deployment', () => {
    it('should deploy malware file to container', async () => {
      // Pre-populate store with a malware file
      const malwareFile = generateMalwareFile({ id: 'malware-1', name: 'test-virus.exe' });
      useAppStore.setState({
        malwareFiles: [malwareFile],
        selectedMalwareId: 'malware-1'
      });

      const { getByTestId, getByText } = renderWithProviders(<ContainerDeploymentFlow />);

      // Configure container
      fireEvent.press(getByText('Linux'));
      fireEvent.press(getByText('Standard'));

      // Create container
      await waitFor(() => expect(getByTestId('create-container-button')).toBeTruthy());
      fireEvent.press(getByTestId('create-container-button'));

      // Verify deployment sequence
      await waitFor(() => expect(getByText('Creating container...')).toBeTruthy());
      await waitFor(() => expect(getByText('Deploying malware file...')).toBeTruthy());
      await waitFor(() => expect(getByText('Malware deployed successfully')).toBeTruthy());
      await waitFor(() => expect(getByText('Container ready for analysis')).toBeTruthy());

      // Verify service calls
      expect(containerService.deployFile).toHaveBeenCalledWith(
        'container-123',
        expect.objectContaining({
          id: 'malware-1',
          name: 'test-virus.exe'
        })
      );
    });
  });

  describe('Container Monitoring', () => {
    it('should display real-time metrics', async () => {
      const { getByTestId, getByText } = renderWithProviders(<ContainerDeploymentFlow />);

      // Quick path to container creation
      fireEvent.press(getByText('Linux'));
      fireEvent.press(getByText('Standard'));
      fireEvent.press(getByTestId('create-container-button'));

      // Wait for container to be ready
      await waitFor(() => expect(getByTestId('monitoring-section')).toBeTruthy());

      // Verify monitoring was started
      expect(monitoringService.startMonitoring).toHaveBeenCalledWith(
        'container-123',
        expect.any(Function)
      );

      // Wait for metrics to appear
      await waitFor(() => {
        const cpuElement = getByTestId('cpu-usage');
        expect(cpuElement).toBeTruthy();
      }, { timeout: 2000 });

      // Verify metrics are displayed
      expect(getByTestId('memory-usage')).toBeTruthy();
      expect(getByTestId('network-activity')).toBeTruthy();
    });

    it('should stop container and monitoring', async () => {
      const { getByTestId, getByText, queryByTestId } = renderWithProviders(<ContainerDeploymentFlow />);

      // Create container
      fireEvent.press(getByText('Linux'));
      fireEvent.press(getByText('Standard'));
      fireEvent.press(getByTestId('create-container-button'));

      await waitFor(() => expect(getByTestId('monitoring-section')).toBeTruthy());

      // Stop container
      const stopButton = getByTestId('stop-container-button');
      fireEvent.press(stopButton);

      // Verify services were called
      await waitFor(() => {
        expect(monitoringService.stopMonitoring).toHaveBeenCalledWith('container-123');
        expect(containerService.stopContainer).toHaveBeenCalledWith('container-123');
      });

      // Verify UI returns to configuration
      await waitFor(() => {
        expect(queryByTestId('monitoring-section')).toBeFalsy();
        expect(getByTestId('config-section')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle container creation failure', async () => {
      containerService.createContainer = jest.fn().mockRejectedValueOnce(
        new Error('Insufficient resources')
      );

      const { getByTestId, getByText } = renderWithProviders(<ContainerDeploymentFlow />);

      fireEvent.press(getByText('Linux'));
      fireEvent.press(getByText('High Performance'));
      fireEvent.press(getByTestId('create-container-button'));

      await waitFor(() => {
        expect(getByText('Error: Insufficient resources')).toBeTruthy();
      });

      // Should still be on configuration screen
      expect(getByTestId('config-section')).toBeTruthy();
      
      // Button should be enabled again
      const createButton = getByTestId('create-container-button');
      expect(createButton.props.disabled).toBe(false);
    });

    it('should handle malware deployment failure', async () => {
      const malwareFile = generateMalwareFile({ id: 'malware-1' });
      useAppStore.setState({
        malwareFiles: [malwareFile],
        selectedMalwareId: 'malware-1'
      });

      containerService.deployFile = jest.fn().mockRejectedValueOnce(
        new Error('Deployment failed')
      );

      const { getByTestId, getByText } = renderWithProviders(<ContainerDeploymentFlow />);

      fireEvent.press(getByText('Linux'));
      fireEvent.press(getByText('Standard'));
      fireEvent.press(getByTestId('create-container-button'));

      await waitFor(() => {
        expect(getByText('Error: Deployment failed')).toBeTruthy();
      });
    });
  });

  describe('Resource Configuration', () => {
    it('should properly configure resources based on preset', async () => {
      const { getByText, getByTestId } = renderWithProviders(<ContainerDeploymentFlow />);

      // Test each preset
      const presets = [
        { name: 'Minimal', expected: { cpuCores: 1, memoryGB: 2 } },
        { name: 'Standard', expected: { cpuCores: 2, memoryGB: 4 } },
        { name: 'High Performance', expected: { cpuCores: 4, memoryGB: 8 } }
      ];

      for (const preset of presets) {
        jest.clearAllMocks();
        
        fireEvent.press(getByText('Linux'));
        fireEvent.press(getByText(preset.name));
        
        await waitFor(() => expect(getByTestId('deployment-section')).toBeTruthy());
        fireEvent.press(getByTestId('create-container-button'));

        await waitFor(() => {
          expect(containerService.createContainer).toHaveBeenCalledWith(
            expect.objectContaining(preset.expected)
          );
        });
      }
    });
  });

  describe('State Persistence', () => {
    it('should maintain container configuration in store', async () => {
      const { getByText } = renderWithProviders(<ContainerDeploymentFlow />);

      // Configure container
      fireEvent.press(getByText('Windows'));
      fireEvent.press(getByText('High Performance'));

      // Verify store was updated
      const state = useAppStore.getState();
      expect(state.containerConfig).toEqual(
        expect.objectContaining({
          os: 'windows',
          resourcePreset: 'performance',
          cpuCores: 4,
          memoryGB: 8
        })
      );
    });
  });
});