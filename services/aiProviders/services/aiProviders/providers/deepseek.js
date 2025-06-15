"use strict";
/**
 * DeepSeek AI Provider Implementation
 * Specialized for malware analysis and deobfuscation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepSeekProvider = void 0;
const types_1 = require("../types");
const logger_1 = require("../../../utils/logger");
const rateLimiter_1 = require("../utils/rateLimiter");
const cache_1 = require("../utils/cache");
class DeepSeekProvider {
    constructor(config) {
        this.name = 'deepseek';
        this.config = {
            endpoint: 'https://api.deepseek.com/v1',
            model: 'deepseek-coder',
            maxRetries: 3,
            timeout: 30000,
            ...config
        };
        this.apiEndpoint = `${this.config.endpoint}/chat/completions`;
        // Initialize rate limiter (DeepSeek has higher limits)
        this.rateLimiter = new rateLimiter_1.RateLimiter({
            requestsPerMinute: 120,
            tokensPerMinute: 200000
        });
        // Initialize cache
        this.cache = new cache_1.ResponseCache({
            ttl: 300000, // 5 minutes
            maxSize: 100
        });
    }
    async analyze(request) {
        try {
            // Check cache first
            const cacheKey = this.getCacheKey(request);
            const cached = await this.cache.get(cacheKey);
            if (cached) {
                logger_1.logger.debug('DeepSeek cache hit', { requestId: request.id });
                return cached;
            }
            // Check rate limits
            await this.rateLimiter.checkLimit();
            // Prepare the prompt
            const messages = this.buildMessages(request);
            // Make API call
            const startTime = Date.now();
            const response = await this.callDeepSeekAPI(messages, request.options);
            const latency = Date.now() - startTime;
            // Parse response
            const result = this.parseResponse(response, request, latency);
            // Cache the result
            await this.cache.set(cacheKey, result);
            // Update rate limiter
            this.rateLimiter.recordUsage({
                requests: 1,
                tokens: response.usage.total_tokens
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('DeepSeek analysis failed', {
                error,
                requestId: request.id
            });
            throw new types_1.AIProviderError('deepseek', `Analysis failed: ${error.message}`, error.code, this.isRetryable(error));
        }
    }
    async *stream(request) {
        // DeepSeek streaming implementation
        const messages = this.buildMessages(request);
        const streamResponse = await this.callDeepSeekAPIStream(messages, request.options);
        for await (const chunk of streamResponse) {
            if (chunk.choices?.[0]?.delta?.content) {
                yield {
                    id: request.id,
                    type: 'partial',
                    content: chunk.choices[0].delta.content,
                    metadata: { provider: 'deepseek' }
                };
            }
        }
    }
    getCapabilities() {
        return {
            models: [
                'deepseek-coder',
                'deepseek-chat'
            ],
            features: [
                'malware_analysis',
                'deobfuscation',
                'pattern_recognition',
                'code_decompilation',
                'binary_analysis'
            ],
            maxTokens: 32000,
            supportedFormats: ['text', 'code', 'binary', 'hex'],
            specializations: [
                'malware_detection',
                'obfuscation_analysis',
                'binary_reversing'
            ],
            streaming: true
        };
    }
    async getStatus() {
        try {
            // Simple health check
            const testMessages = [
                { role: 'system', content: 'You are a test assistant.' },
                { role: 'user', content: 'Respond with OK' }
            ];
            const response = await this.callDeepSeekAPI(testMessages, { maxTokens: 10 });
            return {
                available: true,
                healthy: true,
                latency: 100, // Would measure actual latency
                rateLimit: {
                    remaining: this.rateLimiter.getRemaining(),
                    reset: this.rateLimiter.getResetTime()
                }
            };
        }
        catch (error) {
            return {
                available: false,
                healthy: false,
                errors: [error.message]
            };
        }
    }
    async validateConfig() {
        try {
            if (!this.config.apiKey) {
                throw new Error('API key is required');
            }
            // Test the API key
            await this.getStatus();
            return true;
        }
        catch (error) {
            logger_1.logger.error('DeepSeek config validation failed', { error });
            return false;
        }
    }
    /**
     * Build messages for DeepSeek based on request type
     */
    buildMessages(request) {
        const analysisType = request.analysisType || 'GENERAL_ANALYSIS';
        const content = typeof request.content === 'string'
            ? request.content
            : this.encodeContent(request.content);
        const systemPrompts = {
            MALWARE_ANALYSIS: `You are a malware analysis expert specializing in:
        - Static and dynamic malware analysis
        - Unpacking and deobfuscation
        - Behavioral pattern recognition
        - IOC extraction and threat classification
        - Binary analysis and reverse engineering
        Focus on identifying malicious behaviors, obfuscation techniques, and providing actionable intelligence.`,
            CODE_DEOBFUSCATION: `You are an expert in code deobfuscation and reverse engineering:
        - Identify obfuscation techniques (encoding, packing, encryption)
        - Deobfuscate and clean code
        - Reconstruct original functionality
        - Detect anti-analysis techniques
        - Provide clear, readable output`,
            PATTERN_MATCHING: `You are a pattern recognition specialist:
        - Identify malware families and variants
        - Match code patterns to known threats
        - Detect behavioral similarities
        - Find reused code segments
        - Map to threat actor TTPs`,
            BINARY_ANALYSIS: `You are a binary analysis expert:
        - Analyze binary structure and headers
        - Identify packing and encryption
        - Extract strings and resources
        - Detect API usage patterns
        - Reconstruct high-level functionality`
        };
        const userPrompts = {
            MALWARE_ANALYSIS: `Analyze the following sample for malware:
        1. Identify malicious behaviors and capabilities
        2. Detect obfuscation and evasion techniques
        3. Extract IOCs (IPs, domains, file hashes, registry keys)
        4. Classify malware family if possible
        5. Rate severity: low/medium/high/critical
        6. Provide MITRE ATT&CK mapping
        
        Sample: ${content}`,
            CODE_DEOBFUSCATION: `Deobfuscate the following code:
        1. Identify obfuscation methods used
        2. Provide deobfuscated version
        3. Explain the deobfuscation process
        4. Highlight suspicious or malicious patterns
        5. Rate complexity of obfuscation
        
        Code: ${content}`,
            PATTERN_MATCHING: `Match patterns in the following code/binary:
        1. Identify similar known malware patterns
        2. Find code reuse or shared components
        3. Match to known threat actor tools
        4. Detect behavioral patterns
        5. Provide confidence scores
        
        Sample: ${content}`,
            BINARY_ANALYSIS: `Analyze the following binary data:
        1. Identify file type and structure
        2. Detect packing or encryption
        3. Extract meaningful strings and resources
        4. Identify imported functions and libraries
        5. Reconstruct functionality overview
        
        Binary: ${content}`,
            GENERAL_ANALYSIS: `Perform security analysis on: ${content}`
        };
        const systemPrompt = systemPrompts[analysisType] || systemPrompts.MALWARE_ANALYSIS;
        const userPrompt = userPrompts[analysisType] || userPrompts.GENERAL_ANALYSIS;
        const messages = [
            { role: 'system', content: systemPrompt }
        ];
        // Add context if provided
        if (request.context) {
            messages.push({
                role: 'assistant',
                content: `Previous analysis context: ${JSON.stringify(request.context)}`
            });
        }
        messages.push({ role: 'user', content: userPrompt });
        return messages;
    }
    /**
     * Call DeepSeek API
     */
    async callDeepSeekAPI(messages, options) {
        const body = {
            model: options?.model || this.config.model,
            messages,
            max_tokens: options?.maxTokens || 4096,
            temperature: options?.temperature || 0.2, // Lower temp for analysis
            top_p: options?.topP || 0.95,
            frequency_penalty: 0,
            presence_penalty: 0
        };
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(this.config.timeout)
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || `API error: ${response.status}`);
        }
        return response.json();
    }
    /**
     * Stream API call
     */
    async *callDeepSeekAPIStream(messages, options) {
        const body = {
            model: options?.model || this.config.model,
            messages,
            max_tokens: options?.maxTokens || 4096,
            temperature: options?.temperature || 0.2,
            stream: true
        };
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(body)
        });
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data !== '[DONE]') {
                        try {
                            yield JSON.parse(data);
                        }
                        catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }
        }
    }
    /**
     * Parse DeepSeek response into standard format
     */
    parseResponse(response, request, latency) {
        const content = response.choices[0]?.message?.content || '';
        // Extract structured data from response
        const analysis = this.extractAnalysis(content, request.analysisType);
        return {
            id: request.id,
            verdict: analysis.verdict,
            confidence: analysis.confidence,
            threats: analysis.threats,
            vulnerabilities: analysis.vulnerabilities,
            details: content,
            recommendations: analysis.recommendations,
            metadata: {
                provider: 'deepseek',
                model: response.model,
                latency,
                tokens: response.usage.total_tokens,
                cost: this.calculateCost(response.usage)
            }
        };
    }
    /**
     * Extract structured analysis from text response
     */
    extractAnalysis(content, analysisType) {
        const analysis = {
            verdict: 'unknown',
            confidence: 0.5,
            threats: [],
            vulnerabilities: [],
            recommendations: []
        };
        // Enhanced verdict extraction for malware focus
        const verdictPatterns = [
            { pattern: /(?:definitely|confirmed|clearly)\s+malicious/i, verdict: 'malicious', confidence: 0.95 },
            { pattern: /(?:likely|probably|appears)\s+malicious/i, verdict: 'malicious', confidence: 0.8 },
            { pattern: /(?:suspicious|potentially malicious|questionable)/i, verdict: 'suspicious', confidence: 0.7 },
            { pattern: /(?:clean|benign|safe|legitimate)/i, verdict: 'clean', confidence: 0.85 },
            { pattern: /(?:packed|obfuscated|encrypted)\s+(?:malware|binary)/i, verdict: 'suspicious', confidence: 0.75 }
        ];
        for (const { pattern, verdict, confidence } of verdictPatterns) {
            if (pattern.test(content)) {
                analysis.verdict = verdict;
                analysis.confidence = confidence;
                break;
            }
        }
        // Extract malware-specific threats
        const malwarePatterns = [
            /(?:trojan|backdoor|ransomware|worm|rootkit|keylogger|spyware|adware|bot|rat)\s*[:\s]+([^\n.]+)/gi,
            /malware\s+family[:\s]+([^\n.]+)/gi,
            /threat\s+actor[:\s]+([^\n.]+)/gi,
            /campaign[:\s]+([^\n.]+)/gi
        ];
        for (const pattern of malwarePatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                analysis.threats.push({
                    type: 'malware',
                    severity: 'high',
                    confidence: 0.8,
                    description: match[0]
                });
            }
        }
        // Extract IOCs
        const iocPatterns = {
            ip: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
            domain: /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\b/gi,
            hash: /\b[a-f0-9]{32,64}\b/gi,
            url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi
        };
        for (const [type, pattern] of Object.entries(iocPatterns)) {
            const matches = content.match(pattern) || [];
            for (const ioc of matches) {
                if (!analysis.threats.find(t => t.description?.includes(ioc))) {
                    analysis.threats.push({
                        type: 'ioc',
                        severity: 'medium',
                        confidence: 0.9,
                        description: `${type.toUpperCase()}: ${ioc}`,
                        iocs: [{ type: type, value: ioc }]
                    });
                }
            }
        }
        // Extract techniques and recommendations
        const techniqueMatches = content.match(/(?:technique|method|uses?)[:\s]+([^\n.]+)/gi) || [];
        const recMatches = content.match(/(?:recommend|suggest|should|mitigate)[:\s]+([^\n.]+)/gi) || [];
        analysis.recommendations = recMatches.map(match => match.replace(/^[^:]+:\s*/, ''));
        // Add MITRE ATT&CK mappings if found
        const mitreMatches = content.match(/T\d{4}(?:\.\d{3})?/g) || [];
        if (mitreMatches.length > 0) {
            analysis.mitreTactics = mitreMatches;
        }
        return analysis;
    }
    /**
     * Helper methods
     */
    getCacheKey(request) {
        const content = typeof request.content === 'string'
            ? request.content
            : this.hashContent(request.content);
        return `deepseek:${request.analysisType}:${content.substring(0, 32)}`;
    }
    encodeContent(content) {
        // For binary analysis, encode as hex string
        const bytes = new Uint8Array(content);
        let hex = '';
        for (let i = 0; i < Math.min(bytes.length, 1024); i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
        }
        if (bytes.length > 1024) {
            hex += '... (truncated)';
        }
        return hex;
    }
    hashContent(content) {
        // Simple hash for cache key
        const bytes = new Uint8Array(content);
        let hash = 0;
        for (let i = 0; i < bytes.length; i++) {
            hash = ((hash << 5) - hash) + bytes[i];
            hash = hash & hash;
        }
        return hash.toString(36);
    }
    calculateCost(usage) {
        // DeepSeek pricing (much lower than competitors)
        const inputCost = 0.001 / 1000; // $1 per million tokens
        const outputCost = 0.002 / 1000; // $2 per million tokens
        return (usage.prompt_tokens * inputCost) + (usage.completion_tokens * outputCost);
    }
    isRetryable(error) {
        // Retry on rate limits and temporary errors
        return error.status === 429 || error.status >= 500;
    }
}
exports.DeepSeekProvider = DeepSeekProvider;
