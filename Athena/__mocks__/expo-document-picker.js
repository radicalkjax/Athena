// Mock for expo-document-picker
const mockDocumentPicker = {
  getDocumentAsync: jest.fn(),
  
  // Reset function for tests
  _reset: () => {
    mockDocumentPicker.getDocumentAsync.mockClear();
  }
};

// Initialize with default implementations
mockDocumentPicker._reset();

module.exports = mockDocumentPicker;