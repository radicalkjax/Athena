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
const deobfuscator_bridge_1 = require("../../bridge/deobfuscator-bridge");
const types_1 = require("../../bridge/types");
(0, globals_1.describe)('Deobfuscator Integration Tests', () => {
    let deobfuscator;
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        deobfuscator = deobfuscator_bridge_1.DeobfuscatorBridge.getInstance();
        yield deobfuscator.initialize();
    }));
    (0, globals_1.afterAll)(() => {
        // Cleanup if needed
    });
    (0, globals_1.describe)('Basic Deobfuscation', () => {
        (0, globals_1.test)('should detect and decode Base64 obfuscation', () => __awaiter(void 0, void 0, void 0, function* () {
            const obfuscated = 'SGVsbG8gV29ybGQ='; // "Hello World"
            const detection = yield deobfuscator.detectObfuscation(obfuscated);
            (0, globals_1.expect)(detection.isObfuscated).toBe(true);
            (0, globals_1.expect)(detection.techniques).toContain(types_1.ObfuscationType.Base64);
            (0, globals_1.expect)(detection.confidence).toBeGreaterThan(0.8);
            const result = yield deobfuscator.deobfuscate(obfuscated);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.deobfuscated).toBe('Hello World');
            (0, globals_1.expect)(result.layers.length).toBe(1);
            (0, globals_1.expect)(result.layers[0].technique).toBe(types_1.ObfuscationType.Base64);
        }));
        (0, globals_1.test)('should detect and decode Hex obfuscation', () => __awaiter(void 0, void 0, void 0, function* () {
            const obfuscated = '\\x48\\x65\\x6c\\x6c\\x6f\\x20\\x57\\x6f\\x72\\x6c\\x64'; // "Hello World"
            const detection = yield deobfuscator.detectObfuscation(obfuscated);
            (0, globals_1.expect)(detection.isObfuscated).toBe(true);
            (0, globals_1.expect)(detection.techniques).toContain(types_1.ObfuscationType.Hex);
            const result = yield deobfuscator.deobfuscate(obfuscated);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.deobfuscated).toBe('Hello World');
        }));
        (0, globals_1.test)('should detect and decode Unicode obfuscation', () => __awaiter(void 0, void 0, void 0, function* () {
            const obfuscated = '\\u0048\\u0065\\u006c\\u006c\\u006f'; // "Hello"
            const detection = yield deobfuscator.detectObfuscation(obfuscated);
            (0, globals_1.expect)(detection.isObfuscated).toBe(true);
            (0, globals_1.expect)(detection.techniques).toContain(types_1.ObfuscationType.Unicode);
            const result = yield deobfuscator.deobfuscate(obfuscated);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.deobfuscated).toBe('Hello');
        }));
    });
    (0, globals_1.describe)('Multi-layer Deobfuscation', () => {
        (0, globals_1.test)('should handle nested Base64 encoding', () => __awaiter(void 0, void 0, void 0, function* () {
            // "Hello" -> Base64 -> Base64
            const obfuscated = 'U0dWc2JHOD0='; // Base64(Base64("Hello"))
            const result = yield deobfuscator.deobfuscate(obfuscated);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.deobfuscated).toBe('Hello');
            (0, globals_1.expect)(result.layers.length).toBe(2);
            (0, globals_1.expect)(result.layers.every(l => l.technique === types_1.ObfuscationType.Base64)).toBe(true);
        }));
        (0, globals_1.test)('should handle mixed obfuscation techniques', () => __awaiter(void 0, void 0, void 0, function* () {
            // Base64 encoded hex string
            const obfuscated = 'NWM2ODY1NmM2YzZm'; // Base64("\\x48\\x65\\x6c\\x6c\\x6f")
            const result = yield deobfuscator.deobfuscate(obfuscated);
            (0, globals_1.expect)(result.success).toBe(true);
            (0, globals_1.expect)(result.layers.length).toBeGreaterThanOrEqual(1);
        }));
    });
    (0, globals_1.describe)('Malware Pattern Detection', () => {
        (0, globals_1.test)('should detect JavaScript eval patterns', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousJs = 'eval(atob("YWxlcnQoMSk="))'; // eval(atob("alert(1)"))
            const detection = yield deobfuscator.detectObfuscation(maliciousJs);
            (0, globals_1.expect)(detection.isObfuscated).toBe(true);
            (0, globals_1.expect)(detection.techniques).toContain(types_1.ObfuscationType.JavaScript);
            const result = yield deobfuscator.deobfuscate(maliciousJs);
            (0, globals_1.expect)(result.warnings.length).toBeGreaterThan(0);
        }));
        (0, globals_1.test)('should detect PowerShell encoded commands', () => __awaiter(void 0, void 0, void 0, function* () {
            const psCommand = '-EncodedCommand U3RhcnQtUHJvY2Vzcw=='; // Start-Process
            const detection = yield deobfuscator.detectObfuscation(psCommand);
            (0, globals_1.expect)(detection.isObfuscated).toBe(true);
            (0, globals_1.expect)(detection.techniques).toContain(types_1.ObfuscationType.PowerShell);
        }));
    });
    (0, globals_1.describe)('IOC Extraction', () => {
        (0, globals_1.test)('should extract URLs from obfuscated content', () => __awaiter(void 0, void 0, void 0, function* () {
            const obfuscated = btoa('http://malicious.com/payload.exe');
            const result = yield deobfuscator.deobfuscate(obfuscated);
            (0, globals_1.expect)(result.success).toBe(true);
            const iocs = yield deobfuscator.extractIOCs(result.deobfuscated);
            (0, globals_1.expect)(iocs).toContain('http://malicious.com/payload.exe');
        }));
        (0, globals_1.test)('should extract IP addresses', () => __awaiter(void 0, void 0, void 0, function* () {
            const content = 'Connect to 192.168.1.100:8080 for C2';
            const iocs = yield deobfuscator.extractIOCs(content);
            (0, globals_1.expect)(iocs).toContain('192.168.1.100');
        }));
    });
    (0, globals_1.describe)('Entropy Analysis', () => {
        (0, globals_1.test)('should calculate entropy for suspicious content', () => __awaiter(void 0, void 0, void 0, function* () {
            const highEntropy = Buffer.from(crypto.getRandomValues(new Uint8Array(100))).toString('base64');
            const lowEntropy = 'AAAAAAAAAAAAAAAAAAAAAAAA';
            const highResult = yield deobfuscator.analyzeEntropy(highEntropy);
            const lowResult = yield deobfuscator.analyzeEntropy(lowEntropy);
            (0, globals_1.expect)(highResult.globalEntropy).toBeGreaterThan(lowResult.globalEntropy);
            (0, globals_1.expect)(highResult.anomalies.length).toBeGreaterThan(0);
        }));
    });
    (0, globals_1.describe)('Configuration Management', () => {
        (0, globals_1.test)('should update and retrieve configuration', () => __awaiter(void 0, void 0, void 0, function* () {
            const newConfig = {
                maxLayers: 5,
                timeoutMs: 10000,
                enableMlPredictions: false
            };
            yield deobfuscator.updateConfig(newConfig);
            const config = yield deobfuscator.getConfig();
            (0, globals_1.expect)(config.maxLayers).toBe(5);
            (0, globals_1.expect)(config.timeoutMs).toBe(10000);
            (0, globals_1.expect)(config.enableMlPredictions).toBe(false);
            // Reset to defaults
            yield deobfuscator.updateConfig({
                maxLayers: 10,
                timeoutMs: 30000,
                enableMlPredictions: true
            });
        }));
    });
    (0, globals_1.describe)('Streaming Support', () => {
        (0, globals_1.test)('should handle large content with streaming', () => __awaiter(void 0, void 0, void 0, function* () {
            const largeContent = 'A'.repeat(2 * 1024 * 1024); // 2MB
            const base64Large = btoa(largeContent.slice(0, 1000)); // Encode portion for test
            const streaming = deobfuscator.createStreamingDeobfuscator();
            const chunks = [];
            streaming.on('data', (chunk) => chunks.push(chunk));
            let completed = false;
            streaming.on('complete', () => { completed = true; });
            yield streaming.processChunk(base64Large);
            yield streaming.finish();
            (0, globals_1.expect)(completed).toBe(true);
            (0, globals_1.expect)(chunks.length).toBeGreaterThan(0);
        }));
    });
    (0, globals_1.describe)('Error Handling', () => {
        (0, globals_1.test)('should handle invalid input gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            const invalid = '\xFF\xFE\xFD'; // Invalid UTF-8
            const result = yield deobfuscator.deobfuscate(invalid);
            (0, globals_1.expect)(result.success).toBe(false);
            (0, globals_1.expect)(result.error).toBeDefined();
        }));
        (0, globals_1.test)('should handle timeout for complex operations', () => __awaiter(void 0, void 0, void 0, function* () {
            yield deobfuscator.updateConfig({ timeoutMs: 100 }); // Very short timeout
            // Create deeply nested obfuscation that will timeout
            let nested = 'test';
            for (let i = 0; i < 20; i++) {
                nested = btoa(nested);
            }
            const result = yield deobfuscator.deobfuscate(nested);
            (0, globals_1.expect)(result.warnings.some(w => w.includes('timeout') || w.includes('layer'))).toBe(true);
            // Reset timeout
            yield deobfuscator.updateConfig({ timeoutMs: 30000 });
        }));
    });
});
