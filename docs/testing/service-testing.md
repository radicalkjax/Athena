# Service Testing Guide

## Overview

This guide covers testing services and business logic in the Athena project. Services handle core functionality like AI integration, file management, and API communication.

## General Service Testing Patterns

### Basic Service Test Structure
```typescript
import { ServiceName } from '@/services/serviceName';

// Mock external dependencies
jest.mock('@/external/dependency');

describe('ServiceName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  // Test cases...
});
```

## AI Service Testing

### Testing Base AI Service
```typescript
describe('BaseAIService', () => {
  let service: TestAIService;
  
  beforeEach(() => {
    service = new TestAIService();
    AsyncStorage.getItem.mockClear();
  });
  
  describe('init', () => {
    it('should initialize with API key from environment', async () => {
      process.env.TEST_API_KEY = 'env-key';
      await service.init();
      
      expect(service.apiKey).toBe('env-key');
    });
    
    it('should throw error when no API key found', async () => {
      await expect(service.init()).rejects.toThrow(
        'API key not found'
      );
    });
  });
});
```

### Testing AI Service Methods
```typescript
describe('analyzeVulnerabilities', () => {
  it('should parse JSON response correctly', async () => {
    const mockResponse = {
      vulnerabilities: ['SQL Injection'],
      riskScore: 8
    };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify(mockResponse)
          }
        }]
      })
    });
    
    const result = await service.analyzeVulnerabilities('code');
    expect(result).toEqual(mockResponse);
  });
});
```

## File Manager Service Testing

### Mocking File System
```typescript
import * as FileSystem from 'expo-file-system';

jest.mock('expo-file-system');

describe('FileManager', () => {
  beforeEach(() => {
    (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
      exists: true,
      isDirectory: true
    });
  });
  
  it('should create malware directory', async () => {
    await fileManager.initFileSystem();
    
    expect(FileSystem.makeDirectoryAsync).toHaveBeenCalledWith(
      expect.stringContaining('malware'),
      { intermediates: true }
    );
  });
});
```

### Testing File Operations
```typescript
describe('saveFile', () => {
  it('should save file with metadata', async () => {
    const file = {
      id: '123',
      name: 'test.exe',
      content: 'binary data'
    };
    
    await fileManager.saveFile(file);
    
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      expect.stringContaining('123.json'),
      expect.stringContaining('"name":"test.exe"')
    );
  });
  
  it('should handle save errors', async () => {
    (FileSystem.writeAsStringAsync as jest.Mock).mockRejectedValue(
      new Error('Disk full')
    );
    
    await expect(fileManager.saveFile(file))
      .rejects.toThrow('Failed to save file');
  });
});
```

## API Service Testing

### Testing API Gateway
```typescript
describe('APIGateway', () => {
  let gateway: APIGateway;
  
  beforeEach(() => {
    gateway = APIGateway.getInstance();
    gateway['cache'].clear();
  });
  
  it('should cache GET requests', async () => {
    const mockData = { data: 'test' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockData
    });
    
    // First call
    const result1 = await gateway.get('/endpoint');
    expect(fetch).toHaveBeenCalledTimes(1);
    
    // Second call should use cache
    const result2 = await gateway.get('/endpoint');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result2).toEqual(result1);
  });
});
```

### Testing Error Handling
```typescript
describe('error handling', () => {
  it('should handle CORS errors', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    
    await expect(gateway.get('/endpoint'))
      .rejects.toThrow('CORS error');
  });
  
  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    
    await expect(gateway.get('/endpoint'))
      .rejects.toThrow('Network error');
  });
});
```

## Container Service Testing

### Testing Container Configuration
```typescript
describe('ContainerService', () => {
  it('should validate container config', () => {
    const config = {
      os: 'linux',
      resourcePreset: 'standard',
      cpuCores: 2,
      memoryGB: 4
    };
    
    const result = containerService.validateConfig(config);
    expect(result.isValid).toBe(true);
  });
  
  it('should reject invalid config', () => {
    const config = {
      os: 'invalid-os',
      cpuCores: -1
    };
    
    const result = containerService.validateConfig(config);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid OS');
  });
});
```

## Monitoring Service Testing

### Testing Metrics Collection
```typescript
describe('MonitoringService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  it('should collect metrics periodically', () => {
    const callback = jest.fn();
    monitoring.startMonitoring('container-1', callback);
    
    // Advance timers
    jest.advanceTimersByTime(5000);
    
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        cpuUsage: expect.any(Number),
        memoryUsage: expect.any(Number)
      })
    );
  });
});
```

## Database Service Testing

### Testing Database Operations
```typescript
import { db } from '@/services/database';

// Mock the database
jest.mock('@/services/database', () => ({
  db: {
    prepare: jest.fn().mockReturnValue({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn()
    })
  }
}));

describe('Database operations', () => {
  it('should insert container config', async () => {
    const mockRun = jest.fn().mockResolvedValue({ lastInsertRowid: 1 });
    (db.prepare as jest.Mock).mockReturnValue({ run: mockRun });
    
    const config = { os: 'linux', cpuCores: 2 };
    const id = await saveContainerConfig(config);
    
    expect(id).toBe(1);
    expect(mockRun).toHaveBeenCalledWith(
      'linux', 2, expect.any(Number)
    );
  });
});
```

## Testing Async Services

### Using Promises
```typescript
it('should handle async operations', async () => {
  const service = new AsyncService();
  const result = await service.fetchData();
  
  expect(result).toBeDefined();
  expect(result.status).toBe('success');
});
```

### Testing Streaming Responses
```typescript
it('should handle streaming data', async () => {
  const chunks: string[] = [];
  
  await service.streamData((chunk) => {
    chunks.push(chunk);
  });
  
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks.join('')).toContain('expected data');
});
```

## Best Practices

### 1. Test Public APIs Only
```typescript
// ❌ Don't test private methods
expect(service['privateMethod']()).toBe(true);

// ✅ Test through public interface
const result = await service.publicMethod();
expect(result).toBe(true);
```

### 2. Mock External Dependencies
```typescript
// Mock at module level
jest.mock('external-library');

// Or mock specific methods
jest.spyOn(externalService, 'method').mockResolvedValue(data);
```

### 3. Test Error Scenarios
```typescript
it('should handle API errors gracefully', async () => {
  mockAPI.call.mockRejectedValue(new Error('API Error'));
  
  const result = await service.safeFetch();
  expect(result).toEqual({ error: 'API Error', data: null });
});
```

### 4. Use Test Fixtures
```typescript
// fixtures/mockData.ts
export const mockMalwareFile = {
  id: '123',
  name: 'test.exe',
  size: 1024,
  type: 'application/x-msdownload'
};

// In test
import { mockMalwareFile } from '@/test/fixtures/mockData';
```

### 5. Test State Transitions
```typescript
it('should transition states correctly', async () => {
  expect(service.state).toBe('idle');
  
  const promise = service.start();
  expect(service.state).toBe('loading');
  
  await promise;
  expect(service.state).toBe('ready');
});
```

## Common Service Testing Patterns

### Singleton Testing
```typescript
describe('Singleton Service', () => {
  afterEach(() => {
    // Reset singleton instance
    (ServiceClass as any).instance = null;
  });
  
  it('should return same instance', () => {
    const instance1 = ServiceClass.getInstance();
    const instance2 = ServiceClass.getInstance();
    expect(instance1).toBe(instance2);
  });
});
```

### Testing with Environment Variables
```typescript
describe('with different environments', () => {
  const originalEnv = process.env;
  
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });
  
  afterAll(() => {
    process.env = originalEnv;
  });
  
  it('should use production API in production', () => {
    process.env.NODE_ENV = 'production';
    const service = require('@/services/api').default;
    expect(service.baseURL).toBe('https://api.production.com');
  });
});
```