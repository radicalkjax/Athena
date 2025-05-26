/**
 * Common types for AI services
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeobfuscationResult {
  deobfuscatedCode: string;
  analysisReport: string;
}

export interface Vulnerability {
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cveId?: string;
  metasploitModule?: string;
}

export interface VulnerabilityAnalysisResult {
  vulnerabilities: Vulnerability[];
  analysisReport: string;
}

export interface AIServiceConfig {
  apiKey: string;
  baseUrl: string;
  modelId: string;
}

export interface AIProvider {
  name: 'claude' | 'openai' | 'deepseek';
  storageKeyPrefix: string;
  defaultModel: string;
  defaultBaseUrl: string;
  envKeyName: string;
  envBaseUrlName?: string;
}

export interface AIClientConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  modelId?: string;
}