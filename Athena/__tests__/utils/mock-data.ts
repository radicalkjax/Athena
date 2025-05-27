// Mock data for testing

export const mockMalwareFile = {
  name: 'test-malware.exe',
  type: 'application/x-msdownload',
  size: 1024 * 1024, // 1MB
  uri: 'file:///test/malware.exe',
  mimeType: 'application/x-msdownload',
};

export const mockAnalysisResult = {
  id: 'test-analysis-123',
  fileName: 'test-malware.exe',
  fileHash: 'a1b2c3d4e5f6',
  analysisType: 'static',
  result: {
    malwareType: 'trojan',
    confidence: 0.95,
    indicators: [
      'Suspicious API calls detected',
      'Packed executable',
      'Network communication patterns',
    ],
    vulnerabilities: [
      {
        cve: 'CVE-2023-1234',
        severity: 'high',
        description: 'Buffer overflow vulnerability',
      },
    ],
  },
  timestamp: new Date().toISOString(),
};

export const mockContainerConfig = {
  id: 'test-container-1',
  name: 'malware-sandbox',
  os: 'linux',
  memory: 2048,
  cpu: 2,
  isolated: true,
  networkMode: 'none',
};

export const mockApiKeys = {
  OPENAI_API_KEY: 'test-openai-key',
  CLAUDE_API_KEY: 'test-claude-key',
  DEEPSEEK_API_KEY: 'test-deepseek-key',
};

export const mockSecurityAlert = {
  id: 'alert-123',
  type: 'malware_detected',
  severity: 'critical',
  message: 'Malware detected in uploaded file',
  timestamp: new Date().toISOString(),
  details: {
    fileName: 'malicious.exe',
    threatType: 'ransomware',
    action: 'quarantined',
  },
};

export const mockApiError = {
  message: 'API request failed',
  code: 'NETWORK_ERROR',
  details: {
    statusCode: 500,
    endpoint: '/api/analyze',
  },
};

export const mockCorsError = {
  message: 'CORS policy: No \'Access-Control-Allow-Origin\' header',
  code: 'CORS_ERROR',
  isCorsError: true,
};