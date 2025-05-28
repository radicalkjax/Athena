/**
 * APM Manager - Centralized application performance monitoring
 */

import { APMProvider, APMConfig, Span, MetricTags } from './types';
import { StatsDProvider } from './statsd';
import { ConsoleAPMProvider } from './console';
import { env } from '@/shared/config/environment';
import { logger } from '@/shared/logging/logger';
import { memoryProfiler } from '../monitoring/memoryProfiler';
import { getCacheManager } from '../cache/redisFactory';
import { featureFlags } from '../config/featureFlags';

export class APMManager {
  private static instance: APMManager;
  private provider: APMProvider | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private initialized = false;

  private constructor() {}

  static getInstance(): APMManager {
    if (!APMManager.instance) {
      APMManager.instance = new APMManager();
    }
    return APMManager.instance;
  }

  async initialize(customConfig?: Partial<APMConfig>): Promise<void> {
    if (this.initialized) {
      logger.warn('APM already initialized');
      return;
    }

    const config: APMConfig = {
      serviceName: 'athena',
      environment: env.environment,
      version: env.appVersion,
      sampleRate: env.isDev ? 1.0 : 0.1,
      flushInterval: 10000,
      maxBatchSize: 100,
      enabled: featureFlags.isEnabled('enableAPM'),
      ...customConfig,
    };

    // Choose provider based on environment
    if (env.isDev || !config.endpoint) {
      this.provider = new ConsoleAPMProvider();
    } else {
      this.provider = new StatsDProvider();
    }

    await this.provider.initialize(config);
    this.startMetricsCollection();
    this.initialized = true;

    logger.info('APM Manager initialized');
  }

  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Initial collection
    this.collectSystemMetrics();
  }

  private collectSystemMetrics(): void {
    if (!this.provider) return;

    // Memory metrics
    const memStats = memoryProfiler.getMemoryStats();
    if (memStats.current) {
      this.provider.gauge('memory.heap.used', memStats.current.heapUsed);
      this.provider.gauge('memory.heap.total', memStats.current.heapTotal);
      this.provider.gauge('memory.rss', memStats.current.rss);
    }

    // Cache metrics
    const cacheManager = getCacheManager();
    const cacheStats = cacheManager.getStats();
    this.provider.gauge('cache.size', cacheStats.currentSize);
    this.provider.gauge('cache.entries', cacheStats.entryCount);
    this.provider.gauge('cache.hit_rate', cacheStats.hitRate);
    this.provider.counter('cache.hits', cacheStats.hits);
    this.provider.counter('cache.misses', cacheStats.misses);
    this.provider.counter('cache.evictions', cacheStats.evictions);
  }

  // Instrumentation methods
  startSpan(operationName: string, parentSpan?: Span): Span {
    if (!this.provider) {
      return { traceId: '', spanId: '', operationName, startTime: Date.now(), tags: {} };
    }
    return this.provider.startSpan(operationName, parentSpan);
  }

  finishSpan(span: Span): void {
    if (!this.provider) return;
    this.provider.finishSpan(span);
  }

  // Convenience method for timing operations
  async withSpan<T>(
    operationName: string,
    operation: () => Promise<T>,
    tags?: MetricTags
  ): Promise<T> {
    const span = this.startSpan(operationName);
    span.tags = { ...span.tags, ...tags };

    try {
      const result = await operation();
      span.status = 'ok';
      return result;
    } catch (error) {
      span.status = 'error';
      span.error = error as Error;
      throw error;
    } finally {
      this.finishSpan(span);
    }
  }

  // Metric shortcuts
  recordAnalysis(provider: string, type: string, duration: number, success: boolean): void {
    if (!this.provider) return;

    const tags: MetricTags = { provider, type };
    
    this.provider.timer('ai.analysis.duration', duration, tags);
    this.provider.counter('ai.analysis.total', 1, tags);
    
    if (!success) {
      this.provider.counter('ai.analysis.error', 1, tags);
    }
  }

  recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'evict', duration?: number): void {
    if (!this.provider) return;

    this.provider.counter(`cache.${operation}`, 1);
    
    if (duration !== undefined) {
      this.provider.timer(`cache.operation.duration`, duration, { operation });
    }
  }

  recordAPICall(endpoint: string, method: string, statusCode: number, duration: number): void {
    if (!this.provider) return;

    const tags: MetricTags = { endpoint, method, status_code: statusCode };
    
    this.provider.timer('api.request.duration', duration, tags);
    this.provider.counter('api.request.total', 1, tags);
    
    if (statusCode >= 400) {
      this.provider.counter('api.request.error', 1, tags);
    }
  }

  recordContainerOperation(operation: string, success: boolean, duration?: number): void {
    if (!this.provider) return;

    const tags: MetricTags = { operation };
    
    this.provider.counter('container.operation.total', 1, tags);
    
    if (!success) {
      this.provider.counter('container.operation.error', 1, tags);
    }
    
    if (duration !== undefined) {
      this.provider.timer('container.operation.duration', duration, tags);
    }
  }

  // Circuit breaker metrics
  recordCircuitBreakerEvent(provider: string, event: 'open' | 'close' | 'half_open'): void {
    if (!this.provider) return;

    this.provider.counter('circuit_breaker.event', 1, { provider, event });
    this.provider.gauge(`circuit_breaker.state.${provider}`, event === 'open' ? 1 : 0);
  }

  // Business metrics
  recordFileAnalyzed(fileType: string, size: number): void {
    if (!this.provider) return;

    this.provider.counter('files.analyzed', 1, { type: fileType });
    this.provider.histogram('files.size', size, { type: fileType });
  }

  recordVulnerability(severity: string, type: string): void {
    if (!this.provider) return;

    this.provider.counter('vulnerabilities.found', 1, { severity, type });
  }

  recordMalwareDetected(type: string, confidence: number): void {
    if (!this.provider) return;

    this.provider.counter('malware.detected', 1, { type });
    this.provider.gauge('malware.confidence', confidence, { type });
  }

  // Manual metric recording
  counter(name: string, value = 1, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.counter(name, value, tags);
  }

  gauge(name: string, value: number, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.gauge(name, value, tags);
  }

  histogram(name: string, value: number, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.histogram(name, value, tags);
  }

  timer(name: string, value: number, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.timer(name, value, tags);
  }

  // Lifecycle
  async flush(): Promise<void> {
    if (!this.provider) return;
    await this.provider.flush();
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    if (this.provider) {
      await this.provider.shutdown();
      this.provider = null;
    }

    this.initialized = false;
    logger.info('APM Manager shutdown complete');
  }
}

// Export singleton instance
export const apmManager = APMManager.getInstance();