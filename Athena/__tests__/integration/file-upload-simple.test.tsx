import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders, resetStores } from './setup';
import { FileUploader } from '@/components/FileUploader';
import { useAppStore } from '@/store';
import * as fileManagerService from '@/services/fileManager';

jest.mock('@/services/fileManager');

const TestWrapper = () => {
  const { analysisResults } = useAppStore();
  const [selectedFile, setSelectedFile] = React.useState(null);
  
  return (
    <div>
      <div>Analysis Results: {analysisResults.length}</div>
      <div>Selected File: {selectedFile ? selectedFile.name : 'none'}</div>
      <FileUploader onFileSelect={setSelectedFile} />
    </div>
  );
};

describe('Simple File Upload Test', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStores();
    jest.clearAllMocks();
    
    // Mock file manager
    (fileManagerService as any).initFileSystem = jest.fn().mockResolvedValue(undefined);
    (fileManagerService as any).listMalwareFiles = jest.fn().mockResolvedValue([]);
    (fileManagerService as any).pickFile = jest.fn().mockResolvedValue({
      id: 'test-123',
      name: 'test.exe',
      size: 1024,
      type: 'application/x-msdownload',
      uri: 'file:///test.exe',
      content: 'test'
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  it('should not have analysis results after file upload', async () => {
    const { getByText } = renderWithProviders(<TestWrapper />);
    
    // Check initial state
    expect(getByText('Analysis Results: 0')).toBeTruthy();
    expect(getByText('Selected File: none')).toBeTruthy();
    
    // Upload file
    fireEvent.press(getByText('Upload'));
    
    // Wait for file to be selected
    await waitFor(() => {
      expect(getByText('Selected File: test.exe')).toBeTruthy();
    });
    
    // Analysis results should still be 0
    expect(getByText('Analysis Results: 0')).toBeTruthy();
  });
});