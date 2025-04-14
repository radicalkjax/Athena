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
}

// Settings Types
export interface AppSettings {
  securityLevel: 'standard' | 'high' | 'maximum';
  defaultAIModel: string | null;
  useLocalModelsWhenAvailable: boolean;
  autoDeleteResults: boolean;
  autoDeleteAfterDays: number;
  theme: 'light' | 'dark' | 'system';
}
