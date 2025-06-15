/**
 * Agent Interface Contract
 * This defines the contract that external security agents must implement
 * to integrate with the Athena platform.
 */

import { AgentId, AgentCapabilities, AgentRequest, AgentResponse, AgentState } from './types';

/**
 * Base interface that all external security agents must implement
 */
export interface ISecurityAgent {
  /**
   * Unique identifier for the agent
   */
  getId(): AgentId;

  /**
   * Human-readable name of the agent
   */
  getName(): string;

  /**
   * Version of the agent implementation
   */
  getVersion(): string;

  /**
   * Get the capabilities of this agent
   */
  getCapabilities(): AgentCapabilities;

  /**
   * Get current state of the agent
   */
  getState(): AgentState;

  /**
   * Initialize the agent with configuration
   */
  initialize(config: AgentConfiguration): Promise<void>;

  /**
   * Process a request from the Athena platform
   */
  processRequest(request: AgentRequest): Promise<AgentResponse>;

  /**
   * Health check endpoint
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * Gracefully shutdown the agent
   */
  shutdown(): Promise<void>;
}

/**
 * Configuration provided to agents during initialization
 */
export interface AgentConfiguration {
  /**
   * Athena platform endpoint for callbacks
   */
  athenaEndpoint: string;

  /**
   * Authentication token for secure communication
   */
  authToken: string;

  /**
   * WASM module endpoints available to the agent
   */
  wasmEndpoints: {
    analysisEngine?: string;
    patternMatcher?: string;
    deobfuscator?: string;
    sandbox?: string;
    crypto?: string;
    network?: string;
    fileProcessor?: string;
  };

  /**
   * AI provider configurations
   */
  aiProviders: {
    claude?: AIProviderConfig;
    deepseek?: AIProviderConfig;
    openai?: AIProviderConfig;
  };

  /**
   * Message bus configuration for inter-agent communication
   */
  messageBus: {
    endpoint: string;
    protocol: 'websocket' | 'grpc' | 'rest';
  };

  /**
   * Agent-specific configuration
   */
  agentConfig?: Record<string, any>;
}

export interface AIProviderConfig {
  endpoint: string;
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface HealthCheckResult {
  healthy: boolean;
  timestamp: number;
  components: {
    [key: string]: {
      healthy: boolean;
      message?: string;
      latency?: number;
    };
  };
  metrics?: {
    uptime: number;
    requestsProcessed: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

/**
 * Registration interface for external agents
 */
export interface AgentRegistration {
  agentId: AgentId;
  name: string;
  version: string;
  endpoint: string;
  capabilities: AgentCapabilities;
  requiredWasmModules: string[];
  requiredAiProviders: string[];
  metadata?: Record<string, any>;
}

/**
 * Agent communication protocol
 */
export interface AgentProtocol {
  /**
   * Register an agent with the Athena platform
   */
  register(registration: AgentRegistration): Promise<{ success: boolean; token: string }>;

  /**
   * Send a heartbeat to maintain registration
   */
  heartbeat(agentId: AgentId, token: string): Promise<void>;

  /**
   * Report metrics to the platform
   */
  reportMetrics(agentId: AgentId, metrics: AgentMetrics): Promise<void>;

  /**
   * Send an event to the message bus
   */
  sendEvent(event: AgentEvent): Promise<void>;
}

export interface AgentMetrics {
  timestamp: number;
  cpu: number;
  memory: number;
  requestCount: number;
  errorCount: number;
  customMetrics?: Record<string, number>;
}

export interface AgentEvent {
  agentId: AgentId;
  eventType: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  data: any;
  timestamp: number;
}