import { APIGateway, apiGateway, GatewayConfig, APIProvider } from '../../../services/api/gateway';
import { env } from '../../../shared/config/environment';
import { AxiosError } from 'axios';
import * as apiClient from '../../../services/apiClient';

// Mock dependencies
jest.mock('../../../shared/config/environment', () => ({
  env: {
    isWeb: false,
    isDev: false,
    api: {
      openai: { baseUrl: 'https://api.openai.com/v1' },
      claude: { baseUrl: 'https://api.anthropic.com/v1' },
      deepseek: { baseUrl: 'https://api.deepseek.com/v1' },
    },
  },
}));

jest.mock('../../../config/proxy', () => ({
  shouldUseProxy: jest.fn(() => false),
  getProxiedUrl: jest.fn((provider: string) => `/api/proxy/${provider}`),
}));

// Mock apiClient module
jest.mock('../../../services/apiClient', () => ({
  createOpenAIClient: jest.fn(),
  createClaudeClient: jest.fn(),
  createDeepSeekClient: jest.fn(),
  createLocalModelClient: jest.fn(),
  createMetasploitClient: jest.fn(),
  createContainerClient: jest.fn(),
}));

describe('APIGateway', () => {
  let mockAxiosInstance: {
    request: jest.Mock;
    get?: jest.Mock;
    post?: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock axios instance
    mockAxiosInstance = {
      request: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
    };

    // Mock all create client functions to return our mock instance
    (apiClient.createOpenAIClient as jest.Mock).mockReturnValue(mockAxiosInstance);
    (apiClient.createClaudeClient as jest.Mock).mockReturnValue(mockAxiosInstance);
    (apiClient.createDeepSeekClient as jest.Mock).mockReturnValue(mockAxiosInstance);
    (apiClient.createLocalModelClient as jest.Mock).mockReturnValue(mockAxiosInstance);
    (apiClient.createMetasploitClient as jest.Mock).mockReturnValue(mockAxiosInstance);
    (apiClient.createContainerClient as jest.Mock).mockReturnValue(mockAxiosInstance);

    // Clear gateway cache
    apiGateway.clearCache();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = APIGateway.getInstance();
      const instance2 = APIGateway.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(apiGateway);
    });
  });

  describe('getClient', () => {
    it('should create and cache OpenAI client', () => {
      const config: GatewayConfig = {
        provider: 'openai',
        apiKey: 'test-key',
      };

      const client1 = apiGateway.getClient(config);
      const client2 = apiGateway.getClient(config);

      expect(apiClient.createOpenAIClient).toHaveBeenCalledTimes(1);
      expect(apiClient.createOpenAIClient).toHaveBeenCalledWith(
        'test-key',
        'https://api.openai.com/v1'
      );
      expect(client1).toBe(client2);
    });

    it('should create Claude client with custom base URL', () => {
      const config: GatewayConfig = {
        provider: 'claude',
        apiKey: 'test-key',
        baseUrl: 'https://custom.anthropic.com/v1',
      };

      apiGateway.getClient(config);

      expect(apiClient.createClaudeClient).toHaveBeenCalledWith(
        'test-key',
        'https://custom.anthropic.com/v1'
      );
    });

    it('should use proxy URL when configured', () => {
      const { shouldUseProxy, getProxiedUrl } = require('../../../config/proxy');
      (shouldUseProxy as jest.Mock).mockReturnValue(true);

      const config: GatewayConfig = {
        provider: 'deepseek',
        apiKey: 'test-key',
        useProxy: true,
      };

      apiGateway.getClient(config);

      expect(getProxiedUrl).toHaveBeenCalledWith('deepseek');
      expect(apiClient.createDeepSeekClient).toHaveBeenCalledWith(
        'test-key',
        '/api/proxy/deepseek'
      );
    });

    it('should throw error for unknown provider', () => {
      const config: GatewayConfig = {
        provider: 'unknown' as APIProvider,
      };

      expect(() => apiGateway.getClient(config)).toThrow('Unknown API provider: unknown');
    });
  });

  describe('request', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { data: { result: 'success' } };
      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const config: GatewayConfig = { provider: 'openai', apiKey: 'test-key' };
      const result = await apiGateway.request(config, '/test', { method: 'GET' });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        url: '/test',
        method: 'GET',
        data: undefined,
        params: undefined,
      });
      expect(result).toEqual({
        data: mockResponse.data,
        provider: 'openai',
        cached: false,
        timestamp: expect.any(Number),
      });
    });

    it('should make successful POST request with data', async () => {
      const mockData = { input: 'test' };
      const mockResponse = { data: { output: 'result' } };
      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const config: GatewayConfig = { provider: 'claude', apiKey: 'test-key' };
      const result = await apiGateway.request(config, '/chat', {
        method: 'POST',
        data: mockData,
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledWith({
        url: '/chat',
        method: 'POST',
        data: mockData,
        params: undefined,
      });
      expect(result.data).toEqual(mockResponse.data);
    });

    it('should cache GET requests when enabled', async () => {
      const mockResponse = { data: { cached: 'data' } };
      mockAxiosInstance.request.mockResolvedValueOnce(mockResponse);

      const config: GatewayConfig = { provider: 'deepseek', apiKey: 'test-key' };
      
      // First request
      const result1 = await apiGateway.request(config, '/cached', {
        method: 'GET',
        cache: true,
      });

      // Second request
      const result2 = await apiGateway.request(config, '/cached', {
        method: 'GET',
        cache: true,
      });

      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(1);
      expect(result1.cached).toBe(false);
      expect(result2.cached).toBe(true);
      expect(result1.data).toEqual(result2.data);
    });

    it('should handle CORS errors', async () => {
      (env as any).isWeb = true;
      
      const corsError: Partial<AxiosError> = {
        code: 'ERR_NETWORK',
        message: 'Network Error',
        config: { url: '/test', headers: {} } as any,
      };
      mockAxiosInstance.request.mockRejectedValueOnce(corsError);

      const config: GatewayConfig = { provider: 'openai', apiKey: 'test-key' };
      
      await expect(apiGateway.request(config, '/test')).rejects.toMatchObject({
        code: 'CORS_ERROR',
        message: expect.stringContaining('CORS'),
        provider: 'openai',
      });
    });

    it('should handle authentication errors', async () => {
      const authError: Partial<AxiosError> = {
        response: {
          status: 401,
          data: { error: { message: 'Invalid API key' } },
        } as any,
      };
      mockAxiosInstance.request.mockRejectedValueOnce(authError);

      const config: GatewayConfig = { provider: 'claude', apiKey: 'bad-key' };
      
      await expect(apiGateway.request(config, '/test')).rejects.toMatchObject({
        code: 'AUTH_ERROR',
        message: 'Authentication failed: Invalid API key',
        provider: 'claude',
        suggestion: expect.stringContaining('API key'),
      });
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError: Partial<AxiosError> = {
        response: {
          status: 429,
          data: { error: { message: 'Rate limit exceeded' } },
        } as any,
      };
      mockAxiosInstance.request.mockRejectedValueOnce(rateLimitError);

      const config: GatewayConfig = { provider: 'openai', apiKey: 'test-key' };
      
      await expect(apiGateway.request(config, '/test')).rejects.toMatchObject({
        code: 'RATE_LIMIT_ERROR',
        message: 'Rate limit exceeded',
        provider: 'openai',
      });
    });
  });

  describe('cache management', () => {
    it('should clear all caches', async () => {
      const mockResponse = { data: { test: 'data' } };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const config: GatewayConfig = { provider: 'openai', apiKey: 'test-key' };
      
      // Make cached request
      await apiGateway.request(config, '/test', { cache: true });
      
      // Clear cache
      apiGateway.clearCache();
      
      // Make same request again
      const result = await apiGateway.request(config, '/test', { cache: true });
      
      // Should not be cached after clear
      expect(result.cached).toBe(false);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
    });

    it('should expire cache after timeout', async () => {
      jest.useFakeTimers();
      
      const mockResponse = { data: { test: 'data' } };
      mockAxiosInstance.request.mockResolvedValue(mockResponse);

      const config: GatewayConfig = { provider: 'openai', apiKey: 'test-key' };
      
      // Make cached request
      await apiGateway.request(config, '/test', { cache: true });
      
      // Advance time past cache timeout (5 minutes)
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      // Make same request again
      const result = await apiGateway.request(config, '/test', { cache: true });
      
      // Should not be cached after expiry
      expect(result.cached).toBe(false);
      expect(mockAxiosInstance.request).toHaveBeenCalledTimes(2);
      
      jest.useRealTimers();
    });
  });

  describe('provider-specific configurations', () => {
    it('should configure local model client correctly', () => {
      // Ensure proxy is not used
      const { shouldUseProxy } = require('../../../config/proxy');
      (shouldUseProxy as jest.Mock).mockReturnValue(false);
      
      const config: GatewayConfig = { provider: 'local' };
      
      apiGateway.getClient(config);
      
      expect(apiClient.createLocalModelClient).toHaveBeenCalledWith(
        'http://localhost:11434/api'
      );
    });

    it('should configure metasploit client correctly', () => {
      // Ensure proxy is not used
      const { shouldUseProxy } = require('../../../config/proxy');
      (shouldUseProxy as jest.Mock).mockReturnValue(false);
      
      const config: GatewayConfig = {
        provider: 'metasploit',
        apiKey: 'msf-key',
      };
      
      apiGateway.getClient(config);
      
      expect(apiClient.createMetasploitClient).toHaveBeenCalledWith(
        'msf-key',
        'http://localhost:3790/api/v1'
      );
    });

    it('should configure container client correctly', () => {
      // Ensure proxy is not used
      const { shouldUseProxy } = require('../../../config/proxy');
      (shouldUseProxy as jest.Mock).mockReturnValue(false);
      
      const config: GatewayConfig = {
        provider: 'container',
        apiKey: 'container-key',
      };
      
      apiGateway.getClient(config);
      
      expect(apiClient.createContainerClient).toHaveBeenCalledWith(
        'container-key',
        'http://localhost:8080/api'
      );
    });
  });
});