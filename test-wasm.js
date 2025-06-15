#!/usr/bin/env node

/**
 * Standalone WASM test script
 * Tests that WASM modules can be loaded and initialized
 */

const path = require('path');

async function testWASM() {
  console.log('Testing WASM module loading...\n');

  try {
    // Test 1: Load the compiled bridge module
    console.log('1. Testing bridge module loading...');
    const bridgeIndex = require('./wasm-modules/bridge/index.js');
    console.log('✓ Bridge module loaded successfully');
    console.log('  Available exports:', Object.keys(bridgeIndex).slice(0, 5).join(', '), '...\n');

    // Test 2: Initialize Analysis Engine
    console.log('2. Testing Analysis Engine initialization...');
    const { initializeAnalysisEngine } = bridgeIndex;
    const engine = await initializeAnalysisEngine();
    console.log('✓ Analysis Engine initialized successfully');
    console.log('  Version:', engine.get_version(), '\n');

    // Test 3: Test basic analysis
    console.log('3. Testing basic analysis...');
    const testContent = new TextEncoder().encode('console.log("Hello WASM!");');
    const result = await engine.analyze(testContent, { enablePatternMatching: true });
    console.log('✓ Analysis completed successfully');
    console.log('  Result type:', result.resultType);
    console.log('  Patterns found:', result.patterns?.length || 0, '\n');

    // Test 4: Test crypto bridge
    console.log('4. Testing Crypto Bridge...');
    const { cryptoBridge } = bridgeIndex;
    const hash = await cryptoBridge.hash(testContent, { algorithm: 'sha256' });
    console.log('✓ Crypto bridge working');
    console.log('  SHA256 hash:', hash, '\n');

    // Test 5: Test file processor
    console.log('5. Testing File Processor...');
    const { createFileProcessor } = bridgeIndex;
    const fileProcessor = await createFileProcessor({
      extractStrings: true,
      scanForPatterns: true
    });
    console.log('✓ File processor created successfully\n');

    console.log('All WASM tests passed! 🎉');
    console.log('\nWASM modules are working correctly in the Node.js environment.');

  } catch (error) {
    console.error('❌ WASM test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testWASM().catch(console.error);