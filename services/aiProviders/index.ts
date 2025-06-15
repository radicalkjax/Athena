/**
 * AI Provider Service
 * Main entry point for AI provider integration
 */

// Export all types except the ones that conflict
export {
  AIProvider,
  AnalysisRequest,
  AnalysisResult,
  ThreatInfo,
  VulnerabilityInfo,
  IOC,
  AnalysisChunk,
  AICapabilities,
  ProviderStatus,
  ProviderConfig,
  SanitizedInput,
  EnsembleOptions,
  EnsembleResult,
  PreprocessingOptions,
  AIAnalysisResult,
  AIProviderError,
  OrchestrationError,
  RateLimitConfig,
  CacheConfig,
  ProviderMetrics,
  // Export type aliases and new types
  OrchestrationStrategy,
  AIOrchestratorConfig,
  AIAnalysisRequest,
  AIAnalysisResponse
} from './types';

// Export orchestrator class but not the conflicting interface
export { AIOrchestrator } from './orchestrator';
export * from './providers';
export { wasmPreprocessor } from './preprocessing/wasmPipeline';

import { AIOrchestrator } from './orchestrator';
import { createProviderFactory } from './providers';
import { logger } from '../../utils/logger';

// Global instance
let orchestratorInstance: AIOrchestrator | null = null;

/**
 * Initialize the AI orchestrator with providers
 */
export async function initializeAIProviders(config?: {
  claude?: { apiKey: string; model?: string };
  deepseek?: { apiKey: string; model?: string };
  openai?: { apiKey: string; model?: string; organization?: string };
}): Promise<AIOrchestrator> {
  try {
    // Use config or environment variables
    const providerConfig = config || {
      claude: {
        apiKey: process.env.CLAUDE_API_KEY!,
        model: process.env.CLAUDE_MODEL
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY!,
        model: process.env.DEEPSEEK_MODEL
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY!,
        model: process.env.OPENAI_MODEL,
        organization: process.env.OPENAI_ORGANIZATION
      }
    };

    // Create orchestrator
    orchestratorInstance = new AIOrchestrator(providerConfig);
    
    logger.info('AI providers initialized successfully');
    
    return orchestratorInstance;
  } catch (error: unknown) {
    logger.error('Failed to initialize AI providers', { error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Get the current orchestrator instance
 */
export function getOrchestrator(): AIOrchestrator {
  if (!orchestratorInstance) {
    throw new Error('AI providers not initialized. Call initializeAIProviders() first.');
  }
  return orchestratorInstance;
}

/**
 * Helper function to analyze content with best defaults
 */
export async function analyzeContent(
  content: string | ArrayBuffer,
  options?: {
    analysisType?: string;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    strategy?: 'single' | 'ensemble' | 'sequential' | 'specialized';
    metadata?: Record<string, any>;
  }
) {
  const orchestrator = getOrchestrator();
  
  const request = {
    id: `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    analysisType: options?.analysisType,
    priority: options?.priority || 'normal',
    metadata: options?.metadata
  };
  
  return orchestrator.analyze(request, {
    type: options?.strategy || 'specialized'
  });
}