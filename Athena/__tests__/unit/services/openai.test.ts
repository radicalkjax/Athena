import { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createOpenAIClient, safeApiCall, sanitizeRequestData } from '@/services/apiClient';
import {
  initOpenAI,
  saveOpenAIApiKey,
  hasOpenAIApiKey,
  deleteOpenAIApiKey,
  deobfuscateCode,
  analyzeVulnerabilities
} from '@/services/openai';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/services/apiClient');

describe('OpenAIService', () => {
  let mockClient: Partial<AxiosInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock axios client
    mockClient = {
      post: jest.fn(),
      defaults: { baseURL: 'https://api.openai.com/v1' }
    };
    
    (createOpenAIClient as jest.Mock).mockReturnValue(mockClient);
    (sanitizeRequestData as jest.Mock).mockImplementation((data) => data);
  });

  describe('initOpenAI', () => {
    it('should initialize OpenAI client with API key', async () => {
      const apiKey = 'test-api-key';
      const baseUrl = 'https://custom.openai.com';

      const client = await initOpenAI(apiKey, baseUrl);

      expect(createOpenAIClient).toHaveBeenCalledWith(apiKey, baseUrl);
      expect(client).toBe(mockClient);
    });

    it('should use stored API key when not provided', async () => {
      // Reset modules to clear cached singleton
      jest.resetModules();
      
      // Re-apply AsyncStorage mock after resetModules
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
          getItem: jest.fn((key: string) => {
            if (key === 'athena_openai_api_key') return Promise.resolve('stored-key');
            if (key === 'athena_openai_base_url') return Promise.resolve(null);
            return Promise.resolve(null);
          }),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        }
      }));
      
      // Mock expo-constants without API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              openaiApiKey: '', // Empty string instead of test key
              openaiApiBaseUrl: 'https://api.openai.com/v1',
            },
          },
        },
      }));
      
      // Ensure createOpenAIClient is mocked
      jest.doMock('@/services/apiClient', () => ({
        createOpenAIClient: jest.fn().mockReturnValue(mockClient),
        safeApiCall: jest.fn(),
        sanitizeRequestData: jest.fn((data) => data),
      }));
      
      // Re-import after mocking
      const { initOpenAI: initWithStoredKey } = require('@/services/openai');

      const client = await initWithStoredKey();

      const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;
      expect(AsyncStorageMock.getItem).toHaveBeenCalledWith('athena_openai_api_key');
      expect(client).toBe(mockClient);
    });

    it('should throw error when no API key is available', async () => {
      jest.resetModules();
      
      // Re-apply AsyncStorage mock after resetModules
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
          getItem: jest.fn().mockResolvedValue(null),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        }
      }));
      
      // Mock expo-constants without API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              openaiApiKey: '', // Empty string
              openaiApiBaseUrl: 'https://api.openai.com/v1',
            },
          },
        },
      }));
      
      const { initOpenAI: initWithoutKey } = require('@/services/openai');

      await expect(initWithoutKey()).rejects.toThrow('openai API key not found');
    });
  });

  describe('saveOpenAIApiKey', () => {
    it('should save API key to AsyncStorage', async () => {
      const apiKey = 'new-api-key';
      const baseUrl = 'https://new.openai.com';

      await saveOpenAIApiKey(apiKey, baseUrl);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('athena_openai_api_key', apiKey);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('athena_openai_base_url', baseUrl);
    });

    it('should save only API key when base URL not provided', async () => {
      const apiKey = 'new-api-key';

      await saveOpenAIApiKey(apiKey);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('athena_openai_api_key', apiKey);
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasOpenAIApiKey', () => {
    it('should return true when API key exists', async () => {
      const result = await hasOpenAIApiKey();

      expect(result).toBe(true);
    });

    it('should return false when no API key exists', async () => {
      jest.resetModules();
      
      // Re-apply AsyncStorage mock after resetModules
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
          getItem: jest.fn().mockResolvedValue(null),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        }
      }));
      
      // Mock expo-constants without API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              openaiApiKey: '', // Empty string
              openaiApiBaseUrl: 'https://api.openai.com/v1',
            },
          },
        },
      }));
      
      const { hasOpenAIApiKey: hasKeyWithoutEnv } = require('@/services/openai');

      const result = await hasKeyWithoutEnv();

      expect(result).toBe(false);
    });
  });

  describe('deleteOpenAIApiKey', () => {
    it('should remove API key from AsyncStorage', async () => {
      await deleteOpenAIApiKey();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('athena_openai_api_key');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('athena_openai_base_url');
    });
  });

  describe('deobfuscateCode', () => {
    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-key');
    });

    it('should deobfuscate code using OpenAI API', async () => {
      const obfuscatedCode = 'var _0x1234 = function() {};';
      const openAIResponse = {
        choices: [{
          message: {
            content: 'DEOBFUSCATED CODE: function test() {} ANALYSIS: This is a simple test function'
          }
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      const result = await deobfuscateCode(obfuscatedCode);

      expect(sanitizeRequestData).toHaveBeenCalledWith({
        model: 'gpt-4-turbo',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining(obfuscatedCode) })
        ]),
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      expect(safeApiCall).toHaveBeenCalled();
      const apiCallFn = (safeApiCall as jest.Mock).mock.calls[0][0];
      expect(apiCallFn).toBeInstanceOf(Function);

      expect(result).toEqual({
        deobfuscatedCode: 'function test() {}',
        analysisReport: 'This is a simple test function'
      });
    });

    it('should use custom model when provided', async () => {
      const openAIResponse = {
        choices: [{ message: { content: 'Response text' } }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      await deobfuscateCode('code', 'gpt-3.5-turbo');

      expect(sanitizeRequestData).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          temperature: 0.2,
          max_tokens: 4000
        })
      );
      
      // Should not include response_format for non-gpt-4-turbo models
      expect(sanitizeRequestData).not.toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: expect.any(Object)
        })
      );
    });

    it('should handle malformed response gracefully', async () => {
      const openAIResponse = {
        choices: [{
          message: { content: 'Malformed response without proper sections' }
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      const result = await deobfuscateCode('code');

      expect(result).toEqual({
        deobfuscatedCode: '',
        analysisReport: 'Malformed response without proper sections'
      });
    });

    it('should make correct API call to OpenAI', async () => {
      const openAIResponse = {
        choices: [{ message: { content: 'Response' } }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      await deobfuscateCode('test');

      const apiCallFn = (safeApiCall as jest.Mock).mock.calls[0][0];
      await apiCallFn();

      expect(mockClient.post).toHaveBeenCalledWith('/chat/completions', expect.objectContaining({
        model: 'gpt-4-turbo',
        messages: expect.any(Array),
        temperature: 0.2,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      }));
    });
  });

  describe('analyzeVulnerabilities', () => {
    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-key');
    });

    it('should analyze vulnerabilities using OpenAI API', async () => {
      const code = 'eval(userInput);';
      const openAIResponse = {
        choices: [{
          message: {
            content: JSON.stringify({
              vulnerabilities: [{
                name: 'Code Injection',
                description: 'Eval of user input',
                severity: 'critical',
                cveId: 'CVE-2023-1234'
              }],
              analysisReport: 'Critical security vulnerability found'
            })
          }
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      const result = await analyzeVulnerabilities(code);

      expect(result).toEqual({
        vulnerabilities: [{
          name: 'Code Injection',
          description: 'Eval of user input',
          severity: 'critical',
          cveId: 'CVE-2023-1234'
        }],
        analysisReport: 'Critical security vulnerability found'
      });
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      const openAIResponse = {
        choices: [{
          message: {
            content: '```json\n{"vulnerabilities":[],"analysisReport":"No vulnerabilities found"}\n```'
          }
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      const result = await analyzeVulnerabilities('safe code');

      expect(result).toEqual({
        vulnerabilities: [],
        analysisReport: 'No vulnerabilities found'
      });
    });

    it('should handle invalid JSON response', async () => {
      const openAIResponse = {
        choices: [{
          message: { content: 'This is not valid JSON' }
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      const result = await analyzeVulnerabilities('code');

      expect(result).toEqual({
        vulnerabilities: [],
        analysisReport: 'This is not valid JSON'
      });
    });

    it('should use custom model when provided', async () => {
      const openAIResponse = {
        choices: [{
          message: { content: '{"vulnerabilities":[],"analysisReport":"Done"}' }
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(openAIResponse);

      await analyzeVulnerabilities('code', 'gpt-3.5-turbo');

      expect(sanitizeRequestData).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo'
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should throw error when API call fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-key');
      (safeApiCall as jest.Mock).mockRejectedValue(new Error('API Error'));

      await expect(deobfuscateCode('code')).rejects.toThrow('Failed to deobfuscate code: API Error');
    });

    it('should throw error when no API key is available', async () => {
      jest.resetModules();
      
      // Re-apply AsyncStorage mock after resetModules
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
          getItem: jest.fn().mockResolvedValue(null),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        }
      }));
      
      // Mock expo-constants without API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              openaiApiKey: '', // Empty string
              openaiApiBaseUrl: 'https://api.openai.com/v1',
            },
          },
        },
      }));

      const { deobfuscateCode: deobfuscateWithoutKey } = require('@/services/openai');

      await expect(deobfuscateWithoutKey('code')).rejects.toThrow('Failed to deobfuscate code: openai API key not found');
    });
  });

  describe('OpenAI-specific behavior', () => {
    it('should include response_format for gpt-4-turbo model', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-key');
      (safeApiCall as jest.Mock).mockResolvedValue({
        choices: [{ message: { content: 'response' } }]
      });

      await deobfuscateCode('code', 'gpt-4-turbo');

      expect(sanitizeRequestData).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
          response_format: { type: 'json_object' }
        })
      );
    });

    it('should not include response_format for other models', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-key');
      (safeApiCall as jest.Mock).mockResolvedValue({
        choices: [{ message: { content: 'response' } }]
      });

      await deobfuscateCode('code', 'gpt-3.5-turbo');

      const callArg = (sanitizeRequestData as jest.Mock).mock.calls[0][0];
      expect(callArg.model).toBe('gpt-3.5-turbo');
      expect(callArg.response_format).toBeUndefined();
    });
  });
});