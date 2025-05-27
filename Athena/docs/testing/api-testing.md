# API Testing Guide

## Overview

This guide covers testing API integrations, including REST endpoints, error handling, and response parsing.

## Setting Up API Tests

### Mock Fetch Globally
```typescript
// In jest.setup.js or at the top of test file
global.fetch = jest.fn();

beforeEach(() => {
  (fetch as jest.Mock).mockClear();
});
```

### Create Mock Responses
```typescript
const mockSuccessResponse = {
  ok: true,
  status: 200,
  json: async () => ({ data: 'test' }),
  text: async () => JSON.stringify({ data: 'test' })
};

const mockErrorResponse = {
  ok: false,
  status: 404,
  statusText: 'Not Found',
  json: async () => ({ error: 'Not found' })
};
```

## Testing API Clients

### Basic GET Request
```typescript
describe('API Client - GET', () => {
  it('should fetch data successfully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);
    
    const result = await apiClient.get('/users');
    
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/users'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.any(Object)
      })
    );
    expect(result).toEqual({ data: 'test' });
  });
});
```

### POST Request with Body
```typescript
it('should send POST request with data', async () => {
  const userData = { name: 'John', email: 'john@example.com' };
  (fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);
  
  await apiClient.post('/users', userData);
  
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('/users'),
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(userData),
      headers: expect.objectContaining({
        'Content-Type': 'application/json'
      })
    })
  );
});
```

## Testing Authentication

### API Key Authentication
```typescript
describe('API Authentication', () => {
  it('should include API key in headers', async () => {
    const apiKey = 'test-api-key';
    apiClient.setApiKey(apiKey);
    
    (fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);
    await apiClient.get('/protected');
    
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-API-Key': apiKey
        })
      })
    );
  });
});
```

### Bearer Token Authentication
```typescript
it('should include bearer token', async () => {
  const token = 'jwt-token';
  apiClient.setAuthToken(token);
  
  (fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);
  await apiClient.get('/protected');
  
  expect(fetch).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      headers: expect.objectContaining({
        'Authorization': `Bearer ${token}`
      })
    })
  );
});
```

## Error Handling Tests

### Network Errors
```typescript
describe('Network Error Handling', () => {
  it('should handle network failure', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(
      new Error('Network request failed')
    );
    
    await expect(apiClient.get('/endpoint'))
      .rejects.toThrow('Network request failed');
  });
  
  it('should retry on network failure', async () => {
    (fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockSuccessResponse);
    
    const result = await apiClient.getWithRetry('/endpoint');
    
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'test' });
  });
});
```

### HTTP Error Responses
```typescript
describe('HTTP Error Handling', () => {
  it('should handle 404 error', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });
    
    await expect(apiClient.get('/missing'))
      .rejects.toThrow('404 Not Found');
  });
  
  it('should handle 401 unauthorized', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Invalid API key' })
    });
    
    try {
      await apiClient.get('/protected');
    } catch (error) {
      expect(error.status).toBe(401);
      expect(error.message).toContain('Invalid API key');
    }
  });
});
```

### CORS Error Handling
```typescript
it('should detect CORS errors', async () => {
  (fetch as jest.Mock).mockRejectedValueOnce(
    new TypeError('Failed to fetch')
  );
  
  try {
    await apiClient.get('/cors-blocked');
  } catch (error) {
    expect(error.type).toBe('CORS_ERROR');
    expect(error.message).toContain('CORS');
  }
});
```

## Testing Response Parsing

### JSON Responses
```typescript
describe('Response Parsing', () => {
  it('should parse JSON response', async () => {
    const data = { id: 1, name: 'Test' };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => data
    });
    
    const result = await apiClient.get('/json');
    expect(result).toEqual(data);
  });
  
  it('should handle malformed JSON', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON');
      },
      text: async () => 'Not JSON'
    });
    
    await expect(apiClient.get('/bad-json'))
      .rejects.toThrow('Invalid response format');
  });
});
```

### Text Responses
```typescript
it('should handle text responses', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    text: async () => 'Plain text response'
  });
  
  const result = await apiClient.getText('/text');
  expect(result).toBe('Plain text response');
});
```

## Testing Request Interceptors

### Adding Headers
```typescript
describe('Request Interceptors', () => {
  it('should add custom headers', async () => {
    apiClient.addInterceptor((config) => ({
      ...config,
      headers: {
        ...config.headers,
        'X-Custom-Header': 'value'
      }
    }));
    
    (fetch as jest.Mock).mockResolvedValueOnce(mockSuccessResponse);
    await apiClient.get('/endpoint');
    
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Custom-Header': 'value'
        })
      })
    );
  });
});
```

## Testing Response Caching

```typescript
describe('Response Caching', () => {
  it('should cache GET requests', async () => {
    const data = { cached: true };
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => data
    });
    
    // First request
    const result1 = await apiClient.get('/cacheable');
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Second request should use cache
    const result2 = await apiClient.get('/cacheable');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result2).toEqual(result1);
  });
  
  it('should not cache POST requests', async () => {
    (fetch as jest.Mock).mockResolvedValue(mockSuccessResponse);
    
    await apiClient.post('/data', {});
    await apiClient.post('/data', {});
    
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
```

## Testing Rate Limiting

```typescript
describe('Rate Limiting', () => {
  it('should handle rate limit errors', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => name === 'Retry-After' ? '60' : null
      }
    });
    
    try {
      await apiClient.get('/rate-limited');
    } catch (error) {
      expect(error.status).toBe(429);
      expect(error.retryAfter).toBe(60);
    }
  });
});
```

## Testing Timeout Handling

```typescript
describe('Timeout Handling', () => {
  it('should timeout long requests', async () => {
    (fetch as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 10000))
    );
    
    await expect(apiClient.get('/slow', { timeout: 1000 }))
      .rejects.toThrow('Request timeout');
  });
});
```

## Best Practices

### 1. Use Request Matchers
```typescript
expect(fetch).toHaveBeenCalledWith(
  expect.stringMatching(/\/api\/v1\/users\/\d+/),
  expect.any(Object)
);
```

### 2. Test Request Cancellation
```typescript
it('should cancel pending requests', async () => {
  const controller = new AbortController();
  
  const promise = apiClient.get('/endpoint', {
    signal: controller.signal
  });
  
  controller.abort();
  
  await expect(promise).rejects.toThrow('aborted');
});
```

### 3. Mock Time for Retry Tests
```typescript
jest.useFakeTimers();

it('should retry with exponential backoff', async () => {
  (fetch as jest.Mock)
    .mockRejectedValueOnce(new Error('Timeout'))
    .mockResolvedValueOnce(mockSuccessResponse);
  
  const promise = apiClient.getWithRetry('/endpoint');
  
  // Advance timers for retry delay
  jest.advanceTimersByTime(1000);
  
  const result = await promise;
  expect(result).toEqual({ data: 'test' });
});

jest.useRealTimers();
```

### 4. Test Different Content Types
```typescript
it('should handle different content types', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    headers: {
      get: (name: string) => 
        name === 'content-type' ? 'application/xml' : null
    },
    text: async () => '<xml>data</xml>'
  });
  
  const result = await apiClient.get('/xml');
  expect(result).toBe('<xml>data</xml>');
});
```