import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Storage keys
const METASPLOIT_API_KEY_STORAGE = 'athena_metasploit_api_key';
const METASPLOIT_API_URL_STORAGE = 'athena_metasploit_api_url';

/**
 * Initialize Metasploit API client
 * @param apiKey Optional API key to use instead of stored key
 * @param apiUrl Optional API URL to use instead of stored URL
 * @returns API configuration for Metasploit
 */
export const initMetasploit = async (
  apiKey?: string,
  apiUrl?: string
): Promise<{ apiKey: string; apiUrl: string }> => {
  // Use provided values or retrieve from secure storage
  const key = apiKey || await SecureStore.getItemAsync(METASPLOIT_API_KEY_STORAGE);
  const url = apiUrl || await SecureStore.getItemAsync(METASPLOIT_API_URL_STORAGE);
  
  if (!key) {
    throw new Error('Metasploit API key not found. Please set your API key in the settings.');
  }
  
  if (!url) {
    throw new Error('Metasploit API URL not found. Please set the API URL in the settings.');
  }
  
  return { apiKey: key, apiUrl: url };
};

/**
 * Save Metasploit API configuration to secure storage
 * @param apiKey The API key to save
 * @param apiUrl The API URL to save
 */
export const saveMetasploitConfig = async (apiKey: string, apiUrl: string): Promise<void> => {
  await SecureStore.setItemAsync(METASPLOIT_API_KEY_STORAGE, apiKey);
  await SecureStore.setItemAsync(METASPLOIT_API_URL_STORAGE, apiUrl);
};

/**
 * Check if Metasploit API configuration is stored
 * @returns True if API configuration exists, false otherwise
 */
export const hasMetasploitConfig = async (): Promise<boolean> => {
  const key = await SecureStore.getItemAsync(METASPLOIT_API_KEY_STORAGE);
  const url = await SecureStore.getItemAsync(METASPLOIT_API_URL_STORAGE);
  return !!key && !!url;
};

/**
 * Delete stored Metasploit API configuration
 */
export const deleteMetasploitConfig = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(METASPLOIT_API_KEY_STORAGE);
  await SecureStore.deleteItemAsync(METASPLOIT_API_URL_STORAGE);
};

/**
 * Search for Metasploit modules
 * @param query Search query
 * @returns Array of matching modules
 */
export const searchModules = async (query: string): Promise<any[]> => {
  try {
    const { apiKey, apiUrl } = await initMetasploit();
    
    const response = await axios.get(`${apiUrl}/api/v1/modules/search`, {
      params: { query },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data.modules || [];
  } catch (error) {
    console.error('Metasploit module search error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Metasploit API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Metasploit API error: ${(error as Error).message}`);
  }
};

/**
 * Get module details
 * @param moduleType Module type (exploit, auxiliary, post, payload, encoder, nop)
 * @param moduleName Module name
 * @returns Module details
 */
export const getModuleDetails = async (moduleType: string, moduleName: string): Promise<any> => {
  try {
    const { apiKey, apiUrl } = await initMetasploit();
    
    const response = await axios.get(`${apiUrl}/api/v1/modules/${moduleType}/${moduleName}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data.module || {};
  } catch (error) {
    console.error('Metasploit module details error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Metasploit API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Metasploit API error: ${(error as Error).message}`);
  }
};

/**
 * Search for vulnerabilities by CVE ID
 * @param cveId CVE ID to search for
 * @returns Array of matching vulnerabilities
 */
export const searchVulnerabilityByCVE = async (cveId: string): Promise<any[]> => {
  try {
    const { apiKey, apiUrl } = await initMetasploit();
    
    const response = await axios.get(`${apiUrl}/api/v1/vulnerabilities/search`, {
      params: { cve: cveId },
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data.vulnerabilities || [];
  } catch (error) {
    console.error('Metasploit vulnerability search error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Metasploit API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Metasploit API error: ${(error as Error).message}`);
  }
};

/**
 * Get vulnerability details
 * @param id Vulnerability ID
 * @returns Vulnerability details
 */
export const getVulnerabilityDetails = async (id: string): Promise<any> => {
  try {
    const { apiKey, apiUrl } = await initMetasploit();
    
    const response = await axios.get(`${apiUrl}/api/v1/vulnerabilities/${id}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data.vulnerability || {};
  } catch (error) {
    console.error('Metasploit vulnerability details error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Metasploit API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Metasploit API error: ${(error as Error).message}`);
  }
};

/**
 * Find related Metasploit modules for a vulnerability
 * @param vulnerabilityId Vulnerability ID
 * @returns Array of related modules
 */
export const findRelatedModules = async (vulnerabilityId: string): Promise<any[]> => {
  try {
    const { apiKey, apiUrl } = await initMetasploit();
    
    const response = await axios.get(`${apiUrl}/api/v1/vulnerabilities/${vulnerabilityId}/modules`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    return response.data.modules || [];
  } catch (error) {
    console.error('Metasploit related modules error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Metasploit API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Metasploit API error: ${(error as Error).message}`);
  }
};

/**
 * Enrich vulnerability data with Metasploit information
 * @param vulnerabilities Array of vulnerability objects
 * @returns Enriched vulnerability data
 */
export const enrichVulnerabilityData = async (vulnerabilities: any[]): Promise<any[]> => {
  try {
    const enrichedVulnerabilities = [];
    
    for (const vulnerability of vulnerabilities) {
      if (vulnerability.cveId) {
        try {
          // Search for the vulnerability in Metasploit
          const metasploitVulns = await searchVulnerabilityByCVE(vulnerability.cveId);
          
          if (metasploitVulns.length > 0) {
            const metasploitVuln = metasploitVulns[0];
            
            // Find related modules
            const relatedModules = await findRelatedModules(metasploitVuln.id);
            
            // Enrich the vulnerability data
            enrichedVulnerabilities.push({
              ...vulnerability,
              metasploitId: metasploitVuln.id,
              metasploitDescription: metasploitVuln.description,
              metasploitModules: relatedModules.map(module => ({
                name: module.name,
                type: module.type,
                description: module.description,
              })),
            });
          } else {
            enrichedVulnerabilities.push(vulnerability);
          }
        } catch (error) {
          console.error(`Error enriching vulnerability ${vulnerability.name}:`, error);
          enrichedVulnerabilities.push(vulnerability);
        }
      } else {
        enrichedVulnerabilities.push(vulnerability);
      }
    }
    
    return enrichedVulnerabilities;
  } catch (error) {
    console.error('Error enriching vulnerability data:', error);
    return vulnerabilities;
  }
};
