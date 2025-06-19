import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIErrorHandler, APIError } from '../../../services/api/errorHandler';
import { logger } from '../../../shared/logging/logger';
import { AxiosError } from 'axios';
import { env } from '../../../shared/config/environment';

// Mock logger
vi.mock('../../../shared/logging/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock environment
vi.mock('../../../shared/config/environment', () => ({
  env: {
    isWeb: false,
    isDev: false,
  },
}));

describe('APIErrorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment
    (env as any).isWeb = false;
    (env as any).isDev = false;
  });

  describe('handleError', () => {
    it('should handle CORS errors', () => {
      const axiosError: Partial<AxiosError> = {
        message: 'Network Error',
        code: 'ERR_NETWORK',
        request: { status: 0 },
      };

      // Set web environment
      (env as any).isWeb = true;

      const result = APIErrorHandler.handleError(axiosError as AxiosError, 'openai', 'chat');

      expect(result.code).toBe('CORS_ERROR');
      expect(result.message).toBe('API request blocked by browser security policy');
      expect(result.provider).toBe('openai');
      expect(result.fallbackAvailable).toBe(true);
    });

    it('should handle network errors', () => {
      const axiosError: Partial<AxiosError> = {
        message: 'Network failed',
        code: 'ECONNREFUSED',
      };

      const result = APIErrorHandler.handleError(axiosError as AxiosError, 'claude');

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.message).toBe('Network connection failed');
      expect(result.suggestion).toContain('Check your internet connection');
    });

    it('should handle timeout errors', () => {
      const axiosError: Partial<AxiosError> = {
        code: 'ECONNABORTED',
        message: 'timeout of 5000ms exceeded',
      };

      const result = APIErrorHandler.handleError(axiosError as AxiosError, 'deepseek');

      expect(result.code).toBe('TIMEOUT_ERROR');
      expect(result.message).toBe('Request timed out');
      expect(result.suggestion).toContain('took too long');
    });

    it('should handle 401 authentication errors', () => {
      const axiosError: Partial<AxiosError> = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } },
        } as any,
      };

      const result = APIErrorHandler.handleError(axiosError as AxiosError, 'openai');

      expect(result.code).toBe('AUTH_ERROR');
      expect(result.message).toBe('Authentication failed');
      expect(result.statusCode).toBe(401);
      expect(result.suggestion).toContain('API key');
    });

    it('should handle 429 rate limit errors', () => {
      const axiosError: Partial<AxiosError> = {
        response: {
          status: 429,
          data: {},
        } as any,
      };

      const result = APIErrorHandler.handleError(axiosError as AxiosError, 'claude');

      expect(result.code).toBe('RATE_LIMIT_ERROR');
      expect(result.message).toBe('Rate limit exceeded');
      expect(result.statusCode).toBe(429);
      expect(result.fallbackAvailable).toBe(true);
    });

    it('should handle 500 server errors', () => {
      const axiosError: Partial<AxiosError> = {
        response: {
          status: 500,
          data: {},
        } as any,
      };

      const result = APIErrorHandler.handleError(axiosError as AxiosError, 'deepseek');

      expect(result.code).toBe('SERVER_ERROR');
      expect(result.message).toBe('deepseek service error');
      expect(result.statusCode).toBe(500);
      expect(result.fallbackAvailable).toBe(true);
    });
  });

  describe('CORS detection', () => {
    it('should detect CORS by message', () => {
      const corsMessages = [
        'CORS policy',
        'Access-Control-Allow-Origin',
        'Cross-Origin Request Blocked',
      ];

      corsMessages.forEach(message => {
        const error: Partial<AxiosError> = { message };
        const result = APIErrorHandler.handleError(error as AxiosError);
        expect(result.code).toBe('CORS_ERROR');
      });
    });

    it('should detect CORS in web environment with network errors', () => {
      (env as any).isWeb = true;
      
      const networkCodes = ['ERR_NETWORK', 'ERR_FAILED'];
      
      networkCodes.forEach(code => {
        const error: Partial<AxiosError> = { code, message: 'Network Error' };
        const result = APIErrorHandler.handleError(error as AxiosError);
        expect(result.code).toBe('CORS_ERROR');
      });
    });

    it('should detect CORS by cross-origin URL', () => {
      (env as any).isWeb = true;
      
      // Mock window.location for Node environment
      global.window = {
        location: { origin: 'http://localhost:3000' }
      } as any;

      const error: Partial<AxiosError> = {
        config: { url: 'https://api.openai.com/v1/chat', headers: {} } as any,
        request: {},
      };

      const result = APIErrorHandler.handleError(error as AxiosError);
      expect(result.code).toBe('CORS_ERROR');
      
      // Clean up
      delete (global as any).window;
    });
  });

  describe('CORS suggestions', () => {
    it('should provide dev environment suggestions', () => {
      (env as any).isDev = true;
      (env as any).isWeb = true;

      const error: Partial<AxiosError> = {
        message: 'Network Error',
        code: 'ERR_NETWORK',
      };

      const result = APIErrorHandler.handleError(error as AxiosError, 'openai');
      
      expect(result.message).toBe('CORS error in web development environment');
      expect(result.suggestion).toContain('proxy');
      expect(result.suggestion).toContain('mobile app');
    });

    it('should track multiple CORS errors', () => {
      (env as any).isWeb = true;

      // Reset the static error count
      (APIErrorHandler as any).corsErrorCount = 0;
      (APIErrorHandler as any).lastCorsError = 0;

      // Trigger multiple CORS errors
      for (let i = 0; i < 3; i++) {
        const error: Partial<AxiosError> = {
          message: 'Network Error',
          code: 'ERR_NETWORK',
        };
        APIErrorHandler.handleError(error as AxiosError);
      }

      expect(logger.warn).toHaveBeenCalledWith(
        'Multiple CORS errors detected',
        expect.objectContaining({
          count: 3,
          window: '60s',
          suggestion: 'Check proxy configuration',
        })
      );
    });
  });

  describe('getFallbackStrategies', () => {
    it('should provide fallback strategies for CORS errors', () => {
      (env as any).isDev = true;
      
      const error: APIError = {
        code: 'CORS_ERROR',
        message: 'CORS blocked',
        provider: 'openai',
      };

      const strategies = APIErrorHandler.getFallbackStrategies(error);

      expect(strategies).toHaveLength(2);
      expect(strategies[0].type).toBe('proxy');
      expect(strategies[1].type).toBe('mock');
    });

    it('should provide fallback strategies for rate limit errors', () => {
      const error: APIError = {
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limited',
        provider: 'claude',
      };

      const strategies = APIErrorHandler.getFallbackStrategies(error);

      expect(strategies).toHaveLength(2);
      expect(strategies[0].type).toBe('cache');
      expect(strategies[1].type).toBe('alternative');
    });

    it('should execute mock strategy', async () => {
      (env as any).isDev = true;
      
      const error: APIError = {
        code: 'CORS_ERROR',
        message: 'CORS blocked',
        provider: 'openai',
      };

      const strategies = APIErrorHandler.getFallbackStrategies(error);
      const mockStrategy = strategies.find(s => s.type === 'mock');
      
      const result = await mockStrategy!.execute();
      
      expect(result).toHaveProperty('id', 'mock-response');
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('model', 'openai');
    });
  });

  describe('formatErrorForUser', () => {
    it('should format simple error', () => {
      const error: APIError = {
        code: 'AUTH_ERROR',
        message: 'Invalid API key',
      };

      const formatted = APIErrorHandler.formatErrorForUser(error);
      
      expect(formatted).toBe('Invalid API key');
    });

    it('should include suggestion', () => {
      const error: APIError = {
        code: 'AUTH_ERROR',
        message: 'Invalid API key',
        suggestion: 'Check your API key configuration',
      };

      const formatted = APIErrorHandler.formatErrorForUser(error);
      
      expect(formatted).toContain('Invalid API key');
      expect(formatted).toContain('Suggestion: Check your API key configuration');
    });

    it('should mention fallback availability', () => {
      const error: APIError = {
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limited',
        fallbackAvailable: true,
      };

      const formatted = APIErrorHandler.formatErrorForUser(error);
      
      expect(formatted).toContain('Rate limited');
      expect(formatted).toContain('Fallback options are available');
    });
  });
});