import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';
import { renderWithProviders, resetStores } from './setup';
import { useAppStore } from '@/store';
import { Button } from '@/design-system';

const TestComponent = () => {
  const { analysisResults, addAnalysisResult } = useAppStore();
  
  return (
    <View>
      <Text testID="results-count">Results: {analysisResults.length}</Text>
      <Button
        testID="add-result"
        onPress={() => {
          addAnalysisResult({
            id: 'test-1',
            malwareId: 'file-1',
            modelId: 'model-1',
            timestamp: Date.now(),
            analysisReport: 'Test report'
          });
        }}
      >
        Add Result
      </Button>
    </View>
  );
};

describe.skip('Isolated Store Test', () => {
  beforeEach(() => {
    resetStores();
  });
  
  it('should start with empty results', () => {
    const { getByTestId } = renderWithProviders(<TestComponent />);
    
    expect(getByTestId('results-count').props.children).toEqual(['Results: ', 0]);
    
    fireEvent.press(getByTestId('add-result'));
    
    waitFor(() => {
      expect(getByTestId('results-count').props.children).toEqual(['Results: ', 1]);
    });
  });
});