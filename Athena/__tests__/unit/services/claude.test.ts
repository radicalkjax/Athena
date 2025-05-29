import { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClaudeClient, safeApiCall, sanitizeRequestData } from '@/services/apiClient';
import {
  initClaude,
  saveClaudeApiKey,
  hasClaudeApiKey,
  deleteClaudeApiKey,
  deobfuscateCode,
  analyzeVulnerabilities
} from '@/services/claude';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@/services/apiClient');

describe('ClaudeService', () => {
  let mockClient: Partial<AxiosInstance>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock axios client
    mockClient = {
      post: jest.fn(),
      defaults: { baseURL: 'https://api.anthropic.com/v1' }
    };
    
    (createClaudeClient as jest.Mock).mockReturnValue(mockClient);
    (sanitizeRequestData as jest.Mock).mockImplementation((data) => data);
  });

  describe('initClaude', () => {
    it('should initialize Claude client with API key', async () => {
      const apiKey = 'test-api-key';
      const baseUrl = 'https://custom.anthropic.com';

      const client = await initClaude(apiKey, baseUrl);

      expect(createClaudeClient).toHaveBeenCalledWith(apiKey, baseUrl);
      expect(client).toBe(mockClient);
    });

    it('should use stored API key when not provided', async () => {
      // Reset modules to clear cached values
      jest.resetModules();
      
      // Re-apply AsyncStorage mock after resetModules
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
          getItem: jest.fn((key: string) => {
            if (key === 'athena_claude_api_key') return Promise.resolve('stored-key');
            if (key === 'athena_claude_base_url') return Promise.resolve(null);
            return Promise.resolve(null);
          }),
          setItem: jest.fn(),
          removeItem: jest.fn(),
          clear: jest.fn(),
        }
      }));
      
      jest.doMock('@env', () => ({
        CLAUDE_API_KEY: '',  // No env key
        CLAUDE_API_BASE_URL: 'https://api.anthropic.com/v1'
      }));
      
      // Mock expo-constants to have no API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              claudeApiKey: '', // Empty string
              claudeApiBaseUrl: 'https://api.anthropic.com/v1'
            }
          }
        }
      }));
      
      // Ensure createClaudeClient is mocked
      jest.doMock('@/services/apiClient', () => ({
        createClaudeClient: jest.fn().mockReturnValue(mockClient),
        safeApiCall: jest.fn(),
        sanitizeRequestData: jest.fn((data) => data),
      }));
      
      const { initClaude: initWithoutEnv } = require('@/services/claude');

      const client = await initWithoutEnv();

      const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;
      expect(AsyncStorageMock.getItem).toHaveBeenCalledWith('athena_claude_api_key');
      expect(client).toBe(mockClient);
    });

    it('should throw error when no API key is available', async () => {
      // Reset modules to clear any cached values
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
      
      jest.doMock('@env', () => ({
        CLAUDE_API_KEY: '',
        CLAUDE_API_BASE_URL: 'https://api.anthropic.com/v1'
      }));
      
      // Mock expo-constants to have no API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              claudeApiKey: '', // Empty string
              claudeApiBaseUrl: 'https://api.anthropic.com/v1'
            }
          }
        }
      }));
      
      const { initClaude: initWithoutKey } = require('@/services/claude');

      await expect(initWithoutKey()).rejects.toThrow('claude API key not found');
    });
  });

  describe('saveClaudeApiKey', () => {
    it('should save API key to AsyncStorage', async () => {
      const apiKey = 'new-api-key';
      const baseUrl = 'https://new.anthropic.com';

      await saveClaudeApiKey(apiKey, baseUrl);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('athena_claude_api_key', apiKey);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('athena_claude_base_url', baseUrl);
    });

    it('should save only API key when base URL not provided', async () => {
      const apiKey = 'new-api-key';

      await saveClaudeApiKey(apiKey);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('athena_claude_api_key', apiKey);
      expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
    });
  });

  describe('hasClaudeApiKey', () => {
    it('should return true when API key exists', async () => {
      // Test with the default service that has env key
      const result = await hasClaudeApiKey();

      expect(result).toBe(true);
    });

    it('should return false when no API key exists', async () => {
      // Reset modules and mock env without key
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
      
      jest.doMock('@env', () => ({
        CLAUDE_API_KEY: '',
        CLAUDE_API_BASE_URL: 'https://api.anthropic.com/v1'
      }));
      
      // Mock expo-constants to have no API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              claudeApiKey: '', // Empty string
              claudeApiBaseUrl: 'https://api.anthropic.com/v1'
            }
          }
        }
      }));
      
      const { hasClaudeApiKey: hasKeyWithoutEnv } = require('@/services/claude');

      const result = await hasKeyWithoutEnv();

      expect(result).toBe(false);
    });
  });

  describe('deleteClaudeApiKey', () => {
    it('should remove API key from AsyncStorage', async () => {
      await deleteClaudeApiKey();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('athena_claude_api_key');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('athena_claude_base_url');
    });
  });

  describe('deobfuscateCode', () => {
    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-key');
    });

    it('should deobfuscate code using Claude API', async () => {
      const obfuscatedCode = 'var _0x1234 = function() {};';
      const claudeResponse = {
        content: [{
          text: 'DEOBFUSCATED CODE: function test() {} ANALYSIS: This is a simple test function'
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

      const result = await deobfuscateCode(obfuscatedCode);

      expect(sanitizeRequestData).toHaveBeenCalledWith({
        model: 'claude-3-opus-20240229',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user', content: expect.stringContaining(obfuscatedCode) })
        ]),
        max_tokens: 4000,
        temperature: 0.2
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
      const claudeResponse = {
        content: [{ text: 'Response text' }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

      await deobfuscateCode('code', 'claude-3-haiku-20240307');

      expect(sanitizeRequestData).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-haiku-20240307'
        })
      );
    });

    it('should handle malformed response gracefully', async () => {
      const claudeResponse = {
        content: [{ text: 'Malformed response without proper sections' }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

      const result = await deobfuscateCode('code');

      expect(result).toEqual({
        deobfuscatedCode: '',
        analysisReport: 'Malformed response without proper sections'
      });
    });

    it('should make correct API call to Claude', async () => {
      const claudeResponse = {
        content: [{ text: 'Response' }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

      await deobfuscateCode('test');

      // Verify the API call function
      const apiCallFn = (safeApiCall as jest.Mock).mock.calls[0][0];
      await apiCallFn();

      expect(mockClient.post).toHaveBeenCalledWith('/messages', expect.objectContaining({
        model: 'claude-3-opus-20240229',
        messages: expect.any(Array),
        max_tokens: 4000,
        temperature: 0.2
      }));
    });
  });

  describe('analyzeVulnerabilities', () => {
    beforeEach(() => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-key');
    });

    it('should analyze vulnerabilities using Claude API', async () => {
      const code = 'eval(userInput);';
      const claudeResponse = {
        content: [{
          text: JSON.stringify({
            vulnerabilities: [{
              name: 'Code Injection',
              description: 'Eval of user input',
              severity: 'critical',
              cveId: 'CVE-2023-1234'
            }],
            analysisReport: 'Critical security vulnerability found'
          })
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

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
      const claudeResponse = {
        content: [{
          text: '```json\n{"vulnerabilities":[],"analysisReport":"No vulnerabilities found"}\n```'
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

      const result = await analyzeVulnerabilities('safe code');

      expect(result).toEqual({
        vulnerabilities: [],
        analysisReport: 'No vulnerabilities found'
      });
    });

    it('should handle invalid JSON response', async () => {
      const claudeResponse = {
        content: [{
          text: 'This is not valid JSON'
        }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

      const result = await analyzeVulnerabilities('code');

      expect(result).toEqual({
        vulnerabilities: [],
        analysisReport: 'This is not valid JSON'
      });
    });

    it('should use custom model when provided', async () => {
      const claudeResponse = {
        content: [{ text: '{"vulnerabilities":[],"analysisReport":"Done"}' }]
      };

      (safeApiCall as jest.Mock).mockResolvedValue(claudeResponse);

      await analyzeVulnerabilities('code', 'claude-3-haiku-20240307');

      expect(sanitizeRequestData).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-haiku-20240307'
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
      // Clear modules and re-mock @env with empty key
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
      
      jest.doMock('@env', () => ({
        CLAUDE_API_KEY: '',
        CLAUDE_API_BASE_URL: 'https://api.anthropic.com/v1'
      }));
      
      // Mock expo-constants to have no API key
      jest.doMock('expo-constants', () => ({
        __esModule: true,
        default: {
          expoConfig: {
            extra: {
              claudeApiKey: '', // Empty string
              claudeApiBaseUrl: 'https://api.anthropic.com/v1'
            }
          }
        }
      }));

      // Use require instead of dynamic import to avoid the experimental modules error
      const { deobfuscateCode: deobfuscateWithoutKey } = require('@/services/claude');

      await expect(deobfuscateWithoutKey('code')).rejects.toThrow('Failed to deobfuscate code: claude API key not found');
    });
  });
});