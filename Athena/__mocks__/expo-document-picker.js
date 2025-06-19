// Mock for expo-document-picker
const mockDocumentPicker = {
  getDocumentAsync: async (options = {}) => ({
    type: 'success',
    uri: 'file:///mock/test.txt',
    name: 'test.txt',
    size: 1024,
    mimeType: 'text/plain',
  }),
  
  // Constants
  DocumentPickerResult: {
    SUCCESS: 'success',
    CANCELLED: 'cancel',
  },
  
  // Reset function for tests
  _reset: () => {
    // No-op for simple async functions
  }
};

// Initialize with default implementations
mockDocumentPicker._reset();

module.exports = mockDocumentPicker;