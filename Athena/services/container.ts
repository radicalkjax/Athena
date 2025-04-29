import { createContainerClient, safeApiCall, sanitizeRequestData } from './apiClient';
import * as SecureStore from 'expo-secure-store';
import { Container, ContainerConfig, OSType, ArchitectureType, LinuxVersion, LinuxDistribution, MacOSVersion, ContainerResourceLimits } from '@/types';
import { generateId } from '@/utils/helpers';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as FileSystem from 'expo-file-system';

// Storage keys
const CONTAINER_API_KEY_STORAGE = 'athena_container_api_key';
const CONTAINER_API_URL_STORAGE = 'athena_container_api_url';

// Container configuration types
type WindowsVersion = 'windows-7' | 'windows-8' | 'windows-10' | 'windows-11';
type ContainerImageConfig = { imageTag: string };
type ArchitectureConfig = Record<WindowsVersion, ContainerImageConfig>;
type WindowsContainersConfig = Record<ArchitectureType, ArchitectureConfig>;

// Linux container configuration types
type LinuxDistributionConfig = Record<LinuxVersion, ContainerImageConfig>;
type LinuxContainersConfig = Record<ArchitectureType, LinuxDistributionConfig>;

// macOS container configuration types
type MacOSVersionConfig = Record<MacOSVersion, ContainerImageConfig>;
type MacOSContainersConfig = Record<ArchitectureType, MacOSVersionConfig>;

// Container configurations
const WINDOWS_CONTAINERS: WindowsContainersConfig = {
  x86: {
    'windows-7': { imageTag: 'windows-7-x86:latest' },
    'windows-8': { imageTag: 'windows-8-x86:latest' },
    'windows-10': { imageTag: 'windows-10-x86:latest' },
    'windows-11': { imageTag: 'windows-11-x86:latest' },
  },
  x64: {
    'windows-7': { imageTag: 'windows-7-x64:latest' },
    'windows-8': { imageTag: 'windows-8-x64:latest' },
    'windows-10': { imageTag: 'windows-10-x64:latest' },
    'windows-11': { imageTag: 'windows-11-x64:latest' },
  },
  arm: {
    'windows-7': { imageTag: 'windows-7-arm:latest' },
    'windows-8': { imageTag: 'windows-8-arm:latest' },
    'windows-10': { imageTag: 'windows-10-arm:latest' },
    'windows-11': { imageTag: 'windows-11-arm:latest' },
  },
  arm64: {
    'windows-7': { imageTag: 'windows-7-arm64:latest' },
    'windows-8': { imageTag: 'windows-8-arm64:latest' },
    'windows-10': { imageTag: 'windows-10-arm64:latest' },
    'windows-11': { imageTag: 'windows-11-arm64:latest' },
  },
};

// Linux container configurations
const LINUX_CONTAINERS: LinuxContainersConfig = {
  x86: {
    'ubuntu-18.04': { imageTag: 'ubuntu-18.04-x86:latest' },
    'ubuntu-20.04': { imageTag: 'ubuntu-20.04-x86:latest' },
    'ubuntu-22.04': { imageTag: 'ubuntu-22.04-x86:latest' },
    'debian-10': { imageTag: 'debian-10-x86:latest' },
    'debian-11': { imageTag: 'debian-11-x86:latest' },
    'debian-12': { imageTag: 'debian-12-x86:latest' },
    'centos-7': { imageTag: 'centos-7-x86:latest' },
    'centos-8': { imageTag: 'centos-8-x86:latest' },
    'centos-9': { imageTag: 'centos-9-x86:latest' },
    'fedora-36': { imageTag: 'fedora-36-x86:latest' },
    'fedora-37': { imageTag: 'fedora-37-x86:latest' },
    'fedora-38': { imageTag: 'fedora-38-x86:latest' },
    'alpine-3.16': { imageTag: 'alpine-3.16-x86:latest' },
    'alpine-3.17': { imageTag: 'alpine-3.17-x86:latest' },
    'alpine-3.18': { imageTag: 'alpine-3.18-x86:latest' },
  },
  x64: {
    'ubuntu-18.04': { imageTag: 'ubuntu-18.04-x64:latest' },
    'ubuntu-20.04': { imageTag: 'ubuntu-20.04-x64:latest' },
    'ubuntu-22.04': { imageTag: 'ubuntu-22.04-x64:latest' },
    'debian-10': { imageTag: 'debian-10-x64:latest' },
    'debian-11': { imageTag: 'debian-11-x64:latest' },
    'debian-12': { imageTag: 'debian-12-x64:latest' },
    'centos-7': { imageTag: 'centos-7-x64:latest' },
    'centos-8': { imageTag: 'centos-8-x64:latest' },
    'centos-9': { imageTag: 'centos-9-x64:latest' },
    'fedora-36': { imageTag: 'fedora-36-x64:latest' },
    'fedora-37': { imageTag: 'fedora-37-x64:latest' },
    'fedora-38': { imageTag: 'fedora-38-x64:latest' },
    'alpine-3.16': { imageTag: 'alpine-3.16-x64:latest' },
    'alpine-3.17': { imageTag: 'alpine-3.17-x64:latest' },
    'alpine-3.18': { imageTag: 'alpine-3.18-x64:latest' },
  },
  arm: {
    'ubuntu-18.04': { imageTag: 'ubuntu-18.04-arm:latest' },
    'ubuntu-20.04': { imageTag: 'ubuntu-20.04-arm:latest' },
    'ubuntu-22.04': { imageTag: 'ubuntu-22.04-arm:latest' },
    'debian-10': { imageTag: 'debian-10-arm:latest' },
    'debian-11': { imageTag: 'debian-11-arm:latest' },
    'debian-12': { imageTag: 'debian-12-arm:latest' },
    'centos-7': { imageTag: 'centos-7-arm:latest' },
    'centos-8': { imageTag: 'centos-8-arm:latest' },
    'centos-9': { imageTag: 'centos-9-arm:latest' },
    'fedora-36': { imageTag: 'fedora-36-arm:latest' },
    'fedora-37': { imageTag: 'fedora-37-arm:latest' },
    'fedora-38': { imageTag: 'fedora-38-arm:latest' },
    'alpine-3.16': { imageTag: 'alpine-3.16-arm:latest' },
    'alpine-3.17': { imageTag: 'alpine-3.17-arm:latest' },
    'alpine-3.18': { imageTag: 'alpine-3.18-arm:latest' },
  },
  arm64: {
    'ubuntu-18.04': { imageTag: 'ubuntu-18.04-arm64:latest' },
    'ubuntu-20.04': { imageTag: 'ubuntu-20.04-arm64:latest' },
    'ubuntu-22.04': { imageTag: 'ubuntu-22.04-arm64:latest' },
    'debian-10': { imageTag: 'debian-10-arm64:latest' },
    'debian-11': { imageTag: 'debian-11-arm64:latest' },
    'debian-12': { imageTag: 'debian-12-arm64:latest' },
    'centos-7': { imageTag: 'centos-7-arm64:latest' },
    'centos-8': { imageTag: 'centos-8-arm64:latest' },
    'centos-9': { imageTag: 'centos-9-arm64:latest' },
    'fedora-36': { imageTag: 'fedora-36-arm64:latest' },
    'fedora-37': { imageTag: 'fedora-37-arm64:latest' },
    'fedora-38': { imageTag: 'fedora-38-arm64:latest' },
    'alpine-3.16': { imageTag: 'alpine-3.16-arm64:latest' },
    'alpine-3.17': { imageTag: 'alpine-3.17-arm64:latest' },
    'alpine-3.18': { imageTag: 'alpine-3.18-arm64:latest' },
  },
};

// macOS container configurations
const MACOS_CONTAINERS: MacOSContainersConfig = {
  x86: {
    // macOS doesn't support x86 architecture, but we need to define these for TypeScript
    'macos-11': { imageTag: '' },
    'macos-12': { imageTag: '' },
    'macos-13': { imageTag: '' },
    'macos-14': { imageTag: '' },
  },
  x64: {
    'macos-11': { imageTag: 'macos-11-x64:latest' }, // Big Sur
    'macos-12': { imageTag: 'macos-12-x64:latest' }, // Monterey
    'macos-13': { imageTag: 'macos-13-x64:latest' }, // Ventura
    'macos-14': { imageTag: 'macos-14-x64:latest' }, // Sonoma
  },
  arm: {
    // macOS doesn't support 32-bit ARM architecture, but we need to define these for TypeScript
    'macos-11': { imageTag: '' },
    'macos-12': { imageTag: '' },
    'macos-13': { imageTag: '' },
    'macos-14': { imageTag: '' },
  },
  arm64: {
    'macos-11': { imageTag: 'macos-11-arm64:latest' }, // Big Sur
    'macos-12': { imageTag: 'macos-12-arm64:latest' }, // Monterey
    'macos-13': { imageTag: 'macos-13-arm64:latest' }, // Ventura
    'macos-14': { imageTag: 'macos-14-arm64:latest' }, // Sonoma
  },
};

// Default resource configurations
const DEFAULT_RESOURCE_LIMITS: ContainerResourceLimits = {
  cpu: 1,         // 1 CPU core
  memory: 2048,   // 2 GB RAM
  diskSpace: 5120, // 5 GB disk space
  networkSpeed: 10, // 10 Mbps
  ioOperations: 1000 // 1000 IOPS
};

// Resource presets for different analysis types
const RESOURCE_PRESETS = {
  minimal: {
    cpu: 1,
    memory: 2048,    // 2GB RAM minimum for Windows
    diskSpace: 8192, // 8GB disk space minimum
    networkSpeed: 5,
    ioOperations: 500
  },
  standard: {
    cpu: 2,
    memory: 4096,    // 4GB RAM for standard
    diskSpace: 10240, // 10GB disk space
    networkSpeed: 20,
    ioOperations: 2000
  },
  performance: {
    cpu: 4,
    memory: 8192,    // 8GB RAM for performance
    diskSpace: 20480, // 20GB disk space
    networkSpeed: 50,
    ioOperations: 5000
  },
  intensive: {
    cpu: 8,
    memory: 16384,   // 16GB RAM for intensive
    diskSpace: 40960, // 40GB disk space
    networkSpeed: 100,
    ioOperations: 10000
  }
};

// OS-specific resource requirements for each preset
const OS_RESOURCES = {
  minimal: {
    windows: {
      cpu: 1,
      memory: 2048,    // 2GB RAM minimum for Windows
      diskSpace: 8192, // 8GB disk space minimum
      networkSpeed: 5,
      ioOperations: 500
    },
    linux: {
      cpu: 0.5,
      memory: 1024,    // 1GB RAM minimum for Linux
      diskSpace: 4096, // 4GB disk space minimum
      networkSpeed: 5,
      ioOperations: 500
    },
    macos: {
      cpu: 2,
      memory: 4096,    // 4GB RAM minimum for macOS
      diskSpace: 16384, // 16GB disk space minimum
      networkSpeed: 10,
      ioOperations: 1000
    }
  },
  standard: {
    windows: {
      cpu: 2,
      memory: 4096,    // 4GB RAM for Windows
      diskSpace: 10240, // 10GB disk space
      networkSpeed: 20,
      ioOperations: 2000
    },
    linux: {
      cpu: 1,
      memory: 2048,    // 2GB RAM for Linux
      diskSpace: 8192,  // 8GB disk space
      networkSpeed: 20,
      ioOperations: 2000
    },
    macos: {
      cpu: 4,
      memory: 8192,    // 8GB RAM for macOS
      diskSpace: 20480, // 20GB disk space
      networkSpeed: 20,
      ioOperations: 2000
    }
  },
  performance: {
    windows: {
      cpu: 4,
      memory: 8192,    // 8GB RAM for Windows
      diskSpace: 20480, // 20GB disk space
      networkSpeed: 50,
      ioOperations: 5000
    },
    linux: {
      cpu: 2,
      memory: 4096,    // 4GB RAM for Linux
      diskSpace: 10240, // 10GB disk space
      networkSpeed: 50,
      ioOperations: 5000
    },
    macos: {
      cpu: 6,
      memory: 12288,   // 12GB RAM for macOS
      diskSpace: 30720, // 30GB disk space
      networkSpeed: 50,
      ioOperations: 5000
    }
  },
  intensive: {
    windows: {
      cpu: 8,
      memory: 16384,   // 16GB RAM for Windows
      diskSpace: 40960, // 40GB disk space
      networkSpeed: 100,
      ioOperations: 10000
    },
    linux: {
      cpu: 4,
      memory: 8192,    // 8GB RAM for Linux
      diskSpace: 20480, // 20GB disk space
      networkSpeed: 100,
      ioOperations: 10000
    },
    macos: {
      cpu: 8,
      memory: 16384,   // 16GB RAM for macOS
      diskSpace: 40960, // 40GB disk space
      networkSpeed: 100,
      ioOperations: 10000
    }
  }
};

// Default container configurations
const DEFAULT_CONTAINER_CONFIG: ContainerConfig = {
  os: 'windows',
  architecture: 'x64',
  version: 'windows-10',
  resources: DEFAULT_RESOURCE_LIMITS
};

// Default Linux container configuration
const DEFAULT_LINUX_CONFIG: ContainerConfig = {
  os: 'linux',
  architecture: 'x64',
  version: 'ubuntu-22.04',
  distribution: 'ubuntu',
  resources: DEFAULT_RESOURCE_LIMITS
};

// Default macOS container configuration
const DEFAULT_MACOS_CONFIG: ContainerConfig = {
  os: 'macos',
  architecture: 'arm64',
  version: 'macos-14', // Sonoma
  resources: DEFAULT_RESOURCE_LIMITS
};

/**
 * Initialize Container API client
 * @param apiKey Optional API key to use instead of stored key
 * @param apiUrl Optional API URL to use instead of stored URL
 * @returns Axios instance configured for Container service
 */
export const initContainerService = async (
  apiKey?: string,
  apiUrl?: string
): Promise<ReturnType<typeof createContainerClient>> => {
  // Use provided values or retrieve from secure storage
  const key = apiKey || await SecureStore.getItemAsync(CONTAINER_API_KEY_STORAGE);
  const url = apiUrl || await SecureStore.getItemAsync(CONTAINER_API_URL_STORAGE);
  
  if (!key) {
    throw new Error('Container API key not found. Please set your API key in the settings.');
  }
  
  if (!url) {
    throw new Error('Container API URL not found. Please set the API URL in the settings.');
  }
  
  return createContainerClient(key, url);
};

/**
 * Save Container API configuration to secure storage
 * @param apiKey The API key to save
 * @param apiUrl The API URL to save
 */
export const saveContainerConfig = async (apiKey: string, apiUrl: string): Promise<void> => {
  await SecureStore.setItemAsync(CONTAINER_API_KEY_STORAGE, apiKey);
  await SecureStore.setItemAsync(CONTAINER_API_URL_STORAGE, apiUrl);
};

/**
 * Check if Container API configuration is stored
 * @returns True if API configuration exists, false otherwise
 */
export const hasContainerConfig = async (): Promise<boolean> => {
  const key = await SecureStore.getItemAsync(CONTAINER_API_KEY_STORAGE);
  const url = await SecureStore.getItemAsync(CONTAINER_API_URL_STORAGE);
  return !!key && !!url;
};

/**
 * Delete stored Container API configuration
 */
export const deleteContainerConfig = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(CONTAINER_API_KEY_STORAGE);
  await SecureStore.deleteItemAsync(CONTAINER_API_URL_STORAGE);
};

/**
 * Get resource limits by preset name
 * @param preset Resource preset name (minimal, standard, performance, intensive)
 * @param os Optional OS type to get OS-specific requirements
 * @returns Resource limits configuration
 */
export const getResourcePreset = (
  preset: 'minimal' | 'standard' | 'performance' | 'intensive' = 'standard',
  os?: OSType
): ContainerResourceLimits => {
  // Use OS-specific requirements if OS is provided
  if (os && OS_RESOURCES[preset] && OS_RESOURCES[preset][os]) {
    return OS_RESOURCES[preset][os];
  }
  
  return RESOURCE_PRESETS[preset] || DEFAULT_RESOURCE_LIMITS;
};

/**
 * Create custom resource limits configuration
 * @param cpu CPU cores (e.g., 1 = 1 core, 0.5 = half a core)
 * @param memory Memory in MB
 * @param diskSpace Disk space in MB
 * @param networkSpeed Network speed in Mbps
 * @param ioOperations Max I/O operations per second
 * @returns Custom resource limits configuration
 */
export const createResourceLimits = (
  cpu?: number,
  memory?: number,
  diskSpace?: number,
  networkSpeed?: number,
  ioOperations?: number
): ContainerResourceLimits => {
  return {
    cpu: cpu !== undefined ? cpu : DEFAULT_RESOURCE_LIMITS.cpu,
    memory: memory !== undefined ? memory : DEFAULT_RESOURCE_LIMITS.memory,
    diskSpace: diskSpace !== undefined ? diskSpace : DEFAULT_RESOURCE_LIMITS.diskSpace,
    networkSpeed: networkSpeed !== undefined ? networkSpeed : DEFAULT_RESOURCE_LIMITS.networkSpeed,
    ioOperations: ioOperations !== undefined ? ioOperations : DEFAULT_RESOURCE_LIMITS.ioOperations
  };
};

/**
 * Get Windows container configuration
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @param version Windows version (windows-7, windows-8, windows-10, windows-11)
 * @param resources Resource limits for the container
 * @returns Container configuration with image tag and resource limits
 */
export const getWindowsContainerConfig = (
  architecture: ArchitectureType = DEFAULT_CONTAINER_CONFIG.architecture,
  version: WindowsVersion = DEFAULT_CONTAINER_CONFIG.version as WindowsVersion,
  resources: ContainerResourceLimits = DEFAULT_RESOURCE_LIMITS
): ContainerConfig => {
  // Check if the requested architecture is supported
  if (!WINDOWS_CONTAINERS[architecture]) {
    console.warn(`Architecture ${architecture} not supported, falling back to ${DEFAULT_CONTAINER_CONFIG.architecture}`);
    architecture = DEFAULT_CONTAINER_CONFIG.architecture;
  }

  // Check if the requested version is supported for this architecture
  if (!WINDOWS_CONTAINERS[architecture][version as WindowsVersion]) {
    console.warn(`Windows version ${version} not supported for ${architecture}, falling back to ${DEFAULT_CONTAINER_CONFIG.version}`);
    version = DEFAULT_CONTAINER_CONFIG.version as WindowsVersion;
  }

  const imageTag = WINDOWS_CONTAINERS[architecture][version].imageTag;

  return {
    os: 'windows',
    architecture,
    version,
    imageTag,
    resources,
  };
};

/**
 * Get available Windows versions for a specific architecture
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @returns Array of available Windows versions
 */
export const getAvailableWindowsVersions = (architecture: ArchitectureType): WindowsVersion[] => {
  if (!WINDOWS_CONTAINERS[architecture]) {
    return [];
  }
  
  return Object.keys(WINDOWS_CONTAINERS[architecture]) as WindowsVersion[];
};

/**
 * Get available architectures for Windows containers
 * @returns Array of available architecture types
 */
export const getAvailableWindowsArchitectures = (): ArchitectureType[] => {
  return Object.keys(WINDOWS_CONTAINERS) as ArchitectureType[];
};

/**
 * Get Linux container configuration
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @param version Linux version (e.g., ubuntu-22.04, debian-11, etc.)
 * @param resources Resource limits for the container
 * @returns Container configuration with image tag and resource limits
 */
export const getLinuxContainerConfig = (
  architecture: ArchitectureType = DEFAULT_LINUX_CONFIG.architecture,
  version: LinuxVersion = DEFAULT_LINUX_CONFIG.version as LinuxVersion,
  resources: ContainerResourceLimits = DEFAULT_RESOURCE_LIMITS
): ContainerConfig => {
  // Check if the requested architecture is supported
  if (!LINUX_CONTAINERS[architecture]) {
    console.warn(`Architecture ${architecture} not supported for Linux, falling back to ${DEFAULT_LINUX_CONFIG.architecture}`);
    architecture = DEFAULT_LINUX_CONFIG.architecture;
  }

  // Check if the requested version is supported for this architecture
  if (!LINUX_CONTAINERS[architecture][version]) {
    console.warn(`Linux version ${version} not supported for ${architecture}, falling back to ${DEFAULT_LINUX_CONFIG.version}`);
    version = DEFAULT_LINUX_CONFIG.version as LinuxVersion;
  }

  const imageTag = LINUX_CONTAINERS[architecture][version].imageTag;
  const distribution = version.split('-')[0] as LinuxDistribution;

  return {
    os: 'linux',
    architecture,
    version,
    distribution,
    imageTag,
    resources,
  };
};

/**
 * Get available Linux versions for a specific architecture
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @returns Array of available Linux versions
 */
export const getAvailableLinuxVersions = (architecture: ArchitectureType): LinuxVersion[] => {
  if (!LINUX_CONTAINERS[architecture]) {
    return [];
  }
  
  return Object.keys(LINUX_CONTAINERS[architecture]) as LinuxVersion[];
};

/**
 * Get available architectures for Linux containers
 * @returns Array of available architecture types
 */
export const getAvailableLinuxArchitectures = (): ArchitectureType[] => {
  return Object.keys(LINUX_CONTAINERS) as ArchitectureType[];
};

/**
 * Get available Linux distributions
 * @returns Array of available Linux distributions
 */
export const getAvailableLinuxDistributions = (): LinuxDistribution[] => {
  const distributions = new Set<LinuxDistribution>();
  
  // Extract unique distribution names from all versions
  getAvailableLinuxVersions('x64').forEach(version => {
    const distribution = version.split('-')[0] as LinuxDistribution;
    distributions.add(distribution);
  });
  
  return Array.from(distributions);
};

/**
 * Get macOS container configuration
 * @param architecture Architecture type (x64, arm64)
 * @param version macOS version (macos-11, macos-12, macos-13, macos-14)
 * @param resources Resource limits for the container
 * @returns Container configuration with image tag and resource limits
 */
export const getMacOSContainerConfig = (
  architecture: ArchitectureType = DEFAULT_MACOS_CONFIG.architecture,
  version: MacOSVersion = DEFAULT_MACOS_CONFIG.version as MacOSVersion,
  resources: ContainerResourceLimits = DEFAULT_RESOURCE_LIMITS
): ContainerConfig => {
  // Check if the requested architecture is supported
  if (!MACOS_CONTAINERS[architecture]) {
    console.warn(`Architecture ${architecture} not supported for macOS, falling back to ${DEFAULT_MACOS_CONFIG.architecture}`);
    architecture = DEFAULT_MACOS_CONFIG.architecture;
  }

  // Check if the requested version is supported for this architecture
  if (!MACOS_CONTAINERS[architecture][version]) {
    console.warn(`macOS version ${version} not supported for ${architecture}, falling back to ${DEFAULT_MACOS_CONFIG.version}`);
    version = DEFAULT_MACOS_CONFIG.version as MacOSVersion;
  }

  const imageTag = MACOS_CONTAINERS[architecture][version].imageTag;

  return {
    os: 'macos',
    architecture,
    version,
    imageTag,
    resources,
  };
};

/**
 * Get available macOS versions for a specific architecture
 * @param architecture Architecture type (x64, arm64)
 * @returns Array of available macOS versions
 */
export const getAvailableMacOSVersions = (architecture: ArchitectureType): MacOSVersion[] => {
  if (!MACOS_CONTAINERS[architecture]) {
    return [];
  }
  
  return Object.keys(MACOS_CONTAINERS[architecture]) as MacOSVersion[];
};

/**
 * Get available architectures for macOS containers
 * @returns Array of available architecture types
 */
export const getAvailableMacOSArchitectures = (): ArchitectureType[] => {
  return Object.keys(MACOS_CONTAINERS) as ArchitectureType[];
};

/**
 * Get system resources information
 * @returns System resources information
 */
export const getSystemResources = async (): Promise<{
  os: OSType;
  architecture: ArchitectureType;
  cpu: number;
  memory: number;
  diskSpace: number;
  isVirtual: boolean;
}> => {
  // Get OS type
  let os: OSType = 'linux';
  if (Platform.OS === 'ios' || Platform.OS === 'macos') {
    os = 'macos';
  } else if (Platform.OS === 'windows') {
    os = 'windows';
  } else if (Platform.OS === 'android') {
    os = 'linux';
  }
  
  // Get architecture
  let architecture: ArchitectureType = 'x64';
  const deviceType = await Device.getDeviceTypeAsync();
  
  if (deviceType === Device.DeviceType.PHONE || deviceType === Device.DeviceType.TABLET) {
    architecture = 'arm64';
  } else {
    // For desktop, try to determine architecture
    if (os === 'macos' && Device.osInternalBuildId?.includes('arm64')) {
      architecture = 'arm64';
    } else if (os === 'windows' && Device.osInternalBuildId?.includes('arm64')) {
      architecture = 'arm64';
    }
  }
  
  // Get CPU cores
  const cpuCount = Device.isDevice ? Device.totalMemory ? Math.max(1, Math.floor(Device.totalMemory / (1024 * 1024 * 1024))) : 2 : 4;
  
  // Get memory (in MB)
  const totalMemory = Device.totalMemory ? Math.floor(Device.totalMemory / (1024 * 1024)) : 4096;
  
  // Get available disk space (in MB)
  let availableDiskSpace = 10240; // Default to 10GB
  try {
    const fileInfo = await FileSystem.getFreeDiskStorageAsync();
    availableDiskSpace = Math.floor(fileInfo / (1024 * 1024));
  } catch (error) {
    console.warn('Error getting disk space:', error);
  }
  
  // Check if running in a virtual environment
  const isVirtual = Device.isDevice ? false : true;
  
  return {
    os,
    architecture,
    cpu: cpuCount,
    memory: totalMemory,
    diskSpace: availableDiskSpace,
    isVirtual
  };
};

/**
 * Check if system meets the requirements for the container
 * @param resources Container resource requirements
 * @returns Object with check result and details
 */
export const checkSystemRequirements = async (
  resources: ContainerResourceLimits
): Promise<{
  meetsRequirements: boolean;
  details: {
    cpu: { meets: boolean; available: number; required: number };
    memory: { meets: boolean; available: number; required: number };
    diskSpace: { meets: boolean; available: number; required: number };
  };
}> => {
  // Get system resources
  const systemResources = await getSystemResources();
  
  // Check CPU
  const cpuMeets = systemResources.cpu >= resources.cpu;
  
  // Check memory
  const memoryMeets = systemResources.memory >= resources.memory;
  
  // Check disk space
  const diskSpaceMeets = systemResources.diskSpace >= resources.diskSpace;
  
  // Overall result
  const meetsRequirements = cpuMeets && memoryMeets && diskSpaceMeets;
  
  return {
    meetsRequirements,
    details: {
      cpu: { meets: cpuMeets, available: systemResources.cpu, required: resources.cpu },
      memory: { meets: memoryMeets, available: systemResources.memory, required: resources.memory },
      diskSpace: { meets: diskSpaceMeets, available: systemResources.diskSpace, required: resources.diskSpace }
    }
  };
};

/**
 * Create a new container for malware analysis
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @param containerConfig Optional container configuration (OS, architecture, version)
 * @returns Container object
 * @throws Error if system doesn't meet the requirements or if container creation fails
 */
export const createContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  containerConfig?: Partial<ContainerConfig>
): Promise<Container> => {
  try {
    const client = await initContainerService();
    
    const containerId = generateId();
    
    // Use provided container config or default to Windows x64
    const config = containerConfig ? 
      { ...DEFAULT_CONTAINER_CONFIG, ...containerConfig } : 
      DEFAULT_CONTAINER_CONFIG;
    
    // Validate malware content
    if (!malwareContent) {
      throw new Error('Malware content is required');
    }
    
    // Validate malware name
    if (!malwareName) {
      throw new Error('Malware name is required');
    }
    
    // Check if system meets the requirements
    if (config.resources) {
      const systemCheck = await checkSystemRequirements(config.resources);
      
      if (!systemCheck.meetsRequirements) {
        // System doesn't meet the requirements
        const details = systemCheck.details;
        let errorMessage = 'System does not meet the requirements for the container:';
        
        if (!details.cpu.meets) {
          errorMessage += `\n- CPU: ${details.cpu.available} cores available, ${details.cpu.required} cores required`;
        }
        
        if (!details.memory.meets) {
          errorMessage += `\n- Memory: ${details.memory.available} MB available, ${details.memory.required} MB required`;
        }
        
        if (!details.diskSpace.meets) {
          errorMessage += `\n- Disk Space: ${details.diskSpace.available} MB available, ${details.diskSpace.required} MB required`;
        }
        
        throw new Error(errorMessage);
      }
    }
    
    // Get the OS-specific container configuration
    let finalConfig = config;
    if (config.os === 'windows') {
      finalConfig = getWindowsContainerConfig(
        config.architecture,
        config.version as WindowsVersion,
        config.resources
      );
    } else if (config.os === 'linux') {
      finalConfig = getLinuxContainerConfig(
        config.architecture,
        config.version as LinuxVersion,
        config.resources
      );
    } else if (config.os === 'macos') {
      finalConfig = getMacOSContainerConfig(
        config.architecture,
        config.version as MacOSVersion,
        config.resources
      );
    }
    
    // Apply security hardening based on OS type
    finalConfig = applySecurityHardening(finalConfig);
    
    const requestData = sanitizeRequestData({
      containerId,
      malwareId,
      malwareContent,
      malwareName,
      containerConfig: finalConfig,
    });
    
    const response = await safeApiCall(
      () => client.post('/api/v1/containers', requestData),
      'Container creation error'
    );
    
    if (!response || !response.container) {
      throw new Error('Failed to create container: Invalid response from container service');
    }
    
    return {
      id: containerId,
      status: 'creating',
      malwareId,
      createdAt: Date.now(),
      os: finalConfig.os,
      architecture: finalConfig.architecture,
      ...response.container,
    };
  } catch (error) {
    console.error('Container creation error:', error);
    throw error;
  }
};

/**
 * Apply security hardening to container configuration based on OS type
 * @param config Container configuration
 * @returns Hardened container configuration
 */
export const applySecurityHardening = (config: ContainerConfig): ContainerConfig => {
  // Create a deep copy of the configuration
  const hardenedConfig = JSON.parse(JSON.stringify(config)) as ContainerConfig;
  
  // Ensure resources are properly defined with default values for any undefined properties
  if (hardenedConfig.resources) {
    const resources = hardenedConfig.resources;
    hardenedConfig.resources = {
      cpu: typeof resources.cpu === 'number' ? resources.cpu : DEFAULT_RESOURCE_LIMITS.cpu,
      memory: typeof resources.memory === 'number' ? resources.memory : DEFAULT_RESOURCE_LIMITS.memory,
      diskSpace: typeof resources.diskSpace === 'number' ? resources.diskSpace : DEFAULT_RESOURCE_LIMITS.diskSpace,
      networkSpeed: typeof resources.networkSpeed === 'number' ? resources.networkSpeed : DEFAULT_RESOURCE_LIMITS.networkSpeed,
      ioOperations: typeof resources.ioOperations === 'number' ? resources.ioOperations : DEFAULT_RESOURCE_LIMITS.ioOperations
    };
  } else {
    hardenedConfig.resources = { ...DEFAULT_RESOURCE_LIMITS };
  }
  
  // Apply common security hardening
  hardenedConfig.securityOptions = {
    readOnlyRootFilesystem: true,
    noNewPrivileges: true,
    seccomp: true,
    appArmor: true,
    ...hardenedConfig.securityOptions
  };
  
  // Apply OS-specific security hardening
  switch (config.os) {
    case 'windows':
      hardenedConfig.securityOptions = {
        ...hardenedConfig.securityOptions,
        windowsDefender: true,
        memoryProtection: true,
        controlFlowGuard: true,
      };
      break;
    case 'linux':
      hardenedConfig.securityOptions = {
        ...hardenedConfig.securityOptions,
        selinux: true,
        capabilities: 'drop-all',
        seccompProfile: 'default',
      };
      break;
    case 'macos':
      hardenedConfig.securityOptions = {
        ...hardenedConfig.securityOptions,
        sandboxProfile: 'strict',
        transparencyConsent: true,
        systemIntegrityProtection: true,
      };
      break;
  }
  
  return hardenedConfig;
};

/**
 * Get container status
 * @param containerId ID of the container
 * @returns Container status
 */
export const getContainerStatus = async (containerId: string): Promise<'creating' | 'running' | 'stopped' | 'error'> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    
    const response = await safeApiCall(
      () => client.get(`/api/v1/containers/${sanitizedId}/status`),
      'Container status error'
    );
    
    return response.status;
  } catch (error) {
    console.error('Container status error:', error);
    throw error;
  }
};

/**
 * Execute a command in the container
 * @param containerId ID of the container
 * @param command Command to execute
 * @returns Command output
 */
export const executeCommand = async (
  containerId: string,
  command: string
): Promise<{ output: string; exitCode: number }> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    const requestData = sanitizeRequestData({
      command,
    });
    
    const response = await safeApiCall(
      () => client.post(`/api/v1/containers/${sanitizedId}/exec`, requestData),
      'Container exec error'
    );
    
    return {
      output: response.output || '',
      exitCode: response.exitCode || 0,
    };
  } catch (error) {
    console.error('Container exec error:', error);
    throw error;
  }
};

/**
 * Stop and remove a container
 * @param containerId ID of the container
 * @returns Success status
 */
export const removeContainer = async (containerId: string): Promise<boolean> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    
    const response = await safeApiCall(
      () => client.delete(`/api/v1/containers/${sanitizedId}`),
      'Container removal error'
    );
    
    return response.success || false;
  } catch (error) {
    console.error('Container removal error:', error);
    throw error;
  }
};

/**
 * Get container logs
 * @param containerId ID of the container
 * @returns Container logs
 */
export const getContainerLogs = async (containerId: string): Promise<string> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    
    const response = await safeApiCall(
      () => client.get(`/api/v1/containers/${sanitizedId}/logs`),
      'Container logs error'
    );
    
    return response.logs || '';
  } catch (error) {
    console.error('Container logs error:', error);
    throw error;
  }
};

/**
 * Get file from container
 * @param containerId ID of the container
 * @param filePath Path to the file in the container
 * @returns File content (Base64-encoded)
 */
export const getContainerFile = async (
  containerId: string,
  filePath: string
): Promise<string> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    const sanitizedPath = sanitizeRequestData(filePath);
    
    const response = await safeApiCall(
      () => client.get(`/api/v1/containers/${sanitizedId}/files`, {
        params: { path: sanitizedPath }
      }),
      'Container file error'
    );
    
    return response.content || '';
  } catch (error) {
    console.error('Container file error:', error);
    throw error;
  }
};

/**
 * Run malware in container for analysis
 * @param containerId ID of the container
 * @param timeout Timeout in seconds (default: 60)
 * @returns Analysis results
 */
export const runMalwareAnalysis = async (
  containerId: string,
  timeout: number = 60
): Promise<{ logs: string; networkActivity: any[]; fileActivity: any[] }> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    const requestData = sanitizeRequestData({
      timeout,
    });
    
    const response = await safeApiCall(
      () => client.post(`/api/v1/containers/${sanitizedId}/analyze`, requestData),
      'Malware analysis error'
    );
    
    return {
      logs: response.logs || '',
      networkActivity: response.networkActivity || [],
      fileActivity: response.fileActivity || [],
    };
  } catch (error) {
    console.error('Malware analysis error:', error);
    throw error;
  }
};

/**
 * Create a Windows container for malware analysis
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
  architecture: ArchitectureType = DEFAULT_CONTAINER_CONFIG.architecture,
  version: WindowsVersion = DEFAULT_CONTAINER_CONFIG.version as WindowsVersion,
  resources: ContainerResourceLimits = DEFAULT_RESOURCE_LIMITS
): Promise<Container> => {
  try {
    console.log(`Creating Windows container with architecture: ${architecture}, version: ${version}`);
    
    // Validate architecture and version
    if (!WINDOWS_CONTAINERS[architecture]) {
      console.warn(`Architecture ${architecture} not supported for Windows, falling back to ${DEFAULT_CONTAINER_CONFIG.architecture}`);
      architecture = DEFAULT_CONTAINER_CONFIG.architecture;
    }
    
    if (!WINDOWS_CONTAINERS[architecture][version]) {
      console.warn(`Windows version ${version} not supported for ${architecture}, falling back to ${DEFAULT_CONTAINER_CONFIG.version}`);
      version = DEFAULT_CONTAINER_CONFIG.version as WindowsVersion;
    }
    
    // Apply Windows-specific security enhancements
    const windowsSecurityOptions = {
      windowsDefender: true,
      memoryProtection: true,
      controlFlowGuard: true,
      dataExecutionPrevention: true,
      addressSpaceLayoutRandomization: true,
      secureBootEnabled: true,
      hypervisorEnforced: true
    };
    
    // Get the Windows container configuration with enhanced security
    const windowsConfig = {
      ...getWindowsContainerConfig(architecture, version, resources),
      securityOptions: windowsSecurityOptions
    };
    
    // Create the container with the Windows configuration
    const container = await createContainer(malwareId, malwareContent, malwareName, windowsConfig);
    
    console.log(`Windows container created successfully: ${container.id}`);
    return container;
  } catch (error) {
    console.error(`Error creating Windows container: ${error}`);
    throw error;
  }
};

/**
 * Create a Linux container for malware analysis
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
  architecture: ArchitectureType = DEFAULT_LINUX_CONFIG.architecture,
  version: LinuxVersion = DEFAULT_LINUX_CONFIG.version as LinuxVersion,
  resources: ContainerResourceLimits = DEFAULT_RESOURCE_LIMITS
): Promise<Container> => {
  try {
    console.log(`Creating Linux container with architecture: ${architecture}, version: ${version}`);
    
    // Validate architecture and version
    if (!LINUX_CONTAINERS[architecture]) {
      console.warn(`Architecture ${architecture} not supported for Linux, falling back to ${DEFAULT_LINUX_CONFIG.architecture}`);
      architecture = DEFAULT_LINUX_CONFIG.architecture;
    }
    
    if (!LINUX_CONTAINERS[architecture][version]) {
      console.warn(`Linux version ${version} not supported for ${architecture}, falling back to ${DEFAULT_LINUX_CONFIG.version}`);
      version = DEFAULT_LINUX_CONFIG.version as LinuxVersion;
    }
    
    // Extract distribution from version
    const distribution = version.split('-')[0] as LinuxDistribution;
    
    // Apply Linux-specific security enhancements
    const linuxSecurityOptions = {
      selinux: true,
      appArmor: true,
      seccomp: true,
      capabilities: 'drop-all',
      seccompProfile: 'default',
      noNewPrivileges: true,
      readOnlyRootFilesystem: true,
      privileged: false,
      namespaceIsolation: true,
      cgroupsV2: true,
      restrictSysctls: true
    };
    
    // Get the Linux container configuration with enhanced security
    const linuxConfig = {
      ...getLinuxContainerConfig(architecture, version, resources),
      securityOptions: linuxSecurityOptions,
      distribution
    };
    
    // Create the container with the Linux configuration
    const container = await createContainer(malwareId, malwareContent, malwareName, linuxConfig);
    
    console.log(`Linux container created successfully: ${container.id}`);
    return container;
  } catch (error) {
    console.error(`Error creating Linux container: ${error}`);
    throw error;
  }
};

/**
 * Create a macOS container for malware analysis
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
  architecture: ArchitectureType = DEFAULT_MACOS_CONFIG.architecture,
  version: MacOSVersion = DEFAULT_MACOS_CONFIG.version as MacOSVersion,
  resources: ContainerResourceLimits = DEFAULT_RESOURCE_LIMITS
): Promise<Container> => {
  try {
    console.log(`Creating macOS container with architecture: ${architecture}, version: ${version}`);
    
    // Validate architecture and version
    if (!MACOS_CONTAINERS[architecture]) {
      console.warn(`Architecture ${architecture} not supported for macOS, falling back to ${DEFAULT_MACOS_CONFIG.architecture}`);
      architecture = DEFAULT_MACOS_CONFIG.architecture;
    }
    
    if (!MACOS_CONTAINERS[architecture][version]) {
      console.warn(`macOS version ${version} not supported for ${architecture}, falling back to ${DEFAULT_MACOS_CONFIG.version}`);
      version = DEFAULT_MACOS_CONFIG.version as MacOSVersion;
    }
    
    // Apply macOS-specific security enhancements
    const macOSSecurityOptions = {
      sandboxProfile: 'strict',
      transparencyConsent: true,
      systemIntegrityProtection: true,
      gatekeeper: true,
      xpcSecurity: true,
      appSandbox: true,
      fileQuarantine: true,
      addressSpaceLayoutRandomization: true,
      libraryValidation: true
    };
    
    // Get the macOS container configuration with enhanced security
    const macOSConfig = {
      ...getMacOSContainerConfig(architecture, version, resources),
      securityOptions: macOSSecurityOptions
    };
    
    // Create the container with the macOS configuration
    const container = await createContainer(malwareId, malwareContent, malwareName, macOSConfig);
    
    console.log(`macOS container created successfully: ${container.id}`);
    return container;
  } catch (error) {
    console.error(`Error creating macOS container: ${error}`);
    throw error;
  }
};
