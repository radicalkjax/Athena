/**
 * Extended WASM Error Codes for backwards compatibility
 */
import { WASMErrorCode as BaseWASMErrorCode } from './types';

declare const window: any;

export const WASMErrorCode = {
  ...BaseWASMErrorCode,
  // Additional error codes for compatibility
  INIT_FAILED: BaseWASMErrorCode.InitializationFailed,
  LOAD_FAILED: BaseWASMErrorCode.InitializationFailed,
  NOT_INITIALIZED: BaseWASMErrorCode.InitializationFailed,
  INVALID_INPUT: BaseWASMErrorCode.InvalidInput,
  SIZE_LIMIT_EXCEEDED: BaseWASMErrorCode.InvalidInput,
  PROCESSING_FAILED: BaseWASMErrorCode.AnalysisFailed,
  TIMEOUT: BaseWASMErrorCode.TimeoutError,
} as const;

// Extended Performance Metrics interface
export interface ExtendedPerformanceMetrics {
  initializationTime: number;
  analysisTime: number;
  deobfuscationTime?: number;
  patternScanTime?: number;
  totalTime: number;
  memoryUsed: number;
  throughput: number;
  // Additional properties for compatibility
  initTime?: number;
  lastOperationTime?: number;
}

// Type guard for browser environment
export const isBrowser = typeof window !== 'undefined';

// Safe window reference
export const safeWindow = isBrowser ? window : undefined;