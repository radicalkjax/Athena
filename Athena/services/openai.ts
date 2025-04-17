import OpenAI from 'openai';
import { sanitizeString } from '@/utils/helpers';

// API key storage - using localStorage for web
let cachedApiKey: string | null = null;

/**
 * Initialize OpenAI client with API key
 * @param apiKey Optional API key to use instead of stored key
 * @returns OpenAI client instance
 */
export const initOpenAI = async (apiKey?: string): Promise<OpenAI> => {
  try {
    // Use provided API key or retrieve from storage
    let key = apiKey || cachedApiKey;
    
    if (!key) {
      // Try to get from localStorage in web environment
      if (typeof window !== 'undefined' && window.localStorage) {
        key = localStorage.getItem('athena_openai_api_key');
        console.log('Checking localStorage for OpenAI key:', !!key);
      }
    }
    
    if (!key) {
      throw new Error('OpenAI API key not found. Please set your API key in the settings.');
    }
    
    console.log('Initializing OpenAI client with key');
    
    return new OpenAI({
      apiKey: key,
      dangerouslyAllowBrowser: true, // Required for React Native
    });
  } catch (error) {
    console.error('Error initializing OpenAI client:', error);
    throw error;
  }
};

/**
 * Save OpenAI API key to storage
 * @param apiKey The API key to save
 */
export const saveOpenAIApiKey = async (apiKey: string): Promise<void> => {
  try {
    // Cache the API key in memory
    cachedApiKey = apiKey;
    
    // Save to localStorage for web environment
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('athena_openai_api_key', apiKey);
      console.log('Saved OpenAI API key to localStorage');
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
  
  // Check localStorage for web environment
  if (typeof window !== 'undefined' && window.localStorage) {
    const key = localStorage.getItem('athena_openai_api_key');
    if (key) {
      cachedApiKey = key; // Cache it for future use
      return true;
    }
  }
  
  return false;
};

/**
 * Delete stored OpenAI API key
 */
export const deleteOpenAIApiKey = async (): Promise<void> => {
  try {
    // Clear memory cache
    cachedApiKey = null;
    
    // Clear from localStorage for web environment
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('athena_openai_api_key');
      console.log('Deleted OpenAI API key from localStorage');
    }
    
    console.log('Deleted OpenAI API key from memory cache');
  } catch (error) {
    console.error('Error deleting OpenAI API key:', error);
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
    const openai = await initOpenAI();
    
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
    
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze and deobfuscate this code:\n\n${sanitizedCode}` }
      ],
      temperature: 0.2, // Lower temperature for more deterministic results
      max_tokens: 4000,
    });
    
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
    const openai = await initOpenAI();
    
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
    
    const response = await openai.chat.completions.create({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this code for security vulnerabilities:\n\n${sanitizedCode}` }
      ],
      temperature: 0.2,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });
    
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
