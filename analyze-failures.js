const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Run tests and capture output
console.log('Running tests to analyze failures...');
const output = execSync('npm test 2>&1 || true', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

// Parse test output
const lines = output.split('\n');
const testFiles = [];
let currentFile = null;
let currentFailures = [];

lines.forEach(line => {
  // Match test file lines
  const fileMatch = line.match(/❯\s+(.+\.(?:ts|tsx|js|jsx))\s+\((\d+)\s+tests.*?(\d+)\s+failed/);
  if (fileMatch) {
    if (currentFile && currentFailures.length > 0) {
      testFiles.push({
        file: currentFile.file,
        totalTests: currentFile.totalTests,
        failedTests: currentFile.failedTests,
        failures: currentFailures
      });
    }
    currentFile = {
      file: fileMatch[1],
      totalTests: parseInt(fileMatch[2]),
      failedTests: parseInt(fileMatch[3])
    };
    currentFailures = [];
  }
  
  // Match failing test names
  const testMatch = line.match(/×\s+(.+?)\s+\d+ms$/);
  if (testMatch && currentFile) {
    currentFailures.push({
      name: testMatch[1].trim(),
      error: null
    });
  }
  
  // Match error messages
  const errorMatch = line.match(/→\s+(.+)$/);
  if (errorMatch && currentFailures.length > 0) {
    currentFailures[currentFailures.length - 1].error = errorMatch[1].trim();
  }
});

// Add the last file
if (currentFile && currentFailures.length > 0) {
  testFiles.push({
    file: currentFile.file,
    totalTests: currentFile.totalTests,
    failedTests: currentFile.failedTests,
    failures: currentFailures
  });
}

// Filter for files with 1-3 failures
const easyTargets = testFiles
  .filter(f => f.failedTests >= 1 && f.failedTests <= 3)
  .sort((a, b) => a.failedTests - b.failedTests);

console.log('\n=== TEST FILES WITH 1-3 FAILURES ===\n');

easyTargets.forEach((file, idx) => {
  console.log(`${idx + 1}. ${file.file}`);
  console.log(`   Total tests: ${file.totalTests}, Failed: ${file.failedTests}`);
  console.log(`   Failures:`);
  file.failures.forEach((failure, i) => {
    console.log(`     ${i + 1}. ${failure.name}`);
    if (failure.error) {
      console.log(`        Error: ${failure.error}`);
    }
  });
  console.log('');
});

// Categorize common error patterns
const errorPatterns = {
  'Mock/Import issues': [],
  'Function not found': [],
  'Type/Assertion errors': [],
  'Spy/Mock call issues': []
};

easyTargets.forEach(file => {
  file.failures.forEach(failure => {
    if (failure.error) {
      if (failure.error.includes('mock') || failure.error.includes('Mock') || failure.error.includes('export')) {
        errorPatterns['Mock/Import issues'].push({ file: file.file, error: failure.error });
      } else if (failure.error.includes('is not a function') || failure.error.includes('Cannot read properties')) {
        errorPatterns['Function not found'].push({ file: file.file, error: failure.error });
      } else if (failure.error.includes('expected') && failure.error.includes('to be')) {
        errorPatterns['Type/Assertion errors'].push({ file: file.file, error: failure.error });
      } else if (failure.error.includes('spy') || failure.error.includes('called')) {
        errorPatterns['Spy/Mock call issues'].push({ file: file.file, error: failure.error });
      }
    }
  });
});

console.log('\n=== ERROR PATTERN ANALYSIS ===\n');
Object.entries(errorPatterns).forEach(([pattern, errors]) => {
  if (errors.length > 0) {
    console.log(`${pattern}: ${errors.length} occurrences`);
    // Show first 2 examples
    errors.slice(0, 2).forEach(e => {
      console.log(`  - ${path.basename(e.file)}: ${e.error.substring(0, 100)}...`);
    });
    console.log('');
  }
});

console.log(`\nTotal files with 1-3 failures: ${easyTargets.length}`);
console.log('Total failed tests:', testFiles.reduce((sum, f) => sum + f.failedTests, 0));
console.log('Total tests:', testFiles.reduce((sum, f) => sum + f.totalTests, 0));