import * as containerService from './container';
import * as databaseService from './database';
import * as monitoringService from './monitoring';
import { ContainerConfig as ContainerConfigModel } from '../models/container-config.model';
import { ContainerResource as ContainerResourceModel } from '../models/container-resource.model';
import { ContainerSecurity as ContainerSecurityModel } from '../models/container-security.model';
import { Container as ContainerModel } from '../models/container.model';
import { OSType, ArchitectureType, ContainerConfig, ContainerResourceLimits, ContainerSecurityOptions } from '@/types';

// Store active monitoring intervals
const activeMonitoringIntervals: Record<string, NodeJS.Timeout> = {};

/**
 * Create a container with database integration
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @param containerConfig Optional container configuration (OS, architecture, version)
 * @returns Container object
 */
export const createContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  containerConfig?: Partial<ContainerConfig>
): Promise<ContainerModel> => {
  try {
    // Create container using the container service
    const container = await containerService.createContainer(
      malwareId,
      malwareContent,
      malwareName,
      containerConfig
    );

    // Extract container configuration
    const config = {
      os: container.os as OSType,
      architecture: container.architecture as ArchitectureType,
      version: containerConfig?.version || '',
      imageTag: containerConfig?.imageTag || '',
      distribution: containerConfig?.distribution,
    };

    // Extract container resources
    const resources = containerConfig?.resources || containerService.getResourcePreset('standard');

    // Extract container security options and ensure required properties are set
    const defaultSecurity = {
      readOnlyRootFilesystem: true,
      noNewPrivileges: true,
      seccomp: true,
      appArmor: true,
      addressSpaceLayoutRandomization: true,
    };
    
    const security = {
      ...defaultSecurity,
      ...(containerConfig?.securityOptions || {})
    };

    // Create container configuration in the database
    const dbConfig = await databaseService.createContainerConfig(
      config,
      resources,
      security
    );

    // Create container in the database
    const dbContainer = await databaseService.createContainer({
      status: container.status,
      malwareId: container.malwareId,
      error: container.error,
      os: container.os as OSType,
      architecture: container.architecture as ArchitectureType,
      version: containerConfig?.version || '',
      imageTag: containerConfig?.imageTag || '',
      distribution: containerConfig?.distribution,
      configId: dbConfig.id,
    });

    // Start monitoring the container
    if (dbContainer.status === 'running') {
      try {
        console.log(`Starting monitoring for container ${dbContainer.id}`);
        const monitoringInterval = await monitoringService.startContainerMonitoring(dbContainer.id);
        activeMonitoringIntervals[dbContainer.id] = monitoringInterval;
      } catch (monitoringError) {
        console.error(`Failed to start monitoring for container ${dbContainer.id}:`, monitoringError);
        // Continue even if monitoring fails
      }
    }

    return dbContainer;
  } catch (error: unknown) {
    console.error('Error creating container with database integration:', error);
    throw error;
  }
};

/**
 * Get container status with database integration
 * @param containerId ID of the container
 * @returns Container status
 */
export const getContainerStatus = async (containerId: string): Promise<'creating' | 'running' | 'stopped' | 'error'> => {
  try {
    // Get container from the database
    const container = await databaseService.getContainerById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Get container status from the container service
    const status = await containerService.getContainerStatus(containerId);

    // Update container status in the database if it has changed
    if (container.status !== status) {
      await databaseService.updateContainer(containerId, { status });
      
      // Start monitoring if container is now running
      if (status === 'running' && container.status !== 'running' && !activeMonitoringIntervals[containerId]) {
        try {
          console.log(`Starting monitoring for container ${containerId} (status changed to running)`);
          const monitoringInterval = await monitoringService.startContainerMonitoring(containerId);
          activeMonitoringIntervals[containerId] = monitoringInterval;
        } catch (monitoringError) {
          console.error(`Failed to start monitoring for container ${containerId}:`, monitoringError);
          // Continue even if monitoring fails
        }
      }
      
      // Stop monitoring if container is no longer running
      if (status !== 'running' && container.status === 'running' && activeMonitoringIntervals[containerId]) {
        console.log(`Stopping monitoring for container ${containerId} (status changed from running)`);
        monitoringService.stopContainerMonitoring(activeMonitoringIntervals[containerId]);
        delete activeMonitoringIntervals[containerId];
      }
    }

    return status;
  } catch (error: unknown) {
    console.error('Error getting container status with database integration:', error);
    throw error;
  }
};

/**
 * Execute a command in the container with database integration
 * @param containerId ID of the container
 * @param command Command to execute
 * @returns Command output
 */
export const executeCommand = async (
  containerId: string,
  command: string
): Promise<{ output: string; exitCode: number }> => {
  try {
    // Get container from the database
    const container = await databaseService.getContainerById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Execute command using the container service
    return await containerService.executeCommand(containerId, command);
  } catch (error: unknown) {
    console.error('Error executing command with database integration:', error);
    throw error;
  }
};

/**
 * Run malware analysis in the container with database integration
 * @param containerId ID of the container
 * @param timeout Timeout in seconds (default: 60)
 * @returns Analysis results
 */
export const runMalwareAnalysis = async (
  containerId: string,
  timeout: number = 60
): Promise<{ logs: string; networkActivity: any[]; fileActivity: any[] }> => {
  try {
    // Get container from the database
    const container = await databaseService.getContainerById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Run malware analysis using the container service
    return await containerService.runMalwareAnalysis(containerId, timeout);
  } catch (error: unknown) {
    console.error('Error running malware analysis with database integration:', error);
    throw error;
  }
};

/**
 * Remove a container with database integration
 * @param containerId ID of the container
 * @returns Success status
 */
export const removeContainer = async (containerId: string): Promise<boolean> => {
  try {
    // Get container from the database
    const container = await databaseService.getContainerById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Stop monitoring if active
    if (activeMonitoringIntervals[containerId]) {
      console.log(`Stopping monitoring for container ${containerId}`);
      monitoringService.stopContainerMonitoring(activeMonitoringIntervals[containerId]);
      delete activeMonitoringIntervals[containerId];
    }

    // Remove container using the container service
    const success = await containerService.removeContainer(containerId);

    // Remove container from the database
    if (success) {
      await databaseService.deleteContainer(containerId);
    }

    return success;
  } catch (error: unknown) {
    console.error('Error removing container with database integration:', error);
    throw error;
  }
};

/**
 * Create a Windows container with database integration
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @param version Windows version (windows-7, windows-8, windows-10, windows-11)
 * @param resources Resource limits for the container (optional)
 * @returns Container object
 */
export const createWindowsContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  architecture: ArchitectureType = 'x64',
  version: string = 'windows-10',
  resources: ContainerResourceLimits = containerService.getResourcePreset('standard')
): Promise<ContainerModel> => {
  try {
    // Get Windows container configuration
    const windowsConfig = containerService.getWindowsContainerConfig(
      architecture,
      version as any,
      resources
    );

    // Apply Windows-specific security options
    const windowsSecurityOptions: ContainerSecurityOptions = {
      readOnlyRootFilesystem: true,
      noNewPrivileges: true,
      seccomp: true,
      appArmor: true,
      addressSpaceLayoutRandomization: true,
      windowsDefender: true,
      memoryProtection: true,
      controlFlowGuard: true,
      dataExecutionPrevention: true,
      secureBootEnabled: true,
      hypervisorEnforced: true,
    };

    // Create container with database integration
    return await createContainer(malwareId, malwareContent, malwareName, {
      ...windowsConfig,
      securityOptions: windowsSecurityOptions,
    });
  } catch (error: unknown) {
    console.error('Error creating Windows container with database integration:', error);
    throw error;
  }
};

/**
 * Create a Linux container with database integration
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @param version Linux version (e.g., ubuntu-22.04, debian-11, etc.)
 * @param resources Resource limits for the container (optional)
 * @returns Container object
 */
export const createLinuxContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  architecture: ArchitectureType = 'x64',
  version: string = 'ubuntu-22.04',
  resources: ContainerResourceLimits = containerService.getResourcePreset('standard')
): Promise<ContainerModel> => {
  try {
    // Get Linux container configuration
    const linuxConfig = containerService.getLinuxContainerConfig(
      architecture,
      version as any,
      resources
    );

    // Apply Linux-specific security options
    const linuxSecurityOptions: ContainerSecurityOptions = {
      readOnlyRootFilesystem: true,
      noNewPrivileges: true,
      seccomp: true,
      appArmor: true,
      addressSpaceLayoutRandomization: true,
      selinux: true,
      capabilities: 'drop-all',
      seccompProfile: 'default',
      privileged: false,
      namespaceIsolation: true,
      cgroupsV2: true,
      restrictSysctls: true,
    };

    // Create container with database integration
    return await createContainer(malwareId, malwareContent, malwareName, {
      ...linuxConfig,
      securityOptions: linuxSecurityOptions,
    });
  } catch (error: unknown) {
    console.error('Error creating Linux container with database integration:', error);
    throw error;
  }
};

/**
 * Create a macOS container with database integration
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @param architecture Architecture type (x64, arm64)
 * @param version macOS version (macos-11, macos-12, macos-13, macos-14)
 * @param resources Resource limits for the container (optional)
 * @returns Container object
 */
export const createMacOSContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  architecture: ArchitectureType = 'arm64',
  version: string = 'macos-14',
  resources: ContainerResourceLimits = containerService.getResourcePreset('standard')
): Promise<ContainerModel> => {
  try {
    // Get macOS container configuration
    const macOSConfig = containerService.getMacOSContainerConfig(
      architecture,
      version as any,
      resources
    );

    // Apply macOS-specific security options
    const macOSSecurityOptions: ContainerSecurityOptions = {
      readOnlyRootFilesystem: true,
      noNewPrivileges: true,
      seccomp: true,
      appArmor: true,
      addressSpaceLayoutRandomization: true,
      sandboxProfile: 'strict',
      transparencyConsent: true,
      systemIntegrityProtection: true,
      gatekeeper: true,
      xpcSecurity: true,
      appSandbox: true,
      fileQuarantine: true,
      libraryValidation: true,
    };

    // Create container with database integration
    return await createContainer(malwareId, malwareContent, malwareName, {
      ...macOSConfig,
      securityOptions: macOSSecurityOptions,
    });
  } catch (error: unknown) {
    console.error('Error creating macOS container with database integration:', error);
    throw error;
  }
};

/**
 * Get a file from the container
 * @param containerId ID of the container
 * @param filePath Path of the file in the container
 * @returns File content
 */
export const getContainerFile = async (
  containerId: string,
  filePath: string
): Promise<string> => {
  try {
    // Get container from the database
    const container = await databaseService.getContainerById(containerId);
    if (!container) {
      throw new Error(`Container not found: ${containerId}`);
    }

    // Get file from container using the container service
    return await containerService.getContainerFile(containerId, filePath);
  } catch (error: unknown) {
    console.error('Error getting file from container with database integration:', error);
    throw error;
  }
};

// Re-export other functions from the container service
export {
  getResourcePreset,
  createResourceLimits,
  getWindowsContainerConfig,
  getLinuxContainerConfig,
  getMacOSContainerConfig,
  getAvailableWindowsVersions,
  getAvailableWindowsArchitectures,
  getAvailableLinuxVersions,
  getAvailableLinuxArchitectures,
  getAvailableLinuxDistributions,
  getAvailableMacOSVersions,
  getAvailableMacOSArchitectures,
  getSystemResources,
  checkSystemRequirements,
  hasContainerConfig,
  saveContainerConfig,
  deleteContainerConfig,
} from './container';

// Export database-specific functions
export {
  getAllContainers,
  getContainerById,
  updateContainer,
  deleteContainer,
  createContainerConfig,
  getContainerConfigById,
  getAllContainerConfigs,
  updateContainerConfig,
  deleteContainerConfig as deleteDbContainerConfig,
} from './database';

// Export monitoring functions
export {
  getContainerMonitoringByContainerId,
  getNetworkActivityByContainerId,
  getFileActivityByContainerId,
  getProcessActivityByContainerId,
  getSuspiciousActivities,
  getContainerMonitoringSummary,
} from './monitoring';
