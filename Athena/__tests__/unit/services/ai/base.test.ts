import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { AxiosInstance } from 'axios';
import { BaseAIService } from '@/services/ai/base';
import { AIProvider, AIMessage } from '@/services/ai/types';
import { sanitizeString } from '@/utils/helpers';
import { safeApiCall, sanitizeRequestData } from '@/services/apiClient';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('expo-constants', () => ({
  manifest: { extra: {} }
}));
jest.mock('@/utils/helpers', () => ({
  sanitizeString: jest.fn((str: string) => str)
}));
jest.mock('@/services/apiClient', () => ({
  safeApiCall: jest.fn(),
  sanitizeRequestData: jest.fn((data: any) => data)
}));

// Create a concrete test implementation of BaseAIService
class TestAIService extends BaseAIService {
  protected getClient(apiKey: string, baseUrl: string): AxiosInstance {
    return { 
      defaults: { baseURL: baseUrl },
      interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } }
    } as any;
  }

  protected async makeRequest(
    client: AxiosInstance,
    messages: AIMessage[],
    model: string
  ): Promise<any> {
    return {
      choices: [{
        message: {
          content: 'Test response content'
        }
      }]
    };
  }

  protected extractContent(response: any): string {
    return response.choices[0].message.content;
  }
}

describe('BaseAIService', () => {
  let service: TestAIService;
  const testProvider: AIProvider = {
    name: 'claude',
    storageKeyPrefix: 'claude',
    defaultModel: 'claude-3-opus-20240229',
    defaultBaseUrl: 'https://api.anthropic.com',
    envKeyName: 'CLAUDE_API_KEY'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset Constants to avoid test pollution
    Constants.manifest = { extra: {} };
    service = new TestAIService(testProvider);
  });

  describe('init', () => {
    it('should initialize with provided API key and base URL', async () => {
      const apiKey = 'test-api-key';
      const baseUrl = 'https://test.api.com';

      const client = await service.init(apiKey, baseUrl);

      expect(client).toBeDefined();
      expect(client.defaults.baseURL).toBe(baseUrl);
    });

    it('should use environment API key when provided in constructor', async () => {
      const envApiKey = 'env-api-key';
      service = new TestAIService(testProvider, envApiKey);

      const client = await service.init();

      expect(client).toBeDefined();
    });

    it('should retrieve API key from AsyncStorage when not provided', async () => {
      const storedKey = 'stored-api-key';
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(storedKey);

      const client = await service.init();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('claude_api_key');
      expect(client).toBeDefined();
    });

    it('should use expo constants as fallback for API key', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      // Mock Constants.expoConfig for this test
      (Constants as any).expoConfig = { extra: { claudeApiKey: 'expo-api-key' } };

      const client = await service.init();

      expect(client).toBeDefined();
    });

    it('should throw error when no API key is found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      // Mock Constants.expoConfig with empty extra
      (Constants as any).expoConfig = { extra: {} };

      await expect(service.init()).rejects.toThrow(
        'claude API key not found. Please set your API key in the settings or .env file.'
      );
    });

    it('should retrieve base URL from AsyncStorage', async () => {
      const storedKey = 'stored-api-key';
      const storedUrl = 'https://stored.api.com';
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'claude_api_key') return Promise.resolve(storedKey);
        if (key === 'claude_base_url') return Promise.resolve(storedUrl);
        return Promise.resolve(null);
      });

      const client = await service.init();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('claude_base_url');
      expect(client.defaults.baseURL).toBe(storedUrl);
    });
  });

  describe('saveApiKey', () => {
    it('should save API key to AsyncStorage and memory cache', async () => {
      const apiKey = 'new-api-key';
      const baseUrl = 'https://new.api.com';

      await service.saveApiKey(apiKey, baseUrl);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('claude_api_key', apiKey);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('claude_base_url', baseUrl);
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      const apiKey = 'new-api-key';
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(service.saveApiKey(apiKey)).resolves.toBeUndefined();
    });
  });

  describe('hasApiKey', () => {
    it('should return true when API key is in memory cache', async () => {
      await service.saveApiKey('cached-key');

      const result = await service.hasApiKey();

      expect(result).toBe(true);
      // AsyncStorage.getItem might not be called since we have cached value
    });

    it('should return true when API key is in environment variable', async () => {
      service = new TestAIService(testProvider, 'env-api-key');

      const result = await service.hasApiKey();

      expect(result).toBe(true);
    });

    it('should return true when API key is in expo constants', async () => {
      (Constants as any).expoConfig = { extra: { claudeApiKey: 'expo-api-key' } };

      const result = await service.hasApiKey();

      expect(result).toBe(true);
    });

    it('should return true when API key is in AsyncStorage', async () => {
      // Create a fresh service instance without any cached values
      const freshService = new TestAIService(testProvider, ''); // Pass empty string to avoid env key
      
      // Reset expo constants to ensure no key is there
      (Constants as any).expoConfig = { extra: {} };
      
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'claude_api_key') return Promise.resolve('stored-api-key');
        if (key === 'claude_base_url') return Promise.resolve('https://api.claude.com');
        return Promise.resolve(null);
      });

      const result = await freshService.hasApiKey();

      expect(result).toBe(true);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('claude_api_key');
    });

    it('should return false when no API key is found', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (Constants as any).expoConfig = { extra: {} };

      const result = await service.hasApiKey();

      expect(result).toBe(false);
    });
  });

  describe('deleteApiKey', () => {
    it('should clear API key from AsyncStorage and memory cache', async () => {
      await service.deleteApiKey();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('claude_api_key');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('claude_base_url');
    });

    it('should handle AsyncStorage errors gracefully', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      // Should not throw
      await expect(service.deleteApiKey()).resolves.toBeUndefined();
    });
  });

  describe('deobfuscateCode', () => {
    beforeEach(() => {
      // Mock the init method to return a client
      jest.spyOn(service, 'init').mockResolvedValue({
        defaults: { baseURL: 'https://api.test.com' }
      } as any);
    });

    it('should deobfuscate code successfully', async () => {
      const obfuscatedCode = 'var _0x1234 = function() {};';
      const mockResponse = {
        choices: [{
          message: {
            content: 'DEOBFUSCATED CODE: function test() {} ANALYSIS: This is a simple function'
          }
        }]
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.deobfuscateCode(obfuscatedCode);

      expect(sanitizeString).toHaveBeenCalledWith(obfuscatedCode);
      expect(result).toEqual({
        deobfuscatedCode: 'function test() {}',
        analysisReport: 'This is a simple function'
      });
    });

    it('should handle response without proper format', async () => {
      const obfuscatedCode = 'var _0x1234 = function() {};';
      const mockResponse = {
        choices: [{
          message: {
            content: 'This code does something'
          }
        }]
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.deobfuscateCode(obfuscatedCode);

      expect(result).toEqual({
        deobfuscatedCode: '',
        analysisReport: 'This code does something'
      });
    });

    it('should use custom model ID when provided', async () => {
      const obfuscatedCode = 'var _0x1234 = function() {};';
      const customModel = 'claude-3-haiku-20240307';
      const makeRequestSpy = jest.spyOn(service as any, 'makeRequest');

      await service.deobfuscateCode(obfuscatedCode, customModel);

      expect(makeRequestSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        customModel
      );
    });

    it('should throw error when deobfuscation fails', async () => {
      jest.spyOn(service, 'init').mockRejectedValue(new Error('API error'));

      await expect(service.deobfuscateCode('code')).rejects.toThrow(
        'Failed to deobfuscate code: API error'
      );
    });
  });

  describe('analyzeVulnerabilities', () => {
    beforeEach(() => {
      // Mock the init method to return a client
      jest.spyOn(service, 'init').mockResolvedValue({
        defaults: { baseURL: 'https://api.test.com' }
      } as any);
    });

    it('should analyze vulnerabilities successfully with JSON response', async () => {
      const code = 'eval(userInput);';
      const mockResponse = {
        choices: [{
          message: {
            content: '```json\n{"vulnerabilities":[{"name":"Code Injection","description":"Eval of user input","severity":"critical"}],"analysisReport":"Found critical vulnerability"}\n```'
          }
        }]
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.analyzeVulnerabilities(code);

      expect(sanitizeString).toHaveBeenCalledWith(code);
      expect(result).toEqual({
        vulnerabilities: [{
          name: 'Code Injection',
          description: 'Eval of user input',
          severity: 'critical'
        }],
        analysisReport: 'Found critical vulnerability'
      });
    });

    it('should handle invalid JSON response gracefully', async () => {
      const code = 'eval(userInput);';
      const mockResponse = {
        choices: [{
          message: {
            content: 'This is not valid JSON'
          }
        }]
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.analyzeVulnerabilities(code);

      expect(result).toEqual({
        vulnerabilities: [],
        analysisReport: 'This is not valid JSON'
      });
    });

    it('should extract JSON without markdown code blocks', async () => {
      const code = 'eval(userInput);';
      const mockResponse = {
        choices: [{
          message: {
            content: '{"vulnerabilities":[],"analysisReport":"No vulnerabilities found"}'
          }
        }]
      };

      jest.spyOn(service as any, 'makeRequest').mockResolvedValue(mockResponse);

      const result = await service.analyzeVulnerabilities(code);

      expect(result).toEqual({
        vulnerabilities: [],
        analysisReport: 'No vulnerabilities found'
      });
    });

    it('should use custom model ID when provided', async () => {
      const code = 'eval(userInput);';
      const customModel = 'claude-3-haiku-20240307';
      const makeRequestSpy = jest.spyOn(service as any, 'makeRequest');

      await service.analyzeVulnerabilities(code, customModel);

      expect(makeRequestSpy).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Array),
        customModel
      );
    });

    it('should throw error when vulnerability analysis fails', async () => {
      jest.spyOn(service, 'init').mockRejectedValue(new Error('API error'));

      await expect(service.analyzeVulnerabilities('code')).rejects.toThrow(
        'Failed to analyze vulnerabilities: API error'
      );
    });
  });
});