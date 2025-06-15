import { EventEmitter } from 'events';
import { MessageBus, AgentRegistry, AgentConnector } from './base';
import { AgentId, AgentRequest, AgentResponse } from './base/types';
import { AgentRegistration } from './base/agent-interface';

export interface AgentManagerConfig {
  messageBusConfig?: {
    maxHistorySize?: number;
  };
  connectorConfig?: {
    timeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
  };
  registryConfig?: {
    heartbeatTimeout?: number;
    checkInterval?: number;
  };
}

export class AgentManager extends EventEmitter {
  private messageBus: MessageBus;
  private registry: AgentRegistry;
  private connector: AgentConnector;
  private initialized: boolean = false;

  constructor(private config: AgentManagerConfig = {}) {
    super();
    
    // Initialize core components
    this.messageBus = new MessageBus();
    this.registry = new AgentRegistry(this.messageBus);
    this.connector = new AgentConnector(
      this.registry,
      this.messageBus,
      this.config.connectorConfig
    );

    this.setupEventForwarding();
  }

  /**
   * Initialize the agent manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Set up message bus listeners for system events
    this.messageBus.on('message', (message) => {
      this.emit('message', message);
    });

    this.messageBus.on('handler-error', (error) => {
      this.emit('error', error);
    });

    this.initialized = true;
    this.emit('initialized');
  }

  /**
   * Register an external agent
   */
  async registerAgent(registration: AgentRegistration): Promise<{ success: boolean; token: string }> {
    const result = await this.registry.register(registration);
    
    if (result.success) {
      this.emit('agent:registered', registration.agentId);
    }

    return result;
  }

  /**
   * Send a request to a specific agent
   */
  async sendRequest(agentId: AgentId, request: AgentRequest): Promise<AgentResponse> {
    return this.connector.sendRequest(agentId, request);
  }

  /**
   * Execute a security analysis workflow
   */
  async executeAnalysis(data: {
    type: 'malware' | 'network' | 'vulnerability' | 'incident';
    payload: any;
    options?: {
      agents?: AgentId[];
      priority?: 'low' | 'normal' | 'high' | 'critical';
      timeout?: number;
    };
  }): Promise<{
    results: Map<AgentId, AgentResponse>;
    summary: AnalysisSummary;
  }> {
    const { type, payload, options = {} } = data;
    
    // Determine which agents to use based on analysis type
    const agentCapabilities = this.getAgentCapabilitiesForAnalysis(type);
    const targetAgents = options.agents || this.selectAgentsForCapabilities(agentCapabilities);

    // Create analysis request
    const request: Omit<AgentRequest, 'id'> = {
      type: `analysis:${type}`,
      priority: options.priority || 'normal',
      data: payload,
      metadata: {
        analysisType: type,
        timestamp: Date.now(),
      },
      timeout: options.timeout,
    };

    // Send to all target agents
    const results = await this.connector.broadcastToCapability(
      agentCapabilities[0], // Primary capability
      request
    );

    // Generate summary
    const summary = this.generateAnalysisSummary(results, type);

    return { results, summary };
  }

  /**
   * Get agent capabilities required for analysis type
   */
  private getAgentCapabilitiesForAnalysis(type: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      malware: ['malware-analysis', 'reverse-engineering', 'deobfuscation'],
      network: ['network-analysis', 'threat-modeling', 'protocol-analysis'],
      vulnerability: ['vulnerability-assessment', 'pattern-matching', 'code-analysis'],
      incident: ['incident-response', 'threat-intelligence', 'forensics'],
    };

    return capabilityMap[type] || ['general-analysis'];
  }

  /**
   * Select agents based on required capabilities
   */
  private selectAgentsForCapabilities(capabilities: string[]): AgentId[] {
    const agents = new Set<AgentId>();

    for (const capability of capabilities) {
      const capableAgents = this.registry.getAgentsByCapability(capability);
      capableAgents.forEach(agent => agents.add(agent.agentId));
    }

    return Array.from(agents);
  }

  /**
   * Generate analysis summary from agent responses
   */
  private generateAnalysisSummary(
    results: Map<AgentId, AgentResponse>,
    analysisType: string
  ): AnalysisSummary {
    const successfulResponses = Array.from(results.entries())
      .filter(([, response]) => response.status === 'success');

    const threats: any[] = [];
    let overallRiskScore = 0;
    const recommendations = new Set<string>();

    // Aggregate results from all agents
    for (const [agentId, response] of successfulResponses) {
      if (response.data?.threats) {
        threats.push(...response.data.threats);
      }
      if (response.data?.riskScore) {
        overallRiskScore = Math.max(overallRiskScore, response.data.riskScore);
      }
      if (response.data?.recommendations) {
        response.data.recommendations.forEach((rec: string) => recommendations.add(rec));
      }
    }

    return {
      analysisType,
      timestamp: Date.now(),
      agentsInvolved: successfulResponses.length,
      totalAgents: results.size,
      overallRiskScore,
      threatsDetected: threats.length,
      threats: threats.slice(0, 10), // Top 10 threats
      recommendations: Array.from(recommendations),
      processingTime: Math.max(
        ...Array.from(results.values()).map(r => r.processingTime || 0)
      ),
    };
  }

  /**
   * Set up event forwarding from components
   */
  private setupEventForwarding(): void {
    // Forward registry events
    this.registry.on('agent-registered', (agentId) => {
      this.emit('agent:registered', agentId);
    });

    this.registry.on('agent-unregistered', (agentId) => {
      this.emit('agent:unregistered', agentId);
    });

    this.registry.on('agent-unhealthy', (agentId) => {
      this.emit('agent:unhealthy', agentId);
    });

    this.registry.on('agent-metrics', (data) => {
      this.emit('agent:metrics', data);
    });
  }

  /**
   * Get current status of all agents
   */
  getAgentStatus(): AgentStatus[] {
    return this.registry.getAllAgents().map(agent => ({
      agentId: agent.agentId,
      name: agent.name,
      version: agent.version,
      state: agent.state,
      capabilities: agent.capabilities,
      lastHeartbeat: agent.lastHeartbeat,
      metrics: agent.metrics,
    }));
  }

  /**
   * Get message bus metrics
   */
  getMessageBusMetrics() {
    return this.messageBus.getMetrics();
  }

  /**
   * Get overall system metrics
   */
  getMetrics() {
    return {
      messageBus: this.messageBus.getMetrics(),
      registry: this.registry.getMetrics(),
      connector: this.connector.getMetrics(),
    };
  }

  /**
   * Health check all agents
   */
  async healthCheckAgents(): Promise<Map<AgentId, boolean>> {
    return this.connector.healthCheckAll();
  }

  /**
   * Gracefully shutdown the agent manager
   */
  async shutdown(): Promise<void> {
    this.emit('shutting-down');

    // Shutdown components in order
    await this.connector.shutdown();
    await this.registry.shutdown();
    await this.messageBus.shutdown();

    this.initialized = false;
    this.removeAllListeners();

    this.emit('shutdown');
  }
}

// Type definitions
interface AnalysisSummary {
  analysisType: string;
  timestamp: number;
  agentsInvolved: number;
  totalAgents: number;
  overallRiskScore: number;
  threatsDetected: number;
  threats: any[];
  recommendations: string[];
  processingTime: number;
}

interface AgentStatus {
  agentId: AgentId;
  name: string;
  version: string;
  state: any;
  capabilities: any;
  lastHeartbeat: number;
  metrics?: any;
}

// Export singleton instance
let agentManager: AgentManager | null = null;

export function getAgentManager(config?: AgentManagerConfig): AgentManager {
  if (!agentManager) {
    agentManager = new AgentManager(config);
  }
  return agentManager;
}