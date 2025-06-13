import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createFileProcessor } from '../../bridge/file-processor-bridge';
import { getPatternMatcher } from '../../bridge/pattern-matcher-bridge';
import { DeobfuscatorBridge } from '../../bridge/deobfuscator-bridge';
import { analyzeWithWASM } from '../../../Athena/services/analysisService';

interface BenchmarkResult {
  module: string;
  operation: string;
  inputSizeMB: number;
  throughputMBps: number;
  avgTimeMs: number;
  iterations: number;
  targetMBps?: number;
  passesTarget?: boolean;
}

class AllModulesBenchmark {
  private results: BenchmarkResult[] = [];
  private fileProcessor: any;
  private patternMatcher: any;
  private deobfuscator: DeobfuscatorBridge;

  constructor() {
    this.fileProcessor = createFileProcessor();
    this.patternMatcher = getPatternMatcher();
    this.deobfuscator = DeobfuscatorBridge.getInstance();
  }

  async initialize() {
    console.log('🚀 Initializing all WASM modules...\n');
    
    await Promise.all([
      this.fileProcessor.initialize(),
      this.patternMatcher.initialize(),
      this.deobfuscator.initialize()
    ]);

    console.log('✅ All modules initialized\n');
  }

  private generateTestData(sizeMB: number, type: string): ArrayBuffer | string {
    const sizeBytes = sizeMB * 1024 * 1024;

    switch (type) {
      case 'binary':
        const buffer = new ArrayBuffer(sizeBytes);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < sizeBytes; i++) {
          view[i] = Math.floor(Math.random() * 256);
        }
        return buffer;

      case 'text':
        return 'A'.repeat(sizeBytes);

      case 'javascript':
        let js = '';
        const templates = [
          'function func_$i() { return $i * 2; }\n',
          'const var_$i = "string_value_$i";\n',
          'if (condition_$i) { console.log("log_$i"); }\n',
          'for (let i = 0; i < $i; i++) { array.push(i); }\n'
        ];
        
        while (js.length < sizeBytes) {
          const template = templates[Math.floor(Math.random() * templates.length)];
          js += template.replace(/\$i/g, Math.floor(Math.random() * 1000).toString());
        }
        return js.slice(0, sizeBytes);

      case 'malware':
        let malware = '';
        const malwarePatterns = [
          'eval(atob("base64_payload_$i"));',
          'document.cookie = "stolen_$i";',
          'fetch("http://evil-$i.com/beacon");',
          'new ActiveXObject("WScript.Shell").Run("cmd.exe");',
          'powershell -EncodedCommand $i;'
        ];
        
        while (malware.length < sizeBytes) {
          const pattern = malwarePatterns[Math.floor(Math.random() * malwarePatterns.length)];
          malware += pattern.replace(/\$i/g, Math.floor(Math.random() * 1000).toString()) + '\n';
        }
        return malware.slice(0, sizeBytes);

      default:
        return 'Default test data'.repeat(Math.floor(sizeBytes / 17));
    }
  }

  async benchmarkModule(
    moduleName: string,
    operation: string,
    testFunction: () => Promise<void>,
    inputSizeMB: number,
    iterations: number = 10,
    targetMBps?: number
  ): Promise<BenchmarkResult> {
    const times: number[] = [];

    // Warmup
    console.log(`⏱️  Warming up ${moduleName} - ${operation}...`);
    for (let i = 0; i < 3; i++) {
      await testFunction();
    }

    // Actual benchmark
    console.log(`📊 Benchmarking ${moduleName} - ${operation} (${iterations} iterations)...`);
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await testFunction();
      const end = performance.now();
      times.push(end - start);
      
      if ((i + 1) % 5 === 0) {
        console.log(`   Progress: ${i + 1}/${iterations} iterations`);
      }
    }

    const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
    const throughputMBps = (inputSizeMB / avgTimeMs) * 1000;

    const result: BenchmarkResult = {
      module: moduleName,
      operation,
      inputSizeMB,
      throughputMBps,
      avgTimeMs,
      iterations,
      targetMBps,
      passesTarget: targetMBps ? throughputMBps >= targetMBps : undefined
    };

    this.results.push(result);
    console.log(`✅ Complete: ${throughputMBps.toFixed(2)} MB/s (avg: ${avgTimeMs.toFixed(2)}ms)\n`);
    
    return result;
  }

  async runFileProcessorBenchmarks() {
    console.log('=== FILE PROCESSOR BENCHMARKS ===\n');

    // Test different file sizes and formats
    const sizes = [1, 10, 50];
    
    for (const sizeMB of sizes) {
      const binaryData = this.generateTestData(sizeMB, 'binary');
      const textData = this.generateTestData(sizeMB, 'text');
      const encoder = new TextEncoder();
      const textBuffer = encoder.encode(textData as string).buffer;

      // Format detection
      await this.benchmarkModule(
        'FileProcessor',
        `Format Detection (${sizeMB}MB binary)`,
        async () => {
          await this.fileProcessor.detectFormat(binaryData, 'test.bin');
        },
        sizeMB,
        10,
        100 // Target: 100 MB/s
      );

      // File parsing
      await this.benchmarkModule(
        'FileProcessor',
        `File Parsing (${sizeMB}MB text)`,
        async () => {
          await this.fileProcessor.parseFile(textBuffer);
        },
        sizeMB,
        10,
        100 // Target: 100 MB/s
      );

      // String extraction
      await this.benchmarkModule(
        'FileProcessor',
        `String Extraction (${sizeMB}MB binary)`,
        async () => {
          await this.fileProcessor.extractStrings(binaryData, 4);
        },
        sizeMB,
        10,
        50 // Target: 50 MB/s
      );
    }
  }

  async runPatternMatcherBenchmarks() {
    console.log('=== PATTERN MATCHER BENCHMARKS ===\n');

    // Add some rules first
    const rules = [
      `rule malware_sig1 { strings: $a = "eval(" $b = "atob(" condition: $a and $b }`,
      `rule malware_sig2 { strings: $a = /\\\\x[0-9a-fA-F]{2}/ condition: $a }`,
      `rule malware_sig3 { strings: $a = "powershell" nocase condition: $a }`
    ];

    for (const rule of rules) {
      await this.patternMatcher.addRule(rule);
    }

    const sizes = [1, 10, 50, 100];
    
    for (const sizeMB of sizes) {
      const malwareData = this.generateTestData(sizeMB, 'malware');
      const encoder = new TextEncoder();
      const buffer = encoder.encode(malwareData as string).buffer;

      await this.benchmarkModule(
        'PatternMatcher',
        `Pattern Scanning (${sizeMB}MB)`,
        async () => {
          await this.patternMatcher.scan(buffer);
        },
        sizeMB,
        sizeMB <= 10 ? 10 : 5, // Fewer iterations for large files
        200 // Target: 200 MB/s
      );
    }
  }

  async runDeobfuscatorBenchmarks() {
    console.log('=== DEOBFUSCATOR BENCHMARKS ===\n');

    const testCases = [
      {
        name: 'Base64 Detection',
        data: (sizeMB: number) => {
          const size = sizeMB * 1024 * 1024;
          let data = '';
          while (data.length < size) {
            data += Buffer.from('Hello World').toString('base64') + ' ';
          }
          return data.slice(0, size);
        },
        target: 100
      },
      {
        name: 'Hex Deobfuscation',
        data: (sizeMB: number) => {
          const size = sizeMB * 1024 * 1024;
          let data = '';
          while (data.length < size) {
            data += '\\x48\\x65\\x6c\\x6c\\x6f ';
          }
          return data.slice(0, size);
        },
        target: 50
      },
      {
        name: 'Mixed Obfuscation',
        data: (sizeMB: number) => {
          const size = sizeMB * 1024 * 1024;
          let data = '';
          const types = [
            Buffer.from('test').toString('base64'),
            '\\x74\\x65\\x73\\x74',
            '\\u0074\\u0065\\u0073\\u0074'
          ];
          while (data.length < size) {
            data += types[Math.floor(Math.random() * types.length)] + ' ';
          }
          return data.slice(0, size);
        },
        target: 50
      }
    ];

    const sizes = [1, 10, 25];

    for (const testCase of testCases) {
      for (const sizeMB of sizes) {
        const data = testCase.data(sizeMB);

        await this.benchmarkModule(
          'Deobfuscator',
          `${testCase.name} (${sizeMB}MB)`,
          async () => {
            await this.deobfuscator.deobfuscate(data);
          },
          sizeMB,
          sizeMB <= 10 ? 10 : 5,
          testCase.target
        );
      }
    }
  }

  async runIntegratedAnalysisBenchmarks() {
    console.log('=== INTEGRATED ANALYSIS BENCHMARKS ===\n');

    const testFiles = [
      {
        name: 'Simple JavaScript',
        sizeMB: 1,
        content: this.generateTestData(1, 'javascript') as string
      },
      {
        name: 'Obfuscated Malware',
        sizeMB: 5,
        content: this.generateTestData(5, 'malware') as string
      },
      {
        name: 'Large Text File',
        sizeMB: 25,
        content: this.generateTestData(25, 'text') as string
      }
    ];

    for (const file of testFiles) {
      await this.benchmarkModule(
        'Integrated Analysis',
        file.name,
        async () => {
          await analyzeWithWASM(file.content, `${file.name}.txt`);
        },
        file.sizeMB,
        5, // Fewer iterations for integrated tests
        50 // Target: 50 MB/s for complete analysis
      );
    }
  }

  printResults() {
    console.log('\n📈 FINAL BENCHMARK RESULTS\n');
    console.log('| Module | Operation | Size (MB) | Throughput (MB/s) | Avg Time (ms) | Target (MB/s) | Status |');
    console.log('|--------|-----------|-----------|-------------------|---------------|---------------|--------|');

    for (const result of this.results) {
      const status = result.passesTarget === undefined ? '-' : 
                     result.passesTarget ? '✅ PASS' : '❌ FAIL';
      const target = result.targetMBps || '-';
      
      console.log(
        `| ${result.module.padEnd(20)} | ${result.operation.padEnd(30)} | ${
          result.inputSizeMB.toString().padStart(9)
        } | ${result.throughputMBps.toFixed(2).padStart(17)} | ${
          result.avgTimeMs.toFixed(2).padStart(13)
        } | ${target.toString().padStart(13)} | ${status} |`
      );
    }

    console.log('\n📊 SUMMARY BY MODULE\n');
    
    const modules = ['FileProcessor', 'PatternMatcher', 'Deobfuscator', 'Integrated Analysis'];
    for (const module of modules) {
      const moduleResults = this.results.filter(r => r.module === module);
      if (moduleResults.length === 0) continue;

      const avgThroughput = moduleResults.reduce((sum, r) => sum + r.throughputMBps, 0) / moduleResults.length;
      const passCount = moduleResults.filter(r => r.passesTarget === true).length;
      const totalWithTarget = moduleResults.filter(r => r.passesTarget !== undefined).length;

      console.log(`${module}:`);
      console.log(`  Average Throughput: ${avgThroughput.toFixed(2)} MB/s`);
      if (totalWithTarget > 0) {
        console.log(`  Targets Met: ${passCount}/${totalWithTarget} (${((passCount/totalWithTarget) * 100).toFixed(1)}%)`);
      }
      console.log('');
    }
  }

  saveResults() {
    const benchmarkDir = '/workspaces/Athena/wasm-modules/tests/benchmarks';
    if (!existsSync(benchmarkDir)) {
      mkdirSync(benchmarkDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = join(benchmarkDir, `all-modules-benchmark-${timestamp}.csv`);

    const csv = [
      'Module,Operation,Input Size (MB),Throughput (MB/s),Avg Time (ms),Target (MB/s),Status',
      ...this.results.map(r => 
        `${r.module},${r.operation},${r.inputSizeMB},${r.throughputMBps.toFixed(2)},${
          r.avgTimeMs.toFixed(2)
        },${r.targetMBps || ''},${r.passesTarget === undefined ? '' : r.passesTarget ? 'PASS' : 'FAIL'}`
      )
    ].join('\n');

    writeFileSync(filename, csv);
    console.log(`\n💾 Results saved to: ${filename}`);
  }

  async runAllBenchmarks() {
    console.log('🏁 Starting Comprehensive WASM Module Benchmarks\n');
    console.log('This will test all Phase 2 modules against performance targets:\n');
    console.log('  • File Processor: 100 MB/s target');
    console.log('  • Pattern Matcher: 200 MB/s target');
    console.log('  • Deobfuscator: 50 MB/s target');
    console.log('  • Integrated Analysis: 50 MB/s target\n');

    const startTime = Date.now();

    await this.runFileProcessorBenchmarks();
    await this.runPatternMatcherBenchmarks();
    await this.runDeobfuscatorBenchmarks();
    await this.runIntegratedAnalysisBenchmarks();

    const totalTime = Date.now() - startTime;
    console.log(`\n⏱️  Total benchmark time: ${(totalTime / 1000).toFixed(2)} seconds`);

    this.printResults();
    this.saveResults();
  }
}

// Run benchmarks if executed directly
if (require.main === module) {
  (async () => {
    const benchmark = new AllModulesBenchmark();
    await benchmark.initialize();
    await benchmark.runAllBenchmarks();
  })().catch(console.error);
}

export { AllModulesBenchmark };