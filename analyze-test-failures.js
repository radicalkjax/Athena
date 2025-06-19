const fs = require('fs');

try {
  const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));

  // Group failures by test file
  const failuresByFile = {};

  if (results.testResults) {
    results.testResults.forEach(suite => {
      const filePath = suite.testFilePath || suite.name;
      if (!filePath) return;
      
      const failures = suite.assertionResults?.filter(test => test.status === 'failed') || [];
      const passes = suite.assertionResults?.filter(test => test.status === 'passed') || [];
      
      if (failures.length > 0) {
        failuresByFile[filePath] = {
          failing: failures.length,
          passing: passes.length,
          total: (failures.length + passes.length),
          failures: failures
        };
      }
    });
  }

  // Find files with 1-3 failures
  const easyTargets = Object.entries(failuresByFile)
    .filter(([_, data]) => data.failing >= 1 && data.failing <= 3)
    .sort((a, b) => a[1].failing - b[1].failing)
    .slice(0, 10);

  console.log('Test files with 1-3 failures:');
  console.log('==============================');
  easyTargets.forEach(([file, data]) => {
    const fileName = file.split('/').pop();
    console.log(`\n${fileName}: ${data.failing} failing, ${data.passing} passing`);
    console.log(`File: ${file}`);
    
    data.failures.forEach((failure, idx) => {
      console.log(`  Failure ${idx + 1}: ${failure.title || failure.fullName}`);
      if (failure.failureMessages && failure.failureMessages[0]) {
        const msg = failure.failureMessages[0].split('\n')[0].substring(0, 150);
        console.log(`    Error: ${msg}...`);
      }
    });
  });

  console.log(`\n\nTotal files with 1-3 failures: ${easyTargets.length}`);
} catch (error) {
  console.error('Error analyzing test results:', error.message);
}