import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentId, AgentState } from './types';
import { AgentRegistration, AgentMetrics } from './agent-interface';
import { MessageBus } from './message-bus';

interface RegisteredAgent extends AgentRegistration {
  token: string;
  registeredAt: number;
  lastHeartbeat: number;
  state: AgentState;
  metrics?: AgentMetrics;
}

export class AgentRegistry extends EventEmitter {
  private agents: Map<AgentId, RegisteredAgent> = new Map();
  private messageBus: MessageBus;
  private heartbeatInterval: NodeJS.Timer | null = null;
  private readonly heartbeatTimeout = 60000; // 1 minute
  private readonly checkInterval = 10000; // 10 seconds

  constructor(messageBus: MessageBus) {
    super();
    this.messageBus = messageBus;
    this.startHeartbeatMonitoring();
  }

  /**
   * Register a new external agent
   */
  async register(registration: AgentRegistration): Promise<{ success: boolean; token: string }> {
    try {
      // Validate registration
      this.validateRegistration(registration);

      // Generate auth token
      const token = this.generateToken();

      // Create registered agent entry
      const registeredAgent: RegisteredAgent = {
        ...registration,
        token,
        registeredAt: Date.now(),
        lastHeartbeat: Date.now(),
        state: {
          status: 'initializing',
          health: {
            healthy: true,
            wasmModulesStatus: {},
            aiProvidersStatus: {},
            lastHealthCheck: Date.now(),
          },
          activeRequests: 0,
          lastActivity: Date.now(),
        },
      };

      // Store agent
      this.agents.set(registration.agentId, registeredAgent);

      // Emit registration event
      this.emit('agent-registered', registration.agentId);

      // Notify other components via message bus
      await this.messageBus.publish({
        id: uuidv4(),
        from: 'OWL', // System agent ID for registry
        to: 'broadcast',
        type: 'event',
        payload: {
          event: 'agent-registered',
          agentId: registration.agentId,
          capabilities: registration.capabilities,
        },
        timestamp: Date.now(),
        priority: 'normal',
      });

      return { success: true, token };
    } catch (error) {
      console.error('Agent registration failed:', error);
      return { success: false, token: '' };
    }
  }

  /**
   * Update agent heartbeat
   */
  async heartbeat(agentId: AgentId, token: string): Promise<void> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not registered`);
    }

    if (agent.token !== token) {
      throw new Error('Invalid token');
    }

    agent.lastHeartbeat = Date.now();
    agent.state.status = 'ready';
    agent.state.lastActivity = Date.now();
  }

  /**
   * Update agent metrics
   */
  async reportMetrics(agentId: AgentId, metrics: AgentMetrics): Promise<void> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not registered`);
    }

    agent.metrics = metrics;
    agent.state.lastActivity = Date.now();

    // Emit metrics event for monitoring
    this.emit('agent-metrics', { agentId, metrics });
  }

  /**
   * Get registered agent information
   */
  getAgent(agentId: AgentId): RegisteredAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by capability
   */
  getAgentsByCapability(capability: string): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.capabilities.supportedOperations.includes(capability)
    );
  }

  /**
   * Get available agents (healthy and ready)
   */
  getAvailableAgents(): RegisteredAgent[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.state.status === 'ready' && agent.state.health.healthy
    );
  }

  /**
   * Unregister an agent
   */
  async unregister(agentId: AgentId, token: string): Promise<void> {
    const agent = this.agents.get(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not registered`);
    }

    if (agent.token !== token) {
      throw new Error('Invalid token');
    }

    this.agents.delete(agentId);

    // Emit unregistration event
    this.emit('agent-unregistered', agentId);

    // Notify via message bus
    await this.messageBus.publish({
      id: uuidv4(),
      from: 'OWL',
      to: 'broadcast',
      type: 'event',
      payload: {
        event: 'agent-unregistered',
        agentId,
      },
      timestamp: Date.now(),
      priority: 'normal',
    });
  }

  /**
   * Monitor agent heartbeats and mark unhealthy agents
   */
  private startHeartbeatMonitoring(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      
      for (const [agentId, agent] of this.agents) {
        const timeSinceHeartbeat = now - agent.lastHeartbeat;
        
        if (timeSinceHeartbeat > this.heartbeatTimeout) {
          // Mark agent as unhealthy
          agent.state.status = 'error';
          agent.state.health.healthy = false;
          agent.state.health.issues = ['Heartbeat timeout'];
          
          // Emit unhealthy event
          this.emit('agent-unhealthy', agentId);
        }
      }
    }, this.checkInterval);
  }

  /**
   * Validate agent registration
   */
  private validateRegistration(registration: AgentRegistration): void {
    if (!registration.agentId) {
      throw new Error('Agent ID is required');
    }

    if (!registration.endpoint) {
      throw new Error('Agent endpoint is required');
    }

    if (!registration.capabilities) {
      throw new Error('Agent capabilities are required');
    }

    if (this.agents.has(registration.agentId)) {
      throw new Error(`Agent ${registration.agentId} is already registered`);
    }
  }

  /**
   * Generate secure token for agent authentication
   */
  private generateToken(): string {
    return `${uuidv4()}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Get registry metrics
   */
  getMetrics() {
    const agents = Array.from(this.agents.values());
    
    return {
      totalAgents: agents.length,
      healthyAgents: agents.filter(a => a.state.health.healthy).length,
      activeAgents: agents.filter(a => a.state.status === 'ready').length,
      agentsByStatus: agents.reduce((acc, agent) => {
        acc[agent.state.status] = (acc[agent.state.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  /**
   * Shutdown the registry
   */
  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval as NodeJS.Timeout);
      this.heartbeatInterval = null;
    }

    // Notify all agents of shutdown
    const shutdownPromises = Array.from(this.agents.values()).map(agent =>
      this.messageBus.publish({
        id: uuidv4(),
        from: 'OWL',
        to: agent.agentId,
        type: 'command',
        payload: { command: 'shutdown' },
        timestamp: Date.now(),
        priority: 'critical',
      })
    );

    await Promise.all(shutdownPromises);

    // Clear registry
    this.agents.clear();
    this.removeAllListeners();
  }
}