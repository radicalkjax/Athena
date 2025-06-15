"use strict";
/**
 * Type Marshaling for WASM Bridge
 * Handles serialization and deserialization of complex data structures
 * between JavaScript/TypeScript and WASM
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wasmTypeMarshaler = exports.typeMarshaler = exports.WASMTypeMarshaler = exports.TypeMarshaler = void 0;
exports.marshalForWASM = marshalForWASM;
exports.unmarshalFromWASM = unmarshalFromWASM;
exports.marshalUint8Array = marshalUint8Array;
exports.unmarshalUint8Array = unmarshalUint8Array;
exports.marshalStringArray = marshalStringArray;
exports.unmarshalStringArray = unmarshalStringArray;
const types_1 = require("./types");
const DEFAULT_CONFIG = {
    maxDepth: 10,
    maxArrayLength: 10000,
    maxStringLength: 1000000, // 1MB
    preserveUndefined: false,
    preserveNull: true,
    dateFormat: 'iso'
};
/**
 * Type marshaler for converting between JS and WASM-compatible types
 */
class TypeMarshaler {
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Marshal JavaScript object to WASM-compatible format
     */
    marshal(value, depth = 0) {
        if (depth > this.config.maxDepth) {
            throw new types_1.WASMError(`Maximum marshaling depth (${this.config.maxDepth}) exceeded`, types_1.WASMErrorCode.InvalidInput);
        }
        // Handle primitive types
        if (value === null) {
            return this.config.preserveNull ? null : undefined;
        }
        if (value === undefined) {
            return this.config.preserveUndefined ? undefined : null;
        }
        const type = typeof value;
        switch (type) {
            case 'boolean':
            case 'number':
                return value;
            case 'string':
                return this.marshalString(value);
            case 'bigint':
                // Convert BigInt to string for WASM compatibility
                return value.toString();
            case 'symbol':
                // Symbols can't be serialized
                throw new types_1.WASMError('Symbols cannot be marshaled to WASM', types_1.WASMErrorCode.InvalidInput);
            case 'function':
                // Functions can't be serialized
                throw new types_1.WASMError('Functions cannot be marshaled to WASM', types_1.WASMErrorCode.InvalidInput);
            case 'object':
                return this.marshalObject(value, depth);
            default:
                throw new types_1.WASMError(`Unknown type: ${type}`, types_1.WASMErrorCode.InvalidInput);
        }
    }
    /**
     * Unmarshal WASM result back to JavaScript types
     */
    unmarshal(value) {
        return this.unmarshalValue(value, 0);
    }
    marshalString(value) {
        if (value.length > this.config.maxStringLength) {
            throw new types_1.WASMError(`String length (${value.length}) exceeds maximum (${this.config.maxStringLength})`, types_1.WASMErrorCode.InvalidInput);
        }
        return value;
    }
    marshalObject(obj, depth) {
        // Handle special object types
        if (obj instanceof Date) {
            return this.marshalDate(obj);
        }
        if (obj instanceof ArrayBuffer || ArrayBuffer.isView(obj)) {
            return this.marshalArrayBuffer(obj);
        }
        if (obj instanceof Map) {
            return this.marshalMap(obj, depth);
        }
        if (obj instanceof Set) {
            return this.marshalSet(obj, depth);
        }
        if (obj instanceof Error) {
            return this.marshalError(obj);
        }
        if (Array.isArray(obj)) {
            return this.marshalArray(obj, depth);
        }
        // Handle plain objects
        return this.marshalPlainObject(obj, depth);
    }
    marshalDate(date) {
        return this.config.dateFormat === 'timestamp'
            ? date.getTime()
            : date.toISOString();
    }
    marshalArrayBuffer(buffer) {
        if (buffer instanceof ArrayBuffer) {
            return {
                __type: 'ArrayBuffer',
                data: Array.from(new Uint8Array(buffer))
            };
        }
        // Handle typed arrays
        const typedArray = buffer;
        return {
            __type: typedArray.constructor.name,
            data: Array.from(typedArray)
        };
    }
    marshalMap(map, depth) {
        const entries = [];
        for (const [key, value] of map.entries()) {
            entries.push([
                this.marshal(key, depth + 1),
                this.marshal(value, depth + 1)
            ]);
        }
        return {
            __type: 'Map',
            entries
        };
    }
    marshalSet(set, depth) {
        const values = [];
        for (const value of set.values()) {
            values.push(this.marshal(value, depth + 1));
        }
        return {
            __type: 'Set',
            values
        };
    }
    marshalError(error) {
        return {
            __type: 'Error',
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
    marshalArray(arr, depth) {
        if (arr.length > this.config.maxArrayLength) {
            throw new types_1.WASMError(`Array length (${arr.length}) exceeds maximum (${this.config.maxArrayLength})`, types_1.WASMErrorCode.InvalidInput);
        }
        return arr.map(item => this.marshal(item, depth + 1));
    }
    marshalPlainObject(obj, depth) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            // Skip undefined values unless configured to preserve them
            if (value === undefined && !this.config.preserveUndefined) {
                continue;
            }
            result[key] = this.marshal(value, depth + 1);
        }
        return result;
    }
    unmarshalValue(value, depth) {
        if (depth > this.config.maxDepth) {
            throw new types_1.WASMError(`Maximum unmarshaling depth (${this.config.maxDepth}) exceeded`, types_1.WASMErrorCode.InvalidInput);
        }
        if (value === null || value === undefined) {
            return value;
        }
        const type = typeof value;
        switch (type) {
            case 'boolean':
            case 'number':
            case 'string':
                return value;
            case 'object':
                return this.unmarshalObject(value, depth);
            default:
                return value;
        }
    }
    unmarshalObject(obj, depth) {
        // Check for special type markers
        if (obj.__type) {
            return this.unmarshalSpecialType(obj, depth);
        }
        // Handle arrays
        if (Array.isArray(obj)) {
            return obj.map(item => this.unmarshalValue(item, depth + 1));
        }
        // Handle plain objects
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = this.unmarshalValue(value, depth + 1);
        }
        return result;
    }
    unmarshalSpecialType(obj, depth) {
        switch (obj.__type) {
            case 'ArrayBuffer':
                return new Uint8Array(obj.data).buffer;
            case 'Uint8Array':
            case 'Uint16Array':
            case 'Uint32Array':
            case 'Int8Array':
            case 'Int16Array':
            case 'Int32Array':
            case 'Float32Array':
            case 'Float64Array':
                const TypedArrayConstructor = global[obj.__type];
                return new TypedArrayConstructor(obj.data);
            case 'Map':
                const map = new Map();
                for (const [key, value] of obj.entries) {
                    map.set(this.unmarshalValue(key, depth + 1), this.unmarshalValue(value, depth + 1));
                }
                return map;
            case 'Set':
                const set = new Set();
                for (const value of obj.values) {
                    set.add(this.unmarshalValue(value, depth + 1));
                }
                return set;
            case 'Error':
                const error = new Error(obj.message);
                error.name = obj.name;
                if (obj.stack) {
                    error.stack = obj.stack;
                }
                return error;
            default:
                // Unknown type, return as-is
                return obj;
        }
    }
}
exports.TypeMarshaler = TypeMarshaler;
/**
 * Specialized marshalers for WASM types
 */
class WASMTypeMarshaler extends TypeMarshaler {
    /**
     * Marshal AnalysisResult for WASM
     */
    marshalAnalysisResult(result) {
        return {
            severity: result.severity,
            threats: result.threats.map(threat => this.marshalThreatInfo(threat)),
            deobfuscated_content: result.deobfuscated_content || null,
            metadata: {
                file_hash: result.metadata.file_hash,
                analysis_time_ms: result.metadata.analysis_time_ms,
                engine_version: result.metadata.engine_version
            }
        };
    }
    /**
     * Unmarshal AnalysisResult from WASM
     */
    unmarshalAnalysisResult(data) {
        return {
            severity: data.severity,
            threats: data.threats.map((threat) => this.unmarshalThreatInfo(threat)),
            deobfuscated_content: data.deobfuscated_content || undefined,
            metadata: {
                file_hash: data.metadata.file_hash,
                analysis_time_ms: data.metadata.analysis_time_ms,
                engine_version: data.metadata.engine_version
            }
        };
    }
    /**
     * Marshal ThreatInfo for WASM
     */
    marshalThreatInfo(threat) {
        return {
            threat_type: threat.threat_type,
            confidence: threat.confidence,
            description: threat.description,
            indicators: threat.indicators
        };
    }
    /**
     * Unmarshal ThreatInfo from WASM
     */
    unmarshalThreatInfo(data) {
        return {
            threat_type: data.threat_type,
            confidence: data.confidence,
            description: data.description,
            indicators: data.indicators
        };
    }
    /**
     * Marshal PatternMatch for WASM
     */
    marshalPatternMatch(match) {
        return {
            pattern: this.marshalPattern(match.pattern),
            offset: match.offset,
            matched_content: match.matched_content,
            context: match.context || null
        };
    }
    /**
     * Unmarshal PatternMatch from WASM
     */
    unmarshalPatternMatch(data) {
        return {
            pattern: this.unmarshalPattern(data.pattern),
            offset: data.offset,
            matched_content: data.matched_content,
            context: data.context || undefined
        };
    }
    /**
     * Marshal Pattern for WASM
     */
    marshalPattern(pattern) {
        return {
            id: pattern.id,
            name: pattern.name,
            description: pattern.description,
            category: pattern.category,
            severity: pattern.severity,
            regex: pattern.regex || null,
            bytes: pattern.bytes || null
        };
    }
    /**
     * Unmarshal Pattern from WASM
     */
    unmarshalPattern(data) {
        return {
            id: data.id,
            name: data.name,
            description: data.description,
            category: data.category,
            severity: data.severity,
            regex: data.regex || undefined,
            bytes: data.bytes || undefined
        };
    }
    /**
     * Marshal DeobfuscationResult for WASM
     */
    marshalDeobfuscationResult(result) {
        return {
            original: result.original,
            deobfuscated: result.deobfuscated,
            techniques_found: result.techniques_found,
            confidence: result.confidence
        };
    }
    /**
     * Unmarshal DeobfuscationResult from WASM
     */
    unmarshalDeobfuscationResult(data) {
        return {
            original: data.original,
            deobfuscated: data.deobfuscated,
            techniques_found: data.techniques_found.map((t) => t),
            confidence: data.confidence
        };
    }
}
exports.WASMTypeMarshaler = WASMTypeMarshaler;
// Export singleton instances
exports.typeMarshaler = new TypeMarshaler();
exports.wasmTypeMarshaler = new WASMTypeMarshaler();
// Helper functions
function marshalForWASM(value) {
    return exports.typeMarshaler.marshal(value);
}
function unmarshalFromWASM(value) {
    return exports.typeMarshaler.unmarshal(value);
}
// Specialized helpers for common WASM types
function marshalUint8Array(data) {
    return Array.from(data);
}
function unmarshalUint8Array(data) {
    return new Uint8Array(data);
}
function marshalStringArray(strings) {
    return strings.map(s => exports.typeMarshaler.marshal(s));
}
function unmarshalStringArray(data) {
    return data.map(d => exports.typeMarshaler.unmarshal(d));
}
