// Test for analysis service
// Mock dependencies before imports
jest.mock('@/store', () => ({
  useAppStore: {
    getState: jest.fn()
  }
}));

jest.mock('@/utils/helpers', () => ({
  generateId: jest.fn(() => 'test-id-123')
}));

jest.mock('@/services/openai', () => ({
  deobfuscateCode: jest.fn(),
  analyzeVulnerabilities: jest.fn(),
  hasOpenAIApiKey: jest.fn()
}));

jest.mock('@/services/claude', () => ({
  deobfuscateCode: jest.fn(),
  analyzeVulnerabilities: jest.fn(),
  hasClaudeApiKey: jest.fn()
}));

jest.mock('@/services/deepseek', () => ({
  deobfuscateCode: jest.fn(),
  analyzeVulnerabilities: jest.fn(),
  hasDeepSeekApiKey: jest.fn()
}));

jest.mock('@/services/localModels', () => ({
  deobfuscateCode: jest.fn(),
  analyzeVulnerabilities: jest.fn()
}));

jest.mock('@/services/container-db', () => ({
  hasContainerConfig: jest.fn(),
  createContainer: jest.fn(),
  getContainerStatus: jest.fn(),
  runMalwareAnalysis: jest.fn(),
  getContainerFile: jest.fn(),
  getContainerMonitoringSummary: jest.fn(),
  getSuspiciousActivities: jest.fn(),
  getNetworkActivityByContainerId: jest.fn(),
  getFileActivityByContainerId: jest.fn(),
  getProcessActivityByContainerId: jest.fn(),
  removeContainer: jest.fn()
}));

jest.mock('@/services/fileManager', () => ({
  readFileContent: jest.fn(),
  readFileAsBase64: jest.fn()
}));

jest.mock('@/services/metasploit', () => ({
  hasMetasploitConfig: jest.fn(),
  enrichVulnerabilityData: jest.fn()
}));

// Import functions to test after mocks
import { deobfuscateCode, analyzeVulnerabilities, runAnalysis, getAvailableModels } from '@/services/analysisService';
import { useAppStore } from '@/store';
import * as openaiService from '@/services/openai';
import * as claudeService from '@/services/claude';
import * as deepseekService from '@/services/deepseek';
import * as localModelsService from '@/services/localModels';
import * as containerDbService from '@/services/container-db';
import * as fileManagerService from '@/services/fileManager';
import * as metasploitService from '@/services/metasploit';
import { AIModel, MalwareFile } from '@/types';

describe('AnalysisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deobfuscateCode', () => {
    const mockDeobfuscationResult = {
      deobfuscatedCode: 'function test() {}',
      analysisReport: 'This is a test function'
    };

    it('should deobfuscate code using OpenAI model', async () => {
      const model: AIModel = {
        id: 'openai-1',
        name: 'GPT-4',
        type: 'openai',
        modelId: 'gpt-4',
        icon: '🤖',
        isLocal: false
      };

      (openaiService.deobfuscateCode as jest.Mock).mockResolvedValue(mockDeobfuscationResult);

      const result = await deobfuscateCode('var _0x1234 = function() {};', model);

      expect(result).toEqual(mockDeobfuscationResult);
      expect(openaiService.deobfuscateCode).toHaveBeenCalledWith('var _0x1234 = function() {};', 'gpt-4');
    });

    it('should deobfuscate code using Claude model', async () => {
      const model: AIModel = {
        id: 'claude-1',
        name: 'Claude 3',
        type: 'claude',
        modelId: 'claude-3-opus',
        icon: '🧠',
        isLocal: false
      };

      (claudeService.deobfuscateCode as jest.Mock).mockResolvedValue(mockDeobfuscationResult);

      const result = await deobfuscateCode('var _0x1234 = function() {};', model);

      expect(result).toEqual(mockDeobfuscationResult);
      expect(claudeService.deobfuscateCode).toHaveBeenCalledWith('var _0x1234 = function() {};', 'claude-3-opus');
    });

    it('should deobfuscate code using DeepSeek model', async () => {
      const model: AIModel = {
        id: 'deepseek-1',
        name: 'DeepSeek Coder',
        type: 'deepseek',
        modelId: 'deepseek-coder',
        icon: '🔍',
        isLocal: false
      };

      (deepseekService.deobfuscateCode as jest.Mock).mockResolvedValue(mockDeobfuscationResult);

      const result = await deobfuscateCode('var _0x1234 = function() {};', model);

      expect(result).toEqual(mockDeobfuscationResult);
      expect(deepseekService.deobfuscateCode).toHaveBeenCalledWith('var _0x1234 = function() {};', 'deepseek-coder');
    });

    it('should deobfuscate code using local model', async () => {
      const model: AIModel = {
        id: 'local-1',
        name: 'Local Llama',
        type: 'local',
        modelId: 'llama-2',
        icon: '🦙',
        isLocal: true
      };

      (localModelsService.deobfuscateCode as jest.Mock).mockResolvedValue(mockDeobfuscationResult);

      const result = await deobfuscateCode('var _0x1234 = function() {};', model);

      expect(result).toEqual(mockDeobfuscationResult);
      expect(localModelsService.deobfuscateCode).toHaveBeenCalledWith('var _0x1234 = function() {};', 'local-1');
    });

    it('should throw error for unsupported model type', async () => {
      const model: AIModel = {
        id: 'unknown-1',
        name: 'Unknown Model',
        type: 'unknown' as any,
        modelId: 'unknown',
        icon: '❓',
        isLocal: false
      };

      await expect(deobfuscateCode('code', model)).rejects.toThrow('Failed to deobfuscate code: Unsupported model type: unknown');
    });
  });

  describe('analyzeVulnerabilities', () => {
    const mockVulnerabilityResult = {
      vulnerabilities: [
        {
          name: 'SQL Injection',
          description: 'User input not sanitized',
          severity: 'critical'
        }
      ],
      analysisReport: 'Found critical vulnerability'
    };

    beforeEach(() => {
      (metasploitService.hasMetasploitConfig as jest.Mock).mockResolvedValue(false);
    });

    it('should analyze vulnerabilities using OpenAI model', async () => {
      const model: AIModel = {
        id: 'openai-1',
        name: 'GPT-4',
        type: 'openai',
        modelId: 'gpt-4',
        icon: '🤖',
        isLocal: false
      };

      (openaiService.analyzeVulnerabilities as jest.Mock).mockResolvedValue(mockVulnerabilityResult);

      const result = await analyzeVulnerabilities('SELECT * FROM users WHERE id = $id', model);

      expect(result).toEqual(mockVulnerabilityResult);
      expect(openaiService.analyzeVulnerabilities).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $id', 'gpt-4');
    });

    it('should enrich vulnerabilities with Metasploit data when available', async () => {
      const model: AIModel = {
        id: 'openai-1',
        name: 'GPT-4',
        type: 'openai',
        modelId: 'gpt-4',
        icon: '🤖',
        isLocal: false
      };

      const enrichedVulnerabilities = [
        {
          name: 'SQL Injection',
          description: 'User input not sanitized',
          severity: 'critical',
          metasploitModule: 'exploit/multi/sql/injection'
        }
      ];

      (openaiService.analyzeVulnerabilities as jest.Mock).mockResolvedValue(mockVulnerabilityResult);
      (metasploitService.hasMetasploitConfig as jest.Mock).mockResolvedValue(true);
      (metasploitService.enrichVulnerabilityData as jest.Mock).mockResolvedValue(enrichedVulnerabilities);

      const result = await analyzeVulnerabilities('SELECT * FROM users WHERE id = $id', model);

      expect(result.vulnerabilities).toEqual(enrichedVulnerabilities);
      expect(metasploitService.enrichVulnerabilityData).toHaveBeenCalled();
    });

    it('should continue without enrichment if Metasploit enrichment fails', async () => {
      const model: AIModel = {
        id: 'openai-1',
        name: 'GPT-4',
        type: 'openai',
        modelId: 'gpt-4',
        icon: '🤖',
        isLocal: false
      };

      (openaiService.analyzeVulnerabilities as jest.Mock).mockResolvedValue(mockVulnerabilityResult);
      (metasploitService.hasMetasploitConfig as jest.Mock).mockResolvedValue(true);
      (metasploitService.enrichVulnerabilityData as jest.Mock).mockRejectedValue(new Error('Metasploit error'));

      const result = await analyzeVulnerabilities('SELECT * FROM users WHERE id = $id', model);

      expect(result).toEqual(mockVulnerabilityResult);
    });
  });

  describe('runAnalysis', () => {
    const mockMalwareFile: MalwareFile = {
      id: 'file-1',
      name: 'malware.js',
      content: 'var _0x1234 = function() {};',
      uri: 'file:///malware.js',
      timestamp: Date.now()
    };

    const mockModel: AIModel = {
      id: 'openai-1',
      name: 'GPT-4',
      type: 'openai',
      modelId: 'gpt-4',
      icon: '🤖',
      isLocal: false
    };

    const mockStore = {
      setIsAnalyzing: jest.fn(),
      addAnalysisResult: jest.fn(),
      addContainer: jest.fn(),
      updateContainer: jest.fn(),
      removeContainer: jest.fn()
    };

    beforeEach(() => {
      (useAppStore.getState as jest.Mock).mockReturnValue(mockStore);
      (containerDbService.hasContainerConfig as jest.Mock).mockResolvedValue(false);
      (openaiService.deobfuscateCode as jest.Mock).mockResolvedValue({
        deobfuscatedCode: 'function test() {}',
        analysisReport: 'Deobfuscation complete'
      });
      (openaiService.analyzeVulnerabilities as jest.Mock).mockResolvedValue({
        vulnerabilities: [],
        analysisReport: 'No vulnerabilities found'
      });
      (metasploitService.hasMetasploitConfig as jest.Mock).mockResolvedValue(false);
    });

    it('should run basic analysis without container', async () => {
      const result = await runAnalysis(mockMalwareFile, mockModel, false);

      expect(result).toEqual({
        id: 'test-id-123',
        malwareId: 'file-1',
        modelId: 'openai-1',
        timestamp: expect.any(Number),
        deobfuscatedCode: 'function test() {}',
        analysisReport: expect.stringContaining('Deobfuscation complete'),
        vulnerabilities: [],
        error: ''
      });

      expect(mockStore.setIsAnalyzing).toHaveBeenCalledWith(true);
      expect(mockStore.setIsAnalyzing).toHaveBeenCalledWith(false);
      expect(mockStore.addAnalysisResult).toHaveBeenCalled();
    });

    it('should read file content if not provided', async () => {
      const fileWithoutContent = { ...mockMalwareFile, content: '' };
      (fileManagerService.readFileContent as jest.Mock).mockResolvedValue('var _0x5678 = function() {};');

      await runAnalysis(fileWithoutContent, mockModel, false);

      expect(fileManagerService.readFileContent).toHaveBeenCalledWith('file:///malware.js');
      expect(openaiService.deobfuscateCode).toHaveBeenCalledWith('var _0x5678 = function() {};', 'gpt-4');
    });

    it('should handle analysis errors gracefully', async () => {
      (openaiService.deobfuscateCode as jest.Mock).mockRejectedValue(new Error('AI service error'));

      const result = await runAnalysis(mockMalwareFile, mockModel, false);

      expect(result.error).toBe('Failed to deobfuscate code: AI service error');
      expect(mockStore.setIsAnalyzing).toHaveBeenCalledWith(false);
    });
  });

  describe('getAvailableModels', () => {
    const mockModels: AIModel[] = [
      {
        id: 'openai-1',
        name: 'GPT-4',
        type: 'openai',
        modelId: 'gpt-4',
        icon: '🤖',
        isLocal: false
      },
      {
        id: 'claude-1',
        name: 'Claude 3',
        type: 'claude',
        modelId: 'claude-3-opus',
        icon: '🧠',
        isLocal: false
      },
      {
        id: 'local-1',
        name: 'Local Llama',
        type: 'local',
        modelId: 'llama-2',
        icon: '🦙',
        isLocal: true
      }
    ];

    beforeEach(() => {
      (useAppStore.getState as jest.Mock).mockReturnValue({
        aiModels: mockModels
      });
    });

    it('should return models with available API keys', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(true);
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(false);

      const result = await getAvailableModels();

      expect(result).toEqual([mockModels[0]]);
      expect(openaiService.hasOpenAIApiKey).toHaveBeenCalled();
      expect(claudeService.hasClaudeApiKey).toHaveBeenCalled();
    });

    it('should skip local models', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(true);
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(true);

      const result = await getAvailableModels();

      expect(result).toEqual([mockModels[0], mockModels[1]]);
      expect(result).not.toContainEqual(mockModels[2]);
    });

    it('should handle errors checking models', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockRejectedValue(new Error('API error'));
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(true);

      const result = await getAvailableModels();

      expect(result).toEqual([mockModels[1]]);
    });
  });
});