#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('Running tests...\n');

try {
  const output = execSync('npm test -- --no-watch --passWithNoTests --json', {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024 // 10MB
  });
  
  const lines = output.split('\n');
  const jsonLine = lines.find(line => line.trim().startsWith('{') && line.includes('testResults'));
  
  if (jsonLine) {
    const results = JSON.parse(jsonLine);
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Total Test Suites: ${results.numTotalTestSuites}`);
    console.log(`Passed: ${results.numPassedTestSuites}`);
    console.log(`Failed: ${results.numFailedTestSuites}`);
    console.log(`\nTotal Tests: ${results.numTotalTests}`);
    console.log(`Passed: ${results.numPassedTests}`);
    console.log(`Failed: ${results.numFailedTests}`);
    console.log(`Skipped: ${results.numPendingTests}`);
    
    if (results.numFailedTestSuites > 0) {
      console.log('\n=== FAILED TEST SUITES ===');
      results.testResults
        .filter(suite => suite.numFailingTests > 0)
        .forEach(suite => {
          console.log(`\n${suite.name}:`);
          suite.testResults
            .filter(test => test.status === 'failed')
            .forEach(test => {
              console.log(`  ✗ ${test.title}`);
            });
        });
    }
  }
} catch (error) {
  console.log('Tests failed or timed out');
  console.log('Error:', error.message);
}