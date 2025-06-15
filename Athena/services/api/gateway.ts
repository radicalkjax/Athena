/**
 * API Gateway - Unified API handling with environment-specific routing
 */

import { AxiosInstance, AxiosError } from 'axios';
import { env } from '@/shared/config/environment';
import { getProxiedUrl, shouldUseProxy } from '@/config/proxy';
import {
  createApiClient,
  createOpenAIClient,
  createClaudeClient,
  createDeepSeekClient,
  createLocalModelClient,
  createMetasploitClient,
  createContainerClient,
  ApiClientConfig,
} from '../apiClient';

export type APIProvider = 'openai' | 'claude' | 'deepseek' | 'local' | 'metasploit' | 'container';

export interface GatewayConfig {
  provider: APIProvider;
  apiKey?: string;
  baseUrl?: string;
  useProxy?: boolean;
}

export interface GatewayResponse<T = any> {
  data: T;
  provider: APIProvider;
  cached: boolean;
  timestamp: number;
}

export interface GatewayError {
  message: string;
  code: string;
  provider: APIProvider;
  originalError?: any;
  suggestion?: string;
}

/**
 * API Gateway class for unified API management
 */
export class APIGateway {
  private static instance: APIGateway;
  private clients: Map<string, AxiosInstance> = new Map();
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): APIGateway {
    if (!APIGateway.instance) {
      APIGateway.instance = new APIGateway();
    }
    return APIGateway.instance;
  }

  /**
   * Get or create an API client for a provider
   */
  getClient(config: GatewayConfig): AxiosInstance {
    const cacheKey = `${config.provider}:${config.apiKey || 'default'}`;
    
    // Return cached client if exists
    if (this.clients.has(cacheKey)) {
      return this.clients.get(cacheKey)!;
    }

    // Determine base URL based on environment and proxy settings
    const baseUrl = this.getBaseUrl(config);
    
    // Create appropriate client based on provider
    let client: AxiosInstance;
    
    switch (config.provider) {
      case 'openai':
        client = createOpenAIClient(config.apiKey!, baseUrl);
        break;
      case 'claude':
        client = createClaudeClient(config.apiKey!, baseUrl);
        break;
      case 'deepseek':
        client = createDeepSeekClient(config.apiKey!, baseUrl);
        break;
      case 'local':
        client = createLocalModelClient(baseUrl);
        break;
      case 'metasploit':
        client = createMetasploitClient(config.apiKey!, baseUrl);
        break;
      case 'container':
        client = createContainerClient(config.apiKey!, baseUrl);
        break;
      default:
        throw new Error(`Unknown API provider: ${config.provider}`);
    }

    // Cache the client
    this.clients.set(cacheKey, client);
    
    return client;
  }

  /**
   * Get base URL based on environment and proxy settings
   */
  private getBaseUrl(config: GatewayConfig): string {
    // If explicit base URL provided, use it
    if (config.baseUrl) {
      return config.baseUrl;
    }

    // Check if we should use proxy
    const useProxy = config.useProxy ?? shouldUseProxy();
    
    if (useProxy) {
      // Use proxied URL for web development
      return getProxiedUrl(config.provider);
    }

    // Use direct URLs based on provider
    switch (config.provider) {
      case 'openai':
        return env.api.openai.baseUrl || 'https://api.openai.com/v1';
      case 'claude':
        return env.api.claude.baseUrl || 'https://api.anthropic.com/v1';
      case 'deepseek':
        return env.api.deepseek.baseUrl || 'https://api.deepseek.com/v1';
      case 'metasploit':
        return process.env.METASPLOIT_API_URL || 'http://localhost:3790/api/v1';
      case 'container':
        return process.env.CONTAINER_API_URL || 'http://localhost:8080/api';
      case 'local':
        return process.env.LOCAL_MODEL_URL || 'http://localhost:11434/api';
      default:
        throw new Error(`Unknown API provider: ${config.provider}`);
    }
  }

  /**
   * Make an API request with caching and error handling
   */
  async request<T = any>(
    config: GatewayConfig,
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      data?: any;
      params?: any;
      cache?: boolean;
      cacheKey?: string;
    } = {}
  ): Promise<GatewayResponse<T>> {
    const {
      method = 'GET',
      data,
      params,
      cache = false,
      cacheKey = `${config.provider}:${endpoint}:${JSON.stringify(params || {})}`
    } = options;

    // Check cache first
    if (cache && method === 'GET') {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return {
          data: cached,
          provider: config.provider,
          cached: true,
          timestamp: Date.now(),
        };
      }
    }

    try {
      // Get or create client
      const client = this.getClient(config);
      
      // Make request
      const response = await client.request({
        url: endpoint,
        method,
        data,
        params,
      });

      // Cache if enabled
      if (cache && method === 'GET') {
        this.setCache(cacheKey, response.data);
      }

      return {
        data: response.data,
        provider: config.provider,
        cached: false,
        timestamp: Date.now(),
      };
    } catch (error: unknown) {
      throw this.handleError(error as AxiosError, config.provider);
    }
  }

  /**
   * Handle API errors with provider-specific logic
   */
  private handleError(error: AxiosError, provider: APIProvider): GatewayError {
    const baseError: GatewayError = {
      message: 'API request failed',
      code: 'UNKNOWN_ERROR',
      provider,
      originalError: error,
    };

    // Handle CORS errors
    if (this.isCORSError(error)) {
      return {
        ...baseError,
        message: 'CORS error: API calls must be made through a proxy in web development',
        code: 'CORS_ERROR',
        suggestion: 'Enable the development proxy or use the mobile app',
      };
    }

    // Handle network errors
    if (!error.response) {
      return {
        ...baseError,
        message: 'Network error: Unable to reach the API server',
        code: 'NETWORK_ERROR',
        suggestion: 'Check your internet connection or API server status',
      };
    }

    // Handle HTTP errors
    const status = error.response.status;
    const data = error.response.data as any;

    switch (status) {
      case 401:
        return {
          ...baseError,
          message: 'Authentication failed: Invalid API key',
          code: 'AUTH_ERROR',
          suggestion: 'Check your API key configuration',
        };
      case 403:
        return {
          ...baseError,
          message: 'Permission denied: Insufficient access rights',
          code: 'PERMISSION_ERROR',
          suggestion: 'Verify your API key has the required permissions',
        };
      case 429:
        return {
          ...baseError,
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_ERROR',
          suggestion: 'Wait a moment before retrying or upgrade your API plan',
        };
      case 500:
      case 502:
      case 503:
        return {
          ...baseError,
          message: `${provider} service error: ${data?.error?.message || 'Service temporarily unavailable'}`,
          code: 'SERVICE_ERROR',
          suggestion: 'Try again later or check the service status',
        };
      default:
        return {
          ...baseError,
          message: data?.error?.message || data?.message || `HTTP ${status} error`,
          code: `HTTP_${status}`,
        };
    }
  }

  /**
   * Check if error is CORS-related
   */
  private isCORSError(error: AxiosError): boolean {
    return (
      error.code === 'ERR_NETWORK' ||
      error.message?.includes('CORS') ||
      error.message?.includes('Network Error') ||
      (error.code === 'ERR_FAILED' && env.isWeb)
    );
  }

  /**
   * Get data from cache
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set data in cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Clean old cache entries
    this.cleanCache();
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached clients and data
   */
  clearCache(): void {
    this.clients.clear();
    this.cache.clear();
  }
}

// Export singleton instance
export const apiGateway = APIGateway.getInstance();