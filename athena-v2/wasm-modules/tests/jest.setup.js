// Jest Setup File for WASM Integration Tests

// Add TextEncoder/TextDecoder to global if not available (Node.js < 11)
if (typeof TextEncoder === 'undefined') {
  global.TextEncoder = require('util').TextEncoder;
}

if (typeof TextDecoder === 'undefined') {
  global.TextDecoder = require('util').TextDecoder;
}

// Mock WebAssembly if not available in test environment
if (typeof WebAssembly === 'undefined') {
  global.WebAssembly = {
    instantiate: jest.fn(),
    compile: jest.fn(),
    Module: jest.fn(),
    Instance: jest.fn(),
    Memory: jest.fn(),
    Table: jest.fn(),
    CompileError: Error,
    LinkError: Error,
    RuntimeError: Error
  };
}

// Mock performance API if not available
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now(),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => []),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn()
  };
}

// Set test timeout
jest.setTimeout(30000); // 30 seconds for integration tests

// Suppress console warnings during tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    if (
      args[0]?.includes('experimental') || 
      args[0]?.includes('deprecat')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});