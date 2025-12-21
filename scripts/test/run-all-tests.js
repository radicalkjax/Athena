#!/usr/bin/env node

/**
 * Master Test Runner for Athena v2
 * Runs all test suites and generates comprehensive report
 */

const TestSuite = require('./test-comprehensive');
const PerformanceBenchmark = require('./performance-benchmark');
const SecurityTestSuite = require('./security-tests');
const fs = require('fs');

class MasterTestRunner {
    constructor() {
        this.startTime = Date.now();
        this.results = {
            comprehensive: null,
            performance: null,
            security: null
        };
    }

    async runAllTests() {
        console.log('🏁 Athena v2 - Master Test Suite');
        console.log('================================\n');
        
        try {
            // Run comprehensive tests
            console.log('Phase 1: Comprehensive Testing');
            console.log('------------------------------');
            const comprehensive = new TestSuite();
            await comprehensive.runAllTests();
            this.results.comprehensive = comprehensive.results;
            
            console.log('\n' + '='.repeat(50) + '\n');
            
            // Run performance benchmarks
            console.log('Phase 2: Performance Benchmarking');
            console.log('---------------------------------');
            const performance = new PerformanceBenchmark();
            await performance.runBenchmarks();
            this.results.performance = performance.results;
            
            console.log('\n' + '='.repeat(50) + '\n');
            
            // Run security tests
            console.log('Phase 3: Security Testing');
            console.log('-------------------------');
            const security = new SecurityTestSuite();
            await security.runSecurityTests();
            this.results.security = security.results;
            
            // Generate master report
            this.generateMasterReport();
            
        } catch (error) {
            console.error('❌ Master test suite failed:', error.message);
        }
    }

    generateMasterReport() {
        const executionTime = Date.now() - this.startTime;
        
        console.log('\n' + '='.repeat(60));
        console.log('🏆 ATHENA V2 - MASTER TEST REPORT');
        console.log('='.repeat(60));
        
        // Calculate overall stats
        const comprehensiveTests = Object.values(this.results.comprehensive || {}).flat();
        const comprehensivePassed = comprehensiveTests.filter(t => t.passed).length;
        const comprehensiveTotal = comprehensiveTests.length;
        
        const securityTests = this.results.security || [];
        const securityPassed = securityTests.filter(t => t.passed).length;
        const securityTotal = securityTests.length;
        
        const performanceTests = this.results.performance || [];
        const performanceCount = performanceTests.length;
        
        console.log(`\n📊 TEST STATISTICS:`);
        console.log(`   Comprehensive Tests: ${comprehensivePassed}/${comprehensiveTotal} passed (${((comprehensivePassed/comprehensiveTotal)*100).toFixed(1)}%)`);
        console.log(`   Security Tests: ${securityPassed}/${securityTotal} passed (${((securityPassed/securityTotal)*100).toFixed(1)}%)`);
        console.log(`   Performance Benchmarks: ${performanceCount} completed`);
        console.log(`   Total Execution Time: ${(executionTime/1000).toFixed(2)}s`);
        
        // Overall score calculation
        const overallScore = ((comprehensivePassed + securityPassed) / (comprehensiveTotal + securityTotal)) * 100;
        console.log(`\n🎯 OVERALL SCORE: ${overallScore.toFixed(1)}%`);
        
        // Status assessment
        let status = '🔴 CRITICAL ISSUES';
        if (overallScore >= 95) status = '🟢 EXCELLENT';
        else if (overallScore >= 85) status = '🟡 GOOD';
        else if (overallScore >= 70) status = '🟠 NEEDS IMPROVEMENT';
        
        console.log(`   Status: ${status}`);
        
        // Critical issues summary
        const criticalIssues = [];
        
        // Check for backend connectivity
        const healthTests = comprehensiveTests.filter(t => t.testName === 'Health Check');
        if (healthTests.length === 0 || healthTests.some(t => !t.passed)) {
            criticalIssues.push('Backend connectivity issues');
        }
        
        // Check for security issues
        const authTests = securityTests.filter(t => t.category === 'Authentication' && !t.passed);
        if (authTests.length > 0) {
            criticalIssues.push('Authentication vulnerabilities');
        }
        
        // Check for WASM issues
        const wasmTests = comprehensiveTests.filter(t => t.category === 'wasm');
        const wasmFailed = wasmTests.filter(t => !t.passed);
        if (wasmFailed.length > wasmTests.length / 2) {
            criticalIssues.push('WASM module issues');
        }
        
        console.log(`\n🚨 CRITICAL ISSUES (${criticalIssues.length}):`);
        if (criticalIssues.length === 0) {
            console.log('   ✅ No critical issues detected');
        } else {
            criticalIssues.forEach(issue => console.log(`   ❌ ${issue}`));
        }
        
        // Feature readiness assessment
        console.log(`\n🎪 FEATURE READINESS:`);
        
        const fileUploadTests = comprehensiveTests.filter(t => t.category === 'fileUpload');
        const fileUploadReady = fileUploadTests.length > 0 && fileUploadTests.every(t => t.passed);
        console.log(`   File Upload: ${fileUploadReady ? '✅ Ready' : '❌ Issues detected'}`);
        
        const wasmReady = wasmTests.length > 0 && wasmTests.every(t => t.passed);
        console.log(`   WASM Analysis: ${wasmReady ? '✅ Ready' : '❌ Issues detected'}`);
        
        const backendReady = healthTests.length > 0 && healthTests.every(t => t.passed);
        console.log(`   Backend Services: ${backendReady ? '✅ Ready' : '❌ Issues detected'}`);
        
        const securityReady = ((securityPassed / securityTotal) * 100) >= 80;
        console.log(`   Security Posture: ${securityReady ? '✅ Acceptable' : '❌ Needs attention'}`);
        
        // Performance assessment
        const healthTest = comprehensiveTests.find(t => t.testName === 'Health Check Speed');
        const performanceHealthy = healthTest && healthTest.details && parseFloat(healthTest.details) < 1000;
        console.log(`   Performance: ${performanceHealthy ? '✅ Good' : '⚠️ Could be improved'}`);
        
        // Recommendations
        console.log(`\n💡 RECOMMENDATIONS:`);
        
        if (!fileUploadReady) {
            console.log('   1. Fix file upload functionality before production');
        }
        
        if (!wasmReady) {
            console.log('   2. Resolve WASM module issues for full analysis capability');
        }
        
        if (!securityReady) {
            console.log('   3. Address security vulnerabilities before deployment');
        }
        
        if (authTests.length > 0) {
            console.log('   4. Implement proper API authentication and rate limiting');
        }
        
        if (criticalIssues.length === 0 && overallScore >= 90) {
            console.log('   ✅ System is ready for production deployment');
            console.log('   ✅ Consider adding API keys for full AI functionality');
            console.log('   ✅ Run tests with real data before go-live');
        }
        
        // Next steps
        console.log(`\n🚀 NEXT STEPS:`);
        console.log('   1. Review detailed test reports (*.json files)');
        console.log('   2. Address any critical issues identified');
        console.log('   3. Add API keys for AI providers (.env file)');
        console.log('   4. Run end-to-end tests with the Tauri application');
        console.log('   5. Deploy to staging environment for final validation');
        
        // Save master report
        const masterReport = {
            timestamp: new Date().toISOString(),
            executionTime: executionTime,
            summary: {
                comprehensiveTests: { passed: comprehensivePassed, total: comprehensiveTotal },
                securityTests: { passed: securityPassed, total: securityTotal },
                performanceBenchmarks: performanceCount,
                overallScore: overallScore,
                status: status,
                criticalIssues: criticalIssues.length
            },
            featureReadiness: {
                fileUpload: fileUploadReady,
                wasmAnalysis: wasmReady,
                backendServices: backendReady,
                securityPosture: securityReady,
                performance: performanceHealthy
            },
            recommendations: criticalIssues.length === 0 && overallScore >= 90 ? 
                ['System ready for production'] : 
                ['Address critical issues', 'Improve test coverage', 'Enhance security'],
            detailedResults: this.results
        };
        
        fs.writeFileSync('master-test-report.json', JSON.stringify(masterReport, null, 2));
        console.log(`\n📄 Master report saved to master-test-report.json`);
        
        console.log('\n' + '='.repeat(60));
        console.log('Test suite completed successfully! 🎉');
        console.log('='.repeat(60));
    }
}

// Run master test suite if executed directly
if (require.main === module) {
    const runner = new MasterTestRunner();
    runner.runAllTests().catch(console.error);
}

module.exports = MasterTestRunner;