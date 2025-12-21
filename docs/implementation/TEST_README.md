# Athena Frontend Testing Guide

## Overview

This document describes the Vitest testing infrastructure for the Athena v2 frontend application.

## Test Statistics

- **Total Test Cases**: 72+
- **Test Files**: 4
- **Test Coverage**: Services and Components
- **Test Framework**: Vitest + SolidJS Testing Library

## Test Structure

```
athena-v2/
├── vitest.config.ts                    # Vitest configuration
├── src/
│   ├── test-setup.ts                   # Global test setup and mocks
│   ├── services/
│   │   └── __tests__/
│   │       ├── aiService.test.ts       # 6 tests - AI provider integration
│   │       ├── analysisCoordinator.test.ts # 6 tests - Task coordination
│   │       ├── preloadService.test.ts  # 4 tests - Component preloading
│   │       └── wasmService.test.ts     # 52+ tests - WASM runtime
│   └── components/
│       └── solid/
│           └── analysis/
│               └── __tests__/
│                   └── FileUploadArea.test.tsx # 4 tests - File upload UI
```

## Running Tests

### Run all tests once
```bash
cd athena-v2
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

## Test Coverage by Module

### AIService (6 tests)
- ✅ Provider initialization with defaults
- ✅ Provider status checking
- ✅ Single provider analysis with caching
- ✅ Error handling for disabled providers
- ✅ Multi-provider parallel analysis
- ✅ Analysis cancellation

### AnalysisCoordinator (6+ tests)
- ✅ Bulkhead initialization for all analysis types
- ✅ Concurrent execution limits enforcement
- ✅ Task queue management
- ✅ Task completion tracking
- ✅ Resource monitoring
- ✅ Analysis cancellation

### PreloadService (4 tests)
- ✅ Component preloading with delay
- ✅ Preload cancellation
- ✅ Critical component batch loading
- ✅ Cache management

### WasmService (52+ tests)
- ✅ Runtime initialization
- ✅ Auto-initialization on module load
- ✅ Module loading from bytes and files
- ✅ Function execution with metrics
- ✅ Module management (list, unload, memory usage)
- ✅ High-level module bindings (crypto, file-processor, etc.)
- ✅ Session management (create, execute, destroy)
- ✅ Metrics tracking (per-module and global)

### FileUploadArea Component (4 tests)
- ✅ Rendering upload area with instructions
- ✅ Drag and drop handling (web and Tauri modes)
- ✅ Upload progress display
- ✅ Error handling and display

## Mock Infrastructure

### Tauri API Mocks

The `test-setup.ts` file provides comprehensive Tauri API mocks:

```typescript
window.__TAURI__ = {
  tauri: { invoke: mockInvoke },
  event: { listen: mockListen },
  dialog: { open: vi.fn() },
  os: { platform: vi.fn() },
  window: { appWindow: { minimize, maximize, close } }
};
```

### Test Utilities

#### `createMockFile(name, size, type, content)`
Creates a mock File object for upload testing.

#### `createMockAnalysisResult(overrides)`
Generates mock static analysis results.

#### `createMockAIAnalysisResult(provider, overrides)`
Generates mock AI analysis results with IoCs.

#### `flushPromises()`
Waits for all pending promises to resolve.

#### `resetMocks()`
Clears all mock call history between tests.

## Writing New Tests

### Service Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { myService } from '../myService';
import { mockInvoke, flushPromises } from '../../test-setup';

describe('MyService', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  describe('Feature group', () => {
    it('should do something specific', async () => {
      mockInvoke.mockResolvedValue({ result: 'success' });

      const result = await myService.doSomething();

      expect(mockInvoke).toHaveBeenCalledWith('command_name', {
        param: 'value'
      });
      expect(result).toEqual({ result: 'success' });
    });
  });
});
```

### Component Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { MyComponent } from '../MyComponent';
import { mockInvoke } from '../../../../test-setup';

describe('MyComponent', () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });

  it('should render correctly', () => {
    render(() => <MyComponent />);

    expect(screen.getByText('Expected Text')).toBeDefined();
  });

  it('should handle user interaction', async () => {
    render(() => <MyComponent />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText('Result')).toBeDefined();
    });
  });
});
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Use `beforeEach()` to reset state
- Clear mocks between tests

### 2. Async Handling
- Always `await` async operations
- Use `waitFor()` for UI updates
- Call `flushPromises()` for micro-task queue

### 3. Mock Strategy
- Mock at the Tauri API boundary (`invoke`, `listen`)
- Don't mock internal service logic
- Use realistic mock data

### 4. Test Coverage Goals
- Aim for >80% code coverage
- Test happy paths and error cases
- Test edge cases (empty arrays, null values, etc.)

### 5. Performance
- Use fake timers for time-dependent code
- Avoid actual network calls
- Keep tests fast (<100ms per test)

## Troubleshooting

### Tests fail with "window is not defined"
Make sure `test-setup.ts` is imported in `vitest.config.ts`:
```typescript
setupFiles: './src/test-setup.ts'
```

### Tauri invoke not mocked
Ensure you're importing `mockInvoke` from `test-setup.ts` and clearing it in `beforeEach()`.

### Component tests timeout
Increase timeout in `waitFor()`:
```typescript
await waitFor(() => {
  expect(screen.getByText('Result')).toBeDefined();
}, { timeout: 2000 });
```

### Fake timers not working
Make sure to clean up:
```typescript
afterEach(() => {
  vi.useRealTimers();
});
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Install dependencies
  run: cd athena-v2 && npm ci

- name: Run tests
  run: cd athena-v2 && npm test

- name: Generate coverage
  run: cd athena-v2 && npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./athena-v2/coverage/coverage-final.json
```

## Future Improvements

- [ ] Add E2E tests with Playwright/Cypress
- [ ] Increase coverage to 90%+
- [ ] Add visual regression tests
- [ ] Add performance benchmarks
- [ ] Test WASM module bindings with actual .wasm files
- [ ] Add mutation testing

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [SolidJS Testing Library](https://github.com/solidjs/solid-testing-library)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/)

## Contributors

Tests implemented as part of the Athena v2 modernization project.
Last updated: December 19, 2025
