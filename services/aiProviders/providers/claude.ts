/**
 * Claude AI Provider Implementation
 * Integrates with Anthropic's Claude API for advanced analysis
 */

import { 
  AIProvider, 
  AnalysisRequest, 
  AnalysisResult, 
  AICapabilities,
  ProviderStatus,
  AIProviderError 
} from '../types';
import { logger } from '../../../utils/logger';
import { RateLimiter } from '../utils/rateLimiter';
import { ResponseCache } from '../utils/cache';

interface ClaudeConfig {
  apiKey: string;
  endpoint?: string;
  model?: string;
  maxRetries?: number;
  timeout?: number;
  anthropicVersion?: string;
  anthropicBeta?: string;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  id: string;
  model: string;
  role: 'assistant';
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeProvider implements AIProvider {
  public readonly name = 'claude';
  private config: ClaudeConfig;
  private rateLimiter: RateLimiter;
  private cache: ResponseCache;
  private apiEndpoint: string;
  
  constructor(config: ClaudeConfig) {
    this.config = {
      endpoint: 'https://api.anthropic.com/v1',
      model: 'claude-3-opus-20240229',
      maxRetries: 3,
      timeout: 30000,
      anthropicVersion: '2023-06-01',
      anthropicBeta: 'messages-2023-12-15',
      ...config
    };
    
    this.apiEndpoint = `${this.config.endpoint}/messages`;
    
    // Initialize rate limiter (Claude has 60 RPM limit)
    this.rateLimiter = new RateLimiter({
      requestsPerMinute: 60,
      tokensPerMinute: 100000
    });
    
    // Initialize cache
    this.cache = new ResponseCache({
      ttl: 300000, // 5 minutes
      maxSize: 100
    });
  }
  
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(request);
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        logger.debug('Claude cache hit', { requestId: request.id });
        return cached;
      }
      
      // Check rate limits
      await this.rateLimiter.checkLimit();
      
      // Prepare the prompt
      const prompt = this.buildPrompt(request);
      
      // Make API call
      const startTime = Date.now();
      const response = await this.callClaudeAPI(prompt, request.options);
      const latency = Date.now() - startTime;
      
      // Parse response
      const result = this.parseResponse(response, request, latency);
      
      // Cache the result
      await this.cache.set(cacheKey, result);
      
      // Update rate limiter
      this.rateLimiter.recordUsage({
        requests: 1,
        tokens: response.usage.input_tokens + response.usage.output_tokens
      });
      
      return result;
      
    } catch (error: unknown) {
      logger.error('Claude analysis failed', { 
        error, 
        requestId: request.id 
      });
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorCode = (error as any)?.code || 'UNKNOWN_ERROR';
      
      throw new AIProviderError(
        'claude',
        `Analysis failed: ${errorMessage}`,
        errorCode,
        this.isRetryable(error)
      );
    }
  }
  
  async *stream(request: AnalysisRequest) {
    // Claude streaming implementation
    const prompt = this.buildPrompt(request);
    const streamResponse = await this.callClaudeAPIStream(prompt, request.options);
    
    for await (const chunk of streamResponse) {
      yield {
        id: request.id,
        type: 'partial' as const,
        content: chunk.delta?.text || '',
        metadata: { provider: 'claude' }
      };
    }
  }
  
  getCapabilities(): AICapabilities {
    return {
      models: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307'
      ],
      features: [
        'code_analysis',
        'security_review',
        'threat_modeling',
        'reasoning',
        'long_context'
      ],
      maxTokens: 200000,
      supportedFormats: ['text', 'code', 'json', 'markdown'],
      specializations: [
        'complex_reasoning',
        'code_security',
        'architecture_review'
      ],
      streaming: true
    };
  }
  
  async getStatus(): Promise<ProviderStatus> {
    try {
      // Simple health check
      const testPrompt = 'Respond with "OK"';
      const response = await this.callClaudeAPI(testPrompt, { maxTokens: 10 });
      
      return {
        available: true,
        healthy: true,
        latency: 100, // Would measure actual latency
        rateLimit: {
          remaining: this.rateLimiter.getRemaining(),
          reset: this.rateLimiter.getResetTime()
        }
      };
    } catch (error: unknown) {
      return {
        available: false,
        healthy: false,
        errors: [error instanceof Error ? error.message : "Unknown error"]
      };
    }
  }
  
  async validateConfig(): Promise<boolean> {
    try {
      if (!this.config.apiKey) {
        throw new Error('API key is required');
      }
      
      // Test the API key
      await this.getStatus();
      return true;
    } catch (error: unknown) {
      logger.error('Claude config validation failed', { error: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }
  
  /**
   * Build analysis prompt based on request type
   */
  private buildPrompt(request: AnalysisRequest): string {
    const analysisType = request.analysisType || 'GENERAL_ANALYSIS';
    const content = typeof request.content === 'string' 
      ? request.content 
      : this.encodeContent(request.content);
    
    const prompts: Record<string, string> = {
      MALWARE_ANALYSIS: `Analyze the following code/binary for malware indicators:
        - Identify malicious behaviors
        - Detect obfuscation techniques
        - Find IOCs (IPs, domains, hashes)
        - Classify malware family if possible
        - Rate severity (low/medium/high/critical)
        
        Content: ${content}`,
        
      CODE_SECURITY_REVIEW: `Perform a security review of the following code:
        - Identify vulnerabilities (OWASP Top 10, CWE)
        - Find insecure coding patterns
        - Detect potential exploits
        - Suggest secure alternatives
        - Rate risk level for each finding
        
        Code: ${content}`,
        
      THREAT_INTELLIGENCE: `Analyze the following for threat intelligence:
        - Extract threat actors and TTPs
        - Map to MITRE ATT&CK framework
        - Identify indicators of compromise
        - Assess threat severity
        - Provide attribution if possible
        
        Data: ${content}`,
        
      BEHAVIORAL_ANALYSIS: `Analyze the behavioral patterns in the following:
        - Identify suspicious activities
        - Detect anomalies from baseline
        - Map behavior to known attack patterns
        - Assess intent (malicious/benign)
        - Provide confidence score
        
        Trace: ${content}`,
        
      GENERAL_ANALYSIS: `Perform a comprehensive security analysis of the following:
        ${content}`
    };
    
    const systemPrompt = `You are a cybersecurity expert AI assistant integrated into the Athena security platform. 
    Provide detailed, accurate analysis focusing on security implications. 
    Format your response as structured data when possible.`;
    
    const userPrompt = prompts[analysisType] || prompts.GENERAL_ANALYSIS;
    
    // Add context if provided
    if (request.context) {
      return `${systemPrompt}\n\nContext from previous analysis:\n${JSON.stringify(request.context)}\n\n${userPrompt}`;
    }
    
    return `${systemPrompt}\n\n${userPrompt}`;
  }
  
  /**
   * Call Claude API
   */
  private async callClaudeAPI(
    prompt: string, 
    options?: any
  ): Promise<ClaudeResponse> {
    const body = {
      model: options?.model || this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.3,
      system: "You are a cybersecurity expert AI assistant."
    };
    
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.anthropicVersion!,
        'anthropic-beta': this.config.anthropicBeta!
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.config.timeout!)
    });
    
    if (!response.ok) {
      const error = await response.json() as any;
      throw new Error(error.error?.message || `API error: ${response.status}`);
    }
    
    return response.json() as Promise<ClaudeResponse>;
  }
  
  /**
   * Stream API call
   */
  private async *callClaudeAPIStream(
    prompt: string,
    options?: any
  ): AsyncGenerator<any> {
    const body = {
      model: options?.model || this.config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature || 0.3,
      stream: true
    };
    
    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.anthropicVersion!,
        'anthropic-beta': this.config.anthropicBeta!
      },
      body: JSON.stringify(body)
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data !== '[DONE]') {
            yield JSON.parse(data);
          }
        }
      }
    }
  }
  
  /**
   * Parse Claude response into standard format
   */
  private parseResponse(
    response: ClaudeResponse,
    request: AnalysisRequest,
    latency: number
  ): AnalysisResult {
    const content = response.content[0]?.text || '';
    
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
        provider: 'claude',
        model: response.model,
        latency,
        tokens: response.usage.input_tokens + response.usage.output_tokens,
        cost: this.calculateCost(response.usage)
      }
    };
  }
  
  /**
   * Extract structured analysis from text response
   */
  private extractAnalysis(content: string, analysisType?: string) {
    // This would use more sophisticated parsing in production
    // For now, use regex and heuristics
    
    const analysis: any = {
      verdict: 'unknown',
      confidence: 0.5,
      threats: [],
      vulnerabilities: [],
      recommendations: []
    };
    
    // Verdict extraction
    if (content.toLowerCase().includes('malicious')) {
      analysis.verdict = 'malicious';
      analysis.confidence = 0.9;
    } else if (content.toLowerCase().includes('suspicious')) {
      analysis.verdict = 'suspicious';
      analysis.confidence = 0.7;
    } else if (content.toLowerCase().includes('clean') || content.toLowerCase().includes('safe')) {
      analysis.verdict = 'clean';
      analysis.confidence = 0.8;
    }
    
    // Extract threats (simple pattern matching)
    const threatMatches = content.match(/threat[:\s]+([^\n.]+)/gi) || [];
    analysis.threats = threatMatches.map(match => ({
      type: 'generic',
      severity: 'medium',
      confidence: 0.7,
      description: match
    }));
    
    // Extract vulnerabilities
    const vulnMatches = content.match(/(?:vulnerability|vuln|cve|cwe)[:\s]+([^\n.]+)/gi) || [];
    analysis.vulnerabilities = vulnMatches.map(match => ({
      severity: 'medium',
      description: match
    }));
    
    // Extract recommendations
    const recMatches = content.match(/(?:recommend|suggest|should)[:\s]+([^\n.]+)/gi) || [];
    analysis.recommendations = recMatches.map(match => match);
    
    return analysis;
  }
  
  /**
   * Helper methods
   */
  private getCacheKey(request: AnalysisRequest): string {
    const content = typeof request.content === 'string' 
      ? request.content 
      : this.hashContent(request.content);
    
    return `claude:${request.analysisType}:${content.substring(0, 32)}`;
  }
  
  private encodeContent(content: ArrayBuffer): string {
    return Buffer.from(content).toString('base64');
  }
  
  private hashContent(content: ArrayBuffer): string {
    // Simple hash for cache key
    const bytes = new Uint8Array(content);
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = ((hash << 5) - hash) + bytes[i];
      hash = hash & hash;
    }
    return hash.toString(36);
  }
  
  private calculateCost(usage: { input_tokens: number; output_tokens: number }): number {
    // Claude pricing (as of 2024)
    const inputCost = 0.008 / 1000; // $8 per million tokens
    const outputCost = 0.024 / 1000; // $24 per million tokens
    
    return (usage.input_tokens * inputCost) + (usage.output_tokens * outputCost);
  }
  
  private isRetryable(error: any): boolean {
    // Retry on rate limits and temporary errors
    return error.status === 429 || error.status >= 500;
  }
}