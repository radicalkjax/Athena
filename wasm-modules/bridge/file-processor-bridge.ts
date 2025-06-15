/**
 * TypeScript bridge for the WASM File Processor module
 * Provides type-safe interface and error handling for file processing operations
 */

import {
  WASMError,
  EngineConfig,
  PerformanceMetrics,
  MAX_FILE_SIZE,
  DEFAULT_TIMEOUT
} from './types';
import { WASMErrorCode, ExtendedPerformanceMetrics, isBrowser } from './wasm-error-codes';

// File processor specific types
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

export interface FileProcessorConfig extends EngineConfig {
  minStringLength?: number;
  extractMetadata?: boolean;
  deepAnalysis?: boolean;
  supportedFormats?: string[];
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

class FileProcessorBridge implements IFileProcessor {
  private processor: any;
  private wasmModule: any;
  private isInitialized = false;
  private config: FileProcessorConfig;
  private initPromise?: Promise<void>;
  private performanceMetrics: Partial<ExtendedPerformanceMetrics> = {};

  constructor(config: FileProcessorConfig = {}) {
    this.config = {
      maxFileSize: MAX_FILE_SIZE,
      timeout: DEFAULT_TIMEOUT,
      workerPool: false,
      workerCount: 4,
      cacheResults: true,
      logLevel: 'info',
      minStringLength: 4,
      extractMetadata: true,
      deepAnalysis: false,
      ...config
    };
  }

  async initialize(): Promise<void> {
    // Return existing initialization promise if already in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Guard against multiple initializations
    if (this.isInitialized) {
      return;
    }

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    const startTime = performance.now();

    try {
      // Platform-specific loading
      if (isBrowser) {
        await this.loadForWeb();
      } else {
        await this.loadForNode();
      }

      // Create processor instance
      this.processor = new this.wasmModule.FileProcessor();

      // Initialize the module
      this.wasmModule.init();

      this.isInitialized = true;
      this.performanceMetrics.initTime = performance.now() - startTime;

      if (this.config.logLevel === 'debug') {
        console.log(`File Processor initialized in ${this.performanceMetrics.initTime}ms`);
      }
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to initialize File Processor',
        WASMErrorCode.INIT_FAILED,
        error
      );
    }
  }

  private async loadForWeb(): Promise<void> {
    try {
      // Dynamic import for web platform
      const module = await import('../core/file-processor/pkg-web/file_processor');
      await module.default();
      this.wasmModule = module;
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to load WASM module for web',
        WASMErrorCode.LOAD_FAILED,
        error
      );
    }
  }

  private async loadForNode(): Promise<void> {
    try {
      // For Node.js environment - file-processor doesn't have pkg-node yet, use pkg
      const module = require('../core/file-processor/pkg/file_processor');
      this.wasmModule = module;
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to load WASM module for Node.js',
        WASMErrorCode.LOAD_FAILED,
        error
      );
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new WASMError(
        'File Processor not initialized. Call initialize() first.',
        WASMErrorCode.NOT_INITIALIZED
      );
    }
  }

  private validateBuffer(buffer: ArrayBuffer): void {
    if (!buffer || !(buffer instanceof ArrayBuffer)) {
      throw new WASMError(
        'Invalid buffer provided',
        WASMErrorCode.INVALID_INPUT
      );
    }

    if (buffer.byteLength === 0) {
      throw new WASMError(
        'Empty buffer provided',
        WASMErrorCode.INVALID_INPUT
      );
    }

    const maxSize = this.config.maxFileSize || MAX_FILE_SIZE;
    if (buffer.byteLength > maxSize) {
      throw new WASMError(
        `File size ${buffer.byteLength} exceeds maximum allowed size ${maxSize}`,
        WASMErrorCode.SIZE_LIMIT_EXCEEDED
      );
    }
  }

  async detectFormat(buffer: ArrayBuffer, filename?: string): Promise<FileFormat> {
    this.ensureInitialized();
    this.validateBuffer(buffer);

    const startTime = performance.now();

    try {
      const uint8Array = new Uint8Array(buffer);
      const resultJson = await this.withTimeout(
        () => this.processor.detectFormat(uint8Array, filename || null),
        this.config.timeout || DEFAULT_TIMEOUT
      );

      const result = JSON.parse(resultJson);
      
      // Get MIME type for the detected format
      const mimeType = this.getMimeType(resultJson);

      this.performanceMetrics.lastOperationTime = performance.now() - startTime;

      return {
        format: result,
        confidence: 1.0, // TODO: Add confidence scoring
        mimeType
      };
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to detect file format',
        WASMErrorCode.PROCESSING_FAILED,
        error
      );
    }
  }

  async parseFile(buffer: ArrayBuffer, formatHint?: string): Promise<ParsedFile> {
    this.ensureInitialized();
    this.validateBuffer(buffer);

    const startTime = performance.now();

    try {
      const uint8Array = new Uint8Array(buffer);
      const resultJson = await this.withTimeout(
        () => this.processor.parseFile(uint8Array, formatHint || null),
        this.config.timeout || DEFAULT_TIMEOUT
      );

      const result = JSON.parse(resultJson);
      this.performanceMetrics.lastOperationTime = performance.now() - startTime;

      return result;
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to parse file',
        WASMErrorCode.PROCESSING_FAILED,
        error
      );
    }
  }

  async validateFile(buffer: ArrayBuffer): Promise<FileValidation> {
    this.ensureInitialized();
    this.validateBuffer(buffer);

    const startTime = performance.now();

    try {
      const uint8Array = new Uint8Array(buffer);
      const resultJson = await this.withTimeout(
        () => this.processor.validateFile(uint8Array),
        this.config.timeout || DEFAULT_TIMEOUT
      );

      const result = JSON.parse(resultJson);
      this.performanceMetrics.lastOperationTime = performance.now() - startTime;

      return result;
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to validate file',
        WASMErrorCode.PROCESSING_FAILED,
        error
      );
    }
  }

  async extractStrings(buffer: ArrayBuffer, minLength?: number): Promise<ExtractedString[]> {
    this.ensureInitialized();
    this.validateBuffer(buffer);

    const startTime = performance.now();

    try {
      const uint8Array = new Uint8Array(buffer);
      const resultJson = await this.withTimeout(
        () => this.processor.extractStrings(
          uint8Array, 
          minLength || this.config.minStringLength || null
        ),
        this.config.timeout || DEFAULT_TIMEOUT
      );

      const result = JSON.parse(resultJson);
      this.performanceMetrics.lastOperationTime = performance.now() - startTime;

      return result;
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to extract strings',
        WASMErrorCode.PROCESSING_FAILED,
        error
      );
    }
  }

  async extractMetadata(buffer: ArrayBuffer): Promise<FileMetadata> {
    this.ensureInitialized();
    this.validateBuffer(buffer);

    const startTime = performance.now();

    try {
      const uint8Array = new Uint8Array(buffer);
      const resultJson = await this.withTimeout(
        () => this.processor.extractMetadata(uint8Array),
        this.config.timeout || DEFAULT_TIMEOUT
      );

      const result = JSON.parse(resultJson);
      this.performanceMetrics.lastOperationTime = performance.now() - startTime;

      return result;
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to extract metadata',
        WASMErrorCode.PROCESSING_FAILED,
        error
      );
    }
  }

  async extractSuspiciousPatterns(content: string): Promise<SuspiciousPattern[]> {
    this.ensureInitialized();

    if (!content || typeof content !== 'string') {
      throw new WASMError(
        'Invalid content provided',
        WASMErrorCode.INVALID_INPUT
      );
    }

    const startTime = performance.now();

    try {
      const resultJson = await this.withTimeout(
        () => this.processor.extractSuspiciousPatterns(content),
        this.config.timeout || DEFAULT_TIMEOUT
      );

      const result = JSON.parse(resultJson);
      this.performanceMetrics.lastOperationTime = performance.now() - startTime;

      return result;
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to extract suspicious patterns',
        WASMErrorCode.PROCESSING_FAILED,
        error
      );
    }
  }

  async isTextFile(buffer: ArrayBuffer): Promise<boolean> {
    this.ensureInitialized();
    this.validateBuffer(buffer);

    try {
      const uint8Array = new Uint8Array(buffer);
      return this.processor.isTextFile(uint8Array);
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to check if file is text',
        WASMErrorCode.PROCESSING_FAILED,
        error
      );
    }
  }

  getMimeType(format: string): string {
    this.ensureInitialized();

    try {
      return this.processor.getMimeType(format);
    } catch (error: unknown) {
      // Return a default MIME type on error
      return 'application/octet-stream';
    }
  }

  private async withTimeout<T>(
    operation: () => T,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new WASMError(
          'Operation timed out',
          WASMErrorCode.TIMEOUT
        ));
      }, timeout);

      try {
        const result = operation();
        clearTimeout(timer);
        resolve(result);
      } catch (error: unknown) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  destroy(): void {
    if (this.processor) {
      this.processor.free();
      this.processor = null;
    }
    this.isInitialized = false;
    this.initPromise = undefined;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return {
      initializationTime: this.performanceMetrics.initTime || 0,
      analysisTime: this.performanceMetrics.lastOperationTime || 0,
      totalTime: (this.performanceMetrics.initTime || 0) + (this.performanceMetrics.lastOperationTime || 0),
      memoryUsed: 0, // TODO: Track memory usage
      throughput: 0 // TODO: Calculate throughput
    };
  }
}

// Factory function to create file processor instance
export function createFileProcessor(config?: FileProcessorConfig): IFileProcessor {
  return new FileProcessorBridge(config);
}

// Types are already exported as interfaces above