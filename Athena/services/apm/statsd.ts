/**
 * StatsD-based APM provider (DataDog, New Relic compatible)
 */

import { BaseAPMProvider } from './base';
import { Metric, Span, APMConfig } from './types';
import { logger } from '@/shared/logging/logger';
import * as dgram from 'dgram';

export class StatsDProvider extends BaseAPMProvider {
  private client: dgram.Socket | null = null;
  private host: string = 'localhost';
  private port: number = 8125;

  async connect(): Promise<void> {
    // Parse endpoint if provided
    if (this.config.endpoint) {
      const [host, port] = this.config.endpoint.split(':');
      this.host = host;
      this.port = parseInt(port, 10) || 8125;
    }

    // In browser environment, we'll use HTTP instead
    if (typeof dgram === 'undefined') {
      logger.info('StatsD running in browser mode - will use HTTP transport');
      return;
    }

    this.client = dgram.createSocket('udp4');
    
    this.client.on('error', (err) => {
      logger.error('StatsD socket error:', err);
      this.client?.close();
      this.client = null;
    });
  }

  protected async send(metrics: Metric[], spans: Span[]): Promise<void> {
    // In browser, send via HTTP
    if (!this.client) {
      return this.sendViaHttp(metrics, spans);
    }

    // Convert metrics to StatsD format
    const statsdLines = metrics.map(metric => this.formatMetric(metric));
    
    // Send spans as metrics (StatsD doesn't have native span support)
    spans.forEach(span => {
      const duration = (span.endTime || Date.now()) - span.startTime;
      statsdLines.push(this.formatSpanMetric(span, duration));
    });

    // Send all metrics
    const message = statsdLines.join('\n');
    if (message) {
      this.client.send(message, this.port, this.host, (err) => {
        if (err) {
          logger.error('StatsD send error:', err);
        }
      });
    }
  }

  private formatMetric(metric: Metric): string {
    const { name, value, type, tags } = metric;
    
    // Format tags for DataDog/DogStatsD
    const tagString = tags 
      ? Object.entries(tags)
          .map(([k, v]) => `${k}:${v}`)
          .join(',')
      : '';

    // Map metric types to StatsD types
    let typeSymbol: string;
    switch (type) {
      case 'counter':
        typeSymbol = 'c';
        break;
      case 'gauge':
        typeSymbol = 'g';
        break;
      case 'histogram':
        typeSymbol = 'h';
        break;
      case 'timer':
        typeSymbol = 'ms';
        break;
      default:
        typeSymbol = 'g';
    }

    // Format: metric.name:value|type|#tag1:value1,tag2:value2
    return tagString 
      ? `${name}:${value}|${typeSymbol}|#${tagString}`
      : `${name}:${value}|${typeSymbol}`;
  }

  private formatSpanMetric(span: Span, duration: number): string {
    const tags = {
      ...span.tags,
      trace_id: span.traceId,
      span_id: span.spanId,
      status: span.status || 'ok',
    };

    if (span.parentSpanId) {
      tags.parent_span_id = span.parentSpanId;
    }

    return this.formatMetric({
      name: `trace.${span.operationName}`,
      value: duration,
      type: 'timer',
      tags,
      timestamp: span.startTime,
    });
  }

  private async sendViaHttp(metrics: Metric[], spans: Span[]): Promise<void> {
    if (!this.config.endpoint) return;

    try {
      const payload = {
        series: metrics.map(metric => ({
          metric: metric.name,
          points: [[Math.floor(metric.timestamp / 1000), metric.value]],
          type: metric.type,
          tags: metric.tags ? Object.entries(metric.tags).map(([k, v]) => `${k}:${v}`) : [],
        })),
        spans: spans.map(span => ({
          trace_id: span.traceId,
          span_id: span.spanId,
          parent_id: span.parentSpanId,
          name: span.operationName,
          service: this.config.serviceName,
          start: span.startTime,
          duration: (span.endTime || Date.now()) - span.startTime,
          error: span.status === 'error' ? 1 : 0,
          meta: span.tags,
        })),
      };

      const response = await fetch(`${this.config.endpoint}/api/v1/series`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.config.apiKey || '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      logger.error('StatsD HTTP send error:', error);
    }
  }

  async shutdown(): Promise<void> {
    await super.shutdown();
    
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }
}