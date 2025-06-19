"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeWindow = exports.isBrowser = exports.WASMErrorCode = void 0;
/**
 * Extended WASM Error Codes for backwards compatibility
 */
const types_1 = require("./types");
exports.WASMErrorCode = {
    ...types_1.WASMErrorCode,
    // Additional error codes for compatibility
    INIT_FAILED: types_1.WASMErrorCode.InitializationFailed,
    LOAD_FAILED: types_1.WASMErrorCode.InitializationFailed,
    NOT_INITIALIZED: types_1.WASMErrorCode.InitializationFailed,
    INVALID_INPUT: types_1.WASMErrorCode.InvalidInput,
    SIZE_LIMIT_EXCEEDED: types_1.WASMErrorCode.InvalidInput,
    PROCESSING_FAILED: types_1.WASMErrorCode.AnalysisFailed,
    TIMEOUT: types_1.WASMErrorCode.TimeoutError,
};
// Type guard for browser environment
exports.isBrowser = typeof window !== 'undefined';
// Safe window reference
exports.safeWindow = exports.isBrowser ? window : undefined;
