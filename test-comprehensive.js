#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Athena v2
 * Tests backend, WASM, file upload, and integration
 */

const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const { performance } = require('perf_hooks');

const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'test-key-12345';

class TestSuite {
    constructor() {
        this.results = {
            backend: [],
            fileUpload: [],
            wasm: [],
            integration: [],
            performance: []
        };
        this.startTime = performance.now();
    }

    async runAllTests() {
        console.log('🧪 Starting Comprehensive Test Suite\n');
        
        try {
            await this.testBackendHealth();
            await this.testWASMCapabilities();
            await this.testFileUpload();
            await this.testBatchUpload();
            await this.testWASMAnalysis();
            await this.testPerformance();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
        }
    }

    async testBackendHealth() {
        console.log('1️⃣ Testing Backend Health...');
        
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/health`);
            this.logTest('backend', 'Health Check', response.status === 200);
            
            const health = response.data;
            this.logTest('backend', 'Response Format', health.status === 'healthy');
            this.logTest('backend', 'Providers Present', health.providers && Object.keys(health.providers).length > 0);
            
        } catch (error) {
            this.logTest('backend', 'Health Check', false, error.message);
        }
    }

    async testWASMCapabilities() {
        console.log('2️⃣ Testing WASM Capabilities...');
        
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/wasm/capabilities`, {
                headers: { 'x-api-key': API_KEY }
            });
            
            this.logTest('wasm', 'Capabilities Endpoint', response.status === 200);
            
            const capabilities = response.data;
            this.logTest('wasm', 'Modules Listed', capabilities.modules && capabilities.modules.length > 0);
            this.logTest('wasm', 'Analysis Engine Available', capabilities.modules.includes('analysis-engine'));
            this.logTest('wasm', 'Capabilities Detail', capabilities.capabilities && Object.keys(capabilities.capabilities).length > 0);
            
        } catch (error) {
            this.logTest('wasm', 'Capabilities Test', false, error.message);
        }
    }

    async testFileUpload() {
        console.log('3️⃣ Testing File Upload...');
        
        try {
            // Create a test file
            const testContent = 'This is a test file for malware analysis\nTest string: EICAR-TEST-FILE';
            const testFile = Buffer.from(testContent);
            
            // Upload file
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', testFile, 'test-file.txt');
            form.append('analysisType', 'comprehensive');
            form.append('priority', 'high');
            
            const uploadResponse = await axios.post(`${API_BASE_URL}/api/v1/analysis/upload`, form, {
                headers: {
                    'x-api-key': API_KEY,
                    ...form.getHeaders()
                }
            });
            
            this.logTest('fileUpload', 'Upload Success', uploadResponse.status === 200);
            
            const upload = uploadResponse.data;
            this.logTest('fileUpload', 'Analysis ID Generated', upload.analysisId && upload.analysisId.length > 0);
            this.logTest('fileUpload', 'Filename Preserved', upload.filename === 'test-file.txt');
            
            // Check status
            if (upload.analysisId) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                
                const statusResponse = await axios.get(`${API_BASE_URL}/api/v1/analysis/${upload.analysisId}/status`, {
                    headers: { 'x-api-key': API_KEY }
                });
                
                this.logTest('fileUpload', 'Status Check', statusResponse.status === 200);
                
                const status = statusResponse.data;
                this.logTest('fileUpload', 'Status Format', status.id === upload.analysisId);
                this.logTest('fileUpload', 'Status Update', ['pending', 'processing', 'completed', 'failed'].includes(status.status));
                
                // Try to get results if completed
                if (status.status === 'completed') {
                    const resultsResponse = await axios.get(`${API_BASE_URL}/api/v1/analysis/${upload.analysisId}/results`, {
                        headers: { 'x-api-key': API_KEY }
                    });
                    
                    this.logTest('fileUpload', 'Results Retrieval', resultsResponse.status === 200);
                    
                    const results = resultsResponse.data;
                    this.logTest('fileUpload', 'Results Format', results.results && typeof results.results === 'object');
                }
            }
            
        } catch (error) {
            this.logTest('fileUpload', 'File Upload Test', false, error.message);
        }
    }

    async testBatchUpload() {
        console.log('4️⃣ Testing Batch Upload...');
        
        try {
            const FormData = require('form-data');
            const form = new FormData();
            
            // Create multiple test files
            for (let i = 1; i <= 3; i++) {
                const content = `Test file ${i} content\nSample data for testing`;
                form.append('files', Buffer.from(content), `test-batch-${i}.txt`);
            }
            
            form.append('analysisType', 'quick');
            form.append('priority', 'normal');
            
            const batchResponse = await axios.post(`${API_BASE_URL}/api/v1/analysis/batch`, form, {
                headers: {
                    'x-api-key': API_KEY,
                    ...form.getHeaders()
                }
            });
            
            this.logTest('fileUpload', 'Batch Upload Success', batchResponse.status === 200);
            
            const batch = batchResponse.data;
            this.logTest('fileUpload', 'Batch ID Generated', batch.batchId && batch.batchId.length > 0);
            this.logTest('fileUpload', 'File Count Correct', batch.totalFiles === 3);
            this.logTest('fileUpload', 'Analysis IDs Generated', batch.analyses && batch.analyses.length === 3);
            
        } catch (error) {
            this.logTest('fileUpload', 'Batch Upload Test', false, error.message);
        }
    }

    async testWASMAnalysis() {
        console.log('5️⃣ Testing WASM Analysis...');
        
        try {
            const testData = {
                content: Buffer.from('Test content for WASM analysis').toString('base64'),
                module: 'analysis-engine',
                operation: 'analyze',
                options: {
                    encoding: 'base64'
                }
            };
            
            const response = await axios.post(`${API_BASE_URL}/api/v1/wasm/analyze`, testData, {
                headers: {
                    'x-api-key': API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            
            this.logTest('wasm', 'Direct WASM Analysis', response.status === 200);
            
            const result = response.data;
            this.logTest('wasm', 'Module Executed', result.module === 'analysis-engine');
            this.logTest('wasm', 'Execution Time Recorded', typeof result.executionTime === 'number');
            this.logTest('wasm', 'Result Returned', result.result !== undefined);
            
        } catch (error) {
            this.logTest('wasm', 'WASM Analysis Test', false, error.message);
        }
    }

    async testPerformance() {
        console.log('6️⃣ Testing Performance...');
        
        try {
            // Test API response times
            const startTime = performance.now();
            await axios.get(`${API_BASE_URL}/api/v1/health`);
            const healthTime = performance.now() - startTime;
            
            this.logTest('performance', 'Health Check Speed', healthTime < 1000, `${healthTime.toFixed(2)}ms`);
            
            // Test WASM capabilities response time
            const wasmStartTime = performance.now();
            await axios.get(`${API_BASE_URL}/api/v1/wasm/capabilities`, {
                headers: { 'x-api-key': API_KEY }
            });
            const wasmTime = performance.now() - wasmStartTime;
            
            this.logTest('performance', 'WASM Capabilities Speed', wasmTime < 2000, `${wasmTime.toFixed(2)}ms`);
            
            // Test concurrent requests
            const concurrentStart = performance.now();
            const promises = Array(5).fill().map(() => 
                axios.get(`${API_BASE_URL}/api/v1/health`)
            );
            await Promise.all(promises);
            const concurrentTime = performance.now() - concurrentStart;
            
            this.logTest('performance', 'Concurrent Request Handling', concurrentTime < 5000, `${concurrentTime.toFixed(2)}ms for 5 requests`);
            
        } catch (error) {
            this.logTest('performance', 'Performance Test', false, error.message);
        }
    }

    logTest(category, testName, passed, details = '') {
        const result = {
            category,
            testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.results[category].push(result);
        
        const status = passed ? '✅' : '❌';
        const detailsStr = details ? ` (${details})` : '';
        console.log(`   ${status} ${testName}${detailsStr}`);
    }

    printResults() {
        const totalTime = performance.now() - this.startTime;
        
        console.log('\n📊 Test Results Summary');
        console.log('========================');
        
        let totalTests = 0;
        let passedTests = 0;
        
        Object.entries(this.results).forEach(([category, tests]) => {
            if (tests.length === 0) return;
            
            const categoryPassed = tests.filter(t => t.passed).length;
            const categoryTotal = tests.length;
            
            totalTests += categoryTotal;
            passedTests += categoryPassed;
            
            const percentage = ((categoryPassed / categoryTotal) * 100).toFixed(1);
            console.log(`${category.toUpperCase()}: ${categoryPassed}/${categoryTotal} (${percentage}%)`);
        });
        
        console.log(`\nOVERALL: ${passedTests}/${totalTests} tests passed`);
        console.log(`Total execution time: ${(totalTime / 1000).toFixed(2)}s`);
        
        // Print failures
        const failures = [];
        Object.values(this.results).flat().filter(t => !t.passed).forEach(test => {
            failures.push(`${test.category}/${test.testName}: ${test.details}`);
        });
        
        if (failures.length > 0) {
            console.log('\n❌ Failed Tests:');
            failures.forEach(failure => console.log(`   - ${failure}`));
        } else {
            console.log('\n🎉 All tests passed!');
        }
        
        // Generate detailed report
        this.generateReport();
    }

    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: Object.values(this.results).flat().length,
                passedTests: Object.values(this.results).flat().filter(t => t.passed).length,
                executionTime: performance.now() - this.startTime
            },
            results: this.results
        };
        
        fs.writeFileSync('test-results.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed report saved to test-results.json');
    }
}

// Run tests if executed directly
if (require.main === module) {
    const suite = new TestSuite();
    suite.runAllTests().catch(console.error);
}

module.exports = TestSuite;