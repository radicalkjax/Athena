// AI Model Types
export type AIModelType = 'openai' | 'claude' | 'deepseek' | 'local';

export interface AIModel {
  id: string;
  name: string;
  type: AIModelType;
  isLocal: boolean;
  description: string;
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
  path?: string;
  apiUrl?: string;
  apiPort?: number;
}

// Malware Analysis Types
export interface MalwareFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uri: string;
  content?: string;
}

export interface AnalysisResult {
  id: string;
  malwareId: string;
  modelId: string;
  timestamp: number;
  deobfuscatedCode?: string;
  analysisReport?: string;
  vulnerabilities?: Vulnerability[];
  error?: string;
}

export interface Vulnerability {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cveId?: string;
  metasploitModule?: string;
}

// Container Types
export interface Container {
  id: string;
  status: 'creating' | 'running' | 'stopped' | 'error';
  malwareId: string;
  createdAt: number;
  error?: string;
  os?: OSType;
  architecture?: ArchitectureType;
}

export type OSType = 'windows' | 'linux' | 'macos';
export type ArchitectureType = 'x86' | 'x64' | 'arm' | 'arm64';

export interface ContainerResourceLimits {
  cpu: number;       // CPU cores (e.g., 1 = 1 core, 0.5 = half a core)
  memory: number;    // Memory in MB
  diskSpace: number; // Disk space in MB
  networkSpeed: number; // Network speed in Mbps
  ioOperations: number; // Max I/O operations per second
}

export interface ContainerSecurityOptions {
  // Common security options
  readOnlyRootFilesystem?: boolean;
  noNewPrivileges?: boolean;
  seccomp?: boolean;
  appArmor?: boolean;
  addressSpaceLayoutRandomization?: boolean;
  
  // Windows-specific security options
  windowsDefender?: boolean;
  memoryProtection?: boolean;
  controlFlowGuard?: boolean;
  dataExecutionPrevention?: boolean;
  secureBootEnabled?: boolean;
  hypervisorEnforced?: boolean;
  
  // Linux-specific security options
  selinux?: boolean;
  capabilities?: string;
  seccompProfile?: string;
  privileged?: boolean;
  namespaceIsolation?: boolean;
  cgroupsV2?: boolean;
  restrictSysctls?: boolean;
  
  // macOS-specific security options
  sandboxProfile?: string;
  transparencyConsent?: boolean;
  systemIntegrityProtection?: boolean;
  gatekeeper?: boolean;
  xpcSecurity?: boolean;
  appSandbox?: boolean;
  fileQuarantine?: boolean;
  libraryValidation?: boolean;
}

export interface ContainerConfig {
  os: OSType;
  architecture: ArchitectureType;
  version?: string;
  imageTag?: string;
  distribution?: string; // For Linux distributions
  resources?: ContainerResourceLimits; // Resource limits for the container
  securityOptions?: ContainerSecurityOptions; // Security options for the container
}

// Linux specific types
export type LinuxDistribution = 'ubuntu' | 'debian' | 'centos' | 'fedora' | 'alpine';
export type LinuxVersion = 
  // Ubuntu versions
  | 'ubuntu-18.04' | 'ubuntu-20.04' | 'ubuntu-22.04' 
  // Debian versions
  | 'debian-10' | 'debian-11' | 'debian-12'
  // CentOS versions
  | 'centos-7' | 'centos-8' | 'centos-9'
  // Fedora versions
  | 'fedora-36' | 'fedora-37' | 'fedora-38'
  // Alpine versions
  | 'alpine-3.16' | 'alpine-3.17' | 'alpine-3.18';

// macOS specific types
export type MacOSVersion = 
  | 'macos-11' // Big Sur
  | 'macos-12' // Monterey
  | 'macos-13' // Ventura
  | 'macos-14'; // Sonoma

// Settings Types
export interface AppSettings {
  securityLevel: 'standard' | 'high' | 'maximum';
  defaultAIModel: string | null;
  useLocalModelsWhenAvailable: boolean;
  autoDeleteResults: boolean;
  autoDeleteAfterDays: number;
  theme: 'light' | 'dark' | 'system';
}
