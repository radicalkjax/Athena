import { env } from '@/shared/config/environment';

/**
 * Feature flag configuration interface
 */
export interface FeatureFlags {
  // Cache features
  enableRedisCache: boolean;
  enableMemoryCache: boolean;
  cacheAnalysisResults: boolean;
  
  // Performance monitoring features
  enableAPM: boolean;
  enablePerformanceMonitoring: boolean;
  
  // AI service features
  enableStreamingAnalysis: boolean;
  enableBatchAnalysis: boolean;
  aiProviderPriority: string[];
  enableAIFailover: boolean;
  
  // Resilience features
  enableCircuitBreaker: boolean;
  enableBulkhead: boolean;
  enableAdaptiveCircuitBreaker: boolean;
  
  // Container features
  enableContainerIsolation: boolean;
  enableContainerResourceLimits: boolean;
  
  // Analysis features
  enableMetasploitIntegration: boolean;
  enableLocalModels: boolean;
  enableAdvancedAnalysis: boolean;
  
  // Storage features
  enablePersistentStorage: boolean;
  enableDatabaseStorage: boolean;
}

/**
 * Feature flag override interface for runtime configuration
 */
export interface FeatureFlagOverrides {
  [key: string]: boolean | string | string[];
}

/**
 * Feature flags service for managing application features
 */
class FeatureFlagsService {
  private overrides: FeatureFlagOverrides = {};
  private readonly storageKey = 'athena:feature-flags';
  
  constructor() {
    // Load saved overrides from storage in browser environment
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          this.overrides = JSON.parse(saved);
        }
      } catch (error) {
        console.warn('Failed to load feature flag overrides:', error);
      }
    }
  }
  
  /**
   * Get current feature flags configuration
   */
  get flags(): FeatureFlags {
    const extra = env.isDev ? {} : (process.env as any);
    
    return {
      // Cache features
      enableRedisCache: this.getFlag('enableRedisCache', env.redis.enabled),
      enableMemoryCache: this.getFlag('enableMemoryCache', true),
      cacheAnalysisResults: this.getFlag('cacheAnalysisResults', true),
      
      // Performance monitoring features
      enableAPM: this.getFlag('enableAPM', env.apm.enabled),
      enablePerformanceMonitoring: this.getFlag('enablePerformanceMonitoring', env.performance.monitoring),
      
      // AI service features
      enableStreamingAnalysis: this.getFlag('enableStreamingAnalysis', true),
      enableBatchAnalysis: this.getFlag('enableBatchAnalysis', true),
      aiProviderPriority: this.getArrayFlag('aiProviderPriority', this.getDefaultAIProviderPriority()),
      enableAIFailover: this.getFlag('enableAIFailover', true),
      
      // Resilience features
      enableCircuitBreaker: this.getFlag('enableCircuitBreaker', true),
      enableBulkhead: this.getFlag('enableBulkhead', true),
      enableAdaptiveCircuitBreaker: this.getFlag('enableAdaptiveCircuitBreaker', true),
      
      // Container features
      enableContainerIsolation: this.getFlag('enableContainerIsolation', env.features.containerIsolation),
      enableContainerResourceLimits: this.getFlag('enableContainerResourceLimits', true),
      
      // Analysis features
      enableMetasploitIntegration: this.getFlag('enableMetasploitIntegration', env.features.metasploitIntegration),
      enableLocalModels: this.getFlag('enableLocalModels', env.features.localModels),
      enableAdvancedAnalysis: this.getFlag('enableAdvancedAnalysis', env.features.advancedAnalysis),
      
      // Storage features
      enablePersistentStorage: this.getFlag('enablePersistentStorage', env.features.persistentStorage),
      enableDatabaseStorage: this.getFlag('enableDatabaseStorage', true),
    };
  }
  
  /**
   * Get a specific feature flag value
   */
  getFlag(key: keyof FeatureFlags, defaultValue: boolean): boolean {
    // Check runtime overrides first
    if (key in this.overrides) {
      return Boolean(this.overrides[key]);
    }
    
    // Check environment variables (for production)
    if (!env.isDev) {
      const envKey = `FEATURE_${key.toUpperCase()}`;
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        return envValue === 'true';
      }
    }
    
    return defaultValue;
  }
  
  /**
   * Get an array feature flag value
   */
  private getArrayFlag(key: string, defaultValue: string[]): string[] {
    // Check runtime overrides first
    if (key in this.overrides && Array.isArray(this.overrides[key])) {
      return this.overrides[key] as string[];
    }
    
    // Check environment variables (for production)
    if (!env.isDev) {
      const envKey = `FEATURE_${key.toUpperCase()}`;
      const envValue = process.env[envKey];
      if (envValue) {
        return envValue.split(',').map(s => s.trim());
      }
    }
    
    return defaultValue;
  }
  
  /**
   * Get default AI provider priority based on enabled APIs
   */
  private getDefaultAIProviderPriority(): string[] {
    const priority: string[] = [];
    
    if (env.api.claude.enabled) priority.push('claude');
    if (env.api.openai.enabled) priority.push('openai');
    if (env.api.deepseek.enabled) priority.push('deepseek');
    
    // If no APIs are enabled, return all as fallback
    if (priority.length === 0) {
      return ['claude', 'openai', 'deepseek'];
    }
    
    return priority;
  }
  
  /**
   * Set a feature flag override (for development/testing)
   */
  setOverride(key: keyof FeatureFlags, value: boolean | string | string[]): void {
    if (env.isDev) {
      this.overrides[key] = value;
      this.saveOverrides();
    } else {
      console.warn('Feature flag overrides are only available in development mode');
    }
  }
  
  /**
   * Clear a specific override
   */
  clearOverride(key: keyof FeatureFlags): void {
    if (env.isDev) {
      delete this.overrides[key];
      this.saveOverrides();
    }
  }
  
  /**
   * Clear all overrides
   */
  clearAllOverrides(): void {
    if (env.isDev) {
      this.overrides = {};
      this.saveOverrides();
    }
  }
  
  /**
   * Get all current overrides
   */
  getOverrides(): FeatureFlagOverrides {
    return { ...this.overrides };
  }
  
  /**
   * Save overrides to local storage
   */
  private saveOverrides(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.overrides));
      } catch (error) {
        console.warn('Failed to save feature flag overrides:', error);
      }
    }
  }
  
  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: keyof FeatureFlags): boolean {
    return Boolean(this.flags[feature]);
  }
  
  /**
   * Get feature configuration as a string (for debugging)
   */
  toString(): string {
    return JSON.stringify(this.flags, null, 2);
  }
}

// Export singleton instance
export const featureFlags = new FeatureFlagsService();

// Export for testing
export { FeatureFlagsService };