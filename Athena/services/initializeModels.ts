import { AIModel } from '@/types';
import { useAppStore } from '@/store';

// Default AI models
const defaultAIModels: AIModel[] = [
  // OpenAI Models
  {
    id: 'gpt-4',
    name: 'GPT-4',
    type: 'openai',
    description: 'Most capable GPT-4 model for complex analysis',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    isLocal: false,
    capabilities: ['text-analysis', 'code-analysis', 'pattern-detection']
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    type: 'openai',
    description: 'Fast and efficient model for quick analysis',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    isLocal: false,
    capabilities: ['text-analysis', 'code-analysis']
  },
  
  // Claude Models
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    type: 'claude',
    description: 'Most powerful Claude model for in-depth analysis',
    endpoint: 'https://api.anthropic.com/v1/messages',
    isLocal: false,
    capabilities: ['text-analysis', 'code-analysis', 'pattern-detection']
  },
  {
    id: 'claude-3-sonnet',
    name: 'Claude 3 Sonnet',
    type: 'claude',
    description: 'Balanced Claude model for general analysis',
    endpoint: 'https://api.anthropic.com/v1/messages',
    isLocal: false,
    capabilities: ['text-analysis', 'code-analysis']
  },
  
  // DeepSeek Models
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    type: 'deepseek',
    description: 'Specialized model for code analysis',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    isLocal: false,
    capabilities: ['code-analysis', 'pattern-detection']
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    type: 'deepseek',
    description: 'General purpose DeepSeek model',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    isLocal: false,
    capabilities: ['text-analysis', 'code-analysis']
  }
];

/**
 * Initialize AI models in the store
 */
export function initializeAIModels(): void {
  const { setAIModels } = useAppStore.getState();
  setAIModels(defaultAIModels);
  console.log('Initialized AI models:', defaultAIModels.length);
}

/**
 * Get default AI models
 */
export function getDefaultAIModels(): AIModel[] {
  return defaultAIModels;
}