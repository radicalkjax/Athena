"use strict";
/**
 * Example demonstrating WASM module integration with existing TypeScript code
 */
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
exports.HybridAnalysisEngine = exports.MalwareAnalysisService = void 0;
const analysis_engine_bridge_1 = require("../bridge/analysis-engine-bridge");
// Example 1: Basic initialization and version check
function exampleBasicUsage() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('=== WASM Integration Example ===');
        // Initialize the WASM engine
        yield (0, analysis_engine_bridge_1.initializeAnalysisEngine)();
        // Get version
        const version = analysis_engine_bridge_1.analysisEngine.getVersion();
        console.log(`Analysis Engine Version: ${version}`);
    });
}
// Example 2: Analyze a file
function exampleFileAnalysis() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('\n=== File Analysis Example ===');
        // Simulate file content
        const suspiciousScript = `
    eval(atob('ZG9jdW1lbnQud3JpdGUoIjxzY3JpcHQ+YWxlcnQoJ1hTUycpPC9zY3JpcHQ+Iik='));
    const payload = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  `;
        const encoder = new TextEncoder();
        const fileContent = encoder.encode(suspiciousScript);
        // Analyze the content
        const result = yield analysis_engine_bridge_1.analysisEngine.analyze(fileContent.buffer, {
            enableDeobfuscation: true,
            maxAnalysisTime: 5000,
        });
        console.log('Analysis Result:', JSON.stringify(result, null, 2));
    });
}
// Example 3: Integration with existing service pattern
class MalwareAnalysisService {
    constructor() {
        this.wasmEngine = analysis_engine_bridge_1.analysisEngine;
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            yield (0, analysis_engine_bridge_1.initializeAnalysisEngine)();
        });
    }
    analyzeFile(file) {
        return __awaiter(this, void 0, void 0, function* () {
            const arrayBuffer = yield file.arrayBuffer();
            return this.wasmEngine.analyze(arrayBuffer, {
                enableDeobfuscation: true,
                patternSets: ['javascript', 'executable'],
            });
        });
    }
    getEngineInfo() {
        return {
            version: this.wasmEngine.getVersion(),
            backend: 'WASM',
            capabilities: ['deobfuscation', 'pattern-matching', 'hash-calculation'],
        };
    }
}
exports.MalwareAnalysisService = MalwareAnalysisService;
class HybridAnalysisEngine {
    constructor() {
        this.useWasm = false;
    }
    initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield (0, analysis_engine_bridge_1.initializeAnalysisEngine)();
                this.useWasm = true;
                console.log('WASM engine loaded successfully');
            }
            catch (error) {
                console.warn('Failed to load WASM engine, falling back to JS implementation');
                this.useWasm = false;
            }
        });
    }
    analyze(content, options) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.useWasm) {
                return analysis_engine_bridge_1.analysisEngine.analyze(content, options);
            }
            else {
                // Fallback to existing JavaScript implementation
                return this.legacyAnalyze(content, options);
            }
        });
    }
    getVersion() {
        if (this.useWasm) {
            return `WASM-${analysis_engine_bridge_1.analysisEngine.getVersion()}`;
        }
        return 'JS-Legacy-1.0';
    }
    legacyAnalyze(content, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // Existing JavaScript implementation
            console.log('Using legacy JavaScript analyzer');
            return {
                severity: 'unknown',
                threats: [],
                metadata: {
                    file_hash: 'legacy-hash',
                    analysis_time_ms: 500,
                    engine_version: 'legacy',
                },
            };
        });
    }
}
exports.HybridAnalysisEngine = HybridAnalysisEngine;
// Run examples
if (require.main === module) {
    (() => __awaiter(void 0, void 0, void 0, function* () {
        try {
            yield exampleBasicUsage();
            yield exampleFileAnalysis();
            // Test service integration
            const service = new MalwareAnalysisService();
            yield service.initialize();
            console.log('\nEngine Info:', service.getEngineInfo());
            // Test hybrid approach
            const hybrid = new HybridAnalysisEngine();
            yield hybrid.initialize();
            console.log('\nHybrid Engine Version:', hybrid.getVersion());
        }
        catch (error) {
            console.error('Example failed:', error);
        }
    }))();
}
