// Mock for expo-file-system
const mockFileSystem = {
  documentDirectory: 'file:///test/',
  cacheDirectory: 'file:///cache/',
  bundleDirectory: 'file:///bundle/',
  
  // Enum for encoding types
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8'
  },
  
  // Track initialization state to prevent recursive calls
  _initialized: false,
  _fileData: {},
  
  getInfoAsync: async (path) => {
    if (path.includes('local_models/') && !mockFileSystem._initialized) {
      return { exists: false };
    }
    return { exists: true, size: 1024, isDirectory: false };
  },
  makeDirectoryAsync: async () => {
    mockFileSystem._initialized = true;
    return undefined;
  },
  readAsStringAsync: async (path) => {
    if (mockFileSystem._fileData[path]) {
      return mockFileSystem._fileData[path];
    }
    if (path.includes('config.json')) {
      return '[]';
    }
    return '';
  },
  writeAsStringAsync: async (path, content) => {
    mockFileSystem._fileData[path] = content;
    return undefined;
  },
  readDirectoryAsync: async () => [],
  copyAsync: async () => undefined,
  deleteAsync: async () => undefined,
  
  // Reset function for tests
  _reset: () => {
    mockFileSystem._initialized = false;
    mockFileSystem._fileData = {};
  }
};

// Initialize with default implementations
mockFileSystem._reset();

module.exports = mockFileSystem;