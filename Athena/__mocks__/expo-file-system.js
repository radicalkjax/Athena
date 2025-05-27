// Mock for expo-file-system to avoid memory issues
const mockFileSystem = {
  documentDirectory: 'file:///test/',
  
  // Enum for encoding types
  EncodingType: {
    Base64: 'base64',
    UTF8: 'utf8'
  },
  
  // Track initialization state to prevent recursive calls
  _initialized: false,
  _fileData: {},
  
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  
  // Reset function for tests
  _reset: () => {
    mockFileSystem._initialized = false;
    mockFileSystem._fileData = {};
    mockFileSystem.getInfoAsync.mockClear();
    mockFileSystem.makeDirectoryAsync.mockClear();
    mockFileSystem.readAsStringAsync.mockClear();
    mockFileSystem.writeAsStringAsync.mockClear();
    mockFileSystem.readDirectoryAsync.mockClear();
    mockFileSystem.copyAsync.mockClear();
    mockFileSystem.deleteAsync.mockClear();
    
    // Set up default mock implementations
    mockFileSystem.getInfoAsync.mockImplementation((path) => {
      // Prevent recursive initialization in tests
      if (path.includes('local_models/') && !mockFileSystem._initialized) {
        return Promise.resolve({ exists: false });
      }
      return Promise.resolve({ exists: true });
    });
    
    mockFileSystem.makeDirectoryAsync.mockImplementation(() => {
      mockFileSystem._initialized = true;
      return Promise.resolve();
    });
    
    mockFileSystem.readAsStringAsync.mockImplementation((path) => {
      if (mockFileSystem._fileData[path]) {
        return Promise.resolve(mockFileSystem._fileData[path]);
      }
      // Default return empty array for config.json
      if (path.includes('config.json')) {
        return Promise.resolve('[]');
      }
      return Promise.resolve('');
    });
    
    mockFileSystem.writeAsStringAsync.mockImplementation((path, content) => {
      mockFileSystem._fileData[path] = content;
      return Promise.resolve();
    });
  }
};

// Initialize with default implementations
mockFileSystem._reset();

module.exports = mockFileSystem;