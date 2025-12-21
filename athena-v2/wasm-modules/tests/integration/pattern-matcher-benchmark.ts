import { getPatternMatcher, PatternMatcherBridge } from '../../bridge/pattern-matcher-bridge';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  testName: string;
  fileSize: number;
  fileSizeMB: number;
  scanTimeMs: number;
  throughputMBps: number;
  matchCount: number;
  threatScore: number;
  rulesEvaluated: number;
}

async function runBenchmark() {
  console.log('🚀 Pattern Matcher Performance Benchmark\n');
  
  const patternMatcher = getPatternMatcher();
  await patternMatcher.initialize();
  
  const results: BenchmarkResult[] = [];
  
  // Test 1: Small text file with multiple patterns
  console.log('Test 1: Small text file with malicious patterns...');
  const maliciousScript = generateMaliciousScript(100 * 1024); // 100KB
  await benchmarkData(patternMatcher, 'Malicious Script (100KB)', maliciousScript, results);
  
  // Test 2: Medium binary file
  console.log('\nTest 2: Medium binary file...');
  const binaryData = generateBinaryData(1 * 1024 * 1024); // 1MB
  await benchmarkData(patternMatcher, 'Binary Data (1MB)', binaryData, results);
  
  // Test 3: Large mixed content
  console.log('\nTest 3: Large mixed content file...');
  const mixedContent = generateMixedContent(10 * 1024 * 1024); // 10MB
  await benchmarkData(patternMatcher, 'Mixed Content (10MB)', mixedContent, results);
  
  // Test 4: Highly obfuscated content
  console.log('\nTest 4: Highly obfuscated content...');
  const obfuscatedContent = generateObfuscatedContent(5 * 1024 * 1024); // 5MB
  await benchmarkData(patternMatcher, 'Obfuscated Content (5MB)', obfuscatedContent, results);
  
  // Test 5: Clean file (no matches expected)
  console.log('\nTest 5: Clean file (baseline)...');
  const cleanData = generateCleanData(10 * 1024 * 1024); // 10MB
  await benchmarkData(patternMatcher, 'Clean Data (10MB)', cleanData, results);
  
  // Print summary
  console.log('\n📊 Benchmark Summary\n');
  console.log('Target: 200 MB/s pattern matching throughput\n');
  
  const headers = ['Test', 'Size (MB)', 'Time (ms)', 'Throughput (MB/s)', 'Matches', 'Threat Score'];
  const columnWidths = [30, 10, 10, 18, 10, 12];
  
  // Print headers
  console.log(headers.map((h, i) => h.padEnd(columnWidths[i])).join('| '));
  console.log(columnWidths.map(w => '-'.repeat(w - 2)).join('-|-'));
  
  // Print results
  for (const result of results) {
    const row = [
      result.testName.padEnd(columnWidths[0]),
      result.fileSizeMB.toFixed(2).padEnd(columnWidths[1]),
      result.scanTimeMs.toFixed(2).padEnd(columnWidths[2]),
      result.throughputMBps.toFixed(2).padEnd(columnWidths[3]),
      result.matchCount.toString().padEnd(columnWidths[4]),
      result.threatScore.toFixed(1).padEnd(columnWidths[5])
    ];
    console.log(row.join('| '));
  }
  
  // Calculate averages
  const avgThroughput = results.reduce((sum, r) => sum + r.throughputMBps, 0) / results.length;
  const maxThroughput = Math.max(...results.map(r => r.throughputMBps));
  const minThroughput = Math.min(...results.map(r => r.throughputMBps));
  
  console.log('\n📈 Performance Metrics:');
  console.log(`Average Throughput: ${avgThroughput.toFixed(2)} MB/s`);
  console.log(`Max Throughput: ${maxThroughput.toFixed(2)} MB/s`);
  console.log(`Min Throughput: ${minThroughput.toFixed(2)} MB/s`);
  console.log(`Target Met: ${avgThroughput >= 200 ? '✅ YES' : '❌ NO'}`);
  
  // Get stats
  const stats = patternMatcher.getStats();
  console.log('\n📊 Overall Statistics:');
  console.log(`Total Scans: ${stats.total_scans}`);
  console.log(`Total Matches: ${stats.total_matches}`);
  console.log(`Average Scan Time: ${stats.average_scan_time_ms.toFixed(2)}ms`);
  console.log(`Overall Throughput: ${stats.throughput_mbps.toFixed(2)} MB/s`);
  
  // Export results to CSV
  exportToCSV(results);
  
  patternMatcher.destroy();
}

async function benchmarkData(
  patternMatcher: PatternMatcherBridge,
  testName: string,
  data: Uint8Array,
  results: BenchmarkResult[]
) {
  const startTime = performance.now();
  const result = await patternMatcher.scan(data.buffer);
  const endTime = performance.now();
  
  const scanTimeMs = endTime - startTime;
  const fileSizeMB = data.length / (1024 * 1024);
  const throughputMBps = fileSizeMB / (scanTimeMs / 1000);
  
  const benchmarkResult: BenchmarkResult = {
    testName,
    fileSize: data.length,
    fileSizeMB,
    scanTimeMs,
    throughputMBps,
    matchCount: result.matches.length,
    threatScore: result.threat_score,
    rulesEvaluated: result.total_rules_evaluated
  };
  
  results.push(benchmarkResult);
  
  console.log(`✓ Completed: ${throughputMBps.toFixed(2)} MB/s, ${result.matches.length} matches found`);
}

function generateMaliciousScript(size: number): Uint8Array {
  const patterns = [
    'eval(atob("',
    'document.write("<script',
    'new ActiveXObject(',
    '<?php eval($_POST',
    'powershell -encodedcommand',
    'nc -e /bin/bash',
    'cmd.exe /c',
    'VirtualAlloc',
    'WriteProcessMemory'
  ];
  
  let content = '';
  while (content.length < size) {
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    content += `\n// Malicious code section\n${pattern} some_data_here();\n`;
    content += 'Some normal looking code here...\n'.repeat(10);
  }
  
  return new TextEncoder().encode(content.substring(0, size));
}

function generateBinaryData(size: number): Uint8Array {
  const data = new Uint8Array(size);
  
  // Add PE header at the beginning
  data[0] = 0x4D; // M
  data[1] = 0x5A; // Z
  
  // Add PE signature at offset 60
  if (size > 64) {
    data[60] = 0x50; // P
    data[61] = 0x45; // E
    data[62] = 0x00;
    data[63] = 0x00;
  }
  
  // Fill rest with random data
  for (let i = 64; i < size; i++) {
    data[i] = Math.floor(Math.random() * 256);
  }
  
  return data;
}

function generateMixedContent(size: number): Uint8Array {
  let content = '';
  const targetSize = size * 0.8; // Leave room for binary data
  
  // Add various types of content
  content += '<!DOCTYPE html><html><body>\n';
  content += '<script>eval(atob("YWxlcnQoMSk="));</script>\n';
  content += '<?php system($_GET["cmd"]); ?>\n';
  
  // Add obfuscated JavaScript
  content += 'var _0x1234=["\\x65\\x76\\x61\\x6c"];\n';
  
  // Add PowerShell
  content += 'powershell.exe -ExecutionPolicy Bypass -encodedcommand U3RhcnQtUHJvY2Vzcw==\n';
  
  // Add URL patterns
  content += 'http://malicious-site.com/payload.exe\n';
  content += 'https://coinhive.com/lib/coinhive.min.js\n';
  
  // Fill with Lorem ipsum
  const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
  while (content.length < targetSize) {
    content += lorem;
  }
  
  const textData = new TextEncoder().encode(content);
  const result = new Uint8Array(size);
  result.set(textData.subarray(0, Math.min(textData.length, size)));
  
  return result;
}

function generateObfuscatedContent(size: number): Uint8Array {
  let content = '';
  
  // Heavy obfuscation patterns
  const obfuscationPatterns = [
    // Hex encoded strings
    '"\\x48\\x65\\x6c\\x6c\\x6f\\x20\\x57\\x6f\\x72\\x6c\\x64"',
    // Unicode encoded
    '"\\u0048\\u0065\\u006c\\u006c\\u006f"',
    // Base64
    'atob("SGVsbG8gV29ybGQ=")',
    // Char codes
    'String.fromCharCode(72,101,108,108,111)',
    // Escaped strings
    'eval(unescape("%61%6c%65%72%74%28%31%29"))'
  ];
  
  while (content.length < size) {
    const pattern = obfuscationPatterns[Math.floor(Math.random() * obfuscationPatterns.length)];
    content += `var _${Math.random().toString(36).substr(2, 9)} = ${pattern};\n`;
  }
  
  return new TextEncoder().encode(content.substring(0, size));
}

function generateCleanData(size: number): Uint8Array {
  // Generate clean, non-malicious content
  let content = `# Clean Documentation File

This is a clean file with no malicious content. It contains only legitimate documentation and code examples.

## Introduction

This document describes the architecture of our application...

## Code Examples

Here are some legitimate code examples:

\`\`\`javascript
function calculateSum(a, b) {
  return a + b;
}

class DataProcessor {
  constructor() {
    this.data = [];
  }
  
  process(input) {
    return input.map(item => item * 2);
  }
}
\`\`\`

`;
  
  // Fill with more clean content
  while (content.length < size) {
    content += 'This is normal text content without any malicious patterns. ';
  }
  
  return new TextEncoder().encode(content.substring(0, size));
}

function exportToCSV(results: BenchmarkResult[]): void {
  const csv = [
    'Test Name,File Size (bytes),File Size (MB),Scan Time (ms),Throughput (MB/s),Match Count,Threat Score,Rules Evaluated',
    ...results.map(r => 
      `"${r.testName}",${r.fileSize},${r.fileSizeMB.toFixed(2)},${r.scanTimeMs.toFixed(2)},${r.throughputMBps.toFixed(2)},${r.matchCount},${r.threatScore.toFixed(2)},${r.rulesEvaluated}`
    )
  ].join('\n');
  
  const filename = `pattern-matcher-benchmark-${new Date().toISOString().split('T')[0]}.csv`;
  fs.writeFileSync(filename, csv);
  console.log(`\n📄 Results exported to ${filename}`);
}

// Run the benchmark
runBenchmark().catch(console.error);