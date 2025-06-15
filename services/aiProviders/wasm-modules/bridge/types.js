"use strict";
/**
 * Comprehensive TypeScript type definitions for WASM Analysis Engine
 * These interfaces provide full type coverage for all WASM functions
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
exports.SUPPORTED_FILE_TYPES = exports.DEFAULT_TIMEOUT = exports.MAX_FILE_SIZE = exports.WASMErrorCode = exports.WASMError = exports.PatternSeverity = exports.PatternCategory = exports.ObfuscationTechnique = void 0;
exports.isAnalysisResultSuccess = isAnalysisResultSuccess;
exports.isAnalysisResultError = isAnalysisResultError;
exports.isThreatDetected = isThreatDetected;
exports.isHighSeverity = isHighSeverity;
// ============= Deobfuscation Types =============
var ObfuscationTechnique;
(function (ObfuscationTechnique) {
    ObfuscationTechnique["Base64Encoding"] = "Base64Encoding";
    ObfuscationTechnique["HexEncoding"] = "HexEncoding";
    ObfuscationTechnique["UnicodeEscape"] = "UnicodeEscape";
    ObfuscationTechnique["CharCodeConcat"] = "CharCodeConcat";
    ObfuscationTechnique["StringReverse"] = "StringReverse";
    ObfuscationTechnique["XorEncryption"] = "XorEncryption";
    ObfuscationTechnique["CustomEncoding"] = "CustomEncoding";
})(ObfuscationTechnique || (exports.ObfuscationTechnique = ObfuscationTechnique = {}));
// ============= Pattern Matching Types =============
var PatternCategory;
(function (PatternCategory) {
    PatternCategory["Malware"] = "Malware";
    PatternCategory["Exploit"] = "Exploit";
    PatternCategory["Suspicious"] = "Suspicious";
    PatternCategory["Backdoor"] = "Backdoor";
    PatternCategory["CryptoMiner"] = "CryptoMiner";
    PatternCategory["Phishing"] = "Phishing";
    PatternCategory["Ransomware"] = "Ransomware";
})(PatternCategory || (exports.PatternCategory = PatternCategory = {}));
var PatternSeverity;
(function (PatternSeverity) {
    PatternSeverity["Low"] = "Low";
    PatternSeverity["Medium"] = "Medium";
    PatternSeverity["High"] = "High";
    PatternSeverity["Critical"] = "Critical";
})(PatternSeverity || (exports.PatternSeverity = PatternSeverity = {}));
// ============= Error Types =============
class WASMError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'WASMError';
    }
}
exports.WASMError = WASMError;
var WASMErrorCode;
(function (WASMErrorCode) {
    WASMErrorCode["InitializationFailed"] = "INITIALIZATION_FAILED";
    WASMErrorCode["AnalysisFailed"] = "ANALYSIS_FAILED";
    WASMErrorCode["DeobfuscationFailed"] = "DEOBFUSCATION_FAILED";
    WASMErrorCode["PatternScanFailed"] = "PATTERN_SCAN_FAILED";
    WASMErrorCode["InvalidInput"] = "INVALID_INPUT";
    WASMErrorCode["MemoryError"] = "MEMORY_ERROR";
    WASMErrorCode["TimeoutError"] = "TIMEOUT_ERROR";
    WASMErrorCode["UnknownError"] = "UNKNOWN_ERROR";
})(WASMErrorCode || (exports.WASMErrorCode = WASMErrorCode = {}));
// ============= Type Guards =============
function isAnalysisResultSuccess(result) {
    return result.success === true;
}
function isAnalysisResultError(result) {
    return result.success === false;
}
function isThreatDetected(result) {
    return result.threats.length > 0 || result.severity !== 'safe';
}
function isHighSeverity(result) {
    return result.severity === 'high' || result.severity === 'critical';
}
// ============= Constants =============
exports.MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
exports.DEFAULT_TIMEOUT = 30000; // 30 seconds
exports.SUPPORTED_FILE_TYPES = [
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
__exportStar(require("./analysis-engine-bridge"), exports);
