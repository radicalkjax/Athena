/**
 * APM (Application Performance Monitoring) types
 */

export interface MetricTags {
  [key: string]: string | number | boolean;
}

export interface Metric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  tags?: MetricTags;
  timestamp: number;
}

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operationName: string;
  startTime: number;
  endTime?: number;
  tags: MetricTags;
  logs?: SpanLog[];
  status?: 'ok' | 'error' | 'cancelled';
  error?: Error;
}

export interface SpanLog {
  timestamp: number;
  fields: Record<string, any>;
}

export interface APMConfig {
  serviceName: string;
  environment: string;
  version: string;
  sampleRate: number;
  flushInterval: number;
  maxBatchSize: number;
  endpoint?: string;
  apiKey?: string;
  enabled: boolean;
}

export interface APMProvider {
  initialize(config: APMConfig): Promise<void>;
  metric(name: string, value: number, type: Metric['type'], tags?: MetricTags): void;
  startSpan(operationName: string, parentSpan?: Span): Span;
  finishSpan(span: Span): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface PerformanceMetrics {
  // Request metrics
  requestCount: number;
  requestDuration: number[];
  requestErrors: number;
  
  // AI Analysis metrics
  analysisCount: number;
  analysisDuration: number[];
  analysisErrors: number;
  analysisProviderUsage: Record<string, number>;
  
  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  cacheEvictions: number;
  cacheSize: number;
  
  // Resource metrics
  cpuUsage: number;
  memoryUsage: number;
  connectionPoolSize: number;
  activeConnections: number;
  
  // Business metrics
  filesAnalyzed: number;
  vulnerabilitiesFound: number;
  malwareDetected: number;
}