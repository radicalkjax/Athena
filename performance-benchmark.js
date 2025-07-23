#!/usr/bin/env node

/**
 * Performance Benchmark Suite for Athena v2
 * Tests performance, memory usage, and scalability
 */

const axios = require('axios');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'test-key-12345';

class PerformanceBenchmark {
    constructor() {
        this.results = [];
        this.memoryBaseline = process.memoryUsage();
    }

    async runBenchmarks() {
        console.log('🚀 Starting Performance Benchmark Suite\n');
        
        try {
            await this.benchmarkBasicEndpoints();
            await this.benchmarkFileUploadSizes();
            await this.benchmarkConcurrentUploads();
            await this.benchmarkWASMPerformance();
            await this.benchmarkMemoryUsage();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Benchmark failed:', error.message);
        }
    }

    async benchmarkBasicEndpoints() {
        console.log('1️⃣ Benchmarking Basic Endpoints...');
        
        const endpoints = [
            { name: 'Health Check', url: '/api/v1/health', method: 'GET' },
            { name: 'Root Endpoint', url: '/', method: 'GET' },
            { name: 'WASM Capabilities', url: '/api/v1/wasm/capabilities', method: 'GET', headers: { 'x-api-key': API_KEY } }
        ];
        
        for (const endpoint of endpoints) {
            const times = await this.measureEndpoint(endpoint, 10);
            this.logBenchmark('Basic Endpoints', endpoint.name, times);
        }
    }

    async benchmarkFileUploadSizes() {
        console.log('2️⃣ Benchmarking File Upload Sizes...');
        
        const sizes = [
            { name: '1KB', size: 1024 },
            { name: '10KB', size: 10 * 1024 },
            { name: '100KB', size: 100 * 1024 },
            { name: '1MB', size: 1024 * 1024 },
            { name: '5MB', size: 5 * 1024 * 1024 }
        ];
        
        for (const { name, size } of sizes) {
            const times = await this.measureFileUpload(size, 3);
            this.logBenchmark('File Upload', `${name} File`, times);
        }
    }

    async benchmarkConcurrentUploads() {
        console.log('3️⃣ Benchmarking Concurrent Operations...');
        
        const concurrencyLevels = [1, 2, 5, 10, 20];
        
        for (const level of concurrencyLevels) {
            const startTime = performance.now();
            
            const promises = Array(level).fill().map(async (_, i) => {
                const testData = crypto.randomBytes(1024); // 1KB file
                return this.uploadFile(testData, `concurrent-test-${i}.bin`);
            });
            
            await Promise.all(promises);
            const totalTime = performance.now() - startTime;
            
            this.logBenchmark('Concurrency', `${level} Concurrent Uploads`, {
                avg: totalTime,
                min: totalTime,
                max: totalTime,
                count: level,
                throughput: (level / (totalTime / 1000)).toFixed(2) + ' uploads/sec'
            });
        }
    }

    async benchmarkWASMPerformance() {
        console.log('4️⃣ Benchmarking WASM Performance...');
        
        const dataSizes = [
            { name: '1KB', size: 1024 },
            { name: '10KB', size: 10 * 1024 },
            { name: '100KB', size: 100 * 1024 }
        ];
        
        for (const { name, size } of dataSizes) {
            const times = await this.measureWASMAnalysis(size, 5);
            this.logBenchmark('WASM Analysis', `${name} Data`, times);
        }
    }

    async benchmarkMemoryUsage() {
        console.log('5️⃣ Benchmarking Memory Usage...');
        
        const initialMemory = process.memoryUsage();
        
        // Perform various operations and measure memory
        await this.measureEndpoint({ name: 'Health', url: '/api/v1/health', method: 'GET' }, 50);
        const afterHealth = process.memoryUsage();
        
        await this.measureFileUpload(1024 * 1024, 10); // 1MB uploads
        const afterUploads = process.memoryUsage();
        
        await this.measureWASMAnalysis(10 * 1024, 10); // 10KB WASM analysis
        const finalMemory = process.memoryUsage();
        
        this.logMemoryUsage('Memory Usage', {
            initial: initialMemory,
            afterHealth: afterHealth,
            afterUploads: afterUploads,
            final: finalMemory
        });
    }

    async measureEndpoint(endpoint, iterations = 10) {
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = performance.now();
            
            try {
                const config = {
                    method: endpoint.method || 'GET',
                    url: `${API_BASE_URL}${endpoint.url}`,
                    headers: endpoint.headers || {}
                };
                
                await axios(config);
                const endTime = performance.now();
                times.push(endTime - startTime);
            } catch (error) {
                console.error(`   ❌ Request failed: ${error.message}`);
            }
        }
        
        return this.calculateStats(times);
    }

    async measureFileUpload(size, iterations = 3) {
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const testData = crypto.randomBytes(size);
            const startTime = performance.now();
            
            try {
                await this.uploadFile(testData, `test-${size}-${i}.bin`);
                const endTime = performance.now();
                times.push(endTime - startTime);
            } catch (error) {
                console.error(`   ❌ Upload failed: ${error.message}`);
            }
        }
        
        return this.calculateStats(times);
    }

    async measureWASMAnalysis(dataSize, iterations = 5) {
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const testData = crypto.randomBytes(dataSize);
            const startTime = performance.now();
            
            try {
                await axios.post(`${API_BASE_URL}/api/v1/wasm/analyze`, {
                    content: testData.toString('base64'),
                    module: 'analysis-engine',
                    operation: 'analyze',
                    options: { encoding: 'base64' }
                }, {
                    headers: {
                        'x-api-key': API_KEY,
                        'Content-Type': 'application/json'
                    }
                });
                
                const endTime = performance.now();
                times.push(endTime - startTime);
            } catch (error) {
                console.error(`   ❌ WASM analysis failed: ${error.message}`);
            }
        }
        
        return this.calculateStats(times);
    }

    async uploadFile(data, filename) {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', data, filename);
        form.append('analysisType', 'quick');
        
        return axios.post(`${API_BASE_URL}/api/v1/analysis/upload`, form, {
            headers: {
                'x-api-key': API_KEY,
                ...form.getHeaders()
            }
        });
    }

    calculateStats(times) {
        if (times.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };
        
        const sorted = times.sort((a, b) => a - b);
        return {
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            min: Math.min(...times),
            max: Math.max(...times),
            median: sorted[Math.floor(sorted.length / 2)],
            p95: sorted[Math.floor(sorted.length * 0.95)],
            count: times.length
        };
    }

    logBenchmark(category, operation, stats) {
        this.results.push({
            category,
            operation,
            stats,
            timestamp: new Date().toISOString()
        });
        
        if (stats.throughput) {
            console.log(`   📊 ${operation}: ${stats.avg.toFixed(2)}ms (${stats.throughput})`);
        } else {
            console.log(`   📊 ${operation}: avg ${stats.avg.toFixed(2)}ms, min ${stats.min.toFixed(2)}ms, max ${stats.max.toFixed(2)}ms, p95 ${stats.p95.toFixed(2)}ms (n=${stats.count})`);
        }
    }

    logMemoryUsage(category, memoryData) {
        const formatBytes = (bytes) => (bytes / 1024 / 1024).toFixed(2) + 'MB';
        
        console.log(`   🧠 Memory Usage:`);
        console.log(`      Initial: ${formatBytes(memoryData.initial.heapUsed)} heap, ${formatBytes(memoryData.initial.rss)} RSS`);
        console.log(`      After Health Checks: ${formatBytes(memoryData.afterHealth.heapUsed)} heap (+${formatBytes(memoryData.afterHealth.heapUsed - memoryData.initial.heapUsed)})`);
        console.log(`      After File Uploads: ${formatBytes(memoryData.afterUploads.heapUsed)} heap (+${formatBytes(memoryData.afterUploads.heapUsed - memoryData.afterHealth.heapUsed)})`);
        console.log(`      Final: ${formatBytes(memoryData.final.heapUsed)} heap (+${formatBytes(memoryData.final.heapUsed - memoryData.afterUploads.heapUsed)})`);
        
        this.results.push({
            category,
            operation: 'Memory Usage',
            stats: memoryData,
            timestamp: new Date().toISOString()
        });
    }

    printResults() {
        console.log('\n📊 Performance Benchmark Results');
        console.log('=================================');
        
        // Group results by category
        const categories = {};
        this.results.forEach(result => {
            if (!categories[result.category]) {
                categories[result.category] = [];
            }
            categories[result.category].push(result);
        });
        
        Object.entries(categories).forEach(([category, results]) => {
            console.log(`\n${category.toUpperCase()}:`);
            results.forEach(result => {
                if (result.stats.avg !== undefined) {
                    console.log(`  ${result.operation}: ${result.stats.avg.toFixed(2)}ms avg`);
                }
            });
        });
        
        // Performance recommendations
        console.log('\n💡 Performance Recommendations:');
        
        const healthResult = this.results.find(r => r.operation === 'Health Check');
        if (healthResult && healthResult.stats.avg > 500) {
            console.log('   ⚠️  Health check is slow (>500ms) - consider optimization');
        } else {
            console.log('   ✅ Health check performance is good');
        }
        
        const uploadResults = this.results.filter(r => r.category === 'File Upload');
        const largeUpload = uploadResults.find(r => r.operation.includes('5MB'));
        if (largeUpload && largeUpload.stats.avg > 10000) {
            console.log('   ⚠️  Large file uploads are slow (>10s) - consider streaming');
        } else {
            console.log('   ✅ File upload performance is acceptable');
        }
        
        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalBenchmarks: this.results.length,
                avgHealthCheckTime: healthResult ? healthResult.stats.avg : 0
            },
            results: this.results
        };
        
        require('fs').writeFileSync('benchmark-results.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed benchmark report saved to benchmark-results.json');
    }
}

// Run benchmarks if executed directly
if (require.main === module) {
    const benchmark = new PerformanceBenchmark();
    benchmark.runBenchmarks().catch(console.error);
}

module.exports = PerformanceBenchmark;