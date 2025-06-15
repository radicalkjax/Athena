"use strict";
/**
 * Integration tests for the WASM Sandbox module
 * Tests sandbox creation, execution, resource limits, and security policies
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
(0, globals_1.describe)('Sandbox Integration Tests', () => {
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Initialize sandbox module before tests
        yield (0, sandbox_bridge_1.initializeSandbox)();
    }), 30000);
    (0, globals_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Cleanup after tests
        yield (0, sandbox_bridge_1.cleanupSandbox)();
    }));
    (0, globals_1.describe)('Module Initialization', () => {
        (0, globals_1.it)('should initialize sandbox module successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
            (0, globals_1.expect)(sandbox).toBeDefined();
        }));
        (0, globals_1.it)('should throw error when accessing sandbox before initialization', () => __awaiter(void 0, void 0, void 0, function* () {
            // Clean up first
            yield (0, sandbox_bridge_1.cleanupSandbox)();
            // Try to get sandbox without initialization
            yield (0, globals_1.expect)((0, sandbox_bridge_1.getSandbox)()).rejects.toThrow('Sandbox not initialized. Call initializeSandbox() first.');
            // Re-initialize for other tests
            yield (0, sandbox_bridge_1.initializeSandbox)();
        }));
    });
    (0, globals_1.describe)('Sandbox Creation and Management', () => {
        (0, globals_1.it)('should create a sandbox instance with default policy', () => __awaiter(void 0, void 0, void 0, function* () {
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)();
            (0, globals_1.expect)(instance).toBeDefined();
            (0, globals_1.expect)(instance.id).toBeTruthy();
            // Cleanup
            yield instance.terminate();
        }));
        (0, globals_1.it)('should create a sandbox instance with custom policy', () => __awaiter(void 0, void 0, void 0, function* () {
            const customPolicy = {
                maxMemory: 50 * 1024 * 1024, // 50MB
                maxCpuTime: 10, // 10 seconds
                maxFileHandles: 5,
                allowNetwork: false,
                allowFileSystem: false,
                syscallPolicy: 'deny_all'
            };
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)(customPolicy);
            (0, globals_1.expect)(instance).toBeDefined();
            // Cleanup
            yield instance.terminate();
        }));
        (0, globals_1.it)('should list active sandbox instances', () => __awaiter(void 0, void 0, void 0, function* () {
            const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
            // Create multiple instances
            const instance1 = yield (0, sandbox_bridge_1.createSandboxInstance)();
            const instance2 = yield (0, sandbox_bridge_1.createSandboxInstance)();
            const instances = sandbox.listInstances();
            (0, globals_1.expect)(instances.length).toBeGreaterThanOrEqual(2);
            // Cleanup
            yield instance1.terminate();
            yield instance2.terminate();
        }));
        (0, globals_1.it)('should terminate all instances', () => __awaiter(void 0, void 0, void 0, function* () {
            const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
            // Create instances
            yield (0, sandbox_bridge_1.createSandboxInstance)();
            yield (0, sandbox_bridge_1.createSandboxInstance)();
            yield (0, sandbox_bridge_1.createSandboxInstance)();
            // Terminate all
            yield sandbox.terminateAll();
            const instances = sandbox.listInstances();
            (0, globals_1.expect)(instances.length).toBe(0);
        }));
    });
    (0, globals_1.describe)('Code Execution', () => {
        (0, globals_1.it)('should execute simple code successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'console.log("Hello from sandbox");';
            const codeBytes = new TextEncoder().encode(code);
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(codeBytes);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.exitCode).toBe(0);
            (0, globals_1.expect)(result.resourceUsage).toBeDefined();
            (0, globals_1.expect)(result.securityEvents).toEqual([]);
        }));
        (0, globals_1.it)('should handle code with errors', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'throw new Error("Test error");';
            const codeBytes = new TextEncoder().encode(code);
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(codeBytes);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.exitCode).not.toBe(0);
            (0, globals_1.expect)(result.error).toBeTruthy();
        }));
        (0, globals_1.it)('should execute code with output', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'process.stdout.write("Test output");';
            const codeBytes = new TextEncoder().encode(code);
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(codeBytes);
            (0, globals_1.expect)(result.output).toBeDefined();
            const outputText = new TextDecoder().decode(result.output);
            (0, globals_1.expect)(outputText).toContain('Test output');
        }));
    });
    (0, globals_1.describe)('Resource Limits', () => {
        (0, globals_1.it)('should enforce memory limits', () => __awaiter(void 0, void 0, void 0, function* () {
            const policy = {
                maxMemory: 10 * 1024 * 1024, // 10MB limit
                maxCpuTime: 30,
                allowNetwork: false,
                allowFileSystem: false
            };
            // Code that tries to allocate more than 10MB
            const code = `
        const arrays = [];
        for (let i = 0; i < 100; i++) {
          arrays.push(new Uint8Array(1024 * 1024)); // 1MB each
        }
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code, policy);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.securityEvents.some(e => e.eventType === 'resource_limit' && e.details.includes('memory'))).toBe(true);
        }));
        (0, globals_1.it)('should enforce CPU time limits', () => __awaiter(void 0, void 0, void 0, function* () {
            const policy = {
                maxMemory: 100 * 1024 * 1024,
                maxCpuTime: 1, // 1 second limit
                allowNetwork: false,
                allowFileSystem: false
            };
            // Code that runs longer than 1 second
            const code = `
        const start = Date.now();
        while (Date.now() - start < 5000) {
          // Busy loop for 5 seconds
        }
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code, policy);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.securityEvents.some(e => e.eventType === 'timeout')).toBe(true);
        }));
        (0, globals_1.it)('should track resource usage', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `
        const arr = new Uint8Array(1024 * 1024); // 1MB
        for (let i = 0; i < 1000000; i++) {
          Math.sqrt(i);
        }
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code);
            (0, globals_1.expect)(result.resourceUsage.memoryUsed).toBeGreaterThan(0);
            (0, globals_1.expect)(result.resourceUsage.cpuTimeUsed).toBeGreaterThan(0);
            (0, globals_1.expect)(result.resourceUsage.peakMemory).toBeGreaterThanOrEqual(result.resourceUsage.memoryUsed);
        }));
    });
    (0, globals_1.describe)('Security Policies', () => {
        (0, globals_1.it)('should block network access by default', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `
        const http = require('http');
        http.get('http://example.com', () => {});
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.securityEvents.some(e => e.eventType === 'syscall_blocked' && e.details.includes('network'))).toBe(true);
        }));
        (0, globals_1.it)('should block file system access by default', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `
        const fs = require('fs');
        fs.writeFileSync('/tmp/test.txt', 'data');
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.securityEvents.some(e => e.eventType === 'syscall_blocked' && e.details.includes('file'))).toBe(true);
        }));
        (0, globals_1.it)('should allow only whitelisted syscalls', () => __awaiter(void 0, void 0, void 0, function* () {
            const policy = {
                syscallPolicy: 'custom',
                allowedSyscalls: ['read', 'write'],
                allowNetwork: false,
                allowFileSystem: false
            };
            const code = `
        process.stdout.write('Allowed syscall');
        process.exit(0); // This should be blocked
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code, policy);
            (0, globals_1.expect)(result.securityEvents.some(e => e.eventType === 'syscall_blocked' && e.details.includes('exit'))).toBe(true);
        }));
        (0, globals_1.it)('should log all security events', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `
        const fs = require('fs');
        const net = require('net');
        
        try { fs.readFileSync('/etc/passwd'); } catch (e) {}
        try { net.createConnection({ port: 80 }); } catch (e) {}
        try { process.exit(1); } catch (e) {}
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code);
            (0, globals_1.expect)(result.securityEvents.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.securityEvents.every(e => e.timestamp > 0 && e.severity && e.details)).toBe(true);
        }));
    });
    (0, globals_1.describe)('Malware Analysis Scenarios', () => {
        (0, globals_1.it)('should safely analyze code with infinite loops', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousCode = `
        // Infinite loop to consume CPU
        while (true) {
          Math.random();
        }
      `;
            const policy = {
                maxCpuTime: 2, // 2 second limit
                maxMemory: 50 * 1024 * 1024
            };
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(maliciousCode, policy);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.exitCode).not.toBe(0);
            (0, globals_1.expect)(result.executionTime).toBeLessThan(3000); // Should timeout within 3 seconds
        }));
        (0, globals_1.it)('should detect memory exhaustion attempts', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousCode = `
        // Try to exhaust memory
        const bombs = [];
        while (true) {
          bombs.push(new Array(1000000).fill('x'));
        }
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(maliciousCode);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.securityEvents.some(e => e.eventType === 'resource_limit' && e.severity === 'high')).toBe(true);
        }));
        (0, globals_1.it)('should analyze code with multiple security violations', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousCode = `
        const fs = require('fs');
        const net = require('net');
        const { exec } = require('child_process');
        
        // Multiple malicious actions
        fs.readdir('/etc', () => {});
        net.createServer().listen(8080);
        exec('rm -rf /', () => {});
        
        // Fork bomb attempt
        while (true) {
          process.fork();
        }
      `;
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(maliciousCode);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.securityEvents.length).toBeGreaterThan(3);
            // Check for different types of violations
            const eventTypes = result.securityEvents.map(e => e.eventType);
            (0, globals_1.expect)(eventTypes).toContain('syscall_blocked');
            // High severity events
            const highSeverityEvents = result.securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical');
            (0, globals_1.expect)(highSeverityEvents.length).toBeGreaterThan(0);
        }));
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.it)('should handle invalid code gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const invalidCode = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]); // Invalid UTF-8
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(invalidCode);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBeTruthy();
        }));
        (0, globals_1.it)('should reject empty code', () => __awaiter(void 0, void 0, void 0, function* () {
            const emptyCode = new Uint8Array(0);
            yield (0, globals_1.expect)((0, sandbox_bridge_1.executeInSandbox)(emptyCode)).rejects.toThrow('Code cannot be empty');
        }));
        (0, globals_1.it)('should reject oversized code', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create code larger than MAX_FILE_SIZE
            const oversizedCode = new Uint8Array(200 * 1024 * 1024); // 200MB
            yield (0, globals_1.expect)((0, sandbox_bridge_1.executeInSandbox)(oversizedCode)).rejects.toThrow('Code size exceeds maximum allowed size');
        }));
    });
    (0, globals_1.describe)('Performance', () => {
        (0, globals_1.it)('should create sandbox instances quickly', () => __awaiter(void 0, void 0, void 0, function* () {
            const start = Date.now();
            const instance = yield (0, sandbox_bridge_1.createSandboxInstance)();
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(100); // Should be under 100ms
            yield instance.terminate();
        }));
        (0, globals_1.it)('should execute code with minimal overhead', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'process.exit(0);';
            const start = Date.now();
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(code);
            const duration = Date.now() - start;
            (0, globals_1.expect)(duration).toBeLessThan(500); // Should be under 500ms
            (0, globals_1.expect)(result.executionTime).toBeLessThan(duration);
        }));
        (0, globals_1.it)('should handle concurrent executions', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = 'console.log("Concurrent test");';
            // Execute multiple sandboxes concurrently
            const promises = Array(5).fill(null).map(() => (0, sandbox_bridge_1.executeInSandbox)(code));
            const results = yield Promise.all(promises);
            (0, globals_1.expect)(results.every(r => r.success)).toBe(true);
            (0, globals_1.expect)(results.every(r => r.exitCode === 0)).toBe(true);
        }));
    });
});
(0, globals_1.describe)('Sandbox Security Event Analysis', () => {
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, sandbox_bridge_1.initializeSandbox)();
    }));
    (0, globals_1.afterAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        yield (0, sandbox_bridge_1.cleanupSandbox)();
    }));
    (0, globals_1.it)('should categorize security events correctly', () => __awaiter(void 0, void 0, void 0, function* () {
        const testCases = [
            {
                code: 'require("fs").readFileSync("/etc/passwd")',
                expectedEvent: 'syscall_blocked',
                expectedSeverity: 'high'
            },
            {
                code: 'require("net").createConnection({ port: 80 })',
                expectedEvent: 'syscall_blocked',
                expectedSeverity: 'medium'
            },
            {
                code: 'while(true) {}',
                expectedEvent: 'timeout',
                expectedSeverity: 'low'
            }
        ];
        for (const testCase of testCases) {
            const result = yield (0, sandbox_bridge_1.executeInSandbox)(testCase.code, {
                maxCpuTime: 1
            });
            const event = result.securityEvents.find(e => e.eventType === testCase.expectedEvent);
            (0, globals_1.expect)(event).toBeDefined();
            if (event) {
                (0, globals_1.expect)(event.severity).toBe(testCase.expectedSeverity);
            }
        }
    }));
});
