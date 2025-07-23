"use strict";
/**
 * Express Server for Athena AI Services
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const body_parser_1 = require("body-parser");
const router_1 = __importDefault(require("./aiProviders/api/router"));
const aiProviders_1 = require("./aiProviders");
const logger_1 = require("../utils/logger");
const redis_cache_1 = require("./cache/redis-cache");
const cache_integration_1 = require("./aiProviders/cache-integration");
const metrics_1 = require("./monitoring/metrics");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Import security middleware
const { rateLimitConfigs, ipBlocker } = require('./aiProviders/middleware/advancedRateLimit');
const { authenticate, requirePermission, loginEndpoint } = require('./aiProviders/middleware/auth');

// Security middleware
app.use(ipBlocker.middleware); // IP blocking first
app.use(rateLimitConfigs.burst); // Burst protection
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));
app.use((0, cors_1.default)({
    origin: ((_a = process.env.CORS_ORIGIN) === null || _a === void 0 ? void 0 : _a.split(',')) || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
}));
// Test middleware to log incoming requests
app.use((req, res, next) => {
    logger_1.logger.info('Request received', { 
        method: req.method, 
        path: req.path,
        headers: req.headers['content-type']
    });
    next();
});

// Configure JSON parser with custom error handling
app.use((0, body_parser_1.json)({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Custom JSON error handler that catches JSON parsing errors directly
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logger_1.logger.warn('Malformed JSON detected by body-parser', { 
            error: err.message, 
            path: req.path, 
            ip: req.ip 
        });
        return res.status(400).json({
            error: 'Malformed JSON',
            message: 'Request body contains invalid JSON'
        });
    }
    next(err);
});

app.use((0, body_parser_1.urlencoded)({ extended: true, limit: '10mb' }));


// Metrics middleware
app.use((0, metrics_1.createMetricsMiddleware)());
// Request logging
app.use((req, res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});
// Cache middleware for specific routes
app.use('/api/v1/analyze', (0, cache_integration_1.aiCacheMiddleware)(300)); // 5 minute cache
app.use('/api/v1/workflows', (0, cache_integration_1.aiCacheMiddleware)(600)); // 10 minute cache

// Authentication endpoint (for JWT token generation)
app.post('/api/v1/auth/login', rateLimitConfigs.auth, authenticate, loginEndpoint);

// Apply rate limiting and authentication to protected routes
app.use('/api/v1/analyze', rateLimitConfigs.analysis, authenticate, requirePermission('analyze'));
app.use('/api/v1/workflows', rateLimitConfigs.analysis, authenticate, requirePermission('workflow'));

// Routes
app.use('/api/v1', rateLimitConfigs.general, router_1.default);
// WASM status endpoint
const wasmStatusRouter = require('./wasm-status-endpoint');
app.use('/api/v1', wasmStatusRouter);
// File analysis endpoints with security
const fileAnalysisRouter = require('./aiProviders/api/file-analysis-endpoints');
app.use('/api/v1/analysis', rateLimitConfigs.upload, authenticate, requirePermission('upload'), fileAnalysisRouter);
// WASM analysis endpoints with security
const wasmAnalysisRouter = require('./aiProviders/api/wasm-analysis-endpoints');
app.use('/api/v1/wasm', rateLimitConfigs.wasm, authenticate, requirePermission('wasm'), wasmAnalysisRouter);
// Root endpoint
app.get('/', (_req, res) => {
    res.json({
        name: 'Athena AI Services',
        version: '1.0.0',
        endpoints: {
            health: '/api/v1/health',
            analyze: '/api/v1/analyze',
            workflows: '/api/v1/workflows/:agentId',
            providers: '/api/v1/providers',
            metrics: '/metrics',
            fileAnalysis: {
                upload: '/api/v1/analysis/upload',
                batch: '/api/v1/analysis/batch',
                status: '/api/v1/analysis/:id/status',
                results: '/api/v1/analysis/:id/results'
            },
            wasmAnalysis: {
                analyze: '/api/v1/wasm/analyze',
                capabilities: '/api/v1/wasm/capabilities'
            }
        }
    });
});
// Prometheus metrics endpoint
app.get('/metrics', (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        res.set('Content-Type', metrics_1.register.contentType);
        res.end(yield metrics_1.register.metrics());
    }
    catch (error) {
        res.status(500).end(error);
    }
}));

// Error handling
app.use((err, req, res, _next) => {
    // Log all errors to debug the JSON parsing issue
    logger_1.logger.error('Unhandled error', { 
        error: err.message,
        errorType: err.constructor.name,
        errorStatus: err.status,
        hasBody: 'body' in err,
        path: req.path,
        stack: err.stack
    });
    
    // Check if this is a JSON parsing error that wasn't caught earlier
    if (err instanceof SyntaxError && err.message && err.message.includes('JSON')) {
        logger_1.logger.warn('JSON parsing error caught in final handler', { 
            error: err.message, 
            path: req.path 
        });
        return res.status(400).json({
            error: 'Malformed JSON',
            message: 'Request body contains invalid JSON'
        });
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});
// Initialize and start server
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Initialize Redis cache
            logger_1.logger.info('Initializing Redis cache...');
            const cache = (0, redis_cache_1.getCache)();
            // Initialize AI providers
            logger_1.logger.info('Initializing AI providers...');
            yield (0, aiProviders_1.initializeAIProviders)();
            // Initialize WASM modules
            const { initializeWASMModules } = require('./wasm-loader');
            yield initializeWASMModules();
            // Log cache stats periodically and update metrics
            setInterval(() => {
                const stats = cache.getStats();
                logger_1.logger.info('Cache statistics', stats);
                // Update cache metrics
                const hitRate = parseFloat(stats.hitRate.replace('%', ''));
                metrics_1.cacheMetrics.hitRate.set(hitRate);
            }, 60000); // Every minute
            // Start server
            app.listen(PORT, () => {
                logger_1.logger.info(`Athena AI Services running on port ${PORT}`);
                logger_1.logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
                logger_1.logger.info('Redis cache enabled');
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to start server', { error });
            process.exit(1);
        }
    });
}
// Handle graceful shutdown
process.on('SIGTERM', () => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.logger.info('SIGTERM received, shutting down gracefully...');
    const cache = (0, redis_cache_1.getCache)();
    yield cache.close();
    process.exit(0);
}));
process.on('SIGINT', () => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.logger.info('SIGINT received, shutting down gracefully...');
    const cache = (0, redis_cache_1.getCache)();
    yield cache.close();
    process.exit(0);
}));
// Start the server
startServer();
