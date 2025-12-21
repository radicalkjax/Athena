import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Mock the pattern matcher bridge
vi.mock('../../bridge/pattern-matcher-bridge', () => {
  return import('../../bridge/__mocks__/pattern-matcher-bridge');
});

import { PatternMatcherBridge, getPatternMatcher, matchedDataToString } from '../../bridge/pattern-matcher-bridge';

describe('PatternMatcher WASM Integration Tests', () => {
  let patternMatcher: PatternMatcherBridge;

  beforeAll(async () => {
    patternMatcher = getPatternMatcher();
    await patternMatcher.initialize();
  });

  afterAll(() => {
    patternMatcher.destroy();
  });

  describe('Basic Functionality', () => {
    it('should initialize successfully', () => {
      expect(patternMatcher.getRuleCount()).toBeGreaterThan(0);
    });

    it('should detect JavaScript eval with base64', async () => {
      const maliciousCode = 'eval(atob("ZG9jdW1lbnQud3JpdGUoIjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD4iKQ=="))';
      const encoder = new TextEncoder();
      const data = encoder.encode(maliciousCode);
      
      const result = await patternMatcher.scan(data.buffer);
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].category).toBe('Obfuscation');
      expect(result.matches[0].severity).toBe('High');
      expect(result.threat_score).toBeGreaterThan(0);
    });

    it('should detect PHP backdoor pattern', async () => {
      const phpBackdoor = '<?php eval($_POST["cmd"]); ?>';
      const encoder = new TextEncoder();
      const data = encoder.encode(phpBackdoor);
      
      const result = await patternMatcher.scan(data.buffer);
      
      expect(result.matches.length).toBeGreaterThan(0);
      const backdoorMatch = result.matches.find(m => m.category === 'Malware');
      expect(backdoorMatch).toBeDefined();
      expect(backdoorMatch?.severity).toBe('Critical');
    });

    it('should detect PowerShell encoded command', async () => {
      const psCommand = 'powershell -encodedcommand U3RhcnQtUHJvY2VzcyBjYWxjLmV4ZQ==';
      const encoder = new TextEncoder();
      const data = encoder.encode(psCommand);
      
      const result = await patternMatcher.scan(data.buffer);
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].category).toBe('Obfuscation');
    });

    it('should handle binary patterns (PE header)', async () => {
      // Simulate a PE header
      const peHeader = new Uint8Array([
        0x4D, 0x5A, // MZ
        ...new Array(58).fill(0x00),
        0x50, 0x45, 0x00, 0x00 // PE\0\0
      ]);
      
      const result = await patternMatcher.scan(peHeader.buffer);
      
      expect(result.matches.length).toBeGreaterThan(0);
      const peMatch = result.matches.find(m => m.rule_name.includes('PE'));
      expect(peMatch).toBeDefined();
    });
  });

  describe('Custom Rules', () => {
    it('should add custom YARA-like rule', async () => {
      const customRule = `
rule custom_test_rule
{
  strings:
    $test = "CUSTOM_MALWARE_SIGNATURE"
  condition:
    $test
}`;
      
      const ruleId = await patternMatcher.addRule(customRule);
      expect(ruleId).toBeTruthy();
      
      // Test the custom rule
      const testData = 'This file contains CUSTOM_MALWARE_SIGNATURE in it';
      const encoder = new TextEncoder();
      const data = encoder.encode(testData);
      
      const result = await patternMatcher.scan(data.buffer);
      const customMatch = result.matches.find(m => m.rule_id === 'custom_test_rule');
      expect(customMatch).toBeDefined();
    });
  });

  describe('Performance', () => {
    it('should scan large data efficiently', async () => {
      // Create 10MB of random data with some patterns
      const size = 10 * 1024 * 1024;
      const data = new Uint8Array(size);
      
      // Add some malicious patterns
      const maliciousPattern = new TextEncoder().encode('eval(atob(');
      for (let i = 0; i < 100; i++) {
        const offset = Math.floor(Math.random() * (size - maliciousPattern.length));
        data.set(maliciousPattern, offset);
      }
      
      const startTime = performance.now();
      const result = await patternMatcher.scan(data.buffer);
      const endTime = performance.now();
      
      const scanTimeMs = endTime - startTime;
      const throughputMbps = (size / (1024 * 1024)) / (scanTimeMs / 1000);
      
      console.log(`Scanned ${size / (1024 * 1024)}MB in ${scanTimeMs.toFixed(2)}ms`);
      console.log(`Throughput: ${throughputMbps.toFixed(2)} MB/s`);
      
      expect(result.matches.length).toBeGreaterThan(0);
      expect(throughputMbps).toBeGreaterThan(50); // At least 50 MB/s
    });
  });

  describe('Streaming Support', () => {
    it('should scan data in streaming mode', async () => {
      // Create a readable stream with malicious content
      const chunks = [
        'This is the first chunk with eval(atob(',
        'more data here with document.write("<script"',
        'and finally some PHP: <?php eval($_POST["cmd"]); ?>'
      ];
      
      const stream = new ReadableStream({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
          controller.close();
        }
      });
      
      const results: any[] = [];
      for await (const result of patternMatcher.scanStreaming(stream)) {
        results.push(result);
      }
      
      expect(results.length).toBeGreaterThan(0);
      
      // Check that we found matches
      const allMatches = results.flatMap(r => r.matches);
      expect(allMatches.length).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should track scanning statistics', async () => {
      const stats = patternMatcher.getStats();
      
      expect(stats.total_scans).toBeGreaterThan(0);
      expect(stats.average_scan_time_ms).toBeGreaterThan(0);
      expect(stats.throughput_mbps).toBeGreaterThan(0);
    });
  });

  describe('Match Data Decoding', () => {
    it('should decode matched data correctly', async () => {
      const testString = 'This contains malware signature';
      const encoder = new TextEncoder();
      const data = encoder.encode(testString);
      
      // Add a pattern that will match "malware"
      const customRule = `
rule test_decode
{
  strings:
    $mal = "malware"
  condition:
    $mal
}`;
      
      await patternMatcher.addRule(customRule);
      const result = await patternMatcher.scan(data.buffer);
      
      const match = result.matches.find(m => m.rule_id === 'test_decode');
      expect(match).toBeDefined();
      
      if (match) {
        const decodedData = matchedDataToString(match.matched_data_base64);
        expect(decodedData).toBe('malware');
      }
    });
  });
});