import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { ThemedText } from './ThemedText';
import { ThemedView } from './ThemedView';
import { IconSymbol } from './ui/IconSymbol';
import { AIModel } from '@/types';
import { useAppStore } from '@/store';
import * as analysisService from '@/services/analysisService';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

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
  }, []);
  
  const loadAvailableModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const models = await analysisService.getAvailableModels();
      setAvailableModels(models);
      
      // If no model is selected and we have available models, select the first one
      if (!selectedModelId && models.length > 0) {
        selectAIModel(models[0].id);
        onModelSelect(models[0]);
      } else if (selectedModelId) {
        // If a model is already selected, make sure it's in the available models
        const selectedModel = models.find(model => model.id === selectedModelId);
        if (selectedModel) {
          onModelSelect(selectedModel);
        } else if (models.length > 0) {
          // If the selected model is not available, select the first available one
          selectAIModel(models[0].id);
          onModelSelect(models[0]);
        }
      }
    } catch (error) {
      console.error('Error loading available models:', error);
      setError('Failed to load available AI models. Please check your API keys in settings.');
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
        return 'sparkles';
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
        <IconSymbol name="info.circle" size={24} color="#4A90E2" />
        <ThemedText style={styles.emptyText}>
          No AI models available. Please add API keys in settings.
        </ThemedText>
      </ThemedView>
    );
  }
  
  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Select AI Model</ThemedText>
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
              <IconSymbol
                name={getModelIcon(model.type)}
                size={24}
                color={selectedModelId === model.id ? '#FFFFFF' : Colors[colorScheme ?? 'light'].text}
              />
            </View>
            <View style={styles.modelInfo}>
              <ThemedText
                style={[
                  styles.modelName,
                  selectedModelId === model.id && styles.selectedModelText,
                ]}
              >
                {model.name}
              </ThemedText>
              <ThemedText
                style={[
                  styles.modelDescription,
                  selectedModelId === model.id && styles.selectedModelText,
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
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
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
    color: '#FFFFFF',
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
    backgroundColor: '#FFF0F0',
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
  },
});
