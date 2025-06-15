"use strict";
/**
 * WASM Analysis Engine Bridge Module
 * Central export point for all bridge functionality
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WASMErrorCode = exports.WASMError = exports.isHighSeverity = exports.isThreatDetected = exports.isAnalysisResultError = exports.isAnalysisResultSuccess = exports.NetworkBridge = exports.getNetworkBridge = exports.CryptoBridge = exports.cryptoBridge = exports.SandboxInstance = exports.createSandboxInstance = exports.executeInSandbox = exports.cleanupSandbox = exports.getSandbox = exports.initializeSandbox = exports.createFileProcessor = exports.legacyAnalysisEngine = exports.unmarshalStringArray = exports.marshalStringArray = exports.unmarshalUint8Array = exports.marshalUint8Array = exports.unmarshalFromWASM = exports.marshalForWASM = exports.wasmTypeMarshaler = exports.typeMarshaler = exports.WASMTypeMarshaler = exports.TypeMarshaler = exports.createAnalysisEngine = exports.initializeAnalysisEngine = exports.AnalysisEngineBridge = exports.analysisEngine = void 0;
// Export all types
__exportStar(require("./types"), exports);
// Export enhanced bridge implementation
var analysis_engine_bridge_enhanced_1 = require("./analysis-engine-bridge-enhanced");
Object.defineProperty(exports, "analysisEngine", { enumerable: true, get: function () { return analysis_engine_bridge_enhanced_1.analysisEngine; } });
Object.defineProperty(exports, "AnalysisEngineBridge", { enumerable: true, get: function () { return analysis_engine_bridge_enhanced_1.AnalysisEngineBridge; } });
Object.defineProperty(exports, "initializeAnalysisEngine", { enumerable: true, get: function () { return analysis_engine_bridge_enhanced_1.initializeAnalysisEngine; } });
Object.defineProperty(exports, "createAnalysisEngine", { enumerable: true, get: function () { return analysis_engine_bridge_enhanced_1.createAnalysisEngine; } });
// Export type marshaling utilities
var type_marshaling_1 = require("./type-marshaling");
Object.defineProperty(exports, "TypeMarshaler", { enumerable: true, get: function () { return type_marshaling_1.TypeMarshaler; } });
Object.defineProperty(exports, "WASMTypeMarshaler", { enumerable: true, get: function () { return type_marshaling_1.WASMTypeMarshaler; } });
Object.defineProperty(exports, "typeMarshaler", { enumerable: true, get: function () { return type_marshaling_1.typeMarshaler; } });
Object.defineProperty(exports, "wasmTypeMarshaler", { enumerable: true, get: function () { return type_marshaling_1.wasmTypeMarshaler; } });
Object.defineProperty(exports, "marshalForWASM", { enumerable: true, get: function () { return type_marshaling_1.marshalForWASM; } });
Object.defineProperty(exports, "unmarshalFromWASM", { enumerable: true, get: function () { return type_marshaling_1.unmarshalFromWASM; } });
Object.defineProperty(exports, "marshalUint8Array", { enumerable: true, get: function () { return type_marshaling_1.marshalUint8Array; } });
Object.defineProperty(exports, "unmarshalUint8Array", { enumerable: true, get: function () { return type_marshaling_1.unmarshalUint8Array; } });
Object.defineProperty(exports, "marshalStringArray", { enumerable: true, get: function () { return type_marshaling_1.marshalStringArray; } });
Object.defineProperty(exports, "unmarshalStringArray", { enumerable: true, get: function () { return type_marshaling_1.unmarshalStringArray; } });
// Re-export legacy bridge for backward compatibility
var analysis_engine_bridge_1 = require("./analysis-engine-bridge");
Object.defineProperty(exports, "legacyAnalysisEngine", { enumerable: true, get: function () { return analysis_engine_bridge_1.analysisEngine; } });
// Export platform-specific bridges
// Web streaming bridge moved to browser-only folder to avoid Node.js compatibility issues
// Use: import { WebStreamingBridge, webStreamingBridge } from './wasm-modules/browser-only/web-streaming-bridge';
// React Native bridge is exported separately to avoid import issues in non-React Native environments
// Use: import { ReactNativeBridge, reactNativeBridge } from './wasm-modules/browser-only/react-native-bridge';
// Export file processor bridge
var file_processor_bridge_1 = require("./file-processor-bridge");
Object.defineProperty(exports, "createFileProcessor", { enumerable: true, get: function () { return file_processor_bridge_1.createFileProcessor; } });
// Export sandbox bridge
var sandbox_bridge_1 = require("./sandbox-bridge");
Object.defineProperty(exports, "initializeSandbox", { enumerable: true, get: function () { return sandbox_bridge_1.initializeSandbox; } });
Object.defineProperty(exports, "getSandbox", { enumerable: true, get: function () { return sandbox_bridge_1.getSandbox; } });
Object.defineProperty(exports, "cleanupSandbox", { enumerable: true, get: function () { return sandbox_bridge_1.cleanupSandbox; } });
Object.defineProperty(exports, "executeInSandbox", { enumerable: true, get: function () { return sandbox_bridge_1.executeInSandbox; } });
Object.defineProperty(exports, "createSandboxInstance", { enumerable: true, get: function () { return sandbox_bridge_1.createSandboxInstance; } });
Object.defineProperty(exports, "SandboxInstance", { enumerable: true, get: function () { return sandbox_bridge_1.SandboxInstance; } });
// Export crypto bridge
var crypto_bridge_1 = require("./crypto-bridge");
Object.defineProperty(exports, "cryptoBridge", { enumerable: true, get: function () { return crypto_bridge_1.cryptoBridge; } });
Object.defineProperty(exports, "CryptoBridge", { enumerable: true, get: function () { return crypto_bridge_1.CryptoBridge; } });
// Export network bridge
var network_bridge_1 = require("./network-bridge");
Object.defineProperty(exports, "getNetworkBridge", { enumerable: true, get: function () { return network_bridge_1.getNetworkBridge; } });
Object.defineProperty(exports, "NetworkBridge", { enumerable: true, get: function () { return network_bridge_1.NetworkBridge; } });
// Convenience exports for common use cases
var types_1 = require("./types");
Object.defineProperty(exports, "isAnalysisResultSuccess", { enumerable: true, get: function () { return types_1.isAnalysisResultSuccess; } });
Object.defineProperty(exports, "isAnalysisResultError", { enumerable: true, get: function () { return types_1.isAnalysisResultError; } });
Object.defineProperty(exports, "isThreatDetected", { enumerable: true, get: function () { return types_1.isThreatDetected; } });
Object.defineProperty(exports, "isHighSeverity", { enumerable: true, get: function () { return types_1.isHighSeverity; } });
Object.defineProperty(exports, "WASMError", { enumerable: true, get: function () { return types_1.WASMError; } });
Object.defineProperty(exports, "WASMErrorCode", { enumerable: true, get: function () { return types_1.WASMErrorCode; } });
