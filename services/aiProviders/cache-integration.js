"use strict";
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CachedAIOrchestrator = void 0;
exports.aiCacheMiddleware = aiCacheMiddleware;
exports.createCachedOrchestrator = createCachedOrchestrator;
const redis_cache_1 = require("../cache/redis-cache");
const logger_1 = require("../../utils/logger");
/**
 * Cache-enabled AI Orchestrator wrapper
 */
let CachedAIOrchestrator = (() => {
    var _a;
    let _instanceExtraInitializers = [];
    let _analyze_decorators;
    return _a = class CachedAIOrchestrator {
            constructor(orchestrator, // The actual orchestrator instance
            config) {
                this.orchestrator = (__runInitializers(this, _instanceExtraInitializers), orchestrator);
                this.config = config;
                this.cache = (0, redis_cache_1.getCache)({
                    keyPrefix: 'ai:',
                    ttl: 300 // 5 minutes default for AI responses
                });
            }
            /**
             * Analyze with caching
             */
            analyze(request) {
                return __awaiter(this, void 0, void 0, function* () {
                    return this.orchestrator.analyze(request);
                });
            }
            /**
             * Get cached analysis if available, otherwise compute
             */
            getCachedAnalysis(request, strategy) {
                return __awaiter(this, void 0, void 0, function* () {
                    // Generate cache key based on request
                    const cacheKey = this.generateCacheKey(request, strategy);
                    // Check cache stats
                    const stats = this.cache.getStats();
                    logger_1.logger.info(`Cache stats: ${JSON.stringify(stats)}`);
                    // Try cache first
                    const startTime = Date.now();
                    const cached = yield this.cache.get(cacheKey);
                    if (cached) {
                        logger_1.logger.info(`Cache hit for analysis (${Date.now() - startTime}ms)`);
                        return Object.assign(Object.assign({}, cached), { metadata: Object.assign(Object.assign({}, cached.metadata), { cached: true, cacheTime: Date.now() - startTime }) });
                    }
                    logger_1.logger.info(`Cache miss for analysis, computing...`);
                    // Compute and cache
                    const response = yield this.orchestrator.analyzeWithStrategy(request, strategy);
                    // Determine TTL based on analysis type
                    const ttl = this.determineTTL(request.analysisType);
                    // Cache the response
                    yield this.cache.set(cacheKey, response, ttl, ['ai-analysis', request.analysisType, request.provider || 'auto']);
                    return response;
                });
            }
            /**
             * Batch analyze with caching
             */
            batchAnalyze(requests) {
                return __awaiter(this, void 0, void 0, function* () {
                    // Check which requests are cached
                    const cacheKeys = requests.map(req => this.generateCacheKey(req));
                    const cachedResponses = yield this.cache.mget(cacheKeys);
                    // Separate cached and uncached requests
                    const uncachedRequests = [];
                    const uncachedIndices = [];
                    const results = [];
                    cachedResponses.forEach((cached, index) => {
                        if (cached) {
                            results[index] = Object.assign(Object.assign({}, cached), { metadata: Object.assign(Object.assign({}, cached.metadata), { cached: true }) });
                        }
                        else {
                            uncachedRequests.push(requests[index]);
                            uncachedIndices.push(index);
                        }
                    });
                    // Process uncached requests
                    if (uncachedRequests.length > 0) {
                        const newResponses = yield Promise.all(uncachedRequests.map(req => this.orchestrator.analyze(req)));
                        // Cache new responses and add to results
                        for (let i = 0; i < newResponses.length; i++) {
                            const response = newResponses[i];
                            const request = uncachedRequests[i];
                            const originalIndex = uncachedIndices[i];
                            // Cache the response
                            yield this.cache.set(this.generateCacheKey(request), response, this.determineTTL(request.analysisType), ['ai-analysis', request.analysisType]);
                            results[originalIndex] = response;
                        }
                    }
                    return results;
                });
            }
            /**
             * Invalidate cache for specific analysis types
             */
            invalidateCache(analysisType, provider) {
                return __awaiter(this, void 0, void 0, function* () {
                    if (analysisType) {
                        return yield this.cache.clearByTag(analysisType);
                    }
                    if (provider) {
                        return yield this.cache.clearByTag(provider);
                    }
                    // Clear all AI analysis cache
                    return yield this.cache.clearByTag('ai-analysis');
                });
            }
            /**
             * Warm up cache with common requests
             */
            warmupCache(commonRequests) {
                return __awaiter(this, void 0, void 0, function* () {
                    logger_1.logger.info(`Warming up cache with ${commonRequests.length} requests...`);
                    const startTime = Date.now();
                    const results = yield this.batchAnalyze(commonRequests);
                    logger_1.logger.info(`Cache warmup completed in ${Date.now() - startTime}ms, ` +
                        `cached ${results.length} responses`);
                });
            }
            /**
             * Generate consistent cache key for a request
             */
            generateCacheKey(request, strategy) {
                const key = [
                    'analysis',
                    request.analysisType,
                    this.hashContent(request.content),
                    request.provider || 'auto',
                    strategy || 'single',
                    request.options ? JSON.stringify(request.options) : 'default'
                ];
                return key;
            }
            /**
             * Hash content for cache key (to handle large content)
             */
            hashContent(content) {
                const crypto = require('crypto');
                return crypto
                    .createHash('sha256')
                    .update(content)
                    .digest('hex')
                    .substring(0, 16);
            }
            /**
             * Determine TTL based on analysis type
             */
            determineTTL(analysisType) {
                const ttlMap = {
                    'MALWARE_ANALYSIS': 3600, // 1 hour
                    'DEOBFUSCATION': 1800, // 30 minutes
                    'PATTERN_DETECTION': 600, // 10 minutes
                    'GENERAL_ANALYSIS': 300, // 5 minutes
                    'URL_ANALYSIS': 300, // 5 minutes
                    'BINARY_ANALYSIS': 3600, // 1 hour
                    'CODE_REVIEW': 1800 // 30 minutes
                };
                return ttlMap[analysisType] || 300; // Default 5 minutes
            }
            /**
             * Get cache statistics for monitoring
             */
            getCacheStats() {
                return this.cache.getStats();
            }
            /**
             * Preload frequently used patterns
             */
            preloadPatterns() {
                return __awaiter(this, void 0, void 0, function* () {
                    const commonPatterns = [
                        {
                            content: 'eval(',
                            analysisType: 'PATTERN_DETECTION',
                            provider: 'deepseek'
                        },
                        {
                            content: 'document.write(',
                            analysisType: 'PATTERN_DETECTION',
                            provider: 'deepseek'
                        },
                        {
                            content: 'exec(',
                            analysisType: 'MALWARE_ANALYSIS',
                            provider: 'claude'
                        }
                    ];
                    yield this.warmupCache(commonPatterns);
                });
            }
        },
        (() => {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
            _analyze_decorators = [(0, redis_cache_1.Cacheable)((request) => [
                    'analysis',
                    request.content.substring(0, 100), // First 100 chars as key
                    request.analysisType,
                    request.provider
                ], 300, // 5 minutes TTL
                ['ai-analysis'])];
            __esDecorate(_a, null, _analyze_decorators, { kind: "method", name: "analyze", static: false, private: false, access: { has: obj => "analyze" in obj, get: obj => obj.analyze }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(_a, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        })(),
        _a;
})();
exports.CachedAIOrchestrator = CachedAIOrchestrator;
/**
 * Cache middleware for AI analysis endpoints
 */
function aiCacheMiddleware(ttl = 300) {
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        const cache = (0, redis_cache_1.getCache)();
        // Generate cache key from request
        const cacheKey = [
            'api',
            req.method,
            req.path,
            JSON.stringify(req.body || {}),
            JSON.stringify(req.query || {})
        ];
        // Check cache
        const cached = yield cache.get(cacheKey);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('X-Cache-TTL', yield cache.ttl(cacheKey));
            return res.json(cached);
        }
        // Store original send function
        const originalSend = res.json;
        // Override json method to cache response
        res.json = function (data) {
            res.setHeader('X-Cache', 'MISS');
            // Cache successful responses only
            if (res.statusCode === 200) {
                cache.set(cacheKey, data, ttl, ['api-response']).catch(err => {
                    logger_1.logger.error('Failed to cache API response:', err);
                });
            }
            // Call original send
            return originalSend.call(this, data);
        };
        next();
    });
}
/**
 * Create cache-enabled orchestrator factory
 */
function createCachedOrchestrator(orchestrator, config) {
    return new CachedAIOrchestrator(orchestrator, config);
}
