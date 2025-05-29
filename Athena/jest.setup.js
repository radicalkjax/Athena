// Jest Native matchers are now built-in to @testing-library/react-native v12.4+
// No need to import them separately

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock expo modules
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-constants', () => ({
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

jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///test/',
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
  copyAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8'
  }
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

// Mock expo-font (needed for @expo/vector-icons)
global.loadedNativeFonts = new Set();
jest.mock('expo-font', () => ({
  loadAsync: jest.fn().mockResolvedValue(true),
  isLoaded: jest.fn().mockReturnValue(true),
  isLoading: jest.fn().mockReturnValue(false),
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => {
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

// Mock react-icons (for web compatibility)
jest.mock('react-icons', () => ({
  FiUpload: () => null,
  FiX: () => null,
  FiCheck: () => null,
  FiAlertCircle: () => null,
}));

// Global test utilities
global.console = {
  ...console,
  // Suppress console methods during tests unless debugging
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock database modules to prevent sequelize initialization in tests
jest.mock('@/config/database', () => require('./__mocks__/config/database'));
jest.mock('@/models', () => require('./__mocks__/models'));
jest.mock('@/services/container-db', () => require('./__mocks__/services/container-db'));

// Set up global test timeout
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});