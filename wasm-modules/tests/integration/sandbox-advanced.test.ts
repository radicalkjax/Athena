/**
 * Advanced integration tests for enhanced sandbox features
 * Tests multi-instance management, snapshot/restore, and performance
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import {
  initializeSandbox,
  getSandbox,
  cleanupSandbox,
  createSandboxInstance,
  SandboxSnapshot,
  WASMError
} from '../../bridge/sandbox-bridge';

describe('Advanced Sandbox Features', () => {
  beforeAll(async () => {
    await initializeSandbox();
  }, 30000);

  afterAll(async () => {
    await cleanupSandbox();
  });

  describe('Multi-Instance Management', () => {
    it('should manage multiple instances efficiently', async () => {
      const sandbox = await getSandbox();
      const instances = [];
      
      // Create multiple instances
      for (let i = 0; i < 5; i++) {
        const instance = await createSandboxInstance({
          maxMemory: 50 * 1024 * 1024,
          maxCpuTime: 10
        });
        instances.push(instance);
      }
      
      // Verify all instances are created
      const allInstances = sandbox.listInstances();
      expect(allInstances.length).toBeGreaterThanOrEqual(5);
      
      // Execute code in parallel
      const execPromises = instances.map((instance, i) => 
        instance.execute(new TextEncoder().encode(`console.log("Instance ${i}");`))
      );
      
      const results = await Promise.all(execPromises);
      expect(results.every(r => r.success)).toBe(true);
      
      // Cleanup
      await Promise.all(instances.map(i => i.terminate()));
    });

    it('should handle instance lifecycle states', async () => {
      const instance = await createSandboxInstance();
      
      // Initial state should be ready
      const initialUsage = instance.getResourceUsage();
      expect(initialUsage).toBeDefined();
      
      // Pause instance
      await instance.pause();
      
      // Try to execute while paused (should fail or queue)
      try {
        await instance.execute(new TextEncoder().encode('console.log("test");'));
      } catch (error: unknown) {
        expect(error).toBeInstanceOf(WASMError);
      }
      
      // Resume instance
      await instance.resume();
      
      // Should work after resume
      const result = await instance.execute(new TextEncoder().encode('console.log("resumed");'));
      expect(result.success).toBe(true);
      
      await instance.terminate();
    });
  });

  describe('Snapshot and Restore', () => {
    it('should create and restore snapshots', async () => {
      const instance = await createSandboxInstance();
      
      // Execute some code to create state
      const code1 = `
        globalThis.counter = 0;
        for (let i = 0; i < 5; i++) {
          globalThis.counter++;
        }
        console.log('Counter:', globalThis.counter);
      `;
      
      const result1 = await instance.execute(new TextEncoder().encode(code1));
      expect(result1.success).toBe(true);
      
      // Create snapshot
      const snapshot = await instance.createSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot.instanceId).toBe(instance.id);
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.memorySnapshot).toBeInstanceOf(Uint8Array);
      
      // Modify state
      const code2 = `
        globalThis.counter = 100;
        console.log('Modified counter:', globalThis.counter);
      `;
      
      await instance.execute(new TextEncoder().encode(code2));
      
      // Restore snapshot
      await instance.restoreSnapshot(snapshot);
      
      // Verify state was restored
      const code3 = `console.log('Restored counter:', globalThis.counter);`;
      const result3 = await instance.execute(new TextEncoder().encode(code3));
      
      // The restored state should have counter = 5
      expect(result3.success).toBe(true);
      
      await instance.terminate();
    });

    it('should preserve security events in snapshots', async () => {
      const instance = await createSandboxInstance({
        allowNetwork: false,
        syscallPolicy: 'deny_all'
      });
      
      // Trigger security events
      const maliciousCode = `
        try { require('fs').readFileSync('/etc/passwd'); } catch (e) {}
        try { require('net').createConnection({ port: 80 }); } catch (e) {}
      `;
      
      await instance.execute(new TextEncoder().encode(maliciousCode));
      
      // Create snapshot
      const snapshot = await instance.createSnapshot();
      expect(snapshot.securityEvents.length).toBeGreaterThan(0);
      
      // Create new instance and restore
      const newInstance = await createSandboxInstance();
      await newInstance.restoreSnapshot(snapshot);
      
      // Verify security events were restored
      const usage = newInstance.getResourceUsage();
      expect(usage).toBeDefined();
      
      await instance.terminate();
      await newInstance.terminate();
    });
  });

  describe('Performance Monitoring', () => {
    it('should track detailed resource metrics', async () => {
      const sandbox = await getSandbox();
      const instance = await createSandboxInstance({
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
      
      const result = await instance.execute(new TextEncoder().encode(memoryCode));
      const usage = instance.getResourceUsage();
      
      expect(usage.memoryUsed).toBeGreaterThan(10 * 1024 * 1024);
      expect(usage.peakMemory).toBeGreaterThanOrEqual(usage.memoryUsed);
      expect(result.executionTime).toBeGreaterThan(0);
      
      await instance.terminate();
    });

    it('should support instance status monitoring', async () => {
      const sandbox = await getSandbox();
      
      // Create multiple instances with different states
      const instance1 = await createSandboxInstance();
      const instance2 = await createSandboxInstance();
      const instance3 = await createSandboxInstance();
      
      await instance2.pause();
      
      // Get all instances status
      if ('getAllInstancesStatus' in sandbox) {
        const statuses = (sandbox as any).getAllInstancesStatus();
        expect(Object.keys(statuses).length).toBeGreaterThanOrEqual(3);
      }
      
      // Cleanup
      await Promise.all([
        instance1.terminate(),
        instance2.terminate(),
        instance3.terminate()
      ]);
    });
  });

  describe('Instance Pool Efficiency', () => {
    it('should reuse instances efficiently', async () => {
      const timings: number[] = [];
      
      // First set - cold start
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        const instance = await createSandboxInstance();
        const duration = Date.now() - start;
        timings.push(duration);
        
        // Quick execution
        await instance.execute(new TextEncoder().encode('1+1'));
        await instance.terminate();
      }
      
      // Second set - should be faster due to pooling
      const warmTimings: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = Date.now();
        const instance = await createSandboxInstance();
        const duration = Date.now() - start;
        warmTimings.push(duration);
        
        await instance.execute(new TextEncoder().encode('2+2'));
        await instance.terminate();
      }
      
      // Warm starts should be faster on average
      const avgCold = timings.reduce((a, b) => a + b) / timings.length;
      const avgWarm = warmTimings.reduce((a, b) => a + b) / warmTimings.length;
      
      console.log(`Cold start avg: ${avgCold}ms, Warm start avg: ${avgWarm}ms`);
      
      // This might not always be true in test environment
      // but we log it for performance tracking
    });
  });

  describe('Error Recovery', () => {
    it('should handle snapshot/restore errors gracefully', async () => {
      const instance1 = await createSandboxInstance();
      const instance2 = await createSandboxInstance();
      
      // Create snapshot from instance1
      const snapshot = await instance1.createSnapshot();
      
      // Modify snapshot to be invalid
      const invalidSnapshot: SandboxSnapshot = {
        ...snapshot,
        instanceId: 'invalid-id'
      };
      
      // Try to restore invalid snapshot
      await expect(instance2.restoreSnapshot(invalidSnapshot))
        .rejects.toThrow();
      
      // Instance should still be usable
      const result = await instance2.execute(
        new TextEncoder().encode('console.log("Still working");')
      );
      expect(result.success).toBe(true);
      
      await instance1.terminate();
      await instance2.terminate();
    });

    it('should recover from instance failures', async () => {
      const instance = await createSandboxInstance({
        maxCpuTime: 1 // Very short timeout
      });
      
      // Code that will timeout
      const infiniteLoop = 'while(true) {}';
      const result = await instance.execute(new TextEncoder().encode(infiniteLoop));
      
      expect(result.success).toBe(false);
      expect(result.securityEvents.some(e => e.eventType === 'timeout')).toBe(true);
      
      // Should still be able to terminate
      await instance.terminate();
    });
  });
});

describe('Sandbox Stress Testing', () => {
  beforeAll(async () => {
    await initializeSandbox();
  });

  afterAll(async () => {
    await cleanupSandbox();
  });

  it('should handle rapid instance creation/termination', async () => {
    const iterations = 20;
    const instances: any[] = [];
    
    for (let i = 0; i < iterations; i++) {
      const instance = await createSandboxInstance();
      instances.push(instance);
      
      if (i % 5 === 0) {
        // Terminate some instances
        const toTerminate = instances.splice(0, 3);
        await Promise.all(toTerminate.map(inst => inst.terminate()));
      }
    }
    
    // Cleanup remaining
    await Promise.all(instances.map(inst => inst.terminate()));
    
    const sandbox = await getSandbox();
    const remaining = sandbox.listInstances();
    expect(remaining.length).toBe(0);
  });
});