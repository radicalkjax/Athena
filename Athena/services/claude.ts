/**
 * Claude AI Service
 */

import { AxiosInstance } from 'axios';
import { createClaudeClient, safeApiCall, sanitizeRequestData } from './apiClient';
import { BaseAIService } from './ai/base';
import { AIProvider, AIMessage } from './ai/types';
import { CLAUDE_API_KEY, CLAUDE_API_BASE_URL } from '@env';

// Export types for backward compatibility
export { DeobfuscationResult, VulnerabilityAnalysisResult } from './ai/types';

class ClaudeService extends BaseAIService {
  constructor() {
    const provider: AIProvider = {
      name: 'claude',
      storageKeyPrefix: 'athena_claude',
      defaultModel: 'claude-3-opus-20240229',
      defaultBaseUrl: CLAUDE_API_BASE_URL || 'https://api.anthropic.com/v1',
      envKeyName: 'CLAUDE_API_KEY',
      envBaseUrlName: 'CLAUDE_API_BASE_URL'
    };
    // Pass undefined instead of empty string
    super(provider, CLAUDE_API_KEY && CLAUDE_API_KEY.trim() ? CLAUDE_API_KEY : undefined);
  }

  protected getClient(apiKey: string, baseUrl: string): AxiosInstance {
    return createClaudeClient(apiKey, baseUrl);
  }

  protected async makeRequest(
    client: AxiosInstance,
    messages: AIMessage[],
    model: string
  ): Promise<any> {
    const requestData = sanitizeRequestData({
      model,
      messages,
      max_tokens: 4000,
      temperature: 0.2,
    });
    
    return safeApiCall(
      () => client.post('/messages', requestData),
      'Claude API error'
    );
  }

  protected extractContent(response: any): string {
    return response.content?.[0]?.text || '';
  }
}

// Create singleton instance
export const claudeService = new ClaudeService();

// Export functions for backward compatibility
export const initClaude = (apiKey?: string, baseUrl?: string) => 
  claudeService.init(apiKey, baseUrl);

export const saveClaudeApiKey = (apiKey: string, baseUrl?: string) =>
  claudeService.saveApiKey(apiKey, baseUrl);

export const hasClaudeApiKey = () =>
  claudeService.hasApiKey();

export const deleteClaudeApiKey = () =>
  claudeService.deleteApiKey();

export const deobfuscateCode = (code: string, model?: string) =>
  claudeService.deobfuscateCode(code, model);

export const analyzeVulnerabilities = (code: string, model?: string) =>
  claudeService.analyzeVulnerabilities(code, model);