import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders, resetStores, mockServices } from './setup';
import { FileUploader } from '@/components/FileUploader';
import * as fileManagerService from '@/services/fileManager';

jest.mock('@/services/fileManager');

describe('Debug File Upload', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStores();
    Object.assign(fileManagerService, mockServices.fileManager);
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });

  it('should handle file selection', async () => {
    let selectedFile = null;
    
    const { getByText } = renderWithProviders(
      <FileUploader onFileSelect={(file) => {
        console.log('File selected:', file);
        selectedFile = file;
      }} />
    );

    // Wait for component to load
    await waitFor(() => {
      expect(getByText('Upload')).toBeTruthy();
    });
    
    // Upload a file
    fireEvent.press(getByText('Upload'));
    
    // Wait for file to appear
    await waitFor(() => {
      expect(getByText('malicious.exe')).toBeTruthy();
    });
    
    console.log('Selected file after upload:', selectedFile);
    
    // Click on the file
    fireEvent.press(getByText('malicious.exe'));
    
    // Wait a bit
    await waitFor(() => {
      expect(selectedFile).toBeTruthy();
    });
    
    console.log('Selected file after click:', selectedFile);
  });
});
EOF < /dev/null
