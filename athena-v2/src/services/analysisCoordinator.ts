import { analysisStore } from '../stores/analysisStore';
import { aiService } from './aiService';
import { memoryManager } from './memoryManager';
import { invokeCommand } from '../utils/tauriCompat';
import { progressTracker } from './progressTracker';
import type { AnalysisFile } from '../stores/analysisStore';
import type { AIAnalysisRequest } from '../types/ai';

interface AnalysisTask {
  id: string;
  fileId: string;
  type: 'static' | 'dynamic' | 'ai' | 'yara' | 'wasm';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
  result?: any;
  error?: Error;
}

interface BulkheadConfig {
  maxConcurrent: number;
  queueSize: number;
  timeout: number;
}

class AnalysisCoordinator {
  private tasks: Map<string, AnalysisTask> = new Map();
  private queues: Map<string, AnalysisTask[]> = new Map();
  private activeCount: Map<string, number> = new Map();
  private bulkheads: Map<string, BulkheadConfig> = new Map();
  private cancellationTokens: Map<string, AbortController> = new Map();

  constructor() {
    this.initializeBulkheads();
  }

  private initializeBulkheads() {
    // Configure bulkheads for different analysis types
    this.bulkheads.set('static', {
      maxConcurrent: 3,
      queueSize: 10,
      timeout: 30000 // 30s
    });

    this.bulkheads.set('dynamic', {
      maxConcurrent: 1, // Sandbox analysis is resource intensive
      queueSize: 5,
      timeout: 300000 // 5m
    });

    this.bulkheads.set('ai', {
      maxConcurrent: 2, // Rate limit AI providers
      queueSize: 20,
      timeout: 60000 // 1m
    });

    this.bulkheads.set('yara', {
      maxConcurrent: 2,
      queueSize: 10,
      timeout: 45000 // 45s
    });

    this.bulkheads.set('wasm', {
      maxConcurrent: 2,
      queueSize: 10,
      timeout: 60000 // 1m
    });

    // Initialize queues and counters
    for (const [type] of this.bulkheads) {
      this.queues.set(type, []);
      this.activeCount.set(type, 0);
    }
  }

  async analyzeFile(file: AnalysisFile): Promise<void> {
    // Start all analysis types
    const analysisTypes = ['static', 'yara', 'wasm', 'ai'] as const;
    
    for (const type of analysisTypes) {
      const task: AnalysisTask = {
        id: `${file.id}-${type}-${Date.now()}`,
        fileId: file.id,
        type,
        status: 'pending'
      };

      this.tasks.set(task.id, task);
      await this.enqueueTask(task);
    }

    // Update progress tracking
    analysisStore.startAnalysis(file.id);
  }

  private async enqueueTask(task: AnalysisTask) {
    const queue = this.queues.get(task.type);
    const bulkhead = this.bulkheads.get(task.type);
    
    if (!queue || !bulkhead) {
      throw new Error(`Invalid task type: ${task.type}`);
    }

    // Check if we can run immediately
    const active = this.activeCount.get(task.type) || 0;
    
    if (active < bulkhead.maxConcurrent) {
      this.runTask(task);
    } else if (queue.length < bulkhead.queueSize) {
      queue.push(task);
    } else {
      // Queue is full, reject task
      task.status = 'failed';
      task.error = new Error('Analysis queue is full');
      this.handleTaskCompletion(task);
    }
  }

  private async runTask(task: AnalysisTask) {
    const bulkhead = this.bulkheads.get(task.type)!;
    const abortController = new AbortController();
    this.cancellationTokens.set(task.id, abortController);

    // Increment active count
    this.activeCount.set(task.type, (this.activeCount.get(task.type) || 0) + 1);

    // Update task status
    task.status = 'running';
    task.startTime = Date.now();

    // Set timeout
    const timeoutId = setTimeout(() => {
      if (task.status === 'running') {
        abortController.abort();
        task.status = 'failed';
        task.error = new Error(`Analysis timed out after ${bulkhead.timeout}ms`);
        this.handleTaskCompletion(task);
      }
    }, bulkhead.timeout);

    try {
      // Execute analysis based on type
      const result = await this.executeAnalysis(task, abortController.signal);
      
      clearTimeout(timeoutId);
      
      if (!abortController.signal.aborted) {
        task.status = 'completed';
        task.result = result;
        task.endTime = Date.now();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (!abortController.signal.aborted) {
        task.status = 'failed';
        task.error = error as Error;
        task.endTime = Date.now();
      }
    } finally {
      this.cancellationTokens.delete(task.id);
      this.handleTaskCompletion(task);
    }
  }

  private async executeAnalysis(task: AnalysisTask, signal: AbortSignal): Promise<any> {
    const file = analysisStore.state.files.find(f => f.id === task.fileId);
    if (!file) {
      throw new Error('File not found');
    }

    // Update progress
    const progressKey = `${task.type}Analysis` as any;
    analysisStore.updateProgress({
      [progressKey]: {
        status: 'running',
        progress: 0
      }
    });

    switch (task.type) {
      case 'static':
        return this.executeStaticAnalysis(file, signal);
      
      case 'yara':
        return this.executeYaraAnalysis(file, signal);
      
      case 'wasm':
        return this.executeWasmAnalysis(file, signal);
      
      case 'ai':
        return this.executeAIAnalysis(file, signal);
      
      default:
        throw new Error(`Unknown analysis type: ${task.type}`);
    }
  }

  private async executeStaticAnalysis(file: AnalysisFile, signal: AbortSignal) {
    // This is already done in the backend, but we can enhance it
    if (file.analysisResult) {
      return file.analysisResult;
    }

    // Start progress tracking
    progressTracker.startAnalysis(file.id, 'static');

    // Phase 1: File reading
    progressTracker.updateProgress(file.id, 'static', 10, 'reading', 'Reading file contents...');

    const result = await invokeCommand('analyze_file', { 
      filePath: file.path 
    });

    // Phase 2: Analysis complete
    progressTracker.updateProgress(file.id, 'static', 90, 'analyzing', 'Analyzing file structure...');

    // Complete
    progressTracker.completeAnalysis(file.id, 'static', result);

    return result;
  }

  private async executeYaraAnalysis(file: AnalysisFile, signal: AbortSignal) {
    progressTracker.startAnalysis(file.id, 'yara');
    
    // Phase 1: Loading rules
    progressTracker.updateProgress(file.id, 'yara', 20, 'loading-rules', 'Loading YARA rules...');
    
    // Phase 2: Scanning
    progressTracker.updateProgress(file.id, 'yara', 50, 'scanning', 'Scanning file with YARA rules...');
    
    const result = await invokeCommand('scan_file_with_yara', { 
      filePath: file.path 
    });
    
    // Phase 3: Processing matches
    progressTracker.updateProgress(file.id, 'yara', 80, 'processing', 'Processing rule matches...');
    
    progressTracker.completeAnalysis(file.id, 'yara', result);
    return result;
  }

  private async executeWasmAnalysis(file: AnalysisFile, signal: AbortSignal) {
    progressTracker.startAnalysis(file.id, 'wasm');
    
    // Phase 1: Loading WASM modules
    progressTracker.updateProgress(file.id, 'wasm', 10, 'loading', 'Loading WASM security modules...');
    
    // Simulate streaming results for each module
    const modules = ['analysis-engine', 'crypto', 'deobfuscator', 'file-processor', 'pattern-matcher'];
    
    for (let i = 0; i < modules.length; i++) {
      const progress = 10 + (i * 15);
      progressTracker.updateProgress(
        file.id, 
        'wasm', 
        progress, 
        'analyzing', 
        `Running ${modules[i]} module...`
      );
      
      // Small delay to show progress
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const result = await invokeCommand('analyze_file_with_wasm', { 
      filePath: file.path 
    });
    
    // Stream partial results
    if (result.wasm_analyses) {
      for (const analysis of result.wasm_analyses) {
        progressTracker.streamResult(file.id, 'wasm', analysis, false);
      }
    }
    
    progressTracker.completeAnalysis(file.id, 'wasm', result);
    return result;
  }

  private async executeAIAnalysis(file: AnalysisFile, signal: AbortSignal) {
    progressTracker.startAnalysis(file.id, 'ai');
    
    const request: AIAnalysisRequest = {
      fileHash: file.hash,
      fileName: file.name,
      filePath: file.path,
      fileSize: file.size,
      fileType: file.type,
      providers: ['claude', 'gpt4', 'deepseek', 'gemini', 'mistral', 'llama'],
      analysisType: 'comprehensive',
      priority: 'high'
    };
    
    // Phase 1: Preparing request
    progressTracker.updateProgress(file.id, 'ai', 5, 'preparing', 'Preparing AI analysis request...');
    
    // Use custom progress callback for AI service
    const progressCallback = (provider: string, progress: number) => {
      const overallProgress = 5 + (progress * 0.9); // 5-95%
      progressTracker.updateProgress(
        file.id, 
        'ai', 
        overallProgress, 
        'analyzing', 
        `Analyzing with ${provider}...`
      );
      
      // Stream individual provider results
      progressTracker.streamResult(file.id, 'ai', {
        provider,
        progress,
        timestamp: Date.now()
      }, false);
    };
    
    const result = await aiService.analyzeWithEnsemble(request, 'voting', progressCallback);
    
    // Convert to analysis results format
    const analysisResults = {
      malwareScore: result.consensus.confidence * 100,
      threats: result.consensus.signatures,
      aiAnalysis: result.individual.reduce((acc, res) => {
        acc[res.provider] = {
          score: res.confidence * 100,
          summary: `Threat Level: ${res.threatLevel}`,
          details: res.recommendations.join('\n')
        };
        return acc;
      }, {} as any)
    };
    
    // Update store with results
    analysisStore.setAnalysisResults(file.id, analysisResults);
    
    // Complete with final result
    progressTracker.completeAnalysis(file.id, 'ai', result);
    
    return result;
  }

  private handleTaskCompletion(task: AnalysisTask) {
    // Decrement active count
    const active = this.activeCount.get(task.type) || 0;
    this.activeCount.set(task.type, Math.max(0, active - 1));

    // Check if we should process next task in queue
    const queue = this.queues.get(task.type);
    if (queue && queue.length > 0) {
      const nextTask = queue.shift();
      if (nextTask) {
        this.runTask(nextTask);
      }
    }

    // Check if all tasks for this file are complete
    const fileTasks = Array.from(this.tasks.values())
      .filter(t => t.fileId === task.fileId);
    
    const allComplete = fileTasks.every(t => 
      t.status === 'completed' || t.status === 'failed'
    );

    if (allComplete) {
      // Calculate overall score
      const completedTasks = fileTasks.filter(t => t.status === 'completed');
      const scores = completedTasks
        .filter(t => t.result?.confidence)
        .map(t => t.result.confidence);
      
      const overallScore = scores.length > 0 
        ? scores.reduce((a, b) => a + b, 0) / scores.length 
        : 0;

      analysisStore.updateFileStatus(task.fileId, 'completed');
    }
  }

  cancelAnalysis(fileId: string) {
    // Cancel all tasks for this file
    const fileTasks = Array.from(this.tasks.values())
      .filter(t => t.fileId === fileId && t.status === 'running');

    for (const task of fileTasks) {
      const controller = this.cancellationTokens.get(task.id);
      if (controller) {
        controller.abort();
      }
    }

    // Remove from queues
    for (const [type, queue] of this.queues) {
      const filtered = queue.filter(t => t.fileId !== fileId);
      this.queues.set(type, filtered);
    }

    analysisStore.updateFileStatus(fileId, 'error');
  }

  getTaskStatus(fileId: string) {
    const fileTasks = Array.from(this.tasks.values())
      .filter(t => t.fileId === fileId);

    return {
      total: fileTasks.length,
      completed: fileTasks.filter(t => t.status === 'completed').length,
      failed: fileTasks.filter(t => t.status === 'failed').length,
      running: fileTasks.filter(t => t.status === 'running').length,
      pending: fileTasks.filter(t => t.status === 'pending').length,
      tasks: fileTasks
    };
  }

  getQueueStatus() {
    const status: Record<string, any> = {};

    for (const [type, queue] of this.queues) {
      status[type] = {
        queueLength: queue.length,
        activeCount: this.activeCount.get(type) || 0,
        maxConcurrent: this.bulkheads.get(type)?.maxConcurrent || 0
      };
    }

    return status;
  }

  // Resource monitoring
  getResourceUsage() {
    const totalActive = Array.from(this.activeCount.values())
      .reduce((sum, count) => sum + count, 0);

    const totalQueued = Array.from(this.queues.values())
      .reduce((sum, queue) => sum + queue.length, 0);

    return {
      activeAnalyses: totalActive,
      queuedAnalyses: totalQueued,
      memoryUsage: memoryManager.getTotalAllocated(),
      bulkheadStatus: this.getQueueStatus()
    };
  }
}

export const analysisCoordinator = new AnalysisCoordinator();