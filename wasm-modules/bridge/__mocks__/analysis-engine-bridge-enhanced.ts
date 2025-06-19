import { vi } from 'vitest';

export enum VulnerabilitySeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export interface AnalysisOptions {
  timeout?: number;
  skipPatterns?: string[];
  enableDeobfuscation?: boolean;
}

export interface AnalysisResult {
  vulnerabilities: any[];
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

export class AnalysisEngineBridge {
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  analyzeBuffer = vi.fn().mockImplementation(async (buffer: ArrayBuffer, options?: AnalysisOptions): Promise<AnalysisResult> => {
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      const { WASMError, WASMErrorCode } = await import('./types');
      throw new WASMError('Invalid buffer input', WASMErrorCode.InvalidInput);
    }
    
    // Handle timeout
    if (options?.timeout && options.timeout < 10) {
      const { WASMError, WASMErrorCode } = await import('./types');
      throw new WASMError('Analysis timeout exceeded', WASMErrorCode.TimeoutError);
    }

    // Convert buffer to string to check for patterns
    const decoder = new TextDecoder();
    const content = decoder.decode(buffer);
    
    // Generate mock vulnerabilities based on content
    const vulnerabilities = [];
    
    // Check for malicious patterns
    if (content.includes('eval(')) {
      vulnerabilities.push({
        type: 'dangerous_function',
        severity: VulnerabilitySeverity.High,
        description: 'Use of eval() function detected',
        category: 'execution',
        location: { offset: content.indexOf('eval('), length: 5 },
        details: { function: 'eval', risk: 'code injection' }
      });
    }
    
    if (content.includes('exec(')) {
      vulnerabilities.push({
        type: 'dangerous_function', 
        severity: VulnerabilitySeverity.Critical,
        description: 'Use of exec() function detected',
        category: 'execution',
        details: { function: 'exec', risk: 'command injection' }
      });
    }
    
    // Check for obfuscation patterns
    if (content.includes('atob(') || content.includes('btoa(')) {
      vulnerabilities.push({
        type: 'obfuscation',
        severity: VulnerabilitySeverity.Medium,
        description: 'Base64 encoding/decoding detected',
        category: 'obfuscation',
        details: 'Hello World'
      });
    }
    
    if (/\\x[0-9a-fA-F]{2}/.test(content)) {
      vulnerabilities.push({
        type: 'obfuscation',
        severity: VulnerabilitySeverity.Medium, 
        description: 'Hex encoded strings detected',
        category: 'obfuscation',
        details: { encoding: 'hex' }
      });
    }
    
    if (/\\u[0-9a-fA-F]{4}/.test(content)) {
      vulnerabilities.push({
        type: 'obfuscation',
        severity: VulnerabilitySeverity.Low,
        description: 'Unicode escape sequences detected', 
        category: 'obfuscation',
        details: { encoding: 'unicode' }
      });
    }
    
    // Check for malware signatures
    const malwarePatterns = [
      'CreateRemoteThread', 'VirtualAlloc', 'WriteProcessMemory', 'GetProcAddress',
      'document.write("<script', 'XMLHttpRequest', 'child_process', 'powershell.exe',
      'cmd.exe', 'Function(', 'setTimeout(', 'setInterval('
    ];
    malwarePatterns.forEach(pattern => {
      if (content.includes(pattern)) {
        vulnerabilities.push({
          type: 'malware_signature',
          severity: VulnerabilitySeverity.Critical,
          description: `Malware signature detected: ${pattern}`,
          category: 'malware',
          details: { signature: pattern }
        });
      }
    });
    
    // Check for network indicators  
    if (content.includes('malicious-domain.com')) {
      vulnerabilities.push({
        type: 'network_indicator',
        severity: VulnerabilitySeverity.High,
        description: 'Suspicious domain detected: malicious-domain.com',
        category: 'network',
        details: { domain: 'malicious-domain.com' }
      });
    }
    
    if (content.includes('suspicious-site.tk')) {
      vulnerabilities.push({
        type: 'network_indicator',
        severity: VulnerabilitySeverity.High,
        description: 'Suspicious domain detected: suspicious-site.tk',
        category: 'network',
        details: { domain: 'suspicious-site.tk' }
      });
    }
    
    if (content.includes('evil.com')) {
      vulnerabilities.push({
        type: 'network_indicator',
        severity: VulnerabilitySeverity.High,
        description: 'Suspicious domain detected: evil.com',
        category: 'network',
        details: { domain: 'evil.com' }
      });
    }
    
    // Check for IP addresses
    const ipMatch = content.match(/\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/);
    if (ipMatch) {
      vulnerabilities.push({
        type: 'network_indicator',
        severity: VulnerabilitySeverity.Medium,
        description: `Suspicious IP address detected: ${ipMatch[1]}`,
        category: 'network',
        details: { ip: ipMatch[1] }
      });
    }
    
    if (/https?:\/\//.test(content)) {
      vulnerabilities.push({
        type: 'network_indicator',
        severity: VulnerabilitySeverity.Medium,
        description: 'Suspicious URLs detected',
        category: 'network',
        details: { hasUrls: true }
      });
    }
    
    return {
      vulnerabilities,
      hash: 'a'.repeat(64), // Mock SHA256 hash
      file_size: buffer.byteLength,
      analysis_time_ms: Math.random() * 0.01, // Keep analysis time extremely small
      metadata: {
        fileSize: buffer.byteLength,
        fileType: 'unknown',
        entropy: Math.random() * 8
      },
      detections: vulnerabilities.map(v => ({ type: v.type, confidence: 0.85 })),
      confidence: 0.95,
      details: {},
      executionTime: Math.random() * 100 + 50,
      processingErrors: []
    };
  });

  scanMemory = vi.fn().mockResolvedValue({
    threats: [],
    suspiciousPatterns: []
  });

  detectPacking = vi.fn().mockResolvedValue({
    isPacked: false,
    packerType: null
  });

  analyzeCode = vi.fn().mockImplementation(async (code: string, language: string) => {
    return {
      success: true,
      data: {
        riskLevel: 'high',
        threats: ['obfuscation', 'data-exfiltration', 'crypto-mining'],
        detections: [
          { type: 'obfuscation', confidence: 0.9 },
          { type: 'network-exfiltration', confidence: 0.85 },
          { type: 'crypto-mining', confidence: 0.8 }
        ]
      }
    };
  });

  analyze = vi.fn().mockImplementation(async (data: Uint8Array, filename: string, type: string) => {
    // Return different results based on content
    const text = new TextDecoder().decode(data);
    const threats = [];
    let threatLevel = 1;
    
    if (text.includes('ransomware') || text.includes('encryptFile')) {
      threats.push({ type: 'ransomware', severity: 'critical' });
      threats.push({ type: 'file-encryption', severity: 'high' });
      threatLevel = 4;
    }
    
    if (text.includes('eval') || text.includes('atob')) {
      threats.push({ type: 'obfuscation', severity: 'high' });
      threatLevel = Math.max(threatLevel, 3);
    }
    
    return {
      success: true,
      threatLevel,
      threats,
      riskScore: threatLevel * 20
    };
  });

  cleanup(): void {
    this.initialized = false;
  }
}

export const analysisEngine = new AnalysisEngineBridge();
export const initializeAnalysisEngine = vi.fn().mockImplementation(async () => {
  await analysisEngine.initialize();
  return analysisEngine;
});
export const createAnalysisEngine = vi.fn().mockReturnValue(analysisEngine);