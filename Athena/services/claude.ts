import axios from 'axios';
import { sanitizeString } from '@/utils/helpers';
import * as SecureStore from 'expo-secure-store';

// API key storage key
const CLAUDE_API_KEY_STORAGE = 'athena_claude_api_key';
const CLAUDE_API_BASE_URL = 'https://api.anthropic.com/v1';

/**
 * Initialize Claude API client
 * @param apiKey Optional API key to use instead of stored key
 * @returns API key for Claude
 */
export const initClaude = async (apiKey?: string): Promise<string> => {
  // Use provided API key or retrieve from secure storage
  const key = apiKey || await SecureStore.getItemAsync(CLAUDE_API_KEY_STORAGE);
  
  if (!key) {
    throw new Error('Claude API key not found. Please set your API key in the settings.');
  }
  
  return key;
};

/**
 * Save Claude API key to secure storage
 * @param apiKey The API key to save
 */
export const saveClaudeApiKey = async (apiKey: string): Promise<void> => {
  await SecureStore.setItemAsync(CLAUDE_API_KEY_STORAGE, apiKey);
};

/**
 * Check if Claude API key is stored
 * @returns True if API key exists, false otherwise
 */
export const hasClaudeApiKey = async (): Promise<boolean> => {
  const key = await SecureStore.getItemAsync(CLAUDE_API_KEY_STORAGE);
  return !!key;
};

/**
 * Delete stored Claude API key
 */
export const deleteClaudeApiKey = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(CLAUDE_API_KEY_STORAGE);
};

/**
 * Make a request to the Claude API
 * @param apiKey Claude API key
 * @param messages Array of messages to send
 * @param model Claude model to use (defaults to claude-3-opus-20240229)
 * @returns Response from Claude API
 */
const makeClaudeRequest = async (
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string = 'claude-3-opus-20240229'
) => {
  try {
    const response = await axios.post(
      `${CLAUDE_API_BASE_URL}/messages`,
      {
        model,
        messages,
        max_tokens: 4000,
        temperature: 0.2,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Claude API error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Claude API error: ${error.response.status} - ${error.response.data.error?.message || 'Unknown error'}`);
    }
    throw new Error(`Claude API error: ${(error as Error).message}`);
  }
};

/**
 * Deobfuscate code using Claude
 * @param code The obfuscated code to analyze
 * @param model Optional model ID to use (defaults to claude-3-opus-20240229)
 * @returns Deobfuscated code and analysis
 */
export const deobfuscateCode = async (
  code: string,
  model: string = 'claude-3-opus-20240229'
): Promise<{ deobfuscatedCode: string; analysisReport: string }> => {
  try {
    const apiKey = await initClaude();
    
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
    
    const response = await makeClaudeRequest(
      apiKey,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze and deobfuscate this code:\n\n${sanitizedCode}` }
      ],
      model
    );
    
    const content = response.content?.[0]?.text || '';
    
    // Extract deobfuscated code and analysis from the response
    const deobfuscatedCodeMatch = content.match(/DEOBFUSCATED CODE:([\s\S]*?)(?=ANALYSIS:|$)/i);
    const analysisMatch = content.match(/ANALYSIS:([\s\S]*)/i);
    
    return {
      deobfuscatedCode: deobfuscatedCodeMatch ? deobfuscatedCodeMatch[1].trim() : '',
      analysisReport: analysisMatch ? analysisMatch[1].trim() : content,
    };
  } catch (error) {
    console.error('Claude deobfuscation error:', error);
    throw new Error(`Failed to deobfuscate code: ${(error as Error).message}`);
  }
};

/**
 * Analyze code for vulnerabilities using Claude
 * @param code The code to analyze
 * @param model Optional model ID to use (defaults to claude-3-opus-20240229)
 * @returns Vulnerability analysis
 */
export const analyzeVulnerabilities = async (
  code: string,
  model: string = 'claude-3-opus-20240229'
): Promise<{ vulnerabilities: any[]; analysisReport: string }> => {
  try {
    const apiKey = await initClaude();
    
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
    
    const response = await makeClaudeRequest(
      apiKey,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Analyze this code for security vulnerabilities:\n\n${sanitizedCode}` }
      ],
      model
    );
    
    const content = response.content?.[0]?.text || '{}';
    
    try {
      // Extract JSON from the response (Claude might wrap it in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || [null, content];
      const jsonStr = jsonMatch[1];
      
      const result = JSON.parse(jsonStr);
      return {
        vulnerabilities: result.vulnerabilities || [],
        analysisReport: result.analysisReport || '',
      };
    } catch (parseError) {
      console.error('Error parsing Claude JSON response:', parseError);
      return {
        vulnerabilities: [],
        analysisReport: content,
      };
    }
  } catch (error) {
    console.error('Claude vulnerability analysis error:', error);
    throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
  }
};
