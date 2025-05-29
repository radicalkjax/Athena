import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';
import { renderWithProviders, resetStores } from './setup';
import { useAppStore } from '@/store';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Button } from '@/design-system';

// Super simple component to test the flow
const SimpleFlow = () => {
  const { 
    analysisResults,
    addAnalysisResult,
    isAnalyzing,
    setIsAnalyzing
  } = useAppStore();
  
  const [file, setFile] = React.useState(null);
  
  const handleUpload = () => {
    setFile({ id: '1', name: 'test.exe' });
  };
  
  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 100));
    addAnalysisResult({
      id: 'result-1',
      malwareId: file.id,
      modelId: 'test',
      timestamp: Date.now(),
      analysisReport: 'Test report'
    });
    setIsAnalyzing(false);
  };
  
  return (
    <ThemedView>
      <Button onPress={handleUpload} testID="upload-btn">
        Upload
      </Button>
      
      {file && !analysisResults.length && (
        <ThemedView testID="analyze-section">
          <ThemedText>File: {file.name}</ThemedText>
          <Button onPress={handleAnalyze} testID="analyze-btn">
            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </ThemedView>
      )}
      
      {analysisResults.length > 0 && (
        <ThemedView testID="results-section">
          <ThemedText>Results ready</ThemedText>
        </ThemedView>
      )}
    </ThemedView>
  );
};

describe('Basic Flow Test', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetStores();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  it('should show proper flow', async () => {
    const { getByTestId, getByText, queryByTestId } = renderWithProviders(<SimpleFlow />);
    
    // Initially no sections
    expect(queryByTestId('analyze-section')).toBeFalsy();
    expect(queryByTestId('results-section')).toBeFalsy();
    
    // Upload file
    fireEvent.press(getByTestId('upload-btn'));
    
    // Should show analyze section
    await waitFor(() => {
      expect(getByTestId('analyze-section')).toBeTruthy();
    });
    
    // Analyze
    fireEvent.press(getByTestId('analyze-btn'));
    
    // Should show analyzing state
    expect(getByText('Analyzing...')).toBeTruthy();
    
    // Advance timers
    jest.advanceTimersByTime(100);
    
    // Should show results
    await waitFor(() => {
      expect(getByTestId('results-section')).toBeTruthy();
      expect(queryByTestId('analyze-section')).toBeFalsy();
    });
  });
});