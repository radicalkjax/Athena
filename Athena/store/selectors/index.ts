import { shallow } from 'zustand/shallow';
import { AppState } from '../types';
import { useAppStore } from '../index';

// Performance-optimized selectors using shallow equality

// Analysis selectors
export const useAnalysisState = () => useAppStore(
  (state) => ({
    isAnalyzing: state.isAnalyzing,
    analysisResults: state.analysisResults,
    selectedResultId: state.selectedResultId,
  }),
  shallow
);

export const useAnalysisActions = () => useAppStore(
  (state) => ({
    setIsAnalyzing: state.setIsAnalyzing,
    addAnalysisResult: state.addAnalysisResult,
    selectAnalysisResult: state.selectAnalysisResult,
    clearAnalysisResults: state.clearAnalysisResults,
  }),
  shallow
);

// AI Model selectors
export const useAIModelState = () => useAppStore(
  (state) => ({
    aiModels: state.aiModels,
    selectedModelId: state.selectedModelId,
  }),
  shallow
);

export const useAIModelActions = () => useAppStore(
  (state) => ({
    setAIModels: state.setAIModels,
    selectAIModel: state.selectAIModel,
  }),
  shallow
);

// Container selectors
export const useContainerState = () => useAppStore(
  (state) => ({
    containers: state.containers,
  }),
  shallow
);

export const useContainerActions = () => useAppStore(
  (state) => ({
    addContainer: state.addContainer,
    updateContainer: state.updateContainer,
    removeContainer: state.removeContainer,
  }),
  shallow
);

// Malware selectors
export const useMalwareState = () => useAppStore(
  (state) => ({
    malwareFiles: state.malwareFiles,
    selectedMalwareId: state.selectedMalwareId,
  }),
  shallow
);

export const useMalwareActions = () => useAppStore(
  (state) => ({
    addMalwareFile: state.addMalwareFile,
    removeMalwareFile: state.removeMalwareFile,
    selectMalwareFile: state.selectMalwareFile,
    clearMalwareFiles: state.clearMalwareFiles,
  }),
  shallow
);

// Computed selectors
export const useSelectedAnalysisResult = () => useAppStore(
  (state) => state.analysisResults.find(r => r.id === state.selectedResultId)
);

export const useSelectedAIModel = () => useAppStore(
  (state) => state.aiModels.find(m => m.id === state.selectedModelId)
);

export const useSelectedMalwareFile = () => useAppStore(
  (state) => state.malwareFiles.find(f => f.id === state.selectedMalwareId)
);

// Performance selectors for lists
export const useAnalysisResultsCount = () => useAppStore(
  (state) => state.analysisResults.length
);

export const useContainersCount = () => useAppStore(
  (state) => state.containers.length
);

export const useMalwareFilesCount = () => useAppStore(
  (state) => state.malwareFiles.length
);