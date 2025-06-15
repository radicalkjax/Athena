"use strict";
/**
 * Performance benchmarks for WASM Analysis Engine
 * Compares WASM implementation with JavaScript-based analysis
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.SAMPLE_PATTERNS = exports.PerformanceBenchmark = void 0;
const analysis_engine_bridge_1 = require("../bridge/analysis-engine-bridge");
const analysisService_1 = require("../../Athena/services/analysisService");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class PerformanceBenchmark {
    constructor() {
        this.results = [];
    }
    runBenchmark(name_1, fn_1) {
        return __awaiter(this, arguments, void 0, function* (name, fn, iterations = 100) {
            const times = [];
            const initialMemory = process.memoryUsage().heapUsed;
            // Warm-up run
            yield fn();
            for (let i = 0; i < iterations; i++) {
                const start = performance.now();
                yield fn();
                const end = performance.now();
                times.push(end - start);
            }
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryUsed = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB
            const totalTime = times.reduce((a, b) => a + b, 0);
            const averageTime = totalTime / iterations;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const result = {
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
        });
    }
    printResults() {
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
    exportCSV(filename) {
        const headers = ['Benchmark', 'Iterations', 'Avg Time (ms)', 'Min Time (ms)', 'Max Time (ms)', 'Total Time (ms)', 'Memory (MB)', 'Throughput (ops/sec)'];
        const rows = this.results.map(r => {
            var _a;
            return [
                r.name,
                r.iterations,
                r.averageTime.toFixed(2),
                r.minTime.toFixed(2),
                r.maxTime.toFixed(2),
                r.totalTime.toFixed(2),
                ((_a = r.memoryUsed) === null || _a === void 0 ? void 0 : _a.toFixed(2)) || 'N/A',
                (1000 / r.averageTime).toFixed(2)
            ];
        });
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        fs.writeFileSync(filename, csv);
        console.log(`Results exported to ${filename}`);
    }
}
exports.PerformanceBenchmark = PerformanceBenchmark;
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
exports.SAMPLE_PATTERNS = SAMPLE_PATTERNS;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Initializing WASM Analysis Engine...');
        yield (0, analysis_engine_bridge_1.initializeAnalysisEngine)();
        const benchmark = new PerformanceBenchmark();
        // Test 1: Small obfuscated code
        console.log('\nRunning benchmark: Small obfuscated code...');
        yield benchmark.runBenchmark('WASM - Small Obfuscated', () => __awaiter(this, void 0, void 0, function* () {
            const encoder = new TextEncoder();
            const buffer = encoder.encode(SAMPLE_PATTERNS.smallObfuscated).buffer;
            yield analysis_engine_bridge_1.analysisEngine.analyze(buffer);
        }));
        // Test 2: Medium obfuscated code
        console.log('Running benchmark: Medium obfuscated code...');
        yield benchmark.runBenchmark('WASM - Medium Obfuscated', () => __awaiter(this, void 0, void 0, function* () {
            const encoder = new TextEncoder();
            const buffer = encoder.encode(SAMPLE_PATTERNS.mediumObfuscated).buffer;
            yield analysis_engine_bridge_1.analysisEngine.analyze(buffer);
        }), 50);
        // Test 3: Large obfuscated code
        console.log('Running benchmark: Large obfuscated code...');
        yield benchmark.runBenchmark('WASM - Large Obfuscated', () => __awaiter(this, void 0, void 0, function* () {
            const encoder = new TextEncoder();
            const buffer = encoder.encode(SAMPLE_PATTERNS.largeObfuscated).buffer;
            yield analysis_engine_bridge_1.analysisEngine.analyze(buffer);
        }), 20);
        // Test 4: Binary pattern detection
        console.log('Running benchmark: Binary pattern detection...');
        yield benchmark.runBenchmark('WASM - Binary Pattern', () => __awaiter(this, void 0, void 0, function* () {
            const encoder = new TextEncoder();
            const buffer = encoder.encode(SAMPLE_PATTERNS.binaryPattern).buffer;
            yield analysis_engine_bridge_1.analysisEngine.analyze(buffer);
        }));
        // Test 5: Integration test via TypeScript service
        console.log('Running benchmark: TypeScript service integration...');
        yield benchmark.runBenchmark('Service Integration', () => __awaiter(this, void 0, void 0, function* () {
            yield (0, analysisService_1.analyzeWithWASM)(SAMPLE_PATTERNS.mediumObfuscated, 'test.js');
        }), 20);
        // Test 6: Pattern matching throughput
        const largeFile = Array(1000).fill(SAMPLE_PATTERNS.mediumObfuscated).join('\n');
        const largeFileSize = new TextEncoder().encode(largeFile).length / 1024 / 1024; // MB
        console.log(`Running benchmark: Pattern matching throughput (${largeFileSize.toFixed(2)}MB file)...`);
        const throughputResult = yield benchmark.runBenchmark('WASM - Throughput Test', () => __awaiter(this, void 0, void 0, function* () {
            const encoder = new TextEncoder();
            const buffer = encoder.encode(largeFile).buffer;
            yield analysis_engine_bridge_1.analysisEngine.analyze(buffer);
        }), 5);
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
        }
        else {
            console.log(`✗ Pattern matching throughput below target (${(100 - throughputMBps).toFixed(2)} MB/s short)`);
        }
    });
}
// Run benchmarks if called directly
if (require.main === module) {
    main().catch(console.error);
}
