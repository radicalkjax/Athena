"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.businessMetrics = exports.securityMetrics = exports.cacheMetrics = exports.apiMetrics = exports.aiMetrics = exports.wasmMetrics = void 0;
exports.recordWASMOperation = recordWASMOperation;
exports.recordAIRequest = recordAIRequest;
exports.recordHTTPRequest = recordHTTPRequest;
exports.recordCacheOperation = recordCacheOperation;
exports.recordSecurityEvent = recordSecurityEvent;
exports.createMetricsMiddleware = createMetricsMiddleware;
const prom_client_1 = require("prom-client");
Object.defineProperty(exports, "register", { enumerable: true, get: function () { return prom_client_1.register; } });
// Collect default metrics (CPU, memory, etc.)
(0, prom_client_1.collectDefaultMetrics)({
    prefix: 'athena_',
    register: prom_client_1.register
});
// Custom metrics for WASM operations
exports.wasmMetrics = {
    initializationDuration: new prom_client_1.Histogram({
        name: 'athena_wasm_initialization_duration_seconds',
        help: 'Duration of WASM module initialization',
        labelNames: ['module'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    }),
    operationDuration: new prom_client_1.Histogram({
        name: 'athena_wasm_operation_duration_seconds',
        help: 'Duration of WASM operations',
        labelNames: ['module', 'operation'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
    }),
    operationCounter: new prom_client_1.Counter({
        name: 'athena_wasm_operations_total',
        help: 'Total number of WASM operations',
        labelNames: ['module', 'operation', 'status']
    }),
    moduleSizeBytes: new prom_client_1.Gauge({
        name: 'athena_wasm_module_size_bytes',
        help: 'Size of WASM modules in bytes',
        labelNames: ['module']
    }),
    memoryUsageBytes: new prom_client_1.Gauge({
        name: 'athena_wasm_memory_usage_bytes',
        help: 'Memory usage of WASM modules',
        labelNames: ['module']
    })
};
// AI Provider metrics
exports.aiMetrics = {
    requestDuration: new prom_client_1.Histogram({
        name: 'athena_ai_request_duration_seconds',
        help: 'Duration of AI provider requests',
        labelNames: ['provider', 'analysis_type', 'status'],
        buckets: [0.5, 1, 2, 5, 10, 20, 30]
    }),
    requestCounter: new prom_client_1.Counter({
        name: 'athena_ai_requests_total',
        help: 'Total number of AI requests',
        labelNames: ['provider', 'analysis_type', 'status']
    }),
    tokenUsage: new prom_client_1.Counter({
        name: 'athena_ai_tokens_used_total',
        help: 'Total tokens used by AI providers',
        labelNames: ['provider', 'type'] // type: prompt, completion
    }),
    costEstimate: new prom_client_1.Counter({
        name: 'athena_ai_cost_estimate_dollars',
        help: 'Estimated cost in dollars',
        labelNames: ['provider']
    }),
    queueSize: new prom_client_1.Gauge({
        name: 'athena_ai_queue_size',
        help: 'Number of requests in queue',
        labelNames: ['provider']
    }),
    rateLimitHits: new prom_client_1.Counter({
        name: 'athena_ai_rate_limit_hits_total',
        help: 'Number of rate limit hits',
        labelNames: ['provider']
    })
};
// API metrics
exports.apiMetrics = {
    httpRequestDuration: new prom_client_1.Histogram({
        name: 'athena_http_request_duration_seconds',
        help: 'Duration of HTTP requests',
        labelNames: ['method', 'route', 'status_code'],
        buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
    }),
    httpRequestsTotal: new prom_client_1.Counter({
        name: 'athena_http_requests_total',
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status_code']
    }),
    activeConnections: new prom_client_1.Gauge({
        name: 'athena_http_active_connections',
        help: 'Number of active HTTP connections'
    }),
    requestSize: new prom_client_1.Summary({
        name: 'athena_http_request_size_bytes',
        help: 'Size of HTTP requests',
        labelNames: ['method', 'route'],
        percentiles: [0.5, 0.9, 0.95, 0.99]
    }),
    responseSize: new prom_client_1.Summary({
        name: 'athena_http_response_size_bytes',
        help: 'Size of HTTP responses',
        labelNames: ['method', 'route'],
        percentiles: [0.5, 0.9, 0.95, 0.99]
    })
};
// Cache metrics
exports.cacheMetrics = {
    hitRate: new prom_client_1.Gauge({
        name: 'athena_cache_hit_rate',
        help: 'Cache hit rate percentage'
    }),
    operations: new prom_client_1.Counter({
        name: 'athena_cache_operations_total',
        help: 'Total cache operations',
        labelNames: ['operation', 'status'] // operation: get, set, delete
    }),
    latency: new prom_client_1.Histogram({
        name: 'athena_cache_operation_duration_seconds',
        help: 'Cache operation latency',
        labelNames: ['operation'],
        buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05]
    }),
    size: new prom_client_1.Gauge({
        name: 'athena_cache_size_bytes',
        help: 'Current cache size in bytes'
    }),
    evictions: new prom_client_1.Counter({
        name: 'athena_cache_evictions_total',
        help: 'Total number of cache evictions'
    })
};
// Security metrics
exports.securityMetrics = {
    threatDetections: new prom_client_1.Counter({
        name: 'athena_security_threat_detections_total',
        help: 'Total threat detections',
        labelNames: ['type', 'severity'] // type: malware, injection, etc.
    }),
    blockedRequests: new prom_client_1.Counter({
        name: 'athena_security_blocked_requests_total',
        help: 'Total blocked requests',
        labelNames: ['reason']
    }),
    obfuscationScore: new prom_client_1.Histogram({
        name: 'athena_security_obfuscation_score',
        help: 'Obfuscation score distribution',
        buckets: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]
    }),
    entropyScore: new prom_client_1.Histogram({
        name: 'athena_security_entropy_score',
        help: 'Entropy score distribution',
        buckets: [0, 1, 2, 3, 4, 5, 6, 7, 8]
    })
};
// Business metrics
exports.businessMetrics = {
    analysisCompleted: new prom_client_1.Counter({
        name: 'athena_analysis_completed_total',
        help: 'Total completed analyses',
        labelNames: ['type', 'provider', 'success']
    }),
    workflowExecutions: new prom_client_1.Counter({
        name: 'athena_workflow_executions_total',
        help: 'Total workflow executions',
        labelNames: ['workflow_id', 'status']
    }),
    fileProcessed: new prom_client_1.Counter({
        name: 'athena_files_processed_total',
        help: 'Total files processed',
        labelNames: ['file_type', 'size_category'] // size_category: small, medium, large
    }),
    patternMatches: new prom_client_1.Counter({
        name: 'athena_pattern_matches_total',
        help: 'Total pattern matches found',
        labelNames: ['pattern_type', 'severity']
    })
};
// Helper function to record WASM operation
function recordWASMOperation(module, operation, duration, success = true) {
    exports.wasmMetrics.operationDuration.labels(module, operation).observe(duration);
    exports.wasmMetrics.operationCounter.labels(module, operation, success ? 'success' : 'failure').inc();
}
// Helper function to record AI request
function recordAIRequest(provider, analysisType, duration, status, tokens) {
    exports.aiMetrics.requestDuration.labels(provider, analysisType, status).observe(duration);
    exports.aiMetrics.requestCounter.labels(provider, analysisType, status).inc();
    if (tokens) {
        exports.aiMetrics.tokenUsage.labels(provider, 'prompt').inc(tokens.prompt);
        exports.aiMetrics.tokenUsage.labels(provider, 'completion').inc(tokens.completion);
    }
}
// Helper function to record HTTP request
function recordHTTPRequest(method, route, statusCode, duration, requestSize, responseSize) {
    const labels = { method, route, status_code: String(statusCode) };
    exports.apiMetrics.httpRequestDuration.labels(labels).observe(duration);
    exports.apiMetrics.httpRequestsTotal.labels(labels).inc();
    if (requestSize) {
        exports.apiMetrics.requestSize.labels(method, route).observe(requestSize);
    }
    if (responseSize) {
        exports.apiMetrics.responseSize.labels(method, route).observe(responseSize);
    }
}
// Helper function to record cache operation
function recordCacheOperation(operation, success, duration) {
    exports.cacheMetrics.operations.labels(operation, success ? 'hit' : 'miss').inc();
    exports.cacheMetrics.latency.labels(operation).observe(duration);
}
// Helper function to record security event
function recordSecurityEvent(type, severity, details) {
    exports.securityMetrics.threatDetections.labels(type, severity).inc();
    if (details?.obfuscation !== undefined) {
        exports.securityMetrics.obfuscationScore.observe(details.obfuscation);
    }
    if (details?.entropy !== undefined) {
        exports.securityMetrics.entropyScore.observe(details.entropy);
    }
}
// Express middleware for automatic HTTP metrics
function createMetricsMiddleware() {
    return (req, res, next) => {
        const start = Date.now();
        const route = req.route?.path || req.path;
        // Track active connections
        exports.apiMetrics.activeConnections.inc();
        // Capture request size
        const requestSize = parseInt(req.get('content-length') || '0');
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            const responseSize = parseInt(res.get('content-length') || '0');
            recordHTTPRequest(req.method, route, res.statusCode, duration, requestSize, responseSize);
            // Decrement active connections
            exports.apiMetrics.activeConnections.dec();
        });
        next();
    };
}
