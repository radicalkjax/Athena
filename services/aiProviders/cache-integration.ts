import { getCache, Cacheable } from '../cache/redis-cache';
import { 
    AIOrchestratorConfig, 
    AnalysisRequest,
    AnalysisResult
} from './types';
import { OrchestrationStrategy } from './orchestrator';
import { logger } from '../../utils/logger';
import * as crypto from 'crypto';

/**
 * Cache-enabled AI Orchestrator wrapper
 */
export class CachedAIOrchestrator {
    private cache = getCache({
        keyPrefix: 'ai:',
        ttl: 300 // 5 minutes default for AI responses
    });

    constructor(
        private orchestrator: any, // The actual orchestrator instance
        private config: AIOrchestratorConfig
    ) {}

    /**
     * Analyze with caching
     */
    @Cacheable(
        (request: AnalysisRequest) => [
            'analysis',
            typeof request.content === 'string' 
                ? request.content.substring(0, 100) 
                : 'binary-content',
            request.analysisType || 'general',
            request.metadata?.provider || 'auto'
        ],
        300, // 5 minutes TTL
        ['ai-analysis']
    )
    async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
        return this.orchestrator.analyze(request);
    }

    /**
     * Get cached analysis if available, otherwise compute
     */
    async getCachedAnalysis(
        request: AnalysisRequest,
        strategy?: OrchestrationStrategy
    ): Promise<AnalysisResult> {
        // Generate cache key based on request
        const cacheKey = this.generateCacheKey(request, strategy);
        
        // Check cache stats
        const stats = this.cache.getStats();
        logger.info(`Cache stats: ${JSON.stringify(stats)}`);

        // Try cache first
        const startTime = Date.now();
        const cached = await this.cache.get<AnalysisResult>(cacheKey);
        
        if (cached) {
            logger.info(`Cache hit for analysis (${Date.now() - startTime}ms)`);
            return {
                ...cached,
                metadata: {
                    ...cached.metadata,
                    cached: true,
                    cacheTime: Date.now() - startTime
                }
            };
        }

        logger.info(`Cache miss for analysis, computing...`);
        
        // Compute and cache
        const response = await this.orchestrator.analyze(request, strategy);
        
        // Determine TTL based on analysis type
        const ttl = this.determineTTL(request.analysisType || 'general');
        
        // Cache the response
        await this.cache.set(
            cacheKey,
            response,
            ttl,
            ['ai-analysis', request.analysisType || 'general', request.metadata?.provider || 'auto']
        );

        return response;
    }

    /**
     * Batch analyze with caching
     */
    async batchAnalyze(
        requests: AnalysisRequest[]
    ): Promise<AnalysisResult[]> {
        // Check which requests are cached
        const cacheKeys = requests.map(req => this.generateCacheKey(req));
        const cachedResponses = await this.cache.mget<AnalysisResult>(cacheKeys);
        
        // Separate cached and uncached requests
        const uncachedRequests: AnalysisRequest[] = [];
        const uncachedIndices: number[] = [];
        const results: AnalysisResult[] = [];

        cachedResponses.forEach((cached, index) => {
            if (cached) {
                results[index] = {
                    ...cached,
                    metadata: {
                        ...cached.metadata,
                        cached: true
                    }
                };
            } else {
                uncachedRequests.push(requests[index]);
                uncachedIndices.push(index);
            }
        });

        // Process uncached requests
        if (uncachedRequests.length > 0) {
            const newResponses = await Promise.all(
                uncachedRequests.map(req => this.orchestrator.analyze(req))
            );

            // Cache new responses and add to results
            for (let i = 0; i < newResponses.length; i++) {
                const response = newResponses[i];
                const request = uncachedRequests[i];
                const originalIndex = uncachedIndices[i];
                
                // Cache the response
                await this.cache.set(
                    this.generateCacheKey(request),
                    response,
                    this.determineTTL(request.analysisType || 'general'),
                    ['ai-analysis', request.analysisType || 'general']
                );
                
                results[originalIndex] = response;
            }
        }

        return results;
    }

    /**
     * Invalidate cache for specific analysis types
     */
    async invalidateCache(
        analysisType?: string,
        provider?: string
    ): Promise<number> {
        if (analysisType) {
            return await this.cache.clearByTag(analysisType);
        }
        
        if (provider) {
            return await this.cache.clearByTag(provider);
        }

        // Clear all AI analysis cache
        return await this.cache.clearByTag('ai-analysis');
    }

    /**
     * Warm up cache with common requests
     */
    async warmupCache(
        commonRequests: AnalysisRequest[]
    ): Promise<void> {
        logger.info(`Warming up cache with ${commonRequests.length} requests...`);
        
        const startTime = Date.now();
        const results = await this.batchAnalyze(commonRequests);
        
        logger.info(
            `Cache warmup completed in ${Date.now() - startTime}ms, ` +
            `cached ${results.length} responses`
        );
    }

    /**
     * Generate consistent cache key for a request
     */
    private generateCacheKey(
        request: AnalysisRequest,
        strategy?: OrchestrationStrategy
    ): string[] {
        const key = [
            'analysis',
            request.analysisType || 'general',
            this.hashContent(request.content),
            request.metadata?.provider || 'auto',
            strategy?.type || 'single',
            request.options ? JSON.stringify(request.options) : 'default'
        ];

        return key;
    }

    /**
     * Hash content for cache key (to handle large content)
     */
    private hashContent(content: string | ArrayBuffer): string {
        const dataToHash = typeof content === 'string' 
            ? content 
            : Buffer.from(content).toString('base64');
            
        return crypto
            .createHash('sha256')
            .update(dataToHash)
            .digest('hex')
            .substring(0, 16);
    }

    /**
     * Determine TTL based on analysis type
     */
    private determineTTL(analysisType: string): number {
        const ttlMap: Record<string, number> = {
            'MALWARE_ANALYSIS': 3600,      // 1 hour
            'DEOBFUSCATION': 1800,         // 30 minutes
            'PATTERN_DETECTION': 600,       // 10 minutes
            'GENERAL_ANALYSIS': 300,        // 5 minutes
            'URL_ANALYSIS': 300,            // 5 minutes
            'BINARY_ANALYSIS': 3600,        // 1 hour
            'CODE_REVIEW': 1800            // 30 minutes
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
    async preloadPatterns(): Promise<void> {
        const commonPatterns: AnalysisRequest[] = [
            {
                id: 'pattern-1',
                content: 'eval(',
                analysisType: 'PATTERN_DETECTION',
                metadata: { provider: 'deepseek' }
            },
            {
                id: 'pattern-2',
                content: 'document.write(',
                analysisType: 'PATTERN_DETECTION',
                metadata: { provider: 'deepseek' }
            },
            {
                id: 'pattern-3',
                content: 'exec(',
                analysisType: 'MALWARE_ANALYSIS',
                metadata: { provider: 'claude' }
            }
        ];

        await this.warmupCache(commonPatterns);
    }
}

/**
 * Cache middleware for AI analysis endpoints
 */
export function aiCacheMiddleware(ttl: number = 300) {
    return async (req: any, res: any, next: any) => {
        const cache = getCache();
        
        // Generate cache key from request
        const cacheKey = [
            'api',
            req.method,
            req.path,
            JSON.stringify(req.body || {}),
            JSON.stringify(req.query || {})
        ];

        // Check cache
        const cached = await cache.get(cacheKey);
        if (cached) {
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('X-Cache-TTL', await cache.ttl(cacheKey));
            return res.json(cached);
        }

        // Store original send function
        const originalSend = res.json;
        
        // Override json method to cache response
        res.json = function(data: any) {
            res.setHeader('X-Cache', 'MISS');
            
            // Cache successful responses only
            if (res.statusCode === 200) {
                cache.set(cacheKey, data, ttl, ['api-response']).catch((err: any) => {
                    logger.error('Failed to cache API response:', err);
                });
            }
            
            // Call original method
            return originalSend.call(this, data);
        };
        
        next();
    };
}