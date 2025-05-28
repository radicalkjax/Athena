import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// API provider types
export type APIProvider = 'openai' | 'claude' | 'deepseek';

// Platform types
export type AppPlatform = 'ios' | 'android' | 'web';

interface APIConfig {
  key?: string;
  baseUrl?: string;
  enabled: boolean;
}

interface DatabaseConfig {
  host: string;
  port: number;
  name: string;
  user: string;
  password: string;
  dialect: string;
}

interface RedisConfig {
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
}

interface APMConfig {
  enabled: boolean;
  provider: 'console' | 'statsd' | 'datadog' | 'newrelic';
  endpoint?: string;
  apiKey?: string;
  sampleRate: number;
}

class EnvironmentConfig {
  // Cached values
  private _isDev?: boolean;
  private _environment?: Environment;
  private _platform?: AppPlatform;

  // Redis environment variables (for compatibility)
  get REDIS_ENABLED(): string | undefined {
    return this.redis.enabled ? 'true' : undefined;
  }

  get REDIS_HOST(): string | undefined {
    return this.redis.host;
  }

  get REDIS_PORT(): string | undefined {
    return this.redis.port.toString();
  }

  get REDIS_PASSWORD(): string | undefined {
    return this.redis.password;
  }

  get REDIS_DB(): string | undefined {
    return this.redis.db.toString();
  }

  // Environment detection
  get isDev(): boolean {
    if (this._isDev === undefined) {
      this._isDev = __DEV__;
    }
    return this._isDev;
  }

  get isProd(): boolean {
    return !this.isDev;
  }

  get environment(): Environment {
    if (this._environment === undefined) {
      if (this.isDev) {
        this._environment = 'development';
      } else {
        // You can set this via environment variable in production
        this._environment = (process.env.NODE_ENV as Environment) || 'production';
      }
    }
    return this._environment;
  }

  // Platform detection
  get platform(): AppPlatform {
    if (this._platform === undefined) {
      this._platform = Platform.OS as AppPlatform;
    }
    return this._platform;
  }

  get isWeb(): boolean {
    return this.platform === 'web';
  }

  get isNative(): boolean {
    return !this.isWeb;
  }

  get isIOS(): boolean {
    return this.platform === 'ios';
  }

  get isAndroid(): boolean {
    return this.platform === 'android';
  }

  // Version info
  get appVersion(): string {
    return Constants.expoConfig?.version || '1.0.0';
  }

  get buildVersion(): string {
    if (this.isIOS) {
      return Constants.expoConfig?.ios?.buildNumber || '1';
    } else if (this.isAndroid) {
      return Constants.expoConfig?.android?.versionCode?.toString() || '1';
    }
    return '1';
  }

  // API Configurations
  get api(): Record<APIProvider, APIConfig> {
    const extra = Constants.expoConfig?.extra || {};
    
    return {
      openai: {
        key: extra.openaiApiKey,
        baseUrl: extra.openaiApiBaseUrl || 'https://api.openai.com/v1',
        enabled: !!(extra.openaiApiKey && typeof extra.openaiApiKey === 'string' && extra.openaiApiKey.trim()),
      },
      claude: {
        key: extra.claudeApiKey,
        baseUrl: extra.claudeApiBaseUrl || 'https://api.anthropic.com/v1',
        enabled: !!(extra.claudeApiKey && typeof extra.claudeApiKey === 'string' && extra.claudeApiKey.trim()),
      },
      deepseek: {
        key: extra.deepseekApiKey,
        baseUrl: extra.deepseekApiBaseUrl || 'https://api.deepseek.com/v1',
        enabled: !!(extra.deepseekApiKey && typeof extra.deepseekApiKey === 'string' && extra.deepseekApiKey.trim()),
      },
    };
  }

  // Database configuration
  get database(): DatabaseConfig {
    const defaultConfig: DatabaseConfig = {
      host: 'localhost',
      port: 5432,
      name: 'athena_db',
      user: 'postgres',
      password: 'postgres',
      dialect: 'postgres',
    };

    if (this.isProd) {
      // In production, use environment variables
      return {
        host: process.env.DB_HOST || defaultConfig.host,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || defaultConfig.name,
        user: process.env.DB_USER || defaultConfig.user,
        password: process.env.DB_PASSWORD || defaultConfig.password,
        dialect: process.env.DB_DIALECT || defaultConfig.dialect,
      };
    }

    return defaultConfig;
  }

  // Feature flags
  get features() {
    return {
      containerIsolation: true,
      metasploitIntegration: true,
      localModels: false, // Coming soon
      advancedAnalysis: true,
      persistentStorage: true,
    };
  }

  // Security settings
  get security() {
    return {
      // Maximum file size for analysis (in bytes)
      maxFileSize: 50 * 1024 * 1024, // 50MB
      // Allowed file extensions for analysis
      allowedExtensions: ['.exe', '.dll', '.js', '.py', '.sh', '.bat', '.ps1', '.vbs', '.jar', '.apk'],
      // Container timeout (in seconds)
      containerTimeout: 300, // 5 minutes
      // Enable strict mode for container isolation
      strictContainerMode: this.isProd,
    };
  }

  // Logging configuration
  get logging() {
    return {
      // Log level based on environment
      level: this.isDev ? 'debug' : 'error',
      // Enable console logging
      console: this.isDev,
      // Enable remote logging (in production)
      remote: this.isProd,
      // Maximum log entries to keep in memory
      maxEntries: 1000,
    };
  }

  // Analytics configuration
  get analytics() {
    return {
      // Enable analytics in production
      enabled: this.isProd,
      // Analytics provider (future implementation)
      provider: 'custom',
      // Events to track
      trackEvents: ['analysis_started', 'analysis_completed', 'error_occurred'],
    };
  }

  // Performance settings
  get performance() {
    return {
      // Enable performance monitoring
      monitoring: this.isDev,
      // Bundle analyzer in development
      bundleAnalyzer: this.isDev,
      // React DevTools
      reactDevTools: this.isDev,
    };
  }

  // Redis configuration
  get redis(): RedisConfig {
    const extra = Constants.expoConfig?.extra || {};
    
    return {
      enabled: !!(extra.redisEnabled || process.env.REDIS_ENABLED === 'true'),
      host: extra.redisHost || process.env.REDIS_HOST || 'localhost',
      port: parseInt(extra.redisPort || process.env.REDIS_PORT || '6379', 10),
      password: extra.redisPassword || process.env.REDIS_PASSWORD,
      db: parseInt(extra.redisDb || process.env.REDIS_DB || '0', 10),
      keyPrefix: extra.redisKeyPrefix || process.env.REDIS_KEY_PREFIX || 'athena:',
    };
  }

  // APM configuration
  get apm(): APMConfig {
    const extra = Constants.expoConfig?.extra || {};
    
    return {
      enabled: !!(extra.apmEnabled || process.env.APM_ENABLED === 'true'),
      provider: (extra.apmProvider || process.env.APM_PROVIDER || 'console') as APMConfig['provider'],
      endpoint: extra.apmEndpoint || process.env.APM_ENDPOINT,
      apiKey: extra.apmApiKey || process.env.APM_API_KEY,
      sampleRate: parseFloat(extra.apmSampleRate || process.env.APM_SAMPLE_RATE || '1.0'),
    };
  }

  // Get a safe string representation (no sensitive data)
  toString(): string {
    return JSON.stringify({
      environment: this.environment,
      platform: this.platform,
      version: this.appVersion,
      features: this.features,
      apis: {
        openai: { enabled: this.api.openai.enabled },
        claude: { enabled: this.api.claude.enabled },
        deepseek: { enabled: this.api.deepseek.enabled },
      },
    }, null, 2);
  }
}

// Singleton instance
export const env = new EnvironmentConfig();

// Type exports
export type { APIConfig, DatabaseConfig };