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
  WASMErrorCode,
  WASMErrorCode as ErrorCode, // Alias for compatibility
  VulnerabilitySeverity,
  FileAnalysisResult,
  AnalysisError
} from './types';

// Export mock web streaming bridge for testing
export const webStreamingBridge = {
  analyzeStream: async (stream: ReadableStream, options: any) => {
    const reader = stream.getReader();
    let processedBytes = 0;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        processedBytes += value.byteLength;
        
        if (options.onProgress) {
          options.onProgress({
            processedBytes,
            totalBytes: processedBytes * 2, // Mock total
            percentage: Math.min(50, (processedBytes / 1000) * 100)
          });
        }
        
        if (options.onChunk) {
          options.onChunk({
            threats: [],
            vulnerabilities: [],
            offset: processedBytes - value.byteLength
          });
        }
      }
      
      if (options.onComplete) {
        options.onComplete({
          totalThreats: 0,
          totalVulnerabilities: 0,
          processedBytes
        });
      }
      
      return {
        success: true,
        processedBytes,
        threats: [],
        vulnerabilities: []
      };
    } finally {
      reader.releaseLock();
    }
  },
  
  analyzeBatch: async (buffers: ArrayBuffer[], options: any) => {
    const results = [];
    
    for (let i = 0; i < buffers.length; i++) {
      if (options.onProgress) {
        options.onProgress({
          completed: i,
          total: buffers.length,
          percentage: (i / buffers.length) * 100
        });
      }
      
      results.push({
        buffer: buffers[i],
        threats: [],
        vulnerabilities: [],
        processedAt: Date.now()
      });
    }
    
    return results;
  },
  
  createAnalysisTransform: () => {
    return new TransformStream({
      transform(chunk, controller) {
        // Mock transform - just pass through
        controller.enqueue({
          original: chunk,
          analyzed: true,
          threats: [],
          timestamp: Date.now()
        });
      }
    });
  }
};