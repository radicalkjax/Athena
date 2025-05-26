/**
 * Environment-specific API routing configuration
 */

import { env } from '@/shared/config/environment';
import { APIProvider } from './gateway';

export interface RouteConfig {
  provider: APIProvider;
  development: {
    baseUrl: string;
    useProxy: boolean;
    timeout?: number;
  };
  staging: {
    baseUrl: string;
    useProxy: boolean;
    timeout?: number;
  };
  production: {
    baseUrl: string;
    useProxy: boolean;
    timeout?: number;
  };
}

/**
 * API routing configuration by provider and environment
 */
export const routingConfig: Record<APIProvider, RouteConfig> = {
  openai: {
    provider: 'openai',
    development: {
      baseUrl: env.isWeb ? '/api/openai' : 'https://api.openai.com/v1',
      useProxy: env.isWeb,
      timeout: 30000,
    },
    staging: {
      baseUrl: 'https://api.openai.com/v1',
      useProxy: false,
      timeout: 30000,
    },
    production: {
      baseUrl: 'https://api.openai.com/v1',
      useProxy: false,
      timeout: 30000,
    },
  },
  claude: {
    provider: 'claude',
    development: {
      baseUrl: env.isWeb ? '/api/claude' : 'https://api.anthropic.com/v1',
      useProxy: env.isWeb,
      timeout: 30000,
    },
    staging: {
      baseUrl: 'https://api.anthropic.com/v1',
      useProxy: false,
      timeout: 30000,
    },
    production: {
      baseUrl: 'https://api.anthropic.com/v1',
      useProxy: false,
      timeout: 30000,
    },
  },
  deepseek: {
    provider: 'deepseek',
    development: {
      baseUrl: env.isWeb ? '/api/deepseek' : 'https://api.deepseek.com/v1',
      useProxy: env.isWeb,
      timeout: 30000,
    },
    staging: {
      baseUrl: 'https://api.deepseek.com/v1',
      useProxy: false,
      timeout: 30000,
    },
    production: {
      baseUrl: 'https://api.deepseek.com/v1',
      useProxy: false,
      timeout: 30000,
    },
  },
  local: {
    provider: 'local',
    development: {
      baseUrl: process.env.LOCAL_MODEL_URL || 'http://localhost:11434/api',
      useProxy: false,
      timeout: 60000, // Longer timeout for local models
    },
    staging: {
      baseUrl: process.env.LOCAL_MODEL_URL || 'http://localhost:11434/api',
      useProxy: false,
      timeout: 60000,
    },
    production: {
      baseUrl: process.env.LOCAL_MODEL_URL || 'http://localhost:11434/api',
      useProxy: false,
      timeout: 60000,
    },
  },
  metasploit: {
    provider: 'metasploit',
    development: {
      baseUrl: env.isWeb ? '/api/metasploit' : 'http://localhost:3790/api/v1',
      useProxy: env.isWeb,
      timeout: 30000,
    },
    staging: {
      baseUrl: process.env.METASPLOIT_API_URL || 'http://metasploit:3790/api/v1',
      useProxy: false,
      timeout: 30000,
    },
    production: {
      baseUrl: process.env.METASPLOIT_API_URL || 'https://metasploit.athena.app/api/v1',
      useProxy: false,
      timeout: 30000,
    },
  },
  container: {
    provider: 'container',
    development: {
      baseUrl: env.isWeb ? '/api/container' : 'http://localhost:8080/api',
      useProxy: env.isWeb,
      timeout: 300000, // 5 minutes for container operations
    },
    staging: {
      baseUrl: process.env.CONTAINER_API_URL || 'http://container:8080/api',
      useProxy: false,
      timeout: 300000,
    },
    production: {
      baseUrl: process.env.CONTAINER_API_URL || 'https://container.athena.app/api',
      useProxy: false,
      timeout: 300000,
    },
  },
};

/**
 * Get routing configuration for a provider based on current environment
 */
export function getRouteConfig(provider: APIProvider): RouteConfig[keyof RouteConfig] {
  const config = routingConfig[provider];
  if (!config) {
    throw new Error(`No routing configuration found for provider: ${provider}`);
  }

  // Return config based on environment
  return config[env.environment];
}

/**
 * Get the appropriate base URL for a provider
 */
export function getBaseUrlForProvider(provider: APIProvider): string {
  const config = getRouteConfig(provider);
  return config.baseUrl;
}

/**
 * Check if proxy should be used for a provider
 */
export function shouldUseProxyForProvider(provider: APIProvider): boolean {
  const config = getRouteConfig(provider);
  return config.useProxy;
}

/**
 * Get timeout for a provider
 */
export function getTimeoutForProvider(provider: APIProvider): number {
  const config = getRouteConfig(provider);
  return config.timeout || 30000;
}

/**
 * Get all available providers for current environment
 */
export function getAvailableProviders(): APIProvider[] {
  const providers: APIProvider[] = [];
  
  // Check which providers have API keys configured
  if (env.api.openai.enabled) providers.push('openai');
  if (env.api.claude.enabled) providers.push('claude');
  if (env.api.deepseek.enabled) providers.push('deepseek');
  
  // Local services are always available in development
  if (env.isDev) {
    providers.push('local', 'metasploit', 'container');
  } else {
    // In production, check if services are configured
    if (process.env.LOCAL_MODEL_URL) providers.push('local');
    if (process.env.METASPLOIT_API_URL) providers.push('metasploit');
    if (process.env.CONTAINER_API_URL) providers.push('container');
  }
  
  return providers;
}

/**
 * Validate if a provider is available
 */
export function isProviderAvailable(provider: APIProvider): boolean {
  return getAvailableProviders().includes(provider);
}