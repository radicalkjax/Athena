/**
 * TypeScript bridge for the WASM Sandbox module
 * Provides secure execution environments for malware analysis
 */

import {
  EngineConfig,
  PerformanceMetrics,
  MAX_FILE_SIZE,
  DEFAULT_TIMEOUT
} from './types';
import { isBrowser } from './wasm-error-codes';

// WASMError class for sandbox-specific errors
export class WASMError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'WASMError';
  }
}

export const WASMErrorCode = {
  INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
  NOT_INITIALIZED: 'NOT_INITIALIZED',
  EXECUTION_ERROR: 'EXECUTION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  TIMEOUT: 'TIMEOUT',
  RESOURCE_LIMIT: 'RESOURCE_LIMIT'
} as const;

// Sandbox specific types
export interface ExecutionPolicy {
  maxMemory?: number;           // Maximum memory in bytes (default: 100MB)
  maxCpuTime?: number;          // Maximum CPU time in seconds (default: 30s)
  maxFileHandles?: number;      // Maximum open file handles (default: 10)
  allowNetwork?: boolean;       // Allow network access (default: false)
  allowFileSystem?: boolean;    // Allow file system access (default: false)
  allowedSyscalls?: string[];   // Allowed system calls (default: [])
  syscallPolicy?: 'allow_all' | 'deny_all' | 'custom';  // Syscall filtering policy
}

export interface ResourceUsage {
  memoryUsed: number;
  cpuTimeUsed: number;
  fileHandlesUsed: number;
  peakMemory: number;
  syscallCount: number;
}

export interface SecurityEvent {
  timestamp: number;
  eventType: 'syscall_blocked' | 'resource_limit' | 'memory_violation' | 'timeout';
  details: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExecutionResult {
  success: boolean;
  exitCode: number;
  output: Uint8Array;
  error?: string;
  resourceUsage: ResourceUsage;
  securityEvents: SecurityEvent[];
  executionTime: number;
}

export interface SandboxInstanceInfo {
  id: string;
  state: 'created' | 'ready' | 'running' | 'paused' | 'terminated' | 'failed';
  createdAt: number;
  resourceUsage: ResourceUsage;
  policy: ExecutionPolicy;
}

export interface SandboxSnapshot {
  instanceId: string;
  timestamp: number;
  status: string;
  memorySnapshot: Uint8Array;
  securityEvents: SecurityEvent[];
}

export class SandboxInstance {
  constructor(
    private bridge: SandboxBridge,
    public readonly id: string,
    private policy: ExecutionPolicy
  ) {}

  async execute(code: Uint8Array): Promise<ExecutionResult> {
    return this.bridge.executeInInstance(this.id, code);
  }

  getResourceUsage(): ResourceUsage {
    return this.bridge.getInstanceResourceUsage(this.id);
  }

  async terminate(): Promise<void> {
    return this.bridge.terminateInstance(this.id);
  }

  async pause(): Promise<void> {
    return this.bridge.pauseInstance(this.id);
  }

  async resume(): Promise<void> {
    return this.bridge.resumeInstance(this.id);
  }

  async createSnapshot(): Promise<SandboxSnapshot> {
    return this.bridge.createSnapshot(this.id);
  }

  async restoreSnapshot(snapshot: SandboxSnapshot): Promise<void> {
    return this.bridge.restoreSnapshot(this.id, snapshot);
  }
}

export interface Sandbox {
  create(policy?: ExecutionPolicy): Promise<SandboxInstance>;
  execute(code: Uint8Array, policy?: ExecutionPolicy): Promise<ExecutionResult>;
  listInstances(): SandboxInstanceInfo[];
  terminateAll(): Promise<void>;
}

class SandboxBridge implements Sandbox {
  private wasmModule: any = null;
  private manager: any = null;
  private initialized = false;
  private instances = new Map<string, SandboxInstance>();

  async initialize(config?: EngineConfig): Promise<void> {
    if (this.initialized) return;

    try {
      // Load WASM module
      if (isBrowser) {
        // Browser environment - sandbox doesn't have pkg-web yet, use pkg
        this.wasmModule = await import('../core/sandbox/pkg/sandbox');
        await this.wasmModule.default();
      } else {
        // Node.js environment
        this.wasmModule = require('../core/sandbox/pkg/sandbox');
      }

      // Create sandbox manager
      this.manager = new this.wasmModule.SandboxManager();
      this.initialized = true;
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.INITIALIZATION_FAILED,
        `Failed to initialize sandbox module: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new WASMError(
        WASMErrorCode.NOT_INITIALIZED,
        'Sandbox module not initialized. Call initialize() first.'
      );
    }
  }

  async create(policy?: ExecutionPolicy): Promise<SandboxInstance> {
    this.ensureInitialized();

    try {
      const policyJs = policy || this.getDefaultPolicy();
      const instanceId = this.manager.create_instance(policyJs);
      
      const instance = new SandboxInstance(this, instanceId, policyJs);
      this.instances.set(instanceId, instance);
      
      return instance;
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to create sandbox instance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async execute(code: Uint8Array, policy?: ExecutionPolicy): Promise<ExecutionResult> {
    this.ensureInitialized();

    try {
      // Validate input
      if (!code || code.length === 0) {
        throw new WASMError(
          WASMErrorCode.INVALID_INPUT,
          'Code cannot be empty'
        );
      }

      if (code.length > MAX_FILE_SIZE) {
        throw new WASMError(
          WASMErrorCode.INVALID_INPUT,
          `Code size exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`
        );
      }

      const policyJs = policy || this.getDefaultPolicy();
      const result = await this.wasmModule.sandbox_execute(code, policyJs);

      return this.parseExecutionResult(result);
    } catch (error: unknown) {
      if (error instanceof WASMError) throw error;
      
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Sandbox execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async executeInInstance(instanceId: string, code: Uint8Array): Promise<ExecutionResult> {
    this.ensureInitialized();

    try {
      const result = await this.manager.execute(instanceId, code);
      return this.parseExecutionResult(result);
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Instance execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getInstanceResourceUsage(instanceId: string): ResourceUsage {
    this.ensureInitialized();

    try {
      const usage = this.manager.get_resource_usage(instanceId);
      return this.parseResourceUsage(usage);
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to get resource usage: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async terminateInstance(instanceId: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.manager.terminate_instance(instanceId);
      this.instances.delete(instanceId);
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to terminate instance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  listInstances(): SandboxInstanceInfo[] {
    this.ensureInitialized();

    try {
      const instances = this.manager.list_instances();
      return instances.map((inst: any) => this.parseInstanceInfo(inst));
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to list instances: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async terminateAll(): Promise<void> {
    this.ensureInitialized();

    try {
      this.manager.terminate_all();
      this.instances.clear();
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to terminate all instances: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getDefaultPolicy(): ExecutionPolicy {
    if (!this.initialized) {
      // Return hardcoded defaults if not initialized
      return {
        maxMemory: 100 * 1024 * 1024,  // 100MB
        maxCpuTime: 30,                 // 30 seconds
        maxFileHandles: 10,
        allowNetwork: false,
        allowFileSystem: false,
        syscallPolicy: 'deny_all',
        allowedSyscalls: []
      };
    }

    try {
      const policy = this.manager.get_default_policy();
      return this.parsePolicy(policy);
    } catch (error: unknown) {
      // Return fallback defaults
      return this.getDefaultPolicy();
    }
  }

  async pauseInstance(instanceId: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.manager.pause_instance(instanceId);
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to pause instance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async resumeInstance(instanceId: string): Promise<void> {
    this.ensureInitialized();

    try {
      this.manager.resume_instance(instanceId);
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to resume instance: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async createSnapshot(instanceId: string): Promise<SandboxSnapshot> {
    this.ensureInitialized();

    try {
      const snapshot = this.manager.create_snapshot(instanceId);
      return this.parseSnapshot(snapshot);
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async restoreSnapshot(instanceId: string, snapshot: SandboxSnapshot): Promise<void> {
    this.ensureInitialized();

    try {
      this.manager.restore_snapshot(instanceId, snapshot);
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to restore snapshot: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getAllInstancesStatus(): Record<string, any> {
    this.ensureInitialized();

    try {
      return this.manager.get_all_instances_status();
    } catch (error: unknown) {
      throw new WASMError(
        WASMErrorCode.EXECUTION_ERROR,
        `Failed to get instances status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return {
      initializationTime: 0,
      analysisTime: 0,
      deobfuscationTime: 0,
      patternScanTime: 0,
      totalTime: 0,
      memoryUsed: 0,
      throughput: 0
    };
  }

  private parseExecutionResult(result: any): ExecutionResult {
    return {
      success: result.success,
      exitCode: result.exit_code,
      output: new Uint8Array(result.output),
      error: result.error,
      resourceUsage: this.parseResourceUsage(result.resource_usage),
      securityEvents: result.security_events.map((e: any) => this.parseSecurityEvent(e)),
      executionTime: result.execution_time
    };
  }

  private parseResourceUsage(usage: any): ResourceUsage {
    return {
      memoryUsed: usage.memory_used,
      cpuTimeUsed: usage.cpu_time_used,
      fileHandlesUsed: usage.file_handles_used,
      peakMemory: usage.peak_memory,
      syscallCount: usage.syscall_count
    };
  }

  private parseSecurityEvent(event: any): SecurityEvent {
    return {
      timestamp: event.timestamp,
      eventType: event.event_type,
      details: event.details,
      severity: event.severity
    };
  }

  private parseInstanceInfo(inst: any): SandboxInstanceInfo {
    return {
      id: inst.id,
      state: inst.state,
      createdAt: inst.created_at,
      resourceUsage: this.parseResourceUsage(inst.resource_usage),
      policy: this.parsePolicy(inst.policy)
    };
  }

  private parsePolicy(policy: any): ExecutionPolicy {
    return {
      maxMemory: policy.max_memory,
      maxCpuTime: policy.max_cpu_time,
      maxFileHandles: policy.max_file_handles,
      allowNetwork: policy.allow_network,
      allowFileSystem: policy.allow_file_system,
      syscallPolicy: policy.syscall_policy,
      allowedSyscalls: policy.allowed_syscalls || []
    };
  }

  private parseSnapshot(snapshot: any): SandboxSnapshot {
    return {
      instanceId: snapshot.instance_id,
      timestamp: snapshot.timestamp,
      status: snapshot.status,
      memorySnapshot: new Uint8Array(snapshot.memory_snapshot),
      securityEvents: snapshot.security_events.map((e: any) => this.parseSecurityEvent(e))
    };
  }

  // Cleanup method
  async cleanup(): Promise<void> {
    if (this.initialized) {
      await this.terminateAll();
      this.manager.free();
      this.manager = null;
      this.wasmModule = null;
      this.initialized = false;
    }
  }
}

// Export singleton instance
let sandboxInstance: SandboxBridge | null = null;

export async function initializeSandbox(config?: EngineConfig): Promise<Sandbox> {
  if (!sandboxInstance) {
    sandboxInstance = new SandboxBridge();
    await sandboxInstance.initialize(config);
  }
  return sandboxInstance;
}

export async function getSandbox(): Promise<Sandbox> {
  if (!sandboxInstance) {
    throw new WASMError(
      WASMErrorCode.NOT_INITIALIZED,
      'Sandbox not initialized. Call initializeSandbox() first.'
    );
  }
  return sandboxInstance;
}

export async function cleanupSandbox(): Promise<void> {
  if (sandboxInstance) {
    await sandboxInstance.cleanup();
    sandboxInstance = null;
  }
}

// Helper functions for common use cases
export async function executeInSandbox(
  code: Uint8Array,
  policy?: ExecutionPolicy
): Promise<ExecutionResult> {
  const sandbox = await getSandbox();
  return sandbox.execute(code, policy);
}

export async function createSandboxInstance(
  policy?: ExecutionPolicy
): Promise<SandboxInstance> {
  const sandbox = await getSandbox();
  return sandbox.create(policy);
}

// Export all types for convenience