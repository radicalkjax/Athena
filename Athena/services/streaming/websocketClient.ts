/**
 * WebSocket client for real-time streaming
 */

import { WebSocketConfig, StreamingMessage, StreamingConnection } from './types';
import { logger } from '@/shared/logging/logger';

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig;
  private connection: StreamingConnection;
  private messageQueue: any[] = [];
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, (message: StreamingMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private messageSequence = 0;

  constructor(
    connectionId: string,
    provider: string,
    config: WebSocketConfig
  ) {
    this.config = {
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000,
      messageTimeout: 60000,
      ...config
    };

    this.connection = {
      id: connectionId,
      protocol: 'websocket',
      provider,
      status: 'connecting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      messageCount: 0,
      bytesTransferred: 0
    };
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if WebSocket is available (not available in React Native)
        if (typeof WebSocket === 'undefined') {
          throw new Error('WebSocket not available in this environment');
        }

        this.ws = new WebSocket(this.config.url, this.config.protocols);
        
        this.ws.onopen = () => {
          logger.info(`WebSocket connected to ${this.config.url}`);
          this.connection.status = 'connected';
          this.connection.lastActivity = Date.now();
          this.reconnectAttempts = 0;
          
          // Start heartbeat
          this.startHeartbeat();
          
          // Process queued messages
          this.processMessageQueue();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          logger.error('WebSocket error:', error);
          this.connection.status = 'error';
        };

        this.ws.onclose = (event) => {
          logger.info(`WebSocket closed: ${event.code} - ${event.reason}`);
          this.connection.status = 'disconnected';
          this.stopHeartbeat();
          
          // Attempt reconnection if not a normal closure
          if (event.code !== 1000 && event.code !== 1001) {
            this.scheduleReconnect();
          }
        };

        // Set connection timeout
        setTimeout(() => {
          if (this.connection.status === 'connecting') {
            this.ws?.close();
            reject(new Error('WebSocket connection timeout'));
          }
        }, 10000);

      } catch (error: unknown) {
        this.connection.status = 'error';
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.connection.status = 'disconnected';
  }

  async send(message: any): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue message if not connected
      this.messageQueue.push(message);
      return;
    }

    try {
      const streamingMessage: StreamingMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'data',
        payload: message,
        timestamp: Date.now(),
        sequence: this.messageSequence++
      };

      const data = JSON.stringify(streamingMessage);
      this.ws.send(data);
      
      this.connection.messageCount++;
      this.connection.bytesTransferred += data.length;
      this.connection.lastActivity = Date.now();
      
    } catch (error: unknown) {
      logger.error('Failed to send WebSocket message:', error);
      throw error;
    }
  }

  onMessage(handler: (message: StreamingMessage) => void): () => void {
    const handlerId = `handler_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.messageHandlers.set(handlerId, handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.delete(handlerId);
    };
  }

  getConnection(): StreamingConnection {
    return { ...this.connection };
  }

  // Private methods
  private handleMessage(data: string): void {
    try {
      const message: StreamingMessage = JSON.parse(data);
      
      this.connection.lastActivity = Date.now();
      this.connection.messageCount++;
      this.connection.bytesTransferred += data.length;

      // Notify all handlers
      for (const handler of this.messageHandlers.values()) {
        try {
          handler(message);
        } catch (error: unknown) {
          logger.error('Message handler error:', error);
        }
      }
      
    } catch (error: unknown) {
      logger.error('Failed to parse WebSocket message:', error);
    }
  }

  private startHeartbeat(): void {
    if (!this.config.heartbeatInterval) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const heartbeat: StreamingMessage = {
          id: `hb_${Date.now()}`,
          type: 'heartbeat',
          payload: { timestamp: Date.now() },
          timestamp: Date.now(),
          sequence: this.messageSequence++
        };
        
        try {
          this.ws.send(JSON.stringify(heartbeat));
        } catch (error: unknown) {
          logger.error('Heartbeat failed:', error);
        }
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxReconnectAttempts || 5)) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelay! * Math.pow(2, this.reconnectAttempts),
      30000
    );

    logger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        logger.error('Reconnection failed:', error);
      });
    }, delay);
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.send(message).catch(error => {
        logger.error('Failed to send queued message:', error);
      });
    }
  }
}