export type AIProvider = 'claude' | 'gpt4' | 'deepseek' | 'gemini' | 'mistral' | 'llama';

export interface AIProviderConfig {
  id: AIProvider;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  enabled: boolean;
}

export interface AIAnalysisRequest {
  fileHash: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileContent?: ArrayBuffer;
  analysisType: 'static' | 'dynamic' | 'behavioral' | 'comprehensive';
  providers: AIProvider[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface AIAnalysisResult {
  provider: AIProvider;
  timestamp: number;
  confidence: number;
  threatLevel: 'safe' | 'suspicious' | 'malicious' | 'critical';
  malwareFamily?: string;
  malwareType?: string;
  signatures: string[];
  behaviors: string[];
  iocs: {
    domains: string[];
    ips: string[];
    files: string[];
    registry: string[];
    processes: string[];
  };
  recommendations: string[];
  rawResponse?: any;
  error?: string;
}

export interface EnsembleAnalysisResult {
  id: string;
  fileHash: string;
  timestamp: number;
  providers: AIProvider[];
  individualResults: AIAnalysisResult[];
  consensusResult: {
    confidence: number;
    threatLevel: 'safe' | 'suspicious' | 'malicious' | 'critical';
    malwareFamily?: string;
    malwareType?: string;
    aggregatedSignatures: string[];
    aggregatedBehaviors: string[];
    aggregatedIocs: {
      domains: string[];
      ips: string[];
      files: string[];
      registry: string[];
      processes: string[];
    };
    summary: string;
  };
  disagreements: {
    provider: AIProvider;
    field: string;
    value: any;
  }[];
}