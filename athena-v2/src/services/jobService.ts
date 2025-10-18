import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface Job {
  id: string;
  workflow_type: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  input: any;
  output?: any;
  error?: string;
  logs: LogEntry[];
}

export interface LogEntry {
  timestamp: string;
  level: 'Info' | 'Warning' | 'Error';
  message: string;
}

export interface ProgressUpdate {
  job_id: string;
  progress: number;
  message: string;
}

class JobService {
  private progressListeners = new Map<string, (update: ProgressUpdate) => void>();

  constructor() {
    // Listen for progress updates from backend
    listen<ProgressUpdate>('job-progress', (event) => {
      const update = event.payload;
      const listener = this.progressListeners.get(update.job_id);
      if (listener) {
        listener(update);
      }
    });
  }

  async startJob(workflowType: string, input: any): Promise<string> {
    return await invoke<string>('start_job', { workflowType, input });
  }

  async getJobStatus(jobId: string): Promise<Job> {
    return await invoke<Job>('get_job_status', { jobId });
  }

  async listJobs(status?: string, limit?: number): Promise<Job[]> {
    return await invoke<Job[]>('list_jobs', { status, limit });
  }

  async cancelJob(jobId: string): Promise<void> {
    await invoke('cancel_job', { jobId });
  }

  async deleteJob(jobId: string): Promise<void> {
    await invoke('delete_job', { jobId });
  }

  async getActiveJobs(): Promise<Job[]> {
    return await invoke<Job[]>('get_active_jobs');
  }

  onProgress(jobId: string, callback: (update: ProgressUpdate) => void): () => void {
    this.progressListeners.set(jobId, callback);

    // Return unsubscribe function
    return () => {
      this.progressListeners.delete(jobId);
    };
  }
}

export const jobService = new JobService();
