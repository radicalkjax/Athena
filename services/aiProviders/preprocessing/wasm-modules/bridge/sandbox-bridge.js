"use strict";
/**
 * TypeScript bridge for the WASM Sandbox module
 * Provides secure execution environments for malware analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxInstance = exports.WASMErrorCode = exports.WASMError = void 0;
exports.initializeSandbox = initializeSandbox;
exports.getSandbox = getSandbox;
exports.cleanupSandbox = cleanupSandbox;
exports.executeInSandbox = executeInSandbox;
exports.createSandboxInstance = createSandboxInstance;
const types_1 = require("./types");
const wasm_error_codes_1 = require("./wasm-error-codes");
// WASMError class for sandbox-specific errors
class WASMError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'WASMError';
    }
}
exports.WASMError = WASMError;
exports.WASMErrorCode = {
    INITIALIZATION_FAILED: 'INITIALIZATION_FAILED',
    NOT_INITIALIZED: 'NOT_INITIALIZED',
    EXECUTION_ERROR: 'EXECUTION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',
    TIMEOUT: 'TIMEOUT',
    RESOURCE_LIMIT: 'RESOURCE_LIMIT'
};
class SandboxInstance {
    constructor(bridge, id, policy) {
        this.bridge = bridge;
        this.id = id;
        this.policy = policy;
    }
    async execute(code) {
        return this.bridge.executeInInstance(this.id, code);
    }
    getResourceUsage() {
        return this.bridge.getInstanceResourceUsage(this.id);
    }
    async terminate() {
        return this.bridge.terminateInstance(this.id);
    }
    async pause() {
        return this.bridge.pauseInstance(this.id);
    }
    async resume() {
        return this.bridge.resumeInstance(this.id);
    }
    async createSnapshot() {
        return this.bridge.createSnapshot(this.id);
    }
    async restoreSnapshot(snapshot) {
        return this.bridge.restoreSnapshot(this.id, snapshot);
    }
}
exports.SandboxInstance = SandboxInstance;
class SandboxBridge {
    constructor() {
        this.wasmModule = null;
        this.manager = null;
        this.initialized = false;
        this.instances = new Map();
    }
    async initialize(config) {
        if (this.initialized)
            return;
        try {
            // Load WASM module
            if (wasm_error_codes_1.isBrowser) {
                // Browser environment - sandbox doesn't have pkg-web yet, use pkg
                this.wasmModule = await Promise.resolve().then(() => require('../core/sandbox/pkg/sandbox'));
                await this.wasmModule.default();
            }
            else {
                // Node.js environment
                this.wasmModule = require('../core/sandbox/pkg/sandbox');
            }
            // Create sandbox manager
            this.manager = new this.wasmModule.SandboxManager();
            this.initialized = true;
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.INITIALIZATION_FAILED, `Failed to initialize sandbox module: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    ensureInitialized() {
        if (!this.initialized) {
            throw new WASMError(exports.WASMErrorCode.NOT_INITIALIZED, 'Sandbox module not initialized. Call initialize() first.');
        }
    }
    async create(policy) {
        this.ensureInitialized();
        try {
            const policyJs = policy || this.getDefaultPolicy();
            const instanceId = this.manager.create_instance(policyJs);
            const instance = new SandboxInstance(this, instanceId, policyJs);
            this.instances.set(instanceId, instance);
            return instance;
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to create sandbox instance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async execute(code, policy) {
        this.ensureInitialized();
        try {
            // Validate input
            if (!code || code.length === 0) {
                throw new WASMError(exports.WASMErrorCode.INVALID_INPUT, 'Code cannot be empty');
            }
            if (code.length > types_1.MAX_FILE_SIZE) {
                throw new WASMError(exports.WASMErrorCode.INVALID_INPUT, `Code size exceeds maximum allowed size of ${types_1.MAX_FILE_SIZE} bytes`);
            }
            const policyJs = policy || this.getDefaultPolicy();
            const result = await this.wasmModule.sandbox_execute(code, policyJs);
            return this.parseExecutionResult(result);
        }
        catch (error) {
            if (error instanceof WASMError)
                throw error;
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Sandbox execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async executeInInstance(instanceId, code) {
        this.ensureInitialized();
        try {
            const result = await this.manager.execute(instanceId, code);
            return this.parseExecutionResult(result);
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Instance execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getInstanceResourceUsage(instanceId) {
        this.ensureInitialized();
        try {
            const usage = this.manager.get_resource_usage(instanceId);
            return this.parseResourceUsage(usage);
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to get resource usage: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async terminateInstance(instanceId) {
        this.ensureInitialized();
        try {
            this.manager.terminate_instance(instanceId);
            this.instances.delete(instanceId);
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to terminate instance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    listInstances() {
        this.ensureInitialized();
        try {
            const instances = this.manager.list_instances();
            return instances.map((inst) => this.parseInstanceInfo(inst));
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to list instances: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async terminateAll() {
        this.ensureInitialized();
        try {
            this.manager.terminate_all();
            this.instances.clear();
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to terminate all instances: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getDefaultPolicy() {
        if (!this.initialized) {
            // Return hardcoded defaults if not initialized
            return {
                maxMemory: 100 * 1024 * 1024, // 100MB
                maxCpuTime: 30, // 30 seconds
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
        }
        catch (error) {
            // Return fallback defaults
            return this.getDefaultPolicy();
        }
    }
    async pauseInstance(instanceId) {
        this.ensureInitialized();
        try {
            this.manager.pause_instance(instanceId);
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to pause instance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async resumeInstance(instanceId) {
        this.ensureInitialized();
        try {
            this.manager.resume_instance(instanceId);
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to resume instance: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async createSnapshot(instanceId) {
        this.ensureInitialized();
        try {
            const snapshot = this.manager.create_snapshot(instanceId);
            return this.parseSnapshot(snapshot);
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to create snapshot: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async restoreSnapshot(instanceId, snapshot) {
        this.ensureInitialized();
        try {
            this.manager.restore_snapshot(instanceId, snapshot);
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to restore snapshot: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getAllInstancesStatus() {
        this.ensureInitialized();
        try {
            return this.manager.get_all_instances_status();
        }
        catch (error) {
            throw new WASMError(exports.WASMErrorCode.EXECUTION_ERROR, `Failed to get instances status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    getPerformanceMetrics() {
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
    parseExecutionResult(result) {
        return {
            success: result.success,
            exitCode: result.exit_code,
            output: new Uint8Array(result.output),
            error: result.error,
            resourceUsage: this.parseResourceUsage(result.resource_usage),
            securityEvents: result.security_events.map((e) => this.parseSecurityEvent(e)),
            executionTime: result.execution_time
        };
    }
    parseResourceUsage(usage) {
        return {
            memoryUsed: usage.memory_used,
            cpuTimeUsed: usage.cpu_time_used,
            fileHandlesUsed: usage.file_handles_used,
            peakMemory: usage.peak_memory,
            syscallCount: usage.syscall_count
        };
    }
    parseSecurityEvent(event) {
        return {
            timestamp: event.timestamp,
            eventType: event.event_type,
            details: event.details,
            severity: event.severity
        };
    }
    parseInstanceInfo(inst) {
        return {
            id: inst.id,
            state: inst.state,
            createdAt: inst.created_at,
            resourceUsage: this.parseResourceUsage(inst.resource_usage),
            policy: this.parsePolicy(inst.policy)
        };
    }
    parsePolicy(policy) {
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
    parseSnapshot(snapshot) {
        return {
            instanceId: snapshot.instance_id,
            timestamp: snapshot.timestamp,
            status: snapshot.status,
            memorySnapshot: new Uint8Array(snapshot.memory_snapshot),
            securityEvents: snapshot.security_events.map((e) => this.parseSecurityEvent(e))
        };
    }
    // Cleanup method
    async cleanup() {
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
let sandboxInstance = null;
async function initializeSandbox(config) {
    if (!sandboxInstance) {
        sandboxInstance = new SandboxBridge();
        await sandboxInstance.initialize(config);
    }
    return sandboxInstance;
}
async function getSandbox() {
    if (!sandboxInstance) {
        throw new WASMError(exports.WASMErrorCode.NOT_INITIALIZED, 'Sandbox not initialized. Call initializeSandbox() first.');
    }
    return sandboxInstance;
}
async function cleanupSandbox() {
    if (sandboxInstance) {
        await sandboxInstance.cleanup();
        sandboxInstance = null;
    }
}
// Helper functions for common use cases
async function executeInSandbox(code, policy) {
    const sandbox = await getSandbox();
    return sandbox.execute(code, policy);
}
async function createSandboxInstance(policy) {
    const sandbox = await getSandbox();
    return sandbox.create(policy);
}
// Export all types for convenience
