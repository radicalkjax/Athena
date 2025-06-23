export interface WasmModule {
  id: string;
  name: string;
  loaded: boolean;
  memory_usage: number;
}

export interface WasmExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  execution_time_ms: number;
  memory_used: number;
}

export interface WasmRuntimeStatus {
  initialized: boolean;
  totalMemory: number;
  modules: WasmModule[];
}

export interface WasmAnalysisRequest {
  fileData: Uint8Array;
  analysisType: 'static' | 'dynamic' | 'network' | 'behavioral';
  options?: {
    timeout?: number;
    memoryLimit?: number;
    enableInstrumentation?: boolean;
  };
}

export interface WasmAnalysisResult {
  analysisId: string;
  type: string;
  timestamp: number;
  findings: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    evidence?: any;
  }[];
  metrics: {
    executionTime: number;
    memoryUsed: number;
    instructionsExecuted?: number;
  };
}