import { createContainerClient, safeApiCall, sanitizeRequestData } from './apiClient';
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
 * @returns Axios instance configured for Container service
 */
export const initContainerService = async (
  apiKey?: string,
  apiUrl?: string
): Promise<ReturnType<typeof createContainerClient>> => {
  // Use provided values or retrieve from secure storage
  const key = apiKey || await SecureStore.getItemAsync(CONTAINER_API_KEY_STORAGE);
  const url = apiUrl || await SecureStore.getItemAsync(CONTAINER_API_URL_STORAGE);
  
  if (!key) {
    throw new Error('Container API key not found. Please set your API key in the settings.');
  }
  
  if (!url) {
    throw new Error('Container API URL not found. Please set the API URL in the settings.');
  }
  
  return createContainerClient(key, url);
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
    const client = await initContainerService();
    
    const containerId = generateId();
    
    const requestData = sanitizeRequestData({
      containerId,
      malwareId,
      malwareContent,
      malwareName,
    });
    
    const response = await safeApiCall(
      () => client.post('/api/v1/containers', requestData),
      'Container creation error'
    );
    
    return {
      id: containerId,
      status: 'creating',
      malwareId,
      createdAt: Date.now(),
      ...response.container,
    };
  } catch (error) {
    console.error('Container creation error:', error);
    throw error;
  }
};

/**
 * Get container status
 * @param containerId ID of the container
 * @returns Container status
 */
export const getContainerStatus = async (containerId: string): Promise<'creating' | 'running' | 'stopped' | 'error'> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    
    const response = await safeApiCall(
      () => client.get(`/api/v1/containers/${sanitizedId}/status`),
      'Container status error'
    );
    
    return response.status;
  } catch (error) {
    console.error('Container status error:', error);
    throw error;
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
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    const requestData = sanitizeRequestData({
      command,
    });
    
    const response = await safeApiCall(
      () => client.post(`/api/v1/containers/${sanitizedId}/exec`, requestData),
      'Container exec error'
    );
    
    return {
      output: response.output || '',
      exitCode: response.exitCode || 0,
    };
  } catch (error) {
    console.error('Container exec error:', error);
    throw error;
  }
};

/**
 * Stop and remove a container
 * @param containerId ID of the container
 * @returns Success status
 */
export const removeContainer = async (containerId: string): Promise<boolean> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    
    const response = await safeApiCall(
      () => client.delete(`/api/v1/containers/${sanitizedId}`),
      'Container removal error'
    );
    
    return response.success || false;
  } catch (error) {
    console.error('Container removal error:', error);
    throw error;
  }
};

/**
 * Get container logs
 * @param containerId ID of the container
 * @returns Container logs
 */
export const getContainerLogs = async (containerId: string): Promise<string> => {
  try {
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    
    const response = await safeApiCall(
      () => client.get(`/api/v1/containers/${sanitizedId}/logs`),
      'Container logs error'
    );
    
    return response.logs || '';
  } catch (error) {
    console.error('Container logs error:', error);
    throw error;
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
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    const sanitizedPath = sanitizeRequestData(filePath);
    
    const response = await safeApiCall(
      () => client.get(`/api/v1/containers/${sanitizedId}/files`, {
        params: { path: sanitizedPath }
      }),
      'Container file error'
    );
    
    return response.content || '';
  } catch (error) {
    console.error('Container file error:', error);
    throw error;
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
    const client = await initContainerService();
    
    const sanitizedId = sanitizeRequestData(containerId);
    const requestData = sanitizeRequestData({
      timeout,
    });
    
    const response = await safeApiCall(
      () => client.post(`/api/v1/containers/${sanitizedId}/analyze`, requestData),
      'Malware analysis error'
    );
    
    return {
      logs: response.logs || '',
      networkActivity: response.networkActivity || [],
      fileActivity: response.fileActivity || [],
    };
  } catch (error) {
    console.error('Malware analysis error:', error);
    throw error;
  }
};
