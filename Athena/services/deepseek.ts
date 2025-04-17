import axios from 'axios';
import { sanitizeString } from '@/utils/helpers';

// API key storage - using localStorage for web
let cachedApiKey: string | null = null;
const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com/v1';

/**
 * Initialize DeepSeek API client
 * @param apiKey Optional API key to use instead of stored key
 * @returns API key for DeepSeek
 */
export const initDeepSeek = async (apiKey?: string): Promise<string> => {
  try {
    // Use provided API key or retrieve from storage
    let key = apiKey || cachedApiKey;
    
    if (!key) {
      // Try to get from localStorage in web environment
      if (typeof window !== 'undefined' && window.localStorage) {
        key = localStorage.getItem('athena_deepseek_api_key');
        console.log('Checking localStorage for DeepSeek key:', !!key);
      }
    }
    
    if (!key) {
      throw new Error('DeepSeek API key not found. Please set your API key in the settings.');
    }
    
    console.log('Initializing DeepSeek client with key');
    
    return key;
  } catch (error) {
    console.error('Error initializing DeepSeek client:', error);
    throw error;
  }
};

/**
 * Save DeepSeek API key to storage
 * @param apiKey The API key to save
 */
export const saveDeepSeekApiKey = async (apiKey: string): Promise<void> => {
  try {
    // Cache the API key in memory
    cachedApiKey = apiKey;
    
    // Save to localStorage for web environment
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('athena_deepseek_api_key', apiKey);
      console.log('Saved DeepSeek API key to localStorage');
    }
    
    console.log('Saved DeepSeek API key to memory cache');
  } catch (error) {
    console.error('Error saving DeepSeek API key:', error);
    throw error;
  }
};

/**
 * Check if DeepSeek API key is stored
 * @returns True if API key exists, false otherwise
 */
export const hasDeepSeekApiKey = async (): Promise<boolean> => {
  // Check memory cache first
  if (cachedApiKey) {
    return true;
  }
  
  // Check localStorage for web environment
  if (typeof window !== 'undefined' && window.localStorage) {
    const key = localStorage.getItem('athena_deepseek_api_key');
    if (key) {
      cachedApiKey = key; // Cache it for future use
      return true;
    }
  }
  
  return false;
};

/**
 * Delete stored DeepSeek API key
 */
export const deleteDeepSeekApiKey = async (): Promise<void> => {
  try {
    // Clear memory cache
    cachedApiKey = null;
    
    // Clear from localStorage for web environment
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('athena_deepseek_api_key');
      console.log('Deleted DeepSeek API key from localStorage');
    }
    
    console.log('Deleted DeepSeek API key from memory cache');
  } catch (error) {
    console.error('Error deleting DeepSeek API key:', error);
  }
};

/**
 * Make a request to the DeepSeek API
 * @param apiKey DeepSeek API key
 * @param messages Array of messages to send
 * @param model DeepSeek model to use (defaults to deepseek-coder)
 * @returns Response from DeepSeek API
 */
const makeDeepSeekRequest = async (
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string = 'deepseek-coder'
) => {
  try {
    const response = await axios.post(
      `${DEEPSEEK_API_BASE_URL}/chat/completions`,
      {
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.2,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('DeepSeek API error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`DeepSeek API error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
    }
    throw new Error(`DeepSeek API error: ${(error as Error).message}`);
  }
};

/**
 * Deobfuscate code using DeepSeek
 * @param code The obfuscated code to analyze
 * @param model Optional model ID to use (defaults to deepseek-coder)
 * @returns Deobfuscated code and analysis
 */
export const deobfuscateCode = async (
  code: string,
  model: string = 'deepseek-coder'
): Promise<{ deobfuscatedCode: string; analysisReport: string }> => {
  try {
    const apiKey = await initDeepSeek();
    
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
    
    const response = await makeDeepSeekRequest(
      apiKey,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze and deobfuscate this code:\n\n${sanitizedCode}` }
      ],
      model
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
    console.error('DeepSeek deobfuscation error:', error);
    throw new Error(`Failed to deobfuscate code: ${(error as Error).message}`);
  }
};

/**
 * Analyze code for vulnerabilities using DeepSeek
 * @param code The code to analyze
 * @param model Optional model ID to use (defaults to deepseek-coder)
 * @returns Vulnerability analysis
 */
export const analyzeVulnerabilities = async (
  code: string,
  model: string = 'deepseek-coder'
): Promise<{ vulnerabilities: any[]; analysisReport: string }> => {
  try {
    const apiKey = await initDeepSeek();
    
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
    
    const response = await makeDeepSeekRequest(
      apiKey,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this code for security vulnerabilities:\n\n${sanitizedCode}` }
      ],
      model
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
      console.error('Error parsing DeepSeek JSON response:', parseError);
      return {
        vulnerabilities: [],
        analysisReport: content,
      };
    }
  } catch (error) {
    console.error('DeepSeek vulnerability analysis error:', error);
    throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
  }
};
