import { createStore } from 'solid-js/store';

export interface AnalysisFile {
  id: string;
  name: string;
  size: number;
  hash: string;
  type: string;
  uploadedAt: Date;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  results?: AnalysisResults;
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

interface AnalysisStore {
  files: AnalysisFile[];
  activeFileId: string | null;
  isAnalyzing: boolean;
}

const [store, setStore] = createStore<AnalysisStore>({
  files: [],
  activeFileId: null,
  isAnalyzing: false,
});

export const analysisStore = {
  state: store,
  
  addFile(file: Omit<AnalysisFile, 'id' | 'uploadedAt' | 'status'>) {
    const newFile: AnalysisFile = {
      ...file,
      id: crypto.randomUUID(),
      uploadedAt: new Date(),
      status: 'pending',
    };
    setStore('files', files => [...files, newFile]);
    return newFile.id;
  },
  
  setActiveFile(fileId: string) {
    setStore('activeFileId', fileId);
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
};