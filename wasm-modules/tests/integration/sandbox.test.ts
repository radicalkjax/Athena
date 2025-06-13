/**
 * Integration tests for the WASM Sandbox module
 * Tests sandbox creation, execution, resource limits, and security policies
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import {
  initializeSandbox,
  getSandbox,
  cleanupSandbox,
  executeInSandbox,
  createSandboxInstance,
  ExecutionPolicy,
  SecurityEvent,
  WASMError,
  WASMErrorCode
} from '../../bridge/sandbox-bridge';

describe('Sandbox Integration Tests', () => {
  beforeAll(async () => {
    // Initialize sandbox module before tests
    await initializeSandbox();
  }, 30000);

  afterAll(async () => {
    // Cleanup after tests
    await cleanupSandbox();
  });

  describe('Module Initialization', () => {
    it('should initialize sandbox module successfully', async () => {
      const sandbox = await getSandbox();
      expect(sandbox).toBeDefined();
    });

    it('should throw error when accessing sandbox before initialization', async () => {
      // Clean up first
      await cleanupSandbox();
      
      // Try to get sandbox without initialization
      await expect(getSandbox()).rejects.toThrow(
        'Sandbox not initialized. Call initializeSandbox() first.'
      );
      
      // Re-initialize for other tests
      await initializeSandbox();
    });
  });

  describe('Sandbox Creation and Management', () => {
    it('should create a sandbox instance with default policy', async () => {
      const instance = await createSandboxInstance();
      expect(instance).toBeDefined();
      expect(instance.id).toBeTruthy();
      
      // Cleanup
      await instance.terminate();
    });

    it('should create a sandbox instance with custom policy', async () => {
      const customPolicy: ExecutionPolicy = {
        maxMemory: 50 * 1024 * 1024,  // 50MB
        maxCpuTime: 10,                // 10 seconds
        maxFileHandles: 5,
        allowNetwork: false,
        allowFileSystem: false,
        syscallPolicy: 'deny_all'
      };
      
      const instance = await createSandboxInstance(customPolicy);
      expect(instance).toBeDefined();
      
      // Cleanup
      await instance.terminate();
    });

    it('should list active sandbox instances', async () => {
      const sandbox = await getSandbox();
      
      // Create multiple instances
      const instance1 = await createSandboxInstance();
      const instance2 = await createSandboxInstance();
      
      const instances = sandbox.listInstances();
      expect(instances.length).toBeGreaterThanOrEqual(2);
      
      // Cleanup
      await instance1.terminate();
      await instance2.terminate();
    });

    it('should terminate all instances', async () => {
      const sandbox = await getSandbox();
      
      // Create instances
      await createSandboxInstance();
      await createSandboxInstance();
      await createSandboxInstance();
      
      // Terminate all
      await sandbox.terminateAll();
      
      const instances = sandbox.listInstances();
      expect(instances.length).toBe(0);
    });
  });

  describe('Code Execution', () => {
    it('should execute simple code successfully', async () => {
      const code = 'console.log("Hello from sandbox");';
      const codeBytes = new TextEncoder().encode(code);
      
      const result = await executeInSandbox(codeBytes);
      
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.resourceUsage).toBeDefined();
      expect(result.securityEvents).toEqual([]);
    });

    it('should handle code with errors', async () => {
      const code = 'throw new Error("Test error");';
      const codeBytes = new TextEncoder().encode(code);
      
      const result = await executeInSandbox(codeBytes);
      
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.error).toBeTruthy();
    });

    it('should execute code with output', async () => {
      const code = 'process.stdout.write("Test output");';
      const codeBytes = new TextEncoder().encode(code);
      
      const result = await executeInSandbox(codeBytes);
      
      expect(result.output).toBeDefined();
      const outputText = new TextDecoder().decode(result.output);
      expect(outputText).toContain('Test output');
    });
  });

  describe('Resource Limits', () => {
    it('should enforce memory limits', async () => {
      const policy: ExecutionPolicy = {
        maxMemory: 10 * 1024 * 1024,  // 10MB limit
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
      
      const result = await executeInSandbox(code, policy);
      
      expect(result.success).toBe(false);
      expect(result.securityEvents.some(e => 
        e.eventType === 'resource_limit' && e.details.includes('memory')
      )).toBe(true);
    });

    it('should enforce CPU time limits', async () => {
      const policy: ExecutionPolicy = {
        maxMemory: 100 * 1024 * 1024,
        maxCpuTime: 1,  // 1 second limit
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
      
      const result = await executeInSandbox(code, policy);
      
      expect(result.success).toBe(false);
      expect(result.securityEvents.some(e => 
        e.eventType === 'timeout'
      )).toBe(true);
    });

    it('should track resource usage', async () => {
      const code = `
        const arr = new Uint8Array(1024 * 1024); // 1MB
        for (let i = 0; i < 1000000; i++) {
          Math.sqrt(i);
        }
      `;
      
      const result = await executeInSandbox(code);
      
      expect(result.resourceUsage.memoryUsed).toBeGreaterThan(0);
      expect(result.resourceUsage.cpuTimeUsed).toBeGreaterThan(0);
      expect(result.resourceUsage.peakMemory).toBeGreaterThanOrEqual(result.resourceUsage.memoryUsed);
    });
  });

  describe('Security Policies', () => {
    it('should block network access by default', async () => {
      const code = `
        const http = require('http');
        http.get('http://example.com', () => {});
      `;
      
      const result = await executeInSandbox(code);
      
      expect(result.success).toBe(false);
      expect(result.securityEvents.some(e => 
        e.eventType === 'syscall_blocked' && e.details.includes('network')
      )).toBe(true);
    });

    it('should block file system access by default', async () => {
      const code = `
        const fs = require('fs');
        fs.writeFileSync('/tmp/test.txt', 'data');
      `;
      
      const result = await executeInSandbox(code);
      
      expect(result.success).toBe(false);
      expect(result.securityEvents.some(e => 
        e.eventType === 'syscall_blocked' && e.details.includes('file')
      )).toBe(true);
    });

    it('should allow only whitelisted syscalls', async () => {
      const policy: ExecutionPolicy = {
        syscallPolicy: 'custom',
        allowedSyscalls: ['read', 'write'],
        allowNetwork: false,
        allowFileSystem: false
      };
      
      const code = `
        process.stdout.write('Allowed syscall');
        process.exit(0); // This should be blocked
      `;
      
      const result = await executeInSandbox(code, policy);
      
      expect(result.securityEvents.some(e => 
        e.eventType === 'syscall_blocked' && e.details.includes('exit')
      )).toBe(true);
    });

    it('should log all security events', async () => {
      const code = `
        const fs = require('fs');
        const net = require('net');
        
        try { fs.readFileSync('/etc/passwd'); } catch (e) {}
        try { net.createConnection({ port: 80 }); } catch (e) {}
        try { process.exit(1); } catch (e) {}
      `;
      
      const result = await executeInSandbox(code);
      
      expect(result.securityEvents.length).toBeGreaterThan(0);
      expect(result.securityEvents.every(e => 
        e.timestamp > 0 && e.severity && e.details
      )).toBe(true);
    });
  });

  describe('Malware Analysis Scenarios', () => {
    it('should safely analyze code with infinite loops', async () => {
      const maliciousCode = `
        // Infinite loop to consume CPU
        while (true) {
          Math.random();
        }
      `;
      
      const policy: ExecutionPolicy = {
        maxCpuTime: 2,  // 2 second limit
        maxMemory: 50 * 1024 * 1024
      };
      
      const result = await executeInSandbox(maliciousCode, policy);
      
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      expect(result.executionTime).toBeLessThan(3000); // Should timeout within 3 seconds
    });

    it('should detect memory exhaustion attempts', async () => {
      const maliciousCode = `
        // Try to exhaust memory
        const bombs = [];
        while (true) {
          bombs.push(new Array(1000000).fill('x'));
        }
      `;
      
      const result = await executeInSandbox(maliciousCode);
      
      expect(result.success).toBe(false);
      expect(result.securityEvents.some(e => 
        e.eventType === 'resource_limit' && e.severity === 'high'
      )).toBe(true);
    });

    it('should analyze code with multiple security violations', async () => {
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
      
      const result = await executeInSandbox(maliciousCode);
      
      expect(result.success).toBe(false);
      expect(result.securityEvents.length).toBeGreaterThan(3);
      
      // Check for different types of violations
      const eventTypes = result.securityEvents.map(e => e.eventType);
      expect(eventTypes).toContain('syscall_blocked');
      
      // High severity events
      const highSeverityEvents = result.securityEvents.filter(e => 
        e.severity === 'high' || e.severity === 'critical'
      );
      expect(highSeverityEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid code gracefully', async () => {
      const invalidCode = new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]); // Invalid UTF-8
      
      const result = await executeInSandbox(invalidCode);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should reject empty code', async () => {
      const emptyCode = new Uint8Array(0);
      
      await expect(executeInSandbox(emptyCode)).rejects.toThrow(
        'Code cannot be empty'
      );
    });

    it('should reject oversized code', async () => {
      // Create code larger than MAX_FILE_SIZE
      const oversizedCode = new Uint8Array(200 * 1024 * 1024); // 200MB
      
      await expect(executeInSandbox(oversizedCode)).rejects.toThrow(
        'Code size exceeds maximum allowed size'
      );
    });
  });

  describe('Performance', () => {
    it('should create sandbox instances quickly', async () => {
      const start = Date.now();
      const instance = await createSandboxInstance();
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(100); // Should be under 100ms
      
      await instance.terminate();
    });

    it('should execute code with minimal overhead', async () => {
      const code = 'process.exit(0);';
      
      const start = Date.now();
      const result = await executeInSandbox(code);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(500); // Should be under 500ms
      expect(result.executionTime).toBeLessThan(duration);
    });

    it('should handle concurrent executions', async () => {
      const code = 'console.log("Concurrent test");';
      
      // Execute multiple sandboxes concurrently
      const promises = Array(5).fill(null).map(() => 
        executeInSandbox(code)
      );
      
      const results = await Promise.all(promises);
      
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.exitCode === 0)).toBe(true);
    });
  });
});

describe('Sandbox Security Event Analysis', () => {
  beforeAll(async () => {
    await initializeSandbox();
  });

  afterAll(async () => {
    await cleanupSandbox();
  });

  it('should categorize security events correctly', async () => {
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
      const result = await executeInSandbox(testCase.code, {
        maxCpuTime: 1
      });
      
      const event = result.securityEvents.find(e => 
        e.eventType === testCase.expectedEvent
      );
      
      expect(event).toBeDefined();
      if (event) {
        expect(event.severity).toBe(testCase.expectedSeverity);
      }
    }
  });
});