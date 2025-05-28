/**
 * OpenAI Service
 */

import { AxiosInstance } from 'axios';
import { createOpenAIClient, safeApiCall, sanitizeRequestData } from './apiClient';
import { BaseAIService } from './ai/base';
import { AIProvider, AIMessage } from './ai/types';
import { OPENAI_API_KEY } from '@env';

// Export types for backward compatibility
export { DeobfuscationResult, VulnerabilityAnalysisResult } from './ai/types';

class OpenAIService extends BaseAIService {
  constructor() {
    const provider: AIProvider = {
      name: 'openai',
      storageKeyPrefix: 'athena_openai',
      defaultModel: 'gpt-4-turbo',
      defaultBaseUrl: 'https://api.openai.com/v1',
      envKeyName: 'OPENAI_API_KEY'
    };
    // Pass undefined instead of empty string
    super(provider, OPENAI_API_KEY && OPENAI_API_KEY.trim() ? OPENAI_API_KEY : undefined);
  }

  protected getClient(apiKey: string, baseUrl: string): AxiosInstance {
    return createOpenAIClient(apiKey, baseUrl);
  }

  protected async makeRequest(
    client: AxiosInstance,
    messages: AIMessage[],
    model: string
  ): Promise<any> {
    const requestData = sanitizeRequestData({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 4000,
      ...(model === 'gpt-4-turbo' && { response_format: { type: 'json_object' } })
    });
    
    return safeApiCall(
      () => client.post('/chat/completions', requestData),
      'OpenAI API error'
    );
  }

  protected extractContent(response: any): string {
    return response.choices?.[0]?.message?.content || '';
  }
}

// Create singleton instance
export const openAIService = new OpenAIService();

// Export functions for backward compatibility
export const initOpenAI = (apiKey?: string, baseUrl?: string) =>
  openAIService.init(apiKey, baseUrl);

export const saveOpenAIApiKey = (apiKey: string, baseUrl?: string) =>
  openAIService.saveApiKey(apiKey, baseUrl);

export const hasOpenAIApiKey = () =>
  openAIService.hasApiKey();

export const deleteOpenAIApiKey = () =>
  openAIService.deleteApiKey();

export const deobfuscateCode = (code: string, modelId?: string) =>
  openAIService.deobfuscateCode(code, modelId);

export const analyzeVulnerabilities = (code: string, modelId?: string) =>
  openAIService.analyzeVulnerabilities(code, modelId);