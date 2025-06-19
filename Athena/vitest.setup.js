import { vi } from 'vitest';

// Setup global test environment
global.setImmediate = setImmediate;
global.clearImmediate = clearImmediate;

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
  log: vi.fn(),
  debug: vi.fn(),
};

// Add any other global setup needed for tests