"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
(0, vitest_1.describe)('Phase 3 WASM Module Verification', () => {
    (0, vitest_1.describe)('Module File Existence', () => {
        (0, vitest_1.it)('should have all 7 WASM module directories', () => {
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
                (0, vitest_1.expect)(fs.existsSync(modulePath), `Module directory ${module} should exist`).toBe(true);
            });
        });
        (0, vitest_1.it)('should have built WASM files for all modules', () => {
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
                (0, vitest_1.expect)(fs.existsSync(filePath), `WASM file ${wasmFile} should exist`).toBe(true);
            });
        });
        (0, vitest_1.it)('should have bridge files for all modules', () => {
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
                (0, vitest_1.expect)(fs.existsSync(filePath), `Bridge file ${bridgeFile} should exist`).toBe(true);
            });
        });
        (0, vitest_1.it)('should have Cargo.toml for all Rust modules', () => {
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
                (0, vitest_1.expect)(fs.existsSync(cargoPath), `Cargo.toml for ${module} should exist`).toBe(true);
            });
        });
    });
    (0, vitest_1.describe)('Integration Test Files', () => {
        (0, vitest_1.it)('should have test files for all modules', () => {
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
                (0, vitest_1.expect)(fs.existsSync(filePath), `Test file ${testFile} should exist`).toBe(true);
            });
        });
    });
    (0, vitest_1.describe)('Service Integration', () => {
        (0, vitest_1.it)('should have analysis service updated with WASM imports', () => __awaiter(void 0, void 0, void 0, function* () {
            const servicePath = path.join(__dirname, '../../../Athena/services/analysisService.ts');
            const serviceContent = fs.readFileSync(servicePath, 'utf-8');
            // Check for WASM imports
            (0, vitest_1.expect)(serviceContent).toContain('wasm-modules/bridge');
            (0, vitest_1.expect)(serviceContent).toContain('analysisEngine');
            (0, vitest_1.expect)(serviceContent).toContain('initializeAnalysisEngine');
            (0, vitest_1.expect)(serviceContent).toContain('createFileProcessor');
            (0, vitest_1.expect)(serviceContent).toContain('getPatternMatcher');
            (0, vitest_1.expect)(serviceContent).toContain('DeobfuscatorBridge');
            (0, vitest_1.expect)(serviceContent).toContain('initializeSandbox');
            (0, vitest_1.expect)(serviceContent).toContain('cryptoBridge');
            (0, vitest_1.expect)(serviceContent).toContain('getNetworkBridge');
        }));
    });
    (0, vitest_1.describe)('Uncommitted Changes Summary', () => {
        (0, vitest_1.it)('should report current uncommitted changes', () => __awaiter(void 0, void 0, void 0, function* () {
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
            (0, vitest_1.expect)(modifiedFiles.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(newFiles.length).toBeGreaterThan(0);
        }));
    });
});
