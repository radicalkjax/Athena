/**
 * Console-based APM provider for development/debugging
 */

import { BaseAPMProvider } from './base';
import { Metric, Span } from './types';
import { logger } from '@/shared/logging/logger';

export class ConsoleAPMProvider extends BaseAPMProvider {
  private metricsBuffer: Map<string, { sum: number; count: number; last: number }> = new Map();

  async connect(): Promise<void> {
    logger.info('Console APM provider initialized');
  }

  protected async send(metrics: Metric[], spans: Span[]): Promise<void> {
    // Aggregate metrics
    metrics.forEach(metric => {
      const key = `${metric.name}:${JSON.stringify(metric.tags || {})}`;
      const existing = this.metricsBuffer.get(key) || { sum: 0, count: 0, last: 0 };
      
      if (metric.type === 'counter') {
        existing.sum += metric.value;
        existing.count += 1;
      } else {
        existing.sum = metric.value;
        existing.count = 1;
      }
      existing.last = metric.value;
      
      this.metricsBuffer.set(key, existing);
    });

    // Log aggregated metrics
    if (this.metricsBuffer.size > 0) {
      console.log('\n📊 APM Metrics:');
      this.metricsBuffer.forEach((data, key) => {
        const [name, tagsStr] = key.split(':');
        const avg = data.count > 0 ? (data.sum / data.count).toFixed(2) : '0';
        console.log(`  ${name}: ${data.last} (avg: ${avg}, total: ${data.sum})`);
      });
    }

    // Log spans
    if (spans.length > 0) {
      console.log('\n🔍 APM Traces:');
      spans.forEach(span => {
        const duration = (span.endTime || Date.now()) - span.startTime;
        const status = span.status === 'error' ? '❌' : '✅';
        console.log(`  ${status} ${span.operationName}: ${duration}ms`);
        if (span.error) {
          console.log(`     Error: ${span.error.message}`);
        }
      });
    }

    // Clear buffer periodically
    if (this.metricsBuffer.size > 100) {
      this.metricsBuffer.clear();
    }
  }
}