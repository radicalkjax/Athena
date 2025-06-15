/**
 * Type definitions for AI Provider Integration
 */

export interface AIProvider {
  name: string;
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
  stream?(request: AnalysisRequest): AsyncIterator<AnalysisChunk>;
  getCapabilities(): AICapabilities;
  getStatus(): Promise<ProviderStatus>;
  validateConfig(): Promise<boolean>;
}

export interface AnalysisRequest {
  id: string;
  content: string | ArrayBuffer;
  analysisType?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: {
    fileType?: string;
    fileHash?: string;
    source?: string;
    timestamp?: number;
    [key: string]: any;
  };
  context?: any;
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  };
}

export interface AnalysisResult {
  id: string;
  verdict?: 'malicious' | 'suspicious' | 'clean' | 'unknown';
  confidence?: number;
  threats?: ThreatInfo[];
  vulnerabilities?: VulnerabilityInfo[];
  details?: string;
  recommendations?: string[];
  metadata?: {
    provider?: string;
    model?: string;
    latency?: number;
    tokens?: number;
    cost?: number;
    [key: string]: any;
  };
}

export interface ThreatInfo {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  description: string;
  mitreTactics?: string[];
  iocs?: IOC[];
}

export interface VulnerabilityInfo {
  cve?: string;
  cwe?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation?: string;
}

export interface IOC {
  type: 'ip' | 'domain' | 'hash' | 'email' | 'url' | 'file';
  value: string;
  context?: string;
}

export interface AnalysisChunk {
  id: string;
  type: 'progress' | 'partial' | 'complete';
  content?: string;
  progress?: number;
  metadata?: any;
}

export interface AICapabilities {
  models: string[];
  features: string[];
  maxTokens: number;
  supportedFormats: string[];
  specializations: string[];
  streaming: boolean;
}

export interface ProviderStatus {
  available: boolean;
  healthy: boolean;
  latency?: number;
  rateLimit?: {
    remaining: number;
    reset: Date;
  };
  errors?: string[];
}

export interface ProviderConfig {
  claude?: {
    apiKey: string;
    endpoint?: string;
    model?: string;
    maxRetries?: number;
    timeout?: number;
  };
  deepseek?: {
    apiKey: string;
    endpoint?: string;
    model?: string;
    maxRetries?: number;
    timeout?: number;
  };
  openai?: {
    apiKey: string;
    endpoint?: string;
    model?: string;
    organization?: string;
    maxRetries?: number;
    timeout?: number;
  };
}

export interface SanitizedInput {
  original: string | ArrayBuffer;
  sanitized: string;
  removed?: string[];
  warnings?: string[];
  metadata: {
    originalSize: number;
    sanitizedSize: number;
    processingTime: number;
  };
}

export interface EnsembleOptions {
  providers?: string[];
  providerCount?: number;
  consensusThreshold?: number;
  minConfidence?: number;
  timeout?: number;
  conflictResolution?: 'majority' | 'weighted' | 'highest_confidence';
}

export interface EnsembleResult extends AnalysisResult {
  consensus?: {
    agreement: number;
    providers: string[];
    conflicts?: any[];
  };
  individualResults?: AnalysisResult[];
}

export interface PreprocessingOptions {
  sanitize?: boolean;
  validatePrompt?: boolean;
  extractContent?: boolean;
  checkMalware?: boolean;
  deobfuscate?: boolean;
  maxSize?: number;
}

export interface AIAnalysisResult extends AnalysisResult {
  preprocessing?: {
    sanitized: boolean;
    warnings: string[];
    removedPatterns: string[];
  };
  aiMetadata?: {
    strategy: 'single' | 'ensemble' | 'sequential' | 'specialized';
    providersUsed: string[];
    totalLatency: number;
    totalCost: number;
  };
}

// Error types
export class AIProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public code?: string,
    public retryable?: boolean
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class OrchestrationError extends Error {
  constructor(
    message: string,
    public failedProviders?: string[],
    public partialResults?: any[]
  ) {
    super(message);
    this.name = 'OrchestrationError';
  }
}

// Rate limiting
export interface RateLimitConfig {
  requestsPerMinute: number;
  tokensPerMinute: number;
  concurrent: number;
}

// Caching
export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  maxSize: number;
  keyStrategy: 'hash' | 'content' | 'custom';
}

// Monitoring
export interface ProviderMetrics {
  requests: number;
  errors: number;
  avgLatency: number;
  successRate: number;
  cost: number;
  lastError?: string;
  lastSuccess?: Date;
}

// Orchestration types
export type OrchestrationStrategy = 'single' | 'ensemble' | 'sequential' | 'specialized';

export interface AIOrchestratorConfig {
  providers: ProviderConfig;
  defaultStrategy?: OrchestrationStrategy;
  cacheConfig?: CacheConfig;
  rateLimitConfig?: RateLimitConfig;
  preprocessingOptions?: PreprocessingOptions;
  monitoring?: {
    enabled: boolean;
    metricsPort?: number;
  };
}

// Aliases for consistency
export type AIAnalysisRequest = AnalysisRequest;
export type AIAnalysisResponse = AIAnalysisResult;