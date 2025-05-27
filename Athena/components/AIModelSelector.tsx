import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { AIModel } from '@/types';
import { useAppStore } from '@/store';
import * as analysisService from '@/services/analysisService';
import * as openaiService from '@/services/openai';
import * as claudeService from '@/services/claude';
import * as deepseekService from '@/services/deepseek';
import { useColorScheme } from '@/hooks';
import { Colors } from '@/constants/Colors';
import { AiFillRobot, AiFillOpenAI, AiFillMeh, AiOutlineQq, AiOutlineWeibo, AiOutlineSync } from 'react-icons/ai';
import { env } from '@/shared/config/environment';

interface AIModelSelectorProps {
  onModelSelect: (model: AIModel) => void;
}

export const AIModelSelector: React.FC<AIModelSelectorProps> = ({ onModelSelect }) => {
  const colorScheme = useColorScheme();
  const [loading, setLoading] = useState(true);
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const { aiModels, selectedModelId, selectAIModel } = useAppStore(state => ({
    aiModels: state.aiModels,
    selectedModelId: state.selectedModelId,
    selectAIModel: state.selectAIModel,
  }));
  
  useEffect(() => {
    loadAvailableModels();
  }, [aiModels]);
  
  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check for API keys using environment config and service functions
      let hasOpenAIKey = false;
      let hasClaudeKey = false;
      let hasDeepSeekKey = false;
      
      // First check environment configuration
      if (env.api.openai.enabled) {
        console.log('OpenAI enabled in environment config');
        hasOpenAIKey = true;
      }
      
      if (env.api.claude.enabled) {
        console.log('Claude enabled in environment config');
        hasClaudeKey = true;
      }
      
      if (env.api.deepseek.enabled) {
        console.log('DeepSeek enabled in environment config');
        hasDeepSeekKey = true;
      }
      
      // If not found in environment config, check using service functions
      if (!hasOpenAIKey) {
        try {
          hasOpenAIKey = await openaiService.hasOpenAIApiKey();
          console.log('OpenAI key check from service:', hasOpenAIKey);
        } catch (e) {
          console.error('Error checking OpenAI key with service:', e);
        }
      }
      
      if (!hasClaudeKey) {
        try {
          hasClaudeKey = await claudeService.hasClaudeApiKey();
          console.log('Claude key check from service:', hasClaudeKey);
        } catch (e) {
          console.error('Error checking Claude key with service:', e);
        }
      }
      
      if (!hasDeepSeekKey) {
        try {
          hasDeepSeekKey = await deepseekService.hasDeepSeekApiKey();
          console.log('DeepSeek key check from service:', hasDeepSeekKey);
        } catch (e) {
          console.error('Error checking DeepSeek key with service:', e);
        }
      }
      
      // Add models based on available API keys
      const availableModels: AIModel[] = [];
      
      // Add OpenAI models if API key exists
      if (hasOpenAIKey) {
        console.log('OpenAI API key is available');
        // Find all OpenAI models in the store
        const openaiModels = aiModels.filter(model => model.type === 'openai');
        if (openaiModels.length > 0) {
          console.log(`Adding ${openaiModels.length} OpenAI models to available models`);
          openaiModels.forEach(model => {
            console.log('- Adding OpenAI model:', model.name);
            availableModels.push(model);
          });
        } else {
          console.log('No OpenAI models found in aiModels');
        }
      } else {
        console.log('No OpenAI API key available');
      }
      
      // Add Claude models if API key exists
      if (hasClaudeKey) {
        console.log('Claude API key is available');
        // Find all Claude models in the store
        const claudeModels = aiModels.filter(model => model.type === 'claude');
        if (claudeModels.length > 0) {
          console.log(`Adding ${claudeModels.length} Claude models to available models`);
          claudeModels.forEach(model => {
            console.log('- Adding Claude model:', model.name);
            availableModels.push(model);
          });
        } else {
          console.log('No Claude models found in aiModels');
        }
      } else {
        console.log('No Claude API key available');
      }
      
      // Add DeepSeek models if API key exists
      if (hasDeepSeekKey) {
        console.log('DeepSeek API key is available');
        // Find all DeepSeek models in the store
        const deepseekModels = aiModels.filter(model => model.type === 'deepseek');
        if (deepseekModels.length > 0) {
          console.log(`Adding ${deepseekModels.length} DeepSeek models to available models`);
          deepseekModels.forEach(model => {
            console.log('- Adding DeepSeek model:', model.name);
            availableModels.push(model);
          });
        } else {
          console.log('No DeepSeek models found in aiModels');
        }
      } else {
        console.log('No DeepSeek API key available');
      }
      
      
      // If no models are available, try to use the service functions as a fallback
      if (availableModels.length === 0) {
        console.log('No models available from direct key check, trying service functions');
        try {
          const serviceModels = await analysisService.getAvailableModels();
          console.log('Models returned from analysisService:', serviceModels.length);
          availableModels.push(...serviceModels);
        } catch (serviceError) {
          console.error('Error getting models from service:', serviceError);
        }
      }
      
      console.log(`Found ${availableModels.length} available models`);
      setAvailableModels(availableModels);
      
      // If no model is selected and we have available models, select the first one
      if (!selectedModelId && availableModels.length > 0) {
        selectAIModel(availableModels[0].id);
        onModelSelect(availableModels[0]);
      } else if (selectedModelId) {
        // If a model is already selected, make sure it's in the available models
        const selectedModel = availableModels.find((model: AIModel) => model.id === selectedModelId);
        if (selectedModel) {
          onModelSelect(selectedModel);
        } else if (availableModels.length > 0) {
          // If the selected model is not available, select the first available one
          selectAIModel(availableModels[0].id);
          onModelSelect(availableModels[0]);
        }
      }
    } catch (error) {
      console.error('Error loading available models:', error);
      // Log more details about the error
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        setError(`Error: ${error.message}`);
      } else {
        setError('Failed to load available AI models. Please check your API keys in settings.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleModelSelect = (model: AIModel) => {
    selectAIModel(model.id);
    onModelSelect(model);
  };
  
  const getModelIcon = (type: string) => {
    switch (type) {
      case 'openai':
        return 'openai'; // Special case for OpenAI
      case 'claude':
        return 'person.circle';
      case 'deepseek':
        return 'magnifyingglass.circle';
      case 'local':
        return 'desktopcomputer';
      default:
        return 'questionmark.circle';
    }
  };
  
  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
        <ThemedText style={styles.loadingText}>Loading AI models...</ThemedText>
      </ThemedView>
    );
  }
  
  if (error) {
    return (
      <ThemedView style={styles.errorContainer}>
        <IconSymbol name="exclamationmark.triangle" size={24} color="#FF6B6B" />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={loadAvailableModels}>
          <ThemedText style={styles.retryButtonText}>Retry</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }
  
  if (availableModels.length === 0) {
    return (
      <ThemedView style={styles.emptyContainer}>
        <AiFillRobot size={24} color="#4A90E2" />
        <ThemedText style={styles.emptyText}>
          No AI models available. Please add API keys in settings.
        </ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={{ flex: 1 }}></View>
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={loadAvailableModels}
        >
          <AiOutlineSync size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.modelList}>
        {availableModels.map(model => (
          <TouchableOpacity
            key={model.id}
            style={[
              styles.modelItem,
              selectedModelId === model.id && styles.selectedModelItem,
            ]}
            onPress={() => handleModelSelect(model)}
          >
            <View style={styles.modelIconContainer}>
              {model.type === 'openai' ? (
                <AiFillOpenAI
                  size={24}
                  color="#FFFFFF" // Always white to contrast with pink background
                />
              ) : model.type === 'claude' ? (
                <AiFillMeh
                  size={24}
                  color="#FFFFFF" // Always white to contrast with pink background
                />
              ) : model.type === 'local' ? (
                <AiOutlineQq
                  size={24}
                  color="#FFFFFF" // Always white to contrast with pink background
                />
              ) : model.type === 'deepseek' ? (
                <AiOutlineWeibo
                  size={24}
                  color="#FFFFFF" // Always white to contrast with pink background
                />
              ) : (
                <IconSymbol
                  name={getModelIcon(model.type)}
                  size={24}
                  color="#FFFFFF" // Always white to contrast with pink background
                />
              )}
            </View>
            <View style={styles.modelInfo}>
              <ThemedText
                style={[
                  styles.modelName,
                  { color: '#000000' }, // Always black
                ]}
              >
                {model.name}
              </ThemedText>
              <ThemedText
                style={[
                  styles.modelDescription,
                  { color: '#000000' }, // Always black
                ]}
              >
                {model.isLocal ? 'Local Model' : 'Hosted Model'}
              </ThemedText>
            </View>
            {selectedModelId === model.id && (
              <IconSymbol name="checkmark.circle.fill" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 8,
    padding: 10,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#d76e8b', // Pink background color to match the header
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelList: {
    maxHeight: 300,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F0F0F0',
  },
  selectedModelItem: {
    backgroundColor: '#4A90E2',
  },
  modelIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#d76e8b', // Pink background color to match the header
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modelDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  selectedModelText: {
    color: '#000',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  errorContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    borderRadius: 8,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#4A90E2',
    borderRadius: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F8FF',
    borderRadius: 8,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 16,
    textAlign: 'center',
    color: '#000000',
  },
});
