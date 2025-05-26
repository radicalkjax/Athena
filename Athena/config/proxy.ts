/**
 * Proxy Configuration for Development
 * 
 * This configuration helps bypass CORS issues during web development
 * by routing API calls through a proxy server.
 */

import { env } from '@/shared/config/environment';

export interface ProxyEndpoint {
  target: string;
  changeOrigin: boolean;
  headers?: Record<string, string>;
  pathRewrite?: Record<string, string>;
}

export interface ProxyConfig {
  [path: string]: ProxyEndpoint;
}

/**
 * Development proxy configuration
 * Maps API paths to their target endpoints
 */
export const proxyConfig: ProxyConfig = {
  '/api/openai': {
    target: env.api.openai.baseUrl || 'https://api.openai.com/v1',
    changeOrigin: true,
    pathRewrite: {
      '^/api/openai': '',
    },
    headers: {
      'User-Agent': 'Athena/1.0',
    },
  },
  '/api/claude': {
    target: env.api.claude.baseUrl || 'https://api.anthropic.com/v1',
    changeOrigin: true,
    pathRewrite: {
      '^/api/claude': '',
    },
    headers: {
      'User-Agent': 'Athena/1.0',
    },
  },
  '/api/deepseek': {
    target: env.api.deepseek.baseUrl || 'https://api.deepseek.com/v1',
    changeOrigin: true,
    pathRewrite: {
      '^/api/deepseek': '',
    },
    headers: {
      'User-Agent': 'Athena/1.0',
    },
  },
  '/api/metasploit': {
    target: process.env.METASPLOIT_API_URL || 'http://localhost:3790/api/v1',
    changeOrigin: true,
    pathRewrite: {
      '^/api/metasploit': '',
    },
  },
  '/api/container': {
    target: process.env.CONTAINER_API_URL || 'http://localhost:8080/api',
    changeOrigin: true,
    pathRewrite: {
      '^/api/container': '',
    },
  },
};

/**
 * Get proxy configuration for webpack dev server
 */
export function getWebpackProxyConfig(): ProxyConfig {
  if (!env.isDev || !env.isWeb) {
    return {};
  }

  // Log proxy configuration in development
  console.log('Proxy configuration enabled for:', Object.keys(proxyConfig));
  
  return proxyConfig;
}

/**
 * Get the proxied URL for an API endpoint in web development
 * @param provider The API provider (openai, claude, deepseek, etc.)
 * @param path The API path
 * @returns The proxied URL or original URL
 */
export function getProxiedUrl(provider: string, path: string = ''): string {
  // Only use proxy in web development
  if (!env.isDev || !env.isWeb) {
    // Return the original base URL for native apps
    switch (provider) {
      case 'openai':
        return `${env.api.openai.baseUrl}${path}`;
      case 'claude':
        return `${env.api.claude.baseUrl}${path}`;
      case 'deepseek':
        return `${env.api.deepseek.baseUrl}${path}`;
      case 'metasploit':
        return `${process.env.METASPLOIT_API_URL || 'http://localhost:3790/api/v1'}${path}`;
      case 'container':
        return `${process.env.CONTAINER_API_URL || 'http://localhost:8080/api'}${path}`;
      default:
        throw new Error(`Unknown API provider: ${provider}`);
    }
  }

  // Use proxied URL for web development
  return `/api/${provider}${path}`;
}

/**
 * Check if we should use proxy for the current environment
 */
export function shouldUseProxy(): boolean {
  return env.isDev && env.isWeb;
}