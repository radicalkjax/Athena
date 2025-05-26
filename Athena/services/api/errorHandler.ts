/**
 * Enhanced API Error Handler with CORS Fallback Strategies
 */

import { AxiosError } from 'axios';
import { env } from '@/shared/config/environment';
import { logger } from '@/shared/logging/logger';
import { APIProvider } from './gateway';

export interface APIError {
  code: string;
  message: string;
  provider?: APIProvider;
  statusCode?: number;
  suggestion?: string;
  fallbackAvailable?: boolean;
  originalError?: any;
}

export interface FallbackStrategy {
  type: 'proxy' | 'mock' | 'cache' | 'alternative';
  description: string;
  execute: () => Promise<any>;
}

/**
 * Enhanced error handler with CORS detection and fallback strategies
 */
export class APIErrorHandler {
  private static corsErrorCount = 0;
  private static lastCorsError: number = 0;
  private static corsErrorThreshold = 3;
  private static corsErrorWindow = 60000; // 1 minute

  /**
   * Handle API errors with enhanced detection and fallback strategies
   */
  static handleError(
    error: AxiosError,
    provider?: APIProvider,
    operation?: string
  ): APIError {
    // Check if this is a CORS error
    if (this.isCORSError(error)) {
      return this.handleCORSError(error, provider, operation);
    }

    // Handle other types of errors
    if (!error.response) {
      return this.handleNetworkError(error, provider);
    }

    return this.handleHTTPError(error, provider);
  }

  /**
   * Detect CORS errors with multiple detection methods
   */
  private static isCORSError(error: AxiosError): boolean {
    // Method 1: Direct CORS error messages
    if (
      error.message?.includes('CORS') ||
      error.message?.includes('Access-Control-Allow-Origin') ||
      error.message?.includes('Cross-Origin Request Blocked')
    ) {
      return true;
    }

    // Method 2: Network errors in web environment
    if (env.isWeb && (
      error.code === 'ERR_NETWORK' ||
      error.code === 'ERR_FAILED' ||
      error.message === 'Network Error'
    )) {
      return true;
    }

    // Method 3: Status 0 with no response (typical CORS behavior)
    if (error.request && !error.response && error.request.status === 0) {
      return true;
    }

    // Method 4: Check if the error occurred on a cross-origin request
    if (env.isWeb && error.config?.url) {
      try {
        const url = new URL(error.config.url, window.location.origin);
        if (url.origin !== window.location.origin) {
          // Cross-origin request that failed without response
          return !error.response;
        }
      } catch {
        // Invalid URL, not a CORS issue
      }
    }

    return false;
  }

  /**
   * Handle CORS errors with tracking and suggestions
   */
  private static handleCORSError(
    error: AxiosError,
    provider?: APIProvider,
    operation?: string
  ): APIError {
    // Track CORS errors
    this.trackCORSError();

    const baseError: APIError = {
      code: 'CORS_ERROR',
      message: 'Cross-Origin Request Blocked',
      provider,
      fallbackAvailable: true,
      originalError: error,
    };

    // Provide environment-specific suggestions
    if (env.isDev && env.isWeb) {
      return {
        ...baseError,
        message: 'CORS error in web development environment',
        suggestion: this.getCORSSuggestion(provider),
      };
    }

    // Production CORS error (shouldn't happen with proper setup)
    return {
      ...baseError,
      message: 'API request blocked by browser security policy',
      suggestion: 'Please use the mobile app or contact support',
    };
  }

  /**
   * Get CORS suggestion based on context
   */
  private static getCORSSuggestion(provider?: APIProvider): string {
    // Check if proxy is configured
    const suggestions: string[] = [];

    // Check CORS error frequency
    if (this.corsErrorCount >= this.corsErrorThreshold) {
      suggestions.push('Multiple CORS errors detected.');
    }

    // Provider-specific suggestions
    if (provider) {
      suggestions.push(`For ${provider} API:`);
      
      switch (provider) {
        case 'openai':
        case 'claude':
        case 'deepseek':
          suggestions.push('1. Ensure proxy is running: npm run dev');
          suggestions.push('2. Use the mobile app for direct API access');
          suggestions.push('3. Consider using a backend service');
          break;
        case 'local':
        case 'metasploit':
        case 'container':
          suggestions.push('1. Check if local service is running');
          suggestions.push('2. Verify service allows CORS from your origin');
          suggestions.push('3. Use proxy configuration in webpack.config.js');
          break;
      }
    } else {
      suggestions.push('Enable proxy in development or use mobile app');
    }

    return suggestions.join('\n');
  }

  /**
   * Track CORS errors for pattern detection
   */
  private static trackCORSError(): void {
    const now = Date.now();
    
    // Reset counter if outside window
    if (now - this.lastCorsError > this.corsErrorWindow) {
      this.corsErrorCount = 0;
    }
    
    this.corsErrorCount++;
    this.lastCorsError = now;

    // Log pattern if threshold reached
    if (this.corsErrorCount === this.corsErrorThreshold) {
      logger.warn('Multiple CORS errors detected', {
        count: this.corsErrorCount,
        window: `${this.corsErrorWindow / 1000}s`,
        suggestion: 'Check proxy configuration',
      });
    }
  }

  /**
   * Handle network errors
   */
  private static handleNetworkError(
    error: AxiosError,
    provider?: APIProvider
  ): APIError {
    const isTimeout = error.code === 'ECONNABORTED' || error.message?.includes('timeout');
    
    return {
      code: isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR',
      message: isTimeout ? 'Request timed out' : 'Network connection failed',
      provider,
      suggestion: isTimeout 
        ? 'The request took too long. Try again or check your connection.'
        : 'Check your internet connection and try again.',
      fallbackAvailable: false,
      originalError: error,
    };
  }

  /**
   * Handle HTTP errors
   */
  private static handleHTTPError(
    error: AxiosError,
    provider?: APIProvider
  ): APIError {
    const status = error.response?.status || 0;
    const data = error.response?.data as any;
    
    const baseError: APIError = {
      code: `HTTP_${status}`,
      message: 'API request failed',
      provider,
      statusCode: status,
      originalError: error,
    };

    // Handle specific status codes
    switch (status) {
      case 401:
        return {
          ...baseError,
          code: 'AUTH_ERROR',
          message: 'Authentication failed',
          suggestion: 'Check your API key configuration',
        };
      
      case 403:
        return {
          ...baseError,
          code: 'FORBIDDEN_ERROR',
          message: 'Access forbidden',
          suggestion: 'Verify API key permissions',
        };
      
      case 429:
        return {
          ...baseError,
          code: 'RATE_LIMIT_ERROR',
          message: 'Rate limit exceeded',
          suggestion: 'Wait before retrying or upgrade your plan',
          fallbackAvailable: true,
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          ...baseError,
          code: 'SERVER_ERROR',
          message: `${provider || 'API'} service error`,
          suggestion: 'Service temporarily unavailable. Try again later.',
          fallbackAvailable: true,
        };
      
      default:
        return {
          ...baseError,
          message: data?.error?.message || data?.message || `Request failed with status ${status}`,
        };
    }
  }

  /**
   * Get fallback strategies for an error
   */
  static getFallbackStrategies(error: APIError): FallbackStrategy[] {
    const strategies: FallbackStrategy[] = [];

    // CORS error fallbacks
    if (error.code === 'CORS_ERROR' && env.isDev) {
      strategies.push({
        type: 'proxy',
        description: 'Use development proxy',
        execute: async () => {
          // The proxy should already be configured
          // This is more of a configuration check
          return { useProxy: true };
        },
      });

      strategies.push({
        type: 'mock',
        description: 'Use mock data in development',
        execute: async () => {
          // Return mock data for testing
          return this.getMockData(error.provider);
        },
      });
    }

    // Rate limit fallbacks
    if (error.code === 'RATE_LIMIT_ERROR') {
      strategies.push({
        type: 'cache',
        description: 'Use cached response if available',
        execute: async () => {
          // This would integrate with the cache in API gateway
          return { useCache: true };
        },
      });

      strategies.push({
        type: 'alternative',
        description: 'Try alternative provider',
        execute: async () => {
          // Suggest alternative providers
          return { alternativeProvider: this.getAlternativeProvider(error.provider) };
        },
      });
    }

    // Server error fallbacks
    if (error.code === 'SERVER_ERROR') {
      strategies.push({
        type: 'cache',
        description: 'Use cached response',
        execute: async () => ({ useCache: true }),
      });

      strategies.push({
        type: 'alternative',
        description: 'Switch to another provider',
        execute: async () => ({
          alternativeProvider: this.getAlternativeProvider(error.provider),
        }),
      });
    }

    return strategies;
  }

  /**
   * Get mock data for development testing
   */
  private static getMockData(provider?: APIProvider): any {
    switch (provider) {
      case 'openai':
      case 'claude':
      case 'deepseek':
        return {
          id: 'mock-response',
          content: 'This is mock data for CORS testing in development',
          model: provider,
        };
      default:
        return { mock: true, provider };
    }
  }

  /**
   * Get alternative provider suggestion
   */
  private static getAlternativeProvider(currentProvider?: APIProvider): APIProvider | null {
    const providers: APIProvider[] = ['openai', 'claude', 'deepseek'];
    
    if (!currentProvider) return providers[0];
    
    const alternatives = providers.filter(p => p !== currentProvider);
    return alternatives.length > 0 ? alternatives[0] : null;
  }

  /**
   * Format error for user display
   */
  static formatErrorForUser(error: APIError): string {
    const parts: string[] = [];
    
    parts.push(error.message);
    
    if (error.suggestion) {
      parts.push(`\n\nSuggestion: ${error.suggestion}`);
    }
    
    if (error.fallbackAvailable) {
      parts.push('\n\nFallback options are available.');
    }
    
    return parts.join('');
  }
}