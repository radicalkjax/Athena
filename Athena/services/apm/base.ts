/**
 * Base APM implementation
 */

import { APMProvider, APMConfig, Metric, MetricTags, Span } from './types';
import { logger } from '@/shared/logging/logger';
import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAPMProvider implements APMProvider {
  protected config: APMConfig;
  protected metrics: Metric[] = [];
  protected spans: Map<string, Span> = new Map();
  protected flushTimer: NodeJS.Timeout | null = null;
  protected initialized = false;

  constructor() {
    this.config = {
      serviceName: 'athena',
      environment: 'development',
      version: '1.0.0',
      sampleRate: 1.0,
      flushInterval: 10000, // 10 seconds
      maxBatchSize: 100,
      enabled: false,
    };
  }

  async initialize(config: APMConfig): Promise<void> {
    this.config = { ...this.config, ...config };
    
    if (!this.config.enabled) {
      logger.info('APM disabled');
      return;
    }

    await this.connect();
    this.startFlushTimer();
    this.initialized = true;
    
    logger.info(`APM initialized: ${this.constructor.name}`);
  }

  protected abstract connect(): Promise<void>;
  protected abstract send(metrics: Metric[], spans: Span[]): Promise<void>;

  metric(name: string, value: number, type: Metric['type'], tags?: MetricTags): void {
    if (!this.initialized || !this.config.enabled) return;

    const metric: Metric = {
      name: `${this.config.serviceName}.${name}`,
      value,
      type,
      tags: {
        environment: this.config.environment,
        version: this.config.version,
        ...tags,
      },
      timestamp: Date.now(),
    };

    this.metrics.push(metric);

    // Auto-flush if batch size exceeded
    if (this.metrics.length >= this.config.maxBatchSize) {
      this.flush().catch(err => logger.error('Auto-flush failed:', err));
    }
  }

  startSpan(operationName: string, parentSpan?: Span): Span {
    if (!this.initialized || !this.config.enabled) {
      return this.createNoopSpan(operationName);
    }

    // Apply sampling
    if (Math.random() > this.config.sampleRate) {
      return this.createNoopSpan(operationName);
    }

    const span: Span = {
      traceId: parentSpan?.traceId || uuidv4(),
      spanId: uuidv4(),
      parentSpanId: parentSpan?.spanId,
      operationName,
      startTime: Date.now(),
      tags: {
        service: this.config.serviceName,
        environment: this.config.environment,
        version: this.config.version,
      },
    };

    this.spans.set(span.spanId, span);
    return span;
  }

  finishSpan(span: Span): void {
    if (!this.initialized || !this.config.enabled || !span.spanId) return;

    const storedSpan = this.spans.get(span.spanId);
    if (!storedSpan) return;

    storedSpan.endTime = Date.now();
    storedSpan.status = span.status || 'ok';
    storedSpan.error = span.error;
    storedSpan.tags = { ...storedSpan.tags, ...span.tags };
    storedSpan.logs = span.logs;

    // Calculate duration metric
    const duration = storedSpan.endTime - storedSpan.startTime;
    this.metric(
      `${storedSpan.operationName}.duration`,
      duration,
      'timer',
      storedSpan.tags
    );

    // Track errors
    if (storedSpan.status === 'error') {
      this.metric(
        `${storedSpan.operationName}.error`,
        1,
        'counter',
        storedSpan.tags
      );
    }
  }

  async flush(): Promise<void> {
    if (!this.initialized || !this.config.enabled) return;

    const metricsToSend = [...this.metrics];
    const spansToSend = Array.from(this.spans.values()).filter(span => span.endTime);
    
    if (metricsToSend.length === 0 && spansToSend.length === 0) {
      return;
    }

    // Clear buffers
    this.metrics = [];
    spansToSend.forEach(span => this.spans.delete(span.spanId));

    try {
      await this.send(metricsToSend, spansToSend);
      logger.debug(`APM flush: ${metricsToSend.length} metrics, ${spansToSend.length} spans`);
    } catch (error: unknown) {
      logger.error('APM flush error:', error);
      // Re-add metrics on failure (with limit to prevent memory issues)
      if (this.metrics.length + metricsToSend.length < this.config.maxBatchSize * 2) {
        this.metrics.unshift(...metricsToSend);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) return;

    this.stopFlushTimer();
    await this.flush();
    this.initialized = false;
    
    logger.info('APM shutdown complete');
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => logger.error('Scheduled flush failed:', err));
    }, this.config.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private createNoopSpan(operationName: string): Span {
    return {
      traceId: '',
      spanId: '',
      operationName,
      startTime: Date.now(),
      tags: {},
    };
  }

  // Helper methods for common metrics
  counter(name: string, value = 1, tags?: MetricTags): void {
    this.metric(name, value, 'counter', tags);
  }

  gauge(name: string, value: number, tags?: MetricTags): void {
    this.metric(name, value, 'gauge', tags);
  }

  histogram(name: string, value: number, tags?: MetricTags): void {
    this.metric(name, value, 'histogram', tags);
  }

  timer(name: string, value: number, tags?: MetricTags): void {
    this.metric(name, value, 'timer', tags);
  }
}