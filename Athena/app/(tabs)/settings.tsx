import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ScrollView, TextInput, Switch, Image } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
import * as SecureStore from 'expo-secure-store';

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const [openAIKey, setOpenAIKey] = useState('');
  const [claudeKey, setClaudeKey] = useState('');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [useLocalModels, setUseLocalModels] = useState(false);
  const [localModelPath, setLocalModelPath] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Load saved API keys on component mount
  useEffect(() => {
    loadAPIKeys();
  }, []);
  
  const loadAPIKeys = async () => {
    try {
      const savedOpenAIKey = await SecureStore.getItemAsync('openai_api_key');
      const savedClaudeKey = await SecureStore.getItemAsync('claude_api_key');
      const savedDeepseekKey = await SecureStore.getItemAsync('deepseek_api_key');
      const savedUseLocalModels = await SecureStore.getItemAsync('use_local_models');
      const savedLocalModelPath = await SecureStore.getItemAsync('local_model_path');
      
      if (savedOpenAIKey) setOpenAIKey(savedOpenAIKey);
      if (savedClaudeKey) setClaudeKey(savedClaudeKey);
      if (savedDeepseekKey) setDeepseekKey(savedDeepseekKey);
      if (savedUseLocalModels) setUseLocalModels(savedUseLocalModels === 'true');
      if (savedLocalModelPath) setLocalModelPath(savedLocalModelPath);
    } catch (error) {
      console.error('Error loading API keys:', error);
      Alert.alert('Error', 'Failed to load saved API keys.');
    }
  };
  
  const saveAPIKeys = async () => {
    try {
      setIsSaving(true);
      
      // Save API keys securely
      await SecureStore.setItemAsync('openai_api_key', openAIKey);
      await SecureStore.setItemAsync('claude_api_key', claudeKey);
      await SecureStore.setItemAsync('deepseek_api_key', deepseekKey);
      await SecureStore.setItemAsync('use_local_models', useLocalModels.toString());
      await SecureStore.setItemAsync('local_model_path', localModelPath);
      
      Alert.alert('Success', 'API keys saved successfully.');
    } catch (error) {
      console.error('Error saving API keys:', error);
      Alert.alert('Error', 'Failed to save API keys.');
    } finally {
      setIsSaving(false);
    }
  };
  
  const clearAllAPIKeys = () => {
    Alert.alert(
      'Clear All API Keys',
      'Are you sure you want to clear all API keys? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync('openai_api_key');
              await SecureStore.deleteItemAsync('claude_api_key');
              await SecureStore.deleteItemAsync('deepseek_api_key');
              await SecureStore.deleteItemAsync('use_local_models');
              await SecureStore.deleteItemAsync('local_model_path');
              
              setOpenAIKey('');
              setClaudeKey('');
              setDeepseekKey('');
              setUseLocalModels(false);
              setLocalModelPath('');
              
              Alert.alert('Success', 'All API keys have been cleared.');
            } catch (error) {
              console.error('Error clearing API keys:', error);
              Alert.alert('Error', 'Failed to clear API keys.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };
  
  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#e47a9c', dark: '#d06c86' }}
      headerImage={
        <View style={styles.logoContainer}>
          <Image
            source={require('./../../assets/images/real-athena-logo.png')}
            style={[styles.reactLogo, styles.roundedImage]}
            resizeMode="contain"
          />
        </View>
      }
      title="Settings">
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={styles.titleText}>API Settings</ThemedText>
      </ThemedView>
      
      <ThemedText style={styles.description}>
        Configure your AI model API keys and settings. These keys are stored securely on your device.
      </ThemedText>
      
      <ScrollView style={styles.contentContainer}>
        <ThemedView style={styles.sectionContainer}>
          <ThemedText style={styles.sectionTitle}>OpenAI API</ThemedText>
          <ThemedView style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>API Key</ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: Colors[colorScheme ?? 'light'].text }
              ]}
              placeholder="Enter OpenAI API Key"
              placeholderTextColor="#AAAAAA"
              value={openAIKey}
              onChangeText={setOpenAIKey}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ThemedText style={styles.inputHelp}>
              Used for GPT-4 and other OpenAI models
            </ThemedText>
          </ThemedView>
        </ThemedView>
        
        <ThemedView style={styles.sectionContainer}>
          <ThemedText style={styles.sectionTitle}>Claude API</ThemedText>
          <ThemedView style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>API Key</ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: Colors[colorScheme ?? 'light'].text }
              ]}
              placeholder="Enter Claude API Key"
              placeholderTextColor="#AAAAAA"
              value={claudeKey}
              onChangeText={setClaudeKey}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ThemedText style={styles.inputHelp}>
              Used for Claude 3 Opus and other Anthropic models
            </ThemedText>
          </ThemedView>
        </ThemedView>
        
        <ThemedView style={styles.sectionContainer}>
          <ThemedText style={styles.sectionTitle}>DeepSeek API</ThemedText>
          <ThemedView style={styles.inputContainer}>
            <ThemedText style={styles.inputLabel}>API Key</ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: Colors[colorScheme ?? 'light'].text }
              ]}
              placeholder="Enter DeepSeek API Key"
              placeholderTextColor="#AAAAAA"
              value={deepseekKey}
              onChangeText={setDeepseekKey}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ThemedText style={styles.inputHelp}>
              Used for DeepSeek Coder and other DeepSeek models
            </ThemedText>
          </ThemedView>
        </ThemedView>
        
        <ThemedView style={styles.sectionContainer}>
          <ThemedText style={styles.sectionTitle}>Local Models</ThemedText>
          <ThemedView style={styles.switchContainer}>
            <ThemedText style={styles.switchLabel}>Flip Switch To Use Local Models</ThemedText>
            <Switch
              value={useLocalModels}
              onValueChange={setUseLocalModels}
              trackColor={{ false: '#767577', true: '#d06c86' }}
              thumbColor={useLocalModels ? '#e47a9c' : '#f4f3f4'}
            />
          </ThemedView>
          
          {useLocalModels && (
            <ThemedView style={styles.inputContainer}>
              <ThemedText style={styles.inputLabel}>Local Model Path</ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: Colors[colorScheme ?? 'light'].text }
                ]}
                placeholder="Enter path to local model"
                placeholderTextColor="#AAAAAA"
                value={localModelPath}
                onChangeText={setLocalModelPath}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ThemedText style={styles.inputHelp}>
                Path to locally installed AI models
              </ThemedText>
            </ThemedView>
          )}
        </ThemedView>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.saveButton]}
            onPress={saveAPIKeys}
            disabled={isSaving}
          >
            <IconSymbol name="checkmark" size={20} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.clearButton]}
            onPress={clearAllAPIKeys}
          >
            <IconSymbol name="trash" size={20} color="#FFFFFF" />
            <ThemedText style={styles.buttonText}>Clear All</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    backgroundColor: '#d76e8b',
    justifyContent: 'center',
    alignItems: 'center',
    height: 250,
    width: '100%',
  },
  reactLogo: {
    height: 200,
    width: 300,
    alignSelf: 'center',
  },
  roundedImage: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'Roboto-Bold',
  },
  description: {
    fontSize: 16,
    marginBottom: 20,
  },
  contentContainer: {
    flex: 1,
  },
  sectionContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#ffd1dd',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  inputContainer: {
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#000',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    padding: 10,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  inputHelp: {
    fontSize: 14,
    marginTop: 5,
    opacity: 0.7,
    color: '#000',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderRadius: 8,
    padding: 10,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
  },
  clearButton: {
    backgroundColor: '#FF6B6B',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});
