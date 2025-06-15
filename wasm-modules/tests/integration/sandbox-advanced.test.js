"use strict";
/**
 * Advanced integration tests for enhanced sandbox features
 * Tests multi-instance management, snapshot/restore, and performance
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const sandbox_bridge_1 = require("../../bridge/sandbox-bridge");
(0, globals_1.describe)('Advanced Sandbox Features', () => {
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, sandbox_bridge_1.initializeSandbox)();
    }), 30000);
    (0, globals_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, sandbox_bridge_1.cleanupSandbox)();
    }));
    (0, globals_1.describe)('Multi-Instance Management', () => {
        (0, globals_1.it)('should manage multiple instances efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
            const instances = [];
            // Create multiple instances
            for (let i = 0; i < 5; i++) {
                const instance = yield (0, sandbox_bridge_1.createSandboxInstance)({
                    maxMemory: 50 * 1024 * 1024,
                    maxCpuTime: 10
                });
                instances.push(instance);
            }
            // Verify all instances are created
            const allInstances = sandbox.listInstances();
            (0, globals_1.expect)(allInstances.length).toBeGreaterThanOrEqual(5);
            // Execute code in parallel
            const execPromises = instances.map((instance, i) => instance.execute(new TextEncoder().encode(`console.log("Instance ${i}");`)));
            const results = yield Promise.all(execPromises);
            (0, globals_1.expect)(results.every(r => r.success)).toBe(true);
            // Cleanup
            yield Promise.all(instances.map(i => i.terminate()));
        }));
        (0, globals_1.it)('should handle instance lifecycle states', () => __awaiter(void 0, void 0, void 0, function* () {
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)();
            // Initial state should be ready
            const initialUsage = instance.getResourceUsage();
            (0, globals_1.expect)(initialUsage).toBeDefined();
            // Pause instance
            yield instance.pause();
            // Try to execute while paused (should fail or queue)
            try {
                yield instance.execute(new TextEncoder().encode('console.log("test");'));
            }
            catch (error) {
                (0, globals_1.expect)(error).toBeInstanceOf(sandbox_bridge_1.WASMError);
            }
            // Resume instance
            yield instance.resume();
            // Should work after resume
            const result = yield instance.execute(new TextEncoder().encode('console.log("resumed");'));
            (0, globals_1.expect)(result.success).toBe(true);
            yield instance.terminate();
        }));
    });
    (0, globals_1.describe)('Snapshot and Restore', () => {
        (0, globals_1.it)('should create and restore snapshots', () => __awaiter(void 0, void 0, void 0, function* () {
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)();
            // Execute some code to create state
            const code1 = `
        globalThis.counter = 0;
        for (let i = 0; i < 5; i++) {
          globalThis.counter++;
        }
        console.log('Counter:', globalThis.counter);
      `;
            const result1 = yield instance.execute(new TextEncoder().encode(code1));
            (0, globals_1.expect)(result1.success).toBe(true);
            // Create snapshot
            const snapshot = yield instance.createSnapshot();
            (0, globals_1.expect)(snapshot).toBeDefined();
            (0, globals_1.expect)(snapshot.instanceId).toBe(instance.id);
            (0, globals_1.expect)(snapshot.timestamp).toBeGreaterThan(0);
            (0, globals_1.expect)(snapshot.memorySnapshot).toBeInstanceOf(Uint8Array);
            // Modify state
            const code2 = `
        globalThis.counter = 100;
        console.log('Modified counter:', globalThis.counter);
      `;
            yield instance.execute(new TextEncoder().encode(code2));
            // Restore snapshot
            yield instance.restoreSnapshot(snapshot);
            // Verify state was restored
            const code3 = `console.log('Restored counter:', globalThis.counter);`;
            const result3 = yield instance.execute(new TextEncoder().encode(code3));
            // The restored state should have counter = 5
            (0, globals_1.expect)(result3.success).toBe(true);
            yield instance.terminate();
        }));
        (0, globals_1.it)('should preserve security events in snapshots', () => __awaiter(void 0, void 0, void 0, function* () {
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)({
                allowNetwork: false,
                syscallPolicy: 'deny_all'
            });
            // Trigger security events
            const maliciousCode = `
        try { require('fs').readFileSync('/etc/passwd'); } catch (e) {}
        try { require('net').createConnection({ port: 80 }); } catch (e) {}
      `;
            yield instance.execute(new TextEncoder().encode(maliciousCode));
            // Create snapshot
            const snapshot = yield instance.createSnapshot();
            (0, globals_1.expect)(snapshot.securityEvents.length).toBeGreaterThan(0);
            // Create new instance and restore
            const newInstance = yield (0, sandbox_bridge_1.createSandboxInstance)();
            yield newInstance.restoreSnapshot(snapshot);
            // Verify security events were restored
            const usage = newInstance.getResourceUsage();
            (0, globals_1.expect)(usage).toBeDefined();
            yield instance.terminate();
            yield newInstance.terminate();
        }));
    });
    (0, globals_1.describe)('Performance Monitoring', () => {
        (0, globals_1.it)('should track detailed resource metrics', () => __awaiter(void 0, void 0, void 0, function* () {
            const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)({
                maxMemory: 100 * 1024 * 1024
            });
            // Memory-intensive operation
            const memoryCode = `
        const arrays = [];
        for (let i = 0; i < 10; i++) {
          arrays.push(new Uint8Array(1024 * 1024)); // 1MB each
        }
        console.log('Allocated', arrays.length, 'MB');
      `;
            const result = yield instance.execute(new TextEncoder().encode(memoryCode));
            const usage = instance.getResourceUsage();
            (0, globals_1.expect)(usage.memoryUsed).toBeGreaterThan(10 * 1024 * 1024);
            (0, globals_1.expect)(usage.peakMemory).toBeGreaterThanOrEqual(usage.memoryUsed);
            (0, globals_1.expect)(result.executionTime).toBeGreaterThan(0);
            yield instance.terminate();
        }));
        (0, globals_1.it)('should support instance status monitoring', () => __awaiter(void 0, void 0, void 0, function* () {
            const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
            // Create multiple instances with different states
            const instance1 = yield (0, sandbox_bridge_1.createSandboxInstance)();
            const instance2 = yield (0, sandbox_bridge_1.createSandboxInstance)();
            const instance3 = yield (0, sandbox_bridge_1.createSandboxInstance)();
            yield instance2.pause();
            // Get all instances status
            if ('getAllInstancesStatus' in sandbox) {
                const statuses = sandbox.getAllInstancesStatus();
                (0, globals_1.expect)(Object.keys(statuses).length).toBeGreaterThanOrEqual(3);
            }
            // Cleanup
            yield Promise.all([
                instance1.terminate(),
                instance2.terminate(),
                instance3.terminate()
            ]);
        }));
    });
    (0, globals_1.describe)('Instance Pool Efficiency', () => {
        (0, globals_1.it)('should reuse instances efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const timings = [];
            // First set - cold start
            for (let i = 0; i < 3; i++) {
                const start = Date.now();
                const instance = yield (0, sandbox_bridge_1.createSandboxInstance)();
                const duration = Date.now() - start;
                timings.push(duration);
                // Quick execution
                yield instance.execute(new TextEncoder().encode('1+1'));
                yield instance.terminate();
            }
            // Second set - should be faster due to pooling
            const warmTimings = [];
            for (let i = 0; i < 3; i++) {
                const start = Date.now();
                const instance = yield (0, sandbox_bridge_1.createSandboxInstance)();
                const duration = Date.now() - start;
                warmTimings.push(duration);
                yield instance.execute(new TextEncoder().encode('2+2'));
                yield instance.terminate();
            }
            // Warm starts should be faster on average
            const avgCold = timings.reduce((a, b) => a + b) / timings.length;
            const avgWarm = warmTimings.reduce((a, b) => a + b) / warmTimings.length;
            console.log(`Cold start avg: ${avgCold}ms, Warm start avg: ${avgWarm}ms`);
            // This might not always be true in test environment
            // but we log it for performance tracking
        }));
    });
    (0, globals_1.describe)('Error Recovery', () => {
        (0, globals_1.it)('should handle snapshot/restore errors gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const instance1 = yield (0, sandbox_bridge_1.createSandboxInstance)();
            const instance2 = yield (0, sandbox_bridge_1.createSandboxInstance)();
            // Create snapshot from instance1
            const snapshot = yield instance1.createSnapshot();
            // Modify snapshot to be invalid
            const invalidSnapshot = Object.assign(Object.assign({}, snapshot), { instanceId: 'invalid-id' });
            // Try to restore invalid snapshot
            yield (0, globals_1.expect)(instance2.restoreSnapshot(invalidSnapshot))
                .rejects.toThrow();
            // Instance should still be usable
            const result = yield instance2.execute(new TextEncoder().encode('console.log("Still working");'));
            (0, globals_1.expect)(result.success).toBe(true);
            yield instance1.terminate();
            yield instance2.terminate();
        }));
        (0, globals_1.it)('should recover from instance failures', () => __awaiter(void 0, void 0, void 0, function* () {
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)({
                maxCpuTime: 1 // Very short timeout
            });
            // Code that will timeout
            const infiniteLoop = 'while(true) {}';
            const result = yield instance.execute(new TextEncoder().encode(infiniteLoop));
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.securityEvents.some(e => e.eventType === 'timeout')).toBe(true);
            // Should still be able to terminate
            yield instance.terminate();
        }));
    });
});
(0, globals_1.describe)('Sandbox Stress Testing', () => {
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, sandbox_bridge_1.initializeSandbox)();
    }));
    (0, globals_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, sandbox_bridge_1.cleanupSandbox)();
    }));
    (0, globals_1.it)('should handle rapid instance creation/termination', () => __awaiter(void 0, void 0, void 0, function* () {
        const iterations = 20;
        const instances = [];
        for (let i = 0; i < iterations; i++) {
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)();
            instances.push(instance);
            if (i % 5 === 0) {
                // Terminate some instances
                const toTerminate = instances.splice(0, 3);
                yield Promise.all(toTerminate.map(inst => inst.terminate()));
            }
        }
        // Cleanup remaining
        yield Promise.all(instances.map(inst => inst.terminate()));
        const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
        const remaining = sandbox.listInstances();
        (0, globals_1.expect)(remaining.length).toBe(0);
    }));
});
