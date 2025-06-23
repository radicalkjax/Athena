interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

interface PerformanceSnapshot {
  id: string;
  timestamp: number;
  metrics: PerformanceMetric[];
  memoryUsage: {
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  timing: {
    navigationStart?: number;
    domContentLoaded?: number;
    loadComplete?: number;
  };
}

class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private snapshots: PerformanceSnapshot[] = [];
  private observers: Set<(snapshot: PerformanceSnapshot) => void> = new Set();
  private isMonitoring = false;
  private monitoringInterval?: number;

  // Start monitoring performance
  startMonitoring(intervalMs: number = 1000): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.monitoringInterval = window.setInterval(() => {
      const snapshot = this.captureSnapshot();
      this.notifyObservers(snapshot);
    }, intervalMs);
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      window.clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
    this.isMonitoring = false;
  }

  // Capture current performance snapshot
  captureSnapshot(): PerformanceSnapshot {
    const metrics: PerformanceMetric[] = [];
    const timestamp = Date.now();

    // Capture FPS
    const fps = this.calculateFPS();
    metrics.push({
      name: 'FPS',
      value: fps,
      unit: 'fps',
      timestamp,
    });

    // Capture memory usage (if available)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      metrics.push({
        name: 'JS Heap Size',
        value: memory.usedJSHeapSize,
        unit: 'bytes',
        timestamp,
      });

      metrics.push({
        name: 'JS Heap Limit',
        value: memory.jsHeapSizeLimit,
        unit: 'bytes',
        timestamp,
      });
    }

    // Capture navigation timing
    const navigationTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    const snapshot: PerformanceSnapshot = {
      id: `snapshot_${timestamp}`,
      timestamp,
      metrics,
      memoryUsage: this.getMemoryUsage(),
      timing: navigationTiming ? {
        navigationStart: navigationTiming.startTime,
        domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
        loadComplete: navigationTiming.loadEventEnd - navigationTiming.loadEventStart,
      } : {},
    };

    this.snapshots.push(snapshot);
    // Keep only last 100 snapshots
    if (this.snapshots.length > 100) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  // Calculate current FPS
  private frameCount = 0;
  private lastFrameTime = performance.now();
  private fps = 60;

  private calculateFPS(): number {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    
    if (deltaTime >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / deltaTime);
      this.frameCount = 0;
      this.lastFrameTime = currentTime;
    }
    
    this.frameCount++;
    requestAnimationFrame(() => this.calculateFPS());
    
    return this.fps;
  }

  // Get memory usage
  private getMemoryUsage(): PerformanceSnapshot['memoryUsage'] {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        heapTotal: memory.totalJSHeapSize || 0,
        heapUsed: memory.usedJSHeapSize || 0,
        external: memory.jsHeapSizeLimit || 0,
      };
    }

    return {
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
    };
  }

  // Add a custom metric
  recordMetric(name: string, value: number, unit: string = 'ms'): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metricHistory = this.metrics.get(name)!;
    metricHistory.push(metric);

    // Keep only last 50 entries per metric
    if (metricHistory.length > 50) {
      metricHistory.shift();
    }
  }

  // Measure function execution time
  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration, 'ms');
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration, 'ms');
      throw error;
    }
  }

  // Measure sync function execution time
  measure<T>(name: string, fn: () => T): T {
    const start = performance.now();
    try {
      const result = fn();
      const duration = performance.now() - start;
      this.recordMetric(name, duration, 'ms');
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric(`${name}_error`, duration, 'ms');
      throw error;
    }
  }

  // Mark a performance point
  mark(name: string): void {
    performance.mark(name);
  }

  // Measure between two marks
  measureBetween(name: string, startMark: string, endMark: string): void {
    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, 'measure')[0];
      if (measure) {
        this.recordMetric(name, measure.duration, 'ms');
      }
    } catch (error) {
      console.error('Failed to measure performance:', error);
    }
  }

  // Subscribe to performance updates
  subscribe(callback: (snapshot: PerformanceSnapshot) => void): () => void {
    this.observers.add(callback);
    return () => this.observers.delete(callback);
  }

  // Notify observers
  private notifyObservers(snapshot: PerformanceSnapshot): void {
    this.observers.forEach(callback => callback(snapshot));
  }

  // Get all snapshots
  getSnapshots(): PerformanceSnapshot[] {
    return [...this.snapshots];
  }

  // Get metrics by name
  getMetrics(name: string): PerformanceMetric[] {
    return [...(this.metrics.get(name) || [])];
  }

  // Get average metric value
  getAverageMetric(name: string): number {
    const metrics = this.getMetrics(name);
    if (metrics.length === 0) return 0;
    
    const sum = metrics.reduce((acc, m) => acc + m.value, 0);
    return sum / metrics.length;
  }

  // Clear all data
  clear(): void {
    this.metrics.clear();
    this.snapshots = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Auto-start FPS monitoring
if (typeof window !== 'undefined') {
  requestAnimationFrame(() => performanceMonitor['calculateFPS']());
}