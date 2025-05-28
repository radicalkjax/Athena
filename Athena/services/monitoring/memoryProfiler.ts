/**
 * Memory profiling utility for performance optimization
 */

import { logger } from '@/shared/logging/logger';

export interface MemorySnapshot {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
  arrayBuffers: number;
}

export interface MemoryProfile {
  baseline: MemorySnapshot;
  current: MemorySnapshot;
  peak: MemorySnapshot;
  samples: MemorySnapshot[];
  leakDetected: boolean;
  growthRate: number;
}

export class MemoryProfiler {
  private static instance: MemoryProfiler;
  private baseline: MemorySnapshot | null = null;
  private peak: MemorySnapshot | null = null;
  private samples: MemorySnapshot[] = [];
  private samplingInterval: NodeJS.Timeout | null = null;
  private readonly MAX_SAMPLES = 100;
  private readonly LEAK_THRESHOLD = 0.1; // 10% growth per minute

  private constructor() {}

  static getInstance(): MemoryProfiler {
    if (!MemoryProfiler.instance) {
      MemoryProfiler.instance = new MemoryProfiler();
    }
    return MemoryProfiler.instance;
  }

  startProfiling(intervalMs = 5000): void {
    if (this.samplingInterval) {
      logger.warn('Memory profiling already in progress');
      return;
    }

    // Take baseline
    this.baseline = this.captureSnapshot();
    this.peak = { ...this.baseline };
    this.samples = [this.baseline];

    logger.info('Started memory profiling');

    this.samplingInterval = setInterval(() => {
      this.takeSample();
    }, intervalMs);
  }

  stopProfiling(): MemoryProfile | null {
    if (!this.samplingInterval || !this.baseline) {
      logger.warn('No memory profiling in progress');
      return null;
    }

    clearInterval(this.samplingInterval);
    this.samplingInterval = null;

    const current = this.captureSnapshot();
    const profile = this.analyzeProfile(current);
    
    logger.info('Stopped memory profiling');
    return profile;
  }

  private captureSnapshot(): MemorySnapshot {
    // Check if we're in Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        timestamp: Date.now(),
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        rss: usage.rss,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers || 0,
      };
    }

    // Fallback for browser environment
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const memory = (performance as any).memory;
      return {
        timestamp: Date.now(),
        heapUsed: memory.usedJSHeapSize || 0,
        heapTotal: memory.totalJSHeapSize || 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0,
      };
    }

    // No memory API available
    return {
      timestamp: Date.now(),
      heapUsed: 0,
      heapTotal: 0,
      rss: 0,
      external: 0,
      arrayBuffers: 0,
    };
  }

  private takeSample(): void {
    const snapshot = this.captureSnapshot();
    
    // Update peak if necessary
    if (this.peak && snapshot.heapUsed > this.peak.heapUsed) {
      this.peak = snapshot;
    }

    // Add to samples
    this.samples.push(snapshot);
    
    // Limit sample size
    if (this.samples.length > this.MAX_SAMPLES) {
      this.samples.shift();
    }
  }

  private analyzeProfile(current: MemorySnapshot): MemoryProfile {
    if (!this.baseline || !this.peak) {
      throw new Error('Invalid profile state');
    }

    // Calculate growth rate (MB per minute)
    const timeDiffMinutes = (current.timestamp - this.baseline.timestamp) / 60000;
    const memoryDiffMB = (current.heapUsed - this.baseline.heapUsed) / (1024 * 1024);
    const growthRate = timeDiffMinutes > 0 ? memoryDiffMB / timeDiffMinutes : 0;

    // Detect potential memory leak
    const leakDetected = growthRate > this.LEAK_THRESHOLD;

    return {
      baseline: this.baseline,
      current,
      peak: this.peak,
      samples: [...this.samples],
      leakDetected,
      growthRate,
    };
  }

  getCurrentMemory(): MemorySnapshot {
    return this.captureSnapshot();
  }

  getMemoryStats(): {
    current: MemorySnapshot;
    baseline?: MemorySnapshot;
    peak?: MemorySnapshot;
    isProfileing: boolean;
  } {
    return {
      current: this.captureSnapshot(),
      baseline: this.baseline || undefined,
      peak: this.peak || undefined,
      isProfileing: this.samplingInterval !== null,
    };
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  logMemoryUsage(): void {
    const snapshot = this.captureSnapshot();
    logger.info('Memory Usage:', {
      heapUsed: this.formatBytes(snapshot.heapUsed),
      heapTotal: this.formatBytes(snapshot.heapTotal),
      rss: this.formatBytes(snapshot.rss),
      external: this.formatBytes(snapshot.external),
    });
  }

  // Memory optimization suggestions
  getSuggestions(profile: MemoryProfile): string[] {
    const suggestions: string[] = [];

    if (profile.leakDetected) {
      suggestions.push('Potential memory leak detected. Check for:');
      suggestions.push('- Uncleared timers or intervals');
      suggestions.push('- Event listeners not being removed');
      suggestions.push('- Large arrays or objects growing unbounded');
      suggestions.push('- Circular references preventing garbage collection');
    }

    const heapUsageMB = profile.current.heapUsed / (1024 * 1024);
    if (heapUsageMB > 200) {
      suggestions.push('High memory usage detected. Consider:');
      suggestions.push('- Implementing pagination for large data sets');
      suggestions.push('- Using WeakMap/WeakSet for caches');
      suggestions.push('- Releasing unused resources explicitly');
      suggestions.push('- Optimizing data structures');
    }

    if (profile.peak.heapUsed > profile.baseline.heapUsed * 2) {
      suggestions.push('Memory usage doubled from baseline. Review:');
      suggestions.push('- Cache eviction policies');
      suggestions.push('- Connection pool sizes');
      suggestions.push('- Batch processing limits');
    }

    return suggestions;
  }
}

// Export singleton instance
export const memoryProfiler = MemoryProfiler.getInstance();