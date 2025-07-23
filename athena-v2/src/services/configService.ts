interface AnalysisConfig {
  timeoutMs: number;
  maxFileSize: number;
  maxFileSizeMB: number;
  supportedFormats: string[];
  wasmModuleTimeout: number;
  concurrentAnalyses: number;
}

interface NetworkConfig {
  demoServerUrl: string;
  demoConnections: Array<{
    ip: string;
    count: number;
    type: string;
  }>;
  defaultPort: number;
  connectionTimeout: number;
}

interface UIConfig {
  animationSpeed: number;
  refreshInterval: number;
  maxLogEntries: number;
  chartUpdateInterval: number;
}

interface SecurityConfig {
  enableSandbox: boolean;
  allowedDomains: string[];
  maxMemoryAllocation: number;
  csrfProtection: boolean;
}

interface Config {
  analysis: AnalysisConfig;
  network: NetworkConfig;
  ui: UIConfig;
  security: SecurityConfig;
}

class ConfigService {
  private config: Config;

  constructor() {
    this.config = {
      analysis: {
        timeoutMs: this.getEnvNumber('VITE_ANALYSIS_TIMEOUT_MS', 300000), // 5 minutes
        maxFileSize: this.getEnvNumber('VITE_MAX_FILE_SIZE', 104857600), // 100MB in bytes
        maxFileSizeMB: this.getEnvNumber('VITE_MAX_FILE_SIZE_MB', 100),
        supportedFormats: this.getEnvArray('VITE_SUPPORTED_FORMATS', [
          'exe', 'dll', 'elf', 'mach-o', 'pdf', 'doc', 'docx', 
          'xls', 'xlsx', 'apk', 'zip', 'rar', '7z'
        ]),
        wasmModuleTimeout: this.getEnvNumber('VITE_WASM_TIMEOUT_MS', 60000), // 1 minute
        concurrentAnalyses: this.getEnvNumber('VITE_CONCURRENT_ANALYSES', 3)
      },
      network: {
        demoServerUrl: import.meta.env.VITE_DEMO_SERVER_URL || 'localhost:8080',
        demoConnections: [], // Will be populated from actual network analysis
        defaultPort: this.getEnvNumber('VITE_DEFAULT_PORT', 8080),
        connectionTimeout: this.getEnvNumber('VITE_CONNECTION_TIMEOUT_MS', 30000)
      },
      ui: {
        animationSpeed: this.getEnvNumber('VITE_ANIMATION_SPEED_MS', 300),
        refreshInterval: this.getEnvNumber('VITE_REFRESH_INTERVAL_MS', 1000),
        maxLogEntries: this.getEnvNumber('VITE_MAX_LOG_ENTRIES', 1000),
        chartUpdateInterval: this.getEnvNumber('VITE_CHART_UPDATE_MS', 2000)
      },
      security: {
        enableSandbox: this.getEnvBoolean('VITE_ENABLE_SANDBOX', true),
        allowedDomains: this.getEnvArray('VITE_ALLOWED_DOMAINS', []),
        maxMemoryAllocation: this.getEnvNumber('VITE_MAX_MEMORY_MB', 2048), // 2GB
        csrfProtection: this.getEnvBoolean('VITE_CSRF_PROTECTION', true)
      }
    };
  }

  private getEnvNumber(key: string, defaultValue: number): number {
    const value = import.meta.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private getEnvBoolean(key: string, defaultValue: boolean): boolean {
    const value = import.meta.env[key];
    if (value === undefined) return defaultValue;
    return value === 'true' || value === '1';
  }

  private getEnvArray(key: string, defaultValue: string[]): string[] {
    const value = import.meta.env[key];
    if (!value) return defaultValue;
    try {
      // Support both JSON array and comma-separated values
      if (value.startsWith('[')) {
        return JSON.parse(value);
      }
      return value.split(',').map((s: string) => s.trim());
    } catch {
      return defaultValue;
    }
  }

  get<K extends keyof Config>(section: K): Config[K] {
    return this.config[section];
  }

  getAll(): Config {
    return { ...this.config };
  }

  // Allow runtime updates (useful for testing or dynamic configuration)
  update<K extends keyof Config>(section: K, updates: Partial<Config[K]>): void {
    this.config[section] = {
      ...this.config[section],
      ...updates
    };
  }

  // Get a specific value with dot notation
  getValue(path: string): any {
    const keys = path.split('.');
    let value: any = this.config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }
}

// Export singleton instance
export const config = new ConfigService();

// Export type for TypeScript
export type { Config, AnalysisConfig, NetworkConfig, UIConfig, SecurityConfig };