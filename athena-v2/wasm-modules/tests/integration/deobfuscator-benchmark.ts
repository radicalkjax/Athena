import { performance } from 'perf_hooks';
import { writeFileSync } from 'fs';
import { DeobfuscatorBridge } from '../../bridge/deobfuscator-bridge';

interface BenchmarkResult {
  name: string;
  throughputMBps: number;
  avgTimeMs: number;
  iterations: number;
  inputSizeMB: number;
}

class DeobfuscatorBenchmark {
  private deobfuscator: DeobfuscatorBridge;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.deobfuscator = DeobfuscatorBridge.getInstance();
  }

  async initialize() {
    await this.deobfuscator.initialize();
  }

  private generateTestData(sizeMB: number, type: 'base64' | 'hex' | 'unicode' | 'mixed'): string {
    const sizeBytes = sizeMB * 1024 * 1024;
    let data = '';

    switch (type) {
      case 'base64':
        // Generate random data and base64 encode
        const randomData = Buffer.alloc(Math.floor(sizeBytes * 0.75)); // Account for base64 expansion
        for (let i = 0; i < randomData.length; i++) {
          randomData[i] = Math.floor(Math.random() * 256);
        }
        data = randomData.toString('base64');
        break;

      case 'hex':
        // Generate hex encoded data
        for (let i = 0; i < sizeBytes / 4; i++) {
          const byte = Math.floor(Math.random() * 256);
          data += '\\x' + byte.toString(16).padStart(2, '0');
        }
        break;

      case 'unicode':
        // Generate unicode escape sequences
        for (let i = 0; i < sizeBytes / 6; i++) {
          const char = String.fromCharCode(65 + (i % 26)); // A-Z
          data += '\\u00' + char.charCodeAt(0).toString(16);
        }
        break;

      case 'mixed':
        // Mix of different obfuscation types
        const third = Math.floor(sizeBytes / 3);
        data = this.generateTestData(third / (1024 * 1024), 'base64');
        data += this.generateTestData(third / (1024 * 1024), 'hex');
        data += this.generateTestData(third / (1024 * 1024), 'unicode');
        break;
    }

    return data;
  }

  async benchmarkDetection(name: string, data: string, iterations: number = 10): Promise<BenchmarkResult> {
    const times: number[] = [];
    const inputSizeMB = data.length / (1024 * 1024);

    // Warmup
    for (let i = 0; i < 3; i++) {
      await this.deobfuscator.detectObfuscation(data);
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.deobfuscator.detectObfuscation(data);
      const end = performance.now();
      times.push(end - start);
    }

    const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
    const throughputMBps = (inputSizeMB / avgTimeMs) * 1000;

    const result: BenchmarkResult = {
      name: `Detection: ${name}`,
      throughputMBps,
      avgTimeMs,
      iterations,
      inputSizeMB
    };

    this.results.push(result);
    return result;
  }

  async benchmarkDeobfuscation(name: string, data: string, iterations: number = 10): Promise<BenchmarkResult> {
    const times: number[] = [];
    const inputSizeMB = data.length / (1024 * 1024);

    // Warmup
    for (let i = 0; i < 3; i++) {
      await this.deobfuscator.deobfuscate(data);
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.deobfuscator.deobfuscate(data);
      const end = performance.now();
      times.push(end - start);
    }

    const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
    const throughputMBps = (inputSizeMB / avgTimeMs) * 1000;

    const result: BenchmarkResult = {
      name: `Deobfuscation: ${name}`,
      throughputMBps,
      avgTimeMs,
      iterations,
      inputSizeMB
    };

    this.results.push(result);
    return result;
  }

  async benchmarkEntropy(sizeMB: number, iterations: number = 10): Promise<BenchmarkResult> {
    const data = Buffer.alloc(sizeMB * 1024 * 1024);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    const stringData = data.toString('base64');

    const times: number[] = [];

    // Warmup
    for (let i = 0; i < 3; i++) {
      await this.deobfuscator.analyzeEntropy(stringData);
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await this.deobfuscator.analyzeEntropy(stringData);
      const end = performance.now();
      times.push(end - start);
    }

    const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
    const throughputMBps = (sizeMB / avgTimeMs) * 1000;

    const result: BenchmarkResult = {
      name: `Entropy Analysis: ${sizeMB}MB`,
      throughputMBps,
      avgTimeMs,
      iterations,
      inputSizeMB: sizeMB
    };

    this.results.push(result);
    return result;
  }

  async runAllBenchmarks() {
    console.log('🏁 Starting Deobfuscator Performance Benchmarks...\n');

    // Small data benchmarks (1MB)
    console.log('📊 Testing 1MB inputs...');
    const base64_1mb = this.generateTestData(1, 'base64');
    await this.benchmarkDetection('Base64 1MB', base64_1mb);
    await this.benchmarkDeobfuscation('Base64 1MB', base64_1mb);

    const hex_1mb = this.generateTestData(1, 'hex');
    await this.benchmarkDetection('Hex 1MB', hex_1mb);
    await this.benchmarkDeobfuscation('Hex 1MB', hex_1mb);

    // Medium data benchmarks (10MB)
    console.log('📊 Testing 10MB inputs...');
    const base64_10mb = this.generateTestData(10, 'base64');
    await this.benchmarkDetection('Base64 10MB', base64_10mb);
    await this.benchmarkDeobfuscation('Base64 10MB', base64_10mb);

    // Large data benchmarks (50MB)
    console.log('📊 Testing 50MB inputs...');
    const mixed_50mb = this.generateTestData(50, 'mixed');
    await this.benchmarkDetection('Mixed 50MB', mixed_50mb);
    await this.benchmarkDeobfuscation('Mixed 50MB', mixed_50mb, 5); // Fewer iterations for large data

    // Entropy analysis benchmarks
    console.log('📊 Testing entropy analysis...');
    await this.benchmarkEntropy(1);
    await this.benchmarkEntropy(10);
    await this.benchmarkEntropy(50, 5);

    // Multi-layer deobfuscation benchmark
    console.log('📊 Testing multi-layer deobfuscation...');
    let multilayer = 'Hello World';
    for (let i = 0; i < 5; i++) {
      multilayer = Buffer.from(multilayer).toString('base64');
    }
    await this.benchmarkDeobfuscation('5-layer Base64', multilayer, 100);

    this.printResults();
    this.saveResults();
  }

  private printResults() {
    console.log('\n📈 Benchmark Results:\n');
    console.log('| Test Name | Throughput (MB/s) | Avg Time (ms) | Input Size (MB) |');
    console.log('|-----------|-------------------|---------------|-----------------|');

    for (const result of this.results) {
      console.log(
        `| ${result.name.padEnd(25)} | ${result.throughputMBps.toFixed(2).padStart(17)} | ${
          result.avgTimeMs.toFixed(2).padStart(13)
        } | ${result.inputSizeMB.toFixed(2).padStart(15)} |`
      );
    }

    // Check against targets
    console.log('\n🎯 Performance vs Targets:');
    const deobResults = this.results.filter(r => r.name.includes('Deobfuscation'));
    const avgThroughput = deobResults.reduce((sum, r) => sum + r.throughputMBps, 0) / deobResults.length;
    
    console.log(`Average Deobfuscation Throughput: ${avgThroughput.toFixed(2)} MB/s`);
    console.log(`Target: 50 MB/s`);
    console.log(`Status: ${avgThroughput >= 50 ? '✅ PASS' : '❌ BELOW TARGET'}`);
  }

  private saveResults() {
    const csv = [
      'Test Name,Throughput (MB/s),Avg Time (ms),Input Size (MB)',
      ...this.results.map(r => 
        `${r.name},${r.throughputMBps.toFixed(2)},${r.avgTimeMs.toFixed(2)},${r.inputSizeMB.toFixed(2)}`
      )
    ].join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `/workspaces/Athena/wasm-modules/tests/benchmarks/deobfuscator-benchmark-${timestamp}.csv`;
    
    writeFileSync(filename, csv);
    console.log(`\n💾 Results saved to: ${filename}`);
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  (async () => {
    const benchmark = new DeobfuscatorBenchmark();
    await benchmark.initialize();
    await benchmark.runAllBenchmarks();
  })().catch(console.error);
}

export { DeobfuscatorBenchmark };