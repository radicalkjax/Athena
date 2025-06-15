import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, CancelTokenSource } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { sanitizeString } from '@/utils/helpers';

// Global type declaration for React Native __DEV__
declare global {
  const __DEV__: boolean;
}

// Helper to suppress CORS errors in browser console
const suppressCORSErrors = () => {
  if (typeof window !== 'undefined' && __DEV__) {
    // Store original console methods
    const originalError = console.error;
    const originalWarn = console.warn;
    
    // Override console methods to filter CORS errors
    console.error = (...args: any[]) => {
      const errorString = args.join(' ');
      // Skip CORS-related errors
      if (errorString.includes('CORS') || 
          errorString.includes('Access-Control-Allow-Origin') ||
          errorString.includes('net::ERR_FAILED')) {
        return;
      }
      originalError.apply(console, args);
    };
    
    console.warn = (...args: any[]) => {
      const warnString = args.join(' ');
      // Skip CORS-related warnings
      if (warnString.includes('CORS') || 
          warnString.includes('Access-Control-Allow-Origin')) {
        return;
      }
      originalWarn.apply(console, args);
    };
  }
};

// Apply CORS error suppression
suppressCORSErrors();

// Types for API client configuration
export interface ApiClientConfig {
  baseURL: string;
  apiKey?: string;
  apiKeyHeader?: string;
  additionalHeaders?: Record<string, string>;
  timeout?: number;
  retryConfig?: RetryConfig;
}

// Retry configuration
export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: Required<RetryConfig> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Cache for API clients to avoid recreating them
const apiClientCache: Record<string, AxiosInstance> = {};

// Active request cancellation tokens
const activeRequests = new Map<string, CancelTokenSource>();

/**
 * Delay utility for retry logic
 */
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate retry delay with exponential backoff
 */
const calculateRetryDelay = (attempt: number, config: Required<RetryConfig>): number => {
  const delayMs = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
    config.maxDelayMs
  );
  // Add jitter to prevent thundering herd
  return delayMs + Math.random() * delayMs * 0.1;
};

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
  
  // Merge with default retry config
  const retryConfig: Required<RetryConfig> = {
    ...DEFAULT_RETRY_CONFIG,
    ...(config.retryConfig || {}),
  };
  
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
  
  // Response interceptor for handling common errors and retry logic
  client.interceptors.response.use(
    (response) => {
      // Log response (in development only)
      if (__DEV__) {
        console.log(`API Response: ${response.status} ${response.config.url}`);
      }
      
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & {
        _retry?: number;
        _retryConfig?: Required<RetryConfig>;
      };
      
      // Initialize retry config
      if (!originalRequest._retryConfig) {
        originalRequest._retryConfig = retryConfig;
      }
      
      // Initialize retry count
      if (originalRequest._retry === undefined) {
        originalRequest._retry = 0;
      }
      
      // Handle API errors
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        if (__DEV__) {
          console.error(`API Error: ${error.response.status} ${error.config?.url}`);
        }
        
        // Check if we should retry
        const shouldRetry = 
          originalRequest._retry < originalRequest._retryConfig.maxRetries &&
          originalRequest._retryConfig.retryableStatuses.includes(error.response.status);
        
        if (shouldRetry) {
          originalRequest._retry++;
          
          // Calculate retry delay
          const retryDelay = calculateRetryDelay(originalRequest._retry, originalRequest._retryConfig);
          
          if (__DEV__) {
            console.log(`Retrying request (attempt ${originalRequest._retry}/${originalRequest._retryConfig.maxRetries}) after ${retryDelay}ms`);
          }
          
          // Wait before retrying
          await delay(retryDelay);
          
          // Retry the request
          return client(originalRequest);
        }
        
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
        
        // Check if this is a CORS error
        const isCORSError = error.message?.includes('CORS') || 
                           error.message?.includes('Network Error') ||
                           (error.code === 'ERR_NETWORK' && typeof window !== 'undefined');
        
        if (isCORSError) {
          // Handle CORS errors silently in development
          if (__DEV__) {
            console.warn('CORS error detected. This is expected in web development. Consider using a proxy or backend service for API calls.');
          }
          // Return a more user-friendly error
          const corsError = new Error('API calls must be made from a backend service due to browser security restrictions');
          (corsError as any).code = 'CORS_ERROR';
          return Promise.reject(corsError);
        }
        
        // Log other network errors (but keep it minimal)
        if (__DEV__ && !isCORSError) {
          console.error('Network error:', error.message || 'Unknown network error');
        }
        
        // Retry network errors (but not CORS errors)
        const shouldRetry = !isCORSError && originalRequest._retry < originalRequest._retryConfig.maxRetries;
        
        if (shouldRetry) {
          originalRequest._retry++;
          const retryDelay = calculateRetryDelay(originalRequest._retry, originalRequest._retryConfig);
          
          if (__DEV__) {
            console.log(`Retrying network error (attempt ${originalRequest._retry}/${originalRequest._retryConfig.maxRetries}) after ${retryDelay}ms`);
          }
          
          await delay(retryDelay);
          return client(originalRequest);
        }
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
  return createBearerTokenClient(apiKey, baseURL, {
    'OpenAI-Beta': 'assistants=v1',
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
  return createBearerTokenClient(apiKey, baseURL);
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
  return createBearerTokenClient(apiKey, baseURL);
};

/**
 * Create a Container API client
 * @param apiKey Container API key
 * @param baseURL Base URL for the Container API
 * @returns Configured axios instance for Container service
 */
export const createContainerClient = (apiKey: string, baseURL: string): AxiosInstance => {
  return createBearerTokenClient(apiKey, baseURL);
};

/**
 * Cancel a request by its key
 */
export const cancelRequest = (key: string): void => {
  const source = activeRequests.get(key);
  if (source) {
    source.cancel('Request cancelled by user');
    activeRequests.delete(key);
  }
};

/**
 * Cancel all active requests
 */
export const cancelAllRequests = (): void => {
  activeRequests.forEach((source) => {
    source.cancel('All requests cancelled');
  });
  activeRequests.clear();
};

/**
 * Safely make an API request with proper error handling
 * @param apiCall Function that makes the API call
 * @param errorMessage Error message to use if the call fails
 * @param requestKey Optional key for request cancellation
 * @returns Response data or throws an error
 */
export const safeApiCall = async <T extends object>(
  apiCall: () => Promise<AxiosResponse<T>>,
  errorMessage: string,
  requestKey?: string
): Promise<T> => {
  // Create cancellation token if key provided
  let cancelTokenSource: CancelTokenSource | undefined;
  if (requestKey) {
    // Cancel any existing request with the same key
    cancelRequest(requestKey);
    
    // Create new cancellation token
    cancelTokenSource = axios.CancelToken.source();
    activeRequests.set(requestKey, cancelTokenSource);
  }
  
  try {
    const response = await apiCall();
    
    // Remove from active requests
    if (requestKey) {
      activeRequests.delete(requestKey);
    }
    
    return response.data;
  } catch (error: unknown) {
    // Remove from active requests
    if (requestKey) {
      activeRequests.delete(requestKey);
    }
    
    // Handle cancellation
    if (axios.isCancel(error)) {
      throw new Error(`${errorMessage}: Request cancelled`);
    }
    
    // Check if this is a CORS error
    const isCORSError = (error as any)?.code === 'CORS_ERROR' ||
                       (error as any)?.message?.includes('CORS') ||
                       (error as any)?.code === 'ERR_NETWORK';
    
    if (isCORSError) {
      // Don't log CORS errors to console, they're expected in web
      throw new Error('API calls cannot be made from web browser due to CORS restrictions. Please use a mobile app or backend service.');
    }
    
    // Log other errors
    console.error(`API Error: ${errorMessage}`, error);
    
    if (axios.isAxiosError(error) && error.response) {
      const errorData = error.response.data as any;
      throw new Error(`${errorMessage}: ${error.response.status} - ${
        errorData?.error?.message || 
        errorData?.error || 
        errorData?.message ||
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
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeRequestData(item)) as unknown as T;
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
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

/**
 * Create a factory function for creating API clients with common configuration
 */
export const createBearerTokenClient = (
  apiKey: string, 
  baseURL: string, 
  additionalHeaders?: Record<string, string>
): AxiosInstance => {
  return createApiClient({
    baseURL,
    apiKey,
    apiKeyHeader: 'Authorization',
    additionalHeaders: {
      'Authorization': `Bearer ${apiKey}`,
      ...additionalHeaders,
    },
  });
};
