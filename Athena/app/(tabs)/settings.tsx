import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert, ScrollView, TextInput, Switch, Image } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useColorScheme } from '@/hooks';
import { Colors } from '@/constants/Colors';
import { useAppStore } from '@/store';
// Import services for API key management
import * as openaiService from '@/services/openai';
import * as claudeService from '@/services/claude';
import * as deepseekService from '@/services/deepseek';
// Import environment variables
import { OPENAI_API_KEY, CLAUDE_API_KEY, DEEPSEEK_API_KEY } from '@env';

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
      console.log('Loading API keys...');
      
      // Check for environment variables first
      if (OPENAI_API_KEY) {
        console.log('Found OpenAI key in environment variables');
        setOpenAIKey(OPENAI_API_KEY);
      }
      
      if (CLAUDE_API_KEY) {
        console.log('Found Claude key in environment variables');
        setClaudeKey(CLAUDE_API_KEY);
      }
      
      if (DEEPSEEK_API_KEY) {
        console.log('Found DeepSeek key in environment variables');
        setDeepseekKey(DEEPSEEK_API_KEY);
      }
      
      // Try to load using service functions next
      let hasOpenAIKey = false;
      let hasClaudeKey = false;
      let hasDeepSeekKey = false;
      
      try {
        hasOpenAIKey = await openaiService.hasOpenAIApiKey();
        hasClaudeKey = await claudeService.hasClaudeApiKey();
        hasDeepSeekKey = await deepseekService.hasDeepSeekApiKey();
        
        console.log('Service API key checks:');
        console.log('- OpenAI key exists:', hasOpenAIKey);
        console.log('- Claude key exists:', hasClaudeKey);
        console.log('- DeepSeek key exists:', hasDeepSeekKey);
      } catch (serviceError) {
        console.error('Error checking API keys with services:', serviceError);
      }
      
      // Try to load from AsyncStorage via the service functions
      try {
        if (hasOpenAIKey && !openAIKey) {
          const key = await openaiService.initOpenAI();
          if (key) setOpenAIKey(key.apiKey || '');
        }
        
        if (hasClaudeKey && !claudeKey) {
          const key = await claudeService.initClaude();
          if (key) setClaudeKey(key);
        }
        
        if (hasDeepSeekKey && !deepseekKey) {
          const key = await deepseekService.initDeepSeek();
          if (key) setDeepseekKey(key);
        }
      } catch (error) {
        console.error('Error loading keys from services:', error);
      }
      
      // Load local model settings
      let savedUseLocalModels = null;
      let savedLocalModelPath = null;
      
      // Try AsyncStorage for local model settings
      try {
        // This would use AsyncStorage in a real implementation
        // For now, we'll keep the localStorage fallback for web
        if (typeof window !== 'undefined' && window.localStorage) {
          savedUseLocalModels = localStorage.getItem('use_local_models');
          savedLocalModelPath = localStorage.getItem('local_model_path');
        }
      } catch (e) {
        console.error('Error loading local model settings:', e);
      }
      
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
      
      console.log('Saving API keys...');
      console.log('OpenAI key length:', openAIKey ? openAIKey.length : 0);
      console.log('Claude key length:', claudeKey ? claudeKey.length : 0);
      console.log('DeepSeek key length:', deepseekKey ? deepseekKey.length : 0);
      
      // Save API keys using service functions
      console.log('Saving OpenAI API key');
      await openaiService.saveOpenAIApiKey(openAIKey);
      await claudeService.saveClaudeApiKey(claudeKey);
      await deepseekService.saveDeepSeekApiKey(deepseekKey);
      
      // Save local model settings
      // For now, we'll keep the localStorage fallback for web
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem('use_local_models', useLocalModels.toString());
          localStorage.setItem('local_model_path', localModelPath);
          console.log('Saved local model settings');
        } catch (e) {
          console.error('Error saving local model settings:', e);
        }
      }
      
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
              // Delete API keys using service functions
              try {
                await openaiService.deleteOpenAIApiKey();
                await claudeService.deleteClaudeApiKey();
                await deepseekService.deleteDeepSeekApiKey();
              } catch (serviceError) {
                console.error('Error deleting API keys using service functions:', serviceError);
                // Continue with other deletion methods
              }
              
              // Clear local model settings
              if (typeof window !== 'undefined' && window.localStorage) {
                try {
                  localStorage.removeItem('use_local_models');
                  localStorage.removeItem('local_model_path');
                  console.log('Cleared local model settings');
                } catch (e) {
                  console.error('Error clearing local model settings:', e);
                }
              }
              
              // Clear the text fields immediately
              setOpenAIKey('');
              setClaudeKey('');
              setDeepseekKey('');
              setUseLocalModels(false);
              setLocalModelPath('');
              
              // Force a re-render to ensure the UI updates
              setTimeout(() => {
                setOpenAIKey('');
                setClaudeKey('');
                setDeepseekKey('');
              }, 100);
              
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
            source={require('./../../assets/images/logo.png')}
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
            <View style={styles.inputLabelContainer}>
              <ThemedText style={styles.inputLabel}>API Key</ThemedText>
              <View style={styles.buttonGroup}>
                <View style={styles.buttonGroup}>
                  <TouchableOpacity 
                    onPress={async () => {
                      try {
                        console.log('Save button pressed for OpenAI API key, length:', openAIKey.length);
                        
                        // Save using service function
                        console.log('Saving OpenAI API key using service function...');
                        await openaiService.saveOpenAIApiKey(openAIKey);
                        
                        // For web environments, use localStorage
                        if (typeof window !== 'undefined' && window.localStorage) {
                          try {
                            console.log('Saving OpenAI API key to localStorage...');
                            localStorage.setItem('athena_openai_api_key', openAIKey);
                          } catch (e) {
                            console.error('Error saving to localStorage:', e);
                          }
                        }
                        
                        // Check if the key is available using the service function
                        const hasKey = await openaiService.hasOpenAIApiKey();
                        console.log('openaiService.hasOpenAIApiKey() returns:', hasKey);
                        
                        Alert.alert('Success', 'OpenAI API key saved successfully.');
                      } catch (error) {
                        console.error('Error saving OpenAI API key:', error);
                        Alert.alert('Error', `Failed to save OpenAI API key: ${(error as Error).message}`);
                      }
                    }}
                    style={styles.saveFieldButton}
                  >
                    <ThemedText style={styles.fieldButtonText}>Save</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => {
                      setOpenAIKey('');
                      openaiService.deleteOpenAIApiKey();
                    }}
                    style={styles.clearFieldButton}
                  >
                    <ThemedText style={styles.fieldButtonText}>Clear</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={async () => {
                      try {
                        // Check if API key is available
                        const hasKey = await openaiService.hasOpenAIApiKey();
                        
                        // Check localStorage
                        let localStorageKey = null;
                        if (typeof window !== 'undefined' && window.localStorage) {
                          localStorageKey = localStorage.getItem('athena_openai_api_key');
                        }
                        
                        // Show results
                        Alert.alert(
                          'OpenAI API Key Check',
                          `Service check: ${hasKey ? 'Available' : 'Not available'}
                          
LocalStorage: ${localStorageKey ? `Available (${localStorageKey.length} chars)` : 'Not available'}`
                        );
                      } catch (error) {
                        console.error('Error checking OpenAI API key:', error);
                        Alert.alert('Error', `Failed to check OpenAI API key: ${(error as Error).message}`);
                      }
                    }}
                    style={styles.checkFieldButton}
                  >
                    <ThemedText style={styles.fieldButtonText}>Check</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
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
            <View style={styles.inputLabelContainer}>
              <ThemedText style={styles.inputLabel}>API Key</ThemedText>
              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                      console.log('Save button pressed for Claude API key, length:', claudeKey.length);
                      
                      // Save using service function
                      console.log('Saving Claude API key using service function...');
                      await claudeService.saveClaudeApiKey(claudeKey);
                      
                      // For web environments, use localStorage
                      if (typeof window !== 'undefined' && window.localStorage) {
                        try {
                          console.log('Saving Claude API key to localStorage...');
                          localStorage.setItem('athena_claude_api_key', claudeKey);
                        } catch (e) {
                          console.error('Error saving to localStorage:', e);
                        }
                      }
                      
                      // Check if the key is available using the service function
                      const hasKey = await claudeService.hasClaudeApiKey();
                      console.log('claudeService.hasClaudeApiKey() returns:', hasKey);
                      
                      Alert.alert('Success', 'Claude API key saved successfully.');
                    } catch (error) {
                      console.error('Error saving Claude API key:', error);
                      Alert.alert('Error', `Failed to save Claude API key: ${(error as Error).message}`);
                    }
                  }}
                  style={styles.saveFieldButton}
                >
                  <ThemedText style={styles.fieldButtonText}>Save</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    setClaudeKey('');
                    claudeService.deleteClaudeApiKey();
                  }}
                  style={styles.clearFieldButton}
                >
                  <ThemedText style={styles.fieldButtonText}>Clear</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                      // Check if API key is available
                      const hasKey = await claudeService.hasClaudeApiKey();
                      
                      // Check localStorage
                      let localStorageKey = null;
                      if (typeof window !== 'undefined' && window.localStorage) {
                        localStorageKey = localStorage.getItem('athena_claude_api_key');
                      }
                      
                      // Show results
                      Alert.alert(
                        'Claude API Key Check',
                        `Service check: ${hasKey ? 'Available' : 'Not available'}
                        
LocalStorage: ${localStorageKey ? `Available (${localStorageKey.length} chars)` : 'Not available'}`
                      );
                    } catch (error) {
                      console.error('Error checking Claude API key:', error);
                      Alert.alert('Error', `Failed to check Claude API key: ${(error as Error).message}`);
                    }
                  }}
                  style={styles.checkFieldButton}
                >
                  <ThemedText style={styles.fieldButtonText}>Check</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
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
            <View style={styles.inputLabelContainer}>
              <ThemedText style={styles.inputLabel}>API Key</ThemedText>
              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                      console.log('Save button pressed for DeepSeek API key, length:', deepseekKey.length);
                      
                      // Save using service function
                      console.log('Saving DeepSeek API key using service function...');
                      await deepseekService.saveDeepSeekApiKey(deepseekKey);
                      
                      // For web environments, use localStorage
                      if (typeof window !== 'undefined' && window.localStorage) {
                        try {
                          console.log('Saving DeepSeek API key to localStorage...');
                          localStorage.setItem('athena_deepseek_api_key', deepseekKey);
                        } catch (e) {
                          console.error('Error saving to localStorage:', e);
                        }
                      }
                      
                      // Check if the key is available using the service function
                      const hasKey = await deepseekService.hasDeepSeekApiKey();
                      console.log('deepseekService.hasDeepSeekApiKey() returns:', hasKey);
                      
                      Alert.alert('Success', 'DeepSeek API key saved successfully.');
                    } catch (error) {
                      console.error('Error saving DeepSeek API key:', error);
                      Alert.alert('Error', `Failed to save DeepSeek API key: ${(error as Error).message}`);
                    }
                  }}
                  style={styles.saveFieldButton}
                >
                  <ThemedText style={styles.fieldButtonText}>Save</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => {
                    setDeepseekKey('');
                    deepseekService.deleteDeepSeekApiKey();
                  }}
                  style={styles.clearFieldButton}
                >
                  <ThemedText style={styles.fieldButtonText}>Clear</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={async () => {
                    try {
                      // Check if API key is available
                      const hasKey = await deepseekService.hasDeepSeekApiKey();
                      
                      // Check localStorage
                      let localStorageKey = null;
                      if (typeof window !== 'undefined' && window.localStorage) {
                        localStorageKey = localStorage.getItem('athena_deepseek_api_key');
                      }
                      
                      // Show results
                      Alert.alert(
                        'DeepSeek API Key Check',
                        `Service check: ${hasKey ? 'Available' : 'Not available'}
                        
LocalStorage: ${localStorageKey ? `Available (${localStorageKey.length} chars)` : 'Not available'}`
                      );
                    } catch (error) {
                      console.error('Error checking DeepSeek API key:', error);
                      Alert.alert('Error', `Failed to check DeepSeek API key: ${(error as Error).message}`);
                    }
                  }}
                  style={styles.checkFieldButton}
                >
                  <ThemedText style={styles.fieldButtonText}>Check</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
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
  inputLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  saveFieldButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  clearFieldButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  checkFieldButton: {
    backgroundColor: '#4A90E2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  fieldButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
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
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#4A90E2',
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
