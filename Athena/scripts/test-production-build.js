#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Production Build...\n');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, description) {
  try {
    log(`\n📌 ${description}...`, 'blue');
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    log(`✅ ${description} - Success`, 'green');
    return { success: true, output };
  } catch (error) {
    log(`❌ ${description} - Failed`, 'red');
    console.error(error.message);
    return { success: false, error: error.message };
  }
}

async function testProductionBuild() {
  const results = {
    passed: [],
    failed: [],
    warnings: [],
  };

  // 1. Check for circular dependencies
  const circularDeps = runCommand(
    'npx madge --circular ./',
    'Checking for circular dependencies'
  );
  if (circularDeps.success) {
    if (circularDeps.output.includes('No circular dependencies found')) {
      results.passed.push('No circular dependencies');
    } else {
      results.warnings.push('Circular dependencies detected:\n' + circularDeps.output);
    }
  } else {
    results.failed.push('Circular dependency check failed');
  }

  // 2. Build production version
  const build = runCommand(
    'npm run build:web',
    'Building production version'
  );
  if (build.success) {
    results.passed.push('Production build successful');
  } else {
    results.failed.push('Production build failed');
    // If build fails, we can't continue
    printResults(results);
    process.exit(1);
  }

  // 3. Check bundle sizes
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    const getDirectorySize = (dir) => {
      let size = 0;
      const files = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          size += getDirectorySize(filePath);
        } else {
          size += fs.statSync(filePath).size;
        }
      }
      return size;
    };

    const totalSize = getDirectorySize(distPath);
    const sizeMB = (totalSize / 1024 / 1024).toFixed(2);
    
    log(`\n📊 Total build size: ${sizeMB} MB`, 'blue');
    
    if (totalSize > 10 * 1024 * 1024) {
      results.warnings.push(`Build size (${sizeMB} MB) exceeds recommended 10 MB`);
    } else {
      results.passed.push(`Build size is reasonable (${sizeMB} MB)`);
    }
  }

  // 4. Check for common issues
  const jsFiles = fs.readdirSync(path.join(distPath, 'static', 'js')).filter(f => f.endsWith('.js'));
  
  for (const file of jsFiles) {
    const content = fs.readFileSync(path.join(distPath, 'static', 'js', file), 'utf8');
    
    // Check for console.log statements
    if (content.includes('console.log')) {
      results.warnings.push(`Found console.log in ${file}`);
    }
    
    // Check for common React errors
    if (content.includes('Error #130')) {
      results.failed.push(`React Error #130 pattern found in ${file}`);
    }
  }

  // 5. Test if build can be served
  log('\n🌐 Testing if build can be served...', 'blue');
  const { spawn } = require('child_process');
  const server = spawn('npx', ['serve', 'dist', '-p', '3001'], {
    detached: true,
    stdio: 'ignore'
  });
  
  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Test if server responds
  try {
    const testServer = execSync('curl -s -o /dev/null -w "%{http_code}" http://localhost:3001', {
      encoding: 'utf8'
    });
    
    if (testServer.trim() === '200') {
      results.passed.push('Production build serves successfully');
    } else {
      results.failed.push(`Server returned status code: ${testServer}`);
    }
  } catch (error) {
    results.failed.push('Failed to test server response');
  }
  
  // Kill the server
  try {
    process.kill(-server.pid);
  } catch (e) {
    // Server might have already stopped
  }

  // 6. Run size-limit check
  const sizeLimit = runCommand(
    'npx size-limit',
    'Checking bundle size limits'
  );
  if (sizeLimit.success) {
    results.passed.push('Bundle sizes within limits');
  } else {
    results.warnings.push('Bundle size limits exceeded');
  }

  printResults(results);
}

function printResults(results) {
  console.log('\n' + '='.repeat(50));
  log('📋 PRODUCTION BUILD TEST RESULTS', 'blue');
  console.log('='.repeat(50) + '\n');

  if (results.passed.length > 0) {
    log('✅ PASSED:', 'green');
    results.passed.forEach(item => console.log(`  • ${item}`));
  }

  if (results.warnings.length > 0) {
    log('\n⚠️  WARNINGS:', 'yellow');
    results.warnings.forEach(item => console.log(`  • ${item}`));
  }

  if (results.failed.length > 0) {
    log('\n❌ FAILED:', 'red');
    results.failed.forEach(item => console.log(`  • ${item}`));
  }

  console.log('\n' + '='.repeat(50));
  
  const totalTests = results.passed.length + results.failed.length;
  const passRate = ((results.passed.length / totalTests) * 100).toFixed(0);
  
  if (results.failed.length === 0) {
    log(`✅ All tests passed! (${passRate}% pass rate)`, 'green');
    if (results.warnings.length > 0) {
      log(`⚠️  But there are ${results.warnings.length} warnings to address`, 'yellow');
    }
  } else {
    log(`❌ ${results.failed.length} tests failed (${passRate}% pass rate)`, 'red');
    process.exit(1);
  }
}

// Run the tests
testProductionBuild().catch(error => {
  log('Unexpected error during testing:', 'red');
  console.error(error);
  process.exit(1);
});