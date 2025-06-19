import { vi } from 'vitest';

// Mock useAppStore implementation
export const useAppStore = vi.fn(() => ({
  // Analysis state
  isAnalyzing: false,
  analysisProgress: null,
  streamingAnalysisId: null,
  analysisResults: [],
  
  // Analysis actions
  startStreamingAnalysis: vi.fn(),
  setAnalysisProgress: vi.fn(),
  addAnalysisResult: vi.fn(),
  setIsAnalyzing: vi.fn(),
  clearAnalysisProgress: vi.fn(),
  
  // App state
  theme: 'light',
  isOnline: true,
  
  // Other common store methods
  setTheme: vi.fn(),
  setOnlineStatus: vi.fn()
}));

// Reset function for tests
export const resetAppStore = () => {
  const mockStore = useAppStore();
  if (mockStore && typeof mockStore === 'object') {
    Object.values(mockStore).forEach(value => {
      if (typeof value === 'function' && value.mockClear) {
        value.mockClear();
      }
    });
  }
};