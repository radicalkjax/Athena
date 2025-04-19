import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { sanitizeString } from '@/utils/helpers';

// Types for API client configuration
export interface ApiClientConfig {
  baseURL: string;
  apiKey?: string;
  apiKeyHeader?: string;
  additionalHeaders?: Record<string, string>;
  timeout?: number;
}

// Cache for API clients to avoid recreating them
const apiClientCache: Record<string, AxiosInstance> = {};

/**
 * Create a configured axios instance for API calls
 * @param config Configuration for the API client
 * @returns Configured axios instance
 */
export const createApiClient = (config: ApiClientConfig): AxiosInstance => {
  // Create a cache key based on the configuration
  const cacheKey = `${config.baseURL}:${config.apiKey || ''}`;
  
  // Return cached client if it exists
  if (apiClientCache[cacheKey]) {
    return apiClientCache[cacheKey];
  }
  
  // Create axios instance with base configuration
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout || 30000, // Default 30 second timeout
    headers: {
      'Content-Type': 'application/json',
      ...(config.additionalHeaders || {}),
    },
  });
  
  // Request interceptor for adding authentication and other headers
  client.interceptors.request.use(
    (requestConfig) => {
      // Add API key header if provided
      if (config.apiKey && config.apiKeyHeader) {
        requestConfig.headers[config.apiKeyHeader] = config.apiKey;
      }
      
      // Log request (in development only)
      if (__DEV__) {
        console.log(`API Request: ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`);
      }
      
      return requestConfig;
    },
    (error) => {
      console.error('API Request Error:', error);
      return Promise.reject(error);
    }
  );
  
  // Response interceptor for handling common errors
  client.interceptors.response.use(
    (response) => {
      // Log response (in development only)
      if (__DEV__) {
        console.log(`API Response: ${response.status} ${response.config.url}`);
      }
      
      return response;
    },
    (error: AxiosError) => {
      // Handle API errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          url: error.config?.url,
        });
        
        // Handle specific status codes
        switch (error.response.status) {
          case 401:
            // Unauthorized - API key is invalid or expired
            console.error('API Authentication Error: Invalid or expired API key');
            break;
          case 403:
            // Forbidden - API key doesn't have permission
            console.error('API Permission Error: Insufficient permissions');
            break;
          case 429:
            // Too Many Requests - Rate limit exceeded
            console.error('API Rate Limit Error: Too many requests');
            break;
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('API No Response Error:', error.request);
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('API Request Setup Error:', error.message);
      }
      
      return Promise.reject(error);
    }
  );
  
  // Cache the client
  apiClientCache[cacheKey] = client;
  
  return client;
};

/**
 * Create an OpenAI API client
 * @param apiKey OpenAI API key
 * @param baseURL Optional base URL (defaults to OpenAI API)
 * @returns Configured axios instance for OpenAI
 */
export const createOpenAIClient = (apiKey: string, baseURL: string = 'https://api.openai.com/v1'): AxiosInstance => {
  return createApiClient({
    baseURL,
    apiKey,
    apiKeyHeader: 'Authorization',
    additionalHeaders: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'assistants=v1',
    },
  });
};

/**
 * Create a Claude API client
 * @param apiKey Claude API key
 * @param baseURL Optional base URL (defaults to Anthropic API)
 * @returns Configured axios instance for Claude
 */
export const createClaudeClient = (apiKey: string, baseURL: string = 'https://api.anthropic.com/v1'): AxiosInstance => {
  return createApiClient({
    baseURL,
    apiKey,
    apiKeyHeader: 'x-api-key',
    additionalHeaders: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });
};

/**
 * Create a DeepSeek API client
 * @param apiKey DeepSeek API key
 * @param baseURL Optional base URL (defaults to DeepSeek API)
 * @returns Configured axios instance for DeepSeek
 */
export const createDeepSeekClient = (apiKey: string, baseURL: string = 'https://api.deepseek.com/v1'): AxiosInstance => {
  return createApiClient({
    baseURL,
    apiKey,
    apiKeyHeader: 'Authorization',
    additionalHeaders: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
};

/**
 * Create a local model API client
 * @param baseURL Base URL for the local model API
 * @returns Configured axios instance for local model
 */
export const createLocalModelClient = (baseURL: string): AxiosInstance => {
  return createApiClient({
    baseURL,
  });
};

/**
 * Create a Metasploit API client
 * @param apiKey Metasploit API key
 * @param baseURL Base URL for the Metasploit API
 * @returns Configured axios instance for Metasploit
 */
export const createMetasploitClient = (apiKey: string, baseURL: string): AxiosInstance => {
  return createApiClient({
    baseURL,
    apiKey,
    apiKeyHeader: 'Authorization',
    additionalHeaders: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
};

/**
 * Create a Container API client
 * @param apiKey Container API key
 * @param baseURL Base URL for the Container API
 * @returns Configured axios instance for Container service
 */
export const createContainerClient = (apiKey: string, baseURL: string): AxiosInstance => {
  return createApiClient({
    baseURL,
    apiKey,
    apiKeyHeader: 'Authorization',
    additionalHeaders: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });
};

/**
 * Safely make an API request with proper error handling
 * @param apiCall Function that makes the API call
 * @param errorMessage Error message to use if the call fails
 * @returns Response data or throws an error
 */
export const safeApiCall = async <T>(
  apiCall: () => Promise<AxiosResponse<T>>,
  errorMessage: string
): Promise<T> => {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error) {
    console.error(`API Error: ${errorMessage}`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`${errorMessage}: ${error.response.status} - ${
        error.response.data.error?.message || 
        error.response.data.error || 
        'Unknown error'
      }`);
    }
    
    throw new Error(`${errorMessage}: ${(error as Error).message}`);
  }
};

/**
 * Sanitize request data for security
 * @param data Data to sanitize
 * @returns Sanitized data
 */
export const sanitizeRequestData = <T>(data: T): T => {
  if (typeof data === 'string') {
    return sanitizeString(data) as unknown as T;
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeRequestData(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized as T;
  }
  
  return data;
};
