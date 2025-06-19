import { vi } from 'vitest';

// Global __DEV__ for React Native
global.__DEV__ = true;

// Note: React component tests are excluded via vitest.config.ts exclude patterns

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    getAllKeys: vi.fn(),
    multiGet: vi.fn(),
    multiSet: vi.fn()
  }
}));

// Mock expo modules
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.0',
      extra: {
        openaiApiKey: 'test-openai-key',
        claudeApiKey: 'test-claude-key',
        deepseekApiKey: 'test-deepseek-key',
        databaseUrl: 'postgres://test:test@localhost:5432/test',
        openaiApiBaseUrl: 'https://api.openai.com/v1',
        claudeApiBaseUrl: 'https://api.anthropic.com/v1',
        deepseekApiBaseUrl: 'https://api.deepseek.com/v1',
      },
    },
    manifest: {
      extra: {
        openaiApiKey: 'test-openai-key',
        claudeApiKey: 'test-claude-key',
        deepseekApiKey: 'test-deepseek-key',
        databaseUrl: 'postgres://test:test@localhost:5432/test',
      },
    },
  },
  Constants: {
    expoConfig: {
      extra: {
        openaiApiKey: 'test-openai-key',
        claudeApiKey: 'test-claude-key',
        deepseekApiKey: 'test-deepseek-key',
        databaseUrl: 'postgres://test:test@localhost:5432/test',
      },
    },
    manifest: {
      extra: {
        openaiApiKey: 'test-openai-key',
        claudeApiKey: 'test-claude-key',
        deepseekApiKey: 'test-deepseek-key',
        databaseUrl: 'postgres://test:test@localhost:5432/test',
      },
    },
  },
}));

vi.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  downloadAsync: vi.fn(),
  readAsStringAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
  deleteAsync: vi.fn(),
  moveAsync: vi.fn(),
  copyAsync: vi.fn(),
  makeDirectoryAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8'
  }
}));

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

// Mock @react-native-picker/picker to avoid Flow type parsing issues
vi.mock('@react-native-picker/picker', () => {
  const React = require('react');
  const Picker = (props) => React.createElement('View', props, props.children);
  Picker.Item = (props) => React.createElement('View', props, props.label);
  return { Picker };
});

// Mock @react-native-community/slider
vi.mock('@react-native-community/slider', () => ({
  default: (props) => require('react').createElement('View', props),
}));

// Mock expo-font (needed for @expo/vector-icons)
global.loadedNativeFonts = new Set();
vi.mock('expo-font', () => ({
  loadAsync: vi.fn().mockResolvedValue(true),
  isLoaded: vi.fn().mockReturnValue(true),
  isLoading: vi.fn().mockReturnValue(false),
}));

// Mock @expo/vector-icons
vi.mock('@expo/vector-icons', () => {
  const { View } = require('react-native');
  const React = require('react');
  
  const createIconSet = () => {
    return ({ name, size, color, ...props }) => React.createElement(View, { ...props, testID: `icon-${name}` });
  };
  
  return {
    Ionicons: createIconSet(),
    MaterialIcons: createIconSet(),
    createIconSet,
  };
});

// Mock @expo/vector-icons/MaterialIcons specifically
vi.mock('@expo/vector-icons/MaterialIcons', () => ({
  default: (props) => ({ type: 'Text', props, children: props.name || 'icon' }),
}));

// Mock react-icons (for web compatibility)
vi.mock('react-icons', () => ({
  FiUpload: () => null,
  FiX: () => null,
  FiCheck: () => null,
  FiAlertCircle: () => null,
}));

// Mock database modules to prevent sequelize initialization in tests
vi.mock('@/config/database', () => ({
  default: {},
  sequelize: null
}));

vi.mock('@/models', () => ({
  User: {},
  Analysis: {},
  Vulnerability: {}
}));

vi.mock('@/services/container-db', () => ({
  hasContainerConfig: vi.fn(),
  createContainer: vi.fn(),
  getContainerStatus: vi.fn(),
  runMalwareAnalysis: vi.fn(),
  getContainerFile: vi.fn(),
  getContainerMonitoringSummary: vi.fn(),
  getSuspiciousActivities: vi.fn(),
  getNetworkActivityByContainerId: vi.fn(),
  getFileActivityByContainerId: vi.fn(),
  getProcessActivityByContainerId: vi.fn(),
  removeContainer: vi.fn()
}));

// Mock global expo object for expo-modules-core
globalThis.expo = {
  EventEmitter: class EventEmitter {
    addListener() {
      return { remove: () => {} };
    }
    removeAllListeners() {}
    emit() {}
  },
  modules: {},
};

// Global test utilities
global.console = {
  ...console,
  // Suppress console methods during tests unless debugging
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

// Mock WASM preprocessing pipeline for AI provider tests
const mockPreprocessor = {
  initialize: vi.fn().mockResolvedValue(undefined),
  preprocess: vi.fn().mockImplementation((input) => {
    // Handle different test cases
    if (input.content && input.content.includes && (
      input.content.includes('injection') || 
      input.content.includes('Ignore all previous instructions')
    )) {
      return Promise.resolve({
        safe: false,
        cleaned: '[PROMPT INJECTION DETECTED]',
        threats: [{ type: 'prompt_injection', severity: 'high' }],
        risks: ['prompt_injection'],
        metadata: { processed: true }
      });
    }
    if (input.content && input.content.includes && input.content.includes('http')) {
      let cleaned = input.content;
      // Match the test expectations
      cleaned = cleaned.replace(/http:\/\/malicious\.example\.com[^\s]*/g, '[MALICIOUS URL REMOVED]');
      cleaned = cleaned.replace(/evil\.com/g, '[MALICIOUS URL REMOVED]');
      cleaned = cleaned.replace(/bit\.ly\/[^\s]+/g, '[URL SHORTENER REMOVED]');
      return Promise.resolve({
        safe: true,
        cleaned,
        risks: [],
        metadata: { processed: true }
      });
    }
    if (input.content instanceof ArrayBuffer) {
      return Promise.resolve({
        safe: true,
        cleaned: 'binary content',
        risks: [],
        metadata: { 
          processed: true,
          originalSize: input.content.byteLength
        }
      });
    }
    return Promise.resolve({
      safe: true,
      sanitized: 'test',
      cleaned: input.content || 'test',
      risks: [],
      metadata: { processed: true }
    });
  }),
  detectThreats: vi.fn().mockResolvedValue({
    threats: [],
    riskScore: 0,
    metadata: {}
  }),
  sanitizeUrls: vi.fn().mockImplementation((content) => content),
  cleanup: vi.fn()
};

vi.mock('./services/aiProviders/preprocessing/wasmPipeline.js', () => ({
  WASMPreprocessingPipeline: vi.fn().mockImplementation(() => mockPreprocessor),
  wasmPreprocessor: mockPreprocessor
}));

// Mock the WASM bridge modules
vi.mock('./wasm-modules/bridge/analysis-engine-bridge-enhanced.js', () => ({
  AnalysisEngineBridge: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: { engine_version: '0.1.0' }
    })
  })),
  analysisEngine: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: { engine_version: '0.1.0' }
    })
  },
  initializeAnalysisEngine: vi.fn().mockResolvedValue(undefined),
  createAnalysisEngine: vi.fn().mockReturnValue({
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: { engine_version: '0.1.0' }
    })
  })
}));

// Mock all WASM bridge exports
vi.mock('./wasm-modules/bridge', () => ({
  initializeAnalysisEngine: vi.fn().mockResolvedValue(undefined),
  analysisEngine: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getVersion: vi.fn().mockReturnValue('0.1.0'),
    analyze: vi.fn().mockResolvedValue({
      severity: 'low',
      threats: [],
      metadata: { engine_version: '0.1.0' }
    })
  },
  createFileProcessor: vi.fn().mockReturnValue({
    process: vi.fn().mockResolvedValue({
      fileType: 'text',
      extractedData: []
    })
  })
}));

// Mock WASM bridge modules
vi.mock('../../bridge', () => {
  return import('./Athena/__mocks__/services/wasm-stubs.ts');
});

vi.mock('../../bridge/types', () => {
  return import('./Athena/__mocks__/services/wasm-stubs.ts');
});

// Mock the full wasm-modules/bridge path
vi.mock('./wasm-modules/bridge', async () => {
  return await import('./wasm-modules/bridge/__mocks__');
});

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks();
});