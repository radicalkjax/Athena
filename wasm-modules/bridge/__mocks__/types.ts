export enum VulnerabilitySeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export enum ObfuscationType {
  Base64 = 'Base64',
  Hex = 'Hex',
  Unicode = 'Unicode',
  JavaScript = 'JavaScript',
  PowerShell = 'PowerShell',
  CharCode = 'CharCode',
  ROT13 = 'ROT13',
  XOR = 'XOR'
}

export interface FileAnalysisResult {
  vulnerabilities: Array<{
    type: string;
    severity: VulnerabilitySeverity;
    description: string;
    category: string;
    location?: { offset: number; length: number };
    details?: any;
  }>;
  hash: string;
  file_size: number;
  analysis_time_ms: number;
  metadata: {
    fileSize: number;
    fileType: string;
    entropy: number;
  };
  detections: any[];
  confidence: number;
  details: any;
  executionTime: number;
  processingErrors: any[];
}

export interface AnalysisError {
  code: string;
  message: string;
  details?: any;
}

// Re-export everything else from the actual types file
export * from '../types';