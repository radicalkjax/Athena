/**
 * Server-Sent Events (SSE) client for streaming
 */

import { SSEConfig, StreamingMessage, StreamingConnection } from './types';
import { logger } from '@/shared/logging/logger';

export class SSEClient {
  private eventSource: EventSource | null = null;
  private config: SSEConfig;
  private connection: StreamingConnection;
  private messageHandlers: Map<string, (message: StreamingMessage) => void> = new Map();
  private reconnectAttempts = 0;
  private messageSequence = 0;

  constructor(
    connectionId: string,
    provider: string,
    config: SSEConfig
  ) {
    this.config = {
      withCredentials: false,
      retryDelay: 3000,
      maxRetries: 5,
      ...config
    };

    this.connection = {
      id: connectionId,
      protocol: 'sse',
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
        // Check if EventSource is available
        if (typeof EventSource === 'undefined') {
          throw new Error('EventSource not available in this environment');
        }

        this.eventSource = new EventSource(this.config.url, {
          withCredentials: this.config.withCredentials
        });

        this.eventSource.onopen = () => {
          logger.info(`SSE connected to ${this.config.url}`);
          this.connection.status = 'connected';
          this.connection.lastActivity = Date.now();
          this.reconnectAttempts = 0;
          resolve();
        };

        this.eventSource.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.eventSource.onerror = (error) => {
          logger.error('SSE error:', error);
          this.connection.status = 'error';
          
          if (this.eventSource?.readyState === EventSource.CLOSED) {
            this.scheduleReconnect();
          }
        };

        // Listen for custom event types
        this.eventSource.addEventListener('analysis', (event: MessageEvent) => {
          this.handleMessage(event.data, 'data');
        });

        this.eventSource.addEventListener('error', (event: MessageEvent) => {
          this.handleMessage(event.data, 'error');
        });

        this.eventSource.addEventListener('complete', (event: MessageEvent) => {
          this.handleMessage(event.data, 'complete');
        });

        // Set connection timeout
        setTimeout(() => {
          if (this.connection.status === 'connecting') {
            this.disconnect();
            reject(new Error('SSE connection timeout'));
          }
        }, 10000);

      } catch (error: unknown) {
        this.connection.status = 'error';
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    
    this.connection.status = 'disconnected';
  }

  // SSE is receive-only, so send is not implemented
  async send(message: any): Promise<void> {
    throw new Error('SSE is a receive-only protocol. Use WebSocket for bidirectional communication.');
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
  private handleMessage(data: string, type: StreamingMessage['type'] = 'data'): void {
    try {
      let payload: any;
      
      try {
        payload = JSON.parse(data);
      } catch {
        // If not JSON, treat as plain text
        payload = data;
      }

      const message: StreamingMessage = {
        id: `sse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        payload,
        timestamp: Date.now(),
        sequence: this.messageSequence++
      };

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
      logger.error('Failed to process SSE message:', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= (this.config.maxRetries || 5)) {
      logger.error('Max SSE reconnection attempts reached');
      return;
    }

    const delay = Math.min(
      this.config.retryDelay! * Math.pow(2, this.reconnectAttempts),
      30000
    );

    logger.info(`Scheduling SSE reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        logger.error('SSE reconnection failed:', error);
      });
    }, delay);
  }
}