"use strict";
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
exports.DeobfuscatorBenchmark = void 0;
const perf_hooks_1 = require("perf_hooks");
const fs_1 = require("fs");
const deobfuscator_bridge_1 = require("../../bridge/deobfuscator-bridge");
class DeobfuscatorBenchmark {
    constructor() {
        this.results = [];
        this.deobfuscator = deobfuscator_bridge_1.DeobfuscatorBridge.getInstance();
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.deobfuscator.initialize();
        });
    }
    generateTestData(sizeMB, type) {
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
    benchmarkDetection(name_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (name, data, iterations = 10) {
            const times = [];
            const inputSizeMB = data.length / (1024 * 1024);
            // Warmup
            for (let i = 0; i < 3; i++) {
                yield this.deobfuscator.detectObfuscation(data);
            }
            // Actual benchmark
            for (let i = 0; i < iterations; i++) {
                const start = perf_hooks_1.performance.now();
                yield this.deobfuscator.detectObfuscation(data);
                const end = perf_hooks_1.performance.now();
                times.push(end - start);
            }
            const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
            const throughputMBps = (inputSizeMB / avgTimeMs) * 1000;
            const result = {
                name: `Detection: ${name}`,
                throughputMBps,
                avgTimeMs,
                iterations,
                inputSizeMB
            };
            this.results.push(result);
            return result;
        });
    }
    benchmarkDeobfuscation(name_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (name, data, iterations = 10) {
            const times = [];
            const inputSizeMB = data.length / (1024 * 1024);
            // Warmup
            for (let i = 0; i < 3; i++) {
                yield this.deobfuscator.deobfuscate(data);
            }
            // Actual benchmark
            for (let i = 0; i < iterations; i++) {
                const start = perf_hooks_1.performance.now();
                yield this.deobfuscator.deobfuscate(data);
                const end = perf_hooks_1.performance.now();
                times.push(end - start);
            }
            const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
            const throughputMBps = (inputSizeMB / avgTimeMs) * 1000;
            const result = {
                name: `Deobfuscation: ${name}`,
                throughputMBps,
                avgTimeMs,
                iterations,
                inputSizeMB
            };
            this.results.push(result);
            return result;
        });
    }
    benchmarkEntropy(sizeMB_1) {
        return __awaiter(this, arguments, void 0, function* (sizeMB, iterations = 10) {
            const data = Buffer.alloc(sizeMB * 1024 * 1024);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.floor(Math.random() * 256);
            }
            const stringData = data.toString('base64');
            const times = [];
            // Warmup
            for (let i = 0; i < 3; i++) {
                yield this.deobfuscator.analyzeEntropy(stringData);
            }
            // Actual benchmark
            for (let i = 0; i < iterations; i++) {
                const start = perf_hooks_1.performance.now();
                yield this.deobfuscator.analyzeEntropy(stringData);
                const end = perf_hooks_1.performance.now();
                times.push(end - start);
            }
            const avgTimeMs = times.reduce((a, b) => a + b, 0) / times.length;
            const throughputMBps = (sizeMB / avgTimeMs) * 1000;
            const result = {
                name: `Entropy Analysis: ${sizeMB}MB`,
                throughputMBps,
                avgTimeMs,
                iterations,
                inputSizeMB: sizeMB
            };
            this.results.push(result);
            return result;
        });
    }
    runAllBenchmarks() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🏁 Starting Deobfuscator Performance Benchmarks...\n');
            // Small data benchmarks (1MB)
            console.log('📊 Testing 1MB inputs...');
            const base64_1mb = this.generateTestData(1, 'base64');
            yield this.benchmarkDetection('Base64 1MB', base64_1mb);
            yield this.benchmarkDeobfuscation('Base64 1MB', base64_1mb);
            const hex_1mb = this.generateTestData(1, 'hex');
            yield this.benchmarkDetection('Hex 1MB', hex_1mb);
            yield this.benchmarkDeobfuscation('Hex 1MB', hex_1mb);
            // Medium data benchmarks (10MB)
            console.log('📊 Testing 10MB inputs...');
            const base64_10mb = this.generateTestData(10, 'base64');
            yield this.benchmarkDetection('Base64 10MB', base64_10mb);
            yield this.benchmarkDeobfuscation('Base64 10MB', base64_10mb);
            // Large data benchmarks (50MB)
            console.log('📊 Testing 50MB inputs...');
            const mixed_50mb = this.generateTestData(50, 'mixed');
            yield this.benchmarkDetection('Mixed 50MB', mixed_50mb);
            yield this.benchmarkDeobfuscation('Mixed 50MB', mixed_50mb, 5); // Fewer iterations for large data
            // Entropy analysis benchmarks
            console.log('📊 Testing entropy analysis...');
            yield this.benchmarkEntropy(1);
            yield this.benchmarkEntropy(10);
            yield this.benchmarkEntropy(50, 5);
            // Multi-layer deobfuscation benchmark
            console.log('📊 Testing multi-layer deobfuscation...');
            let multilayer = 'Hello World';
            for (let i = 0; i < 5; i++) {
                multilayer = Buffer.from(multilayer).toString('base64');
            }
            yield this.benchmarkDeobfuscation('5-layer Base64', multilayer, 100);
            this.printResults();
            this.saveResults();
        });
    }
    printResults() {
        console.log('\n📈 Benchmark Results:\n');
        console.log('| Test Name | Throughput (MB/s) | Avg Time (ms) | Input Size (MB) |');
        console.log('|-----------|-------------------|---------------|-----------------|');
        for (const result of this.results) {
            console.log(`| ${result.name.padEnd(25)} | ${result.throughputMBps.toFixed(2).padStart(17)} | ${result.avgTimeMs.toFixed(2).padStart(13)} | ${result.inputSizeMB.toFixed(2).padStart(15)} |`);
        }
        // Check against targets
        console.log('\n🎯 Performance vs Targets:');
        const deobResults = this.results.filter(r => r.name.includes('Deobfuscation'));
        const avgThroughput = deobResults.reduce((sum, r) => sum + r.throughputMBps, 0) / deobResults.length;
        console.log(`Average Deobfuscation Throughput: ${avgThroughput.toFixed(2)} MB/s`);
        console.log(`Target: 50 MB/s`);
        console.log(`Status: ${avgThroughput >= 50 ? '✅ PASS' : '❌ BELOW TARGET'}`);
    }
    saveResults() {
        const csv = [
            'Test Name,Throughput (MB/s),Avg Time (ms),Input Size (MB)',
            ...this.results.map(r => `${r.name},${r.throughputMBps.toFixed(2)},${r.avgTimeMs.toFixed(2)},${r.inputSizeMB.toFixed(2)}`)
        ].join('\n');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `/workspaces/Athena/wasm-modules/tests/benchmarks/deobfuscator-benchmark-${timestamp}.csv`;
        (0, fs_1.writeFileSync)(filename, csv);
        console.log(`\n💾 Results saved to: ${filename}`);
    }
}
exports.DeobfuscatorBenchmark = DeobfuscatorBenchmark;
// Run benchmarks if executed directly
if (require.main === module) {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        const benchmark = new DeobfuscatorBenchmark();
        yield benchmark.initialize();
        yield benchmark.runAllBenchmarks();
    }))().catch(console.error);
}
