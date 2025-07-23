/**
 * Backend Service for Athena v2
 * Handles communication with the backend API
 */

import { apiConfig, apiRequest, buildApiUrl } from '../config/api';
import { logger } from './loggingService';

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  services?: {
    api: string;
    cache: string;
    wasm: string;
  };
  providers?: Record<string, {
    available: boolean;
    healthy: boolean;
    errors?: string[];
  }>;
}

export interface AnalysisRequest {
  content: string;
  providerId?: string;
  options?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface AnalysisResponse {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface FileUploadRequest {
  file: File;
  analysisTypes?: string[];
}

export interface FileUploadResponse {
  analysisId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  message?: string;
}

class BackendService {
  private isConnected: boolean = false;
  private healthCheckInterval: number | null = null;

  /**
   * Initialize the backend service
   */
  async initialize(): Promise<void> {
    logger.info('Initializing backend service');
    
    try {
      await this.checkHealth();
      this.startHealthMonitoring();
      logger.info('Backend service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize backend service:', error);
      throw error;
    }
  }

  /**
   * Check backend health
   */
  async checkHealth(): Promise<HealthCheckResponse> {
    try {
      const response = await apiRequest<HealthCheckResponse>(apiConfig.endpoints.health);
      this.isConnected = response.status === 'healthy';
      return response;
    } catch (error) {
      this.isConnected = false;
      logger.error('Health check failed:', error);
      throw error;
    }
  }

  /**
   * Start periodic health monitoring
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = window.setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        logger.warn('Health check failed during monitoring:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Analyze content using AI providers
   */
  async analyzeContent(request: AnalysisRequest): Promise<AnalysisResponse> {
    logger.info('Analyzing content', { providerId: request.providerId });
    
    try {
      const response = await apiRequest<AnalysisResponse>(
        apiConfig.endpoints.analyze,
        {
          method: 'POST',
          body: JSON.stringify(request),
        }
      );
      
      logger.info('Content analysis completed', { success: response.success });
      return response;
    } catch (error) {
      logger.error('Content analysis failed:', error);
      throw error;
    }
  }

  /**
   * Upload file for analysis
   */
  async uploadFile(request: FileUploadRequest): Promise<FileUploadResponse> {
    logger.info('Uploading file for analysis', { 
      fileName: request.file.name,
      fileSize: request.file.size 
    });
    
    try {
      const formData = new FormData();
      formData.append('file', request.file);
      
      if (request.analysisTypes) {
        formData.append('analysisTypes', JSON.stringify(request.analysisTypes));
      }
      
      const response = await fetch(buildApiUrl(apiConfig.endpoints.upload), {
        method: 'POST',
        body: formData,
        credentials: apiConfig.requestConfig.credentials,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      logger.info('File upload completed', { analysisId: result.analysisId });
      return result;
    } catch (error) {
      logger.error('File upload failed:', error);
      throw error;
    }
  }

  /**
   * Get analysis status
   */
  async getAnalysisStatus(analysisId: string): Promise<any> {
    logger.debug('Getting analysis status', { analysisId });
    
    try {
      return await apiRequest(
        apiConfig.endpoints.status,
        { method: 'GET' },
        { id: analysisId }
      );
    } catch (error) {
      logger.error('Failed to get analysis status:', error);
      throw error;
    }
  }

  /**
   * Get analysis results
   */
  async getAnalysisResults(analysisId: string): Promise<any> {
    logger.debug('Getting analysis results', { analysisId });
    
    try {
      return await apiRequest(
        apiConfig.endpoints.results,
        { method: 'GET' },
        { id: analysisId }
      );
    } catch (error) {
      logger.error('Failed to get analysis results:', error);
      throw error;
    }
  }

  /**
   * Get available AI providers
   */
  async getProviders(): Promise<any> {
    logger.debug('Getting AI providers');
    
    try {
      return await apiRequest(apiConfig.endpoints.providers, { method: 'GET' });
    } catch (error) {
      logger.error('Failed to get providers:', error);
      throw error;
    }
  }

  /**
   * Execute custom workflow
   */
  async executeWorkflow(agentId: string, workflowName: string, data: any): Promise<any> {
    logger.info('Executing workflow', { agentId, workflowName });
    
    try {
      const endpoint = `${apiConfig.endpoints.workflows}/${agentId}/${workflowName}/execute`;
      return await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      logger.error('Workflow execution failed:', error);
      throw error;
    }
  }

  /**
   * Analyze with WASM modules
   */
  async analyzeWithWasm(data: any): Promise<any> {
    logger.info('Analyzing with WASM modules');
    
    try {
      return await apiRequest(apiConfig.endpoints.wasm, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      logger.error('WASM analysis failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const backendService = new BackendService();