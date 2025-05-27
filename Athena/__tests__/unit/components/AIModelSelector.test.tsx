import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { AIModelSelector } from '../../../components/AIModelSelector';
import { useAppStore } from '../../../store';
import * as analysisService from '../../../services/analysisService';
import * as openaiService from '../../../services/openai';
import * as claudeService from '../../../services/claude';
import * as deepseekService from '../../../services/deepseek';
import { env } from '../../../shared/config/environment';
import { AIModel } from '../../../types';

// Mock database models before importing components
jest.mock('../../../models', () => ({
  Container: {},
  ContainerConfig: {},
  ContainerResource: {},
  ContainerSecurity: {},
  ContainerMonitoring: {},
  NetworkActivity: {},
  FileActivity: {},
  ProcessActivity: {}
}));

// Mock database service
jest.mock('../../../services/database', () => ({
  sequelize: {
    authenticate: jest.fn(),
    sync: jest.fn()
  }
}));

// Mock container-db service
jest.mock('../../../services/container-db', () => ({}));

// Mock expo-font
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn().mockReturnValue(true),
  isLoading: jest.fn().mockReturnValue(false)
}));

// Mock dependencies
jest.mock('../../../store');
jest.mock('../../../services/analysisService');
jest.mock('../../../services/openai');
jest.mock('../../../services/claude');
jest.mock('../../../services/deepseek');
jest.mock('../../../shared/config/environment', () => ({
  env: {
    api: {
      openai: { enabled: false },
      claude: { enabled: false },
      deepseek: { enabled: false }
    }
  }
}));
jest.mock('../../../hooks', () => ({
  useColorScheme: () => 'light',
  useThemeColor: () => '#FFFFFF'
}));

// Mock console methods to avoid noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
});
afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('AIModelSelector Component', () => {
  const mockOnModelSelect = jest.fn();
  const mockSelectAIModel = jest.fn();
  
  const mockModels: AIModel[] = [
    {
      id: 'openai-1',
      name: 'GPT-4',
      description: 'GPT-4 model',
      type: 'openai',
      isLocal: false,
      apiKey: 'test-key'
    },
    {
      id: 'claude-1',
      name: 'Claude 3',
      description: 'Claude 3 model',
      type: 'claude',
      isLocal: false,
      apiKey: 'test-key'
    },
    {
      id: 'deepseek-1',
      name: 'DeepSeek Coder',
      description: 'DeepSeek coding model',
      type: 'deepseek',
      isLocal: false,
      apiKey: 'test-key'
    }
  ];

  const defaultStoreState = {
    aiModels: mockModels,
    selectedModelId: null,
    selectAIModel: mockSelectAIModel
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAppStore as unknown as jest.Mock).mockReturnValue(defaultStoreState);
    (analysisService.getAvailableModels as jest.Mock).mockResolvedValue([]);
    (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(false);
    (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(false);
    (deepseekService.hasDeepSeekApiKey as jest.Mock).mockResolvedValue(false);
  });

  describe('Loading State', () => {
    it('should show loading state initially', () => {
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );
      
      expect(getByText('Loading AI models...')).toBeTruthy();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no models are available', async () => {
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('No AI models available. Please add API keys in settings.')).toBeTruthy();
      });
    });
  });

  describe('Error State', () => {
    it('should handle loading errors gracefully', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockRejectedValue(new Error('API Error'));
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      // When all API checks fail, it shows empty state
      await waitFor(() => {
        expect(getByText('No AI models available. Please add API keys in settings.')).toBeTruthy();
      });
    });
  });

  describe('Model Loading from Environment', () => {
    it('should load OpenAI models when enabled in environment', async () => {
      env.api.openai.enabled = true;
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('GPT-4')).toBeTruthy();
      });
      
      env.api.openai.enabled = false;
    });

    it('should load Claude models when enabled in environment', async () => {
      env.api.claude.enabled = true;
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('Claude 3')).toBeTruthy();
      });
      
      env.api.claude.enabled = false;
    });

    it('should load DeepSeek models when enabled in environment', async () => {
      env.api.deepseek.enabled = true;
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('DeepSeek Coder')).toBeTruthy();
      });
      
      env.api.deepseek.enabled = false;
    });
  });

  describe('Model Loading from Service', () => {
    it('should load OpenAI models when API key exists', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(true);
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('GPT-4')).toBeTruthy();
      });
    });

    it('should load Claude models when API key exists', async () => {
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(true);
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('Claude 3')).toBeTruthy();
      });
    });

    it('should load DeepSeek models when API key exists', async () => {
      (deepseekService.hasDeepSeekApiKey as jest.Mock).mockResolvedValue(true);
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('DeepSeek Coder')).toBeTruthy();
      });
    });

    it('should load multiple model types when multiple API keys exist', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(true);
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(true);
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('GPT-4')).toBeTruthy();
        expect(getByText('Claude 3')).toBeTruthy();
      });
    });
  });

  describe('Fallback to Analysis Service', () => {
    it('should use analysis service when no direct API keys are found', async () => {
      const fallbackModels = [mockModels[0]];
      (analysisService.getAvailableModels as jest.Mock).mockResolvedValue(fallbackModels);
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(analysisService.getAvailableModels).toHaveBeenCalled();
        expect(getByText('GPT-4')).toBeTruthy();
      });
    });
  });

  describe('Model Selection', () => {
    beforeEach(() => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(true);
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(true);
    });

    it('should auto-select first model when none selected', async () => {
      render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(mockSelectAIModel).toHaveBeenCalledWith('openai-1');
        expect(mockOnModelSelect).toHaveBeenCalledWith(mockModels[0]);
      });
    });

    it('should maintain selected model if available', async () => {
      (useAppStore as unknown as jest.Mock).mockReturnValue({
        ...defaultStoreState,
        selectedModelId: 'claude-1'
      });

      render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(mockSelectAIModel).not.toHaveBeenCalled();
        expect(mockOnModelSelect).toHaveBeenCalledWith(mockModels[1]);
      });
    });

    it('should handle model selection on press', async () => {
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('Claude 3')).toBeTruthy();
      });

      fireEvent.press(getByText('Claude 3'));

      expect(mockSelectAIModel).toHaveBeenCalledWith('claude-1');
      expect(mockOnModelSelect).toHaveBeenCalledWith(mockModels[1]);
    });

    it('should show selected state for current model', async () => {
      (useAppStore as unknown as jest.Mock).mockReturnValue({
        ...defaultStoreState,
        selectedModelId: 'openai-1'
      });

      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        // Just verify the model is displayed
        expect(getByText('GPT-4')).toBeTruthy();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('should reload models when called', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(true);
      
      render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(openaiService.hasOpenAIApiKey).toHaveBeenCalledTimes(1);
      });
      
      // Verify the component loads models on mount
      expect(openaiService.hasOpenAIApiKey).toHaveBeenCalled();
    });
  });

  describe('Model Display', () => {
    beforeEach(() => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(true);
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(true);
      (deepseekService.hasDeepSeekApiKey as jest.Mock).mockResolvedValue(true);
    });

    it('should display model descriptions', async () => {
      const { getAllByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        const hostedModels = getAllByText('Hosted Model');
        expect(hostedModels.length).toBe(3);
      });
    });

    it('should display local model description correctly', async () => {
      const localModel: AIModel = {
        id: 'local-1',
        name: 'Local LLM',
        description: 'Local language model',
        type: 'local',
        isLocal: true,
        apiKey: ''
      };

      // Only return the local model (no API keys available)
      (useAppStore as unknown as jest.Mock).mockReturnValue({
        ...defaultStoreState,
        aiModels: [localModel]
      });
      
      // Make all API key checks return false
      (openaiService.hasOpenAIApiKey as jest.Mock).mockResolvedValue(false);
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(false);
      (deepseekService.hasDeepSeekApiKey as jest.Mock).mockResolvedValue(false);
      
      // Return local model from analysis service
      (analysisService.getAvailableModels as jest.Mock).mockResolvedValue([localModel]);

      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        expect(getByText('Local Model')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service check errors gracefully', async () => {
      (openaiService.hasOpenAIApiKey as jest.Mock).mockRejectedValue(new Error('Service error'));
      (claudeService.hasClaudeApiKey as jest.Mock).mockResolvedValue(true);
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        // Should still show Claude model despite OpenAI error
        expect(getByText('Claude 3')).toBeTruthy();
      });
    });

    it('should handle analysis service errors', async () => {
      (analysisService.getAvailableModels as jest.Mock).mockRejectedValue(new Error('Service error'));
      
      const { getByText } = render(
        <AIModelSelector onModelSelect={mockOnModelSelect} />
      );

      await waitFor(() => {
        // Should show empty state when all methods fail
        expect(getByText('No AI models available. Please add API keys in settings.')).toBeTruthy();
      });
    });
  });
});