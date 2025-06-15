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
// Web streaming bridge moved to browser-only folder to avoid Node.js compatibility issues
// Use: import { WebStreamingBridge, webStreamingBridge } from './wasm-modules/browser-only/web-streaming-bridge';
// React Native bridge is exported separately to avoid import issues in non-React Native environments
// Use: import { ReactNativeBridge, reactNativeBridge } from './wasm-modules/browser-only/react-native-bridge';

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

// Export sandbox bridge
export {
  initializeSandbox,
  getSandbox,
  cleanupSandbox,
  executeInSandbox,
  createSandboxInstance,
  Sandbox,
  SandboxInstance,
  ExecutionPolicy,
  ExecutionResult,
  ResourceUsage,
  SecurityEvent,
  SandboxInstanceInfo
} from './sandbox-bridge';

// Export crypto bridge
export {
  cryptoBridge,
  CryptoBridge,
  CryptoCapabilities,
  HashOptions,
  HmacOptions,
  AesOptions,
  RsaOptions,
  RsaKeyPair
} from './crypto-bridge';

// Export network bridge
export {
  getNetworkBridge,
  NetworkBridge,
  NetworkResult,
  PacketAnalysis,
  ProtocolInfo,
  NetworkAnomaly,
  TrafficPattern,
  PortScanInfo,
  DataExfiltrationInfo,
  CCPatternResult,
  PortScanResult,
  ExfiltrationResult
} from './network-bridge';

// Convenience exports for common use cases
export { 
  isAnalysisResultSuccess,
  isAnalysisResultError,
  isThreatDetected,
  isHighSeverity,
  WASMError,
  WASMErrorCode
} from './types';