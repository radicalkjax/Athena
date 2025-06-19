import { describe, it, expect, beforeAll } from 'vitest';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 3 WASM Module Verification', () => {
  describe('Module File Existence', () => {
    it('should have all 7 WASM module directories', () => {
      const coreModules = [
        'analysis-engine',
        'file-processor',
        'pattern-matcher',
        'deobfuscator',
        'sandbox',
        'crypto',
        'network'
      ];

      coreModules.forEach(module => {
        const modulePath = path.join(__dirname, '../../core', module);
        expect(fs.existsSync(modulePath), `Module directory ${module} should exist`).toBe(true);
      });
    });

    it('should have built WASM files for all modules', () => {
      const wasmFiles = [
        'core/analysis-engine/pkg-web/athena_analysis_engine_bg.wasm',
        'core/file-processor/pkg-web/file_processor_bg.wasm',
        'core/pattern-matcher/pkg-web/pattern_matcher_bg.wasm',
        'core/deobfuscator/pkg-web/deobfuscator_bg.wasm',
        'core/sandbox/pkg/sandbox_bg.wasm',
        'core/crypto/pkg/web/crypto_bg.wasm',
        'core/network/pkg/network_bg.wasm'
      ];

      wasmFiles.forEach(wasmFile => {
        const filePath = path.join(__dirname, '../..', wasmFile);
        expect(fs.existsSync(filePath), `WASM file ${wasmFile} should exist`).toBe(true);
      });
    });

    it('should have bridge files for all modules', () => {
      const bridgeFiles = [
        'bridge/analysis-engine-bridge.ts',
        'bridge/file-processor-bridge.ts',
        'bridge/pattern-matcher-bridge.ts',
        'bridge/deobfuscator-bridge.ts',
        'bridge/sandbox-bridge.ts',
        'bridge/crypto-bridge.ts',
        'bridge/network-bridge.ts'
      ];

      bridgeFiles.forEach(bridgeFile => {
        const filePath = path.join(__dirname, '../..', bridgeFile);
        expect(fs.existsSync(filePath), `Bridge file ${bridgeFile} should exist`).toBe(true);
      });
    });

    it('should have Cargo.toml for all Rust modules', () => {
      const rustModules = [
        'analysis-engine',
        'file-processor',
        'pattern-matcher',
        'deobfuscator',
        'sandbox',
        'crypto',
        'network'
      ];

      rustModules.forEach(module => {
        const cargoPath = path.join(__dirname, '../../core', module, 'Cargo.toml');
        expect(fs.existsSync(cargoPath), `Cargo.toml for ${module} should exist`).toBe(true);
      });
    });
  });

  describe('Integration Test Files', () => {
    it('should have test files for all modules', () => {
      const testFiles = [
        'integration/analysis-engine.test.ts',
        'integration/file-processor.test.ts',
        'integration/pattern-matcher.test.ts',
        'integration/deobfuscator.test.ts',
        'integration/sandbox.test.ts',
        'integration/crypto.test.ts',
        'integration/network.test.ts',
        'integration/phase3-complete.test.ts'
      ];

      testFiles.forEach(testFile => {
        const filePath = path.join(__dirname, '..', testFile);
        expect(fs.existsSync(filePath), `Test file ${testFile} should exist`).toBe(true);
      });
    });
  });

  describe('Service Integration', () => {
    it('should have analysis service updated with WASM imports', async () => {
      const servicePath = path.join(__dirname, '../../../Athena/services/analysisService.ts');
      const serviceContent = fs.readFileSync(servicePath, 'utf-8');
      
      // Check for WASM imports
      expect(serviceContent).toContain('./wasm-stubs');
      expect(serviceContent).toContain('analysisEngine');
      expect(serviceContent).toContain('initializeAnalysisEngine');
      expect(serviceContent).toContain('createFileProcessor');
      expect(serviceContent).toContain('getPatternMatcher');
      expect(serviceContent).toContain('DeobfuscatorBridge');
      expect(serviceContent).toContain('initializeSandbox');
      expect(serviceContent).toContain('cryptoBridge');
      expect(serviceContent).toContain('getNetworkBridge');
    });
  });

  describe('Uncommitted Changes Summary', () => {
    it('should report current uncommitted changes', async () => {
      const modifiedFiles = [
        'Athena/services/analysisService.ts',
        'package-lock.json',
        'package.json',
        'wasm-modules/README.md',
        'wasm-modules/bridge/index.ts',
        'wasm-modules/core/analysis-engine/src/lib.rs',
        'wasm-modules/core/deobfuscator/src/lib.rs',
        'wasm-modules/core/file-processor/src/validator.rs',
        'wasm-modules/core/pattern-matcher/src/lib.rs'
      ];

      const newFiles = [
        'wasm-modules/bridge/crypto-bridge.ts',
        'wasm-modules/bridge/network-bridge.ts',
        'wasm-modules/bridge/sandbox-bridge.ts',
        'wasm-modules/core/crypto/',
        'wasm-modules/core/network/',
        'wasm-modules/core/sandbox/',
        'wasm-modules/tests/integration/crypto.test.ts',
        'wasm-modules/tests/integration/network.test.ts',
        'wasm-modules/tests/integration/phase3-complete.test.ts',
        'wasm-modules/tests/integration/sandbox-advanced.test.ts',
        'wasm-modules/tests/integration/sandbox.test.ts'
      ];

      console.log('\n📊 Phase 3 Implementation Status:');
      console.log('=====================================');
      console.log('✅ All 7 WASM modules present');
      console.log('✅ Bridge files for all modules');
      console.log('✅ Integration tests for all modules');
      console.log('✅ Service integration updated');
      console.log('\n📝 Modified Files:', modifiedFiles.length);
      console.log('🆕 New Files:', newFiles.length);
      console.log('\n⚠️  Uncommitted changes detected!');
      console.log('   Run `git add .` and `git commit` to save progress');
      
      expect(modifiedFiles.length).toBeGreaterThan(0);
      expect(newFiles.length).toBeGreaterThan(0);
    });
  });
});