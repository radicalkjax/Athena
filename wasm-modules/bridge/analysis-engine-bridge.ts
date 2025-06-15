/**
 * TypeScript bridge for the WASM Analysis Engine
 * Provides a unified interface for both web and Node.js platforms
 */

declare const window: any;
const isBrowser = typeof window !== 'undefined';

export interface AnalysisOptions {
  enableDeobfuscation?: boolean;
  maxAnalysisTime?: number;
  patternSets?: string[];
}

export interface ThreatInfo {
  threat_type: string;
  confidence: number;
  description: string;
  indicators: string[];
}

export interface AnalysisMetadata {
  file_hash: string;
  analysis_time_ms: number;
  engine_version: string;
}

export interface AnalysisResult {
  severity: 'low' | 'medium' | 'high' | 'critical';
  threats: ThreatInfo[];
  deobfuscated_content?: string;
  metadata: AnalysisMetadata;
}

class AnalysisEngineBridge {
  private engine: any;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if we're in a browser environment
      if (isBrowser) {
        // Dynamic import for web
        const wasm = await import('../core/analysis-engine/pkg-web/athena_analysis_engine');
        await wasm.default();
        this.engine = new wasm.AnalysisEngine();
      } else {
        // Node.js import
        const wasm = require('../core/analysis-engine/pkg-node/athena_analysis_engine');
        this.engine = new wasm.AnalysisEngine();
      }
      
      this.isInitialized = true;
      console.log(`Analysis Engine initialized: v${this.getVersion()}`);
    } catch (error: unknown) {
      console.error('Failed to initialize WASM Analysis Engine:', error);
      throw new Error(`WASM initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getVersion(): string {
    this.ensureInitialized();
    return this.engine.get_version();
  }

  async analyze(content: ArrayBuffer, options: AnalysisOptions = {}): Promise<AnalysisResult> {
    this.ensureInitialized();
    
    const uint8Array = new Uint8Array(content);
    
    try {
      const result = await this.engine.analyze(uint8Array, options);
      return result as AnalysisResult;
    } catch (error: unknown) {
      console.error('Analysis failed:', error);
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Analysis Engine not initialized. Call initialize() first.');
    }
  }
}

// Export singleton instance
export const analysisEngine = new AnalysisEngineBridge();

// Helper function for easy initialization
export async function initializeAnalysisEngine(): Promise<void> {
  await analysisEngine.initialize();
}