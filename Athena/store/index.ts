import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIModel, MalwareFile, AnalysisResult, Container, AppSettings } from '@/types';
import { generateId } from '@/utils/helpers';

interface AppState {
  // AI Models
  aiModels: AIModel[];
  selectedModelId: string | null;
  addAIModel: (model: Omit<AIModel, 'id'>) => void;
  updateAIModel: (id: string, updates: Partial<AIModel>) => void;
  removeAIModel: (id: string) => void;
  selectAIModel: (id: string | null) => void;
  
  // Malware Files
  malwareFiles: MalwareFile[];
  selectedMalwareId: string | null;
  addMalwareFile: (file: Omit<MalwareFile, 'id'>) => void;
  updateMalwareFile: (id: string, updates: Partial<MalwareFile>) => void;
  removeMalwareFile: (id: string) => void;
  selectMalwareFile: (id: string | null) => void;
  
  // Analysis Results
  analysisResults: AnalysisResult[];
  selectedResultId: string | null;
  addAnalysisResult: (result: Omit<AnalysisResult, 'id'>) => void;
  updateAnalysisResult: (id: string, updates: Partial<AnalysisResult>) => void;
  removeAnalysisResult: (id: string) => void;
  selectAnalysisResult: (id: string | null) => void;
  
  // Containers
  containers: Container[];
  addContainer: (container: Omit<Container, 'id'>) => void;
  updateContainer: (id: string, updates: Partial<Container>) => void;
  removeContainer: (id: string) => void;
  
  // Settings
  settings: AppSettings;
  updateSettings: (updates: Partial<AppSettings>) => void;
  
  // UI State
  isAnalyzing: boolean;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  
  // Reset
  resetStore: () => void;
}

const defaultSettings: AppSettings = {
  securityLevel: 'high',
  defaultAIModel: null,
  useLocalModelsWhenAvailable: true,
  autoDeleteResults: false,
  autoDeleteAfterDays: 30,
  theme: 'system',
};

// Default AI models
const defaultAIModels: AIModel[] = [
  {
    id: 'openai-gpt4',
    name: 'OpenAI GPT-4',
    type: 'openai',
    isLocal: false,
    description: 'OpenAI\'s GPT-4 model for advanced code analysis and deobfuscation',
    modelId: 'gpt-4-turbo',
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    type: 'claude',
    isLocal: false,
    description: 'Anthropic\'s Claude 3 Opus model for detailed malware analysis',
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    type: 'deepseek',
    isLocal: false,
    description: 'DeepSeek\'s specialized code model for deobfuscation tasks',
  },
];

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // AI Models
      aiModels: defaultAIModels,
      selectedModelId: null,
      addAIModel: (model) => set((state) => ({ 
        aiModels: [...state.aiModels, { ...model, id: generateId() }] 
      })),
      updateAIModel: (id, updates) => set((state) => ({
        aiModels: state.aiModels.map(model => 
          model.id === id ? { ...model, ...updates } : model
        )
      })),
      removeAIModel: (id) => set((state) => ({
        aiModels: state.aiModels.filter(model => model.id !== id),
        selectedModelId: state.selectedModelId === id ? null : state.selectedModelId,
      })),
      selectAIModel: (id) => set({ selectedModelId: id }),
      
      // Malware Files
      malwareFiles: [],
      selectedMalwareId: null,
      addMalwareFile: (file) => set((state) => ({ 
        malwareFiles: [...state.malwareFiles, { ...file, id: generateId() }] 
      })),
      updateMalwareFile: (id, updates) => set((state) => ({
        malwareFiles: state.malwareFiles.map(file => 
          file.id === id ? { ...file, ...updates } : file
        )
      })),
      removeMalwareFile: (id) => set((state) => ({
        malwareFiles: state.malwareFiles.filter(file => file.id !== id),
        selectedMalwareId: state.selectedMalwareId === id ? null : state.selectedMalwareId,
      })),
      selectMalwareFile: (id) => set({ selectedMalwareId: id }),
      
      // Analysis Results
      analysisResults: [],
      selectedResultId: null,
      addAnalysisResult: (result) => set((state) => ({ 
        analysisResults: [...state.analysisResults, { ...result, id: generateId() }] 
      })),
      updateAnalysisResult: (id, updates) => set((state) => ({
        analysisResults: state.analysisResults.map(result => 
          result.id === id ? { ...result, ...updates } : result
        )
      })),
      removeAnalysisResult: (id) => set((state) => ({
        analysisResults: state.analysisResults.filter(result => result.id !== id),
        selectedResultId: state.selectedResultId === id ? null : state.selectedResultId,
      })),
      selectAnalysisResult: (id) => set({ selectedResultId: id }),
      
      // Containers
      containers: [],
      addContainer: (container) => set((state) => ({ 
        containers: [...state.containers, { ...container, id: generateId() }] 
      })),
      updateContainer: (id, updates) => set((state) => ({
        containers: state.containers.map(container => 
          container.id === id ? { ...container, ...updates } : container
        )
      })),
      removeContainer: (id) => set((state) => ({
        containers: state.containers.filter(container => container.id !== id)
      })),
      
      // Settings
      settings: defaultSettings,
      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),
      
      // UI State
      isAnalyzing: false,
      setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
      
      // Reset
      resetStore: () => set({
        aiModels: defaultAIModels,
        selectedModelId: null,
        malwareFiles: [],
        selectedMalwareId: null,
        analysisResults: [],
        selectedResultId: null,
        containers: [],
        settings: defaultSettings,
        isAnalyzing: false,
      }),
    }),
    {
      name: 'athena-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        aiModels: state.aiModels,
        malwareFiles: state.malwareFiles,
        analysisResults: state.analysisResults,
        settings: state.settings,
      }),
    }
  )
);
