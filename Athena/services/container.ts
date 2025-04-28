import { createContainerClient, safeApiCall, sanitizeRequestData } from './apiClient';
import * as SecureStore from 'expo-secure-store';
import { Container, ContainerConfig, OSType, ArchitectureType, LinuxVersion, LinuxDistribution, MacOSVersion } from '@/types';
import { generateId } from '@/utils/helpers';

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

// Default container configurations
const DEFAULT_CONTAINER_CONFIG: ContainerConfig = {
  os: 'windows',
  architecture: 'x64',
  version: 'windows-10',
};

// Default Linux container configuration
const DEFAULT_LINUX_CONFIG: ContainerConfig = {
  os: 'linux',
  architecture: 'x64',
  version: 'ubuntu-22.04',
  distribution: 'ubuntu',
};

// Default macOS container configuration
const DEFAULT_MACOS_CONFIG: ContainerConfig = {
  os: 'macos',
  architecture: 'arm64',
  version: 'macos-14', // Sonoma
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
 * Get Windows container configuration
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @param version Windows version (windows-7, windows-8, windows-10, windows-11)
 * @returns Container configuration with image tag
 */
export const getWindowsContainerConfig = (
  architecture: ArchitectureType = DEFAULT_CONTAINER_CONFIG.architecture,
  version: WindowsVersion = DEFAULT_CONTAINER_CONFIG.version as WindowsVersion
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
 * @returns Container configuration with image tag
 */
export const getLinuxContainerConfig = (
  architecture: ArchitectureType = DEFAULT_LINUX_CONFIG.architecture,
  version: LinuxVersion = DEFAULT_LINUX_CONFIG.version as LinuxVersion
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
 * @returns Container configuration with image tag
 */
export const getMacOSContainerConfig = (
  architecture: ArchitectureType = DEFAULT_MACOS_CONFIG.architecture,
  version: MacOSVersion = DEFAULT_MACOS_CONFIG.version as MacOSVersion
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
 * Create a new container for malware analysis
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
): Promise<Container> => {
  try {
    const client = await initContainerService();
    
    const containerId = generateId();
    
    // Use provided container config or default to Windows x64
    const config = containerConfig ? 
      { ...DEFAULT_CONTAINER_CONFIG, ...containerConfig } : 
      DEFAULT_CONTAINER_CONFIG;
    
    // Get the OS-specific container configuration
    let finalConfig = config;
    if (config.os === 'windows') {
      finalConfig = getWindowsContainerConfig(
        config.architecture,
        config.version as WindowsVersion
      );
    } else if (config.os === 'linux') {
      finalConfig = getLinuxContainerConfig(
        config.architecture,
        config.version as LinuxVersion
      );
    } else if (config.os === 'macos') {
      finalConfig = getMacOSContainerConfig(
        config.architecture,
        config.version as MacOSVersion
      );
    }
    
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
 * @returns Container object
 */
export const createWindowsContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  architecture: ArchitectureType = DEFAULT_CONTAINER_CONFIG.architecture,
  version: WindowsVersion = DEFAULT_CONTAINER_CONFIG.version as WindowsVersion
): Promise<Container> => {
  // Get the Windows container configuration
  const windowsConfig = getWindowsContainerConfig(architecture, version);
  
  // Create the container with the Windows configuration
  return createContainer(malwareId, malwareContent, malwareName, windowsConfig);
};

/**
 * Create a Linux container for malware analysis
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @param architecture Architecture type (x86, x64, arm, arm64)
 * @param version Linux version (e.g., ubuntu-22.04, debian-11, etc.)
 * @returns Container object
 */
export const createLinuxContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  architecture: ArchitectureType = DEFAULT_LINUX_CONFIG.architecture,
  version: LinuxVersion = DEFAULT_LINUX_CONFIG.version as LinuxVersion
): Promise<Container> => {
  // Get the Linux container configuration
  const linuxConfig = getLinuxContainerConfig(architecture, version);
  
  // Create the container with the Linux configuration
  return createContainer(malwareId, malwareContent, malwareName, linuxConfig);
};

/**
 * Create a macOS container for malware analysis
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @param architecture Architecture type (x64, arm64)
 * @param version macOS version (macos-11, macos-12, macos-13, macos-14)
 * @returns Container object
 */
export const createMacOSContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string,
  architecture: ArchitectureType = DEFAULT_MACOS_CONFIG.architecture,
  version: MacOSVersion = DEFAULT_MACOS_CONFIG.version as MacOSVersion
): Promise<Container> => {
  // Get the macOS container configuration
  const macOSConfig = getMacOSContainerConfig(architecture, version);
  
  // Create the container with the macOS configuration
  return createContainer(malwareId, malwareContent, malwareName, macOSConfig);
};
