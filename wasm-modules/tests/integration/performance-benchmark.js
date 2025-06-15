"use strict";
/**
 * Performance benchmarks for WASM file-processor module
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
exports.FileProcessorBenchmark = void 0;
const file_processor_bridge_1 = require("../../bridge/file-processor-bridge");
const fs = __importStar(require("fs"));
class FileProcessorBenchmark {
    constructor() {
        this.results = [];
        this.processor = (0, file_processor_bridge_1.createFileProcessor)();
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.processor.initialize();
            console.log('WASM File Processor initialized for benchmarking');
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            this.processor.destroy();
        });
    }
    generateTestData(size) {
        const buffer = new Uint8Array(size);
        // Fill with realistic data patterns
        for (let i = 0; i < size; i++) {
            if (i % 100 < 70) {
                // 70% printable ASCII
                buffer[i] = 32 + (i % 95);
            }
            else {
                // 30% binary data
                buffer[i] = Math.floor(Math.random() * 256);
            }
        }
        return buffer.buffer;
    }
    generatePDF(size) {
        const header = '%PDF-1.4\n';
        const footer = '\n%%EOF';
        const contentSize = size - header.length - footer.length;
        let content = header;
        // Add some objects
        for (let i = 0; i < 10; i++) {
            content += `${i} 0 obj\n<< /Type /Page >>\nendobj\n`;
        }
        // Fill remaining space
        const remaining = contentSize - content.length;
        content += 'stream\n';
        content += 'x'.repeat(Math.max(0, remaining - 20));
        content += '\nendstream\n';
        content += footer;
        return new TextEncoder().encode(content).buffer;
    }
    generatePE(size) {
        const buffer = new Uint8Array(size);
        // DOS header
        buffer[0] = 0x4D; // M
        buffer[1] = 0x5A; // Z
        // PE offset
        buffer[0x3C] = 0x80;
        // PE signature
        buffer[0x80] = 0x50; // P
        buffer[0x81] = 0x45; // E
        buffer[0x82] = 0x00;
        buffer[0x83] = 0x00;
        // Machine type (x64)
        buffer[0x84] = 0x64;
        buffer[0x85] = 0x86;
        // Fill rest with data
        for (let i = 0x100; i < size; i++) {
            buffer[i] = i % 256;
        }
        return buffer.buffer;
    }
    benchmarkFormatDetection() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('\n📊 Benchmarking Format Detection...');
            const sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
            const iterations = 100;
            for (const size of sizes) {
                const testData = this.generateTestData(size);
                const startTime = Date.now();
                for (let i = 0; i < iterations; i++) {
                    yield this.processor.detectFormat(testData);
                }
                const totalTime = Date.now() - startTime;
                const result = {
                    operation: 'Format Detection',
                    fileSize: size,
                    iterations,
                    totalTime,
                    avgTime: totalTime / iterations,
                    throughputMBps: (size * iterations / 1048576) / (totalTime / 1000)
                };
                this.results.push(result);
                console.log(`  ${this.formatSize(size)}: ${result.avgTime.toFixed(2)}ms avg, ${result.throughputMBps.toFixed(2)} MB/s`);
            }
        });
    }
    benchmarkPDFParsing() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('\n📊 Benchmarking PDF Parsing...');
            const sizes = [10240, 102400, 1048576]; // 10KB, 100KB, 1MB
            const iterations = 20;
            for (const size of sizes) {
                const pdfData = this.generatePDF(size);
                const startTime = Date.now();
                for (let i = 0; i < iterations; i++) {
                    yield this.processor.parseFile(pdfData, 'pdf');
                }
                const totalTime = Date.now() - startTime;
                const result = {
                    operation: 'PDF Parsing',
                    fileSize: size,
                    iterations,
                    totalTime,
                    avgTime: totalTime / iterations,
                    throughputMBps: (size * iterations / 1048576) / (totalTime / 1000)
                };
                this.results.push(result);
                console.log(`  ${this.formatSize(size)}: ${result.avgTime.toFixed(2)}ms avg, ${result.throughputMBps.toFixed(2)} MB/s`);
            }
        });
    }
    benchmarkPEParsing() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('\n📊 Benchmarking PE Parsing...');
            const sizes = [10240, 102400, 1048576]; // 10KB, 100KB, 1MB
            const iterations = 20;
            for (const size of sizes) {
                const peData = this.generatePE(size);
                const startTime = Date.now();
                for (let i = 0; i < iterations; i++) {
                    yield this.processor.parseFile(peData, 'pe');
                }
                const totalTime = Date.now() - startTime;
                const result = {
                    operation: 'PE Parsing',
                    fileSize: size,
                    iterations,
                    totalTime,
                    avgTime: totalTime / iterations,
                    throughputMBps: (size * iterations / 1048576) / (totalTime / 1000)
                };
                this.results.push(result);
                console.log(`  ${this.formatSize(size)}: ${result.avgTime.toFixed(2)}ms avg, ${result.throughputMBps.toFixed(2)} MB/s`);
            }
        });
    }
    benchmarkStringExtraction() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('\n📊 Benchmarking String Extraction...');
            const sizes = [10240, 102400, 1048576]; // 10KB, 100KB, 1MB
            const iterations = 20;
            for (const size of sizes) {
                const testData = this.generateTestData(size);
                const startTime = Date.now();
                for (let i = 0; i < iterations; i++) {
                    yield this.processor.extractStrings(testData, 5);
                }
                const totalTime = Date.now() - startTime;
                const result = {
                    operation: 'String Extraction',
                    fileSize: size,
                    iterations,
                    totalTime,
                    avgTime: totalTime / iterations,
                    throughputMBps: (size * iterations / 1048576) / (totalTime / 1000)
                };
                this.results.push(result);
                console.log(`  ${this.formatSize(size)}: ${result.avgTime.toFixed(2)}ms avg, ${result.throughputMBps.toFixed(2)} MB/s`);
            }
        });
    }
    benchmarkValidation() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('\n📊 Benchmarking File Validation...');
            const sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
            const iterations = 50;
            for (const size of sizes) {
                const testData = this.generateTestData(size);
                const startTime = Date.now();
                for (let i = 0; i < iterations; i++) {
                    yield this.processor.validateFile(testData);
                }
                const totalTime = Date.now() - startTime;
                const result = {
                    operation: 'File Validation',
                    fileSize: size,
                    iterations,
                    totalTime,
                    avgTime: totalTime / iterations,
                    throughputMBps: (size * iterations / 1048576) / (totalTime / 1000)
                };
                this.results.push(result);
                console.log(`  ${this.formatSize(size)}: ${result.avgTime.toFixed(2)}ms avg, ${result.throughputMBps.toFixed(2)} MB/s`);
            }
        });
    }
    formatSize(bytes) {
        if (bytes < 1024)
            return `${bytes}B`;
        if (bytes < 1048576)
            return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / 1048576).toFixed(1)}MB`;
    }
    generateReport() {
        console.log('\n📈 Performance Summary\n' + '='.repeat(80));
        console.log('Target Performance Metrics:');
        console.log('  - File parsing: 500 MB/s for common formats');
        console.log('  - Pattern matching: 200 MB/s');
        console.log('  - Memory usage: <100MB for 1GB file');
        console.log('\nActual Performance:');
        // Group by operation
        const operations = [...new Set(this.results.map(r => r.operation))];
        for (const op of operations) {
            console.log(`\n${op}:`);
            const opResults = this.results.filter(r => r.operation === op);
            // Calculate average throughput
            const avgThroughput = opResults.reduce((sum, r) => sum + r.throughputMBps, 0) / opResults.length;
            console.log(`  Average throughput: ${avgThroughput.toFixed(2)} MB/s`);
            // Find best and worst
            const sorted = opResults.sort((a, b) => b.throughputMBps - a.throughputMBps);
            console.log(`  Best: ${sorted[0].throughputMBps.toFixed(2)} MB/s (${this.formatSize(sorted[0].fileSize)})`);
            console.log(`  Worst: ${sorted[sorted.length - 1].throughputMBps.toFixed(2)} MB/s (${this.formatSize(sorted[sorted.length - 1].fileSize)})`);
        }
        // Export CSV
        this.exportCSV();
    }
    exportCSV() {
        const csv = [
            'Operation,File Size (bytes),Iterations,Total Time (ms),Avg Time (ms),Throughput (MB/s)',
            ...this.results.map(r => `${r.operation},${r.fileSize},${r.iterations},${r.totalTime},${r.avgTime.toFixed(2)},${r.throughputMBps.toFixed(2)}`)
        ].join('\n');
        const filename = `file-processor-benchmark-${Date.now()}.csv`;
        fs.writeFileSync(filename, csv);
        console.log(`\n📁 Results exported to: ${filename}`);
    }
    runAllBenchmarks() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🚀 Starting WASM File Processor Performance Benchmarks\n');
            yield this.benchmarkFormatDetection();
            yield this.benchmarkValidation();
            yield this.benchmarkPDFParsing();
            yield this.benchmarkPEParsing();
            yield this.benchmarkStringExtraction();
            this.generateReport();
        });
    }
}
exports.FileProcessorBenchmark = FileProcessorBenchmark;
// Run benchmarks if called directly
if (require.main === module) {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        const benchmark = new FileProcessorBenchmark();
        try {
            yield benchmark.initialize();
            yield benchmark.runAllBenchmarks();
        }
        catch (error) {
            console.error('Benchmark failed:', error);
        }
        finally {
            yield benchmark.cleanup();
        }
    }))();
}
