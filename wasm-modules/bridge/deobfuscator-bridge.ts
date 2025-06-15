// Dynamic imports - will be loaded based on platform
let Deobfuscator: any;
let StreamingDeobfuscator: any;
let getSupportedTechniques: any;
let getVersion: any;

declare const window: any;
const isBrowser = typeof window !== 'undefined';

export interface DeobfuscationResult {
  original: string;
  deobfuscated: string;
  techniquesApplied: AppliedTechnique[];
  confidence: number;
  metadata: DeobfuscationMetadata;
}

export interface AppliedTechnique {
  technique: ObfuscationTechnique;
  confidence: number;
  layer: number;
  context?: string;
}

export interface ObfuscationTechnique {
  type: 'Base64Encoding' | 'HexEncoding' | 'UnicodeEscape' | 'UrlEncoding' | 
        'CharCodeConcat' | 'StringReverse' | 'XorEncryption' | 'Rc4Encryption' |
        'JsEvalChain' | 'JsPackedCode' | 'PsEncodedCommand' | 'BinaryPacked' |
        'ControlFlowFlattening' | 'CustomEncoding';
  details?: any;
}

export interface DeobfuscationMetadata {
  entropyBefore: number;
  entropyAfter: number;
  layersDetected: number;
  processingTimeMs: number;
  suspiciousPatterns: string[];
  extractedStrings: ExtractedString[];
  mlPredictions?: MlPredictions;
}

export interface ExtractedString {
  value: string;
  confidence: number;
  context: string;
  offset: number;
}

export interface MlPredictions {
  obfuscationProbability: number;
  techniqueProbabilities: Record<string, number>;
  malwareProbability: number;
}

export interface ObfuscationAnalysis {
  detectedTechniques: Array<[ObfuscationTechnique, number]>;
  recommendedOrder: ObfuscationTechnique[];
  complexityScore: number;
  mlHints?: MlPredictions;
}

export interface DeobfuscatorConfig {
  maxLayers?: number;
  minConfidence?: number;
  enableMl?: boolean;
  timeoutMs?: number;
  extractStrings?: boolean;
  detectPackers?: boolean;
}

export interface EntropyAnalysis {
  entropy: number;
  maxChunkEntropy: number;
  minChunkEntropy: number;
  variance: number;
  anomalies: string[];
}

class WASMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WASMError';
  }
}

export class DeobfuscatorBridge {
  private static instance: DeobfuscatorBridge | null = null;
  private deobfuscator: any | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): DeobfuscatorBridge {
    if (!DeobfuscatorBridge.instance) {
      DeobfuscatorBridge.instance = new DeobfuscatorBridge();
    }
    return DeobfuscatorBridge.instance;
  }

  async initialize(config?: DeobfuscatorConfig): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize(config);
    await this.initPromise;
  }

  private async doInitialize(config?: DeobfuscatorConfig): Promise<void> {
    try {
      // Platform-specific loading
      let wasmModule: any;
      if (isBrowser) {
        // Browser environment
        wasmModule = await import('../core/deobfuscator/pkg-web/deobfuscator');
        await wasmModule.default();
      } else {
        // Node.js environment - deobfuscator doesn't have pkg-node yet, use pkg
        wasmModule = require('../core/deobfuscator/pkg/deobfuscator');
      }
      
      // Store module references
      Deobfuscator = wasmModule.Deobfuscator;
      StreamingDeobfuscator = wasmModule.StreamingDeobfuscator;
      getSupportedTechniques = wasmModule.getSupportedTechniques;
      getVersion = wasmModule.getVersion;
      
      if (config) {
        this.deobfuscator = Deobfuscator.withConfig(config);
      } else {
        this.deobfuscator = new Deobfuscator();
      }
      
      this.isInitialized = true;
    } catch (error: unknown) {
      this.isInitialized = false;
      this.initPromise = null;
      throw new WASMError(`Failed to initialize deobfuscator: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.deobfuscator) {
      throw new WASMError('Deobfuscator not initialized. Call initialize() first.');
    }
  }

  async detectObfuscation(content: string): Promise<ObfuscationAnalysis> {
    this.ensureInitialized();
    
    try {
      const result = await this.deobfuscator!.detectObfuscation(content);
      return result as ObfuscationAnalysis;
    } catch (error: unknown) {
      throw new WASMError(`Obfuscation detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async deobfuscate(content: string): Promise<DeobfuscationResult> {
    this.ensureInitialized();
    
    try {
      const result = await this.deobfuscator!.deobfuscate(content);
      return result as DeobfuscationResult;
    } catch (error: unknown) {
      throw new WASMError(`Deobfuscation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeEntropy(content: string): Promise<EntropyAnalysis> {
    this.ensureInitialized();
    
    try {
      const result = await this.deobfuscator!.analyzeEntropy(content);
      return result as EntropyAnalysis;
    } catch (error: unknown) {
      throw new WASMError(`Entropy analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async extractStrings(content: string): Promise<ExtractedString[]> {
    this.ensureInitialized();
    
    try {
      const result = await this.deobfuscator!.extractStrings(content);
      return result as ExtractedString[];
    } catch (error: unknown) {
      throw new WASMError(`String extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async extractIOCs(content: string): Promise<string[]> {
    this.ensureInitialized();
    
    try {
      const result = await this.deobfuscator!.extractIOCs(content);
      return result as string[];
    } catch (error: unknown) {
      throw new WASMError(`IOC extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getConfig(): Promise<DeobfuscatorConfig> {
    this.ensureInitialized();
    
    try {
      const config = await this.deobfuscator!.getConfig();
      return config as DeobfuscatorConfig;
    } catch (error: unknown) {
      throw new WASMError(`Failed to get config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateConfig(config: DeobfuscatorConfig): Promise<void> {
    this.ensureInitialized();
    
    try {
      await this.deobfuscator!.updateConfig(config);
    } catch (error: unknown) {
      throw new WASMError(`Failed to update config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getSupportedTechniques(): string[] {
    try {
      return getSupportedTechniques() as string[];
    } catch (error: unknown) {
      throw new WASMError(`Failed to get supported techniques: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getVersion(): string {
    try {
      return getVersion();
    } catch (error: unknown) {
      throw new WASMError(`Failed to get version: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  createStreamingDeobfuscator(chunkSize?: number): StreamingDeobfuscatorBridge {
    return new StreamingDeobfuscatorBridge(chunkSize);
  }

  destroy(): void {
    if (this.deobfuscator) {
      // Clean up if needed
      this.deobfuscator = null;
    }
    this.isInitialized = false;
    this.initPromise = null;
    DeobfuscatorBridge.instance = null;
  }
}

export class StreamingDeobfuscatorBridge {
  private streamingDeobfuscator: any | null = null;
  private isInitialized = false;

  constructor(private chunkSize?: number) {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      let wasmModule: any;
      if (isBrowser) {
        // Browser environment
        wasmModule = await import('../core/deobfuscator/pkg-web/deobfuscator');
        await wasmModule.default();
      } else {
        // Node.js environment
        wasmModule = require('../core/deobfuscator/pkg/deobfuscator');
      }
      this.streamingDeobfuscator = new wasmModule.StreamingDeobfuscator(this.chunkSize);
      this.isInitialized = true;
    } catch (error: unknown) {
      throw new WASMError(`Failed to initialize streaming deobfuscator: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.streamingDeobfuscator) {
      throw new WASMError('Streaming deobfuscator not initialized.');
    }
  }

  async processChunk(chunk: Uint8Array): Promise<DeobfuscationResult | null> {
    this.ensureInitialized();
    
    try {
      const result = await this.streamingDeobfuscator!.processChunk(chunk);
      if (result) {
        return result.result as DeobfuscationResult | null;
      }
      return null;
    } catch (error: unknown) {
      throw new WASMError(`Failed to process chunk: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async flush(): Promise<DeobfuscationResult | null> {
    this.ensureInitialized();
    
    try {
      const result = await this.streamingDeobfuscator!.flush();
      if (result) {
        return result.result as DeobfuscationResult | null;
      }
      return null;
    } catch (error: unknown) {
      throw new WASMError(`Failed to flush: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  destroy(): void {
    if (this.streamingDeobfuscator) {
      // Clean up if needed
      this.streamingDeobfuscator = null;
    }
    this.isInitialized = false;
  }
}

// Convenience functions
export async function deobfuscate(content: string, config?: DeobfuscatorConfig): Promise<DeobfuscationResult> {
  const bridge = DeobfuscatorBridge.getInstance();
  await bridge.initialize(config);
  return bridge.deobfuscate(content);
}

export async function detectObfuscation(content: string, config?: DeobfuscatorConfig): Promise<ObfuscationAnalysis> {
  const bridge = DeobfuscatorBridge.getInstance();
  await bridge.initialize(config);
  return bridge.detectObfuscation(content);
}

export async function analyzeEntropy(content: string): Promise<EntropyAnalysis> {
  const bridge = DeobfuscatorBridge.getInstance();
  await bridge.initialize();
  return bridge.analyzeEntropy(content);
}

export async function extractIOCs(content: string): Promise<string[]> {
  const bridge = DeobfuscatorBridge.getInstance();
  await bridge.initialize();
  return bridge.extractIOCs(content);
}