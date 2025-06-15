/**
 * AI Provider Factory
 * Creates and manages AI provider instances
 */

import { AIProvider } from '../types';
import { ClaudeProvider } from './claude';
import { DeepSeekProvider } from './deepseek';
import { OpenAIProvider } from './openai';
import { logger } from '../../../utils/logger';

export type ProviderType = 'claude' | 'deepseek' | 'openai';

export interface ProviderConfig {
  type: ProviderType;
  apiKey: string;
  endpoint?: string;
  model?: string;
  organization?: string;
  [key: string]: any;
}

export interface ProviderFactoryOptions {
  providers: ProviderConfig[];
  defaultProvider?: ProviderType;
}

export class ProviderFactory {
  private providers: Map<string, AIProvider> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();
  private defaultProvider?: ProviderType;
  
  constructor(options: ProviderFactoryOptions) {
    this.defaultProvider = options.defaultProvider;
    
    // Initialize providers
    for (const config of options.providers) {
      this.registerProvider(config);
    }
  }
  
  /**
   * Register a new provider
   */
  registerProvider(config: ProviderConfig): void {
    try {
      const provider = this.createProvider(config);
      this.providers.set(config.type, provider);
      this.configs.set(config.type, config);
      
      logger.info(`Registered AI provider: ${config.type}`, {
        model: config.model,
        endpoint: config.endpoint
      });
    } catch (error: unknown) {
      logger.error(`Failed to register provider: ${config.type}`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  
  /**
   * Get a provider by type
   */
  getProvider(type?: ProviderType): AIProvider {
    const providerType = type || this.defaultProvider;
    
    if (!providerType) {
      throw new Error('No provider type specified and no default provider set');
    }
    
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider not found: ${providerType}`);
    }
    
    return provider;
  }
  
  /**
   * Get all registered providers
   */
  getAllProviders(): Map<string, AIProvider> {
    return new Map(this.providers);
  }
  
  /**
   * Get provider by capabilities
   */
  getProviderByCapability(capability: string): AIProvider | undefined {
    for (const [type, provider] of this.providers) {
      const capabilities = provider.getCapabilities();
      if (
        capabilities.features.includes(capability) ||
        capabilities.specializations.includes(capability)
      ) {
        return provider;
      }
    }
    return undefined;
  }
  
  /**
   * Get the best provider for a specific task
   */
  getBestProviderForTask(taskType: string): AIProvider {
    // Task-to-provider mapping based on strengths
    const taskMapping: Record<string, ProviderType> = {
      // Malware analysis tasks -> DeepSeek
      'malware_analysis': 'deepseek',
      'malware_detection': 'deepseek',
      'deobfuscation': 'deepseek',
      'binary_analysis': 'deepseek',
      'pattern_matching': 'deepseek',
      'code_deobfuscation': 'deepseek',
      
      // Code security tasks -> Claude
      'code_security': 'claude',
      'security_review': 'claude',
      'vulnerability_analysis': 'claude',
      'code_analysis': 'claude',
      'complex_reasoning': 'claude',
      'architecture_review': 'claude',
      
      // General analysis tasks -> OpenAI
      'general_analysis': 'openai',
      'report_generation': 'openai',
      'threat_intelligence': 'openai',
      'incident_response': 'openai',
      'documentation': 'openai',
      'threat_classification': 'openai'
    };
    
    const preferredProvider = taskMapping[taskType];
    
    if (preferredProvider && this.providers.has(preferredProvider)) {
      return this.providers.get(preferredProvider)!;
    }
    
    // Fallback to capability matching
    const capableProvider = this.getProviderByCapability(taskType);
    if (capableProvider) {
      return capableProvider;
    }
    
    // Final fallback to default provider
    return this.getProvider();
  }
  
  /**
   * Validate all provider configurations
   */
  async validateAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [type, provider] of this.providers) {
      try {
        const isValid = await provider.validateConfig();
        results.set(type, isValid);
      } catch (error: unknown) {
        logger.error(`Validation failed for provider: ${type}`, { error: error instanceof Error ? error.message : String(error) });
        results.set(type, false);
      }
    }
    
    return results;
  }
  
  /**
   * Get status of all providers
   */
  async getStatus(): Promise<Map<string, any>> {
    const status = new Map<string, any>();
    
    for (const [type, provider] of this.providers) {
      try {
        const providerStatus = await provider.getStatus();
        status.set(type, providerStatus);
      } catch (error: unknown) {
        status.set(type, {
          available: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    
    return status;
  }
  
  /**
   * Create a provider instance based on type
   */
  private createProvider(config: ProviderConfig): AIProvider {
    switch (config.type) {
      case 'claude':
        return new ClaudeProvider({
          apiKey: config.apiKey,
          endpoint: config.endpoint,
          model: config.model,
          maxRetries: config.maxRetries,
          timeout: config.timeout,
          anthropicVersion: config.anthropicVersion,
          anthropicBeta: config.anthropicBeta
        });
        
      case 'deepseek':
        return new DeepSeekProvider({
          apiKey: config.apiKey,
          endpoint: config.endpoint,
          model: config.model,
          maxRetries: config.maxRetries,
          timeout: config.timeout
        });
        
      case 'openai':
        return new OpenAIProvider({
          apiKey: config.apiKey,
          endpoint: config.endpoint,
          model: config.model,
          maxRetries: config.maxRetries,
          timeout: config.timeout,
          organization: config.organization
        });
        
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }
  
  /**
   * Update provider configuration
   */
  updateProviderConfig(type: ProviderType, config: Partial<ProviderConfig>): void {
    const currentConfig = this.configs.get(type);
    if (!currentConfig) {
      throw new Error(`Provider not found: ${type}`);
    }
    
    // Merge configurations
    const newConfig = { ...currentConfig, ...config, type };
    
    // Recreate provider with new config
    this.registerProvider(newConfig);
  }
  
  /**
   * Remove a provider
   */
  removeProvider(type: ProviderType): void {
    this.providers.delete(type);
    this.configs.delete(type);
    
    // Update default if needed
    if (this.defaultProvider === type) {
      this.defaultProvider = this.providers.keys().next().value as ProviderType | undefined;
    }
  }
}

/**
 * Create a pre-configured factory instance
 */
export function createProviderFactory(env?: Record<string, string>): ProviderFactory {
  const environment = env || process.env;
  
  const providers: ProviderConfig[] = [];
  
  // Add Claude if configured
  if (environment.CLAUDE_API_KEY) {
    providers.push({
      type: 'claude',
      apiKey: environment.CLAUDE_API_KEY,
      model: environment.CLAUDE_MODEL || 'claude-3-opus-20240229'
    });
  }
  
  // Add DeepSeek if configured
  if (environment.DEEPSEEK_API_KEY) {
    providers.push({
      type: 'deepseek',
      apiKey: environment.DEEPSEEK_API_KEY,
      model: environment.DEEPSEEK_MODEL || 'deepseek-coder'
    });
  }
  
  // Add OpenAI if configured
  if (environment.OPENAI_API_KEY) {
    providers.push({
      type: 'openai',
      apiKey: environment.OPENAI_API_KEY,
      model: environment.OPENAI_MODEL || 'gpt-4-turbo-preview',
      organization: environment.OPENAI_ORGANIZATION
    });
  }
  
  if (providers.length === 0) {
    throw new Error('No AI providers configured. Please set at least one API key.');
  }
  
  // Determine default provider based on priority
  let defaultProvider: ProviderType | undefined;
  if (environment.DEFAULT_AI_PROVIDER) {
    defaultProvider = environment.DEFAULT_AI_PROVIDER as ProviderType;
  } else {
    // Default priority: Claude > OpenAI > DeepSeek
    if (providers.find(p => p.type === 'claude')) {
      defaultProvider = 'claude';
    } else if (providers.find(p => p.type === 'openai')) {
      defaultProvider = 'openai';
    } else {
      defaultProvider = providers[0].type as ProviderType;
    }
  }
  
  return new ProviderFactory({
    providers,
    defaultProvider
  });
}