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
const network_bridge_js_1 = require("../../bridge/network-bridge.js");
(0, vitest_1.describe)('Network Analysis Module', () => {
    let networkBridge;
    (0, vitest_1.beforeAll)(() => __awaiter(void 0, void 0, void 0, function* () {
        networkBridge = network_bridge_js_1.NetworkBridge.getInstance();
        yield networkBridge.initialize();
    }));
    (0, vitest_1.describe)('Packet Analysis', () => {
        (0, vitest_1.it)('should analyze IPv4 TCP packet', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            // Ethernet + IPv4 + TCP packet (HTTP GET request)
            const packet = new Uint8Array([
                // Ethernet header (14 bytes)
                0x00, 0x11, 0x22, 0x33, 0x44, 0x55, // Destination MAC
                0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, // Source MAC
                0x08, 0x00, // EtherType: IPv4
                // IPv4 header (20 bytes)
                0x45, 0x00, 0x00, 0x3c, // Version, IHL, Type of Service, Total Length
                0x1c, 0x46, 0x40, 0x00, // Identification, Flags, Fragment Offset
                0x40, 0x06, 0xb1, 0xe6, // TTL, Protocol (TCP), Checksum
                0xac, 0x10, 0x0a, 0x63, // Source IP: 172.16.10.99
                0xac, 0x10, 0x0a, 0x0c, // Destination IP: 172.16.10.12
                // TCP header (20 bytes)
                0x00, 0x50, // Source port: 80
                0x1f, 0x90, // Destination port: 8080
                0x00, 0x00, 0x00, 0x00, // Sequence number
                0x00, 0x00, 0x00, 0x00, // Acknowledgment number
                0x50, 0x02, // Data offset, Flags (SYN)
                0x71, 0x10, // Window size
                0xe6, 0x32, // Checksum
                0x00, 0x00, // Urgent pointer
                // HTTP payload
                0x47, 0x45, 0x54, 0x20, 0x2f, 0x20, 0x48, 0x54, 0x54, 0x50, 0x2f, 0x31, 0x2e, 0x31
            ]);
            const result = yield networkBridge.analyzePacket(packet);
            (0, vitest_1.expect)(result.ethernetInfo).toBeDefined();
            (0, vitest_1.expect)((_a = result.ethernetInfo) === null || _a === void 0 ? void 0 : _a.sourceMAC).toBe('aa:bb:cc:dd:ee:ff');
            (0, vitest_1.expect)((_b = result.ethernetInfo) === null || _b === void 0 ? void 0 : _b.destMAC).toBe('00:11:22:33:44:55');
            (0, vitest_1.expect)(result.ipInfo).toBeDefined();
            (0, vitest_1.expect)((_c = result.ipInfo) === null || _c === void 0 ? void 0 : _c.version).toBe(4);
            (0, vitest_1.expect)((_d = result.ipInfo) === null || _d === void 0 ? void 0 : _d.sourceIP).toBe('172.16.10.99');
            (0, vitest_1.expect)((_e = result.ipInfo) === null || _e === void 0 ? void 0 : _e.destIP).toBe('172.16.10.12');
            (0, vitest_1.expect)((_f = result.ipInfo) === null || _f === void 0 ? void 0 : _f.protocol).toBe(6); // TCP
            (0, vitest_1.expect)(result.transportInfo).toBeDefined();
            (0, vitest_1.expect)((_g = result.transportInfo) === null || _g === void 0 ? void 0 : _g.sourcePort).toBe(80);
            (0, vitest_1.expect)((_h = result.transportInfo) === null || _h === void 0 ? void 0 : _h.destPort).toBe(8080);
            (0, vitest_1.expect)((_j = result.transportInfo) === null || _j === void 0 ? void 0 : _j.tcpFlags).toContain('SYN');
        }));
        (0, vitest_1.it)('should detect packet anomalies', () => __awaiter(void 0, void 0, void 0, function* () {
            // Malformed packet with invalid length
            const malformedPacket = new Uint8Array([
                // Ethernet header
                0x00, 0x11, 0x22, 0x33, 0x44, 0x55,
                0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff,
                0x08, 0x00,
                // Truncated IPv4 header
                0x45, 0x00, 0x00, 0xff, // Invalid total length
                0x00, 0x00
            ]);
            const result = yield networkBridge.analyzePacket(malformedPacket);
            (0, vitest_1.expect)(result.anomalies).toHaveLength(1);
            (0, vitest_1.expect)(result.anomalies[0]).toContain('malformed');
        }));
    });
    (0, vitest_1.describe)('Protocol Detection', () => {
        (0, vitest_1.it)('should detect HTTP protocol', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const httpData = new TextEncoder().encode('GET /api/data HTTP/1.1\r\nHost: example.com\r\n\r\n');
            const result = yield networkBridge.detectProtocol(httpData);
            (0, vitest_1.expect)(result.protocol).toBe('HTTP');
            (0, vitest_1.expect)(result.isRequest).toBe(true);
            (0, vitest_1.expect)(result.method).toBe('GET');
            (0, vitest_1.expect)(result.path).toBe('/api/data');
            (0, vitest_1.expect)((_a = result.headers) === null || _a === void 0 ? void 0 : _a['host']).toBe('example.com');
        }));
        (0, vitest_1.it)('should detect DNS queries', () => __awaiter(void 0, void 0, void 0, function* () {
            // DNS query for example.com
            const dnsQuery = new Uint8Array([
                0x12, 0x34, // Transaction ID
                0x01, 0x00, // Flags: Standard query
                0x00, 0x01, // Questions: 1
                0x00, 0x00, // Answers: 0
                0x00, 0x00, // Authority RRs: 0
                0x00, 0x00, // Additional RRs: 0
                // Query: example.com
                0x07, 0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, // "example"
                0x03, 0x63, 0x6f, 0x6d, // "com"
                0x00, // End of domain
                0x00, 0x01, // Type: A
                0x00, 0x01 // Class: IN
            ]);
            const result = yield networkBridge.detectProtocol(dnsQuery);
            (0, vitest_1.expect)(result.protocol).toBe('DNS');
            (0, vitest_1.expect)(result.isQuery).toBe(true);
            (0, vitest_1.expect)(result.domain).toBe('example.com');
        }));
        (0, vitest_1.it)('should detect TLS handshake', () => __awaiter(void 0, void 0, void 0, function* () {
            // TLS ClientHello with SNI
            const tlsHandshake = new Uint8Array([
                0x16, // Content Type: Handshake
                0x03, 0x01, // Version: TLS 1.0
                0x00, 0x50, // Length
                0x01, // Handshake Type: ClientHello
                0x00, 0x00, 0x4c, // Handshake Length
                0x03, 0x03, // Client Version: TLS 1.2
                // Random bytes (32)
                ...new Array(32).fill(0xaa),
                0x00, // Session ID Length
                0x00, 0x04, // Cipher Suites Length
                0x00, 0x2f, 0x00, 0x35, // Cipher Suites
                0x01, 0x00, // Compression Methods
                0x00, 0x1f, // Extensions Length
                // SNI Extension
                0x00, 0x00, // Extension Type: SNI
                0x00, 0x1b, // Extension Length
                0x00, 0x19, // Server Name List Length
                0x00, // Server Name Type: hostname
                0x00, 0x16, // Server Name Length
                // "secure.example.com"
                0x73, 0x65, 0x63, 0x75, 0x72, 0x65, 0x2e,
                0x65, 0x78, 0x61, 0x6d, 0x70, 0x6c, 0x65, 0x2e,
                0x63, 0x6f, 0x6d
            ]);
            const result = yield networkBridge.detectProtocol(tlsHandshake);
            (0, vitest_1.expect)(result.protocol).toBe('TLS');
            (0, vitest_1.expect)(result.version).toBe('1.2');
            (0, vitest_1.expect)(result.handshakeType).toBe('ClientHello');
            (0, vitest_1.expect)(result.sni).toBe('secure.example.com');
        }));
        (0, vitest_1.it)('should detect suspicious patterns', () => __awaiter(void 0, void 0, void 0, function* () {
            // Suspicious domain that looks like DGA
            const suspiciousDomain = 'xkjhgfdsapoiuytrewq.com';
            const isSuspicious = yield networkBridge.isSuspiciousDomain(suspiciousDomain);
            (0, vitest_1.expect)(isSuspicious).toBe(true);
            // Normal domain
            const normalDomain = 'google.com';
            const isNormal = yield networkBridge.isSuspiciousDomain(normalDomain);
            (0, vitest_1.expect)(isNormal).toBe(false);
        }));
    });
    (0, vitest_1.describe)('Traffic Pattern Analysis', () => {
        (0, vitest_1.it)('should detect beaconing behavior', () => __awaiter(void 0, void 0, void 0, function* () {
            const flows = [];
            const baseTime = Date.now();
            // Generate beaconing traffic (regular intervals)
            for (let i = 0; i < 10; i++) {
                flows.push({
                    sourceIP: '192.168.1.100',
                    destIP: '203.0.113.1',
                    sourcePort: 45000 + i,
                    destPort: 443,
                    protocol: 6,
                    timestamp: baseTime + (i * 60000), // Every 60 seconds
                    bytesSent: 1024 + Math.floor(Math.random() * 100),
                    bytesReceived: 512 + Math.floor(Math.random() * 50),
                    duration: 1000
                });
            }
            const pattern = yield networkBridge.analyzeTrafficPattern(flows);
            (0, vitest_1.expect)(pattern.isBeaconing).toBe(true);
            (0, vitest_1.expect)(pattern.confidence).toBeGreaterThan(0.8);
        }));
        (0, vitest_1.it)('should detect port scanning', () => __awaiter(void 0, void 0, void 0, function* () {
            const flows = [];
            const baseTime = Date.now();
            // Vertical port scan
            for (let port = 1; port <= 100; port++) {
                flows.push({
                    sourceIP: '192.168.1.50',
                    destIP: '192.168.1.100',
                    sourcePort: 54321,
                    destPort: port,
                    protocol: 6,
                    timestamp: baseTime + (port * 100),
                    bytesSent: 44,
                    bytesReceived: 0,
                    duration: 10
                });
            }
            const pattern = yield networkBridge.analyzeTrafficPattern(flows);
            (0, vitest_1.expect)(pattern.scanType).toBe('vertical');
            (0, vitest_1.expect)(pattern.portsScanned).toBe(100);
        }));
        (0, vitest_1.it)('should detect data exfiltration patterns', () => __awaiter(void 0, void 0, void 0, function* () {
            const flows = [];
            const baseTime = Date.now();
            // Large outbound data transfer
            flows.push({
                sourceIP: '192.168.1.100',
                destIP: '203.0.113.50',
                sourcePort: 54321,
                destPort: 443,
                protocol: 6,
                timestamp: baseTime,
                bytesSent: 100 * 1024 * 1024, // 100MB
                bytesReceived: 1024,
                duration: 60000
            });
            const pattern = yield networkBridge.analyzeTrafficPattern(flows);
            (0, vitest_1.expect)(pattern.possibleExfiltration).toBe(true);
            (0, vitest_1.expect)(pattern.dataVolumeRatio).toBeGreaterThan(100);
        }));
    });
    (0, vitest_1.describe)('Anomaly Detection', () => {
        (0, vitest_1.it)('should detect packet flood', () => __awaiter(void 0, void 0, void 0, function* () {
            const capture = {
                packets: [],
                startTime: Date.now(),
                endTime: Date.now() + 1000,
                totalPackets: 10000,
                totalBytes: 1000000
            };
            // Generate flood traffic
            for (let i = 0; i < 100; i++) {
                capture.packets.push({
                    timestamp: capture.startTime + i,
                    length: 64,
                    sourceIP: '192.168.1.100',
                    destIP: '192.168.1.1',
                    protocol: 1, // ICMP
                    data: new Uint8Array(64)
                });
            }
            const anomalies = yield networkBridge.detectAnomalies(capture);
            (0, vitest_1.expect)(anomalies).toContainEqual(vitest_1.expect.objectContaining({
                type: 'packet_flood',
                severity: 'high'
            }));
        }));
        (0, vitest_1.it)('should detect protocol anomalies', () => __awaiter(void 0, void 0, void 0, function* () {
            // HTTP traffic on non-standard port
            const anomalousFlow = {
                sourceIP: '192.168.1.100',
                destIP: '192.168.1.200',
                sourcePort: 12345,
                destPort: 8888, // Non-standard for HTTP
                protocol: 6,
                timestamp: Date.now(),
                bytesSent: 1024,
                bytesReceived: 2048,
                duration: 100,
                payload: new TextEncoder().encode('GET / HTTP/1.1\r\n')
            };
            const anomalies = yield networkBridge.detectAnomalies({
                packets: [{
                        timestamp: anomalousFlow.timestamp,
                        length: 100,
                        sourceIP: anomalousFlow.sourceIP,
                        destIP: anomalousFlow.destIP,
                        protocol: anomalousFlow.protocol,
                        data: anomalousFlow.payload
                    }],
                startTime: anomalousFlow.timestamp,
                endTime: anomalousFlow.timestamp + 1000,
                totalPackets: 1,
                totalBytes: 100
            });
            (0, vitest_1.expect)(anomalies).toContainEqual(vitest_1.expect.objectContaining({
                type: 'protocol_anomaly',
                description: vitest_1.expect.stringContaining('non-standard port')
            }));
        }));
        (0, vitest_1.it)('should calculate risk scores', () => __awaiter(void 0, void 0, void 0, function* () {
            const capture = {
                packets: [],
                startTime: Date.now(),
                endTime: Date.now() + 60000,
                totalPackets: 1000,
                totalBytes: 50 * 1024 * 1024, // 50MB
                metadata: {
                    suspiciousConnections: 5,
                    malformedPackets: 10,
                    encryptedRatio: 0.95
                }
            };
            const riskScore = yield networkBridge.calculateRiskScore(capture);
            (0, vitest_1.expect)(riskScore).toBeGreaterThan(0);
            (0, vitest_1.expect)(riskScore).toBeLessThanOrEqual(100);
        }));
    });
    (0, vitest_1.describe)('Integration with Analysis Service', () => {
        (0, vitest_1.it)('should analyze network capture end-to-end', () => __awaiter(void 0, void 0, void 0, function* () {
            // Simulate a mixed traffic capture
            const packets = [
                // HTTP request
                createHTTPPacket('GET', '/api/data', '192.168.1.100', '93.184.216.34'),
                // DNS query
                createDNSPacket('suspicious-domain-xyzabc123.com', '192.168.1.100', '8.8.8.8'),
                // TLS handshake
                createTLSPacket('secure.bank.com', '192.168.1.100', '203.0.113.1'),
                // Potential C2 beacon
                createBeaconPacket('192.168.1.100', '185.220.101.1')
            ];
            const capture = {
                packets: packets.map((data, i) => ({
                    timestamp: Date.now() + (i * 1000),
                    length: data.length,
                    sourceIP: '192.168.1.100',
                    destIP: '93.184.216.34',
                    protocol: 6,
                    data
                })),
                startTime: Date.now(),
                endTime: Date.now() + 5000,
                totalPackets: packets.length,
                totalBytes: packets.reduce((sum, p) => sum + p.length, 0)
            };
            const analysis = yield networkBridge.analyzeNetworkCapture(capture);
            (0, vitest_1.expect)(analysis.summary).toBeDefined();
            (0, vitest_1.expect)(analysis.protocols).toContain('HTTP');
            (0, vitest_1.expect)(analysis.protocols).toContain('DNS');
            (0, vitest_1.expect)(analysis.protocols).toContain('TLS');
            (0, vitest_1.expect)(analysis.suspiciousActivities).toBeGreaterThan(0);
            (0, vitest_1.expect)(analysis.riskScore).toBeGreaterThan(0);
        }));
    });
});
// Helper functions to create test packets
function createHTTPPacket(method, path, srcIP, dstIP) {
    const httpData = `${method} ${path} HTTP/1.1\r\nHost: example.com\r\n\r\n`;
    return createTCPPacket(srcIP, dstIP, 54321, 80, new TextEncoder().encode(httpData));
}
function createDNSPacket(domain, srcIP, dstIP) {
    const labels = domain.split('.');
    const query = [
        0x12, 0x34, // Transaction ID
        0x01, 0x00, // Flags
        0x00, 0x01, // Questions
        0x00, 0x00, // Answers
        0x00, 0x00, // Authority
        0x00, 0x00, // Additional
    ];
    // Add domain labels
    for (const label of labels) {
        query.push(label.length);
        query.push(...Array.from(new TextEncoder().encode(label)));
    }
    query.push(0x00); // End of domain
    query.push(0x00, 0x01); // Type A
    query.push(0x00, 0x01); // Class IN
    return createUDPPacket(srcIP, dstIP, 54321, 53, new Uint8Array(query));
}
function createTLSPacket(sni, srcIP, dstIP) {
    const sniBytes = new TextEncoder().encode(sni);
    const handshake = [
        0x16, // Content Type: Handshake
        0x03, 0x01, // Version
        0x00, 0x00, // Length (will update)
        0x01, // ClientHello
        0x00, 0x00, 0x00, // Handshake length (will update)
        0x03, 0x03, // Client version
        ...new Array(32).fill(0xaa), // Random
        0x00, // Session ID length
        0x00, 0x02, // Cipher suites length
        0x00, 0x2f, // Cipher suite
        0x01, 0x00, // Compression
        0x00, 0x00, // Extensions length (will update)
        // SNI extension
        0x00, 0x00, // Type: SNI
        0x00, 0x00, // Length (will update)
        0x00, 0x00, // List length (will update)
        0x00, // Type: hostname
        0x00, 0x00, // Name length (will update)
        ...Array.from(sniBytes)
    ];
    // Update lengths
    const sniExtLen = sniBytes.length + 5;
    const extLen = sniExtLen + 4;
    const hsLen = handshake.length - 9;
    const totalLen = handshake.length - 5;
    handshake[3] = (totalLen >> 8) & 0xff;
    handshake[4] = totalLen & 0xff;
    handshake[6] = (hsLen >> 16) & 0xff;
    handshake[7] = (hsLen >> 8) & 0xff;
    handshake[8] = hsLen & 0xff;
    return createTCPPacket(srcIP, dstIP, 54321, 443, new Uint8Array(handshake));
}
function createBeaconPacket(srcIP, dstIP) {
    // Small encrypted payload typical of C2 beacon
    const payload = new Uint8Array(64);
    crypto.getRandomValues(payload);
    return createTCPPacket(srcIP, dstIP, 54321, 443, payload);
}
function createTCPPacket(srcIP, dstIP, srcPort, dstPort, payload) {
    const packet = new Uint8Array(14 + 20 + 20 + payload.length);
    let offset = 0;
    // Ethernet header
    packet.set([0x00, 0x11, 0x22, 0x33, 0x44, 0x55], offset); // Dst MAC
    offset += 6;
    packet.set([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff], offset); // Src MAC
    offset += 6;
    packet.set([0x08, 0x00], offset); // IPv4
    offset += 2;
    // IPv4 header
    packet[offset] = 0x45; // Version + IHL
    packet[offset + 1] = 0x00; // TOS
    const ipLen = 20 + 20 + payload.length;
    packet[offset + 2] = (ipLen >> 8) & 0xff;
    packet[offset + 3] = ipLen & 0xff;
    packet[offset + 8] = 0x40; // TTL
    packet[offset + 9] = 0x06; // TCP
    // Source IP
    const srcIPBytes = srcIP.split('.').map(n => parseInt(n));
    packet.set(srcIPBytes, offset + 12);
    // Dest IP
    const dstIPBytes = dstIP.split('.').map(n => parseInt(n));
    packet.set(dstIPBytes, offset + 16);
    offset += 20;
    // TCP header
    packet[offset] = (srcPort >> 8) & 0xff;
    packet[offset + 1] = srcPort & 0xff;
    packet[offset + 2] = (dstPort >> 8) & 0xff;
    packet[offset + 3] = dstPort & 0xff;
    packet[offset + 12] = 0x50; // Header length
    packet[offset + 13] = 0x18; // PSH + ACK flags
    offset += 20;
    // Payload
    packet.set(payload, offset);
    return packet;
}
function createUDPPacket(srcIP, dstIP, srcPort, dstPort, payload) {
    const packet = new Uint8Array(14 + 20 + 8 + payload.length);
    let offset = 0;
    // Ethernet header
    packet.set([0x00, 0x11, 0x22, 0x33, 0x44, 0x55], offset);
    offset += 6;
    packet.set([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff], offset);
    offset += 6;
    packet.set([0x08, 0x00], offset);
    offset += 2;
    // IPv4 header
    packet[offset] = 0x45;
    packet[offset + 1] = 0x00;
    const ipLen = 20 + 8 + payload.length;
    packet[offset + 2] = (ipLen >> 8) & 0xff;
    packet[offset + 3] = ipLen & 0xff;
    packet[offset + 8] = 0x40;
    packet[offset + 9] = 0x11; // UDP
    const srcIPBytes = srcIP.split('.').map(n => parseInt(n));
    packet.set(srcIPBytes, offset + 12);
    const dstIPBytes = dstIP.split('.').map(n => parseInt(n));
    packet.set(dstIPBytes, offset + 16);
    offset += 20;
    // UDP header
    packet[offset] = (srcPort >> 8) & 0xff;
    packet[offset + 1] = srcPort & 0xff;
    packet[offset + 2] = (dstPort >> 8) & 0xff;
    packet[offset + 3] = dstPort & 0xff;
    const udpLen = 8 + payload.length;
    packet[offset + 4] = (udpLen >> 8) & 0xff;
    packet[offset + 5] = udpLen & 0xff;
    offset += 8;
    // Payload
    packet.set(payload, offset);
    return packet;
}
