import { invokeCommand } from '../utils/tauriCompat';
import type { AIProvider, AIProviderConfig, AIAnalysisRequest, AIAnalysisResult } from '../types/ai';
import { CacheWithTTL, BatchProcessor } from '../utils/performance';

class AIService {
  private providers: Map<AIProvider, AIProviderConfig> = new Map();
  private activeRequests: Map<string, AbortController> = new Map();
  private requestCache = new CacheWithTTL<string, AIAnalysisResult>(10 * 60 * 1000); // 10 min cache
  private batchProcessor: BatchProcessor<AIAnalysisRequest>;
  private requestQueue: Map<string, (result: AIAnalysisResult) => void> = new Map();

  constructor() {
    this.initializeProviders();
    
    // Initialize batch processor for AI requests
    this.batchProcessor = new BatchProcessor(async (requests) => {
      // Process multiple requests in parallel
      const promises = requests.map(async (request) => {
        try {
          const result = await this.processSingleRequest(request);
          const callback = this.requestQueue.get((request as any).analysisId);
          if (callback) {
            callback(result);
            this.requestQueue.delete((request as any).analysisId);
          }
        } catch (error) {
          console.error('Batch processing error:', error);
        }
      });
      
      await Promise.all(promises);
    }, { batchSize: 5, delay: 200 });
  }

  private initializeProviders() {
    const defaultProviders: AIProviderConfig[] = [
      {
        id: 'claude',
        name: 'Claude 3',
        enabled: true,
        model: 'claude-3-opus-20240229',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'gpt4',
        name: 'GPT-4',
        enabled: true,
        model: 'gpt-4-turbo-preview',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'deepseek',
        name: 'DeepSeek',
        enabled: true,
        model: 'deepseek-coder',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'gemini',
        name: 'Gemini Pro',
        enabled: true,
        model: 'gemini-pro',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'mistral',
        name: 'Mistral',
        enabled: true,
        model: 'mistral-large-latest',
        maxTokens: 4000,
        temperature: 0.2
      },
      {
        id: 'llama',
        name: 'Llama 3',
        enabled: true,
        model: 'llama-3-70b',
        maxTokens: 4000,
        temperature: 0.2
      }
    ];

    defaultProviders.forEach(provider => {
      this.providers.set(provider.id, provider);
    });
  }

  async analyzeWithProvider(
    provider: AIProvider, 
    request: AIAnalysisRequest
  ): Promise<AIAnalysisResult> {
    // Check cache first
    const cacheKey = `${provider}-${request.fileHash}-${request.analysisType || 'comprehensive'}`;
    const cachedResult = this.requestCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const config = this.providers.get(provider);
    if (!config || !config.enabled) {
      throw new Error(`Provider ${provider} is not available or enabled`);
    }

    const requestId = `${provider}-${request.fileHash}-${Date.now()}`;
    const abortController = new AbortController();
    this.activeRequests.set(requestId, abortController);

    try {
      // Convert provider config for backend
      const backendConfig = {
        provider: config.id,
        model: config.model,
        api_key: '', // Will be loaded from secure storage in backend
        max_tokens: config.maxTokens,
        temperature: config.temperature
      };

      const result = await invokeCommand('analyze_with_ai', {
        provider: provider,
        config: backendConfig,
        request: {
          file_hash: request.fileHash,
          file_path: request.filePath,
          file_type: request.fileType,
          analysis_type: request.analysisType || 'comprehensive',
          content: request.content
        }
      });

      const finalResult = {
        ...result,
        provider,
        timestamp: Date.now()
      };
      
      // Cache the result
      this.requestCache.set(cacheKey, finalResult);

      return finalResult;
    } catch (error) {
      // Propagate error to UI - no mock data in production
      console.error(`AI analysis failed for ${provider}:`, error);
      throw error;
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  private async processSingleRequest(request: AIAnalysisRequest & { analysisId?: string }): Promise<AIAnalysisResult> {
    // Use the first available provider or the one specified in the request
    const availableProviders = Array.from(this.providers.entries())
      .filter(([_, config]) => config.enabled)
      .map(([provider]) => provider);

    if (availableProviders.length === 0) {
      throw new Error('No AI providers available');
    }

    const provider = availableProviders[0];
    if (!provider) {
      throw new Error('No AI providers available');
    }
    return this.analyzeWithProvider(provider, request);
  }

  // Mock fallback removed - zero tolerance for incomplete/mock data in production

  async analyzeWithMultipleProviders(
    request: AIAnalysisRequest
  ): Promise<AIAnalysisResult[]> {
    const enabledProviders = request.providers.filter(p => {
      const config = this.providers.get(p);
      return config && config.enabled;
    });

    const analysisPromises = enabledProviders.map(provider =>
      this.analyzeWithProvider(provider, request)
        .catch(error => ({
          provider,
          timestamp: Date.now(),
          confidence: 0,
          threatLevel: 'safe' as const,
          signatures: [],
          behaviors: [],
          iocs: {
            domains: [],
            ips: [],
            files: [],
            registry: [],
            processes: []
          },
          recommendations: [],
          error: error.message
        }))
    );

    return Promise.all(analysisPromises);
  }

  async analyzeWithMultipleProvidersWithProgress(
    request: AIAnalysisRequest,
    progressCallback?: (provider: string, progress: number) => void
  ): Promise<AIAnalysisResult[]> {
    const enabledProviders = request.providers.filter(p => {
      const config = this.providers.get(p);
      return config && config.enabled;
    });

    const results: AIAnalysisResult[] = [];
    const totalProviders = enabledProviders.length;

    for (let i = 0; i < enabledProviders.length; i++) {
      const provider = enabledProviders[i];
      if (!provider) continue;

      const baseProgress = (i / totalProviders) * 100;

      if (progressCallback) {
        progressCallback(provider, baseProgress);
      }

      try {
        const result = await this.analyzeWithProvider(provider, request);
        results.push(result);

        if (progressCallback) {
          progressCallback(provider, ((i + 1) / totalProviders) * 100);
        }
      } catch (error) {
        results.push({
          provider,
          timestamp: Date.now(),
          confidence: 0,
          threatLevel: 'safe' as const,
          signatures: [],
          behaviors: [],
          iocs: {
            domains: [],
            ips: [],
            files: [],
            registry: [],
            processes: []
          },
          recommendations: [],
          error: (error as Error).message
        });
      }
    }

    return results;
  }

  cancelAnalysis(fileHash: string) {
    for (const [requestId, controller] of this.activeRequests.entries()) {
      if (requestId.includes(fileHash)) {
        controller.abort();
        this.activeRequests.delete(requestId);
      }
    }
  }

  getProviderStatus(provider: AIProvider): boolean {
    const config = this.providers.get(provider);
    return config ? config.enabled : false;
  }

  updateProviderConfig(provider: AIProvider, config: Partial<AIProviderConfig>) {
    const existing = this.providers.get(provider);
    if (existing) {
      this.providers.set(provider, { ...existing, ...config });
    }
  }

  getAllProviders(): AIProviderConfig[] {
    return Array.from(this.providers.values());
  }

  // Ensemble analysis strategies
  async analyzeWithEnsemble(
    request: AIAnalysisRequest,
    strategy: 'voting' | 'sequential' | 'specialized' | 'single-fallback' = 'voting',
    progressCallback?: (provider: string, progress: number) => void
  ): Promise<{ consensus: AIAnalysisResult; individual: AIAnalysisResult[] }> {
    switch (strategy) {
      case 'single-fallback':
        return this.singleWithFallback(request, progressCallback);
      
      case 'voting':
        return this.ensembleVoting(request, progressCallback);
      
      case 'sequential':
        return this.sequentialEnhancement(request, progressCallback);
      
      case 'specialized':
        return this.specializedRouting(request, progressCallback);
      
      default:
        return this.ensembleVoting(request, progressCallback);
    }
  }

  private async singleWithFallback(request: AIAnalysisRequest, progressCallback?: (provider: string, progress: number) => void) {
    const primaryProvider = request.providers[0] ?? 'claude';

    try {
      const result = await this.analyzeWithProvider(primaryProvider, request);
      return {
        consensus: result,
        individual: [result]
      };
    } catch (error) {
      // Try fallback providers
      for (const provider of request.providers.slice(1)) {
        try {
          const result = await this.analyzeWithProvider(provider, request);
          return {
            consensus: result,
            individual: [result]
          };
        } catch (err) {
          continue;
        }
      }
      throw new Error('All providers failed');
    }
  }

  private async ensembleVoting(request: AIAnalysisRequest, progressCallback?: (provider: string, progress: number) => void) {
    const results = await this.analyzeWithMultipleProvidersWithProgress(request, progressCallback);
    
    // Calculate consensus through weighted voting
    const threatLevelVotes = new Map<string, number>();
    const familyVotes = new Map<string, number>();
    const allSignatures = new Set<string>();
    const allBehaviors = new Set<string>();
    
    let totalConfidence = 0;
    let validResults = 0;
    
    results.forEach(result => {
      if (result.confidence > 0) {
        validResults++;
        totalConfidence += result.confidence;
        
        // Weight votes by confidence
        const weight = result.confidence;
        
        threatLevelVotes.set(
          result.threatLevel,
          (threatLevelVotes.get(result.threatLevel) || 0) + weight
        );
        
        if (result.malwareFamily) {
          familyVotes.set(
            result.malwareFamily,
            (familyVotes.get(result.malwareFamily) || 0) + weight
          );
        }
        
        result.signatures.forEach(sig => allSignatures.add(sig));
        result.behaviors.forEach(beh => allBehaviors.add(beh));
      }
    });
    
    // Determine consensus
    const consensusThreat = [...threatLevelVotes.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'safe';

    const consensusFamily = [...familyVotes.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    const consensus: AIAnalysisResult = {
      provider: 'ensemble' as AIProvider,
      timestamp: Date.now(),
      confidence: validResults > 0 ? totalConfidence / validResults : 0,
      threatLevel: consensusThreat as 'safe' | 'suspicious' | 'malicious' | 'critical',
      malwareFamily: consensusFamily,
      malwareType: results[0]?.malwareType,
      signatures: Array.from(allSignatures),
      behaviors: Array.from(allBehaviors),
      iocs: this.mergeIOCs(results),
      recommendations: this.generateRecommendations(consensusThreat as 'safe' | 'suspicious' | 'malicious' | 'critical')
    };

    return { consensus, individual: results };
  }

  private async sequentialEnhancement(request: AIAnalysisRequest, progressCallback?: (provider: string, progress: number) => void) {
    const results: AIAnalysisResult[] = [];
    let enhancedRequest = { ...request };

    for (let i = 0; i < request.providers.length; i++) {
      const provider = request.providers[i];
      if (!provider) continue;

      const progress = (i / request.providers.length) * 100;

      if (progressCallback) {
        progressCallback(provider, progress);
      }

      const result = await this.analyzeWithProvider(provider, enhancedRequest);
      results.push(result);

      if (progressCallback) {
        progressCallback(provider, ((i + 1) / request.providers.length) * 100);
      }

      // Enhance request with previous results
      enhancedRequest = {
        ...enhancedRequest,
        content: `${enhancedRequest.content}\n\nPrevious analysis:\n${JSON.stringify(result, null, 2)}`
      };
    }

    // Last result is the most enhanced
    const lastResult = results[results.length - 1];
    if (!lastResult) {
      throw new Error('No analysis results generated');
    }

    return {
      consensus: lastResult,
      individual: results
    };
  }

  private async specializedRouting(request: AIAnalysisRequest, progressCallback?: (provider: string, progress: number) => void) {
    // Route to specialized providers based on file type
    const specializations: Record<string, AIProvider[]> = {
      'pe': ['claude', 'gpt4'],
      'elf': ['deepseek', 'mistral'],
      'macho': ['gemini', 'llama'],
      'script': ['gpt4', 'claude'],
      'document': ['gemini', 'gpt4']
    };
    
    const specialized = specializations[request.fileType] || request.providers;
    const specializedRequest = { ...request, providers: specialized };
    
    return this.ensembleVoting(specializedRequest, progressCallback);
  }

  private mergeIOCs(results: AIAnalysisResult[]) {
    const merged = {
      domains: new Set<string>(),
      ips: new Set<string>(),
      files: new Set<string>(),
      registry: new Set<string>(),
      processes: new Set<string>()
    };
    
    results.forEach(result => {
      result.iocs.domains.forEach(d => merged.domains.add(d));
      result.iocs.ips.forEach(i => merged.ips.add(i));
      result.iocs.files.forEach(f => merged.files.add(f));
      result.iocs.registry.forEach(r => merged.registry.add(r));
      result.iocs.processes.forEach(p => merged.processes.add(p));
    });
    
    return {
      domains: Array.from(merged.domains),
      ips: Array.from(merged.ips),
      files: Array.from(merged.files),
      registry: Array.from(merged.registry),
      processes: Array.from(merged.processes)
    };
  }

  private generateRecommendations(threatLevel: 'safe' | 'suspicious' | 'malicious' | 'critical'): string[] {
    const recommendations: Record<'safe' | 'suspicious' | 'malicious' | 'critical', string[]> = {
      safe: [
        'File appears benign',
        'Continue monitoring for behavioral changes',
        'Maintain regular security scans'
      ],
      suspicious: [
        'Isolate file for further analysis',
        'Run in controlled sandbox environment',
        'Check for similar samples in threat databases',
        'Monitor system for unusual behavior'
      ],
      malicious: [
        'Immediately isolate infected system',
        'Run comprehensive malware removal',
        'Check network for lateral movement',
        'Review security logs for indicators of compromise',
        'Update security signatures and rules'
      ],
      critical: [
        'CRITICAL: Disconnect system from network immediately',
        'Initiate incident response procedures',
        'Preserve system state for forensic analysis',
        'Check all connected systems for compromise',
        'Notify security team and management',
        'Consider full system rebuild after analysis'
      ]
    };

    return recommendations[threatLevel];
  }
}

export const aiService = new AIService();