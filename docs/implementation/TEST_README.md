# Athena v2 Frontend Testing Guide

## Overview

This document describes the Vitest testing infrastructure for the Athena v2 frontend application built with Tauri 2.0 and SolidJS.

**Last Updated**: December 22, 2025
**Status**: Tests Passing - 169+ total tests passing

## Test Statistics

- **Frontend Tests**: 72 test cases
- **Backend Tests**: 57 Rust tests
- **WASM Module Tests**: 40 tests
- **Total Test Coverage**: >80% across all layers
- **Test Framework**: Vitest + SolidJS Testing Library
- **Rust Testing**: cargo test + tokio::test

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
│                   ├── FileUploadArea.test.tsx # 4 tests - File upload UI
│                   ├── AnalysisDashboard.test.tsx
│                   ├── MemoryAnalysis.test.tsx
│                   └── YaraScanner.test.tsx
├── src-tauri/
│   ├── src/
│   │   └── commands/
│   │       └── tests/              # Rust unit tests
│   └── tests/                      # Integration tests
└── wasm-modules/core/
    ├── analysis-engine/src/*.rs    # WASM module tests
    ├── crypto/src/*.rs
    ├── deobfuscator/src/*.rs
    ├── file-processor/src/*.rs
    ├── network/src/*.rs
    ├── pattern-matcher/src/*.rs
    └── sandbox/src/*.rs
```

## Running Tests

### Frontend Tests (Vitest)

```bash
# Run all frontend tests once
cd /Users/kali/Athena/Athena/athena-v2
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Backend Tests (Rust)

```bash
# Run all Rust backend tests
cd /Users/kali/Athena/Athena/athena-v2/src-tauri
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test module
cargo test commands::file_analysis::tests

# Run tests in release mode (faster)
cargo test --release
```

### WASM Module Tests

```bash
# Test all WASM modules
cd /Users/kali/Athena/Athena/athena-v2/wasm-modules
cargo test --all

# Test specific module
cd /Users/kali/Athena/Athena/athena-v2/wasm-modules/core/crypto
cargo component test

# Build and test release version
cargo component build --release && cargo component test --release
```

### Run All Tests

```bash
# From project root
cd /Users/kali/Athena/Athena
./scripts/test-all.sh

# Or manually:
cd athena-v2 && npm test
cd athena-v2/src-tauri && cargo test
cd athena-v2/wasm-modules && cargo test --all
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

## Backend Test Coverage

### Rust Command Tests (57 tests)

**File Analysis Tests** (`src-tauri/src/commands/file_analysis.rs`)
- File reading and writing operations
- Binary format detection (PE, ELF, Mach-O)
- Hash calculation (MD5, SHA256)
- Metadata extraction

**Network Tests** (`src-tauri/src/commands/network.rs`)
- PCAP packet parsing with valid checksums
- Protocol analysis (TCP, UDP, DNS, HTTP)
- Packet export with proper libpcap format

**AI Provider Tests** (`src-tauri/src/ai_providers/`)
- Claude, OpenAI, DeepSeek integration
- Circuit breaker and retry logic
- Queue manager and rate limiting
- Provider health checks

**Workflow Tests** (`src-tauri/src/workflow/executor.rs`)
- Job execution and lifecycle
- Workflow orchestration
- Error handling and recovery

## WASM Module Test Coverage

### Module-Specific Tests (40 tests)

**Deobfuscator Tests** (9 tests)
- String deobfuscation techniques
- Control flow flattening detection
- AES/DES cryptographic detection
- Pattern matching for obfuscation

**Network Tests** (9 tests)
- DNS query/response parsing
- HTTP request/response parsing
- TLS handshake and certificate parsing
- HTTP/2 frame detection

**File Processor Tests** (15 tests)
- PE file parsing and import extraction
- ELF file parsing with library dependencies
- Format detection and validation
- Metadata extraction

**Sandbox Tests** (7 tests)
- Syscall tracking and monitoring
- Virtual filesystem operations
- Behavioral analysis patterns

## Contributors

Tests implemented as part of the Athena v2 Tauri migration and modernization project.

**Last Updated**: December 22, 2025
**Project Status**: Tests Implemented
**Total Test Count**: 169+ tests across all layers
