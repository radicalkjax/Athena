/**
 * AI Provider Orchestration Service
 * Manages coordination between Claude, DeepSeek, and OpenAI for optimal analysis
 */

import { AIProvider, AnalysisRequest, AnalysisResult, ProviderConfig } from './types';
import { ClaudeProvider } from './providers/claude';
import { DeepSeekProvider } from './providers/deepseek';
import { OpenAIProvider } from './providers/openai';
import { logger } from '../../utils/logger';
import { wasmPreprocessor, PreprocessingResult } from './preprocessing/wasmPipeline';

export interface OrchestrationStrategy {
  type: 'single' | 'ensemble' | 'sequential' | 'specialized';
  providers?: string[];
  consensusThreshold?: number;
  timeout?: number;
}

export interface ProviderCapabilities {
  strengths: string[];
  weaknesses: string[];
  costPerToken: number;
  averageLatency: number;
  contextWindow: number;
}

export class AIOrchestrator {
  private providers: Map<string, AIProvider> = new Map();
  private capabilities: Map<string, ProviderCapabilities> = new Map();
  private loadBalancer: LoadBalancer;
  private preprocessingEnabled: boolean = true;

  constructor(private config: ProviderConfig) {
    this.initializeProviders();
    this.loadBalancer = new LoadBalancer();
    
    // Initialize WASM preprocessing
    wasmPreprocessor.initialize().catch(err => {
      logger.error('Failed to initialize WASM preprocessing', { err });
      this.preprocessingEnabled = false;
    });
  }

  private initializeProviders() {
    // Initialize each provider with default configs if needed
    if (this.config.claude) {
      this.providers.set('claude', new ClaudeProvider(this.config.claude));
    }
    if (this.config.deepseek) {
      this.providers.set('deepseek', new DeepSeekProvider(this.config.deepseek));
    }
    if (this.config.openai) {
      this.providers.set('openai', new OpenAIProvider(this.config.openai));
    }

    // Define provider capabilities
    this.capabilities.set('claude', {
      strengths: ['reasoning', 'code_analysis', 'security_review', 'complex_logic'],
      weaknesses: ['cost', 'rate_limits'],
      costPerToken: 0.008,
      averageLatency: 2000,
      contextWindow: 200000
    });

    this.capabilities.set('deepseek', {
      strengths: ['malware_analysis', 'deobfuscation', 'pattern_recognition', 'speed'],
      weaknesses: ['complex_reasoning'],
      costPerToken: 0.001,
      averageLatency: 800,
      contextWindow: 32000
    });

    this.capabilities.set('openai', {
      strengths: ['general_analysis', 'report_generation', 'threat_classification'],
      weaknesses: ['specialized_security'],
      costPerToken: 0.003,
      averageLatency: 1200,
      contextWindow: 128000
    });
  }

  /**
   * Main orchestration entry point
   */
  async analyze(
    request: AnalysisRequest,
    strategy: OrchestrationStrategy = { type: 'specialized' }
  ): Promise<AnalysisResult> {
    logger.info('Starting AI orchestration', { 
      requestId: request.id, 
      strategy: strategy.type 
    });

    try {
      // Preprocess the request if enabled
      let processedRequest = request;
      if (this.preprocessingEnabled) {
        const preprocessResult = await this.preprocessRequest(request);
        if (!preprocessResult.safe) {
          // Return early with security warning
          return {
            id: request.id,
            verdict: 'malicious',
            confidence: 0.95,
            threats: preprocessResult.threats?.map(t => ({
              ...t,
              confidence: 0.9,
              severity: t.severity as 'low' | 'medium' | 'high' | 'critical'
            })) || [],
            details: 'Input blocked by security preprocessing',
            recommendations: ['Review and sanitize input before resubmitting'],
            metadata: {
              blocked: true,
              preprocessing: preprocessResult
            }
          };
        }
        
        // Use cleaned content if available
        if (preprocessResult.cleaned) {
          processedRequest = {
            ...request,
            content: preprocessResult.cleaned,
            metadata: {
              ...request.metadata,
              preprocessed: true,
              preprocessing: preprocessResult.metadata
            }
          };
        }
      }

      switch (strategy.type) {
        case 'single':
          return this.singleProviderAnalysis(processedRequest, strategy);
        
        case 'ensemble':
          return this.ensembleAnalysis(processedRequest, strategy);
        
        case 'sequential':
          return this.sequentialAnalysis(processedRequest, strategy);
        
        case 'specialized':
        default:
          return this.specializedAnalysis(processedRequest);
      }
    } catch (error: unknown) {
      logger.error('Orchestration failed', { error, requestId: request.id });
      throw error;
    }
  }

  /**
   * Single provider analysis with fallback
   */
  private async singleProviderAnalysis(
    request: AnalysisRequest,
    strategy: OrchestrationStrategy
  ): Promise<AnalysisResult> {
    const provider = strategy.providers?.[0] || this.selectBestProvider(request);
    
    try {
      return await this.providers.get(provider)!.analyze(request);
    } catch (error: unknown) {
      // Fallback logic
      const fallbackChain = this.getFallbackChain(provider);
      
      for (const fallback of fallbackChain) {
        try {
          logger.warn(`Falling back from ${provider} to ${fallback}`);
          return await this.providers.get(fallback)!.analyze(request);
        } catch (fallbackError) {
          continue;
        }
      }
      
      throw new Error('All providers failed');
    }
  }

  /**
   * Ensemble analysis - multiple providers vote on result
   */
  private async ensembleAnalysis(
    request: AnalysisRequest,
    strategy: OrchestrationStrategy
  ): Promise<AnalysisResult> {
    const providers = strategy.providers || this.selectProvidersForEnsemble(request);
    const threshold = strategy.consensusThreshold || 0.7;
    
    // Parallel analysis
    const results = await Promise.allSettled(
      providers.map(p => 
        this.analyzeWithTimeout(
          this.providers.get(p)!,
          request,
          strategy.timeout || 10000
        )
      )
    );

    // Filter successful results
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<AnalysisResult>).value);

    if (successfulResults.length === 0) {
      throw new Error('No providers returned successful results');
    }

    // Build consensus
    return this.buildConsensus(successfulResults, threshold);
  }

  /**
   * Sequential analysis - each provider builds on previous results
   */
  private async sequentialAnalysis(
    request: AnalysisRequest,
    strategy: OrchestrationStrategy
  ): Promise<AnalysisResult> {
    const sequence = strategy.providers || this.getOptimalSequence(request);
    let accumulatedContext: any = {};

    for (const providerName of sequence) {
      const provider = this.providers.get(providerName)!;
      const enrichedRequest = {
        ...request,
        context: accumulatedContext
      };

      const result = await provider.analyze(enrichedRequest);
      
      // Accumulate context for next provider
      accumulatedContext = {
        ...accumulatedContext,
        [providerName]: result
      };
    }

    // Return combined result
    return this.combineSequentialResults(accumulatedContext);
  }

  /**
   * Specialized routing based on task type
   */
  private async specializedAnalysis(request: AnalysisRequest): Promise<AnalysisResult> {
    const taskType = this.classifyTask(request);
    
    switch (taskType) {
      case 'MALWARE_ANALYSIS':
        // DeepSeek excels at malware analysis
        return this.singleProviderAnalysis(request, { 
          type: 'single', 
          providers: ['deepseek'] 
        });
      
      case 'CODE_SECURITY_REVIEW':
        // Claude for complex code analysis
        return this.singleProviderAnalysis(request, { 
          type: 'single', 
          providers: ['claude'] 
        });
      
      case 'THREAT_INTELLIGENCE':
        // Ensemble for threat intelligence
        return this.ensembleAnalysis(request, { 
          type: 'ensemble',
          providers: ['claude', 'openai'],
          consensusThreshold: 0.8
        });
      
      case 'INCIDENT_RESPONSE':
        // Sequential: detect → analyze → report
        return this.sequentialAnalysis(request, {
          type: 'sequential',
          providers: ['deepseek', 'claude', 'openai']
        });
      
      default:
        // Default to best available provider
        return this.singleProviderAnalysis(request, { type: 'single' });
    }
  }


  /**
   * Score provider based on task match, cost, and performance
   */
  private scoreProvider(
    capabilities: ProviderCapabilities,
    required: string[],
    _request: AnalysisRequest
  ): number {
    let score = 0;
    
    // Capability match (weight: 50%)
    const capMatch = required.filter(r => 
      capabilities.strengths.includes(r)
    ).length / required.length;
    score += capMatch * 0.5;
    
    // Cost efficiency (weight: 30%)
    const costScore = 1 - (capabilities.costPerToken / 0.01); // Normalize to 0-1
    score += Math.max(0, costScore) * 0.3;
    
    // Latency (weight: 20%)
    const latencyScore = 1 - (capabilities.averageLatency / 5000); // Normalize to 0-1
    score += Math.max(0, latencyScore) * 0.2;
    
    // Boost for load balancing
    const loadBoost = this.loadBalancer.getLoadScore(capabilities.strengths[0]);
    score *= (1 + loadBoost);
    
    return score;
  }

  /**
   * Build consensus from multiple results
   */
  private buildConsensus(
    results: AnalysisResult[],
    threshold: number
  ): AnalysisResult {
    // Group results by verdict
    const verdictGroups = new Map<string, AnalysisResult[]>();
    
    for (const result of results) {
      const verdict = result.verdict || 'unknown';
      if (!verdictGroups.has(verdict)) {
        verdictGroups.set(verdict, []);
      }
      verdictGroups.get(verdict)!.push(result);
    }
    
    // Find majority verdict
    let maxCount = 0;
    let consensusVerdict = 'unknown';
    let consensusResults: AnalysisResult[] = [];
    
    for (const [verdict, group] of Array.from(verdictGroups.entries())) {
      if (group.length > maxCount) {
        maxCount = group.length;
        consensusVerdict = verdict;
        consensusResults = group;
      }
    }
    
    const consensusRatio = maxCount / results.length;
    
    if (consensusRatio < threshold) {
      logger.warn('Consensus below threshold', { 
        ratio: consensusRatio, 
        threshold 
      });
    }
    
    // Merge results from consensus group
    return this.mergeResults(consensusResults, {
      consensusConfidence: consensusRatio,
      totalProviders: results.length,
      agreementCount: maxCount
    });
  }

  /**
   * Preprocess request using WASM security pipeline
   */
  private async preprocessRequest(request: AnalysisRequest): Promise<PreprocessingResult> {
    try {
      return await wasmPreprocessor.preprocess(request);
    } catch (error: unknown) {
      logger.error('Preprocessing failed, continuing without', { error: error instanceof Error ? error.message : String(error) });
      // Return safe result to continue processing
      return {
        safe: true,
        warnings: ['Preprocessing failed, continuing without security checks']
      };
    }
  }

  /**
   * Classify analysis task type
   */
  private classifyTask(request: AnalysisRequest): string {
    // Check for explicit type
    if (request.analysisType) {
      return request.analysisType;
    }
    
    // Infer from content and metadata
    const content = typeof request.content === 'string' 
      ? request.content.toLowerCase() 
      : '';
    const fileType = request.metadata?.fileType;
    
    if (content.includes('malware') || fileType?.includes('exe')) {
      return 'MALWARE_ANALYSIS';
    }
    
    if (content.includes('vulnerability') || content.includes('security')) {
      return 'CODE_SECURITY_REVIEW';
    }
    
    if (content.includes('threat') || content.includes('ioc')) {
      return 'THREAT_INTELLIGENCE';
    }
    
    if (content.includes('incident') || content.includes('breach')) {
      return 'INCIDENT_RESPONSE';
    }
    
    return 'GENERAL_ANALYSIS';
  }

  /**
   * Helper methods
   */
  private async analyzeWithTimeout(
    provider: AIProvider,
    request: AnalysisRequest,
    timeout: number
  ): Promise<AnalysisResult> {
    return Promise.race([
      provider.analyze(request),
      new Promise<AnalysisResult>((_, reject) => 
        setTimeout(() => reject(new Error('Analysis timeout')), timeout)
      )
    ]);
  }

  private getFallbackChain(primary: string): string[] {
    const chains: Record<string, string[]> = {
      claude: ['openai', 'deepseek'],
      deepseek: ['claude', 'openai'],
      openai: ['claude', 'deepseek']
    };
    
    return chains[primary] || [];
  }

  private getRequiredCapabilities(taskType: string): string[] {
    const requirements: Record<string, string[]> = {
      MALWARE_ANALYSIS: ['malware_analysis', 'deobfuscation', 'pattern_recognition'],
      CODE_SECURITY_REVIEW: ['code_analysis', 'security_review', 'reasoning'],
      THREAT_INTELLIGENCE: ['threat_classification', 'general_analysis'],
      INCIDENT_RESPONSE: ['reasoning', 'report_generation'],
      GENERAL_ANALYSIS: ['general_analysis']
    };
    
    return requirements[taskType] || requirements.GENERAL_ANALYSIS;
  }

  private selectProvidersForEnsemble(request: AnalysisRequest): string[] {
    // For critical requests, use all providers
    if (request.priority === 'critical') {
      return ['claude', 'deepseek', 'openai'];
    }
    
    // Otherwise select 2 best providers
    const taskType = this.classifyTask(request);
    const required = this.getRequiredCapabilities(taskType);
    
    const scores = Array.from(this.capabilities.entries())
      .map(([provider, caps]) => ({
        provider,
        score: this.scoreProvider(caps, required, request)
      }))
      .sort((a, b) => b.score - a.score);
    
    return scores.slice(0, 2).map(s => s.provider);
  }

  private getOptimalSequence(request: AnalysisRequest): string[] {
    const taskType = this.classifyTask(request);
    
    const sequences: Record<string, string[]> = {
      MALWARE_ANALYSIS: ['deepseek', 'claude', 'openai'],
      CODE_SECURITY_REVIEW: ['claude', 'deepseek', 'openai'],
      THREAT_INTELLIGENCE: ['openai', 'claude', 'deepseek'],
      INCIDENT_RESPONSE: ['deepseek', 'claude', 'openai']
    };
    
    return sequences[taskType] || ['claude', 'openai', 'deepseek'];
  }

  /**
   * Get status of all providers
   */
  public async getProviderStatus(): Promise<Map<string, any>> {
    const status = new Map<string, any>();
    
    for (const [name, provider] of this.providers) {
      try {
        const providerStatus = await provider.getStatus();
        status.set(name, providerStatus);
      } catch (error: unknown) {
        status.set(name, {
          available: false,
          healthy: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    return status;
  }

  /**
   * Get list of available providers
   */
  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Select best provider for request (was private, now public)
   */
  public selectBestProvider(request: AnalysisRequest): string {
    const taskType = this.classifyTask(request);
    const required = this.getRequiredCapabilities(taskType);
    
    let bestProvider = 'claude'; // default
    let bestScore = -1;
    
    for (const [provider, caps] of Array.from(this.capabilities.entries())) {
      const score = this.scoreProvider(caps, required, request);
      
      if (score > bestScore) {
        bestScore = score;
        bestProvider = provider;
      }
    }
    
    logger.info('Selected provider', { 
      provider: bestProvider, 
      score: bestScore, 
      taskType 
    });
    
    return bestProvider;
  }

  private mergeResults(
    results: AnalysisResult[],
    metadata: any
  ): AnalysisResult {
    // Implement result merging logic
    const merged: AnalysisResult = {
      id: results[0].id,
      verdict: results[0].verdict,
      confidence: results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length,
      threats: Array.from(new Set(results.flatMap(r => r.threats || []))),
      details: results.map(r => r.details).filter(Boolean).join('\n\n'),
      metadata: {
        ...metadata,
        providers: results.map(r => r.metadata?.provider).filter(Boolean)
      }
    };
    
    return merged;
  }

  private combineSequentialResults(results: any): AnalysisResult {
    // Combine results from sequential analysis
    return {
      id: Date.now().toString(),
      verdict: results.claude?.verdict || results.openai?.verdict || 'unknown',
      confidence: 0.9, // High confidence from sequential analysis
      threats: Object.values(results).flatMap((r: any) => r.threats || []),
      details: JSON.stringify(results, null, 2),
      metadata: {
        strategy: 'sequential',
        providers: Object.keys(results)
      }
    };
  }
}

/**
 * Simple load balancer for provider selection
 */
class LoadBalancer {
  private loads = new Map<string, number>();
  
  getLoadScore(provider: string): number {
    const currentLoad = this.loads.get(provider) || 0;
    const avgLoad = Array.from(this.loads.values()).reduce((a, b) => a + b, 0) / 
      (this.loads.size || 1);
    
    // Return boost if below average load
    return currentLoad < avgLoad ? 0.1 : 0;
  }
  
  recordRequest(provider: string) {
    this.loads.set(provider, (this.loads.get(provider) || 0) + 1);
  }
  
  recordCompletion(provider: string) {
    this.loads.set(provider, Math.max(0, (this.loads.get(provider) || 0) - 1));
  }
}