import axios, { AxiosInstance } from 'axios';
import { AgentId, AgentRequest, AgentResponse } from './types';
import { AgentRegistry } from './agent-registry';
import { MessageBus } from './message-bus';
import { v4 as uuidv4 } from 'uuid';

interface ConnectorOptions {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export class AgentConnector {
  private registry: AgentRegistry;
  private messageBus: MessageBus;
  private httpClients: Map<AgentId, AxiosInstance> = new Map();
  private options: Required<ConnectorOptions>;

  constructor(
    registry: AgentRegistry,
    messageBus: MessageBus,
    options: ConnectorOptions = {}
  ) {
    this.registry = registry;
    this.messageBus = messageBus;
    this.options = {
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3,
      retryDelay: options.retryDelay || 1000,
    };
  }

  /**
   * Send a request to an external agent
   */
  async sendRequest(
    agentId: AgentId,
    request: AgentRequest
  ): Promise<AgentResponse> {
    const agent = this.registry.getAgent(agentId);
    
    if (!agent) {
      throw new Error(`Agent ${agentId} not registered`);
    }

    if (agent.state.status !== 'ready') {
      throw new Error(`Agent ${agentId} is not ready (status: ${agent.state.status})`);
    }

    // Get or create HTTP client for the agent
    const client = this.getOrCreateClient(agentId, agent.endpoint);

    // Send request with retries
    return this.sendWithRetry(client, request, agentId);
  }

  /**
   * Broadcast a request to all available agents with a specific capability
   */
  async broadcastToCapability(
    capability: string,
    request: Omit<AgentRequest, 'id'>
  ): Promise<Map<AgentId, AgentResponse>> {
    const agents = this.registry.getAgentsByCapability(capability);
    const results = new Map<AgentId, AgentResponse>();

    // Send requests in parallel
    const promises = agents.map(async agent => {
      try {
        const response = await this.sendRequest(agent.agentId, {
          ...request,
          id: uuidv4(),
        });
        results.set(agent.agentId, response);
      } catch (error) {
        console.error(`Failed to send request to ${agent.agentId}:`, error);
        results.set(agent.agentId, {
          id: uuidv4(),
          requestId: '',
          status: 'error',
          error: {
            code: 'AGENT_COMMUNICATION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            recoverable: true,
          },
          processingTime: 0,
        });
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Execute a workflow across multiple agents
   */
  async executeWorkflow(
    workflow: {
      steps: Array<{
        agentId: AgentId;
        request: Omit<AgentRequest, 'id'>;
        dependsOn?: string[];
      }>;
    }
  ): Promise<Map<string, AgentResponse>> {
    const results = new Map<string, AgentResponse>();
    const stepResults = new Map<string, any>();

    for (const step of workflow.steps) {
      // Wait for dependencies
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepResults.has(dep)) {
            throw new Error(`Dependency ${dep} not found`);
          }
        }
      }

      // Execute step
      const stepId = `${step.agentId}-${Date.now()}`;
      const response = await this.sendRequest(step.agentId, {
        ...step.request,
        id: uuidv4(),
        metadata: {
          ...step.request.metadata,
          workflowStep: stepId,
          dependencies: step.dependsOn,
        },
      });

      results.set(stepId, response);
      stepResults.set(stepId, response.data);
    }

    return results;
  }

  /**
   * Get or create HTTP client for an agent
   */
  private getOrCreateClient(agentId: AgentId, endpoint: string): AxiosInstance {
    let client = this.httpClients.get(agentId);
    
    if (!client) {
      client = axios.create({
        baseURL: endpoint,
        timeout: this.options.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Athena-Agent': 'true',
        },
      });

      this.httpClients.set(agentId, client);
    }

    return client;
  }

  /**
   * Send request with retry logic
   */
  private async sendWithRetry(
    client: AxiosInstance,
    request: AgentRequest,
    agentId: AgentId
  ): Promise<AgentResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.options.retryAttempts; attempt++) {
      try {
        const startTime = Date.now();
        
        // Send HTTP request
        const response = await client.post('/process', request);
        
        // Validate response
        this.validateResponse(response.data);
        
        // Add processing time if not included
        if (!response.data.processingTime) {
          response.data.processingTime = Date.now() - startTime;
        }

        // Update agent activity
        const agent = this.registry.getAgent(agentId);
        if (agent) {
          agent.state.lastActivity = Date.now();
        }

        return response.data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on non-recoverable errors
        if (axios.isAxiosError(error) && error.response?.status === 400) {
          break;
        }

        // Wait before retry
        if (attempt < this.options.retryAttempts - 1) {
          await this.delay(this.options.retryDelay * (attempt + 1));
        }
      }
    }

    throw lastError || new Error('Request failed after retries');
  }

  /**
   * Validate agent response
   */
  private validateResponse(response: any): void {
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format');
    }

    if (!response.id || !response.requestId || !response.status) {
      throw new Error('Missing required response fields');
    }

    if (!['success', 'error', 'partial'].includes(response.status)) {
      throw new Error(`Invalid response status: ${response.status}`);
    }
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Health check all registered agents
   */
  async healthCheckAll(): Promise<Map<AgentId, boolean>> {
    const agents = this.registry.getAllAgents();
    const results = new Map<AgentId, boolean>();

    const promises = agents.map(async agent => {
      try {
        const client = this.getOrCreateClient(agent.agentId, agent.endpoint);
        const response = await client.get('/health', { timeout: 5000 });
        results.set(agent.agentId, response.data.healthy === true);
      } catch (error) {
        results.set(agent.agentId, false);
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Get connector metrics
   */
  getMetrics() {
    return {
      activeClients: this.httpClients.size,
      registeredAgents: this.registry.getAllAgents().length,
      availableAgents: this.registry.getAvailableAgents().length,
    };
  }

  /**
   * Shutdown the connector
   */
  async shutdown(): Promise<void> {
    // Clear HTTP clients
    this.httpClients.clear();
  }
}