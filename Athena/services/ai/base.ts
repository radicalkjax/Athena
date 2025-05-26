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
  Vulnerability
} from './types';
import { SYSTEM_PROMPTS } from './prompts';

export abstract class BaseAIService {
  protected cachedApiKey: string | null = null;
  protected cachedBaseUrl: string | null = null;
  protected provider: AIProvider;
  protected envApiKey?: string;

  constructor(provider: AIProvider, envApiKey?: string) {
    this.provider = provider;
    this.envApiKey = envApiKey;
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
   * Initialize AI client
   */
  async init(apiKey?: string, baseUrl?: string): Promise<AxiosInstance> {
    try {
      // Use provided API key or retrieve from storage
      let key = apiKey || this.cachedApiKey;
      let url = baseUrl || this.cachedBaseUrl || this.provider.defaultBaseUrl;
      
      if (!key) {
        // Try to get from environment variable
        if (this.envApiKey) {
          key = this.envApiKey;
        } else {
          // Try expo constants as fallback
          const envKey = Constants.manifest?.extra?.[`${this.provider.name}ApiKey`];
          if (envKey) {
            key = envKey;
          }
        }
      }
      
      if (!key) {
        // Try to get from AsyncStorage
        try {
          key = await AsyncStorage.getItem(`${this.provider.storageKeyPrefix}_api_key`);
          console.log(`Checking AsyncStorage for ${this.provider.name} key:`, !!key);
        } catch (error) {
          console.error('Error accessing AsyncStorage:', error);
        }
      }
      
      if (!key) {
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
        } catch (error) {
          console.error('Error accessing AsyncStorage for base URL:', error);
        }
      }
      
      console.log(`Initializing ${this.provider.name} client with key`);
      
      return this.getClient(key, url);
    } catch (error) {
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
      } catch (error) {
        console.error('Error saving to AsyncStorage:', error);
      }
      
      console.log(`Saved ${this.provider.name} API configuration to memory cache`);
    } catch (error) {
      console.error(`Error saving ${this.provider.name} API configuration:`, error);
      throw error;
    }
  }

  /**
   * Check if API key is stored
   */
  async hasApiKey(): Promise<boolean> {
    // Check memory cache first
    if (this.cachedApiKey) {
      return true;
    }
    
    // Check environment variable
    if (this.envApiKey) {
      this.cachedApiKey = this.envApiKey; // Cache it for future use
      return true;
    }
    
    // Check expo constants as fallback
    const envKey = Constants.manifest?.extra?.[`${this.provider.name}ApiKey`];
    if (envKey) {
      this.cachedApiKey = envKey; // Cache it for future use
      return true;
    }
    
    // Check AsyncStorage
    try {
      const key = await AsyncStorage.getItem(`${this.provider.storageKeyPrefix}_api_key`);
      if (key) {
        this.cachedApiKey = key; // Cache it for future use
        
        // Also cache the base URL if it exists
        const baseUrl = await AsyncStorage.getItem(`${this.provider.storageKeyPrefix}_base_url`);
        if (baseUrl) {
          this.cachedBaseUrl = baseUrl;
        }
        
        return true;
      }
    } catch (error) {
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
      } catch (error) {
        console.error('Error deleting from AsyncStorage:', error);
      }
      
      console.log(`Deleted ${this.provider.name} API configuration from memory cache`);
    } catch (error) {
      console.error(`Error deleting ${this.provider.name} API configuration:`, error);
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
    } catch (error) {
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
    } catch (error) {
      console.error(`${this.provider.name} vulnerability analysis error:`, error);
      throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
    }
  }
}