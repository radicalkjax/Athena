/**
 * Streaming manager for coordinating WebSocket, SSE, and polling
 */

import {
  StreamingManager,
  StreamingConnection,
  StreamingCapabilities,
  StreamingProtocol,
  WebSocketConfig,
  SSEConfig,
} from './types';
import { WebSocketClient } from './websocketClient';
import { SSEClient } from './sseClient';
import { logger } from '@/shared/logging/logger';
import { featureFlags } from '../config/featureFlags';

// Provider capabilities configuration
const PROVIDER_CAPABILITIES: Record<string, StreamingCapabilities> = {
  openai: {
    provider: 'openai',
    protocols: ['sse', 'polling'],
    preferredProtocol: 'sse',
    maxMessageSize: 16384,
    reconnectAttempts: 3,
  },
  claude: {
    provider: 'claude',
    protocols: ['sse', 'polling'],
    preferredProtocol: 'sse',
    maxMessageSize: 32768,
    reconnectAttempts: 3,
  },
  deepseek: {
    provider: 'deepseek',
    protocols: ['polling'],
    preferredProtocol: 'polling',
    maxMessageSize: 8192,
  },
};

export class StreamingConnectionManager implements StreamingManager {
  private static instance: StreamingConnectionManager;
  private connections: Map<string, WebSocketClient | SSEClient> = new Map();
  private connectionIdCounter = 0;

  private constructor() {}

  static getInstance(): StreamingConnectionManager {
    if (!StreamingConnectionManager.instance) {
      StreamingConnectionManager.instance = new StreamingConnectionManager();
    }
    return StreamingConnectionManager.instance;
  }

  async connect(
    provider: string,
    config: WebSocketConfig | SSEConfig
  ): Promise<StreamingConnection> {
    // Check if streaming is enabled via feature flag
    if (!featureFlags.isEnabled('enableStreamingAnalysis')) {
      throw new Error('Streaming analysis is disabled');
    }
    
    const capabilities = this.getCapabilities(provider);
    const protocol = this.selectProtocol(capabilities, config);
    
    const connectionId = `conn_${provider}_${++this.connectionIdCounter}`;
    
    logger.info(`Creating ${protocol} connection for ${provider}`);

    let client: WebSocketClient | SSEClient;

    switch (protocol) {
      case 'websocket':
        if (!this.isWebSocketConfig(config)) {
          throw new Error('WebSocket protocol requires WebSocketConfig');
        }
        client = new WebSocketClient(connectionId, provider, config);
        await client.connect();
        break;

      case 'sse':
        if (!this.isSSEConfig(config)) {
          throw new Error('SSE protocol requires SSEConfig');
        }
        client = new SSEClient(connectionId, provider, config);
        await client.connect();
        break;

      case 'polling':
        // For polling, we don't create a persistent connection
        // The existing streaming implementation handles this
        throw new Error('Polling is handled by the existing streaming implementation');

      default:
        throw new Error(`Unsupported protocol: ${protocol}`);
    }

    this.connections.set(connectionId, client);
    return client.getConnection();
  }

  disconnect(connectionId: string): void {
    const client = this.connections.get(connectionId);
    if (client) {
      client.disconnect();
      this.connections.delete(connectionId);
      logger.info(`Disconnected connection: ${connectionId}`);
    }
  }

  async send(connectionId: string, message: any): Promise<void> {
    const client = this.connections.get(connectionId);
    if (!client) {
      throw new Error(`Connection not found: ${connectionId}`);
    }
    
    await client.send(message);
  }

  getConnection(connectionId: string): StreamingConnection | null {
    const client = this.connections.get(connectionId);
    return client ? client.getConnection() : null;
  }

  getActiveConnections(): StreamingConnection[] {
    const connections: StreamingConnection[] = [];
    for (const client of this.connections.values()) {
      connections.push(client.getConnection());
    }
    return connections;
  }

  getCapabilities(provider: string): StreamingCapabilities {
    return PROVIDER_CAPABILITIES[provider] || {
      provider,
      protocols: ['polling'],
      preferredProtocol: 'polling',
    };
  }

  // Subscribe to messages from a specific connection
  onMessage(
    connectionId: string,
    handler: (message: any) => void
  ): () => void {
    const client = this.connections.get(connectionId);
    if (!client) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    return client.onMessage(handler);
  }

  // Cleanup all connections
  cleanup(): void {
    for (const [id, client] of this.connections) {
      try {
        client.disconnect();
      } catch (error) {
        logger.error(`Error disconnecting ${id}:`, error);
      }
    }
    this.connections.clear();
  }

  // Private helper methods
  private selectProtocol(
    capabilities: StreamingCapabilities,
    config: WebSocketConfig | SSEConfig
  ): StreamingProtocol {
    // Check if WebSocket is requested and available
    if (this.isWebSocketConfig(config) && capabilities.protocols.includes('websocket')) {
      return 'websocket';
    }

    // Check if SSE is requested and available
    if (this.isSSEConfig(config) && capabilities.protocols.includes('sse')) {
      return 'sse';
    }

    // Use preferred protocol if available
    if (capabilities.protocols.includes(capabilities.preferredProtocol)) {
      return capabilities.preferredProtocol;
    }

    // Fallback to first available protocol
    return capabilities.protocols[0] || 'polling';
  }

  private isWebSocketConfig(config: any): config is WebSocketConfig {
    return config && 'url' in config && config.url.startsWith('ws');
  }

  private isSSEConfig(config: any): config is SSEConfig {
    return config && 'url' in config && !config.url.startsWith('ws');
  }
}

// Export singleton instance
export const streamingManager = StreamingConnectionManager.getInstance();