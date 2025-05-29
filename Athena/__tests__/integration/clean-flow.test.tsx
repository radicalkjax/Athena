import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { create } from 'zustand';
import { renderWithProviders } from './setup';
import { FileUploader } from '@/components/FileUploader';
import { AnalysisResults } from '@/components/AnalysisResults';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/design-system';
import * as fileManagerService from '@/services/fileManager';
import * as analysisService from '@/services/analysisService';

// Create a clean store just for this test
const createTestStore = () => create((set) => ({
  malwareFiles: [],
  selectedMalwareId: null,
  isAnalyzing: false,
  analysisResults: [],
  
  addMalwareFile: (file) => set(state => ({ 
    malwareFiles: [...state.malwareFiles, file] 
  })),
  
  selectMalwareFile: (id) => set({ selectedMalwareId: id }),
  
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  
  addAnalysisResult: (result) => set(state => ({ 
    analysisResults: [...state.analysisResults, result],
    isAnalyzing: false
  })),
  
  clearAnalysisResults: () => set({ analysisResults: [] })
}));

// Mock services
jest.mock('@/services/fileManager');
jest.mock('@/services/analysisService');

// Test component
const TestFlow = ({ store }) => {
  const state = store();
  const [selectedFile, setSelectedFile] = React.useState(null);
  
  const handleFileSelect = (file) => {
    setSelectedFile(file);
    state.selectMalwareFile(file.id);
  };
  
  const handleAnalyze = async () => {
    if (!selectedFile) return;
    
    state.setIsAnalyzing(true);
    try {
      const result = await (analysisService as any).analyzeFile(selectedFile);
      state.addAnalysisResult(result);
    } catch (error) {
      console.error('Analysis failed:', error);
      state.setIsAnalyzing(false);
    }
  };
  
  return (
    <ThemedView testID="test-flow">
      <ThemedView testID="upload-section">
        <FileUploader onFileSelect={handleFileSelect} />
      </ThemedView>
      
      {selectedFile && state.analysisResults.length === 0 && (
        <ThemedView testID="analyze-section">
          <ThemedText>Selected: {selectedFile.name}</ThemedText>
          <Button
            onPress={handleAnalyze}
            disabled={state.isAnalyzing}
            testID="analyze-button"
          >
            {state.isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </ThemedView>
      )}
      
      {state.analysisResults.length > 0 && (
        <ThemedView testID="results-section">
          <AnalysisResults 
            result={state.analysisResults[0]} 
            isAnalyzing={false} 
          />
        </ThemedView>
      )}
    </ThemedView>
  );
};

describe.skip('Clean Flow Test', () => {
  let testStore;
  
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    
    // Create fresh store for each test
    testStore = createTestStore();
    
    // Mock services
    (fileManagerService as any).initFileSystem = jest.fn().mockResolvedValue(undefined);
    (fileManagerService as any).listMalwareFiles = jest.fn().mockResolvedValue([]);
    (fileManagerService as any).pickFile = jest.fn().mockResolvedValue({
      id: 'test-123',
      name: 'malware.exe',
      size: 2048576,
      type: 'application/x-msdownload',
      uri: 'file:///test/malware.exe',
      content: 'test'
    });
    
    (analysisService as any).analyzeFile = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      return {
        id: 'result-1',
        malwareId: 'test-123',
        modelId: 'test-model',
        timestamp: Date.now(),
        analysisReport: 'Risk Score: 8.5\nThreats: Trojan.Generic',
        deobfuscatedCode: 'function test() {}',
        vulnerabilities: [{
          id: 'vuln-1',
          name: 'Buffer Overflow',
          severity: 'high',
          description: 'Test'
        }]
      };
    });
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  it('should complete the flow correctly', async () => {
    const { getByTestId, getByText, queryByTestId } = renderWithProviders(
      <TestFlow store={testStore} />
    );
    
    // Initially no analyze or results section
    expect(queryByTestId('analyze-section')).toBeFalsy();
    expect(queryByTestId('results-section')).toBeFalsy();
    
    // Upload file
    fireEvent.press(getByText('Upload'));
    
    // Wait for file to appear
    await waitFor(() => {
      expect(getByText('malware.exe')).toBeTruthy();
    });
    
    // Select file
    fireEvent.press(getByText('malware.exe'));
    
    // Analyze section should appear
    await waitFor(() => {
      expect(getByTestId('analyze-section')).toBeTruthy();
    });
    
    // Start analysis
    fireEvent.press(getByTestId('analyze-button'));
    
    // Should show analyzing state
    expect(getByText('Analyzing...')).toBeTruthy();
    
    // Advance timers
    jest.advanceTimersByTime(200);
    
    // Wait for results
    await waitFor(() => {
      expect(getByTestId('results-section')).toBeTruthy();
      expect(queryByTestId('analyze-section')).toBeFalsy();
    });
    
    // Verify analysis was called
    expect((analysisService as any).analyzeFile).toHaveBeenCalledWith({
      id: 'test-123',
      name: 'malware.exe',
      size: 2048576,
      type: 'application/x-msdownload',
      uri: 'file:///test/malware.exe',
      content: 'test'
    });
  });
});