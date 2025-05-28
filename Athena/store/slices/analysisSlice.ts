import { AnalysisResult } from '@/types';
import { AnalysisSliceCreator, AnalysisProgress } from '../types';

export const createAnalysisSlice: AnalysisSliceCreator = (set) => ({
  isAnalyzing: false,
  analysisResults: [],
  selectedResultId: null,
  currentProgress: null,
  progressHistory: [],
  activeAnalysisId: null,
  
  setIsAnalyzing: (isAnalyzing: boolean) => set({ isAnalyzing }),
  
  addAnalysisResult: (result: AnalysisResult) => 
    set((state) => ({ 
      analysisResults: [...state.analysisResults, result],
      // Clear progress when analysis completes
      currentProgress: null,
      progressHistory: [],
      activeAnalysisId: null
    })),
  
  selectAnalysisResult: (id: string | null) => 
    set({ selectedResultId: id }),
  
  clearAnalysisResults: () => 
    set({ analysisResults: [], selectedResultId: null }),
  
  // Phase 7: Streaming progress methods
  setAnalysisProgress: (progress: AnalysisProgress) =>
    set((state) => ({
      currentProgress: progress,
      progressHistory: [...state.progressHistory, progress]
    })),
  
  startStreamingAnalysis: (analysisId: string) =>
    set({
      activeAnalysisId: analysisId,
      currentProgress: null,
      progressHistory: [],
      isAnalyzing: true
    }),
  
  clearAnalysisProgress: () =>
    set({
      currentProgress: null,
      progressHistory: [],
      activeAnalysisId: null
    })
});