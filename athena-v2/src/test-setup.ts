import { vi } from 'vitest';

/**
 * Test setup file for Vitest
 * Mocks Tauri APIs and provides test utilities
 */

// Mock Tauri API
const mockInvoke = vi.fn();
const mockListen = vi.fn();

globalThis.window = globalThis.window || ({} as any);

(window as any).__TAURI__ = {
  tauri: {
    invoke: mockInvoke,
  },
  event: {
    listen: mockListen,
  },
  dialog: {
    open: vi.fn(),
  },
  os: {
    platform: vi.fn().mockResolvedValue('linux'),
  },
  window: {
    appWindow: {
      minimize: vi.fn(),
      maximize: vi.fn(),
      close: vi.fn(),
    },
  },
};

// Mock @tauri-apps/api/core module
vi.mock('@tauri-apps/api/core', async () => {
  return {
    invoke: mockInvoke,
  };
});

// Mock @tauri-apps/plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

// Export mock functions for use in tests
export { mockInvoke, mockListen };

/**
 * Create a mock File object for testing
 */
export function createMockFile(
  name: string,
  size: number,
  type: string = 'application/octet-stream',
  content?: Uint8Array
): File {
  const fileContent = content || new Uint8Array(size);
  const blob = new Blob([fileContent], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/**
 * Create mock analysis result
 */
export function createMockAnalysisResult(overrides?: any) {
  return {
    size: 1024,
    format: {
      mime_type: 'application/x-executable',
      file_type: 'PE32',
    },
    hashes: {
      md5: '5d41402abc4b2a76b9719d911017c592',
      sha1: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
      sha256: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae',
    },
    entropy: 7.2,
    sections: [],
    imports: [],
    exports: [],
    ...overrides,
  };
}

/**
 * Create mock AI analysis result
 */
export function createMockAIAnalysisResult(
  provider: string,
  overrides?: any
) {
  return {
    provider,
    timestamp: Date.now(),
    confidence: 0.85,
    threatLevel: 'suspicious',
    malwareFamily: 'TestMalware',
    malwareType: 'Trojan',
    signatures: ['signature1', 'signature2'],
    behaviors: ['network_connection', 'registry_modification'],
    iocs: {
      domains: ['evil.com'],
      ips: ['192.0.2.1'],
      files: ['C:\\malware.exe'],
      registry: ['HKLM\\Software\\Malware'],
      processes: ['malware.exe'],
    },
    recommendations: ['Isolate system', 'Run full scan'],
    ...overrides,
  };
}

/**
 * Wait for async operations to complete
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Reset all mocks between tests
 */
export function resetMocks() {
  mockInvoke.mockClear();
  mockListen.mockClear();
}

// Reset mocks before each test
beforeEach(() => {
  resetMocks();
});
