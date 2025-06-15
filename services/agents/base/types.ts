// Agent type definitions
export type AgentId = 'OWL' | 'DORU' | 'AEGIS' | 'WEAVER' | 'FORGE' | 'POLIS';

export interface AgentCapabilities {
  wasmModules: string[];
  aiProviders: string[];
  supportedOperations: string[];
  realTimeProcessing: boolean;
  batchProcessing: boolean;
  maxConcurrentRequests: number;
}

export interface AgentRequest {
  id: string;
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  data: any;
  metadata?: Record<string, any>;
  timeout?: number;
  correlationId?: string;
}

export interface AgentResponse {
  id: string;
  requestId: string;
  status: 'success' | 'error' | 'partial';
  data?: any;
  error?: AgentError;
  metadata?: Record<string, any>;
  processingTime: number;
  wasmMetrics?: WASMMetrics;
}

export interface AgentError {
  code: string;
  message: string;
  details?: any;
  recoverable: boolean;
}

export interface WASMMetrics {
  executionTime: number;
  memoryUsed: number;
  modulesInvoked: string[];
}

// Message bus types
export interface AgentMessage {
  id: string;
  from: AgentId;
  to: AgentId | 'broadcast';
  type: 'request' | 'response' | 'event' | 'command';
  payload: any;
  correlationId?: string;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export type MessageHandler = (message: AgentMessage) => Promise<void> | void;

// Workflow types
export interface WorkflowStep {
  id: string;
  agentId: AgentId;
  request: Partial<AgentRequest>;
  transform?: (input: any) => any;
  condition?: (result: any) => boolean;
  timeout?: number;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  rollbackSteps?: WorkflowStep[];
}

export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  results: Map<string, any>;
  errors?: AgentError[];
  totalTime: number;
}

// AI Provider types (extending existing)
export interface AIProvider {
  name: string;
  analyze(input: any): Promise<any>;
  isAvailable(): Promise<boolean>;
  getMetrics(): ProviderMetrics;
}

export interface ProviderMetrics {
  requestCount: number;
  errorCount: number;
  averageLatency: number;
  availability: number;
}

// Security-specific types
export interface ThreatReport {
  threats: Threat[];
  riskScore: number;
  confidence: number;
  recommendations: string[];
  timestamp: number;
}

export interface Threat {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: any[];
  mitigations: string[];
}

// Agent state management
export interface AgentState {
  status: 'initializing' | 'ready' | 'busy' | 'error' | 'shutdown';
  health: AgentHealth;
  activeRequests: number;
  lastActivity: number;
}

export interface AgentHealth {
  healthy: boolean;
  wasmModulesStatus: Record<string, boolean>;
  aiProvidersStatus: Record<string, boolean>;
  lastHealthCheck: number;
  issues?: string[];
}