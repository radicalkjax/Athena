import { vi } from 'vitest';

export interface SerializationOptions {
  format?: 'json' | 'binary' | 'protobuf';
  compression?: boolean;
  encryption?: boolean;
}

export interface TypeDescriptor {
  name: string;
  type: 'primitive' | 'object' | 'array' | 'function';
  size?: number;
  fields?: Record<string, TypeDescriptor>;
}

export interface MarshalingResult {
  data: Uint8Array;
  size: number;
  format: string;
  checksum?: string;
}

export interface UnmarshalingResult<T = any> {
  data: T;
  format: string;
  verified: boolean;
  metadata?: Record<string, any>;
}

export class TypeMarshaler {
  private static instance: TypeMarshaler | null = null;

  static getInstance(): TypeMarshaler {
    if (!TypeMarshaler.instance) {
      TypeMarshaler.instance = new TypeMarshaler();
    }
    return TypeMarshaler.instance;
  }

  // Serialization operations
  serialize = vi.fn().mockImplementation(async <T>(data: T, options?: SerializationOptions): Promise<MarshalingResult> => {
    const format = options?.format || 'json';
    let serialized: string;
    
    switch (format) {
      case 'json':
        serialized = JSON.stringify(data);
        break;
      case 'binary':
      case 'protobuf':
        serialized = JSON.stringify(data); // Mock binary serialization as JSON
        break;
      default:
        serialized = JSON.stringify(data);
    }
    
    const encoder = new TextEncoder();
    const bytes = encoder.encode(serialized);
    
    return {
      data: bytes,
      size: bytes.length,
      format,
      checksum: 'mock-checksum-' + bytes.length
    };
  });

  deserialize = vi.fn().mockImplementation(async <T>(marshaled: MarshalingResult): Promise<UnmarshalingResult<T>> => {
    const decoder = new TextDecoder();
    const serialized = decoder.decode(marshaled.data);
    
    let data: T;
    try {
      data = JSON.parse(serialized);
    } catch {
      throw new Error('Failed to deserialize data');
    }
    
    return {
      data,
      format: marshaled.format,
      verified: true,
      metadata: {
        originalSize: marshaled.size,
        checksum: marshaled.checksum
      }
    };
  });

  // Type conversion operations
  convertToWASMType = vi.fn().mockImplementation(async (data: any, targetType: string): Promise<Uint8Array> => {
    let converted: any;
    
    switch (targetType) {
      case 'i32':
        converted = new Int32Array([Number(data)]);
        break;
      case 'f64':
        converted = new Float64Array([Number(data)]);
        break;
      case 'string':
        converted = new TextEncoder().encode(String(data));
        break;
      default:
        converted = new TextEncoder().encode(JSON.stringify(data));
    }
    
    return new Uint8Array(converted.buffer || converted);
  });

  convertFromWASMType = vi.fn().mockImplementation(async (data: Uint8Array, sourceType: string): Promise<any> => {
    switch (sourceType) {
      case 'i32':
        return new Int32Array(data.buffer)[0];
      case 'f64':
        return new Float64Array(data.buffer)[0];
      case 'string':
        return new TextDecoder().decode(data);
      default:
        try {
          return JSON.parse(new TextDecoder().decode(data));
        } catch {
          return new TextDecoder().decode(data);
        }
    }
  });

  // Type validation
  validateType = vi.fn().mockImplementation(async (data: any, descriptor: TypeDescriptor): Promise<boolean> => {
    switch (descriptor.type) {
      case 'primitive':
        return typeof data === descriptor.name;
      case 'object':
        if (typeof data !== 'object' || data === null) return false;
        if (descriptor.fields) {
          for (const [field, fieldDesc] of Object.entries(descriptor.fields)) {
            if (!(field in data)) return false;
            if (!await this.validateType(data[field], fieldDesc)) return false;
          }
        }
        return true;
      case 'array':
        return Array.isArray(data);
      case 'function':
        return typeof data === 'function';
      default:
        return false;
    }
  });

  // Add marshal method for bridge.test.ts compatibility
  marshal = vi.fn().mockImplementation((data: any): any => {
    if (data instanceof Map) {
      return {
        __type: 'Map',
        entries: Array.from(data.entries())
      };
    }
    if (data instanceof Set) {
      return {
        __type: 'Set',
        data: Array.from(data.values())
      };
    }
    if (data instanceof Date) {
      return {
        __type: 'Date',
        data: data.toISOString()
      };
    }
    if (data instanceof ArrayBuffer) {
      return {
        __type: 'ArrayBuffer',
        data: Array.from(new Uint8Array(data))
      };
    }
    return data;
  });

  unmarshal = vi.fn().mockImplementation((marshaled: any): any => {
    if (marshaled && marshaled.__type) {
      switch (marshaled.__type) {
        case 'Map':
          return new Map(marshaled.entries || marshaled.data);
        case 'Set':
          return new Set(marshaled.data);
        case 'Date':
          return new Date(marshaled.data);
        case 'ArrayBuffer':
          return new Uint8Array(marshaled.data).buffer;
        default:
          return marshaled;
      }
    }
    return marshaled;
  });

  getTypeDescriptor = vi.fn().mockImplementation(async (data: any): Promise<TypeDescriptor> => {
    const type = typeof data;
    
    if (type === 'object') {
      if (data === null) {
        return { name: 'null', type: 'primitive' };
      }
      if (Array.isArray(data)) {
        return { name: 'array', type: 'array', size: data.length };
      }
      
      const fields: Record<string, TypeDescriptor> = {};
      for (const [key, value] of Object.entries(data)) {
        fields[key] = await this.getTypeDescriptor(value);
      }
      
      return { name: 'object', type: 'object', fields };
    }
    
    return { name: type, type: 'primitive' };
  });

  // Memory management
  allocateBuffer = vi.fn().mockImplementation(async (size: number): Promise<Uint8Array> => {
    return new Uint8Array(size);
  });

  copyToBuffer = vi.fn().mockImplementation(async (source: Uint8Array, target: Uint8Array, offset = 0): Promise<void> => {
    if (offset + source.length > target.length) {
      throw new Error('Buffer overflow');
    }
    target.set(source, offset);
  });

  calculateSize = vi.fn().mockImplementation(async (data: any): Promise<number> => {
    if (data instanceof Uint8Array) {
      return data.byteLength;
    }
    return new TextEncoder().encode(JSON.stringify(data)).byteLength;
  });
}

export const typeMarshaler = TypeMarshaler.getInstance();