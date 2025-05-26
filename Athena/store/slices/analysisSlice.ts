import { AnalysisResult } from '@/types';
import { AnalysisSliceCreator } from '../types';

export const createAnalysisSlice: AnalysisSliceCreator = (set) => ({
  isAnalyzing: false,
  analysisResults: [],
  selectedResultId: null,
  
  setIsAnalyzing: (isAnalyzing: boolean) => set({ isAnalyzing }),
  
  addAnalysisResult: (result: AnalysisResult) => 
    set((state) => ({ 
      analysisResults: [...state.analysisResults, result] 
    })),
  
  selectAnalysisResult: (id: string | null) => 
    set({ selectedResultId: id }),
  
  clearAnalysisResults: () => 
    set({ analysisResults: [], selectedResultId: null }),
});