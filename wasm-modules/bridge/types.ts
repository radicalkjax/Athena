/**
 * Comprehensive TypeScript type definitions for WASM Analysis Engine
 * These interfaces provide full type coverage for all WASM functions
 */

// ============= Core Analysis Types =============

export interface AnalysisOptions {
  enableDeobfuscation?: boolean;
  maxAnalysisTime?: number;
  patternSets?: string[];
  deepScan?: boolean;
  extractStrings?: boolean;
}

export interface ThreatInfo {
  threat_type: string;
  confidence: number;
  description: string;
  indicators: string[];
}

export interface AnalysisMetadata {
  file_hash: string;
  analysis_time_ms: number;
  engine_version: string;
}

export interface AnalysisResult {
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  threats: ThreatInfo[];
  deobfuscated_content?: string;
  metadata: AnalysisMetadata;
}

// ============= Deobfuscation Types =============

export enum ObfuscationTechnique {
  Base64Encoding = 'Base64Encoding',
  HexEncoding = 'HexEncoding',
  UnicodeEscape = 'UnicodeEscape',
  CharCodeConcat = 'CharCodeConcat',
  StringReverse = 'StringReverse',
  XorEncryption = 'XorEncryption',
  CustomEncoding = 'CustomEncoding'
}

export interface DeobfuscationResult {
  original: string;
  deobfuscated: string;
  techniques_found: ObfuscationTechnique[];
  confidence: number;
}

// ============= Pattern Matching Types =============

export enum PatternCategory {
  Malware = 'Malware',
  Exploit = 'Exploit',
  Suspicious = 'Suspicious',
  Backdoor = 'Backdoor',
  CryptoMiner = 'CryptoMiner',
  Phishing = 'Phishing',
  Ransomware = 'Ransomware'
}

export enum PatternSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical'
}

export interface Pattern {
  id: string;
  name: string;
  description: string;
  category: PatternCategory;
  severity: PatternSeverity;
  regex?: string;
  bytes?: number[];
}

export interface PatternMatch {
  pattern: Pattern;
  offset: number;
  matched_content: string;
  context?: string;
}

// ============= Engine Interface =============

export interface IAnalysisEngine {
  /**
   * Get the version of the analysis engine
   */
  get_version(): string;

  /**
   * Analyze content for threats and malicious patterns
   * @param content - The content to analyze as Uint8Array
   * @param options - Optional analysis configuration
   * @returns Analysis results with threats, severity, and metadata
   */
  analyze(content: Uint8Array, options?: AnalysisOptions): Promise<AnalysisResult>;

  /**
   * Attempt to deobfuscate obfuscated content
   * @param content - The potentially obfuscated string content
   * @returns Deobfuscation results with techniques found
   */
  deobfuscate(content: string): Promise<DeobfuscationResult>;

  /**
   * Scan content for known malicious patterns
   * @param content - The content to scan as Uint8Array
   * @returns Array of pattern matches found
   */
  scan_patterns(content: Uint8Array): Promise<PatternMatch[]>;
}

// ============= Error Types =============

export class WASMError extends Error {
  constructor(message: string, public code: WASMErrorCode, public cause?: any) {
    super(message);
    this.name = 'WASMError';
    if (cause) {
      this.cause = cause;
    }
  }
}

export enum WASMErrorCode {
  InitializationFailed = 'INITIALIZATION_FAILED',
  AnalysisFailed = 'ANALYSIS_FAILED',
  DeobfuscationFailed = 'DEOBFUSCATION_FAILED',
  PatternScanFailed = 'PATTERN_SCAN_FAILED',
  InvalidInput = 'INVALID_INPUT',
  MemoryError = 'MEMORY_ERROR',
  TimeoutError = 'TIMEOUT_ERROR',
  UnknownError = 'UNKNOWN_ERROR'
}

// ============= Utility Types =============

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

export interface AnalysisRequest {
  file: FileInfo;
  content: ArrayBuffer;
  options?: AnalysisOptions;
}

export interface BatchAnalysisRequest {
  files: AnalysisRequest[];
  options?: AnalysisOptions;
  concurrency?: number;
}

export interface AnalysisProgress {
  current: number;
  total: number;
  currentFile?: string;
  percentage: number;
}

// ============= Result Types =============

export type AnalysisResultSuccess = {
  success: true;
  result: AnalysisResult;
  error?: never;
};

export type AnalysisResultError = {
  success: false;
  result?: never;
  error: WASMError;
};

export type AnalysisResultType = AnalysisResultSuccess | AnalysisResultError;

// ============= Event Types =============

export interface AnalysisEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  timestamp: number;
  data?: any;
}

export interface AnalysisEventHandlers {
  onStart?: (event: AnalysisEvent) => void;
  onProgress?: (progress: AnalysisProgress) => void;
  onComplete?: (result: AnalysisResult) => void;
  onError?: (error: WASMError) => void;
}

// ============= Configuration Types =============

export interface EngineConfig {
  maxFileSize?: number;
  timeout?: number;
  workerPool?: boolean;
  workerCount?: number;
  cacheResults?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ============= Performance Types =============

export interface PerformanceMetrics {
  initializationTime: number;
  analysisTime: number;
  deobfuscationTime?: number;
  patternScanTime?: number;
  totalTime: number;
  memoryUsed: number;
  throughput: number; // MB/s
}

// ============= Type Guards =============

export function isAnalysisResultSuccess(result: AnalysisResultType): result is AnalysisResultSuccess {
  return result.success === true;
}

export function isAnalysisResultError(result: AnalysisResultType): result is AnalysisResultError {
  return result.success === false;
}

export function isThreatDetected(result: AnalysisResult): boolean {
  return result.threats.length > 0 || result.severity !== 'safe';
}

export function isHighSeverity(result: AnalysisResult): boolean {
  return result.severity === 'high' || result.severity === 'critical';
}

// ============= Constants =============

export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const DEFAULT_TIMEOUT = 30000; // 30 seconds
export const SUPPORTED_FILE_TYPES = [
  'application/javascript',
  'text/javascript',
  'application/x-javascript',
  'text/html',
  'application/x-httpd-php',
  'application/octet-stream',
  'application/x-executable',
  'application/x-dosexec'
];

// Export everything for convenience
export * from './analysis-engine-bridge';