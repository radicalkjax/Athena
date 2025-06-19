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

// Mock WASM modules for CI environment
if (process.env.CI) {
  // Mock the actual WASM module imports
  vi.mock('../core/analysis-engine/pkg-node/athena_analysis_engine', () => ({
    default: vi.fn().mockResolvedValue({}),
    analyze_content: vi.fn().mockReturnValue(JSON.stringify({
      riskScore: 50,
      verdict: 'suspicious',
      indicators: [],
      metadata: {}
    }))
  }));
  
  vi.mock('../core/crypto/pkg-node/athena_crypto', () => ({
    default: vi.fn().mockResolvedValue({}),
    hash_data: vi.fn().mockReturnValue(new Uint8Array(32)),
    encrypt_data: vi.fn().mockReturnValue(new Uint8Array(0)),
    decrypt_data: vi.fn().mockReturnValue(new Uint8Array(0))
  }));
  
  vi.mock('../core/deobfuscator/pkg-node/athena_deobfuscator', () => ({
    default: vi.fn().mockResolvedValue({}),
    deobfuscate_javascript: vi.fn().mockReturnValue('deobfuscated code')
  }));
  
  vi.mock('../core/file-processor/pkg-node/athena_file_processor', () => ({
    default: vi.fn().mockResolvedValue({}),
    process_file: vi.fn().mockReturnValue(JSON.stringify({
      fileType: 'unknown',
      metadata: {},
      extractedData: []
    }))
  }));
  
  vi.mock('../core/network/pkg-node/athena_network', () => ({
    default: vi.fn().mockResolvedValue({}),
    analyze_packet: vi.fn().mockReturnValue(JSON.stringify({
      protocol: 'unknown',
      suspicious: false
    }))
  }));
  
  vi.mock('../core/pattern-matcher/pkg-node/athena_pattern_matcher', () => ({
    default: vi.fn().mockResolvedValue({}),
    match_patterns: vi.fn().mockReturnValue(JSON.stringify({
      matches: []
    }))
  }));
  
  vi.mock('../core/sandbox/pkg-node/athena_sandbox', () => ({
    default: vi.fn().mockResolvedValue({}),
    execute_sandboxed: vi.fn().mockReturnValue(JSON.stringify({
      success: true,
      output: '',
      errors: []
    }))
  }));
}

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