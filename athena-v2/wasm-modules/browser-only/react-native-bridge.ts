/**
 * React Native Bridge for WASM Analysis Engine
 * Provides native module integration and performance optimizations
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import {
  AnalysisResult,
  AnalysisOptions,
  DeobfuscationResult,
  PatternMatch,
  WASMError,
  WASMErrorCode,
  AnalysisProgress,
  AnalysisEventHandlers,
  IAnalysisEngine,
  EngineConfig
} from './types';

// Native module interface
interface NativeWASMModule {
  initialize(): Promise<void>;
  getVersion(): string;
  analyze(content: string, options: string): Promise<string>;
  deobfuscate(content: string): Promise<string>;
  scanPatterns(content: string): Promise<string>;
  isInitialized(): boolean;
}

// Get native module based on platform
const getNativeModule = (): NativeWASMModule => {
  if (Platform.OS === 'ios') {
    return NativeModules.WASMAnalysisEngine as NativeWASMModule;
  } else if (Platform.OS === 'android') {
    return NativeModules.WASMAnalysisEngineAndroid as NativeWASMModule;
  } else {
    throw new WASMError(
      `Unsupported platform: ${Platform.OS}`,
      WASMErrorCode.InitializationFailed
    );
  }
};

export class ReactNativeBridge implements IAnalysisEngine {
  private nativeModule: NativeWASMModule;
  private eventEmitter: NativeEventEmitter;
  private isInitialized = false;
  private initPromise?: Promise<void>;
  private config: EngineConfig;

  constructor(config: EngineConfig = {}) {
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB for mobile
      timeout: 60000, // 60 seconds
      logLevel: 'info',
      ...config
    };

    try {
      this.nativeModule = getNativeModule();
      this.eventEmitter = new NativeEventEmitter(this.nativeModule as any);
    } catch (error: unknown) {
      throw new WASMError(
        'Failed to load native WASM module. Ensure native dependencies are properly linked.',
        WASMErrorCode.InitializationFailed
      );
    }
  }

  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (this.isInitialized) {
      return Promise.resolve();
    }

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    try {
      // Check if already initialized on native side
      if (this.nativeModule.isInitialized()) {
        this.isInitialized = true;
        return;
      }

      // Initialize native module
      await this.nativeModule.initialize();
      this.isInitialized = true;

      this.log('info', `React Native WASM Bridge initialized: v${this.get_version()}`);
    } catch (error: unknown) {
      this.log('error', 'Failed to initialize React Native WASM Bridge:', error);
      throw new WASMError(
        `Native module initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        WASMErrorCode.InitializationFailed
      );
    } finally {
      this.initPromise = undefined;
    }
  }

  get_version(): string {
    this.ensureInitialized();
    return this.nativeModule.getVersion();
  }

  async analyze(
    content: Uint8Array,
    options?: AnalysisOptions,
    eventHandlers?: AnalysisEventHandlers
  ): Promise<AnalysisResult> {
    await this.ensureInitializedAsync();

    // Validate input
    if (!content || content.length === 0) {
      throw new WASMError('Content cannot be empty', WASMErrorCode.InvalidInput);
    }

    if (content.length > this.config.maxFileSize!) {
      throw new WASMError(
        `File size exceeds maximum allowed size of ${this.config.maxFileSize! / 1024 / 1024}MB`,
        WASMErrorCode.InvalidInput
      );
    }

    // Set up event listeners
    const progressListener = this.eventEmitter.addListener(
      'analysisProgress',
      (progress: AnalysisProgress) => {
        eventHandlers?.onProgress?.(progress);
      }
    );

    try {
      eventHandlers?.onStart?.({ type: 'start', timestamp: Date.now() });

      // Convert Uint8Array to base64 for native bridge
      const base64Content = this.uint8ArrayToBase64(content);
      const optionsJson = JSON.stringify(options || {});

      // Call native module
      const resultJson = await this.withTimeout(
        this.nativeModule.analyze(base64Content, optionsJson),
        options?.maxAnalysisTime || this.config.timeout!
      );

      // Parse result
      const result = JSON.parse(resultJson) as AnalysisResult;
      
      eventHandlers?.onComplete?.(result);
      
      return result;
    } catch (error: unknown) {
      const wasmError = this.wrapError(error, WASMErrorCode.AnalysisFailed);
      eventHandlers?.onError?.(wasmError);
      throw wasmError;
    } finally {
      progressListener.remove();
    }
  }

  async deobfuscate(content: string): Promise<DeobfuscationResult> {
    await this.ensureInitializedAsync();

    if (!content || content.trim().length === 0) {
      throw new WASMError('Content cannot be empty', WASMErrorCode.InvalidInput);
    }

    try {
      const resultJson = await this.nativeModule.deobfuscate(content);
      return JSON.parse(resultJson) as DeobfuscationResult;
    } catch (error: unknown) {
      throw this.wrapError(error, WASMErrorCode.DeobfuscationFailed);
    }
  }

  async scan_patterns(content: Uint8Array): Promise<PatternMatch[]> {
    await this.ensureInitializedAsync();

    if (!content || content.length === 0) {
      throw new WASMError('Content cannot be empty', WASMErrorCode.InvalidInput);
    }

    try {
      const base64Content = this.uint8ArrayToBase64(content);
      const resultJson = await this.nativeModule.scanPatterns(base64Content);
      return JSON.parse(resultJson) as PatternMatch[];
    } catch (error: unknown) {
      throw this.wrapError(error, WASMErrorCode.PatternScanFailed);
    }
  }

  // React Native specific methods

  /**
   * Analyze file from device storage
   */
  async analyzeFileFromUri(
    uri: string,
    options?: AnalysisOptions,
    eventHandlers?: AnalysisEventHandlers
  ): Promise<AnalysisResult> {
    // Import React Native file system
    const RNFS = require('react-native-fs');
    
    try {
      // Read file as base64
      const base64Content = await RNFS.readFile(uri, 'base64');
      const content = this.base64ToUint8Array(base64Content);
      
      return this.analyze(content, options, eventHandlers);
    } catch (error: unknown) {
      throw new WASMError(
        `Failed to read file from URI: ${error instanceof Error ? error.message : String(error)}`,
        WASMErrorCode.InvalidInput
      );
    }
  }

  /**
   * Batch analyze with optimized native calls
   */
  async batchAnalyzeNative(
    files: Array<{ uri: string; name: string }>,
    options?: AnalysisOptions,
    onProgress?: (progress: AnalysisProgress) => void
  ): Promise<Map<string, AnalysisResult | WASMError>> {
    const results = new Map<string, AnalysisResult | WASMError>();
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      onProgress?.({
        current: i + 1,
        total,
        currentFile: file.name,
        percentage: ((i + 1) / total) * 100
      });

      try {
        const result = await this.analyzeFileFromUri(file.uri, options);
        results.set(file.name, result);
      } catch (error: unknown) {
        results.set(
          file.name,
          error instanceof WASMError ? error :
            new WASMError(String(error), WASMErrorCode.AnalysisFailed)
        );
      }
    }

    return results;
  }

  /**
   * Set up background analysis task (iOS/Android)
   */
  async setupBackgroundAnalysis(
    taskId: string,
    options: {
      minimumInterval?: number; // minutes
      requiresCharging?: boolean;
      requiresDeviceIdle?: boolean;
    } = {}
  ): Promise<void> {
    if (Platform.OS === 'ios') {
      // iOS Background Task
      const BackgroundFetch = require('react-native-background-fetch').default;
      
      await BackgroundFetch.configure({
        minimumFetchInterval: options.minimumInterval || 15, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
        enableHeadless: true
      }, async (taskId) => {
        // Perform background analysis
        this.log('info', `Background analysis task started: ${taskId}`);
        
        // Implementation would go here
        
        BackgroundFetch.finish(taskId);
      }, (error) => {
        this.log('error', 'Background task failed to configure:', error);
      });
      
      await BackgroundFetch.status();
    } else if (Platform.OS === 'android') {
      // Android WorkManager
      // Implementation would use react-native-background-job or similar
      this.log('info', 'Android background analysis setup not yet implemented');
    }
  }

  // Utility methods

  private uint8ArrayToBase64(uint8Array: Uint8Array): string {
    // Convert Uint8Array to base64 for native bridge
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new WASMError('Operation timed out', WASMErrorCode.TimeoutError));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new WASMError(
        'React Native WASM Bridge not initialized. Call initialize() first.',
        WASMErrorCode.InitializationFailed
      );
    }
  }

  private async ensureInitializedAsync(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private wrapError(error: any, code: WASMErrorCode): WASMError {
    if (error instanceof WASMError) {
      return error;
    }

    const message = error?.message || String(error);
    return new WASMError(message, code);
  }

  private log(level: string, ...args: any[]): void {
    if (this.shouldLog(level)) {
      console[level]('[RN WASM Bridge]', ...args);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevel = levels.indexOf(this.config.logLevel || 'info');
    const messageLevel = levels.indexOf(level);
    return messageLevel >= configLevel;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.eventEmitter.removeAllListeners();
  }
}

// Export singleton instance
export const reactNativeBridge = new ReactNativeBridge();

// Helper functions
export async function initializeReactNativeBridge(config?: EngineConfig): Promise<void> {
  if (config) {
    const customBridge = new ReactNativeBridge(config);
    await customBridge.initialize();
    return;
  }

  await reactNativeBridge.initialize();
}

export function createReactNativeBridge(config: EngineConfig): ReactNativeBridge {
  return new ReactNativeBridge(config);
}