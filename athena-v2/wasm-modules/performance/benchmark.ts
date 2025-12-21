import { performance } from 'perf_hooks';
import * as path from 'path';
import * as fs from 'fs';

// Import WASM bridges
import { analysisEngine } from '../bridge/analysis-engine-bridge-enhanced';
import { DeobfuscatorBridge } from '../bridge/deobfuscator-bridge';
import { createFileProcessor } from '../bridge/file-processor-bridge';
import { getPatternMatcher } from '../bridge/pattern-matcher-bridge';
import { cryptoBridge } from '../bridge/crypto-bridge';
import { getNetworkBridge } from '../bridge/network-bridge';
import { getSandbox } from '../bridge/sandbox-bridge';

interface BenchmarkResult {
    module: string;
    operation: string;
    iterations: number;
    totalTime: number;
    avgTime: number;
    minTime: number;
    maxTime: number;
    opsPerSecond: number;
}

class WASMBenchmark {
    private results: BenchmarkResult[] = [];

    async runAllBenchmarks() {
        console.log('🚀 Starting WASM Performance Benchmarks...\n');
        
        // Initialize all bridges
        await this.initializeBridges();
        
        // Run benchmarks for each module
        await this.benchmarkAnalysisEngine();
        await this.benchmarkDeobfuscator();
        await this.benchmarkFileProcessor();
        await this.benchmarkPatternMatcher();
        await this.benchmarkCrypto();
        await this.benchmarkNetwork();
        await this.benchmarkSandbox();
        
        // Print results
        this.printResults();
        this.saveResults();
    }

    private async initializeBridges() {
        console.log('Initializing WASM bridges...');
        const start = performance.now();
        
        // Initialize bridges with proper patterns
        const deobfuscator = await DeobfuscatorBridge.getInstance();
        const fileProcessor = await createFileProcessor();
        
        await Promise.all([
            analysisEngine.initialize(),
            deobfuscator.initialize(),
            fileProcessor.initialize(),
            getPatternMatcher().initialize(),
            cryptoBridge.initialize(),
            getNetworkBridge().initialize(),
            getSandbox()
        ]);
        
        const initTime = performance.now() - start;
        console.log(`✅ All bridges initialized in ${initTime.toFixed(2)}ms\n`);
    }

    private async benchmark(
        module: string,
        operation: string,
        fn: () => Promise<any>,
        iterations: number = 1000
    ): Promise<BenchmarkResult> {
        const times: number[] = [];
        
        // Warmup
        for (let i = 0; i < 10; i++) {
            await fn();
        }
        
        // Actual benchmark
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            await fn();
            const end = performance.now();
            times.push(end - start);
        }
        
        const totalTime = times.reduce((a, b) => a + b, 0);
        const avgTime = totalTime / iterations;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const opsPerSecond = 1000 / avgTime;
        
        const result: BenchmarkResult = {
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
    }

    private async benchmarkAnalysisEngine() {
        console.log('📊 Benchmarking Analysis Engine...');
        const engine = analysisEngine;
        
        const testData = new TextEncoder().encode('function test() { eval("malicious code"); }');
        
        await this.benchmark(
            'AnalysisEngine',
            'analyze',
            async () => await engine.analyze(testData),
            100
        );
        
        await this.benchmark(
            'AnalysisEngine',
            'scan_patterns',
            async () => await engine.scan_patterns(testData),
            100
        );
    }

    private async benchmarkDeobfuscator() {
        console.log('🔓 Benchmarking Deobfuscator...');
        const deobfuscator = await DeobfuscatorBridge.getInstance();
        
        const obfuscatedCode = `var _0x1234=['log','Hello'];(function(_0x5678,_0x9abc){console[_0x1234[0]](_0x1234[1]);}());`;
        
        await this.benchmark(
            'Deobfuscator',
            'deobfuscate',
            async () => await deobfuscator.deobfuscate(obfuscatedCode),
            500
        );
        
        await this.benchmark(
            'Deobfuscator',
            'detectObfuscation',
            async () => await deobfuscator.detectObfuscation(obfuscatedCode),
            1000
        );
    }

    private async benchmarkFileProcessor() {
        console.log('📁 Benchmarking File Processor...');
        const processor = await createFileProcessor();
        await processor.initialize();
        
        const testFile = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // PE header
        const buffer = testFile.buffer;
        
        await this.benchmark(
            'FileProcessor',
            'parseFile',
            async () => await processor.parseFile(buffer),
            500
        );
        
        await this.benchmark(
            'FileProcessor',
            'extractMetadata',
            async () => await processor.extractMetadata(buffer),
            1000
        );
    }

    private async benchmarkPatternMatcher() {
        console.log('🔍 Benchmarking Pattern Matcher...');
        const matcher = getPatternMatcher();
        
        const testData = 'malware.exe downloaded from http://evil.com';
        const buffer = new TextEncoder().encode(testData).buffer;
        
        await this.benchmark(
            'PatternMatcher',
            'scan',
            async () => await matcher.scan(buffer),
            1000
        );
        
        await this.benchmark(
            'PatternMatcher',
            'getRuleCount',
            async () => Promise.resolve(matcher.getRuleCount()),
            10000
        );
    }

    private async benchmarkCrypto() {
        console.log('🔐 Benchmarking Crypto...');
        const crypto = cryptoBridge;
        
        const testData = new TextEncoder().encode('sensitive data to encrypt');
        
        await this.benchmark(
            'Crypto',
            'hash',
            async () => crypto.hash(testData, { algorithm: 'sha256' }),
            5000
        );
        
        const key = crypto.generateAESKey(256);
        const encrypted = await crypto.encryptAES(key, testData, { algorithm: 'aes-256-gcm' });
        
        await this.benchmark(
            'Crypto',
            'encryptAES',
            async () => await crypto.encryptAES(key, testData, { algorithm: 'aes-256-gcm' }),
            1000
        );
        
        await this.benchmark(
            'Crypto',
            'decryptAES',
            async () => await crypto.decryptAES(key, encrypted, { algorithm: 'aes-256-gcm' }),
            1000
        );
    }

    private async benchmarkNetwork() {
        console.log('🌐 Benchmarking Network...');
        const network = getNetworkBridge();
        
        const packet = new Uint8Array([0x45, 0x00, 0x00, 0x3c]); // IP packet
        
        await this.benchmark(
            'Network',
            'analyzePacket',
            async () => await network.analyzePacket(packet),
            1000
        );
        
        const packetAnalysis = await network.analyzePacket(packet);
        
        await this.benchmark(
            'Network',
            'detectAnomalies',
            async () => await network.detectAnomalies([packetAnalysis]),
            500
        );
    }

    private async benchmarkSandbox() {
        console.log('📦 Benchmarking Sandbox...');
        const sandbox = await getSandbox();
        
        const testCode = new TextEncoder().encode('console.log("test");');
        
        await this.benchmark(
            'Sandbox',
            'execute',
            async () => await sandbox.execute(testCode, { maxCpuTime: 1 }),
            100
        );
        
        await this.benchmark(
            'Sandbox',
            'create',
            async () => await sandbox.create({ maxMemory: 64 * 1024 * 1024 }),
            100
        );
    }

    private printResults() {
        console.log('\n📈 BENCHMARK RESULTS\n');
        console.log('Module            | Operation          | Avg Time (ms) | Ops/sec | Min (ms) | Max (ms)');
        console.log('------------------|-------------------|---------------|---------|----------|----------');
        
        for (const result of this.results) {
            console.log(
                `${result.module.padEnd(17)} | ${result.operation.padEnd(17)} | ${
                    result.avgTime.toFixed(3).padStart(13)
                } | ${
                    result.opsPerSecond.toFixed(0).padStart(7)
                } | ${
                    result.minTime.toFixed(3).padStart(8)
                } | ${
                    result.maxTime.toFixed(3).padStart(8)
                }`
            );
        }
        
        console.log('\n📊 SUMMARY STATISTICS\n');
        
        // Group by module
        const moduleStats = new Map<string, { totalOps: number, avgTime: number }>();
        
        for (const result of this.results) {
            if (!moduleStats.has(result.module)) {
                moduleStats.set(result.module, { totalOps: 0, avgTime: 0 });
            }
            const stats = moduleStats.get(result.module)!;
            stats.totalOps += result.opsPerSecond;
            stats.avgTime += result.avgTime;
        }
        
        console.log('Module            | Total Ops/sec | Avg Response (ms)');
        console.log('------------------|---------------|------------------');
        
        for (const [module, stats] of moduleStats) {
            const operationCount = this.results.filter(r => r.module === module).length;
            console.log(
                `${module.padEnd(17)} | ${
                    stats.totalOps.toFixed(0).padStart(13)
                } | ${
                    (stats.avgTime / operationCount).toFixed(3).padStart(17)
                }`
            );
        }
    }

    private saveResults() {
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

// Run benchmarks
if (require.main === module) {
    const benchmark = new WASMBenchmark();
    benchmark.runAllBenchmarks().catch(console.error);
}

export { WASMBenchmark };