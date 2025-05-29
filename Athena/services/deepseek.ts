/**
 * DeepSeek AI Service
 */

import { AxiosInstance } from 'axios';
import { createDeepSeekClient, safeApiCall, sanitizeRequestData } from './apiClient';
import { BaseAIService } from './ai/base';
import { AIProvider, AIMessage } from './ai/types';
import { env } from '@/shared/config/environment';

// Export types for backward compatibility
export { DeobfuscationResult, VulnerabilityAnalysisResult } from './ai/types';

class DeepSeekService extends BaseAIService {
  constructor() {
    const provider: AIProvider = {
      name: 'deepseek',
      storageKeyPrefix: 'athena_deepseek',
      defaultModel: 'deepseek-coder',
      defaultBaseUrl: env.api.deepseek.baseUrl || 'https://api.deepseek.com/v1',
      envKeyName: 'DEEPSEEK_API_KEY',
      envBaseUrlName: 'DEEPSEEK_API_BASE_URL'
    };
    // Pass undefined instead of empty string
    super(provider, env.api.deepseek.key);
  }

  protected getClient(apiKey: string, baseUrl: string): AxiosInstance {
    return createDeepSeekClient(apiKey, baseUrl);
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
      () => client.post('/chat/completions', requestData),
      'DeepSeek API error'
    );
  }

  protected extractContent(response: any): string {
    return response.choices?.[0]?.message?.content || '';
  }
}

// Create singleton instance
export const deepSeekService = new DeepSeekService();

// Export functions for backward compatibility
export const initDeepSeek = (apiKey?: string, baseUrl?: string) =>
  deepSeekService.init(apiKey, baseUrl);

export const saveDeepSeekApiKey = (apiKey: string, baseUrl?: string) =>
  deepSeekService.saveApiKey(apiKey, baseUrl);

export const hasDeepSeekApiKey = () =>
  deepSeekService.hasApiKey();

export const deleteDeepSeekApiKey = () =>
  deepSeekService.deleteApiKey();

export const deobfuscateCode = (code: string, model?: string) =>
  deepSeekService.deobfuscateCode(code, model);

export const analyzeVulnerabilities = (code: string, model?: string) =>
  deepSeekService.analyzeVulnerabilities(code, model);