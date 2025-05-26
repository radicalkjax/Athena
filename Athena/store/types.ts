import { StateCreator } from 'zustand';
import { AnalysisResult, AIModel, Container, MalwareFile } from '@/types';

// Analysis slice types
export interface AnalysisSlice {
  isAnalyzing: boolean;
  analysisResults: AnalysisResult[];
  selectedResultId: string | null;
  setIsAnalyzing: (isAnalyzing: boolean) => void;
  addAnalysisResult: (result: AnalysisResult) => void;
  selectAnalysisResult: (id: string | null) => void;
  clearAnalysisResults: () => void;
}

// AI Models slice types
export interface AIModelSlice {
  aiModels: AIModel[];
  selectedModelId: string | null;
  setAIModels: (models: AIModel[]) => void;
  selectAIModel: (id: string | null) => void;
}

// Container slice types
export interface ContainerSlice {
  containers: Container[];
  addContainer: (container: Container) => void;
  updateContainer: (id: string, container: Partial<Container>) => void;
  removeContainer: (id: string) => void;
}

// Malware Files slice types
export interface MalwareSlice {
  malwareFiles: MalwareFile[];
  selectedMalwareId: string | null;
  addMalwareFile: (file: MalwareFile) => void;
  removeMalwareFile: (id: string) => void;
  selectMalwareFile: (id: string | null) => void;
  clearMalwareFiles: () => void;
}

// Combined store type
export type AppState = AnalysisSlice & AIModelSlice & ContainerSlice & MalwareSlice;

// Slice creators
export type AnalysisSliceCreator = StateCreator<
  AppState,
  [],
  [],
  AnalysisSlice
>;

export type AIModelSliceCreator = StateCreator<
  AppState,
  [],
  [],
  AIModelSlice
>;

export type ContainerSliceCreator = StateCreator<
  AppState,
  [],
  [],
  ContainerSlice
>;

export type MalwareSliceCreator = StateCreator<
  AppState,
  [],
  [],
  MalwareSlice
>;