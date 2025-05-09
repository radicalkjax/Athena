import { createOpenAIClient, safeApiCall, sanitizeRequestData } from './apiClient';
import { sanitizeString } from '@/utils/helpers';
import { OPENAI_API_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// API key storage - using AsyncStorage for persistence
let cachedApiKey: string | null = null;
let cachedBaseUrl: string | null = null;

/**
 * Initialize OpenAI client with API key
 * @param apiKey Optional API key to use instead of stored key
 * @param baseUrl Optional base URL to use instead of stored URL
 * @returns Axios instance configured for OpenAI
 */
export const initOpenAI = async (apiKey?: string, baseUrl?: string): Promise<ReturnType<typeof createOpenAIClient>> => {
  try {
    // Use provided API key or retrieve from storage
    let key = apiKey || cachedApiKey;
    let url = baseUrl || cachedBaseUrl || 'https://api.openai.com/v1';
    
    if (!key) {
      // Try to get from environment variable
      key = OPENAI_API_KEY || Constants.manifest?.extra?.openaiApiKey || null;
    }
    
    if (!key) {
      // Try to get from AsyncStorage
      try {
        key = await AsyncStorage.getItem('athena_openai_api_key');
        console.log('Checking AsyncStorage for OpenAI key:', !!key);
      } catch (error) {
        console.error('Error accessing AsyncStorage:', error);
      }
    }
    
    if (!key) {
      throw new Error('OpenAI API key not found. Please set your API key in the settings or .env file.');
    }
    
    console.log('Initializing OpenAI client with key');
    
    return createOpenAIClient(key, url);
  } catch (error) {
    console.error('Error initializing OpenAI client:', error);
    throw error;
  }
};

/**
 * Save OpenAI API configuration to storage
 * @param apiKey The API key to save
 * @param baseUrl Optional base URL to save
 */
export const saveOpenAIApiKey = async (apiKey: string, baseUrl?: string): Promise<void> => {
  try {
    // Cache the API key in memory
    cachedApiKey = apiKey;
    
    // Cache the base URL in memory if provided
    if (baseUrl) {
      cachedBaseUrl = baseUrl;
    }
    
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('athena_openai_api_key', apiKey);
      console.log('Saved OpenAI API key to AsyncStorage');
    } catch (error) {
      console.error('Error saving to AsyncStorage:', error);
    }
    
    console.log('Saved OpenAI API key to memory cache');
  } catch (error) {
    console.error('Error saving OpenAI API key:', error);
    throw error;
  }
};

/**
 * Check if OpenAI API key is stored
 * @returns True if API key exists, false otherwise
 */
export const hasOpenAIApiKey = async (): Promise<boolean> => {
  // Check memory cache first
  if (cachedApiKey) {
    return true;
  }
  
  // Check environment variable
  if (OPENAI_API_KEY || Constants.manifest?.extra?.openaiApiKey) {
    cachedApiKey = OPENAI_API_KEY || Constants.manifest?.extra?.openaiApiKey; // Cache it for future use
    return true;
  }
  
  // Check AsyncStorage
  try {
    const key = await AsyncStorage.getItem('athena_openai_api_key');
    if (key) {
      cachedApiKey = key; // Cache it for future use
      
      // Also cache the base URL if it exists
      const baseUrl = localStorage.getItem('athena_openai_base_url');
      if (baseUrl) {
        cachedBaseUrl = baseUrl;
      }
      
      return true;
    }
  } catch (error) {
    console.error('Error accessing AsyncStorage:', error);
  }
  
  return false;
};

/**
 * Delete stored OpenAI API configuration
 */
export const deleteOpenAIApiKey = async (): Promise<void> => {
  try {
    // Clear memory cache
    cachedApiKey = null;
    cachedBaseUrl = null;
    
    // Clear from AsyncStorage
    try {
      await AsyncStorage.removeItem('athena_openai_api_key');
      console.log('Deleted OpenAI API key from AsyncStorage');
    } catch (error) {
      console.error('Error deleting from AsyncStorage:', error);
    }
    
    console.log('Deleted OpenAI API configuration from memory cache');
  } catch (error) {
    console.error('Error deleting OpenAI API configuration:', error);
  }
};

/**
 * Deobfuscate code using OpenAI
 * @param code The obfuscated code to analyze
 * @param modelId Optional model ID to use (defaults to gpt-4-turbo)
 * @returns Deobfuscated code and analysis
 */
export const deobfuscateCode = async (
  code: string,
  modelId: string = 'gpt-4-turbo'
): Promise<{ deobfuscatedCode: string; analysisReport: string }> => {
  try {
    const openaiClient = await initOpenAI();
    
    // Sanitize input for security
    const sanitizedCode = sanitizeString(code);
    
    const systemPrompt = `You are an expert malware analyst and reverse engineer. Your task is to deobfuscate the provided code and explain what it does. 
    Focus on:
    1. Identifying obfuscation techniques used
    2. Revealing the actual functionality
    3. Identifying potential malicious behaviors
    4. Providing a clean, readable version of the code
    5. Explaining any evasion techniques used
    
    Return your response in two parts:
    1. DEOBFUSCATED CODE: The clean, readable version of the code
    2. ANALYSIS: Your detailed explanation of what the code does and any security concerns`;
    
    const requestData = sanitizeRequestData({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze and deobfuscate this code:\n\n${sanitizedCode}` }
      ],
      temperature: 0.2, // Lower temperature for more deterministic results
      max_tokens: 4000,
    });
    
    const response = await safeApiCall(
      () => openaiClient.post('/chat/completions', requestData),
      'OpenAI deobfuscation error'
    );
    
    const content = response.choices[0]?.message?.content || '';
    
    // Extract deobfuscated code and analysis from the response
    const deobfuscatedCodeMatch = content.match(/DEOBFUSCATED CODE:([\s\S]*?)(?=ANALYSIS:|$)/i);
    const analysisMatch = content.match(/ANALYSIS:([\s\S]*)/i);
    
    return {
      deobfuscatedCode: deobfuscatedCodeMatch ? deobfuscatedCodeMatch[1].trim() : '',
      analysisReport: analysisMatch ? analysisMatch[1].trim() : content,
    };
  } catch (error) {
    console.error('OpenAI deobfuscation error:', error);
    throw new Error(`Failed to deobfuscate code: ${(error as Error).message}`);
  }
};

/**
 * Analyze code for vulnerabilities using OpenAI
 * @param code The code to analyze
 * @param modelId Optional model ID to use (defaults to gpt-4-turbo)
 * @returns Vulnerability analysis
 */
export const analyzeVulnerabilities = async (
  code: string,
  modelId: string = 'gpt-4-turbo'
): Promise<{ vulnerabilities: any[]; analysisReport: string }> => {
  try {
    const openaiClient = await initOpenAI();
    
    // Sanitize input for security
    const sanitizedCode = sanitizeString(code);
    
    const systemPrompt = `You are an expert security researcher specializing in vulnerability detection. 
    Analyze the provided code for security vulnerabilities, focusing on:
    1. Common vulnerability patterns
    2. Potential exploits
    3. Security best practices violations
    4. References to Metasploit modules that could exploit these vulnerabilities
    5. CVE IDs when applicable
    
    Format your response as JSON with the following structure:
    {
      "vulnerabilities": [
        {
          "name": "Vulnerability name",
          "description": "Detailed description",
          "severity": "low|medium|high|critical",
          "cveId": "CVE-ID if applicable",
          "metasploitModule": "Related Metasploit module if applicable"
        }
      ],
      "analysisReport": "Detailed explanation of findings"
    }`;
    
    const requestData = sanitizeRequestData({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this code for security vulnerabilities:\n\n${sanitizedCode}` }
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });
    
    const response = await safeApiCall(
      () => openaiClient.post('/chat/completions', requestData),
      'OpenAI vulnerability analysis error'
    );
    
    const content = response.choices[0]?.message?.content || '{}';
    
    try {
      const result = JSON.parse(content);
      return {
        vulnerabilities: result.vulnerabilities || [],
        analysisReport: result.analysisReport || '',
      };
    } catch (parseError) {
      console.error('Error parsing OpenAI JSON response:', parseError);
      return {
        vulnerabilities: [],
        analysisReport: content,
      };
    }
  } catch (error) {
    console.error('OpenAI vulnerability analysis error:', error);
    throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
  }
};
