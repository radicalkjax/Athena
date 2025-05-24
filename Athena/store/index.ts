import { create } from 'zustand';
import { AnalysisResult, AIModel, Container, MalwareFile } from '@/types';

interface AppState {
  // Analysis state
  isAnalyzing: boolean;
  analysisResults: AnalysisResult[];
  selectedResultId: string | null;
  
  // AI Models state
  aiModels: AIModel[];
  selectedModelId: string | null;
  
  // Container state
  containers: Container[];
  
  // Malware Files state
  malwareFiles: MalwareFile[];
  selectedMalwareId: string | null;
  
  // Actions
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  addAnalysisResult: (result: AnalysisResult) => void;
  selectAnalysisResult: (id: string | null) => void;
  clearAnalysisResults: () => void;
  
  // AI Model actions
  setAIModels: (models: AIModel[]) => void;
  selectAIModel: (id: string | null) => void;
  
  // Container actions
  addContainer: (container: Container) => void;
  updateContainer: (id: string, container: Partial<Container>) => void;
  removeContainer: (id: string) => void;
  
  // Malware File actions
  addMalwareFile: (file: MalwareFile) => void;
  removeMalwareFile: (id: string) => void;
  selectMalwareFile: (id: string | null) => void;
  clearMalwareFiles: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  isAnalyzing: false,
  analysisResults: [],
  selectedResultId: null,
  aiModels: [],
  selectedModelId: null,
  containers: [],
  malwareFiles: [],
  selectedMalwareId: null,
  
  // Actions
  setIsAnalyzing: (isAnalyzing: boolean) => set({ isAnalyzing }),
  
  addAnalysisResult: (result: AnalysisResult) => 
    set((state) => ({ 
      analysisResults: [...state.analysisResults, result] 
    })),
  
  selectAnalysisResult: (id: string | null) => 
    set({ selectedResultId: id }),
  
  clearAnalysisResults: () => 
    set({ analysisResults: [], selectedResultId: null }),
  
  // AI Model actions
  setAIModels: (models: AIModel[]) => 
    set({ aiModels: models }),
  
  selectAIModel: (id: string | null) => 
    set({ selectedModelId: id }),
  
  // Container actions
  addContainer: (container: Container) => 
    set((state) => ({ 
      containers: [...state.containers, container] 
    })),
  
  updateContainer: (id: string, updates: Partial<Container>) => 
    set((state) => ({
      containers: state.containers.map(container => 
        container.id === id ? { ...container, ...updates } : container
      )
    })),
  
  removeContainer: (id: string) => 
    set((state) => ({
      containers: state.containers.filter(container => container.id !== id)
    })),
  
  // Malware File actions
  addMalwareFile: (file: MalwareFile) => 
    set((state) => ({ 
      malwareFiles: [...state.malwareFiles, file] 
    })),
  
  removeMalwareFile: (id: string) => 
    set((state) => ({
      malwareFiles: state.malwareFiles.filter(file => file.id !== id)
    })),
  
  selectMalwareFile: (id: string | null) => 
    set({ selectedMalwareId: id }),
  
  clearMalwareFiles: () => 
    set({ malwareFiles: [], selectedMalwareId: null }),
}));
