/**
 * Integration Test Setup
 * Provides utilities and helpers for integration testing
 */

import { render, RenderOptions } from '@testing-library/react-native';
import React, { ReactElement } from 'react';
import { useAppStore } from '@/store';

// Reset all stores before each test
export const resetStores = () => {
  // Reset app store to initial state
  useAppStore.setState({
    malwareFiles: [],
    selectedMalwareId: null,
    isAnalyzing: false,
    analysisResults: [],
    selectedResultId: null,
    currentProgress: null,
    progressHistory: [],
    activeAnalysisId: null,
    containerConfig: null,
    error: null,
  });
};

// Custom render function that includes providers
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, {
    ...options,
  });
};

// Mock services with realistic delays
import { vi } from 'vitest';

export const mockServices = {
  fileManager: {
    pickFile: vi.fn().mockImplementation(async () => {
      // Simulate file picker delay
      await new Promise(resolve => setTimeout(resolve, 100));
      return {
        id: 'test-file-123',
        name: 'malicious.exe',
        size: 2048576, // 2MB
        type: 'application/x-msdownload',
        uri: 'file:///test/malicious.exe',
        content: 'MZ... (binary content)'
      };
    }),
    saveFile: vi.fn().mockResolvedValue(true),
    deleteFile: vi.fn().mockResolvedValue(true),
  },
  
  analysisService: {
    analyzeFile: vi.fn().mockImplementation(async (file, options) => {
      // Simulate analysis delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        id: `analysis-${Date.now()}`,
        malwareId: file.id,
        modelId: 'test-model',
        timestamp: Date.now(),
        deobfuscatedCode: 'function maliciousCode() { /* deobfuscated */ }',
        analysisReport: `Risk Score: 8.5\nThreats: Trojan.Generic, Ransomware.Suspect\nRecommendations: Quarantine immediately, Run in isolated environment only`,
        vulnerabilities: [
          {
            id: 'vuln-1',
            name: 'Buffer Overflow',
            severity: 'high',
            description: 'Potential buffer overflow in main function'
          }
        ]
      };
    }),
  },
  
  containerService: {
    createContainer: vi.fn().mockImplementation(async (config) => {
      // Simulate container creation delay
      await new Promise(resolve => setTimeout(resolve, 300));
      return {
        id: 'container-123',
        status: 'running',
        config,
        metrics: {
          cpuUsage: 0,
          memoryUsage: 0,
          networkActivity: []
        }
      };
    }),
    
    deployFile: vi.fn().mockImplementation(async (containerId, file) => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        success: true,
        containerId,
        fileId: file.id,
        deploymentPath: `/containers/${containerId}/malware/${file.name}`
      };
    }),
  },
  
  aiServices: {
    openai: {
      analyzeVulnerabilities: vi.fn().mockResolvedValue({
        vulnerabilities: ['SQL Injection', 'XSS'],
        riskScore: 7,
        recommendations: ['Sanitize inputs', 'Use parameterized queries']
      }),
      deobfuscateCode: vi.fn().mockResolvedValue({
        deobfuscated: 'function maliciousCode() { /* deobfuscated */ }',
        techniques: ['String encoding', 'Control flow flattening']
      })
    },
    deepseek: {
      analyzeVulnerabilities: vi.fn().mockResolvedValue({
        vulnerabilities: ['Command Injection'],
        riskScore: 6,
        recommendations: ['Validate user input']
      })
    },
    claude: {
      analyzeVulnerabilities: vi.fn().mockResolvedValue({
        vulnerabilities: ['Path Traversal'],
        riskScore: 5,
        recommendations: ['Use safe path functions']
      })
    }
  }
};

// Wait for condition with timeout
export const waitForCondition = async (
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
};

// Simulate user interactions with realistic delays
export const userInteractions = {
  uploadFile: async (getByText: any, fireEvent: any) => {
    fireEvent.press(getByText('Upload'));
    await new Promise(resolve => setTimeout(resolve, 50)); // UI update delay
  },
  
  selectFile: async (getByText: any, fireEvent: any, fileName: string) => {
    fireEvent.press(getByText(fileName));
    await new Promise(resolve => setTimeout(resolve, 50));
  },
  
  startAnalysis: async (getByText: any, fireEvent: any) => {
    fireEvent.press(getByText('Analyze'));
    await new Promise(resolve => setTimeout(resolve, 50));
  },
  
  configureContainer: async (getByText: any, fireEvent: any, os: string) => {
    fireEvent.press(getByText(os));
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

// Mock API responses
export const mockAPIResponses = {
  success: {
    ok: true,
    json: async () => ({ status: 'success', data: {} })
  },
  error: {
    ok: false,
    status: 500,
    json: async () => ({ error: 'Internal server error' })
  }
};

// Test data generators
export const generateMalwareFile = (overrides = {}) => ({
  id: Math.random().toString(36).substring(7),
  name: 'test-malware.exe',
  size: 1024 * 1024, // 1MB
  type: 'application/x-msdownload',
  uri: 'file:///test/test-malware.exe',
  content: 'MZ...',
  ...overrides
});

export const generateAnalysisResult = (fileId: string, overrides = {}) => ({
  fileId,
  threats: ['Generic.Malware'],
  riskScore: 5,
  vulnerabilities: [],
  recommendations: ['Monitor behavior'],
  timestamp: new Date().toISOString(),
  ...overrides
});

export const generateContainerConfig = (overrides = {}) => ({
  os: 'linux',
  architecture: 'x64',
  version: 'ubuntu-20.04',
  distribution: 'ubuntu',
  resources: {
    cpu: 2,
    memory: 2048,
    diskSpace: 10240,
    networkSpeed: 100,
    ioOperations: 1000
  },
  ...overrides
});