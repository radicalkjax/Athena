const { vi } = require('vitest');

module.exports = {
  shouldUseProxy: vi.fn(() => false),
  getProxiedUrl: vi.fn((provider) => `/api/proxy/${provider}`),
  getProxyUrl: () => process.env.PROXY_URL || '',
  isProxyEnabled: () => !!process.env.PROXY_URL,
  getProxyConfig: () => ({
    url: process.env.PROXY_URL || '',
    enabled: !!process.env.PROXY_URL,
    auth: process.env.PROXY_AUTH || '',
    timeout: 30000
  })
};