import { emit, listen } from '@tauri-apps/api/event';
import { analysisStore } from '../stores/analysisStore';

export interface ProgressUpdate {
  fileId: string;
  analysisType: 'static' | 'dynamic' | 'ai' | 'yara' | 'wasm';
  phase: string;
  progress: number;
  message: string;
  details?: any;
  estimatedTimeRemaining?: number;
}

export interface StreamingResult {
  fileId: string;
  analysisType: string;
  chunk: any;
  isComplete: boolean;
}

class ProgressTracker {
  private listeners: Map<string, Function[]> = new Map();
  private progressHistory: Map<string, ProgressUpdate[]> = new Map();
  private startTimes: Map<string, number> = new Map();
  private estimatedDurations: Map<string, number> = new Map();

  constructor() {
    this.setupEventListeners();
    this.initializeEstimates();
  }

  private initializeEstimates() {
    // Initial time estimates for different analysis types (in ms)
    this.estimatedDurations.set('static', 5000);
    this.estimatedDurations.set('yara', 8000);
    this.estimatedDurations.set('wasm', 15000);
    this.estimatedDurations.set('ai', 30000);
    this.estimatedDurations.set('dynamic', 60000);
  }

  private setupEventListeners() {
    // Listen for progress updates from backend
    listen<ProgressUpdate>('analysis-progress', (event) => {
      this.handleProgressUpdate(event.payload);
    });

    // Listen for streaming results
    listen<StreamingResult>('analysis-stream', (event) => {
      this.handleStreamingResult(event.payload);
    });

    // Listen for analysis phase changes
    listen<{fileId: string, phase: string}>('analysis-phase', (event) => {
      this.handlePhaseChange(event.payload);
    });
  }

  private handleProgressUpdate(update: ProgressUpdate) {
    // Store in history
    const key = `${update.fileId}-${update.analysisType}`;
    if (!this.progressHistory.has(key)) {
      this.progressHistory.set(key, []);
    }
    this.progressHistory.get(key)!.push(update);

    // Update estimated time
    if (update.progress > 0) {
      this.updateTimeEstimate(update);
    }

    // Update store
    analysisStore.updateProgress({
      [`${update.analysisType}Analysis`]: {
        status: 'running',
        progress: update.progress,
        phase: update.phase,
        message: update.message,
        estimatedTimeRemaining: update.estimatedTimeRemaining
      }
    });

    // Notify listeners
    this.notifyListeners(update.fileId, update);
  }

  private handleStreamingResult(result: StreamingResult) {
    // Append streaming data to store
    const currentResults = analysisStore.state.streamingResults || {};
    const fileResults = currentResults[result.fileId] || {};
    const typeResults = fileResults[result.analysisType] || [];
    
    typeResults.push(result.chunk);
    
    analysisStore.updateStreamingResults({
      ...currentResults,
      [result.fileId]: {
        ...fileResults,
        [result.analysisType]: typeResults
      }
    });

    if (result.isComplete) {
      // Mark analysis as complete
      analysisStore.updateProgress({
        [`${result.analysisType}Analysis`]: {
          status: 'completed',
          progress: 100
        }
      });
    }
  }

  private handlePhaseChange(data: {fileId: string, phase: string}) {
    // Emit custom event for UI updates
    emit('ui-phase-change', data);
  }

  private updateTimeEstimate(update: ProgressUpdate) {
    const key = `${update.fileId}-${update.analysisType}`;
    const startTime = this.startTimes.get(key);
    
    if (!startTime) {
      this.startTimes.set(key, Date.now());
      return;
    }

    const elapsed = Date.now() - startTime;
    const estimatedTotal = elapsed / (update.progress / 100);
    const remaining = estimatedTotal - elapsed;

    // Update estimate for future use
    this.estimatedDurations.set(update.analysisType, estimatedTotal);

    // Add to update
    update.estimatedTimeRemaining = Math.max(0, Math.round(remaining));
  }

  // Public API

  startAnalysis(fileId: string, analysisType: string) {
    const key = `${fileId}-${analysisType}`;
    this.startTimes.set(key, Date.now());
    
    this.emitProgress({
      fileId,
      analysisType: analysisType as any,
      phase: 'initializing',
      progress: 0,
      message: `Starting ${analysisType} analysis...`,
      estimatedTimeRemaining: this.estimatedDurations.get(analysisType)
    });
  }

  updateProgress(
    fileId: string, 
    analysisType: string, 
    progress: number, 
    phase: string, 
    message: string,
    details?: any
  ) {
    this.emitProgress({
      fileId,
      analysisType: analysisType as any,
      phase,
      progress,
      message,
      details
    });
  }

  completeAnalysis(fileId: string, analysisType: string, result: any) {
    const key = `${fileId}-${analysisType}`;
    const startTime = this.startTimes.get(key);
    
    if (startTime) {
      const duration = Date.now() - startTime;
      // Update average estimate
      const currentEstimate = this.estimatedDurations.get(analysisType) || duration;
      this.estimatedDurations.set(analysisType, (currentEstimate + duration) / 2);
    }

    this.emitProgress({
      fileId,
      analysisType: analysisType as any,
      phase: 'completed',
      progress: 100,
      message: `${analysisType} analysis completed`,
      details: result
    });

    // Clean up
    this.startTimes.delete(key);
    this.progressHistory.delete(key);
  }

  emitProgress(update: ProgressUpdate) {
    // Emit to backend
    emit('progress-update', update);
    
    // Handle locally
    this.handleProgressUpdate(update);
  }

  streamResult(fileId: string, analysisType: string, chunk: any, isComplete = false) {
    const result: StreamingResult = {
      fileId,
      analysisType,
      chunk,
      isComplete
    };

    // Emit to backend
    emit('stream-result', result);
    
    // Handle locally
    this.handleStreamingResult(result);
  }

  // Subscribe to progress updates for a specific file
  subscribe(fileId: string, callback: (update: ProgressUpdate) => void): () => void {
    if (!this.listeners.has(fileId)) {
      this.listeners.set(fileId, []);
    }
    
    this.listeners.get(fileId)!.push(callback);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(fileId);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  private notifyListeners(fileId: string, update: ProgressUpdate) {
    const listeners = this.listeners.get(fileId);
    if (listeners) {
      listeners.forEach(callback => callback(update));
    }
  }

  // Get current progress for all analyses of a file
  getProgress(fileId: string): Record<string, number> {
    const progress: Record<string, number> = {};
    
    ['static', 'yara', 'wasm', 'ai', 'dynamic'].forEach(type => {
      const key = `${fileId}-${type}`;
      const history = this.progressHistory.get(key);
      if (history && history.length > 0) {
        progress[type] = history[history.length - 1].progress;
      } else {
        progress[type] = 0;
      }
    });

    return progress;
  }

  // Get estimated total time for file analysis
  getEstimatedTotalTime(analysisTypes: string[]): number {
    return analysisTypes.reduce((total, type) => {
      return total + (this.estimatedDurations.get(type) || 10000);
    }, 0);
  }

  // Format time for display
  formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}h ${remainingMinutes}m`;
  }

  // Batch progress updates for performance
  private batchedUpdates: Map<string, ProgressUpdate> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;

  batchProgressUpdate(update: ProgressUpdate) {
    const key = `${update.fileId}-${update.analysisType}`;
    this.batchedUpdates.set(key, update);

    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatchedUpdates();
      }, 100); // Batch updates every 100ms
    }
  }

  private flushBatchedUpdates() {
    this.batchedUpdates.forEach(update => {
      this.handleProgressUpdate(update);
    });
    
    this.batchedUpdates.clear();
    this.batchTimer = null;
  }
}

export const progressTracker = new ProgressTracker();