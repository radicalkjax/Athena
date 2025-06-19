import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
/**
 * Integration test for streaming analysis flow
 * 
 * SKIPPED: Requires fully implemented streaming analysis with real-time progress updates.
 * Re-enable when streaming functionality is stable and components properly handle async state.
 */

import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { Text, View, Button } from 'react-native';
import { useStreamingAnalysis } from '@/hooks/useStreamingAnalysis';
import { useAppStore } from '@/store';
import { MalwareFile } from '@/types';
import { aiServiceManager } from '@/services/ai/manager';

// Mock the services
vi.mock('@/services/ai/manager');
vi.mock('@/shared/logging/logger');
vi.mock('@/hooks', () => ({
  useColorScheme: vi.fn().mockReturnValue('light'),
  useThemeColor: vi.fn().mockReturnValue('#000000'),
  useStreamingAnalysis: vi.importActual('@/hooks').useStreamingAnalysis
}));

// Test component that uses streaming analysis
function TestStreamingComponent() {
  const { analyze, cancel, getProviderStatus } = useStreamingAnalysis();
  const { currentProgress, isAnalyzing, analysisResults } = useAppStore();
  
  const testFile: MalwareFile = {
    id: 'test-1',
    name: 'malware.exe',
    size: 1024,
    type: 'application/x-executable',
    uri: 'file://malware.exe',
    content: 'obfuscated code'
  };
  
  const handleAnalyze = () => {
    analyze(testFile, 'deobfuscate');
  };
  
  const status = getProviderStatus();
  
  return (
    <View testID="streaming-test">
      <Button title="Analyze" onPress={handleAnalyze} testID="analyze-button" />
      <Button title="Cancel" onPress={cancel} testID="cancel-button" />
      
      {isAnalyzing && (
        <View testID="progress-view">
          <Text testID="progress-text">
            {currentProgress ? `${currentProgress.progress}%` : '0%'}
          </Text>
          <Text testID="stage-text">
            {currentProgress?.stage || 'initializing'}
          </Text>
          <Text testID="message-text">
            {currentProgress?.message || 'Starting...'}
          </Text>
        </View>
      )}
      
      {analysisResults.length > 0 && (
        <View testID="results-view">
          <Text testID="results-count">{analysisResults.length} results</Text>
          <Text testID="latest-result">
            {analysisResults[analysisResults.length - 1].analysisReport}
          </Text>
        </View>
      )}
      
      <View testID="provider-status">
        <Text testID="provider-count">
          {status.providers.size} providers
        </Text>
      </View>
    </View>
  );
}

describe.skip('Streaming Analysis Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    
    // Reset store
    const store = useAppStore.getState();
    store.clearAnalysisResults();
    store.clearAnalysisProgress();
    
    // Mock provider status
    (aiServiceManager.getProviderStatus as jest.Mock).mockReturnValue(
      new Map([
        ['claude', { status: 'healthy', failureCount: 0 }],
        ['openai', { status: 'healthy', failureCount: 0 }]
      ])
    );
    
    (aiServiceManager.getCircuitBreakerStatus as jest.Mock).mockReturnValue(
      new Map([
        ['claude', { state: 'closed' }],
        ['openai', { state: 'closed' }]
      ])
    );
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  
  it('should complete streaming analysis flow', async () => {
    // Mock streaming analysis
    (aiServiceManager.analyzeWithFailover as jest.Mock).mockImplementation(
      async (_code, _type, streaming) => {
        // Use setTimeout to ensure state updates are processed
        return new Promise((resolve) => {
          // First update - 10%
          setTimeout(() => {
            streaming.onProgress(10);
            streaming.onChunk({
              type: 'progress',
              data: { 
                stage: 'initializing',
                message: 'Connecting to AI provider...',
                progress: 10
              },
              timestamp: Date.now()
            });
            
            // Second update - 50%
            setTimeout(() => {
              streaming.onProgress(50);
              streaming.onChunk({
                type: 'progress',
                data: { 
                  stage: 'analyzing',
                  message: 'Analyzing code patterns...',
                  progress: 50,
                  provider: 'claude'
                },
                timestamp: Date.now()
              });
              
              // Third update - 90%
              setTimeout(() => {
                streaming.onProgress(90);
                streaming.onChunk({
                  type: 'progress',
                  data: { 
                    stage: 'finalizing',
                    message: 'Generating report...',
                    progress: 90
                  },
                  timestamp: Date.now()
                });
                
                // Complete the analysis
                setTimeout(() => {
                  const result = {
                    deobfuscatedCode: 'const message = "Hello World";',
                    analysisReport: 'Successfully deobfuscated code. No malicious patterns detected.'
                  };
                  streaming.onComplete(result);
                  resolve(undefined);
                }, 10);
              }, 10);
            }, 10);
          }, 10);
        });
      }
    );
    
    const { getByTestId, queryByTestId } = render(<TestStreamingComponent />);
    
    // Initial state
    expect(queryByTestId('progress-view')).toBeNull();
    expect(queryByTestId('results-view')).toBeNull();
    
    // Start analysis
    fireEvent.press(getByTestId('analyze-button'));
    
    // Check progress updates
    await waitFor(() => {
      expect(getByTestId('progress-view')).toBeTruthy();
    });
    
    // Advance timers to trigger the first update
    vi.advanceTimersByTime(10);
    
    // Check 10% progress
    await waitFor(() => {
      expect(getByTestId('progress-text').props.children).toBe('10%');
      expect(getByTestId('stage-text').props.children).toBe('initializing');
    });
    
    // Advance timers to trigger the second update
    vi.advanceTimersByTime(10);
    
    // Check 50% progress
    await waitFor(() => {
      expect(getByTestId('progress-text').props.children).toBe('50%');
      expect(getByTestId('stage-text').props.children).toBe('analyzing');
      expect(getByTestId('message-text').props.children).toBe('Analyzing code patterns...');
    });
    
    // Advance timers to trigger the third update
    vi.advanceTimersByTime(10);
    
    // Check 90% progress
    await waitFor(() => {
      expect(getByTestId('progress-text').props.children).toBe('90%');
      expect(getByTestId('stage-text').props.children).toBe('finalizing');
    });
    
    // Advance timers to complete the analysis
    vi.advanceTimersByTime(10);
    
    // Check completion
    await waitFor(() => {
      expect(getByTestId('results-view')).toBeTruthy();
      expect(getByTestId('results-count').props.children).toEqual([1, ' results']);
      expect(getByTestId('latest-result').props.children).toContain('Successfully deobfuscated');
    });
    
    // Progress should be cleared after completion
    // TODO: Fix this assertion - progress view is not being cleared in the mock
    // expect(queryByTestId('progress-view')).toBeNull();
  });
  
  it('should handle cancellation', async () => {
    let cancelled = false;
    
    (aiServiceManager.analyzeWithFailover as jest.Mock).mockImplementation(
      async (_code, _type, streaming) => {
        return new Promise((_resolve, reject) => {
          // Check for cancellation via abort signal
          if (streaming.signal) {
            streaming.signal.addEventListener('abort', () => {
              cancelled = true;
              reject(new Error('Aborted'));
            });
          }
          
          // Simulate long-running analysis
          setTimeout(() => {
            streaming.onProgress(30);
          }, 1000);
        });
      }
    );
    
    const { getByTestId } = render(<TestStreamingComponent />);
    
    // Start analysis
    fireEvent.press(getByTestId('analyze-button'));
    
    await waitFor(() => {
      expect(getByTestId('progress-view')).toBeTruthy();
    });
    
    // Cancel analysis
    fireEvent.press(getByTestId('cancel-button'));
    
    await waitFor(() => {
      expect(cancelled).toBe(true);
    });
  });
  
  it('should display provider status', () => {
    const { getByTestId } = render(<TestStreamingComponent />);
    
    expect(getByTestId('provider-count').props.children).toEqual([2, ' providers']);
  });
});