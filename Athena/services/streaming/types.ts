/**
 * Types for WebSocket and streaming implementations
 */

export type StreamingProtocol = 'websocket' | 'sse' | 'polling';

export interface StreamingCapabilities {
  provider: string;
  protocols: StreamingProtocol[];
  preferredProtocol: StreamingProtocol;
  maxMessageSize?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface StreamingConnection {
  id: string;
  protocol: StreamingProtocol;
  provider: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  createdAt: number;
  lastActivity: number;
  messageCount: number;
  bytesTransferred: number;
}

export interface StreamingMessage {
  id: string;
  type: 'data' | 'error' | 'complete' | 'heartbeat';
  payload: any;
  timestamp: number;
  sequence: number;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  messageTimeout?: number;
}

export interface SSEConfig {
  url: string;
  withCredentials?: boolean;
  retryDelay?: number;
  maxRetries?: number;
}

export interface StreamingManager {
  connect(provider: string, config: WebSocketConfig | SSEConfig): Promise<StreamingConnection>;
  disconnect(connectionId: string): void;
  send(connectionId: string, message: any): Promise<void>;
  getConnection(connectionId: string): StreamingConnection | null;
  getActiveConnections(): StreamingConnection[];
  getCapabilities(provider: string): StreamingCapabilities;
}