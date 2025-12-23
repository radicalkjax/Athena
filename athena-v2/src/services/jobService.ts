import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  isObject,
  isArray,
  validateString,
  validateNumber,
  validateEnum,
  ValidationError,
} from '../utils/responseValidation';

export interface Job {
  id: string;
  workflow_type: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed' | 'Cancelled';
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  logs: LogEntry[];
}

/**
 * SECURITY: Validate Job response from backend
 * Ensures the response matches expected structure to prevent type confusion
 */
function validateJobResponse(value: unknown): Job {
  if (!isObject(value)) {
    throw new ValidationError('job', 'object', typeof value);
  }

  const statusValues = ['Pending', 'Running', 'Completed', 'Failed', 'Cancelled'] as const;

  return {
    id: validateString(value.id, 'job.id'),
    workflow_type: validateString(value.workflow_type, 'job.workflow_type'),
    status: validateEnum(value.status, 'job.status', statusValues),
    progress: validateNumber(value.progress, 'job.progress'),
    created_at: validateString(value.created_at, 'job.created_at'),
    started_at: typeof value.started_at === 'string' ? value.started_at : undefined,
    completed_at: typeof value.completed_at === 'string' ? value.completed_at : undefined,
    input: isObject(value.input) ? value.input : {},
    output: isObject(value.output) ? value.output : undefined,
    error: typeof value.error === 'string' ? value.error : undefined,
    logs: isArray(value.logs) ? validateLogEntries(value.logs) : [],
  };
}

/**
 * Validate array of LogEntry objects
 */
function validateLogEntries(logs: unknown[]): LogEntry[] {
  const levelValues = ['Info', 'Warning', 'Error'] as const;

  return logs.map((entry, i) => {
    if (!isObject(entry)) {
      throw new ValidationError(`logs[${i}]`, 'object', typeof entry);
    }
    return {
      timestamp: validateString(entry.timestamp, `logs[${i}].timestamp`),
      level: validateEnum(entry.level, `logs[${i}].level`, levelValues),
      message: validateString(entry.message, `logs[${i}].message`),
    };
  });
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

  async startJob(workflowType: string, input: Record<string, unknown>): Promise<string> {
    try {
      const response = await invoke<unknown>('start_job', { workflowType, input });
      // Validate response is a string (job ID)
      if (typeof response !== 'string') {
        throw new ValidationError('startJob.response', 'string', typeof response);
      }
      return response;
    } catch (error) {
      console.error('Failed to start job:', error);
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<Job> {
    try {
      const response = await invoke<unknown>('get_job_status', { jobId });
      // SECURITY: Validate response structure
      return validateJobResponse(response);
    } catch (error) {
      console.error('Failed to get job status:', error);
      throw error;
    }
  }

  async listJobs(status?: string, limit?: number): Promise<Job[]> {
    try {
      const response = await invoke<unknown>('list_jobs', { status, limit });
      // SECURITY: Validate response is array of Jobs
      if (!isArray(response)) {
        throw new ValidationError('listJobs.response', 'array', typeof response);
      }
      return response.map((item, i) => {
        try {
          return validateJobResponse(item);
        } catch (e) {
          throw new ValidationError(`listJobs[${i}]`, 'Job', typeof item);
        }
      });
    } catch (error) {
      console.error('Failed to list jobs:', error);
      throw error;
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    try {
      await invoke('cancel_job', { jobId });
    } catch (error) {
      console.error('Failed to cancel job:', error);
      throw error;
    }
  }

  async deleteJob(jobId: string): Promise<void> {
    try {
      await invoke('delete_job', { jobId });
    } catch (error) {
      console.error('Failed to delete job:', error);
      throw error;
    }
  }

  async getActiveJobs(): Promise<Job[]> {
    try {
      const response = await invoke<unknown>('get_active_jobs');
      // SECURITY: Validate response is array of Jobs
      if (!isArray(response)) {
        throw new ValidationError('getActiveJobs.response', 'array', typeof response);
      }
      return response.map((item, i) => {
        try {
          return validateJobResponse(item);
        } catch (e) {
          throw new ValidationError(`getActiveJobs[${i}]`, 'Job', typeof item);
        }
      });
    } catch (error) {
      console.error('Failed to get active jobs:', error);
      throw error;
    }
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
