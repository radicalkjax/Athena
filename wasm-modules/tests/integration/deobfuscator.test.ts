import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { DeobfuscatorBridge } from '../../bridge/deobfuscator-bridge';
import { ObfuscationType } from '../../bridge/types';

describe('Deobfuscator Integration Tests', () => {
  let deobfuscator: DeobfuscatorBridge;

  beforeAll(async () => {
    deobfuscator = DeobfuscatorBridge.getInstance();
    await deobfuscator.initialize();
  });

  afterAll(() => {
    // Cleanup if needed
  });

  describe('Basic Deobfuscation', () => {
    test('should detect and decode Base64 obfuscation', async () => {
      const obfuscated = 'SGVsbG8gV29ybGQ='; // "Hello World"
      
      const detection = await deobfuscator.detectObfuscation(obfuscated);
      expect(detection.isObfuscated).toBe(true);
      expect(detection.techniques).toContain(ObfuscationType.Base64);
      expect(detection.confidence).toBeGreaterThan(0.8);

      const result = await deobfuscator.deobfuscate(obfuscated);
      expect(result.success).toBe(true);
      expect(result.deobfuscated).toBe('Hello World');
      expect(result.layers.length).toBe(1);
      expect(result.layers[0].technique).toBe(ObfuscationType.Base64);
    });

    test('should detect and decode Hex obfuscation', async () => {
      const obfuscated = '\\x48\\x65\\x6c\\x6c\\x6f\\x20\\x57\\x6f\\x72\\x6c\\x64'; // "Hello World"
      
      const detection = await deobfuscator.detectObfuscation(obfuscated);
      expect(detection.isObfuscated).toBe(true);
      expect(detection.techniques).toContain(ObfuscationType.Hex);

      const result = await deobfuscator.deobfuscate(obfuscated);
      expect(result.success).toBe(true);
      expect(result.deobfuscated).toBe('Hello World');
    });

    test('should detect and decode Unicode obfuscation', async () => {
      const obfuscated = '\\u0048\\u0065\\u006c\\u006c\\u006f'; // "Hello"
      
      const detection = await deobfuscator.detectObfuscation(obfuscated);
      expect(detection.isObfuscated).toBe(true);
      expect(detection.techniques).toContain(ObfuscationType.Unicode);

      const result = await deobfuscator.deobfuscate(obfuscated);
      expect(result.success).toBe(true);
      expect(result.deobfuscated).toBe('Hello');
    });
  });

  describe('Multi-layer Deobfuscation', () => {
    test('should handle nested Base64 encoding', async () => {
      // "Hello" -> Base64 -> Base64
      const obfuscated = 'U0dWc2JHOD0='; // Base64(Base64("Hello"))
      
      const result = await deobfuscator.deobfuscate(obfuscated);
      expect(result.success).toBe(true);
      expect(result.deobfuscated).toBe('Hello');
      expect(result.layers.length).toBe(2);
      expect(result.layers.every(l => l.technique === ObfuscationType.Base64)).toBe(true);
    });

    test('should handle mixed obfuscation techniques', async () => {
      // Base64 encoded hex string
      const obfuscated = 'NWM2ODY1NmM2YzZm'; // Base64("\\x48\\x65\\x6c\\x6c\\x6f")
      
      const result = await deobfuscator.deobfuscate(obfuscated);
      expect(result.success).toBe(true);
      expect(result.layers.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Malware Pattern Detection', () => {
    test('should detect JavaScript eval patterns', async () => {
      const maliciousJs = 'eval(atob("YWxlcnQoMSk="))'; // eval(atob("alert(1)"))
      
      const detection = await deobfuscator.detectObfuscation(maliciousJs);
      expect(detection.isObfuscated).toBe(true);
      expect(detection.techniques).toContain(ObfuscationType.JavaScript);

      const result = await deobfuscator.deobfuscate(maliciousJs);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should detect PowerShell encoded commands', async () => {
      const psCommand = '-EncodedCommand U3RhcnQtUHJvY2Vzcw=='; // Start-Process
      
      const detection = await deobfuscator.detectObfuscation(psCommand);
      expect(detection.isObfuscated).toBe(true);
      expect(detection.techniques).toContain(ObfuscationType.PowerShell);
    });
  });

  describe('IOC Extraction', () => {
    test('should extract URLs from obfuscated content', async () => {
      const obfuscated = btoa('http://malicious.com/payload.exe');
      
      const result = await deobfuscator.deobfuscate(obfuscated);
      expect(result.success).toBe(true);
      
      const iocs = await deobfuscator.extractIOCs(result.deobfuscated);
      expect(iocs).toContain('http://malicious.com/payload.exe');
    });

    test('should extract IP addresses', async () => {
      const content = 'Connect to 192.168.1.100:8080 for C2';
      
      const iocs = await deobfuscator.extractIOCs(content);
      expect(iocs).toContain('192.168.1.100');
    });
  });

  describe('Entropy Analysis', () => {
    test('should calculate entropy for suspicious content', async () => {
      const highEntropy = Buffer.from(crypto.getRandomValues(new Uint8Array(100))).toString('base64');
      const lowEntropy = 'AAAAAAAAAAAAAAAAAAAAAAAA';
      
      const highResult = await deobfuscator.analyzeEntropy(highEntropy);
      const lowResult = await deobfuscator.analyzeEntropy(lowEntropy);
      
      expect(highResult.globalEntropy).toBeGreaterThan(lowResult.globalEntropy);
      expect(highResult.anomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration Management', () => {
    test('should update and retrieve configuration', async () => {
      const newConfig = {
        maxLayers: 5,
        timeoutMs: 10000,
        enableMlPredictions: false
      };
      
      await deobfuscator.updateConfig(newConfig);
      const config = await deobfuscator.getConfig();
      
      expect(config.maxLayers).toBe(5);
      expect(config.timeoutMs).toBe(10000);
      expect(config.enableMlPredictions).toBe(false);
      
      // Reset to defaults
      await deobfuscator.updateConfig({
        maxLayers: 10,
        timeoutMs: 30000,
        enableMlPredictions: true
      });
    });
  });

  describe('Streaming Support', () => {
    test('should handle large content with streaming', async () => {
      const largeContent = 'A'.repeat(2 * 1024 * 1024); // 2MB
      const base64Large = btoa(largeContent.slice(0, 1000)); // Encode portion for test
      
      const streaming = deobfuscator.createStreamingDeobfuscator();
      
      const chunks: string[] = [];
      streaming.on('data', (chunk) => chunks.push(chunk));
      
      let completed = false;
      streaming.on('complete', () => { completed = true; });
      
      await streaming.processChunk(base64Large);
      await streaming.finish();
      
      expect(completed).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid input gracefully', async () => {
      const invalid = '\xFF\xFE\xFD'; // Invalid UTF-8
      
      const result = await deobfuscator.deobfuscate(invalid);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle timeout for complex operations', async () => {
      await deobfuscator.updateConfig({ timeoutMs: 100 }); // Very short timeout
      
      // Create deeply nested obfuscation that will timeout
      let nested = 'test';
      for (let i = 0; i < 20; i++) {
        nested = btoa(nested);
      }
      
      const result = await deobfuscator.deobfuscate(nested);
      expect(result.warnings.some(w => w.includes('timeout') || w.includes('layer'))).toBe(true);
      
      // Reset timeout
      await deobfuscator.updateConfig({ timeoutMs: 30000 });
    });
  });
});