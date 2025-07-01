import { createContext, useContext, createSignal, Component, JSX } from 'solid-js';
import { createStore } from 'solid-js/store';

export interface AnalysisFile {
  name: string;
  path: string;
  size: number;
  type: string;
  hash?: string;
  uploadedAt: Date;
}

export interface AnalysisResult {
  id: string;
  timestamp: Date;
  type: 'static' | 'dynamic' | 'memory' | 'network' | 'yara' | 'ai';
  status: 'pending' | 'processing' | 'completed' | 'error';
  data?: any;
  error?: string;
}

export interface AnalysisProgress {
  stage: string;
  progress: number;
  message: string;
}

interface AnalysisContextValue {
  // Current file being analyzed
  currentFile: AnalysisFile | null;
  setCurrentFile: (file: AnalysisFile | null) => void;
  
  // Analysis results
  results: AnalysisResult[];
  addResult: (result: AnalysisResult) => void;
  updateResult: (id: string, update: Partial<AnalysisResult>) => void;
  clearResults: () => void;
  
  // Analysis progress tracking
  progress: AnalysisProgress | null;
  setProgress: (progress: AnalysisProgress | null) => void;
  
  // Analysis state
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  
  // Selected analysis types
  selectedAnalyses: Set<string>;
  toggleAnalysis: (type: string) => void;
  
  // AI ensemble state
  ensembleMode: 'single' | 'ensemble' | 'sequential' | 'specialized';
  setEnsembleMode: (mode: 'single' | 'ensemble' | 'sequential' | 'specialized') => void;
  
  // Selected AI providers
  selectedProviders: Set<string>;
  toggleProvider: (provider: string) => void;
}

const AnalysisContext = createContext<AnalysisContextValue>();

export const AnalysisProvider: Component<{ children: JSX.Element }> = (props) => {
  const [currentFile, setCurrentFile] = createSignal<AnalysisFile | null>(null);
  const [results, setResults] = createStore<AnalysisResult[]>([]);
  const [progress, setProgress] = createSignal<AnalysisProgress | null>(null);
  const [isAnalyzing, setIsAnalyzing] = createSignal(false);
  const [selectedAnalyses, setSelectedAnalyses] = createSignal(new Set<string>(['static', 'dynamic', 'ai']));
  const [ensembleMode, setEnsembleMode] = createSignal<'single' | 'ensemble' | 'sequential' | 'specialized'>('ensemble');
  const [selectedProviders, setSelectedProviders] = createSignal(new Set<string>(['openai', 'claude', 'deepseek']));

  const addResult = (result: AnalysisResult) => {
    setResults([...results, result]);
  };

  const updateResult = (id: string, update: Partial<AnalysisResult>) => {
    setResults(
      results.map(r => r.id === id ? { ...r, ...update } : r)
    );
  };

  const clearResults = () => {
    setResults([]);
  };

  const toggleAnalysis = (type: string) => {
    const current = selectedAnalyses();
    const newSet = new Set(current);
    if (newSet.has(type)) {
      newSet.delete(type);
    } else {
      newSet.add(type);
    }
    setSelectedAnalyses(newSet);
  };

  const toggleProvider = (provider: string) => {
    const current = selectedProviders();
    const newSet = new Set(current);
    if (newSet.has(provider)) {
      newSet.delete(provider);
    } else {
      newSet.add(provider);
    }
    setSelectedProviders(newSet);
  };

  const value: AnalysisContextValue = {
    currentFile: currentFile(),
    setCurrentFile,
    results,
    addResult,
    updateResult,
    clearResults,
    progress: progress(),
    setProgress,
    isAnalyzing: isAnalyzing(),
    setIsAnalyzing,
    selectedAnalyses: selectedAnalyses(),
    toggleAnalysis,
    ensembleMode: ensembleMode(),
    setEnsembleMode,
    selectedProviders: selectedProviders(),
    toggleProvider,
  };

  return (
    <AnalysisContext.Provider value={value}>
      {props.children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysisContext = () => {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysisContext must be used within AnalysisProvider');
  }
  return context;
};