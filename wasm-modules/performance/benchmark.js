"use strict";
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
exports.WASMBenchmark = void 0;
const perf_hooks_1 = require("perf_hooks");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// Import WASM bridges
const analysis_engine_bridge_enhanced_1 = require("../bridge/analysis-engine-bridge-enhanced");
const deobfuscator_bridge_1 = require("../bridge/deobfuscator-bridge");
const file_processor_bridge_1 = require("../bridge/file-processor-bridge");
const pattern_matcher_bridge_1 = require("../bridge/pattern-matcher-bridge");
const crypto_bridge_1 = require("../bridge/crypto-bridge");
const network_bridge_1 = require("../bridge/network-bridge");
const sandbox_bridge_1 = require("../bridge/sandbox-bridge");
class WASMBenchmark {
    constructor() {
        this.results = [];
    }
    runAllBenchmarks() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🚀 Starting WASM Performance Benchmarks...\n');
            // Initialize all bridges
            yield this.initializeBridges();
            // Run benchmarks for each module
            yield this.benchmarkAnalysisEngine();
            yield this.benchmarkDeobfuscator();
            yield this.benchmarkFileProcessor();
            yield this.benchmarkPatternMatcher();
            yield this.benchmarkCrypto();
            yield this.benchmarkNetwork();
            yield this.benchmarkSandbox();
            // Print results
            this.printResults();
            this.saveResults();
        });
    }
    initializeBridges() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Initializing WASM bridges...');
            const start = perf_hooks_1.performance.now();
            // Initialize bridges with proper patterns
            const deobfuscator = yield deobfuscator_bridge_1.DeobfuscatorBridge.getInstance();
            const fileProcessor = yield (0, file_processor_bridge_1.createFileProcessor)();
            yield Promise.all([
                analysis_engine_bridge_enhanced_1.analysisEngine.initialize(),
                deobfuscator.initialize(),
                fileProcessor.initialize(),
                (0, pattern_matcher_bridge_1.getPatternMatcher)().initialize(),
                crypto_bridge_1.cryptoBridge.initialize(),
                (0, network_bridge_1.getNetworkBridge)().initialize(),
                (0, sandbox_bridge_1.getSandbox)()
            ]);
            const initTime = perf_hooks_1.performance.now() - start;
            console.log(`✅ All bridges initialized in ${initTime.toFixed(2)}ms\n`);
        });
    }
    benchmark(module_1, operation_1, fn_1) {
        return __awaiter(this, arguments, void 0, function* (module, operation, fn, iterations = 1000) {
            const times = [];
            // Warmup
            for (let i = 0; i < 10; i++) {
                yield fn();
            }
            // Actual benchmark
            for (let i = 0; i < iterations; i++) {
                const start = perf_hooks_1.performance.now();
                yield fn();
                const end = perf_hooks_1.performance.now();
                times.push(end - start);
            }
            const totalTime = times.reduce((a, b) => a + b, 0);
            const avgTime = totalTime / iterations;
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            const opsPerSecond = 1000 / avgTime;
            const result = {
                module,
                operation,
                iterations,
                totalTime,
                avgTime,
                minTime,
                maxTime,
                opsPerSecond
            };
            this.results.push(result);
            return result;
        });
    }
    benchmarkAnalysisEngine() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('📊 Benchmarking Analysis Engine...');
            const engine = analysis_engine_bridge_enhanced_1.analysisEngine;
            const testData = new TextEncoder().encode('function test() { eval("malicious code"); }');
            yield this.benchmark('AnalysisEngine', 'analyze', () => __awaiter(this, void 0, void 0, function* () { return yield engine.analyze(testData); }), 100);
            yield this.benchmark('AnalysisEngine', 'scan_patterns', () => __awaiter(this, void 0, void 0, function* () { return yield engine.scan_patterns(testData); }), 100);
        });
    }
    benchmarkDeobfuscator() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔓 Benchmarking Deobfuscator...');
            const deobfuscator = yield deobfuscator_bridge_1.DeobfuscatorBridge.getInstance();
            const obfuscatedCode = `var _0x1234=['log','Hello'];(function(_0x5678,_0x9abc){console[_0x1234[0]](_0x1234[1]);}());`;
            yield this.benchmark('Deobfuscator', 'deobfuscate', () => __awaiter(this, void 0, void 0, function* () { return yield deobfuscator.deobfuscate(obfuscatedCode); }), 500);
            yield this.benchmark('Deobfuscator', 'detectObfuscation', () => __awaiter(this, void 0, void 0, function* () { return yield deobfuscator.detectObfuscation(obfuscatedCode); }), 1000);
        });
    }
    benchmarkFileProcessor() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('📁 Benchmarking File Processor...');
            const processor = yield (0, file_processor_bridge_1.createFileProcessor)();
            yield processor.initialize();
            const testFile = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // PE header
            const buffer = testFile.buffer;
            yield this.benchmark('FileProcessor', 'parseFile', () => __awaiter(this, void 0, void 0, function* () { return yield processor.parseFile(buffer); }), 500);
            yield this.benchmark('FileProcessor', 'extractMetadata', () => __awaiter(this, void 0, void 0, function* () { return yield processor.extractMetadata(buffer); }), 1000);
        });
    }
    benchmarkPatternMatcher() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔍 Benchmarking Pattern Matcher...');
            const matcher = (0, pattern_matcher_bridge_1.getPatternMatcher)();
            const testData = 'malware.exe downloaded from http://evil.com';
            const buffer = new TextEncoder().encode(testData).buffer;
            yield this.benchmark('PatternMatcher', 'scan', () => __awaiter(this, void 0, void 0, function* () { return yield matcher.scan(buffer); }), 1000);
            yield this.benchmark('PatternMatcher', 'getRuleCount', () => __awaiter(this, void 0, void 0, function* () { return Promise.resolve(matcher.getRuleCount()); }), 10000);
        });
    }
    benchmarkCrypto() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔐 Benchmarking Crypto...');
            const crypto = crypto_bridge_1.cryptoBridge;
            const testData = new TextEncoder().encode('sensitive data to encrypt');
            yield this.benchmark('Crypto', 'hash', () => __awaiter(this, void 0, void 0, function* () { return crypto.hash(testData, { algorithm: 'sha256' }); }), 5000);
            const key = crypto.generateAESKey(256);
            const encrypted = yield crypto.encryptAES(key, testData, { algorithm: 'aes-256-gcm' });
            yield this.benchmark('Crypto', 'encryptAES', () => __awaiter(this, void 0, void 0, function* () { return yield crypto.encryptAES(key, testData, { algorithm: 'aes-256-gcm' }); }), 1000);
            yield this.benchmark('Crypto', 'decryptAES', () => __awaiter(this, void 0, void 0, function* () { return yield crypto.decryptAES(key, encrypted, { algorithm: 'aes-256-gcm' }); }), 1000);
        });
    }
    benchmarkNetwork() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🌐 Benchmarking Network...');
            const network = (0, network_bridge_1.getNetworkBridge)();
            const packet = new Uint8Array([0x45, 0x00, 0x00, 0x3c]); // IP packet
            yield this.benchmark('Network', 'analyzePacket', () => __awaiter(this, void 0, void 0, function* () { return yield network.analyzePacket(packet); }), 1000);
            const packetAnalysis = yield network.analyzePacket(packet);
            yield this.benchmark('Network', 'detectAnomalies', () => __awaiter(this, void 0, void 0, function* () { return yield network.detectAnomalies([packetAnalysis]); }), 500);
        });
    }
    benchmarkSandbox() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('📦 Benchmarking Sandbox...');
            const sandbox = yield (0, sandbox_bridge_1.getSandbox)();
            const testCode = new TextEncoder().encode('console.log("test");');
            yield this.benchmark('Sandbox', 'execute', () => __awaiter(this, void 0, void 0, function* () { return yield sandbox.execute(testCode, { maxCpuTime: 1 }); }), 100);
            yield this.benchmark('Sandbox', 'create', () => __awaiter(this, void 0, void 0, function* () { return yield sandbox.create({ maxMemory: 64 * 1024 * 1024 }); }), 100);
        });
    }
    printResults() {
        console.log('\n📈 BENCHMARK RESULTS\n');
        console.log('Module            | Operation          | Avg Time (ms) | Ops/sec | Min (ms) | Max (ms)');
        console.log('------------------|-------------------|---------------|---------|----------|----------');
        for (const result of this.results) {
            console.log(`${result.module.padEnd(17)} | ${result.operation.padEnd(17)} | ${result.avgTime.toFixed(3).padStart(13)} | ${result.opsPerSecond.toFixed(0).padStart(7)} | ${result.minTime.toFixed(3).padStart(8)} | ${result.maxTime.toFixed(3).padStart(8)}`);
        }
        console.log('\n📊 SUMMARY STATISTICS\n');
        // Group by module
        const moduleStats = new Map();
        for (const result of this.results) {
            if (!moduleStats.has(result.module)) {
                moduleStats.set(result.module, { totalOps: 0, avgTime: 0 });
            }
            const stats = moduleStats.get(result.module);
            stats.totalOps += result.opsPerSecond;
            stats.avgTime += result.avgTime;
        }
        console.log('Module            | Total Ops/sec | Avg Response (ms)');
        console.log('------------------|---------------|------------------');
        for (const [module, stats] of moduleStats) {
            const operationCount = this.results.filter(r => r.module === module).length;
            console.log(`${module.padEnd(17)} | ${stats.totalOps.toFixed(0).padStart(13)} | ${(stats.avgTime / operationCount).toFixed(3).padStart(17)}`);
        }
    }
    saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.join(process.cwd(), 'wasm-modules', 'performance', `benchmark-results-${timestamp}.json`);
        const report = {
            timestamp: new Date().toISOString(),
            platform: process.platform,
            nodeVersion: process.version,
            results: this.results,
            summary: {
                totalModules: new Set(this.results.map(r => r.module)).size,
                totalOperations: this.results.length,
                avgResponseTime: this.results.reduce((sum, r) => sum + r.avgTime, 0) / this.results.length,
                totalOpsPerSecond: this.results.reduce((sum, r) => sum + r.opsPerSecond, 0)
            }
        };
        fs.writeFileSync(filename, JSON.stringify(report, null, 2));
        console.log(`\n💾 Results saved to: ${filename}`);
    }
}
exports.WASMBenchmark = WASMBenchmark;
// Run benchmarks
if (require.main === module) {
    const benchmark = new WASMBenchmark();
    benchmark.runAllBenchmarks().catch(console.error);
}
