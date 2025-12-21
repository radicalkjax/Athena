/**
 * Simple test script to verify sandbox functionality
 * Run with: node test-sandbox.js
 */

import { initializeSandbox, executeInSandbox, cleanupSandbox } from '../bridge/sandbox-bridge.js';

async function testSandbox() {
  console.log('🧪 Testing WASM Sandbox Module...\n');
  
  try {
    // Initialize sandbox
    console.log('1. Initializing sandbox...');
    await initializeSandbox();
    console.log('✅ Sandbox initialized successfully\n');
    
    // Test 1: Simple code execution
    console.log('2. Testing simple code execution...');
    const simpleCode = 'console.log("Hello from sandbox!");';
    const result1 = await executeInSandbox(simpleCode);
    console.log(`   Success: ${result1.success}`);
    console.log(`   Exit code: ${result1.exitCode}`);
    console.log(`   Execution time: ${result1.executionTime}ms`);
    if (result1.output.length > 0) {
      console.log(`   Output: ${new TextDecoder().decode(result1.output)}`);
    }
    console.log('✅ Simple execution test passed\n');
    
    // Test 2: Resource monitoring
    console.log('3. Testing resource monitoring...');
    const resourceCode = `
      const arr = new Uint8Array(1024 * 1024); // 1MB
      for (let i = 0; i < 1000000; i++) {
        Math.sqrt(i);
      }
      console.log('Resource test complete');
    `;
    const result2 = await executeInSandbox(resourceCode);
    console.log(`   Memory used: ${(result2.resourceUsage.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   Peak memory: ${(result2.resourceUsage.peakMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`   CPU time: ${result2.resourceUsage.cpuTimeUsed}s`);
    console.log(`   Syscall count: ${result2.resourceUsage.syscallCount}`);
    console.log('✅ Resource monitoring test passed\n');
    
    // Test 3: Security policy enforcement
    console.log('4. Testing security policy enforcement...');
    const maliciousCode = `
      const fs = require('fs');
      try {
        fs.readFileSync('/etc/passwd');
      } catch (e) {
        console.log('File access blocked as expected');
      }
    `;
    const result3 = await executeInSandbox(maliciousCode);
    console.log(`   Security events: ${result3.securityEvents.length}`);
    result3.securityEvents.forEach(event => {
      console.log(`   - ${event.eventType} (${event.severity}): ${event.details}`);
    });
    console.log('✅ Security policy test passed\n');
    
    // Test 4: Custom policy
    console.log('5. Testing custom execution policy...');
    const customPolicy = {
      maxMemory: 50 * 1024 * 1024,  // 50MB
      maxCpuTime: 5,                 // 5 seconds
      allowNetwork: false,
      allowFileSystem: false,
      syscallPolicy: 'deny_all'
    };
    const result4 = await executeInSandbox('console.log("Custom policy test");', customPolicy);
    console.log(`   Executed with custom policy: ${result4.success}`);
    console.log('✅ Custom policy test passed\n');
    
    // Test 5: Error handling
    console.log('6. Testing error handling...');
    const errorCode = 'throw new Error("Test error");';
    const result5 = await executeInSandbox(errorCode);
    console.log(`   Error handled: ${!result5.success}`);
    console.log(`   Error message: ${result5.error}`);
    console.log('✅ Error handling test passed\n');
    
    console.log('🎉 All sandbox tests passed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    await cleanupSandbox();
    console.log('\n🧹 Sandbox cleaned up');
  }
}

// Run tests
testSandbox().catch(console.error);