# Store Testing Guide

> **Update Notice (December 2025):** This documentation references Zustand patterns. The current implementation uses **SolidJS reactive primitives** (createSignal, createStore). See `athena-v2/src/` for the actual implementation. The testing concepts below remain valid but use different APIs.

## Overview

This guide covers testing state management in the Athena project.

## Basic Store Testing

### Testing Store State
```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAppStore } from '@/store';

describe('App Store', () => {
  it('should have initial state', () => {
    const { result } = renderHook(() => useAppStore());
    
    expect(result.current.malwareFiles).toEqual([]);
    expect(result.current.selectedMalwareId).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
  });
});
```

### Testing Store Actions
```typescript
describe('Store Actions', () => {
  it('should add malware file', () => {
    const { result } = renderHook(() => useAppStore());
    const file = {
      id: '1',
      name: 'test.exe',
      size: 1024,
      type: 'application/x-msdownload',
      uri: 'file:///test.exe',
      content: ''
    };
    
    act(() => {
      result.current.addMalwareFile(file);
    });
    
    expect(result.current.malwareFiles).toContainEqual(file);
  });
  
  it('should select malware file', () => {
    const { result } = renderHook(() => useAppStore());
    
    act(() => {
      result.current.selectMalwareFile('file-123');
    });
    
    expect(result.current.selectedMalwareId).toBe('file-123');
  });
});
```

## Mocking Store in Components

### Complete Store Mock
```typescript
jest.mock('@/store');

const mockStore = {
  // State
  malwareFiles: [],
  selectedMalwareId: null,
  isAnalyzing: false,
  analysisResults: null,
  
  // Actions
  addMalwareFile: jest.fn(),
  removeMalwareFile: jest.fn(),
  selectMalwareFile: jest.fn(),
  setAnalyzing: jest.fn(),
  setAnalysisResults: jest.fn(),
  clearAnalysis: jest.fn()
};

beforeEach(() => {
  (useAppStore as unknown as jest.Mock).mockImplementation((selector) => {
    return selector ? selector(mockStore) : mockStore;
  });
});
```

### Partial Store Mock
```typescript
it('should render with store data', () => {
  const mockFiles = [
    { id: '1', name: 'virus.exe' },
    { id: '2', name: 'malware.dll' }
  ];
  
  (useAppStore as unknown as jest.Mock).mockImplementation((selector) => {
    const state = {
      malwareFiles: mockFiles,
      selectedMalwareId: '1'
    };
    return selector(state);
  });
  
  const { getByText } = render(<FileList />);
  expect(getByText('virus.exe')).toBeTruthy();
});
```

## Testing Complex Actions

### Async Actions
```typescript
describe('Async Store Actions', () => {
  it('should analyze file asynchronously', async () => {
    const { result } = renderHook(() => useAppStore());
    const file = { id: '1', name: 'test.exe', content: 'binary' };
    
    await act(async () => {
      await result.current.analyzeFile(file);
    });
    
    expect(result.current.isAnalyzing).toBe(false);
    expect(result.current.analysisResults).toBeDefined();
  });
  
  it('should handle analysis errors', async () => {
    const { result } = renderHook(() => useAppStore());
    const file = { id: '1', name: 'corrupt.exe' };
    
    // Mock the analysis service to throw
    jest.spyOn(analysisService, 'analyze').mockRejectedValue(
      new Error('Analysis failed')
    );
    
    await act(async () => {
      await result.current.analyzeFile(file);
    });
    
    expect(result.current.error).toBe('Analysis failed');
    expect(result.current.isAnalyzing).toBe(false);
  });
});
```

### Actions with Side Effects
```typescript
it('should persist state changes', () => {
  const { result } = renderHook(() => useAppStore());
  
  act(() => {
    result.current.updateSettings({
      theme: 'dark',
      autoSave: true
    });
  });
  
  // Verify localStorage was updated
  expect(localStorage.setItem).toHaveBeenCalledWith(
    'app-settings',
    JSON.stringify({ theme: 'dark', autoSave: true })
  );
});
```

## Testing Store Slices

### API Store Slice
```typescript
describe('API Store Slice', () => {
  it('should manage API configurations', () => {
    const { result } = renderHook(() => useAPIStore());
    
    act(() => {
      result.current.setAPIConfig('openai', {
        apiKey: 'test-key',
        baseURL: 'https://api.openai.com'
      });
    });
    
    expect(result.current.apis.openai).toEqual({
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com',
      isConfigured: true
    });
  });
});
```

### Security Store Slice
```typescript
describe('Security Store', () => {
  it('should update security scan results', () => {
    const { result } = renderHook(() => useSecurityStore());
    const scanResult = {
      fileId: '123',
      threats: ['Trojan.Generic'],
      severity: 'high'
    };
    
    act(() => {
      result.current.addScanResult(scanResult);
    });
    
    expect(result.current.scanResults).toContainEqual(scanResult);
    expect(result.current.getThreatLevel('123')).toBe('high');
  });
});
```

## Testing Store Middleware

### Logger Middleware
```typescript
describe('Store Logger Middleware', () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation();
  });
  
  it('should log state changes', () => {
    const { result } = renderHook(() => useAppStore());
    
    act(() => {
      result.current.addMalwareFile({ id: '1', name: 'test.exe' });
    });
    
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Action: addMalwareFile')
    );
  });
});
```

### DevTools Middleware
```typescript
describe('DevTools Integration', () => {
  it('should connect to Redux DevTools', () => {
    const mockDevTools = {
      connect: jest.fn().mockReturnValue({
        send: jest.fn(),
        init: jest.fn()
      })
    };
    
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ = mockDevTools;
    
    // Re-import store to trigger devtools connection
    jest.resetModules();
    require('@/store');
    
    expect(mockDevTools.connect).toHaveBeenCalled();
  });
});
```

## Testing Computed Values

### Selectors
```typescript
describe('Store Selectors', () => {
  it('should compute filtered files', () => {
    const { result } = renderHook(() => 
      useAppStore(state => state.getFilteredFiles('exe'))
    );
    
    act(() => {
      useAppStore.getState().addMalwareFile({ 
        id: '1', 
        name: 'test.exe',
        type: 'application/x-msdownload'
      });
      useAppStore.getState().addMalwareFile({ 
        id: '2', 
        name: 'script.js',
        type: 'text/javascript'
      });
    });
    
    const filtered = result.current;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('test.exe');
  });
});
```

### Derived State
```typescript
it('should compute analysis summary', () => {
  const { result } = renderHook(() => 
    useAppStore(state => state.getAnalysisSummary())
  );
  
  act(() => {
    useAppStore.getState().setAnalysisResults({
      vulnerabilities: ['SQL Injection', 'XSS'],
      riskScore: 8,
      recommendations: ['Sanitize inputs']
    });
  });
  
  expect(result.current).toEqual({
    totalVulnerabilities: 2,
    highRisk: true,
    hasRecommendations: true
  });
});
```

## Testing Store Persistence

### Local Storage Persistence
```typescript
describe('Store Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  
  it('should persist state to localStorage', () => {
    const { result } = renderHook(() => useAppStore());
    
    act(() => {
      result.current.updateSettings({ theme: 'dark' });
    });
    
    // Simulate app reload
    const stored = localStorage.getItem('app-store');
    expect(JSON.parse(stored!)).toMatchObject({
      settings: { theme: 'dark' }
    });
  });
  
  it('should restore state from localStorage', () => {
    const savedState = {
      settings: { theme: 'light', autoSave: false }
    };
    localStorage.setItem('app-store', JSON.stringify(savedState));
    
    // Re-import store
    jest.resetModules();
    const { useAppStore } = require('@/store');
    
    const { result } = renderHook(() => useAppStore());
    expect(result.current.settings).toEqual(savedState.settings);
  });
});
```

## Testing Store Reset

```typescript
describe('Store Reset', () => {
  it('should reset to initial state', () => {
    const { result } = renderHook(() => useAppStore());
    
    // Add some data
    act(() => {
      result.current.addMalwareFile({ id: '1', name: 'test.exe' });
      result.current.selectMalwareFile('1');
      result.current.setAnalyzing(true);
    });
    
    // Reset store
    act(() => {
      result.current.resetStore();
    });
    
    expect(result.current.malwareFiles).toEqual([]);
    expect(result.current.selectedMalwareId).toBeNull();
    expect(result.current.isAnalyzing).toBe(false);
  });
});
```

## Best Practices

### 1. Isolate Store Tests
```typescript
beforeEach(() => {
  // Reset store to initial state
  useAppStore.setState(initialState);
});
```

### 2. Test Action Side Effects
```typescript
it('should trigger side effects', () => {
  const mockCallback = jest.fn();
  useAppStore.subscribe(mockCallback);
  
  act(() => {
    useAppStore.getState().addMalwareFile(file);
  });
  
  expect(mockCallback).toHaveBeenCalled();
});
```

### 3. Test Error States
```typescript
it('should handle errors gracefully', () => {
  const { result } = renderHook(() => useAppStore());
  
  act(() => {
    result.current.setError('Network error');
  });
  
  expect(result.current.error).toBe('Network error');
  expect(result.current.isLoading).toBe(false);
});
```

### 4. Mock Time-based Operations
```typescript
jest.useFakeTimers();

it('should debounce updates', () => {
  const { result } = renderHook(() => useAppStore());
  
  act(() => {
    result.current.debouncedUpdate('value1');
    result.current.debouncedUpdate('value2');
    result.current.debouncedUpdate('value3');
  });
  
  // Only last update should be applied after debounce
  jest.runAllTimers();
  expect(result.current.value).toBe('value3');
});

jest.useRealTimers();
```

## Common Patterns

### Testing Multiple Stores
```typescript
it('should sync between stores', () => {
  const { result: appStore } = renderHook(() => useAppStore());
  const { result: apiStore } = renderHook(() => useAPIStore());
  
  act(() => {
    appStore.current.setAPIProvider('openai');
  });
  
  expect(apiStore.current.activeProvider).toBe('openai');
});
```

### Testing Store Subscriptions
```typescript
it('should notify subscribers', () => {
  const listener = jest.fn();
  const unsubscribe = useAppStore.subscribe(listener);
  
  act(() => {
    useAppStore.getState().addMalwareFile(file);
  });
  
  expect(listener).toHaveBeenCalledTimes(1);
  unsubscribe();
});
```