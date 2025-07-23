#!/usr/bin/env node

/**
 * Security Test Suite for Athena v2
 * Tests authentication, input validation, and security measures
 */

const axios = require('axios');
const crypto = require('crypto');

const API_BASE_URL = 'http://localhost:3000';
const VALID_API_KEY = 'analysis-test-key-32-characters-long-secure-1234567890';

class SecurityTestSuite {
    constructor() {
        this.results = [];
    }

    async runSecurityTests() {
        console.log('🔒 Starting Security Test Suite\n');
        
        try {
            await this.testAuthentication();
            await this.testInputValidation();
            await this.testFileUploadSecurity();
            await this.testRateLimiting();
            await this.testErrorHandling();
            
            this.printResults();
        } catch (error) {
            console.error('❌ Security test suite failed:', error.message);
        }
    }

    async testAuthentication() {
        console.log('1️⃣ Testing Authentication & Authorization...');
        
        // Test endpoints without API key
        const protectedEndpoints = [
            '/api/v1/wasm/capabilities',
            '/api/v1/analysis/upload',
            '/api/v1/wasm/analyze'
        ];
        
        for (const endpoint of protectedEndpoints) {
            try {
                await axios.get(`${API_BASE_URL}${endpoint}`);
                this.logSecurityTest('Authentication', `${endpoint} without API key`, false, 'Should have been rejected');
            } catch (error) {
                if (error.response && error.response.status === 401) {
                    this.logSecurityTest('Authentication', `${endpoint} without API key`, true, 'Correctly rejected');
                } else {
                    this.logSecurityTest('Authentication', `${endpoint} without API key`, false, `Unexpected error: ${error.message}`);
                }
            }
        }
        
        // Test with invalid API key
        try {
            await axios.get(`${API_BASE_URL}/api/v1/wasm/capabilities`, {
                headers: { 'x-api-key': 'invalid-key' }
            });
            this.logSecurityTest('Authentication', 'Invalid API key', false, 'Should have been rejected');
        } catch (error) {
            if (error.response && error.response.status === 403) {
                this.logSecurityTest('Authentication', 'Invalid API key', true, 'Correctly rejected');
            } else {
                this.logSecurityTest('Authentication', 'Invalid API key', false, `Unexpected error: ${error.message}`);
            }
        }
        
        // Test with valid API key
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/wasm/capabilities`, {
                headers: { 'x-api-key': VALID_API_KEY }
            });
            this.logSecurityTest('Authentication', 'Valid API key', response.status === 200, 'Access granted');
        } catch (error) {
            this.logSecurityTest('Authentication', 'Valid API key', false, error.message);
        }
    }

    async testInputValidation() {
        console.log('2️⃣ Testing Input Validation...');
        
        // Test malformed JSON
        try {
            await axios.post(`${API_BASE_URL}/api/v1/wasm/analyze`, 'malformed json', {
                headers: {
                    'x-api-key': VALID_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            this.logSecurityTest('Input Validation', 'Malformed JSON', false, 'Should have been rejected');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                this.logSecurityTest('Input Validation', 'Malformed JSON', true, 'Correctly rejected');
            } else {
                this.logSecurityTest('Input Validation', 'Malformed JSON', false, `Unexpected error: ${error.message}`);
            }
        }
        
        // Test missing required fields
        try {
            await axios.post(`${API_BASE_URL}/api/v1/wasm/analyze`, {}, {
                headers: {
                    'x-api-key': VALID_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            this.logSecurityTest('Input Validation', 'Missing required fields', false, 'Should have been rejected');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                this.logSecurityTest('Input Validation', 'Missing required fields', true, 'Correctly rejected');
            } else {
                this.logSecurityTest('Input Validation', 'Missing required fields', false, `Unexpected error: ${error.message}`);
            }
        }
        
        // Test extremely large payload
        const largePayload = {
            content: 'x'.repeat(100 * 1024 * 1024), // 100MB string
            module: 'analysis-engine'
        };
        
        try {
            await axios.post(`${API_BASE_URL}/api/v1/wasm/analyze`, largePayload, {
                headers: {
                    'x-api-key': VALID_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            this.logSecurityTest('Input Validation', 'Extremely large payload', false, 'Should have been limited');
        } catch (error) {
            if (error.code === 'ECONNABORTED' || (error.response && error.response.status >= 400)) {
                this.logSecurityTest('Input Validation', 'Extremely large payload', true, 'Request limited/rejected');
            } else {
                this.logSecurityTest('Input Validation', 'Extremely large payload', false, `Unexpected error: ${error.message}`);
            }
        }
    }

    async testFileUploadSecurity() {
        console.log('3️⃣ Testing File Upload Security...');
        
        // Test upload without file
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('analysisType', 'test');
            
            await axios.post(`${API_BASE_URL}/api/v1/analysis/upload`, form, {
                headers: {
                    'x-api-key': VALID_API_KEY,
                    ...form.getHeaders()
                }
            });
            this.logSecurityTest('File Upload', 'Upload without file', false, 'Should have been rejected');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                this.logSecurityTest('File Upload', 'Upload without file', true, 'Correctly rejected');
            } else {
                this.logSecurityTest('File Upload', 'Upload without file', false, `Unexpected error: ${error.message}`);
            }
        }
        
        // Test oversized file upload (if limits are enforced)
        const oversizedFile = Buffer.alloc(100 * 1024 * 1024); // 100MB
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', oversizedFile, 'oversized.bin');
            
            await axios.post(`${API_BASE_URL}/api/v1/analysis/upload`, form, {
                headers: {
                    'x-api-key': VALID_API_KEY,
                    ...form.getHeaders()
                },
                timeout: 10000
            });
            this.logSecurityTest('File Upload', 'Oversized file', false, 'Should have been limited');
        } catch (error) {
            if (error.code === 'ECONNABORTED' || (error.response && error.response.status >= 400)) {
                this.logSecurityTest('File Upload', 'Oversized file', true, 'Upload limited/rejected');
            } else {
                this.logSecurityTest('File Upload', 'Oversized file', false, `Unexpected error: ${error.message}`);
            }
        }
        
        // Test filename injection
        const maliciousFilename = '../../../etc/passwd';
        try {
            const FormData = require('form-data');
            const form = new FormData();
            form.append('file', Buffer.from('test'), maliciousFilename);
            
            const response = await axios.post(`${API_BASE_URL}/api/v1/analysis/upload`, form, {
                headers: {
                    'x-api-key': VALID_API_KEY,
                    ...form.getHeaders()
                }
            });
            
            // Check if filename was sanitized
            if (response.data.filename !== maliciousFilename) {
                this.logSecurityTest('File Upload', 'Filename injection', true, 'Filename sanitized');
            } else {
                this.logSecurityTest('File Upload', 'Filename injection', false, 'Filename not sanitized');
            }
        } catch (error) {
            this.logSecurityTest('File Upload', 'Filename injection', false, `Error: ${error.message}`);
        }
    }

    async testRateLimiting() {
        console.log('4️⃣ Testing Rate Limiting...');
        
        // Test rapid requests to check rate limiting
        const rapidRequests = Array(25).fill().map(() => // More than the 20 request limit for WASM endpoint
            axios.get(`${API_BASE_URL}/api/v1/wasm/capabilities`, {
                headers: { 'x-api-key': VALID_API_KEY }
            }).catch(err => err.response)
        );
        
        try {
            const responses = await Promise.all(rapidRequests);
            const rateLimited = responses.filter(r => r && r.status === 429);
            
            if (rateLimited.length > 0) {
                this.logSecurityTest('Rate Limiting', 'Rapid requests', true, `${rateLimited.length} requests rate limited`);
            } else {
                this.logSecurityTest('Rate Limiting', 'Rapid requests', false, 'No rate limiting detected');
            }
        } catch (error) {
            this.logSecurityTest('Rate Limiting', 'Rapid requests', false, `Error: ${error.message}`);
        }
    }

    async testErrorHandling() {
        console.log('5️⃣ Testing Error Handling...');
        
        // Test non-existent endpoint
        try {
            await axios.get(`${API_BASE_URL}/api/v1/nonexistent`);
            this.logSecurityTest('Error Handling', 'Non-existent endpoint', false, 'Should return 404');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                this.logSecurityTest('Error Handling', 'Non-existent endpoint', true, 'Correctly returns 404');
            } else {
                this.logSecurityTest('Error Handling', 'Non-existent endpoint', false, `Unexpected status: ${error.response?.status}`);
            }
        }
        
        // Test if error messages leak sensitive information
        try {
            await axios.post(`${API_BASE_URL}/api/v1/wasm/analyze`, {
                content: 'test',
                module: 'nonexistent-module'
            }, {
                headers: {
                    'x-api-key': VALID_API_KEY,
                    'Content-Type': 'application/json'
                }
            });
            this.logSecurityTest('Error Handling', 'Invalid module error', false, 'Should return error');
        } catch (error) {
            if (error.response && error.response.data) {
                const errorMessage = JSON.stringify(error.response.data).toLowerCase();
                const hasPathInfo = errorMessage.includes('/') || errorMessage.includes('\\\\');
                const hasStackTrace = errorMessage.includes('stack') || errorMessage.includes('trace');
                
                if (!hasPathInfo && !hasStackTrace) {
                    this.logSecurityTest('Error Handling', 'Error message safety', true, 'No sensitive info leaked');
                } else {
                    this.logSecurityTest('Error Handling', 'Error message safety', false, 'Error may leak sensitive info');
                }
            }
        }
        
        // Test SQL injection patterns (if applicable)
        const sqlPatterns = ["'; DROP TABLE users; --", "1' OR '1'='1", "UNION SELECT * FROM users"];
        
        for (const pattern of sqlPatterns) {
            try {
                await axios.get(`${API_BASE_URL}/api/v1/analysis/${pattern}/status`, {
                    headers: { 'x-api-key': VALID_API_KEY }
                });
                this.logSecurityTest('Error Handling', `SQL injection pattern: ${pattern}`, false, 'Should be sanitized');
            } catch (error) {
                if (error.response && (error.response.status === 400 || error.response.status === 404)) {
                    this.logSecurityTest('Error Handling', `SQL injection pattern: ${pattern}`, true, 'Pattern handled safely');
                } else {
                    this.logSecurityTest('Error Handling', `SQL injection pattern: ${pattern}`, false, `Unexpected error: ${error.message}`);
                }
            }
        }
    }

    logSecurityTest(category, testName, passed, details = '') {
        const result = {
            category,
            testName,
            passed,
            details,
            timestamp: new Date().toISOString()
        };
        
        this.results.push(result);
        
        const status = passed ? '✅' : '❌';
        const detailsStr = details ? ` (${details})` : '';
        console.log(`   ${status} ${testName}${detailsStr}`);
    }

    printResults() {
        console.log('\n🔒 Security Test Results Summary');
        console.log('================================');
        
        const categories = {};
        this.results.forEach(result => {
            if (!categories[result.category]) {
                categories[result.category] = { passed: 0, total: 0 };
            }
            categories[result.category].total++;
            if (result.passed) categories[result.category].passed++;
        });
        
        let totalTests = 0;
        let passedTests = 0;
        
        Object.entries(categories).forEach(([category, stats]) => {
            const percentage = ((stats.passed / stats.total) * 100).toFixed(1);
            console.log(`${category}: ${stats.passed}/${stats.total} (${percentage}%)`);
            totalTests += stats.total;
            passedTests += stats.passed;
        });
        
        console.log(`\nOVERALL SECURITY SCORE: ${passedTests}/${totalTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
        
        // Print critical failures
        const criticalFailures = this.results.filter(r => !r.passed && 
            (r.category === 'Authentication' || r.testName.includes('injection')));
        
        if (criticalFailures.length > 0) {
            console.log('\n🚨 CRITICAL SECURITY ISSUES:');
            criticalFailures.forEach(failure => {
                console.log(`   ⚠️  ${failure.category}/${failure.testName}: ${failure.details}`);
            });
        } else {
            console.log('\n✅ No critical security issues detected');
        }
        
        // Security recommendations
        console.log('\n💡 Security Recommendations:');
        
        const authFailed = this.results.filter(r => r.category === 'Authentication' && !r.passed);
        if (authFailed.length > 0) {
            console.log('   🔐 Strengthen API authentication and authorization');
        }
        
        const rateLimitFailed = this.results.filter(r => r.category === 'Rate Limiting' && !r.passed);
        if (rateLimitFailed.length > 0) {
            console.log('   🚦 Implement proper rate limiting');
        }
        
        const inputFailed = this.results.filter(r => r.category === 'Input Validation' && !r.passed);
        if (inputFailed.length > 0) {
            console.log('   🛡️  Improve input validation and sanitization');
        }
        
        if (authFailed.length === 0 && rateLimitFailed.length === 0 && inputFailed.length === 0) {
            console.log('   ✅ Security posture looks good');
        }
        
        // Save detailed report
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: totalTests,
                passedTests: passedTests,
                securityScore: ((passedTests / totalTests) * 100).toFixed(1) + '%',
                criticalIssues: criticalFailures.length
            },
            results: this.results
        };
        
        require('fs').writeFileSync('security-test-results.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Detailed security report saved to security-test-results.json');
    }
}

// Run security tests if executed directly
if (require.main === module) {
    const suite = new SecurityTestSuite();
    suite.runSecurityTests().catch(console.error);
}

module.exports = SecurityTestSuite;