import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { View, Text, Button } from 'react-native';
import { renderWithProviders, resetStores } from './setup';
import { useAppStore } from '@/store';

const SimpleTestComponent = () => {
  const { analysisResults, addAnalysisResult } = useAppStore();
  const [file, setFile] = React.useState(null);
  
  return (
    <View>
      <Button
        title="Upload"
        onPress={() => setFile({ id: '1', name: 'test.exe' })}
      />
      
      {file && (
        <View testID="file-info">
          <Text>File: {file.name}</Text>
        </View>
      )}
      
      {file && (!analysisResults || analysisResults.length === 0) && (
        <View testID="analyze-section">
          <Button
            title="Analyze"
            onPress={() => {
              addAnalysisResult({
                id: 'result-1',
                malwareId: file.id,
                modelId: 'test',
                timestamp: Date.now(),
                analysisReport: 'Test report'
              });
            }}
          />
        </View>
      )}
      
      {analysisResults && analysisResults.length > 0 && (
        <View testID="results-section">
          <Text>Results: {analysisResults.length}</Text>
        </View>
      )}
    </View>
  );
};

describe('Simple Flow Test', () => {
  beforeEach(() => {
    resetStores();
  });
  
  it('should show analyze section after file upload', async () => {
    const { getByText, getByTestId, queryByTestId } = renderWithProviders(<SimpleTestComponent />);
    
    // Initially no analyze section
    expect(queryByTestId('analyze-section')).toBeFalsy();
    
    // Upload file
    fireEvent.press(getByText('Upload'));
    
    // Should show file info and analyze section
    await waitFor(() => {
      expect(getByTestId('file-info')).toBeTruthy();
      expect(getByTestId('analyze-section')).toBeTruthy();
    });
    
    // Analyze
    fireEvent.press(getByText('Analyze'));
    
    // Should show results and hide analyze section
    await waitFor(() => {
      expect(getByTestId('results-section')).toBeTruthy();
      expect(queryByTestId('analyze-section')).toBeFalsy();
    });
  });
});