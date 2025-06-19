import { vi } from 'vitest';

// File format detection interfaces
export interface FileFormat {
  format: string;
  confidence: number;
  mimeType?: string;
}

export interface ExtractedString {
  value: string;
  offset: number;
  encoding: string;
  suspicious: boolean;
}

export interface SuspiciousPattern {
  type: string;
  value: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  location?: string;
  evidence: string;
}

export interface FileValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  format?: string;
  size?: number;
  entropy?: number;
}

export interface FileMetadata {
  format: string;
  size: number;
  entropy: number;
  hash: string;
  createdAt?: string;
  modifiedAt?: string;
  author?: string;
  attributes?: {
    architecture?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ParsedFile {
  format: string;
  metadata: FileMetadata;
  sections: FileSection[];
  strings: ExtractedString[];
  suspicious_indicators: SuspiciousPattern[];
  integrity: FileIntegrity;
}

export interface FileSection {
  name: string;
  offset: number;
  size: number;
  entropy: number;
  hash: string;
  flags?: string[];
}

export interface FileIntegrity {
  validStructure: boolean;
  checksumValid?: boolean;
  signatureValid?: boolean;
  issues: string[];
}

export interface IFileProcessor {
  initialize(): Promise<void>;
  detectFormat(buffer: ArrayBuffer, filename?: string): Promise<FileFormat>;
  parseFile(buffer: ArrayBuffer, formatHint?: string): Promise<ParsedFile>;
  validateFile(buffer: ArrayBuffer): Promise<FileValidation>;
  extractStrings(buffer: ArrayBuffer, minLength?: number): Promise<ExtractedString[]>;
  extractMetadata(buffer: ArrayBuffer): Promise<FileMetadata>;
  extractSuspiciousPatterns(content: string): Promise<SuspiciousPattern[]>;
  isTextFile(buffer: ArrayBuffer): Promise<boolean>;
  getMimeType(format: string): string;
  destroy(): void;
}

export class FileProcessorBridge implements IFileProcessor {
  private static instance: FileProcessorBridge | null = null;
  private initialized = false;

  static getInstance(): FileProcessorBridge {
    if (!FileProcessorBridge.instance) {
      FileProcessorBridge.instance = new FileProcessorBridge();
    }
    return FileProcessorBridge.instance;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Format detection with realistic magic byte detection
  detectFormat = vi.fn().mockImplementation(async (buffer: ArrayBuffer, filename?: string): Promise<FileFormat> => {
    const data = new Uint8Array(buffer);
    
    // PDF detection
    if (data.length >= 4 && 
        data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46) {
      return {
        format: 'pdf',
        confidence: 0.95,
        mimeType: 'application/pdf'
      };
    }
    
    // PE executable detection
    if (data.length >= 2 && data[0] === 0x4D && data[1] === 0x5A) {
      return {
        format: 'pe',
        confidence: 0.9,
        mimeType: 'application/x-msdownload'
      };
    }
    
    // ELF detection
    if (data.length >= 4 && 
        data[0] === 0x7F && data[1] === 0x45 && data[2] === 0x4C && data[3] === 0x46) {
      return {
        format: 'elf',
        confidence: 0.95,
        mimeType: 'application/x-elf'
      };
    }
    
    // JavaScript detection (based on filename or content)
    if (filename?.endsWith('.js') || this.containsJavaScript(data)) {
      return {
        format: 'javascript',
        confidence: 0.8,
        mimeType: 'application/javascript'
      };
    }
    
    // Default to unknown
    return {
      format: 'unknown',
      confidence: 0.1,
      mimeType: 'application/octet-stream'
    };
  });

  // File validation with format-specific checks
  validateFile = vi.fn().mockImplementation(async (buffer: ArrayBuffer): Promise<FileValidation> => {
    const data = new Uint8Array(buffer);
    const format = await this.detectFormat(buffer);
    
    const validation: FileValidation = {
      isValid: true,
      errors: [],
      warnings: [],
      format: format.format,
      size: data.length,
      entropy: this.calculateMockEntropy(data)
    };
    
    // PDF validation
    if (format.format === 'pdf') {
      const content = new TextDecoder().decode(data);
      if (!content.includes('%%EOF')) {
        validation.errors.push('PDF missing end marker');
        validation.isValid = false;
      }
      if (content.includes('malformed')) {
        validation.warnings.push('Malformed PDF content detected');
      }
    }
    
    // Size limits
    if (data.length > 100 * 1024 * 1024) { // 100MB
      validation.warnings.push('File size exceeds recommended limits');
    }
    
    return validation;
  });

  // File parsing with format-specific logic
  parseFile = vi.fn().mockImplementation(async (buffer: ArrayBuffer, formatHint?: string): Promise<ParsedFile> => {
    const data = new Uint8Array(buffer);
    const format = await this.detectFormat(buffer);
    const metadata = await this.extractMetadata(buffer);
    const strings = await this.extractStrings(buffer, 4);
    
    const parsedFile: ParsedFile = {
      format: format.format,
      metadata,
      sections: this.generateMockSections(format.format),
      strings,
      suspicious_indicators: [],
      integrity: {
        validStructure: true,
        checksumValid: true,
        signatureValid: false,
        issues: []
      }
    };
    
    // PDF-specific parsing
    if (format.format === 'pdf') {
      const content = new TextDecoder().decode(data);
      
      // Check for JavaScript
      if (content.includes('/JavaScript') || content.includes('/JS')) {
        parsedFile.suspicious_indicators.push({
          type: 'javascript',
          value: 'Embedded JavaScript detected',
          severity: 'high',
          location: 'PDF content',
          evidence: 'JavaScript execution capability found'
        });
      }
      
      // Check for embedded files
      if (content.includes('/EmbeddedFiles') || content.includes('malware.exe')) {
        parsedFile.suspicious_indicators.push({
          type: 'embedded_file',
          value: 'Embedded executable detected',
          severity: 'high',
          location: 'PDF structure',
          evidence: 'Embedded file references found'
        });
      }
    }
    
    // PE-specific parsing
    if (format.format === 'pe') {
      // Check PE header for architecture
      if (data.length > 0x86 && data[0x84] === 0x64 && data[0x85] === 0x86) {
        parsedFile.metadata.attributes = { architecture: 'x64' };
      }
    }
    
    return parsedFile;
  });

  // String extraction with suspicious pattern detection
  extractStrings = vi.fn().mockImplementation(async (buffer: ArrayBuffer, minLength: number = 4): Promise<ExtractedString[]> => {
    const data = new Uint8Array(buffer);
    const content = new TextDecoder('utf-8', { fatal: false }).decode(data);
    
    const strings: ExtractedString[] = [];
    const suspiciousPatterns = [
      'cmd.exe', 'del /f /q', 'system32', 'http://', 'https://', 'malicious', 'payload.exe'
    ];
    
    // Extract readable strings
    const stringRegex = /[\x20-\x7E]{4,}/g;
    let match;
    
    while ((match = stringRegex.exec(content)) !== null) {
      const value = match[0];
      if (value.length >= minLength) {
        const suspicious = suspiciousPatterns.some(pattern => 
          value.toLowerCase().includes(pattern.toLowerCase())
        );
        
        strings.push({
          value,
          offset: match.index,
          encoding: 'ascii',
          suspicious
        });
      }
    }
    
    // Add some specific test strings
    if (content.includes('Hello World')) {
      strings.push({
        value: 'Hello World! This is a test string.',
        offset: content.indexOf('Hello World'),
        encoding: 'ascii',
        suspicious: false
      });
    }
    
    return strings;
  });

  // Metadata extraction
  extractMetadata = vi.fn().mockImplementation(async (buffer: ArrayBuffer): Promise<FileMetadata> => {
    const data = new Uint8Array(buffer);
    const format = await this.detectFormat(buffer);
    
    return {
      format: format.format,
      size: data.length,
      entropy: this.calculateMockEntropy(data),
      hash: this.generateMockHash(data),
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString()
    };
  });

  // Suspicious pattern extraction
  extractSuspiciousPatterns = vi.fn().mockImplementation(async (content: string): Promise<SuspiciousPattern[]> => {
    const patterns: SuspiciousPattern[] = [];
    
    // JavaScript patterns
    if (content.includes('eval')) {
      patterns.push({
        type: 'code_execution',
        value: 'eval',
        severity: 'high',
        evidence: 'Dynamic code execution detected'
      });
    }
    
    if (content.includes('document.cookie')) {
      patterns.push({
        type: 'data_theft',
        value: 'document.cookie',
        severity: 'critical',
        evidence: 'Cookie access detected - potential data theft'
      });
    }
    
    if (content.includes('fetch') && content.includes('evil.com')) {
      patterns.push({
        type: 'network_communication',
        value: 'suspicious-network',
        severity: 'high',
        evidence: 'Suspicious network communication detected'
      });
    }
    
    if (content.includes('CryptoMiner') || content.includes('miner')) {
      patterns.push({
        type: 'crypto_mining',
        value: 'crypto-mining',
        severity: 'high',
        evidence: 'Cryptocurrency mining code detected'
      });
    }
    
    if (content.includes('encryptFile') || content.includes('ransomware')) {
      patterns.push({
        type: 'ransomware',
        value: 'file-encryption',
        severity: 'critical',
        evidence: 'Ransomware encryption routine detected'
      });
    }
    
    // Windows API patterns (keep existing)
    if (content.includes('CreateRemoteThread')) {
      patterns.push({
        type: 'process_injection',
        value: 'CreateRemoteThread',
        severity: 'high',
        evidence: 'Process injection capability detected'
      });
    }
    
    if (content.includes('VirtualAlloc')) {
      patterns.push({
        type: 'memory_allocation',
        value: 'VirtualAlloc',
        severity: 'medium',
        evidence: 'Dynamic memory allocation detected'
      });
    }
    
    return patterns;
  });

  // Text file detection
  isTextFile = vi.fn().mockImplementation(async (buffer: ArrayBuffer): Promise<boolean> => {
    const data = new Uint8Array(buffer);
    
    // Simple heuristic: check for null bytes and high ratio of printable chars
    const nullBytes = Array.from(data).filter(b => b === 0).length;
    const nullRatio = nullBytes / data.length;
    
    return nullRatio < 0.1; // Less than 10% null bytes suggests text
  });

  // MIME type mapping
  getMimeType = vi.fn().mockImplementation((format: string): string => {
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'pe': 'application/x-msdownload',
      'elf': 'application/x-elf',
      'javascript': 'application/javascript',
      'zip': 'application/zip'
    };
    
    return mimeTypes[format.toLowerCase()] || 'application/octet-stream';
  });

  // Helper methods
  private containsJavaScript(data: Uint8Array): boolean {
    const content = new TextDecoder('utf-8', { fatal: false }).decode(data);
    return content.includes('console.log') || content.includes('function') || content.includes('var ');
  }

  private calculateMockEntropy(data: Uint8Array): number {
    // Simple mock entropy calculation
    const uniqueBytes = new Set(Array.from(data)).size;
    return (uniqueBytes / 256) * 8; // Max entropy of 8 bits
  }

  private generateMockHash(data: Uint8Array): string {
    // Simple mock hash based on data length and first few bytes
    const prefix = data.length > 4 ? 
      Array.from(data.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('') :
      '00000000';
    return `${prefix}${'0'.repeat(56)}`; // Mock SHA-256
  }

  private generateMockSections(format: string): FileSection[] {
    if (format === 'pe') {
      return [
        {
          name: '.text',
          offset: 0x1000,
          size: 0x2000,
          entropy: 6.2,
          hash: 'abc123def456',
          flags: ['executable', 'readable']
        },
        {
          name: '.data',
          offset: 0x3000,
          size: 0x1000,
          entropy: 4.1,
          hash: 'def456ghi789',
          flags: ['writable', 'readable']
        }
      ];
    }
    
    return [];
  }

  destroy(): void {
    this.initialized = false;
    FileProcessorBridge.instance = null;
  }
}

// Export the singleton instance and factory function
export const fileProcessorBridge = FileProcessorBridge.getInstance();
export const createFileProcessor = vi.fn().mockReturnValue(fileProcessorBridge);

export const getFileProcessor = vi.fn().mockReturnValue({
  processLargeFile: vi.fn().mockResolvedValue({
    success: true,
    chunks: 1024,
    processedBytes: 1024 * 1024,
    time: Date.now()
  })
});

// Legacy compatibility exports
export interface FileProcessorConfig {
  minStringLength?: number;
  extractMetadata?: boolean;
  deepAnalysis?: boolean;
  supportedFormats?: string[];
}

// Export type alias for compatibility
export type IFileProcessorAlias = FileProcessorBridge;