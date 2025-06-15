import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage, MessageHandler, AgentId } from './types';

interface Subscription {
  agentId: AgentId;
  handler: MessageHandler;
  filter?: (message: AgentMessage) => boolean;
}

export class MessageBus extends EventEmitter {
  private subscriptions: Map<string, Subscription> = new Map();
  private messageHistory: AgentMessage[] = [];
  private readonly maxHistorySize = 1000;
  private pendingResponses: Map<string, {
    resolve: (message: AgentMessage) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    super();
    this.setMaxListeners(50); // Support many agents
  }

  async publish(message: AgentMessage): Promise<void> {
    // Add to history
    this.addToHistory(message);

    // Handle responses to pending requests
    if (message.type === 'response' && message.correlationId) {
      const pending = this.pendingResponses.get(message.correlationId);
      if (pending) {
        clearTimeout(pending.timer);
        pending.resolve(message);
        this.pendingResponses.delete(message.correlationId);
        return;
      }
    }

    // Route to specific agent or broadcast
    if (message.to === 'broadcast') {
      await this.broadcast(message);
    } else {
      await this.routeToAgent(message.to, message);
    }

    // Emit for monitoring
    this.emit('message', message);
  }

  subscribe(agentId: AgentId, handler: MessageHandler, filter?: (message: AgentMessage) => boolean): string {
    const subscriptionId = uuidv4();
    this.subscriptions.set(subscriptionId, { agentId, handler, filter });
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  async requestResponse(message: AgentMessage, timeout: number = 30000): Promise<AgentMessage> {
    return new Promise((resolve, reject) => {
      const correlationId = message.correlationId || uuidv4();
      const requestMessage = { ...message, correlationId };

      const timer = setTimeout(() => {
        this.pendingResponses.delete(correlationId);
        reject(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      this.pendingResponses.set(correlationId, { resolve, reject, timer });

      this.publish(requestMessage).catch(error => {
        clearTimeout(timer);
        this.pendingResponses.delete(correlationId);
        reject(error);
      });
    });
  }

  private async broadcast(message: AgentMessage): Promise<void> {
    const handlers = Array.from(this.subscriptions.values())
      .filter(sub => !sub.filter || sub.filter(message));

    await Promise.all(
      handlers.map(sub => this.invokeHandler(sub.handler, message))
    );
  }

  private async routeToAgent(agentId: AgentId, message: AgentMessage): Promise<void> {
    const handlers = Array.from(this.subscriptions.values())
      .filter(sub => sub.agentId === agentId && (!sub.filter || sub.filter(message)));

    if (handlers.length === 0) {
      console.warn(`No handlers found for agent ${agentId}`);
      return;
    }

    await Promise.all(
      handlers.map(sub => this.invokeHandler(sub.handler, message))
    );
  }

  private async invokeHandler(handler: MessageHandler, message: AgentMessage): Promise<void> {
    try {
      await handler(message);
    } catch (error) {
      console.error('Message handler error:', error);
      this.emit('handler-error', { handler, message, error });
    }
  }

  private addToHistory(message: AgentMessage): void {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory.shift();
    }
  }

  getMessageHistory(filter?: {
    from?: AgentId;
    to?: AgentId | 'broadcast';
    type?: AgentMessage['type'];
    since?: number;
  }): AgentMessage[] {
    let messages = [...this.messageHistory];

    if (filter) {
      if (filter.from) {
        messages = messages.filter(m => m.from === filter.from);
      }
      if (filter.to) {
        messages = messages.filter(m => m.to === filter.to);
      }
      if (filter.type) {
        messages = messages.filter(m => m.type === filter.type);
      }
      if (filter.since !== undefined) {
        const since = filter.since;
        messages = messages.filter(m => m.timestamp >= since);
      }
    }

    return messages;
  }

  getMetrics() {
    const messagesByType = this.messageHistory.reduce((acc, msg) => {
      acc[msg.type] = (acc[msg.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const messagesByAgent = this.messageHistory.reduce((acc, msg) => {
      acc[msg.from] = (acc[msg.from] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMessages: this.messageHistory.length,
      activeSubscriptions: this.subscriptions.size,
      pendingResponses: this.pendingResponses.size,
      messagesByType,
      messagesByAgent,
    };
  }

  async shutdown(): Promise<void> {
    // Clear pending responses
    for (const [, pending] of this.pendingResponses) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Message bus shutting down'));
    }
    this.pendingResponses.clear();

    // Clear subscriptions
    this.subscriptions.clear();

    // Clear history
    this.messageHistory = [];

    // Remove all listeners
    this.removeAllListeners();
  }
}