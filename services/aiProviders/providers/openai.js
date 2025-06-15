"use strict";
/**
 * OpenAI Provider Implementation
 * General-purpose analysis and report generation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const types_1 = require("../types");
const logger_1 = require("../../../utils/logger");
const rateLimiter_1 = require("../utils/rateLimiter");
const cache_1 = require("../utils/cache");
class OpenAIProvider {
    constructor(config) {
        this.name = 'openai';
        this.config = {
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-4-turbo-preview',
            maxRetries: 3,
            timeout: 30000,
            ...config
        };
        this.apiEndpoint = `${this.config.endpoint}/chat/completions`;
        // Initialize rate limiter (OpenAI has tier-based limits)
        this.rateLimiter = new rateLimiter_1.RateLimiter({
            requestsPerMinute: 500, // Tier 3 default
            tokensPerMinute: 150000
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
                logger_1.logger.debug('OpenAI cache hit', { requestId: request.id });
                return cached;
            }
            // Check rate limits
            await this.rateLimiter.checkLimit();
            // Prepare the messages and functions
            const { messages, functions } = this.buildRequest(request);
            // Make API call
            const startTime = Date.now();
            const response = await this.callOpenAIAPI(messages, functions, request.options);
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
            logger_1.logger.error('OpenAI analysis failed', {
                error,
                requestId: request.id
            });
            throw new types_1.AIProviderError('openai', `Analysis failed: ${error.message}`, error.code, this.isRetryable(error));
        }
    }
    async *stream(request) {
        // OpenAI streaming implementation
        const { messages } = this.buildRequest(request);
        const streamResponse = await this.callOpenAIAPIStream(messages, request.options);
        for await (const chunk of streamResponse) {
            if (chunk.choices?.[0]?.delta?.content) {
                yield {
                    id: request.id,
                    type: 'partial',
                    content: chunk.choices[0].delta.content,
                    metadata: { provider: 'openai' }
                };
            }
        }
    }
    getCapabilities() {
        return {
            models: [
                'gpt-4-turbo-preview',
                'gpt-4',
                'gpt-3.5-turbo'
            ],
            features: [
                'general_analysis',
                'report_generation',
                'threat_classification',
                'incident_response',
                'documentation'
            ],
            maxTokens: 128000,
            supportedFormats: ['text', 'code', 'json', 'markdown', 'structured'],
            specializations: [
                'comprehensive_reports',
                'threat_intelligence',
                'security_documentation'
            ],
            streaming: true
        };
    }
    async getStatus() {
        try {
            // Simple health check
            const testMessages = [
                { role: 'user', content: 'Say OK' }
            ];
            const response = await this.callOpenAIAPI(testMessages, undefined, {
                maxTokens: 10,
                model: 'gpt-3.5-turbo' // Use cheaper model for health check
            });
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
            logger_1.logger.error('OpenAI config validation failed', { error });
            return false;
        }
    }
    /**
     * Build messages and functions for OpenAI based on request type
     */
    buildRequest(request) {
        const analysisType = request.analysisType || 'GENERAL_ANALYSIS';
        const content = typeof request.content === 'string'
            ? request.content
            : this.encodeContent(request.content);
        const systemPrompts = {
            GENERAL_ANALYSIS: `You are a comprehensive security analyst AI integrated into the Athena platform.
        Your role is to provide detailed, actionable security analysis and generate professional reports.
        Focus on clarity, accuracy, and providing practical recommendations.`,
            THREAT_INTELLIGENCE: `You are a threat intelligence analyst specializing in:
        - Threat actor profiling and attribution
        - Campaign analysis and correlation
        - Strategic threat assessment
        - Geopolitical context
        - Industry-specific threats
        Provide comprehensive intelligence reports with actionable insights.`,
            INCIDENT_RESPONSE: `You are an incident response specialist focused on:
        - Incident classification and severity assessment
        - Response plan generation
        - Containment and remediation strategies
        - Recovery procedures
        - Lessons learned documentation
        Provide step-by-step incident response guidance.`,
            SECURITY_DOCUMENTATION: `You are a technical documentation expert for security:
        - Create clear, comprehensive security documentation
        - Generate runbooks and playbooks
        - Develop security policies and procedures
        - Write technical reports for various audiences
        - Ensure compliance with standards`
        };
        const userPrompts = {
            GENERAL_ANALYSIS: `Analyze the following and provide a comprehensive security assessment:
        1. Executive Summary
        2. Detailed Technical Analysis
        3. Risk Assessment (with CVSS scores where applicable)
        4. Threat Indicators and IOCs
        5. Mitigation Recommendations
        6. Strategic Recommendations
        
        Content: ${content}`,
            THREAT_INTELLIGENCE: `Generate a threat intelligence report for:
        1. Threat Overview and Classification
        2. Threat Actor Profile (if applicable)
        3. Attack Vector Analysis
        4. Target Profile and Impact Assessment
        5. Indicators of Compromise (IOCs)
        6. Detection and Hunting Queries
        7. Strategic Recommendations
        
        Data: ${content}`,
            INCIDENT_RESPONSE: `Create an incident response plan for:
        1. Incident Classification and Severity
        2. Initial Response Steps
        3. Containment Strategies
        4. Eradication Procedures
        5. Recovery Plan
        6. Post-Incident Activities
        7. Lessons Learned
        
        Incident Details: ${content}`,
            SECURITY_DOCUMENTATION: `Create security documentation for:
        1. Overview and Purpose
        2. Scope and Applicability
        3. Technical Details
        4. Implementation Guide
        5. Best Practices
        6. Compliance Considerations
        7. Maintenance and Updates
        
        Topic: ${content}`
        };
        const systemPrompt = systemPrompts[analysisType] || systemPrompts.GENERAL_ANALYSIS;
        const userPrompt = userPrompts[analysisType] || userPrompts.GENERAL_ANALYSIS;
        const messages = [
            { role: 'system', content: systemPrompt }
        ];
        // Add context if provided
        if (request.context) {
            messages.push({
                role: 'assistant',
                content: `Context from previous analysis: ${JSON.stringify(request.context)}`
            });
        }
        messages.push({ role: 'user', content: userPrompt });
        // Define functions for structured output
        const functions = [
            {
                name: 'generate_security_report',
                description: 'Generate a structured security analysis report',
                parameters: {
                    type: 'object',
                    properties: {
                        verdict: {
                            type: 'string',
                            enum: ['malicious', 'suspicious', 'clean', 'unknown'],
                            description: 'Overall security verdict'
                        },
                        confidence: {
                            type: 'number',
                            minimum: 0,
                            maximum: 1,
                            description: 'Confidence score for the verdict'
                        },
                        severity: {
                            type: 'string',
                            enum: ['low', 'medium', 'high', 'critical'],
                            description: 'Severity level of findings'
                        },
                        threats: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string' },
                                    description: { type: 'string' },
                                    severity: { type: 'string' },
                                    mitre_tactics: { type: 'array', items: { type: 'string' } }
                                }
                            }
                        },
                        vulnerabilities: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    cve: { type: 'string' },
                                    cwe: { type: 'string' },
                                    description: { type: 'string' },
                                    severity: { type: 'string' },
                                    cvss_score: { type: 'number' }
                                }
                            }
                        },
                        iocs: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    type: { type: 'string' },
                                    value: { type: 'string' },
                                    context: { type: 'string' }
                                }
                            }
                        },
                        recommendations: {
                            type: 'array',
                            items: { type: 'string' }
                        },
                        executive_summary: { type: 'string' },
                        technical_details: { type: 'string' }
                    },
                    required: ['verdict', 'confidence', 'severity']
                }
            }
        ];
        return { messages, functions };
    }
    /**
     * Call OpenAI API
     */
    async callOpenAIAPI(messages, functions, options) {
        const body = {
            model: options?.model || this.config.model,
            messages,
            max_tokens: options?.maxTokens || 4096,
            temperature: options?.temperature || 0.5, // Balanced for analysis
            top_p: options?.topP || 1,
            frequency_penalty: 0,
            presence_penalty: 0
        };
        // Add functions if provided
        if (functions && functions.length > 0) {
            body.functions = functions;
            body.function_call = 'auto';
        }
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
        if (this.config.organization) {
            headers['OpenAI-Organization'] = this.config.organization;
        }
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers,
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
    async *callOpenAIAPIStream(messages, options) {
        const body = {
            model: options?.model || this.config.model,
            messages,
            max_tokens: options?.maxTokens || 4096,
            temperature: options?.temperature || 0.5,
            stream: true
        };
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`
        };
        if (this.config.organization) {
            headers['OpenAI-Organization'] = this.config.organization;
        }
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers,
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
     * Parse OpenAI response into standard format
     */
    parseResponse(response, request, latency) {
        const message = response.choices[0]?.message;
        // Check if function was called
        if (message?.function_call) {
            try {
                const functionResult = JSON.parse(message.function_call.arguments);
                return {
                    id: request.id,
                    verdict: functionResult.verdict,
                    confidence: functionResult.confidence,
                    threats: functionResult.threats,
                    vulnerabilities: functionResult.vulnerabilities,
                    details: functionResult.technical_details || functionResult.executive_summary,
                    recommendations: functionResult.recommendations,
                    metadata: {
                        provider: 'openai',
                        model: response.model,
                        latency,
                        tokens: response.usage.total_tokens,
                        cost: this.calculateCost(response.usage),
                        executiveSummary: functionResult.executive_summary,
                        iocs: functionResult.iocs
                    }
                };
            }
            catch (e) {
                // Fall back to text parsing
            }
        }
        // Parse text response
        const content = message?.content || '';
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
                provider: 'openai',
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
        // Verdict extraction with more nuanced patterns
        if (/(?:high risk|critical|severe|malicious)/i.test(content)) {
            analysis.verdict = 'malicious';
            analysis.confidence = 0.9;
        }
        else if (/(?:medium risk|suspicious|potential threat|concerning)/i.test(content)) {
            analysis.verdict = 'suspicious';
            analysis.confidence = 0.7;
        }
        else if (/(?:low risk|minimal threat|appears safe|no significant)/i.test(content)) {
            analysis.verdict = 'clean';
            analysis.confidence = 0.8;
        }
        // Extract threats with context
        const threatSections = content.match(/(?:threats?|risks?|concerns?)[:\s]*([^.]+\.(?:[^.]+\.)?)/gi) || [];
        for (const section of threatSections) {
            analysis.threats.push({
                type: 'security_risk',
                severity: this.extractSeverity(section),
                confidence: 0.75,
                description: section.trim()
            });
        }
        // Extract vulnerabilities with CVE/CWE patterns
        const vulnPatterns = [
            /CVE-\d{4}-\d+/g,
            /CWE-\d+/g,
            /(?:vulnerability|vuln|weakness)[:\s]+([^\n.]+)/gi
        ];
        for (const pattern of vulnPatterns) {
            const matches = content.match(pattern) || [];
            for (const match of matches) {
                const vuln = {
                    severity: this.extractSeverity(match),
                    description: match
                };
                if (match.startsWith('CVE-'))
                    vuln.cve = match;
                if (match.startsWith('CWE-'))
                    vuln.cwe = match;
                analysis.vulnerabilities.push(vuln);
            }
        }
        // Extract recommendations
        const recPatterns = [
            /(?:recommend|suggest|should|action item)[:\s]+([^\n.]+)/gi,
            /(?:mitigation|remediation)[:\s]+([^\n.]+)/gi,
            /\d+\.\s*([^:\n]+(?:should|must|need to)[^.\n]+)/gi
        ];
        for (const pattern of recPatterns) {
            const matches = content.match(pattern) || [];
            for (const match of matches) {
                const cleaned = match.replace(/^\d+\.\s*/, '').replace(/^[^:]+:\s*/, '');
                if (!analysis.recommendations.includes(cleaned)) {
                    analysis.recommendations.push(cleaned);
                }
            }
        }
        return analysis;
    }
    /**
     * Helper methods
     */
    extractSeverity(text) {
        const lower = text.toLowerCase();
        if (lower.includes('critical') || lower.includes('severe'))
            return 'critical';
        if (lower.includes('high'))
            return 'high';
        if (lower.includes('medium') || lower.includes('moderate'))
            return 'medium';
        return 'low';
    }
    getCacheKey(request) {
        const content = typeof request.content === 'string'
            ? request.content
            : this.hashContent(request.content);
        return `openai:${request.analysisType}:${content.substring(0, 32)}`;
    }
    encodeContent(content) {
        return Buffer.from(content).toString('base64');
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
        // OpenAI pricing (GPT-4 Turbo as of 2024)
        const inputCost = 0.01 / 1000; // $10 per million tokens
        const outputCost = 0.03 / 1000; // $30 per million tokens
        // Adjust for different models
        if (this.config.model?.includes('gpt-3.5')) {
            return (usage.prompt_tokens * 0.0005 / 1000) + (usage.completion_tokens * 0.0015 / 1000);
        }
        return (usage.prompt_tokens * inputCost) + (usage.completion_tokens * outputCost);
    }
    isRetryable(error) {
        // Retry on rate limits and temporary errors
        return error.status === 429 || error.status >= 500;
    }
}
exports.OpenAIProvider = OpenAIProvider;
