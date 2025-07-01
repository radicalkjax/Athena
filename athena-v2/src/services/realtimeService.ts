import { createSignal, createEffect, onCleanup } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface RealtimeConfig {
  updateInterval: number;
  enabled: boolean;
  bufferSize: number;
}

export interface RealtimeSubscription {
  id: string;
  unsubscribe: () => void;
}

interface StreamData {
  type: 'cpu' | 'memory' | 'network' | 'process' | 'analysis';
  data: any;
  timestamp: number;
}

class RealtimeService {
  private subscriptions = new Map<string, Set<(data: any) => void>>();
  private updateIntervals = new Map<string, number>();
  private eventListeners = new Map<string, UnlistenFn>();
  private dataBuffers = new Map<string, any[]>();
  private config: RealtimeConfig = {
    updateInterval: 1000,
    enabled: true,
    bufferSize: 100
  };

  constructor() {
    this.setupTauriEventListeners();
  }

  private async setupTauriEventListeners() {
    // Listen for streaming data from backend
    const streamTypes = ['cpu-stream', 'memory-stream', 'network-stream', 'process-stream', 'analysis-stream'];
    
    for (const streamType of streamTypes) {
      const unlisten = await listen<StreamData>(streamType, (event) => {
        this.handleStreamData(event.payload);
      });
      this.eventListeners.set(streamType, unlisten);
    }

    // Listen for real-time analysis updates
    const analysisUnlisten = await listen('analysis-progress', (event) => {
      this.publishUpdate('analysis-progress', event.payload);
    });
    this.eventListeners.set('analysis-progress', analysisUnlisten);
  }

  private handleStreamData(data: StreamData) {
    const { type, data: payload, timestamp } = data;
    
    // Buffer management
    const buffer = this.dataBuffers.get(type) || [];
    buffer.push({ ...payload, timestamp });
    
    // Keep buffer size under control
    if (buffer.length > this.config.bufferSize) {
      buffer.shift();
    }
    
    this.dataBuffers.set(type, buffer);
    this.publishUpdate(type, payload);
  }

  public subscribe(channel: string, callback: (data: any) => void): RealtimeSubscription {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      this.startPolling(channel);
    }

    const callbacks = this.subscriptions.get(channel)!;
    callbacks.add(callback);

    const id = `${channel}-${Date.now()}-${Math.random()}`;

    return {
      id,
      unsubscribe: () => {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.stopPolling(channel);
          this.subscriptions.delete(channel);
        }
      }
    };
  }

  private startPolling(channel: string) {
    if (!this.config.enabled) return;

    const pollInterval = this.getIntervalForChannel(channel);
    
    const intervalId = window.setInterval(async () => {
      try {
        const data = await this.fetchDataForChannel(channel);
        this.publishUpdate(channel, data);
      } catch (error) {
        console.error(`Error polling ${channel}:`, error);
      }
    }, pollInterval);

    this.updateIntervals.set(channel, intervalId);
  }

  private stopPolling(channel: string) {
    const intervalId = this.updateIntervals.get(channel);
    if (intervalId) {
      clearInterval(intervalId);
      this.updateIntervals.delete(channel);
    }
  }

  private async fetchDataForChannel(channel: string): Promise<any> {
    switch (channel) {
      case 'cpu':
        return await invoke('get_cpu_info');
      case 'memory':
        return await invoke('get_memory_info');
      case 'network':
        return await invoke('get_network_info');
      case 'processes':
        return await invoke('get_processes');
      case 'disk':
        return await invoke('get_disk_info');
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  private getIntervalForChannel(channel: string): number {
    const channelIntervals: Record<string, number> = {
      cpu: 1000,
      memory: 1000,
      network: 100, // More frequent for network data
      processes: 2000,
      disk: 5000
    };

    return channelIntervals[channel] || this.config.updateInterval;
  }

  private publishUpdate(channel: string, data: any) {
    const callbacks = this.subscriptions.get(channel);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  public setConfig(config: Partial<RealtimeConfig>) {
    this.config = { ...this.config, ...config };
    
    // Restart polling with new intervals if needed
    if ('updateInterval' in config || 'enabled' in config) {
      this.updateIntervals.forEach((_, channel) => {
        this.stopPolling(channel);
        if (this.config.enabled && this.subscriptions.has(channel)) {
          this.startPolling(channel);
        }
      });
    }
  }

  public getBufferedData(type: string): any[] {
    return this.dataBuffers.get(type) || [];
  }

  public pauseUpdates() {
    this.setConfig({ enabled: false });
  }

  public resumeUpdates() {
    this.setConfig({ enabled: true });
  }

  public cleanup() {
    // Stop all polling
    this.updateIntervals.forEach((intervalId) => {
      clearInterval(intervalId);
    });
    this.updateIntervals.clear();

    // Remove all event listeners
    this.eventListeners.forEach((unlisten) => {
      unlisten();
    });
    this.eventListeners.clear();

    // Clear subscriptions
    this.subscriptions.clear();
    this.dataBuffers.clear();
  }
}

// Create singleton instance
export const realtimeService = new RealtimeService();

// Helper hook for SolidJS components
export function useRealtimeData<T>(channel: string, initialValue: T) {
  const [data, setData] = createSignal<T>(initialValue);
  
  createEffect(() => {
    const subscription = realtimeService.subscribe(channel, (newData) => {
      setData(newData);
    });

    onCleanup(() => {
      subscription.unsubscribe();
    });
  });

  return data;
}

// Helper for animated transitions
export function useAnimatedValue(value: () => number, duration: number = 300) {
  const [animatedValue, setAnimatedValue] = createSignal(value());
  let animationFrame: number;
  let startTime: number;
  let startValue: number;
  let endValue: number;

  createEffect(() => {
    const newValue = value();
    startValue = animatedValue();
    endValue = newValue;
    startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out-cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const current = startValue + (endValue - startValue) * eased;
      setAnimatedValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    onCleanup(() => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    });
  });

  return animatedValue;
}

// Export types
export type { StreamData };