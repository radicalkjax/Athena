/**
 * WASM Analysis Engine Bridge Module
 * Central export point for all bridge functionality
 */

// Export all types
export * from './types';

// Export enhanced bridge implementation
export {
  analysisEngine,
  AnalysisEngineBridge,
  initializeAnalysisEngine,
  createAnalysisEngine
} from './analysis-engine-bridge-enhanced';

// Export type marshaling utilities
export {
  TypeMarshaler,
  WASMTypeMarshaler,
  typeMarshaler,
  wasmTypeMarshaler,
  marshalForWASM,
  unmarshalFromWASM,
  marshalUint8Array,
  unmarshalUint8Array,
  marshalStringArray,
  unmarshalStringArray
} from './type-marshaling';

// Re-export legacy bridge for backward compatibility
export {
  analysisEngine as legacyAnalysisEngine
} from './analysis-engine-bridge';

// Export platform-specific bridges
export { WebStreamingBridge, webStreamingBridge } from './web-streaming-bridge';
export { ReactNativeBridge, reactNativeBridge } from './react-native-bridge';

// Export file processor bridge
export {
  createFileProcessor,
  IFileProcessor,
  FileProcessorConfig,
  FileFormat,
  ExtractedString,
  SuspiciousPattern,
  FileValidation,
  FileMetadata,
  ParsedFile,
  FileSection,
  FileIntegrity
} from './file-processor-bridge';

// Convenience exports for common use cases
export { 
  isAnalysisResultSuccess,
  isAnalysisResultError,
  isThreatDetected,
  isHighSeverity,
  WASMError,
  WASMErrorCode
} from './types';