import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ 
    prefix: 'athena_',
    register
});

// Custom metrics for WASM operations
export const wasmMetrics = {
    initializationDuration: new Histogram({
        name: 'athena_wasm_initialization_duration_seconds',
        help: 'Duration of WASM module initialization',
        labelNames: ['module'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    }),
    
    operationDuration: new Histogram({
        name: 'athena_wasm_operation_duration_seconds',
        help: 'Duration of WASM operations',
        labelNames: ['module', 'operation'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
    }),
    
    operationCounter: new Counter({
        name: 'athena_wasm_operations_total',
        help: 'Total number of WASM operations',
        labelNames: ['module', 'operation', 'status']
    }),
    
    moduleSizeBytes: new Gauge({
        name: 'athena_wasm_module_size_bytes',
        help: 'Size of WASM modules in bytes',
        labelNames: ['module']
    }),
    
    memoryUsageBytes: new Gauge({
        name: 'athena_wasm_memory_usage_bytes',
        help: 'Memory usage of WASM modules',
        labelNames: ['module']
    })
};

// AI Provider metrics
export const aiMetrics = {
    requestDuration: new Histogram({
        name: 'athena_ai_request_duration_seconds',
        help: 'Duration of AI provider requests',
        labelNames: ['provider', 'analysis_type', 'status'],
        buckets: [0.5, 1, 2, 5, 10, 20, 30]
    }),
    
    requestCounter: new Counter({
        name: 'athena_ai_requests_total',
        help: 'Total number of AI requests',
        labelNames: ['provider', 'analysis_type', 'status']
    }),
    
    tokenUsage: new Counter({
        name: 'athena_ai_tokens_used_total',
        help: 'Total tokens used by AI providers',
        labelNames: ['provider', 'type'] // type: prompt, completion
    }),
    
    costEstimate: new Counter({
        name: 'athena_ai_cost_estimate_dollars',
        help: 'Estimated cost in dollars',
        labelNames: ['provider']
    }),
    
    queueSize: new Gauge({
        name: 'athena_ai_queue_size',
        help: 'Number of requests in queue',
        labelNames: ['provider']
    }),
    
    rateLimitHits: new Counter({
        name: 'athena_ai_rate_limit_hits_total',
        help: 'Number of rate limit hits',
        labelNames: ['provider']
    })
};

// API metrics
export const apiMetrics = {
    httpRequestDuration: new Histogram({
        name: 'athena_http_request_duration_seconds',
        help: 'Duration of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
    }),
    
    httpRequestsTotal: new Counter({
        name: 'athena_http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code']
    }),
    
    activeConnections: new Gauge({
        name: 'athena_http_active_connections',
        help: 'Number of active HTTP connections'
    }),
    
    requestSize: new Summary({
        name: 'athena_http_request_size_bytes',
        help: 'Size of HTTP requests',
        labelNames: ['method', 'route'],
        percentiles: [0.5, 0.9, 0.95, 0.99]
    }),
    
    responseSize: new Summary({
        name: 'athena_http_response_size_bytes',
        help: 'Size of HTTP responses',
        labelNames: ['method', 'route'],
        percentiles: [0.5, 0.9, 0.95, 0.99]
    })
};

// Cache metrics
export const cacheMetrics = {
    hitRate: new Gauge({
        name: 'athena_cache_hit_rate',
        help: 'Cache hit rate percentage'
    }),
    
    operations: new Counter({
        name: 'athena_cache_operations_total',
        help: 'Total cache operations',
        labelNames: ['operation', 'status'] // operation: get, set, delete
    }),
    
    latency: new Histogram({
        name: 'athena_cache_operation_duration_seconds',
        help: 'Cache operation latency',
        labelNames: ['operation'],
        buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05]
    }),
    
    size: new Gauge({
        name: 'athena_cache_size_bytes',
        help: 'Current cache size in bytes'
    }),
    
    evictions: new Counter({
        name: 'athena_cache_evictions_total',
        help: 'Total number of cache evictions'
    })
};

// Security metrics
export const securityMetrics = {
    threatDetections: new Counter({
        name: 'athena_security_threat_detections_total',
        help: 'Total threat detections',
        labelNames: ['type', 'severity'] // type: malware, injection, etc.
    }),
    
    blockedRequests: new Counter({
        name: 'athena_security_blocked_requests_total',
        help: 'Total blocked requests',
        labelNames: ['reason']
    }),
    
    obfuscationScore: new Histogram({
        name: 'athena_security_obfuscation_score',
        help: 'Obfuscation score distribution',
        buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
    }),
    
    entropyScore: new Histogram({
        name: 'athena_security_entropy_score',
        help: 'Entropy score distribution',
        buckets: [0, 1, 2, 3, 4, 5, 6, 7, 8]
    })
};

// Business metrics
export const businessMetrics = {
    analysisCompleted: new Counter({
        name: 'athena_analysis_completed_total',
        help: 'Total completed analyses',
        labelNames: ['type', 'provider', 'success']
    }),
    
    workflowExecutions: new Counter({
        name: 'athena_workflow_executions_total',
        help: 'Total workflow executions',
        labelNames: ['workflow_id', 'status']
    }),
    
    fileProcessed: new Counter({
        name: 'athena_files_processed_total',
        help: 'Total files processed',
        labelNames: ['file_type', 'size_category'] // size_category: small, medium, large
    }),
    
    patternMatches: new Counter({
        name: 'athena_pattern_matches_total',
        help: 'Total pattern matches found',
        labelNames: ['pattern_type', 'severity']
    })
};

// Helper function to record WASM operation
export function recordWASMOperation(
    module: string,
    operation: string,
    duration: number,
    success: boolean = true
) {
    wasmMetrics.operationDuration.labels(module, operation).observe(duration);
    wasmMetrics.operationCounter.labels(
        module,
        operation,
        success ? 'success' : 'failure'
    ).inc();
}

// Helper function to record AI request
export function recordAIRequest(
    provider: string,
    analysisType: string,
    duration: number,
    status: 'success' | 'error' | 'timeout',
    tokens?: { prompt: number; completion: number }
) {
    aiMetrics.requestDuration.labels(provider, analysisType, status).observe(duration);
    aiMetrics.requestCounter.labels(provider, analysisType, status).inc();
    
    if (tokens) {
        aiMetrics.tokenUsage.labels(provider, 'prompt').inc(tokens.prompt);
        aiMetrics.tokenUsage.labels(provider, 'completion').inc(tokens.completion);
    }
}

// Helper function to record HTTP request
export function recordHTTPRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number
) {
    const labels = { method, route, status_code: String(statusCode) };
    
    apiMetrics.httpRequestDuration.labels(labels).observe(duration);
    apiMetrics.httpRequestsTotal.labels(labels).inc();
    
    if (requestSize) {
        apiMetrics.requestSize.labels(method, route).observe(requestSize);
    }
    
    if (responseSize) {
        apiMetrics.responseSize.labels(method, route).observe(responseSize);
    }
}

// Helper function to record cache operation
export function recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    success: boolean,
    duration: number
) {
    cacheMetrics.operations.labels(operation, success ? 'hit' : 'miss').inc();
    cacheMetrics.latency.labels(operation).observe(duration);
}

// Helper function to record security event
export function recordSecurityEvent(
    type: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    details?: { obfuscation?: number; entropy?: number }
) {
    securityMetrics.threatDetections.labels(type, severity).inc();
    
    if (details?.obfuscation !== undefined) {
        securityMetrics.obfuscationScore.observe(details.obfuscation);
    }
    
    if (details?.entropy !== undefined) {
        securityMetrics.entropyScore.observe(details.entropy);
    }
}

// Express middleware for automatic HTTP metrics
export function createMetricsMiddleware() {
    return (req: any, res: any, next: any) => {
        const start = Date.now();
        const route = req.route?.path || req.path;
        
        // Track active connections
        apiMetrics.activeConnections.inc();
        
        // Capture request size
        const requestSize = parseInt(req.get('content-length') || '0');
        
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            const responseSize = parseInt(res.get('content-length') || '0');
            
            recordHTTPRequest(
                req.method,
                route,
                res.statusCode,
                duration,
                requestSize,
                responseSize
            );
            
            // Decrement active connections
            apiMetrics.activeConnections.dec();
        });
        
        next();
    };
}

// Export the registry for /metrics endpoint
export { register };