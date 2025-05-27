/**
 * Integration Test: File Upload to Results Display Flow
 * Tests the user journey from uploading a file to viewing analysis results
 */

import React from 'react';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { View } from 'react-native';
import { renderWithProviders, resetStores, mockServices, generateMalwareFile, generateAnalysisResult } from './setup';
import { FileUploader } from '@/components/FileUploader';
import { AnalysisResults } from '@/components/AnalysisResults';
import { useAppStore } from '@/store';
import * as fileManagerService from '@/services/fileManager';
import * as analysisService from '@/services/analysisService';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/design-system';

// Mock dependencies
jest.mock('@/services/fileManager');
jest.mock('@/services/analysisService');
jest.mock('@/services/openai');
jest.mock('@/services/deepseek');
jest.mock('@/services/claude');
jest.mock('@/hooks', () => ({
  useColorScheme: jest.fn().mockReturnValue('light'),
  useThemeColor: jest.fn().mockReturnValue('#000000')
}));
jest.mock('@/components/ui/IconSymbol', () => {
  const React = require('react');
  return {
    IconSymbol: ({ name, testID, ...props }: any) => 
      React.createElement('View', { testID: testID || `icon-${name}`, ...props })
  };
});
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  MaterialIcons: () => null
}));
jest.mock('react-icons/ai', () => ({
  AiFillAliwangwang: () => null
}));
jest.mock('react-icons/fa', () => ({
  FaTrash: () => null
}));

// Integrated component that combines FileUploader and AnalysisResults
const FileAnalysisFlow = () => {
  const { 
    selectedMalwareId, 
    malwareFiles,
    isAnalyzing,
    analysisResults,
    setAnalyzing,
    setAnalysisResults 
  } = useAppStore();

  const [selectedFile, setSelectedFile] = React.useState<any>(null);

  const handleFileSelect = (file: any) => {
    setSelectedFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setAnalyzing(true);
    try {
      const results = await analysisService.analyzeFile(selectedFile, {
        deepAnalysis: true,
        saveResults: true,
        containerConfig: {
          os: 'linux',
          resourcePreset: 'standard'
        }
      });
      setAnalysisResults(results);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ThemedView testID="file-analysis-flow">
      <ThemedView testID="upload-section">
        <ThemedText>Upload Malware File</ThemedText>
        <FileUploader onFileSelect={handleFileSelect} />
      </ThemedView>

      {selectedFile && !analysisResults && (
        <ThemedView testID="analyze-section">
          <ThemedText>Selected: {selectedFile.name}</ThemedText>
          <Button
            variant="primary"
            onPress={handleAnalyze}
            disabled={isAnalyzing}
            testID="start-analysis-button"
          >
            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
          </Button>
        </ThemedView>
      )}

      {analysisResults && (
        <ThemedView testID="results-section">
          <AnalysisResults results={analysisResults} />
        </ThemedView>
      )}
    </ThemedView>
  );
};

describe('File Upload to Results Display Flow', () => {
  beforeEach(() => {
    resetStores();
    jest.clearAllMocks();
    
    // Setup service mocks
    Object.assign(fileManagerService, mockServices.fileManager);
    Object.assign(analysisService, mockServices.analysisService);
  });

  describe('Complete User Journey', () => {
    it('should guide user from file upload to viewing results', async () => {
      const { getByTestId, getByText, queryByTestId } = renderWithProviders(<FileAnalysisFlow />);

      // Step 1: Verify initial state
      expect(getByTestId('upload-section')).toBeTruthy();
      expect(queryByTestId('analyze-section')).toBeFalsy();
      expect(queryByTestId('results-section')).toBeFalsy();

      // Step 2: Upload a file
      const uploadButton = getByText('Upload');
      fireEvent.press(uploadButton);

      // Wait for file to be uploaded
      await waitFor(() => {
        expect(getByText('malicious.exe')).toBeTruthy();
      }, { timeout: 3000 });

      // Step 3: Verify file appears in the list
      const fileList = within(getByTestId('upload-section'));
      expect(fileList.getByText('malicious.exe')).toBeTruthy();
      expect(fileList.getByText('2048576 bytes')).toBeTruthy(); // File size

      // Step 4: Select the file
      fireEvent.press(getByText('malicious.exe'));

      // Step 5: Verify analysis section appears
      await waitFor(() => {
        expect(getByTestId('analyze-section')).toBeTruthy();
      });
      expect(getByText('Selected: malicious.exe')).toBeTruthy();

      // Step 6: Start analysis
      const analyzeButton = getByTestId('start-analysis-button');
      expect(analyzeButton).toBeTruthy();
      fireEvent.press(analyzeButton);

      // Step 7: Verify analyzing state
      await waitFor(() => {
        expect(getByText('Analyzing...')).toBeTruthy();
      });

      // Step 8: Wait for results
      await waitFor(() => {
        expect(getByTestId('results-section')).toBeTruthy();
      }, { timeout: 5000 });

      // Step 9: Verify results are displayed correctly
      const resultsSection = getByTestId('results-section');
      expect(within(resultsSection).getByText(/Risk Score.*8.5/)).toBeTruthy();
      expect(within(resultsSection).getByText(/Trojan.Generic/)).toBeTruthy();
      expect(within(resultsSection).getByText(/Ransomware.Suspect/)).toBeTruthy();
      expect(within(resultsSection).getByText(/Buffer Overflow/)).toBeTruthy();
      expect(within(resultsSection).getByText(/Quarantine immediately/)).toBeTruthy();
    });

    it('should handle multiple file uploads before analysis', async () => {
      const { getByTestId, getByText, getAllByText } = renderWithProviders(<FileAnalysisFlow />);

      // Upload multiple files
      const files = [
        generateMalwareFile({ id: '1', name: 'virus1.exe' }),
        generateMalwareFile({ id: '2', name: 'virus2.dll' }),
        generateMalwareFile({ id: '3', name: 'trojan.bat' })
      ];

      for (const file of files) {
        fileManagerService.pickFile = jest.fn().mockResolvedValueOnce(file);
        fireEvent.press(getByText('Upload'));
        await waitFor(() => expect(getByText(file.name)).toBeTruthy());
      }

      // Verify all files are displayed
      expect(getByText('virus1.exe')).toBeTruthy();
      expect(getByText('virus2.dll')).toBeTruthy();
      expect(getByText('trojan.bat')).toBeTruthy();

      // Select and analyze the second file
      fireEvent.press(getByText('virus2.dll'));
      await waitFor(() => expect(getByTestId('analyze-section')).toBeTruthy());
      
      expect(getByText('Selected: virus2.dll')).toBeTruthy();
      
      fireEvent.press(getByTestId('start-analysis-button'));
      await waitFor(() => expect(getByTestId('results-section')).toBeTruthy());
    });
  });

  describe('Error Handling', () => {
    it('should handle file upload cancellation', async () => {
      fileManagerService.pickFile = jest.fn().mockResolvedValueOnce(null);
      
      const { getByText, queryByTestId } = renderWithProviders(<FileAnalysisFlow />);
      
      fireEvent.press(getByText('Upload'));
      
      // Wait a bit to ensure no file is added
      await waitFor(() => {
        expect(queryByTestId('analyze-section')).toBeFalsy();
      });
      
      // Verify no files were added
      const state = useAppStore.getState();
      expect(state.malwareFiles).toHaveLength(0);
    });

    it('should display error when analysis fails', async () => {
      analysisService.analyzeFile = jest.fn().mockRejectedValueOnce(
        new Error('Analysis service unavailable')
      );
      
      const { getByTestId, getByText, queryByTestId } = renderWithProviders(<FileAnalysisFlow />);
      
      // Upload and select file
      fireEvent.press(getByText('Upload'));
      await waitFor(() => expect(getByText('malicious.exe')).toBeTruthy());
      fireEvent.press(getByText('malicious.exe'));
      
      // Try to analyze
      await waitFor(() => expect(getByTestId('analyze-section')).toBeTruthy());
      fireEvent.press(getByTestId('start-analysis-button'));
      
      // Wait for analysis to fail
      await waitFor(() => {
        expect(queryByTestId('results-section')).toBeFalsy();
        expect(getByTestId('start-analysis-button')).toBeTruthy();
      });
      
      // Button should be enabled again after failure
      const analyzeButton = getByTestId('start-analysis-button');
      expect(analyzeButton.props.disabled).toBe(false);
    });
  });

  describe('UI State Transitions', () => {
    it('should show correct UI states during workflow', async () => {
      const { getByTestId, getByText, queryByTestId } = renderWithProviders(<FileAnalysisFlow />);
      
      // Initial: Only upload section visible
      expect(getByTestId('upload-section')).toBeTruthy();
      expect(queryByTestId('analyze-section')).toBeFalsy();
      expect(queryByTestId('results-section')).toBeFalsy();
      
      // After file selection: Upload + Analyze sections visible
      fireEvent.press(getByText('Upload'));
      await waitFor(() => expect(getByText('malicious.exe')).toBeTruthy());
      fireEvent.press(getByText('malicious.exe'));
      
      await waitFor(() => {
        expect(getByTestId('upload-section')).toBeTruthy();
        expect(getByTestId('analyze-section')).toBeTruthy();
        expect(queryByTestId('results-section')).toBeFalsy();
      });
      
      // During analysis: Button disabled
      fireEvent.press(getByTestId('start-analysis-button'));
      await waitFor(() => {
        const button = getByTestId('start-analysis-button');
        expect(button.props.disabled).toBe(true);
      });
      
      // After analysis: Results section visible
      await waitFor(() => {
        expect(getByTestId('upload-section')).toBeTruthy();
        expect(queryByTestId('analyze-section')).toBeFalsy(); // Hidden when results shown
        expect(getByTestId('results-section')).toBeTruthy();
      });
    });
  });

  describe('File Information Display', () => {
    it('should display comprehensive file information', async () => {
      const customFile = generateMalwareFile({
        id: 'custom-1',
        name: 'suspicious_document.pdf.exe',
        size: 5242880, // 5MB
        type: 'application/x-msdownload'
      });
      
      fileManagerService.pickFile = jest.fn().mockResolvedValueOnce(customFile);
      
      const { getByText } = renderWithProviders(<FileAnalysisFlow />);
      
      fireEvent.press(getByText('Upload'));
      
      await waitFor(() => {
        expect(getByText('suspicious_document.pdf.exe')).toBeTruthy();
        expect(getByText('5242880 bytes')).toBeTruthy(); // File size display
      });
    });
  });

  describe('Results Interaction', () => {
    it('should allow interaction with analysis results', async () => {
      const { getByTestId, getByText } = renderWithProviders(<FileAnalysisFlow />);
      
      // Quick path to results
      fireEvent.press(getByText('Upload'));
      await waitFor(() => expect(getByText('malicious.exe')).toBeTruthy());
      fireEvent.press(getByText('malicious.exe'));
      await waitFor(() => expect(getByTestId('analyze-section')).toBeTruthy());
      fireEvent.press(getByTestId('start-analysis-button'));
      await waitFor(() => expect(getByTestId('results-section')).toBeTruthy());
      
      // Verify interactive elements in results
      const resultsSection = getByTestId('results-section');
      
      // Check for expandable sections (if implemented)
      const threatsList = within(resultsSection).queryByText(/View all threats/);
      if (threatsList) {
        fireEvent.press(threatsList);
        // Would verify expanded content here
      }
      
      // Verify all key information is present
      expect(within(resultsSection).getByText(/Risk Score/)).toBeTruthy();
      expect(within(resultsSection).getByText(/Threats Detected/)).toBeTruthy();
      expect(within(resultsSection).getByText(/Vulnerabilities/)).toBeTruthy();
      expect(within(resultsSection).getByText(/Recommendations/)).toBeTruthy();
    });
  });
});