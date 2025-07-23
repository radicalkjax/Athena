/**
 * API Configuration for Athena v2
 */

export const apiConfig = {
  // Base URL for the backend API
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  
  // API endpoints
  endpoints: {
    health: '/api/v1/health',
    analyze: '/api/v1/analyze',
    providers: '/api/v1/providers',
    workflows: '/api/v1/workflows',
    upload: '/api/v1/analysis/upload',
    status: '/api/v1/analysis/:id/status',
    results: '/api/v1/analysis/:id/results',
    batch: '/api/v1/analysis/batch',
    wasm: '/api/v1/wasm/analyze',
  },
  
  // Request configuration
  requestConfig: {
    timeout: 30000, // 30 seconds
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include' as RequestCredentials,
  },
  
  // Retry configuration
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    backoffMultiplier: 2,
  },
};

/**
 * Build full URL for an endpoint
 */
export function buildApiUrl(endpoint: string, params?: Record<string, string>): string {
  let url = `${apiConfig.baseUrl}${endpoint}`;
  
  // Replace path parameters
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  return url;
}

/**
 * Make API request with retry logic
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  params?: Record<string, string>
): Promise<T> {
  const url = buildApiUrl(endpoint, params);
  const config = {
    ...apiConfig.requestConfig,
    ...options,
    headers: {
      ...apiConfig.requestConfig.headers,
      ...(options.headers || {}),
    },
  };
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= apiConfig.retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < apiConfig.retryConfig.maxRetries) {
        const delay = apiConfig.retryConfig.retryDelay * Math.pow(apiConfig.retryConfig.backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('API request failed');
}