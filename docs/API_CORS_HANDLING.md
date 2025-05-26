# API Integration & CORS Handling Documentation

## Overview

Athena's API integration layer provides a robust solution for handling Cross-Origin Resource Sharing (CORS) issues during web development while maintaining seamless API access in production environments.

## Architecture

### Components

1. **API Gateway** (`/services/api/gateway.ts`)
   - Unified API management
   - Provider abstraction
   - Request caching
   - Error standardization

2. **Proxy Configuration** (`/config/proxy.ts`)
   - Development proxy setup
   - URL rewriting
   - Header management

3. **Environment Routing** (`/services/api/routing.ts`)
   - Environment-specific URLs
   - Provider availability
   - Timeout configuration

4. **Error Handler** (`/services/api/errorHandler.ts`)
   - CORS detection
   - Fallback strategies
   - User-friendly messages

5. **API Store** (`/store/apiStore.ts`)
   - Request tracking
   - Health monitoring
   - Usage metrics

## CORS Problem & Solution

### The Problem

When developing web applications, browsers enforce the Same-Origin Policy, blocking requests to different domains. This affects:
- OpenAI API (api.openai.com)
- Claude API (api.anthropic.com)
- DeepSeek API (api.deepseek.com)
- Local services (Metasploit, Container API)

### Our Solution

#### 1. Development Proxy

For web development, we route API calls through a webpack dev server proxy:

```javascript
// webpack.config.js
if (config.devServer) {
  config.devServer.proxy = getWebpackProxyConfig();
}
```

This transforms requests:
- `/api/openai/*` → `https://api.openai.com/v1/*`
- `/api/claude/*` → `https://api.anthropic.com/v1/*`
- `/api/deepseek/*` → `https://api.deepseek.com/v1/*`

#### 2. Environment-Aware Routing

The system automatically detects the environment and routes accordingly:

```typescript
// Web Development
const baseUrl = '/api/openai';  // Uses proxy

// Native Apps
const baseUrl = 'https://api.openai.com/v1';  // Direct access
```

#### 3. Intelligent Error Handling

CORS errors are:
- Detected using multiple methods
- Tracked for patterns
- Handled with user-friendly messages
- Provided with actionable suggestions

## Usage Guide

### Basic API Usage

```typescript
import { apiGateway } from '@/services/api/gateway';

// Make an API request
const response = await apiGateway.request({
  provider: 'openai',
  apiKey: 'your-api-key'
}, '/chat/completions', {
  method: 'POST',
  data: { /* request data */ }
});
```

### Using React Hooks

```typescript
import { useAPI } from '@/services/api/hooks';

function MyComponent() {
  const { data, loading, error, request } = useAPI({
    provider: 'claude',
    apiKey: apiKey,
    onError: (error) => {
      console.error('API Error:', error.message);
    }
  });

  const handleAnalysis = async () => {
    try {
      const result = await request('/messages', {
        method: 'POST',
        data: { /* message data */ }
      });
    } catch (error) {
      // Error already handled by onError
    }
  };
}
```

### Monitoring API Health

```typescript
import { useAPIHealth } from '@/services/api/hooks';

function HealthMonitor() {
  const health = useAPIHealth(['openai', 'claude', 'deepseek']);
  
  return (
    <div>
      {Object.entries(health).map(([provider, isHealthy]) => (
        <div key={provider}>
          {provider}: {isHealthy ? '✅' : '❌'}
        </div>
      ))}
    </div>
  );
}
```

## Configuration

### Development Setup

1. **Start with proxy enabled:**
   ```bash
   npm run dev
   # or
   ./scripts/run.sh
   ```

2. **Verify proxy is working:**
   - Check console for "Proxy configuration enabled for: [...]"
   - API calls should use `/api/*` paths in Network tab

3. **Environment variables (optional):**
   ```env
   METASPLOIT_API_URL=http://localhost:3790/api/v1
   CONTAINER_API_URL=http://localhost:8080/api
   LOCAL_MODEL_URL=http://localhost:11434/api
   ```

### Production Configuration

In production, the app uses direct API URLs:
- No proxy needed
- CORS not an issue (mobile apps)
- Environment-specific URLs

## Troubleshooting

### Common Issues

#### 1. CORS Errors in Browser Console

**Symptom:** 
```
Access to XMLHttpRequest at 'https://api.openai.com/v1/...' 
from origin 'http://localhost:19006' has been blocked by CORS policy
```

**Solution:**
- Ensure webpack dev server is running
- Check proxy configuration in webpack.config.js
- Verify you're using the development build

#### 2. API Calls Failing Silently

**Symptom:** Network requests show as failed with no response

**Solution:**
- Check if proxy is configured
- Verify API keys are set
- Look for CORS warnings in the app (not console)

#### 3. "Multiple CORS errors detected" Warning

**Symptom:** App shows CORS warning after multiple failures

**Solution:**
- Restart the development server
- Clear browser cache
- Check if APIs are accessible

### Debug Mode

Enable detailed logging:

```typescript
// In your component
import { logger } from '@/shared/logging/logger';

logger.setLevel('debug');
```

### Checking API Status

```typescript
import { useAPIStore } from '@/store/apiStore';

// In a component
const metrics = useAPIStore(state => state.getMetricsForProvider('openai'));
console.log('OpenAI Metrics:', metrics);
```

## Best Practices

### 1. Always Use the Gateway

```typescript
// ❌ Bad - Direct axios call
const response = await axios.post('https://api.openai.com/v1/chat/completions');

// ✅ Good - Use gateway
const response = await apiGateway.request({
  provider: 'openai'
}, '/chat/completions');
```

### 2. Handle Errors Gracefully

```typescript
const { error } = useAPI({ provider: 'claude' });

if (error?.code === 'CORS_ERROR') {
  // Show user-friendly message
  return <CORSErrorMessage suggestion={error.suggestion} />;
}
```

### 3. Use Fallback Providers

```typescript
const api = useAPIWithFallback({
  provider: 'claude',
  apiKey: claudeKey
}, 'openai'); // Fallback to OpenAI
```

### 4. Monitor Health

```typescript
useEffect(() => {
  const health = apiStore.getHealthStatusForProvider('openai');
  if (health?.status === 'down') {
    // Switch to alternative provider
  }
}, []);
```

## Security Considerations

1. **API Keys**: Never commit API keys to source control
2. **Proxy Security**: Only enabled in development
3. **Request Sanitization**: All requests are sanitized
4. **Error Messages**: Sensitive data is filtered from errors

## Migration Guide

### From Direct API Calls

Before:
```typescript
const client = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

After:
```typescript
const { request } = useAPI({
  provider: 'openai',
  apiKey: apiKey
});
```

### From Old Services

Before:
```typescript
import { analyzeWithClaude } from '@/services/claude';
const result = await analyzeWithClaude(code);
```

After:
```typescript
const { request } = useAPI({ provider: 'claude' });
const result = await request('/messages', {
  method: 'POST',
  data: { messages: [{ role: 'user', content: code }] }
});
```

## API Reference

### Gateway Methods

- `apiGateway.request(config, endpoint, options)` - Make API request
- `apiGateway.getClient(config)` - Get configured axios instance
- `apiGateway.clearCache()` - Clear all caches

### Store Methods

- `useAPIStore()` - Access API state
- `useAPIHealth()` - Monitor provider health
- `useAPIMetrics()` - Get usage metrics
- `useCorsErrorStatus()` - Check CORS error status

### Hooks

- `useAPI(options)` - Make API requests with state
- `useAPIHealth(providers)` - Monitor multiple providers
- `useCORSErrorHandler()` - Handle CORS errors UI
- `useAPIWithFallback(primary, fallback)` - Automatic fallback

## Future Enhancements

1. **Backend API Gateway** - Eliminate CORS in production
2. **Request Queuing** - Handle rate limits better
3. **Offline Support** - Cache responses for offline use
4. **WebSocket Support** - Real-time API connections