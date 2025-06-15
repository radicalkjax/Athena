/**
 * Base AI Service for common functionality
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AxiosInstance } from 'axios';
import { sanitizeString } from '@/utils/helpers';
import { safeApiCall, sanitizeRequestData } from '../apiClient';
import {
  AIProvider,
  AIMessage,
  DeobfuscationResult,
  VulnerabilityAnalysisResult,
  Vulnerability,
  StreamingAnalysis
} from './types';
import { SYSTEM_PROMPTS } from './prompts';
import { streamingManager } from '../streaming/manager';
import { StreamingConnection } from '../streaming/types';

export abstract class BaseAIService {
  protected cachedApiKey: string | null = null;
  protected cachedBaseUrl: string | null = null;
  protected provider: AIProvider;
  protected envApiKey?: string;

  constructor(provider: AIProvider, envApiKey?: string) {
    this.provider = provider;
    // Only store envApiKey if it's a non-empty string
    this.envApiKey = (envApiKey && typeof envApiKey === 'string' && envApiKey.trim()) ? envApiKey : undefined;
  }

  /**
   * Get API client - must be implemented by subclasses
   */
  protected abstract getClient(apiKey: string, baseUrl: string): AxiosInstance;

  /**
   * Make API request - must be implemented by subclasses
   */
  protected abstract makeRequest(
    client: AxiosInstance,
    messages: AIMessage[],
    model: string
  ): Promise<any>;

  /**
   * Extract content from API response - must be implemented by subclasses
   */
  protected abstract extractContent(response: any): string;

  /**
   * Make streaming API request - can be overridden by subclasses
   */
  protected async makeStreamingRequest(
    client: AxiosInstance,
    messages: AIMessage[],
    model: string,
    streaming: StreamingAnalysis
  ): Promise<any> {
    // Default implementation falls back to regular request
    // Subclasses should override this for true streaming support
    return this.makeRequest(client, messages, model);
  }

  /**
   * Initialize AI client
   */
  async init(apiKey?: string, baseUrl?: string): Promise<AxiosInstance> {
    try {
      // Use provided API key or retrieve from storage
      let key = apiKey || this.cachedApiKey;
      let url = baseUrl || this.cachedBaseUrl || this.provider.defaultBaseUrl;
      
      if (!key || !key.trim()) {
        // Try to get from environment variable
        if (this.envApiKey && this.envApiKey.trim()) {
          key = this.envApiKey;
        } else {
          // Try expo constants as fallback
          const envKey = Constants.expoConfig?.extra?.[`${this.provider.name}ApiKey`];
          if (envKey && typeof envKey === 'string' && envKey.trim()) {
            key = envKey;
          }
        }
      }
      
      if (!key || !key.trim()) {
        // Try to get from AsyncStorage
        try {
          const storedKey = await AsyncStorage.getItem(`${this.provider.storageKeyPrefix}_api_key`);
          if (storedKey && storedKey.trim()) {
            key = storedKey;
          }
          console.log(`Checking AsyncStorage for ${this.provider.name} key:`, !!(storedKey && storedKey.trim()));
        } catch (error: unknown) {
          console.error('Error accessing AsyncStorage:', error);
        }
      }
      
      if (!key || !key.trim()) {
        throw new Error(`${this.provider.name} API key not found. Please set your API key in the settings or .env file.`);
      }
      
      // Cache the base URL from AsyncStorage if not provided
      if (!baseUrl && !this.cachedBaseUrl) {
        try {
          const storedUrl = await AsyncStorage.getItem(`${this.provider.storageKeyPrefix}_base_url`);
          if (storedUrl) {
            this.cachedBaseUrl = storedUrl;
            url = storedUrl;
          }
        } catch (error: unknown) {
          console.error('Error accessing AsyncStorage for base URL:', error);
        }
      }
      
      console.log(`Initializing ${this.provider.name} client with key`);
      
      return this.getClient(key, url);
    } catch (error: unknown) {
      console.error(`Error initializing ${this.provider.name} client:`, error);
      throw error;
    }
  }

  /**
   * Save API configuration to storage
   */
  async saveApiKey(apiKey: string, baseUrl?: string): Promise<void> {
    try {
      // Cache in memory
      this.cachedApiKey = apiKey;
      
      if (baseUrl) {
        this.cachedBaseUrl = baseUrl;
      }
      
      // Save to AsyncStorage
      try {
        await AsyncStorage.setItem(`${this.provider.storageKeyPrefix}_api_key`, apiKey);
        if (baseUrl) {
          await AsyncStorage.setItem(`${this.provider.storageKeyPrefix}_base_url`, baseUrl);
        }
        console.log(`Saved ${this.provider.name} API configuration to AsyncStorage`);
      } catch (error: unknown) {
        console.error('Error saving to AsyncStorage:', error);
      }
      
      console.log(`Saved ${this.provider.name} API configuration to memory cache`);
    } catch (error: unknown) {
      console.error(`Error saving ${this.provider.name} API configuration:`, error);
      throw error;
    }
  }

  /**
   * Check if API key is stored and valid
   */
  async hasValidApiKey(): Promise<boolean> {
    return this.hasApiKey();
  }

  /**
   * Check if API key is stored
   */
  async hasApiKey(): Promise<boolean> {
    // Check memory cache first
    if (this.cachedApiKey && this.cachedApiKey.trim()) {
      return true;
    }
    
    // Check environment variable - must be non-empty string
    if (this.envApiKey && this.envApiKey.trim()) {
      this.cachedApiKey = this.envApiKey; // Cache it for future use
      return true;
    }
    
    // Check expo constants as fallback - must be non-empty string
    const envKey = Constants.expoConfig?.extra?.[`${this.provider.name}ApiKey`];
    if (envKey && typeof envKey === 'string' && envKey.trim()) {
      this.cachedApiKey = envKey; // Cache it for future use
      return true;
    }
    
    // Check AsyncStorage
    try {
      const key = await AsyncStorage.getItem(`${this.provider.storageKeyPrefix}_api_key`);
      if (key && key.trim()) {
        this.cachedApiKey = key; // Cache it for future use
        
        // Also cache the base URL if it exists
        const baseUrl = await AsyncStorage.getItem(`${this.provider.storageKeyPrefix}_base_url`);
        if (baseUrl && baseUrl.trim()) {
          this.cachedBaseUrl = baseUrl;
        }
        
        return true;
      }
    } catch (error: unknown) {
      console.error('Error accessing AsyncStorage:', error);
    }
    
    return false;
  }

  /**
   * Delete stored API configuration
   */
  async deleteApiKey(): Promise<void> {
    try {
      // Clear memory cache
      this.cachedApiKey = null;
      this.cachedBaseUrl = null;
      
      // Clear from AsyncStorage
      try {
        await AsyncStorage.removeItem(`${this.provider.storageKeyPrefix}_api_key`);
        await AsyncStorage.removeItem(`${this.provider.storageKeyPrefix}_base_url`);
        console.log(`Deleted ${this.provider.name} API configuration from AsyncStorage`);
      } catch (error: unknown) {
        console.error('Error deleting from AsyncStorage:', error);
      }
      
      console.log(`Deleted ${this.provider.name} API configuration from memory cache`);
    } catch (error: unknown) {
      console.error(`Error deleting ${this.provider.name} API configuration:`, error);
    }
  }

  /**
   * Check if provider supports enhanced streaming (WebSocket/SSE)
   */
  supportsEnhancedStreaming(): boolean {
    const capabilities = streamingManager.getCapabilities(this.provider.name);
    return capabilities.protocols.includes('websocket') || capabilities.protocols.includes('sse');
  }

  /**
   * Create enhanced streaming connection if supported
   */
  protected async createStreamingConnection(): Promise<StreamingConnection | null> {
    if (!this.supportsEnhancedStreaming()) {
      return null;
    }

    try {
      const baseUrl = this.cachedBaseUrl || this.provider.defaultBaseUrl;
      const capabilities = streamingManager.getCapabilities(this.provider.name);
      
      // Configure based on preferred protocol
      if (capabilities.preferredProtocol === 'sse') {
        const config = {
          url: `${baseUrl}/stream`,
          withCredentials: true
        };
        return await streamingManager.connect(this.provider.name, config);
      }
      
      // Default to polling
      return null;
    } catch (error: unknown) {
      console.error('Failed to create streaming connection:', error);
      return null;
    }
  }

  /**
   * Deobfuscate code
   */
  async deobfuscateCode(
    code: string,
    modelId?: string
  ): Promise<DeobfuscationResult> {
    try {
      const client = await this.init();
      
      // Sanitize input for security
      const sanitizedCode = sanitizeString(code);
      
      const messages: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPTS.deobfuscation },
        { role: 'user', content: `Analyze and deobfuscate this code:\n\n${sanitizedCode}` }
      ];
      
      const response = await this.makeRequest(
        client,
        messages,
        modelId || this.provider.defaultModel
      );
      
      const content = this.extractContent(response);
      
      // Extract deobfuscated code and analysis from the response
      const deobfuscatedCodeMatch = content.match(/DEOBFUSCATED CODE:([\s\S]*?)(?=ANALYSIS:|$)/i);
      const analysisMatch = content.match(/ANALYSIS:([\s\S]*)/i);
      
      return {
        deobfuscatedCode: deobfuscatedCodeMatch ? deobfuscatedCodeMatch[1].trim() : '',
        analysisReport: analysisMatch ? analysisMatch[1].trim() : content,
      };
    } catch (error: unknown) {
      console.error(`${this.provider.name} deobfuscation error:`, error);
      throw new Error(`Failed to deobfuscate code: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze code for vulnerabilities
   */
  async analyzeVulnerabilities(
    code: string,
    modelId?: string
  ): Promise<VulnerabilityAnalysisResult> {
    try {
      const client = await this.init();
      
      // Sanitize input for security
      const sanitizedCode = sanitizeString(code);
      
      const messages: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPTS.vulnerabilityAnalysis },
        { role: 'user', content: `Analyze this code for security vulnerabilities:\n\n${sanitizedCode}` }
      ];
      
      const response = await this.makeRequest(
        client,
        messages,
        modelId || this.provider.defaultModel
      );
      
      const content = this.extractContent(response);
      
      try {
        // Extract JSON from the response (AI might wrap it in markdown code blocks)
        const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || [null, content];
        const jsonStr = jsonMatch[1] || content;
        
        const result = JSON.parse(jsonStr);
        return {
          vulnerabilities: result.vulnerabilities || [],
          analysisReport: result.analysisReport || '',
        };
      } catch (parseError) {
        console.error(`Error parsing ${this.provider.name} JSON response:`, parseError);
        return {
          vulnerabilities: [],
          analysisReport: content,
        };
      }
    } catch (error: unknown) {
      console.error(`${this.provider.name} vulnerability analysis error:`, error);
      throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
    }
  }

  /**
   * Deobfuscate code with streaming support
   */
  async deobfuscateCodeStreaming(
    code: string,
    streaming: StreamingAnalysis,
    modelId?: string
  ): Promise<DeobfuscationResult> {
    try {
      const client = await this.init();
      
      // Sanitize input for security
      const sanitizedCode = sanitizeString(code);
      
      const messages: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPTS.deobfuscation },
        { role: 'user', content: `Analyze and deobfuscate this code:\n\n${sanitizedCode}` }
      ];
      
      // Report initial progress
      streaming.onProgress(10);
      streaming.onChunk({
        type: 'progress',
        data: { stage: 'initialized', message: 'Starting deobfuscation analysis' },
        timestamp: Date.now()
      });
      
      const response = await this.makeStreamingRequest(
        client,
        messages,
        modelId || this.provider.defaultModel,
        streaming
      );
      
      const content = this.extractContent(response);
      
      // Report parsing progress
      streaming.onProgress(90);
      streaming.onChunk({
        type: 'progress',
        data: { stage: 'parsing', message: 'Parsing deobfuscation results' },
        timestamp: Date.now()
      });
      
      // Extract deobfuscated code and analysis from the response
      const deobfuscatedCodeMatch = content.match(/DEOBFUSCATED CODE:([\s\S]*?)(?=ANALYSIS:|$)/i);
      const analysisMatch = content.match(/ANALYSIS:([\s\S]*)/i);
      
      const result = {
        deobfuscatedCode: deobfuscatedCodeMatch ? deobfuscatedCodeMatch[1].trim() : '',
        analysisReport: analysisMatch ? analysisMatch[1].trim() : content,
      };
      
      // Report completion
      streaming.onProgress(100);
      streaming.onComplete(result);
      
      return result;
    } catch (error: unknown) {
      streaming.onError(error as Error);
      console.error(`${this.provider.name} streaming deobfuscation error:`, error);
      throw new Error(`Failed to deobfuscate code: ${(error as Error).message}`);
    }
  }

  /**
   * Analyze code for vulnerabilities with streaming support
   */
  async analyzeVulnerabilitiesStreaming(
    code: string,
    streaming: StreamingAnalysis,
    modelId?: string
  ): Promise<VulnerabilityAnalysisResult> {
    try {
      const client = await this.init();
      
      // Sanitize input for security
      const sanitizedCode = sanitizeString(code);
      
      const messages: AIMessage[] = [
        { role: 'system', content: SYSTEM_PROMPTS.vulnerabilityAnalysis },
        { role: 'user', content: `Analyze this code for security vulnerabilities:\n\n${sanitizedCode}` }
      ];
      
      // Report initial progress
      streaming.onProgress(10);
      streaming.onChunk({
        type: 'progress',
        data: { stage: 'initialized', message: 'Starting vulnerability analysis' },
        timestamp: Date.now()
      });
      
      const response = await this.makeStreamingRequest(
        client,
        messages,
        modelId || this.provider.defaultModel,
        streaming
      );
      
      const content = this.extractContent(response);
      
      // Report parsing progress
      streaming.onProgress(90);
      streaming.onChunk({
        type: 'progress',
        data: { stage: 'parsing', message: 'Parsing vulnerability results' },
        timestamp: Date.now()
      });
      
      try {
        // Extract JSON from the response (AI might wrap it in markdown code blocks)
        const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || [null, content];
        const jsonStr = jsonMatch[1] || content;
        
        const result = JSON.parse(jsonStr);
        const finalResult = {
          vulnerabilities: result.vulnerabilities || [],
          analysisReport: result.analysisReport || '',
        };
        
        // Report completion
        streaming.onProgress(100);
        streaming.onComplete(finalResult);
        
        return finalResult;
      } catch (parseError) {
        console.error(`Error parsing ${this.provider.name} JSON response:`, parseError);
        const fallbackResult = {
          vulnerabilities: [],
          analysisReport: content,
        };
        
        streaming.onProgress(100);
        streaming.onComplete(fallbackResult);
        
        return fallbackResult;
      }
    } catch (error: unknown) {
      streaming.onError(error as Error);
      console.error(`${this.provider.name} streaming vulnerability analysis error:`, error);
      throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
    }
  }
}