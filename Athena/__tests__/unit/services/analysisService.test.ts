// Test for analysis service
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AIModel, MalwareFile } from '@/types';
import { deobfuscateCode, analyzeVulnerabilities, runAnalysis, getAvailableModels } from '@/services/analysisService';
import { useAppStore } from '@/store';
import * as openaiService from '@/services/openai';
import * as claudeService from '@/services/claude';
import * as deepseekService from '@/services/deepseek';
import * as localModelsService from '@/services/localModels';
import * as containerDbService from '@/services/container-db';
import * as fileManagerService from '@/services/fileManager';
import * as metasploitService from '@/services/metasploit';

// Mock dependencies
vi.mock('@/store', () => ({
  useAppStore: {
    getState: vi.fn()
  }
}));

vi.mock('@/utils/helpers', () => ({
  generateId: vi.fn(() => 'test-id-123')
}));

vi.mock('@/services/openai', () => ({
  deobfuscateCode: vi.fn(),
  analyzeVulnerabilities: vi.fn(),
  hasOpenAIApiKey: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/services/claude', () => ({
  deobfuscateCode: vi.fn(),
  analyzeVulnerabilities: vi.fn(),
  hasClaudeApiKey: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/services/deepseek', () => ({
  deobfuscateCode: vi.fn(),
  analyzeVulnerabilities: vi.fn(),
  hasDeepSeekApiKey: vi.fn().mockResolvedValue(false)
}));

vi.mock('@/services/localModels', () => ({
  deobfuscateCode: vi.fn(),
  analyzeVulnerabilities: vi.fn()
}));

vi.mock('@/services/container-db', () => ({
  hasContainerConfig: vi.fn(),
  createContainer: vi.fn(),
  getContainerStatus: vi.fn(),
  runMalwareAnalysis: vi.fn(),
  getContainerFile: vi.fn(),
  getContainerMonitoringSummary: vi.fn(),
  getSuspiciousActivities: vi.fn(),
  getNetworkActivityByContainerId: vi.fn(),
  getFileActivityByContainerId: vi.fn(),
  getProcessActivityByContainerId: vi.fn(),
  removeContainer: vi.fn()
}));

vi.mock('@/services/fileManager', () => ({
  readFileContent: vi.fn(),
  readFileAsBase64: vi.fn(),
  readFileAsText: vi.fn()
}));

vi.mock('@/services/metasploit', () => ({
  hasMetasploitConfig: vi.fn(),
  enrichVulnerabilityData: vi.fn()
}));

describe('AnalysisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        description: 'OpenAI GPT-4 model',
        isLocal: false
      };

      vi.mocked(openaiService.deobfuscateCode).mockResolvedValue(mockDeobfuscationResult);

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
        description: 'Claude 3 Opus model',
        isLocal: false
      };

      vi.mocked(claudeService.deobfuscateCode).mockResolvedValue(mockDeobfuscationResult);

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
        description: 'DeepSeek Coder model',
        isLocal: false
      };

      vi.mocked(deepseekService.deobfuscateCode).mockResolvedValue(mockDeobfuscationResult);

      const result = await deobfuscateCode('var _0x1234 = function() {};', model);

      expect(result).toEqual(mockDeobfuscationResult);
      expect(deepseekService.deobfuscateCode).toHaveBeenCalledWith('var _0x1234 = function() {};', 'deepseek-coder');
    });

    it('should deobfuscate code using local model', async () => {
      const model: AIModel = {
        id: 'local-1',
        name: 'Local Llama',
        type: 'local',
        modelId: 'local-1',
        description: 'Local Llama model',
        isLocal: true
      };

      vi.mocked(localModelsService.deobfuscateCode).mockResolvedValue(mockDeobfuscationResult);

      const result = await deobfuscateCode('var _0x1234 = function() {};', model);

      expect(result).toEqual(mockDeobfuscationResult);
      expect(localModelsService.deobfuscateCode).toHaveBeenCalledWith('var _0x1234 = function() {};', 'local-1');
    });

    it('should throw error for unknown model type', async () => {
      const model: AIModel = {
        id: 'unknown-1',
        name: 'Unknown Model',
        type: 'unknown' as any,
        modelId: 'unknown',
        description: 'Unknown model',
        isLocal: false
      };

      await expect(deobfuscateCode('test', model)).rejects.toThrow('Unsupported model type: unknown');
    });
  });

  describe('analyzeVulnerabilities', () => {
    const mockVulnerabilityResult = {
      vulnerabilities: [
        {
          id: '1',
          name: 'Cross-Site Scripting',
          severity: 'high' as const,
          description: 'Cross-site scripting vulnerability in user input',
          cveId: 'CVE-2023-0001'
        }
      ],
      analysisReport: 'Found 1 vulnerability'
    };

    it('should analyze vulnerabilities using OpenAI model', async () => {
      const model: AIModel = {
        id: 'openai-1',
        name: 'GPT-4',
        type: 'openai',
        modelId: 'gpt-4',
        description: 'OpenAI GPT-4 model',
        isLocal: false
      };

      vi.mocked(openaiService.analyzeVulnerabilities).mockResolvedValue(mockVulnerabilityResult);

      const result = await analyzeVulnerabilities('function test() {}', model);

      expect(result).toEqual(mockVulnerabilityResult);
      expect(openaiService.analyzeVulnerabilities).toHaveBeenCalledWith('function test() {}', 'gpt-4');
    });
  });

  describe('runAnalysis', () => {
    const mockFile: MalwareFile = {
      id: 'file-1',
      name: 'test.js',
      type: 'application/javascript',
      size: 1024,
      uri: 'file://test.js'
    };

    const mockModel: AIModel = {
      id: 'openai-1',
      name: 'GPT-4',
      type: 'openai',
      modelId: 'gpt-4',
      description: 'OpenAI GPT-4 model',
      isLocal: false
    };

    beforeEach(() => {
      vi.mocked(useAppStore.getState).mockReturnValue({
        analyses: [],
        currentAnalysis: null,
        addAnalysis: vi.fn(),
        updateAnalysis: vi.fn(),
        setCurrentAnalysis: vi.fn(),
        setIsAnalyzing: vi.fn(),
        addAnalysisResult: vi.fn(),
        aiModels: [
          {
            id: 'openai-1',
            name: 'GPT-4',
            type: 'openai',
            modelId: 'gpt-4',
            description: 'OpenAI GPT-4 model',
            isLocal: false
          },
          {
            id: 'local-1',
            name: 'Local Model',
            type: 'local',
            modelId: 'local-1',
            description: 'Local model',
            isLocal: true
          }
        ]
      } as any);

      vi.mocked(fileManagerService.readFileAsText).mockResolvedValue('function test() {}');
      vi.mocked(containerDbService.hasContainerConfig).mockResolvedValue(false);
      vi.mocked(metasploitService.hasMetasploitConfig).mockResolvedValue(false);
    });

    it('should run basic analysis without container', async () => {
      const mockDeobfuscationResult = {
        deobfuscatedCode: 'function test() {}',
        analysisReport: 'Clean code'
      };

      const mockVulnerabilityResult = {
        vulnerabilities: [],
        analysisReport: 'No vulnerabilities found'
      };

      vi.mocked(openaiService.deobfuscateCode).mockResolvedValue(mockDeobfuscationResult);
      vi.mocked(openaiService.analyzeVulnerabilities).mockResolvedValue(mockVulnerabilityResult);

      const result = await runAnalysis(mockFile, mockModel, false);

      expect(result).toBeDefined();
      expect(result.malwareId).toBe(mockFile.id);
      expect(result.modelId).toBe(mockModel.id);
      expect(result.deobfuscatedCode).toBe('function test() {}');
      expect(result.vulnerabilities).toEqual([]);
    });

    it('should handle analysis errors gracefully', async () => {
      vi.mocked(fileManagerService.readFileAsText).mockRejectedValue(new Error('File read error'));

      const result = await runAnalysis(mockFile, mockModel, false);

      expect(result).toBeDefined();
      expect(result.error).toBe('File read error');
    });
  });

  describe('getAvailableModels', () => {
    it('should return models with API keys configured', async () => {
      // Mock the store to return AI models
      vi.mocked(useAppStore.getState).mockReturnValue({
        aiModels: [
          {
            id: 'openai-1',
            name: 'GPT-4',
            type: 'openai',
            modelId: 'gpt-4',
            description: 'OpenAI GPT-4 model',
            isLocal: false
          },
          {
            id: 'claude-1',
            name: 'Claude 3',
            type: 'claude',
            modelId: 'claude-3',
            description: 'Claude 3 model',
            isLocal: false
          },
          {
            id: 'deepseek-1',
            name: 'DeepSeek Coder',
            type: 'deepseek',
            modelId: 'deepseek-coder',
            description: 'DeepSeek Coder model',
            isLocal: false
          },
          {
            id: 'local-1',
            name: 'Local Model',
            type: 'local',
            modelId: 'local-1',
            description: 'Local model',
            isLocal: true
          }
        ]
      } as any);

      vi.mocked(openaiService.hasOpenAIApiKey).mockResolvedValue(true);
      vi.mocked(claudeService.hasClaudeApiKey).mockResolvedValue(false);
      vi.mocked(deepseekService.hasDeepSeekApiKey).mockResolvedValue(true);

      const models = await getAvailableModels();

      const openaiModels = models.filter(m => m.type === 'openai');
      const claudeModels = models.filter(m => m.type === 'claude');
      const deepseekModels = models.filter(m => m.type === 'deepseek');
      const localModels = models.filter(m => m.type === 'local');

      expect(openaiModels.length).toBeGreaterThan(0);
      expect(claudeModels.length).toBe(0);
      expect(deepseekModels.length).toBeGreaterThan(0);
      expect(localModels.length).toBe(0); // Local models are skipped by getAvailableModels
    });
  });
});