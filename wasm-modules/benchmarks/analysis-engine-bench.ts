/**
 * Performance benchmarks for WASM Analysis Engine
 * Compares WASM implementation with JavaScript-based analysis
 */

import { analysisEngine, initializeAnalysisEngine } from '../bridge/analysis-engine-bridge';
import { analyzeWithWASM } from '../../Athena/services/analysisService';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  memoryUsed?: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async runBenchmark(
    name: string,
    fn: () => Promise<void>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Warm-up run
    await fn();
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
    
    const totalTime = times.reduce((a, b) => a + b, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      memoryUsed: memoryUsed > 0 ? memoryUsed : undefined
    };
    
    this.results.push(result);
    return result;
  }
  
  printResults(): void {
    console.log('\n=== WASM Analysis Engine Performance Benchmarks ===\n');
    
    for (const result of this.results) {
      console.log(`Benchmark: ${result.name}`);
      console.log(`  Iterations: ${result.iterations}`);
      console.log(`  Average Time: ${result.averageTime.toFixed(2)}ms`);
      console.log(`  Min Time: ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max Time: ${result.maxTime.toFixed(2)}ms`);
      console.log(`  Total Time: ${result.totalTime.toFixed(2)}ms`);
      if (result.memoryUsed) {
        console.log(`  Memory Used: ${result.memoryUsed.toFixed(2)}MB`);
      }
      console.log(`  Throughput: ${(1000 / result.averageTime).toFixed(2)} ops/sec`);
      console.log();
    }
  }
  
  exportCSV(filename: string): void {
    const headers = ['Benchmark', 'Iterations', 'Avg Time (ms)', 'Min Time (ms)', 'Max Time (ms)', 'Total Time (ms)', 'Memory (MB)', 'Throughput (ops/sec)'];
    const rows = this.results.map(r => [
      r.name,
      r.iterations,
      r.averageTime.toFixed(2),
      r.minTime.toFixed(2),
      r.maxTime.toFixed(2),
      r.totalTime.toFixed(2),
      r.memoryUsed?.toFixed(2) || 'N/A',
      (1000 / r.averageTime).toFixed(2)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    fs.writeFileSync(filename, csv);
    console.log(`Results exported to ${filename}`);
  }
}

// Sample malware patterns for testing
const SAMPLE_PATTERNS = {
  smallObfuscated: `
    eval(atob('YWxlcnQoIlhTUyBBdHRhY2shIik7'));
    document.write("<script>alert('injection')</script>");
  `,
  
  mediumObfuscated: `
    var _0x1234 = ['log', 'Hello', 'World'];
    var _0x5678 = function(_0x9abc, _0xdef0) {
      _0x9abc = _0x9abc - 0x0;
      var _0x1111 = _0x1234[_0x9abc];
      return _0x1111;
    };
    console[_0x5678('0x0')](_0x5678('0x1') + ' ' + _0x5678('0x2'));
    ${Array(50).fill('eval(String.fromCharCode(97,108,101,114,116));').join('\n')}
  `,
  
  largeObfuscated: `
    ${Array(100).fill(`
      var malicious = String.fromCharCode(0x61,0x6c,0x65,0x72,0x74,0x28,0x22,0x58,0x53,0x53,0x22,0x29);
      eval(malicious);
      document.write("<iframe src='http://evil.com'></iframe>");
      var miner = new CoinHive.Anonymous('SITE_KEY');
      miner.start();
    `).join('\n')}
  `,
  
  binaryPattern: Buffer.from([
    0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, // PE header
    ...Array(1000).fill(0x00), // Padding
    0x75, 0x73, 0x65, 0x72, 0x33, 0x32, 0x2E, 0x64, 0x6C, 0x6C // user32.dll
  ]).toString()
};

async function main() {
  console.log('Initializing WASM Analysis Engine...');
  await initializeAnalysisEngine();
  
  const benchmark = new PerformanceBenchmark();
  
  // Test 1: Small obfuscated code
  console.log('\nRunning benchmark: Small obfuscated code...');
  await benchmark.runBenchmark('WASM - Small Obfuscated', async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(SAMPLE_PATTERNS.smallObfuscated).buffer;
    await analysisEngine.analyze(buffer);
  });
  
  // Test 2: Medium obfuscated code
  console.log('Running benchmark: Medium obfuscated code...');
  await benchmark.runBenchmark('WASM - Medium Obfuscated', async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(SAMPLE_PATTERNS.mediumObfuscated).buffer;
    await analysisEngine.analyze(buffer);
  }, 50);
  
  // Test 3: Large obfuscated code
  console.log('Running benchmark: Large obfuscated code...');
  await benchmark.runBenchmark('WASM - Large Obfuscated', async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(SAMPLE_PATTERNS.largeObfuscated).buffer;
    await analysisEngine.analyze(buffer);
  }, 20);
  
  // Test 4: Binary pattern detection
  console.log('Running benchmark: Binary pattern detection...');
  await benchmark.runBenchmark('WASM - Binary Pattern', async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(SAMPLE_PATTERNS.binaryPattern).buffer;
    await analysisEngine.analyze(buffer);
  });
  
  // Test 5: Integration test via TypeScript service
  console.log('Running benchmark: TypeScript service integration...');
  await benchmark.runBenchmark('Service Integration', async () => {
    await analyzeWithWASM(SAMPLE_PATTERNS.mediumObfuscated, 'test.js');
  }, 20);
  
  // Test 6: Pattern matching throughput
  const largeFile = Array(1000).fill(SAMPLE_PATTERNS.mediumObfuscated).join('\n');
  const largeFileSize = new TextEncoder().encode(largeFile).length / 1024 / 1024; // MB
  
  console.log(`Running benchmark: Pattern matching throughput (${largeFileSize.toFixed(2)}MB file)...`);
  const throughputResult = await benchmark.runBenchmark('WASM - Throughput Test', async () => {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(largeFile).buffer;
    await analysisEngine.analyze(buffer);
  }, 5);
  
  const throughputMBps = (largeFileSize / throughputResult.averageTime) * 1000;
  console.log(`Pattern matching throughput: ${throughputMBps.toFixed(2)} MB/s`);
  
  // Print results
  benchmark.printResults();
  
  // Export to CSV
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const csvPath = path.join(__dirname, `benchmark-results-${timestamp}.csv`);
  benchmark.exportCSV(csvPath);
  
  // Compare with target metrics
  console.log('\n=== Performance vs Target Metrics ===\n');
  console.log('Target: 2x improvement in file analysis speed');
  console.log('Target: 50% reduction in memory usage');
  console.log('Target: <100ms startup time');
  console.log('Target: 100MB/s pattern matching throughput');
  console.log(`\nActual throughput: ${throughputMBps.toFixed(2)} MB/s`);
  
  if (throughputMBps >= 100) {
    console.log('✓ Pattern matching throughput target achieved!');
  } else {
    console.log(`✗ Pattern matching throughput below target (${(100 - throughputMBps).toFixed(2)} MB/s short)`);
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { PerformanceBenchmark, SAMPLE_PATTERNS };