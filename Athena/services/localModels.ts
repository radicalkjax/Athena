import { sanitizeString } from '@/utils/helpers';
import * as FileSystem from 'expo-file-system';

// Types for local model configuration
interface LocalModelConfig {
  id: string;
  name: string;
  path: string;
  type: 'llama' | 'gpt4all' | 'deepseek' | 'other';
  apiUrl: string;
  apiPort: number;
}

// Storage paths
const LOCAL_MODELS_DIR = FileSystem.documentDirectory + 'local_models/';
const LOCAL_MODELS_CONFIG = LOCAL_MODELS_DIR + 'config.json';

/**
 * Initialize local models directory
 */
export const initLocalModelsDirectory = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(LOCAL_MODELS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_MODELS_DIR, { intermediates: true });
      await saveLocalModelsConfig([]);
    }
    
    // Initialize local models from store
    await initLocalModelsFromStore();
  } catch (error) {
    console.error('Error initializing local models directory:', error);
    throw new Error(`Failed to initialize local models directory: ${(error as Error).message}`);
  }
};

/**
 * Initialize local models from store
 */
export const initLocalModelsFromStore = async (): Promise<void> => {
  try {
    // Get models from the AIModelSelector component instead of directly from the store
    // This avoids circular dependencies
    
    // Get existing local model configs
    const existingConfigs = await getLocalModelsConfig();
    const existingIds = existingConfigs.map(config => config.id);
    
    // Add new local models from the provided models
    const newConfigs: LocalModelConfig[] = [];
    
    // The actual models will be passed from the AIModelSelector component
    // This function is now just a placeholder that will be called with the models
    
    console.log('Local models initialization ready');
    
    return;
  } catch (error) {
    console.error('Error initializing local models from store:', error);
  }
};

/**
 * Save local model from AIModel
 * @param model The AIModel to save as a local model
 */
export const saveLocalModelFromAIModel = async (model: any): Promise<void> => {
  try {
    if (model.type !== 'local') {
      console.log('Not a local model:', model);
      return;
    }
    
    // Get default values for missing properties
    const path = model.path || '';
    const apiUrl = model.apiUrl || 'http://localhost';
    const apiPort = model.apiPort || 8000;
    
    console.log(`Saving local model ${model.name} to config with path: ${path}`);
    
    // Get existing local model configs
    const existingConfigs = await getLocalModelsConfig();
    const existingIds = existingConfigs.map(config => config.id);
    
    // Check if model already exists
    if (existingIds.includes(model.id)) {
      console.log(`Local model ${model.name} already exists in config, updating...`);
      
      // Update existing model
      const updatedConfigs = existingConfigs.map(config => {
        if (config.id === model.id) {
          return {
            ...config,
            name: model.name,
            path: path || config.path,
            apiUrl: apiUrl || config.apiUrl,
            apiPort: apiPort || config.apiPort,
          };
        }
        return config;
      });
      
      await saveLocalModelsConfig(updatedConfigs);
      console.log(`Updated local model ${model.name} in config`);
      return;
    }
    
    // Add new local model
    const newConfig: LocalModelConfig = {
      id: model.id,
      name: model.name,
      path: path,
      type: 'llama', // Default to llama
      apiUrl: apiUrl,
      apiPort: apiPort,
    };
    
    await saveLocalModelsConfig([...existingConfigs, newConfig]);
    console.log(`Added local model ${model.name} to config`);
  } catch (error) {
    console.error('Error saving local model from AIModel:', error);
  }
};

/**
 * Get local models configuration
 * @returns Array of local model configurations
 */
export const getLocalModelsConfig = async (): Promise<LocalModelConfig[]> => {
  try {
    await initLocalModelsDirectory();
    
    const configInfo = await FileSystem.getInfoAsync(LOCAL_MODELS_CONFIG);
    if (!configInfo.exists) {
      return [];
    }
    
    const configJson = await FileSystem.readAsStringAsync(LOCAL_MODELS_CONFIG);
    return JSON.parse(configJson);
  } catch (error) {
    console.error('Error getting local models config:', error);
    return [];
  }
};

/**
 * Save local models configuration
 * @param config Array of local model configurations
 */
export const saveLocalModelsConfig = async (config: LocalModelConfig[]): Promise<void> => {
  try {
    await initLocalModelsDirectory();
    await FileSystem.writeAsStringAsync(LOCAL_MODELS_CONFIG, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error saving local models config:', error);
    throw new Error(`Failed to save local models config: ${(error as Error).message}`);
  }
};

/**
 * Add a local model configuration
 * @param config Local model configuration
 */
export const addLocalModel = async (config: Omit<LocalModelConfig, 'id'>): Promise<LocalModelConfig> => {
  try {
    const models = await getLocalModelsConfig();
    const id = `local-${Date.now()}`;
    const newModel = { ...config, id };
    
    await saveLocalModelsConfig([...models, newModel]);
    return newModel;
  } catch (error) {
    console.error('Error adding local model:', error);
    throw new Error(`Failed to add local model: ${(error as Error).message}`);
  }
};

/**
 * Remove a local model configuration
 * @param id Local model ID
 */
export const removeLocalModel = async (id: string): Promise<void> => {
  try {
    const models = await getLocalModelsConfig();
    const filteredModels = models.filter(model => model.id !== id);
    
    await saveLocalModelsConfig(filteredModels);
  } catch (error) {
    console.error('Error removing local model:', error);
    throw new Error(`Failed to remove local model: ${(error as Error).message}`);
  }
};

/**
 * Check if a local model is running
 * @param config Local model configuration
 * @returns True if the model is running, false otherwise
 */
export const isLocalModelRunning = async (config: LocalModelConfig): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${config.apiPort}/v1/models`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    return response.ok;
  } catch (error) {
    return false;
  }
};

/**
 * Make a request to a local model
 * @param config Local model configuration
 * @param messages Array of messages to send
 * @returns Response from the local model
 */
const makeLocalModelRequest = async (
  config: LocalModelConfig,
  messages: Array<{ role: string; content: string }>
) => {
  try {
    const isRunning = await isLocalModelRunning(config);
    if (!isRunning) {
      throw new Error(`Local model ${config.name} is not running. Please start the model server.`);
    }
    
    const response = await fetch(`http://localhost:${config.apiPort}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.name,
        messages,
        max_tokens: 4000,
        temperature: 0.2,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Local model error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Local model request error:', error);
    throw new Error(`Local model request failed: ${(error as Error).message}`);
  }
};

/**
 * Deobfuscate code using a local model
 * @param code The obfuscated code to analyze
 * @param modelId The ID of the local model to use
 * @returns Deobfuscated code and analysis
 */
export const deobfuscateCode = async (
  code: string,
  modelId: string
): Promise<{ deobfuscatedCode: string; analysisReport: string }> => {
  try {
    const models = await getLocalModelsConfig();
    const model = models.find(m => m.id === modelId);
    
    if (!model) {
      throw new Error(`Local model with ID ${modelId} not found.`);
    }
    
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
    
    const response = await makeLocalModelRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze and deobfuscate this code:\n\n${sanitizedCode}` }
      ]
    );
    
    const content = response.choices?.[0]?.message?.content || '';
    
    // Extract deobfuscated code and analysis from the response
    const deobfuscatedCodeMatch = content.match(/DEOBFUSCATED CODE:([\s\S]*?)(?=ANALYSIS:|$)/i);
    const analysisMatch = content.match(/ANALYSIS:([\s\S]*)/i);
    
    return {
      deobfuscatedCode: deobfuscatedCodeMatch ? deobfuscatedCodeMatch[1].trim() : '',
      analysisReport: analysisMatch ? analysisMatch[1].trim() : content,
    };
  } catch (error) {
    console.error('Local model deobfuscation error:', error);
    throw new Error(`Failed to deobfuscate code: ${(error as Error).message}`);
  }
};

/**
 * Analyze code for vulnerabilities using a local model
 * @param code The code to analyze
 * @param modelId The ID of the local model to use
 * @returns Vulnerability analysis
 */
export const analyzeVulnerabilities = async (
  code: string,
  modelId: string
): Promise<{ vulnerabilities: any[]; analysisReport: string }> => {
  try {
    const models = await getLocalModelsConfig();
    const model = models.find(m => m.id === modelId);
    
    if (!model) {
      throw new Error(`Local model with ID ${modelId} not found.`);
    }
    
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
    
    const response = await makeLocalModelRequest(
      model,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this code for security vulnerabilities:\n\n${sanitizedCode}` }
      ]
    );
    
    const content = response.choices?.[0]?.message?.content || '{}';
    
    try {
      // Extract JSON from the response (model might wrap it in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || [null, content];
      const jsonStr = jsonMatch[1];
      
      const result = JSON.parse(jsonStr);
      return {
        vulnerabilities: result.vulnerabilities || [],
        analysisReport: result.analysisReport || '',
      };
    } catch (parseError) {
      console.error('Error parsing local model JSON response:', parseError);
      return {
        vulnerabilities: [],
        analysisReport: content,
      };
    }
  } catch (error) {
    console.error('Local model vulnerability analysis error:', error);
    throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
  }
};
