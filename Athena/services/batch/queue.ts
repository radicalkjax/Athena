/**
 * Priority queue implementation for batch requests
 */

import { BatchQueue, BatchRequest } from './types';

export class PriorityBatchQueue implements BatchQueue {
  private queues: Map<number, BatchRequest[]>;
  private priorities: number[];
  
  constructor(priorityLevels = 3) {
    this.queues = new Map();
    this.priorities = [];
    
    // Initialize priority queues
    for (let i = 0; i < priorityLevels; i++) {
      this.queues.set(i, []);
      this.priorities.push(i);
    }
  }
  
  add(request: BatchRequest): void {
    const priority = Math.min(request.priority, this.priorities.length - 1);
    const queue = this.queues.get(priority);
    
    if (queue) {
      queue.push(request);
    }
  }
  
  remove(requestId: string): boolean {
    for (const [priority, queue] of this.queues) {
      const index = queue.findIndex(r => r.id === requestId);
      if (index !== -1) {
        queue.splice(index, 1);
        return true;
      }
    }
    return false;
  }
  
  peek(): BatchRequest | undefined {
    // Get highest priority request without removing
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue[0];
      }
    }
    return undefined;
  }
  
  pop(): BatchRequest | undefined {
    // Get and remove highest priority request
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue.shift();
      }
    }
    return undefined;
  }
  
  size(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }
  
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0;
    }
  }
  
  getAll(): BatchRequest[] {
    const all: BatchRequest[] = [];
    for (const priority of this.priorities) {
      const queue = this.queues.get(priority);
      if (queue) {
        all.push(...queue);
      }
    }
    return all;
  }
  
  getByPriority(priority: number): BatchRequest[] {
    const queue = this.queues.get(priority);
    return queue ? [...queue] : [];
  }
  
  getQueueSizes(): Record<number, number> {
    const sizes: Record<number, number> = {};
    for (const [priority, queue] of this.queues) {
      sizes[priority] = queue.length;
    }
    return sizes;
  }
}