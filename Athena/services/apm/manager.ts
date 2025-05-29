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

    // Skip initialization if APM is disabled
    if (!config.enabled) {
      this.provider = null;
      this.initialized = true;
      logger.info('APM Manager initialized (disabled)');
      return;
    }

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
      this.provider.metric('memory.heap.used', memStats.current.heapUsed, 'gauge');
      this.provider.metric('memory.heap.total', memStats.current.heapTotal, 'gauge');
      this.provider.metric('memory.rss', memStats.current.rss, 'gauge');
    }

    // Cache metrics
    const cacheManager = getCacheManager();
    const cacheStats = cacheManager.getStats();
    this.provider.metric('cache.size', cacheStats.currentSize, 'gauge');
    this.provider.metric('cache.entries', cacheStats.entryCount, 'gauge');
    this.provider.metric('cache.hit_rate', cacheStats.hitRate, 'gauge');
    this.provider.metric('cache.hits', cacheStats.hits, 'counter');
    this.provider.metric('cache.misses', cacheStats.misses, 'counter');
    this.provider.metric('cache.evictions', cacheStats.evictions, 'counter');
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

  // Convenience metric methods
  private counter(name: string, value: number, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.metric(name, value, 'counter', tags);
  }

  private gauge(name: string, value: number, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.metric(name, value, 'gauge', tags);
  }

  private histogram(name: string, value: number, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.metric(name, value, 'histogram', tags);
  }

  private timer(name: string, value: number, tags?: MetricTags): void {
    if (!this.provider) return;
    this.provider.metric(name, value, 'timer', tags);
  }

  // Metric shortcuts
  recordAnalysis(provider: string, type: string, duration: number, success: boolean): void {
    if (!this.provider) return;

    const tags: MetricTags = { provider, type };
    
    this.timer('ai.analysis.duration', duration, tags);
    this.counter('ai.analysis.total', 1, tags);
    
    if (!success) {
      this.counter('ai.analysis.error', 1, tags);
    }
  }

  recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'evict', duration?: number): void {
    if (!this.provider) return;

    this.counter(`cache.${operation}`, 1);
    
    if (duration !== undefined) {
      this.timer(`cache.operation.duration`, duration, { operation });
    }
  }

  recordAPICall(endpoint: string, method: string, statusCode: number, duration: number): void {
    if (!this.provider) return;

    const tags: MetricTags = { endpoint, method, status_code: statusCode };
    
    this.timer('api.request.duration', duration, tags);
    this.counter('api.request.total', 1, tags);
    
    if (statusCode >= 400) {
      this.counter('api.request.error', 1, tags);
    }
  }

  recordContainerOperation(operation: string, success: boolean, duration?: number): void {
    if (!this.provider) return;

    const tags: MetricTags = { operation };
    
    this.counter('container.operation.total', 1, tags);
    
    if (!success) {
      this.counter('container.operation.error', 1, tags);
    }
    
    if (duration !== undefined) {
      this.timer('container.operation.duration', duration, tags);
    }
  }

  // Circuit breaker metrics
  recordCircuitBreakerEvent(provider: string, event: 'open' | 'close' | 'half_open'): void {
    if (!this.provider) return;

    this.counter('circuit_breaker.event', 1, { provider, event });
    this.gauge(`circuit_breaker.state.${provider}`, event === 'open' ? 1 : 0);
  }

  // Business metrics
  recordFileAnalyzed(fileType: string, size: number): void {
    if (!this.provider) return;

    this.counter('files.analyzed', 1, { type: fileType });
    this.histogram('files.size', size, { type: fileType });
  }

  recordVulnerability(severity: string, type: string): void {
    if (!this.provider) return;

    this.counter('vulnerabilities.found', 1, { severity, type });
  }

  recordMalwareDetected(type: string, confidence: number): void {
    if (!this.provider) return;

    this.counter('malware.detected', 1, { type });
    this.gauge('malware.confidence', confidence, { type });
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