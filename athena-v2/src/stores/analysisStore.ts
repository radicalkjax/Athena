import { createStore } from 'solid-js/store';

export interface AnalysisFile {
  id: string;
  name: string;
  path: string;
  size: number;
  hash: string;
  type: string;
  uploadedAt: Date;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  results?: AnalysisResults;
  fileData?: Uint8Array;
  analysisResult?: any; // Raw backend analysis result
}

export interface AnalysisResults {
  malwareScore: number;
  threats: string[];
  aiAnalysis: {
    [provider: string]: {
      score: number;
      summary: string;
      details: string;
    };
  };
}

export interface AnalysisProgress {
  staticAnalysis?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    phase?: string;
    message?: string;
    estimatedTimeRemaining?: number;
    result?: any;
  };
  dynamicAnalysis?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    phase?: string;
    message?: string;
    estimatedTimeRemaining?: number;
    result?: any;
  };
  networkAnalysis?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    phase?: string;
    message?: string;
    estimatedTimeRemaining?: number;
    result?: any;
  };
  behavioralAnalysis?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    phase?: string;
    message?: string;
    estimatedTimeRemaining?: number;
    result?: any;
  };
  aiAnalysis?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    phase?: string;
    message?: string;
    estimatedTimeRemaining?: number;
    result?: any;
  };
  yaraAnalysis?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    phase?: string;
    message?: string;
    estimatedTimeRemaining?: number;
    result?: any;
  };
  wasmAnalysis?: {
    status: 'pending' | 'running' | 'completed' | 'error';
    progress: number;
    phase?: string;
    message?: string;
    estimatedTimeRemaining?: number;
    result?: any;
  };
}

interface AnalysisStore {
  files: AnalysisFile[];
  activeFileId: string | null;
  isAnalyzing: boolean;
  uploadedFile?: AnalysisFile;
  currentFile?: AnalysisFile;
  analysisProgress?: AnalysisProgress;
  streamingResults?: Record<string, Record<string, any[]>>;
}

const [store, setStore] = createStore<AnalysisStore>({
  files: [],
  activeFileId: null,
  isAnalyzing: false,
  uploadedFile: undefined,
});

export const analysisStore = {
  state: store,
  
  files: () => store.files,
  
  get currentFile() {
    return store.currentFile;
  },
  
  get analysisProgress() {
    return store.analysisProgress;
  },
  
  addFile(file: Omit<AnalysisFile, 'id' | 'uploadedAt' | 'status'>) {
    const newFile: AnalysisFile = {
      ...file,
      id: crypto.randomUUID(),
      uploadedAt: new Date(),
      status: 'pending',
    };
    setStore('files', files => [...files, newFile]);
    setStore('uploadedFile', newFile);
    setStore('currentFile', newFile);
    return newFile.id;
  },
  
  setActiveFile(fileId: string) {
    setStore('activeFileId', fileId);
    const file = store.files.find(f => f.id === fileId);
    if (file) {
      setStore('currentFile', file);
    }
  },
  
  updateFileStatus(fileId: string, status: AnalysisFile['status']) {
    setStore('files', file => file.id === fileId, 'status', status);
  },
  
  setAnalysisResults(fileId: string, results: AnalysisResults) {
    setStore('files', file => file.id === fileId, 'results', results);
  },
  
  startAnalysis(fileId: string) {
    setStore('isAnalyzing', true);
    this.updateFileStatus(fileId, 'analyzing');
  },
  
  completeAnalysis(fileId: string, results: AnalysisResults) {
    this.setAnalysisResults(fileId, results);
    this.updateFileStatus(fileId, 'completed');
    setStore('isAnalyzing', false);
  },
  
  updateProgress(progress: Partial<AnalysisProgress>) {
    setStore('analysisProgress', prev => ({ ...prev, ...progress }));
  },
  
  updateStreamingResults(results: Record<string, Record<string, any[]>>) {
    setStore('streamingResults', results);
  },

  deleteFile(fileId: string) {
    const fileIndex = store.files.findIndex(f => f.id === fileId);
    if (fileIndex === -1) return;

    // Remove the file from the array
    setStore('files', files => files.filter(f => f.id !== fileId));

    // Handle active file cleanup
    if (store.activeFileId === fileId) {
      // If there are remaining files, set the first one as active
      if (store.files.length > 1) {
        const nextFile = fileIndex > 0 ? store.files[fileIndex - 1] : store.files[0];
        if (nextFile && nextFile.id !== fileId) {
          setStore('activeFileId', nextFile.id);
          setStore('currentFile', nextFile);
        } else {
          setStore('activeFileId', null);
          setStore('currentFile', undefined);
        }
      } else {
        setStore('activeFileId', null);
        setStore('currentFile', undefined);
      }
    }

    // Clean up uploaded file reference if it matches
    if (store.uploadedFile?.id === fileId) {
      setStore('uploadedFile', undefined);
    }

    // Clean up current file reference if it matches
    if (store.currentFile?.id === fileId) {
      setStore('currentFile', undefined);
    }

    // Clear analysis progress if we're deleting the file being analyzed
    if (store.currentFile?.id === fileId && store.isAnalyzing) {
      setStore('analysisProgress', undefined);
      setStore('isAnalyzing', false);
    }

    // Clean up streaming results for this file
    if (store.streamingResults?.[fileId]) {
      setStore('streamingResults', results => {
        if (!results) return results;
        const newResults = { ...results };
        delete newResults[fileId];
        return Object.keys(newResults).length > 0 ? newResults : undefined;
      });
    }
  },

  clearAllFiles() {
    // Clear all file-related state
    setStore('files', []);
    setStore('activeFileId', null);
    setStore('uploadedFile', undefined);
    setStore('currentFile', undefined);
    setStore('analysisProgress', undefined);
    setStore('streamingResults', undefined);
    setStore('isAnalyzing', false);
  },
};