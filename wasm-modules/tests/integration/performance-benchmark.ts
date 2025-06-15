/**
 * Performance benchmarks for WASM file-processor module
 */

import { createFileProcessor, type IFileProcessor } from '../../bridge/file-processor-bridge';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  operation: string;
  fileSize: number;
  iterations: number;
  totalTime: number;
  avgTime: number;
  throughputMBps: number;
}

class FileProcessorBenchmark {
  private processor: IFileProcessor;
  private results: BenchmarkResult[] = [];
  
  constructor() {
    this.processor = createFileProcessor();
  }
  
  async initialize() {
    await this.processor.initialize();
    console.log('WASM File Processor initialized for benchmarking');
  }
  
  async cleanup() {
    this.processor.destroy();
  }
  
  private generateTestData(size: number): ArrayBuffer {
    const buffer = new Uint8Array(size);
    // Fill with realistic data patterns
    for (let i = 0; i < size; i++) {
      if (i % 100 < 70) {
        // 70% printable ASCII
        buffer[i] = 32 + (i % 95);
      } else {
        // 30% binary data
        buffer[i] = Math.floor(Math.random() * 256);
      }
    }
    return buffer.buffer;
  }
  
  private generatePDF(size: number): ArrayBuffer {
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
  
  private generatePE(size: number): ArrayBuffer {
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
  
  async benchmarkFormatDetection() {
    console.log('\n📊 Benchmarking Format Detection...');
    
    const sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
    const iterations = 100;
    
    for (const size of sizes) {
      const testData = this.generateTestData(size);
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        await this.processor.detectFormat(testData);
      }
      const totalTime = Date.now() - startTime;
      
      const result: BenchmarkResult = {
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
  }
  
  async benchmarkPDFParsing() {
    console.log('\n📊 Benchmarking PDF Parsing...');
    
    const sizes = [10240, 102400, 1048576]; // 10KB, 100KB, 1MB
    const iterations = 20;
    
    for (const size of sizes) {
      const pdfData = this.generatePDF(size);
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        await this.processor.parseFile(pdfData, 'pdf');
      }
      const totalTime = Date.now() - startTime;
      
      const result: BenchmarkResult = {
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
  }
  
  async benchmarkPEParsing() {
    console.log('\n📊 Benchmarking PE Parsing...');
    
    const sizes = [10240, 102400, 1048576]; // 10KB, 100KB, 1MB
    const iterations = 20;
    
    for (const size of sizes) {
      const peData = this.generatePE(size);
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        await this.processor.parseFile(peData, 'pe');
      }
      const totalTime = Date.now() - startTime;
      
      const result: BenchmarkResult = {
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
  }
  
  async benchmarkStringExtraction() {
    console.log('\n📊 Benchmarking String Extraction...');
    
    const sizes = [10240, 102400, 1048576]; // 10KB, 100KB, 1MB
    const iterations = 20;
    
    for (const size of sizes) {
      const testData = this.generateTestData(size);
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        await this.processor.extractStrings(testData, 5);
      }
      const totalTime = Date.now() - startTime;
      
      const result: BenchmarkResult = {
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
  }
  
  async benchmarkValidation() {
    console.log('\n📊 Benchmarking File Validation...');
    
    const sizes = [1024, 10240, 102400, 1048576]; // 1KB, 10KB, 100KB, 1MB
    const iterations = 50;
    
    for (const size of sizes) {
      const testData = this.generateTestData(size);
      
      const startTime = Date.now();
      for (let i = 0; i < iterations; i++) {
        await this.processor.validateFile(testData);
      }
      const totalTime = Date.now() - startTime;
      
      const result: BenchmarkResult = {
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
  }
  
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
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
  
  private exportCSV() {
    const csv = [
      'Operation,File Size (bytes),Iterations,Total Time (ms),Avg Time (ms),Throughput (MB/s)',
      ...this.results.map(r => 
        `${r.operation},${r.fileSize},${r.iterations},${r.totalTime},${r.avgTime.toFixed(2)},${r.throughputMBps.toFixed(2)}`
      )
    ].join('\n');
    
    const filename = `file-processor-benchmark-${Date.now()}.csv`;
    fs.writeFileSync(filename, csv);
    console.log(`\n📁 Results exported to: ${filename}`);
  }
  
  async runAllBenchmarks() {
    console.log('🚀 Starting WASM File Processor Performance Benchmarks\n');
    
    await this.benchmarkFormatDetection();
    await this.benchmarkValidation();
    await this.benchmarkPDFParsing();
    await this.benchmarkPEParsing();
    await this.benchmarkStringExtraction();
    
    this.generateReport();
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  (async () => {
    const benchmark = new FileProcessorBenchmark();
    
    try {
      await benchmark.initialize();
      await benchmark.runAllBenchmarks();
    } catch (error: unknown) {
      console.error('Benchmark failed:', error);
    } finally {
      await benchmark.cleanup();
    }
  })();
}

export { FileProcessorBenchmark };