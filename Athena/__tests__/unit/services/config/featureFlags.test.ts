import { FeatureFlagsService } from '@/services/config/featureFlags';
import { env } from '@/shared/config/environment';

// Mock environment
jest.mock('@/shared/config/environment', () => ({
  env: {
    isDev: true,
    redis: { enabled: true },
    apm: { enabled: false },
    performance: { monitoring: true },
    features: {
      containerIsolation: true,
      metasploitIntegration: true,
      localModels: false,
      advancedAnalysis: true,
      persistentStorage: true,
    },
    api: {
      claude: { enabled: true },
      openai: { enabled: true },
      deepseek: { enabled: false },
    },
  }
}));

// Mock localStorage for testing
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    // Reset any module-level state by clearing the module cache
    jest.resetModules();
    service = new FeatureFlagsService();
  });

  describe('Default Flag Values', () => {
    it('should return correct default values based on environment', () => {
      const flags = service.flags;

      expect(flags.enableRedisCache).toBe(true);
      expect(flags.enableMemoryCache).toBe(true);
      expect(flags.cacheAnalysisResults).toBe(true);
      expect(flags.enableAPM).toBe(false);
      expect(flags.enablePerformanceMonitoring).toBe(true);
      expect(flags.enableStreamingAnalysis).toBe(true);
      expect(flags.enableBatchAnalysis).toBe(true);
      expect(flags.aiProviderPriority).toEqual(['claude', 'openai']);
      expect(flags.enableAIFailover).toBe(true);
      expect(flags.enableCircuitBreaker).toBe(true);
      expect(flags.enableBulkhead).toBe(true);
      expect(flags.enableAdaptiveCircuitBreaker).toBe(true);
      expect(flags.enableContainerIsolation).toBe(true);
      expect(flags.enableContainerResourceLimits).toBe(true);
      expect(flags.enableMetasploitIntegration).toBe(true);
      expect(flags.enableLocalModels).toBe(false);
      expect(flags.enableAdvancedAnalysis).toBe(true);
      expect(flags.enablePersistentStorage).toBe(true);
      expect(flags.enableDatabaseStorage).toBe(true);
    });

    it('should return AI provider priority based on enabled APIs', () => {
      const flags = service.flags;
      expect(flags.aiProviderPriority).toEqual(['claude', 'openai']);
    });
  });

  describe('Feature Flag Overrides', () => {
    it('should allow setting overrides in development mode', () => {
      service.setOverride('enableRedisCache', false);
      expect(service.getFlag('enableRedisCache', true)).toBe(false);
    });

    it('should save overrides to localStorage', () => {
      service.setOverride('enableAPM', true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'athena:feature-flags',
        JSON.stringify({ enableAPM: true })
      );
    });

    it('should load overrides from localStorage on initialization', () => {
      localStorageMock.getItem.mockReturnValue(
        JSON.stringify({ enableRedisCache: false })
      );
      
      const newService = new FeatureFlagsService();
      expect(newService.getFlag('enableRedisCache', true)).toBe(false);
    });

    it('should handle array overrides', () => {
      service.setOverride('aiProviderPriority', ['openai', 'claude', 'deepseek']);
      expect(service.flags.aiProviderPriority).toEqual(['openai', 'claude', 'deepseek']);
    });

    it('should clear specific override', () => {
      service.setOverride('enableAPM', true);
      service.clearOverride('enableAPM');
      expect(service.getFlag('enableAPM', false)).toBe(false);
    });

    it('should clear all overrides', () => {
      service.setOverride('enableAPM', true);
      service.setOverride('enableRedisCache', false);
      service.clearAllOverrides();
      
      expect(service.getOverrides()).toEqual({});
    });
  });

  describe('Production Mode', () => {
    let originalIsDev: boolean;

    beforeEach(() => {
      originalIsDev = env.isDev;
      (env as any).isDev = false;
      // Clear any existing overrides before testing production mode
      service.clearAllOverrides();
    });

    afterEach(() => {
      (env as any).isDev = originalIsDev;
    });

    it('should not allow overrides in production mode', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Clear any existing overrides from localStorage and reset the mock
      localStorageMock.clear();
      localStorageMock.getItem.mockClear();
      localStorageMock.getItem.mockReturnValue(null);
      
      // Create a new service instance in production mode
      const prodService = new FeatureFlagsService();
      
      prodService.setOverride('enableAPM', true);
      expect(prodService.getOverrides()).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        'Feature flag overrides are only available in development mode'
      );
      
      consoleSpy.mockRestore();
    });

    it('should read from environment variables in production', () => {
      process.env.FEATURE_ENABLEAPM = 'true';
      process.env.FEATURE_ENABLEREDISCACHE = 'false';
      
      const prodService = new FeatureFlagsService();
      expect(prodService.getFlag('enableAPM', false)).toBe(true);
      expect(prodService.getFlag('enableRedisCache', true)).toBe(false);
      
      delete process.env.FEATURE_ENABLEAPM;
      delete process.env.FEATURE_ENABLEREDISCACHE;
    });

    it('should handle array environment variables', () => {
      process.env.FEATURE_AIPROVIDERPRIORITY = 'deepseek,claude,openai';
      
      const prodService = new FeatureFlagsService();
      expect(prodService.flags.aiProviderPriority).toEqual(['deepseek', 'claude', 'openai']);
      
      delete process.env.FEATURE_AIPROVIDERPRIORITY;
    });
  });

  describe('Helper Methods', () => {
    it('should check if feature is enabled', () => {
      service.setOverride('enableAPM', true);
      expect(service.isEnabled('enableAPM')).toBe(true);
      
      service.setOverride('enableAPM', false);
      expect(service.isEnabled('enableAPM')).toBe(false);
    });

    it('should return feature configuration as string', () => {
      const configString = service.toString();
      const config = JSON.parse(configString);
      
      expect(config).toHaveProperty('enableRedisCache');
      expect(config).toHaveProperty('enableAPM');
      expect(config).toHaveProperty('aiProviderPriority');
    });
  });

  describe('Error Handling', () => {
    it('should handle corrupted localStorage data gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      const newService = new FeatureFlagsService();
      expect(newService.getOverrides()).toEqual({});
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load feature flag overrides:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should handle localStorage write errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      service.setOverride('enableAPM', true);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save feature flag overrides:',
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('AI Provider Priority', () => {
    it('should return all providers when none are enabled', () => {
      (env as any).api = {
        claude: { enabled: false },
        openai: { enabled: false },
        deepseek: { enabled: false },
      };
      
      const newService = new FeatureFlagsService();
      expect(newService.flags.aiProviderPriority).toEqual(['claude', 'openai', 'deepseek']);
    });

    it('should only return enabled providers', () => {
      (env as any).api = {
        claude: { enabled: false },
        openai: { enabled: true },
        deepseek: { enabled: true },
      };
      
      const newService = new FeatureFlagsService();
      expect(newService.flags.aiProviderPriority).toEqual(['openai', 'deepseek']);
    });
  });
});