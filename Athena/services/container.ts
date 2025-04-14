import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Container } from '@/types';
import { generateId } from '@/utils/helpers';

// Storage keys
const CONTAINER_API_KEY_STORAGE = 'athena_container_api_key';
const CONTAINER_API_URL_STORAGE = 'athena_container_api_url';

/**
 * Initialize Container API client
 * @param apiKey Optional API key to use instead of stored key
 * @param apiUrl Optional API URL to use instead of stored URL
 * @returns API configuration for Container service
 */
export const initContainerService = async (
  apiKey?: string,
  apiUrl?: string
): Promise<{ apiKey: string; apiUrl: string }> => {
  // Use provided values or retrieve from secure storage
  const key = apiKey || await SecureStore.getItemAsync(CONTAINER_API_KEY_STORAGE);
  const url = apiUrl || await SecureStore.getItemAsync(CONTAINER_API_URL_STORAGE);
  
  if (!key) {
    throw new Error('Container API key not found. Please set your API key in the settings.');
  }
  
  if (!url) {
    throw new Error('Container API URL not found. Please set the API URL in the settings.');
  }
  
  return { apiKey: key, apiUrl: url };
};

/**
 * Save Container API configuration to secure storage
 * @param apiKey The API key to save
 * @param apiUrl The API URL to save
 */
export const saveContainerConfig = async (apiKey: string, apiUrl: string): Promise<void> => {
  await SecureStore.setItemAsync(CONTAINER_API_KEY_STORAGE, apiKey);
  await SecureStore.setItemAsync(CONTAINER_API_URL_STORAGE, apiUrl);
};

/**
 * Check if Container API configuration is stored
 * @returns True if API configuration exists, false otherwise
 */
export const hasContainerConfig = async (): Promise<boolean> => {
  const key = await SecureStore.getItemAsync(CONTAINER_API_KEY_STORAGE);
  const url = await SecureStore.getItemAsync(CONTAINER_API_URL_STORAGE);
  return !!key && !!url;
};

/**
 * Delete stored Container API configuration
 */
export const deleteContainerConfig = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(CONTAINER_API_KEY_STORAGE);
  await SecureStore.deleteItemAsync(CONTAINER_API_URL_STORAGE);
};

/**
 * Create a new container for malware analysis
 * @param malwareId ID of the malware file to analyze
 * @param malwareContent Base64-encoded content of the malware file
 * @param malwareName Name of the malware file
 * @returns Container object
 */
export const createContainer = async (
  malwareId: string,
  malwareContent: string,
  malwareName: string
): Promise<Container> => {
  try {
    const { apiKey, apiUrl } = await initContainerService();
    
    const containerId = generateId();
    
    const response = await axios.post(
      `${apiUrl}/api/v1/containers`,
      {
        containerId,
        malwareId,
        malwareContent,
        malwareName,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      id: containerId,
      status: 'creating',
      malwareId,
      createdAt: Date.now(),
      ...response.data.container,
    };
  } catch (error) {
    console.error('Container creation error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Container API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Container API error: ${(error as Error).message}`);
  }
};

/**
 * Get container status
 * @param containerId ID of the container
 * @returns Container status
 */
export const getContainerStatus = async (containerId: string): Promise<'creating' | 'running' | 'stopped' | 'error'> => {
  try {
    const { apiKey, apiUrl } = await initContainerService();
    
    const response = await axios.get(
      `${apiUrl}/api/v1/containers/${containerId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.status;
  } catch (error) {
    console.error('Container status error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Container API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Container API error: ${(error as Error).message}`);
  }
};

/**
 * Execute a command in the container
 * @param containerId ID of the container
 * @param command Command to execute
 * @returns Command output
 */
export const executeCommand = async (
  containerId: string,
  command: string
): Promise<{ output: string; exitCode: number }> => {
  try {
    const { apiKey, apiUrl } = await initContainerService();
    
    const response = await axios.post(
      `${apiUrl}/api/v1/containers/${containerId}/exec`,
      {
        command,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      output: response.data.output || '',
      exitCode: response.data.exitCode || 0,
    };
  } catch (error) {
    console.error('Container exec error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Container API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Container API error: ${(error as Error).message}`);
  }
};

/**
 * Stop and remove a container
 * @param containerId ID of the container
 * @returns Success status
 */
export const removeContainer = async (containerId: string): Promise<boolean> => {
  try {
    const { apiKey, apiUrl } = await initContainerService();
    
    const response = await axios.delete(
      `${apiUrl}/api/v1/containers/${containerId}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.success || false;
  } catch (error) {
    console.error('Container removal error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Container API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Container API error: ${(error as Error).message}`);
  }
};

/**
 * Get container logs
 * @param containerId ID of the container
 * @returns Container logs
 */
export const getContainerLogs = async (containerId: string): Promise<string> => {
  try {
    const { apiKey, apiUrl } = await initContainerService();
    
    const response = await axios.get(
      `${apiUrl}/api/v1/containers/${containerId}/logs`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.logs || '';
  } catch (error) {
    console.error('Container logs error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Container API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Container API error: ${(error as Error).message}`);
  }
};

/**
 * Get file from container
 * @param containerId ID of the container
 * @param filePath Path to the file in the container
 * @returns File content (Base64-encoded)
 */
export const getContainerFile = async (
  containerId: string,
  filePath: string
): Promise<string> => {
  try {
    const { apiKey, apiUrl } = await initContainerService();
    
    const response = await axios.get(
      `${apiUrl}/api/v1/containers/${containerId}/files`,
      {
        params: { path: filePath },
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.content || '';
  } catch (error) {
    console.error('Container file error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Container API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Container API error: ${(error as Error).message}`);
  }
};

/**
 * Run malware in container for analysis
 * @param containerId ID of the container
 * @param timeout Timeout in seconds (default: 60)
 * @returns Analysis results
 */
export const runMalwareAnalysis = async (
  containerId: string,
  timeout: number = 60
): Promise<{ logs: string; networkActivity: any[]; fileActivity: any[] }> => {
  try {
    const { apiKey, apiUrl } = await initContainerService();
    
    const response = await axios.post(
      `${apiUrl}/api/v1/containers/${containerId}/analyze`,
      {
        timeout,
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return {
      logs: response.data.logs || '',
      networkActivity: response.data.networkActivity || [],
      fileActivity: response.data.fileActivity || [],
    };
  } catch (error) {
    console.error('Malware analysis error:', error);
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Container API error: ${error.response.status} - ${error.response.data.error || 'Unknown error'}`);
    }
    throw new Error(`Container API error: ${(error as Error).message}`);
  }
};
