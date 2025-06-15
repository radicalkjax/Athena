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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const pattern_matcher_bridge_1 = require("../../bridge/pattern-matcher-bridge");
(0, globals_1.describe)('PatternMatcher WASM Integration Tests', () => {
    let patternMatcher;
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        patternMatcher = (0, pattern_matcher_bridge_1.getPatternMatcher)();
        yield patternMatcher.initialize();
    }));
    (0, globals_1.afterAll)(() => {
        patternMatcher.destroy();
    });
    (0, globals_1.describe)('Basic Functionality', () => {
        (0, globals_1.it)('should initialize successfully', () => {
            (0, globals_1.expect)(patternMatcher.getRuleCount()).toBeGreaterThan(0);
        });
        (0, globals_1.it)('should detect JavaScript eval with base64', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousCode = 'eval(atob("ZG9jdW1lbnQud3JpdGUoIjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD4iKQ=="))';
            const encoder = new TextEncoder();
            const data = encoder.encode(maliciousCode);
            const result = yield patternMatcher.scan(data.buffer);
            (0, globals_1.expect)(result.matches.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.matches[0].category).toBe('Obfuscation');
            (0, globals_1.expect)(result.matches[0].severity).toBe('High');
            (0, globals_1.expect)(result.threat_score).toBeGreaterThan(0);
        }));
        (0, globals_1.it)('should detect PHP backdoor pattern', () => __awaiter(void 0, void 0, void 0, function* () {
            const phpBackdoor = '<?php eval($_POST["cmd"]); ?>';
            const encoder = new TextEncoder();
            const data = encoder.encode(phpBackdoor);
            const result = yield patternMatcher.scan(data.buffer);
            (0, globals_1.expect)(result.matches.length).toBeGreaterThan(0);
            const backdoorMatch = result.matches.find(m => m.category === 'Malware');
            (0, globals_1.expect)(backdoorMatch).toBeDefined();
            (0, globals_1.expect)(backdoorMatch === null || backdoorMatch === void 0 ? void 0 : backdoorMatch.severity).toBe('Critical');
        }));
        (0, globals_1.it)('should detect PowerShell encoded command', () => __awaiter(void 0, void 0, void 0, function* () {
            const psCommand = 'powershell -encodedcommand U3RhcnQtUHJvY2VzcyBjYWxjLmV4ZQ==';
            const encoder = new TextEncoder();
            const data = encoder.encode(psCommand);
            const result = yield patternMatcher.scan(data.buffer);
            (0, globals_1.expect)(result.matches.length).toBeGreaterThan(0);
            (0, globals_1.expect)(result.matches[0].category).toBe('Obfuscation');
        }));
        (0, globals_1.it)('should handle binary patterns (PE header)', () => __awaiter(void 0, void 0, void 0, function* () {
            // Simulate a PE header
            const peHeader = new Uint8Array([
                0x4D, 0x5A, // MZ
                ...new Array(58).fill(0x00),
                0x50, 0x45, 0x00, 0x00 // PE\0\0
            ]);
            const result = yield patternMatcher.scan(peHeader.buffer);
            (0, globals_1.expect)(result.matches.length).toBeGreaterThan(0);
            const peMatch = result.matches.find(m => m.rule_name.includes('PE'));
            (0, globals_1.expect)(peMatch).toBeDefined();
        }));
    });
    (0, globals_1.describe)('Custom Rules', () => {
        (0, globals_1.it)('should add custom YARA-like rule', () => __awaiter(void 0, void 0, void 0, function* () {
            const customRule = `
rule custom_test_rule
{
  strings:
    $test = "CUSTOM_MALWARE_SIGNATURE"
  condition:
    $test
}`;
            const ruleId = yield patternMatcher.addRule(customRule);
            (0, globals_1.expect)(ruleId).toBeTruthy();
            // Test the custom rule
            const testData = 'This file contains CUSTOM_MALWARE_SIGNATURE in it';
            const encoder = new TextEncoder();
            const data = encoder.encode(testData);
            const result = yield patternMatcher.scan(data.buffer);
            const customMatch = result.matches.find(m => m.rule_id === 'custom_test_rule');
            (0, globals_1.expect)(customMatch).toBeDefined();
        }));
    });
    (0, globals_1.describe)('Performance', () => {
        (0, globals_1.it)('should scan large data efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            // Create 10MB of random data with some patterns
            const size = 10 * 1024 * 1024;
            const data = new Uint8Array(size);
            // Add some malicious patterns
            const maliciousPattern = new TextEncoder().encode('eval(atob(');
            for (let i = 0; i < 100; i++) {
                const offset = Math.floor(Math.random() * (size - maliciousPattern.length));
                data.set(maliciousPattern, offset);
            }
            const startTime = performance.now();
            const result = yield patternMatcher.scan(data.buffer);
            const endTime = performance.now();
            const scanTimeMs = endTime - startTime;
            const throughputMbps = (size / (1024 * 1024)) / (scanTimeMs / 1000);
            console.log(`Scanned ${size / (1024 * 1024)}MB in ${scanTimeMs.toFixed(2)}ms`);
            console.log(`Throughput: ${throughputMbps.toFixed(2)} MB/s`);
            (0, globals_1.expect)(result.matches.length).toBeGreaterThan(0);
            (0, globals_1.expect)(throughputMbps).toBeGreaterThan(50); // At least 50 MB/s
        }));
    });
    (0, globals_1.describe)('Streaming Support', () => {
        (0, globals_1.it)('should scan data in streaming mode', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            // Create a readable stream with malicious content
            const chunks = [
                'This is the first chunk with eval(atob(',
                'more data here with document.write("<script"',
                'and finally some PHP: <?php eval($_POST["cmd"]); ?>'
            ];
            const stream = new ReadableStream({
                start(controller) {
                    for (const chunk of chunks) {
                        controller.enqueue(new TextEncoder().encode(chunk));
                    }
                    controller.close();
                }
            });
            const results = [];
            try {
                for (var _d = true, _e = __asyncValues(patternMatcher.scanStreaming(stream)), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                    _c = _f.value;
                    _d = false;
                    const result = _c;
                    results.push(result);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
                }
                finally { if (e_1) throw e_1.error; }
            }
            (0, globals_1.expect)(results.length).toBeGreaterThan(0);
            // Check that we found matches
            const allMatches = results.flatMap(r => r.matches);
            (0, globals_1.expect)(allMatches.length).toBeGreaterThan(0);
        }));
    });
    (0, globals_1.describe)('Statistics', () => {
        (0, globals_1.it)('should track scanning statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            const stats = patternMatcher.getStats();
            (0, globals_1.expect)(stats.total_scans).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.average_scan_time_ms).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.throughput_mbps).toBeGreaterThan(0);
        }));
    });
    (0, globals_1.describe)('Match Data Decoding', () => {
        (0, globals_1.it)('should decode matched data correctly', () => __awaiter(void 0, void 0, void 0, function* () {
            const testString = 'This contains malware signature';
            const encoder = new TextEncoder();
            const data = encoder.encode(testString);
            // Add a pattern that will match "malware"
            const customRule = `
rule test_decode
{
  strings:
    $mal = "malware"
  condition:
    $mal
}`;
            yield patternMatcher.addRule(customRule);
            const result = yield patternMatcher.scan(data.buffer);
            const match = result.matches.find(m => m.rule_id === 'test_decode');
            (0, globals_1.expect)(match).toBeDefined();
            if (match) {
                const decodedData = (0, pattern_matcher_bridge_1.matchedDataToString)(match.matched_data_base64);
                (0, globals_1.expect)(decodedData).toBe('malware');
            }
        }));
    });
});
