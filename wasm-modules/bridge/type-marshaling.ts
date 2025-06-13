/**
 * Type Marshaling for WASM Bridge
 * Handles serialization and deserialization of complex data structures
 * between JavaScript/TypeScript and WASM
 */

import {
  AnalysisResult,
  ThreatInfo,
  PatternMatch,
  DeobfuscationResult,
  ObfuscationTechnique,
  Pattern,
  PatternCategory,
  PatternSeverity,
  WASMError,
  WASMErrorCode
} from './types';

/**
 * Type marshaling configuration
 */
export interface MarshalingConfig {
  maxDepth?: number;
  maxArrayLength?: number;
  maxStringLength?: number;
  preserveUndefined?: boolean;
  preserveNull?: boolean;
  dateFormat?: 'iso' | 'timestamp';
}

const DEFAULT_CONFIG: MarshalingConfig = {
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
export class TypeMarshaler {
  private config: MarshalingConfig;

  constructor(config: Partial<MarshalingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Marshal JavaScript object to WASM-compatible format
   */
  marshal<T>(value: T, depth: number = 0): any {
    if (depth > this.config.maxDepth!) {
      throw new WASMError(
        `Maximum marshaling depth (${this.config.maxDepth}) exceeded`,
        WASMErrorCode.InvalidInput
      );
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
        return this.marshalString(value as any);

      case 'bigint':
        // Convert BigInt to string for WASM compatibility
        return value.toString();

      case 'symbol':
        // Symbols can't be serialized
        throw new WASMError(
          'Symbols cannot be marshaled to WASM',
          WASMErrorCode.InvalidInput
        );

      case 'function':
        // Functions can't be serialized
        throw new WASMError(
          'Functions cannot be marshaled to WASM',
          WASMErrorCode.InvalidInput
        );

      case 'object':
        return this.marshalObject(value as any, depth);

      default:
        throw new WASMError(
          `Unknown type: ${type}`,
          WASMErrorCode.InvalidInput
        );
    }
  }

  /**
   * Unmarshal WASM result back to JavaScript types
   */
  unmarshal<T>(value: any): T {
    return this.unmarshalValue(value, 0) as T;
  }

  private marshalString(value: string): string {
    if (value.length > this.config.maxStringLength!) {
      throw new WASMError(
        `String length (${value.length}) exceeds maximum (${this.config.maxStringLength})`,
        WASMErrorCode.InvalidInput
      );
    }
    return value;
  }

  private marshalObject(obj: any, depth: number): any {
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

  private marshalDate(date: Date): string | number {
    return this.config.dateFormat === 'timestamp' 
      ? date.getTime() 
      : date.toISOString();
  }

  private marshalArrayBuffer(buffer: ArrayBuffer | ArrayBufferView): any {
    if (buffer instanceof ArrayBuffer) {
      return {
        __type: 'ArrayBuffer',
        data: Array.from(new Uint8Array(buffer))
      };
    }

    // Handle typed arrays
    const typedArray = buffer as any;
    return {
      __type: typedArray.constructor.name,
      data: Array.from(typedArray)
    };
  }

  private marshalMap(map: Map<any, any>, depth: number): any {
    const entries: Array<[any, any]> = [];
    
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

  private marshalSet(set: Set<any>, depth: number): any {
    const values: any[] = [];
    
    for (const value of set.values()) {
      values.push(this.marshal(value, depth + 1));
    }

    return {
      __type: 'Set',
      values
    };
  }

  private marshalError(error: Error): any {
    return {
      __type: 'Error',
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  private marshalArray(arr: any[], depth: number): any[] {
    if (arr.length > this.config.maxArrayLength!) {
      throw new WASMError(
        `Array length (${arr.length}) exceeds maximum (${this.config.maxArrayLength})`,
        WASMErrorCode.InvalidInput
      );
    }

    return arr.map(item => this.marshal(item, depth + 1));
  }

  private marshalPlainObject(obj: any, depth: number): any {
    const result: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      // Skip undefined values unless configured to preserve them
      if (value === undefined && !this.config.preserveUndefined) {
        continue;
      }
      
      result[key] = this.marshal(value, depth + 1);
    }

    return result;
  }

  private unmarshalValue(value: any, depth: number): any {
    if (depth > this.config.maxDepth!) {
      throw new WASMError(
        `Maximum unmarshaling depth (${this.config.maxDepth}) exceeded`,
        WASMErrorCode.InvalidInput
      );
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

  private unmarshalObject(obj: any, depth: number): any {
    // Check for special type markers
    if (obj.__type) {
      return this.unmarshalSpecialType(obj, depth);
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.unmarshalValue(item, depth + 1));
    }

    // Handle plain objects
    const result: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.unmarshalValue(value, depth + 1);
    }

    return result;
  }

  private unmarshalSpecialType(obj: any, depth: number): any {
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
        const TypedArrayConstructor = (global as any)[obj.__type];
        return new TypedArrayConstructor(obj.data);

      case 'Map':
        const map = new Map();
        for (const [key, value] of obj.entries) {
          map.set(
            this.unmarshalValue(key, depth + 1),
            this.unmarshalValue(value, depth + 1)
          );
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

/**
 * Specialized marshalers for WASM types
 */
export class WASMTypeMarshaler extends TypeMarshaler {
  /**
   * Marshal AnalysisResult for WASM
   */
  marshalAnalysisResult(result: AnalysisResult): any {
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
  unmarshalAnalysisResult(data: any): AnalysisResult {
    return {
      severity: data.severity,
      threats: data.threats.map((threat: any) => this.unmarshalThreatInfo(threat)),
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
  marshalThreatInfo(threat: ThreatInfo): any {
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
  unmarshalThreatInfo(data: any): ThreatInfo {
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
  marshalPatternMatch(match: PatternMatch): any {
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
  unmarshalPatternMatch(data: any): PatternMatch {
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
  marshalPattern(pattern: Pattern): any {
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
  unmarshalPattern(data: any): Pattern {
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category as PatternCategory,
      severity: data.severity as PatternSeverity,
      regex: data.regex || undefined,
      bytes: data.bytes || undefined
    };
  }

  /**
   * Marshal DeobfuscationResult for WASM
   */
  marshalDeobfuscationResult(result: DeobfuscationResult): any {
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
  unmarshalDeobfuscationResult(data: any): DeobfuscationResult {
    return {
      original: data.original,
      deobfuscated: data.deobfuscated,
      techniques_found: data.techniques_found.map((t: string) => t as ObfuscationTechnique),
      confidence: data.confidence
    };
  }
}

// Export singleton instances
export const typeMarshaler = new TypeMarshaler();
export const wasmTypeMarshaler = new WASMTypeMarshaler();

// Helper functions
export function marshalForWASM<T>(value: T): any {
  return typeMarshaler.marshal(value);
}

export function unmarshalFromWASM<T>(value: any): T {
  return typeMarshaler.unmarshal<T>(value);
}

// Specialized helpers for common WASM types
export function marshalUint8Array(data: Uint8Array): number[] {
  return Array.from(data);
}

export function unmarshalUint8Array(data: number[]): Uint8Array {
  return new Uint8Array(data);
}

export function marshalStringArray(strings: string[]): any {
  return strings.map(s => typeMarshaler.marshal(s));
}

export function unmarshalStringArray(data: any[]): string[] {
  return data.map(d => typeMarshaler.unmarshal<string>(d));
}