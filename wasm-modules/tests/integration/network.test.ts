import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkBridge } from '../../bridge/network-bridge.js';
import type { 
  PacketAnalysisResult, 
  ProtocolInfo, 
  TrafficPattern, 
  NetworkAnomaly,
  NetworkCapture 
} from '../../bridge/network-bridge.js';

describe('Network Analysis Module', () => {
  let networkBridge: NetworkBridge;

  beforeAll(async () => {
    networkBridge = NetworkBridge.getInstance();
    await networkBridge.initialize();
  });

  describe('Packet Analysis', () => {
    it('should analyze IPv4 TCP packet', async () => {
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

      const result = await networkBridge.analyzePacket(packet);
      
      expect(result.ethernetInfo).toBeDefined();
      expect(result.ethernetInfo?.sourceMAC).toBe('aa:bb:cc:dd:ee:ff');
      expect(result.ethernetInfo?.destMAC).toBe('00:11:22:33:44:55');
      
      expect(result.ipInfo).toBeDefined();
      expect(result.ipInfo?.version).toBe(4);
      expect(result.ipInfo?.sourceIP).toBe('172.16.10.99');
      expect(result.ipInfo?.destIP).toBe('172.16.10.12');
      expect(result.ipInfo?.protocol).toBe(6); // TCP
      
      expect(result.transportInfo).toBeDefined();
      expect(result.transportInfo?.sourcePort).toBe(80);
      expect(result.transportInfo?.destPort).toBe(8080);
      expect(result.transportInfo?.tcpFlags).toContain('SYN');
    });

    it('should detect packet anomalies', async () => {
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

      const result = await networkBridge.analyzePacket(malformedPacket);
      expect(result.anomalies).toHaveLength(1);
      expect(result.anomalies[0]).toContain('malformed');
    });
  });

  describe('Protocol Detection', () => {
    it('should detect HTTP protocol', async () => {
      const httpData = new TextEncoder().encode('GET /api/data HTTP/1.1\r\nHost: example.com\r\n\r\n');
      const result = await networkBridge.detectProtocol(httpData);
      
      expect(result.protocol).toBe('HTTP');
      expect(result.isRequest).toBe(true);
      expect(result.method).toBe('GET');
      expect(result.path).toBe('/api/data');
      expect(result.headers?.['host']).toBe('example.com');
    });

    it('should detect DNS queries', async () => {
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
        0x00, 0x01  // Class: IN
      ]);

      const result = await networkBridge.detectProtocol(dnsQuery);
      expect(result.protocol).toBe('DNS');
      expect(result.isQuery).toBe(true);
      expect(result.domain).toBe('example.com');
    });

    it('should detect TLS handshake', async () => {
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

      const result = await networkBridge.detectProtocol(tlsHandshake);
      expect(result.protocol).toBe('TLS');
      expect(result.version).toBe('1.2');
      expect(result.handshakeType).toBe('ClientHello');
      expect(result.sni).toBe('secure.example.com');
    });

    it('should detect suspicious patterns', async () => {
      // Suspicious domain that looks like DGA
      const suspiciousDomain = 'xkjhgfdsapoiuytrewq.com';
      const isSuspicious = await networkBridge.isSuspiciousDomain(suspiciousDomain);
      expect(isSuspicious).toBe(true);

      // Normal domain
      const normalDomain = 'google.com';
      const isNormal = await networkBridge.isSuspiciousDomain(normalDomain);
      expect(isNormal).toBe(false);
    });
  });

  describe('Traffic Pattern Analysis', () => {
    it('should detect beaconing behavior', async () => {
      const flows: TrafficPattern[] = [];
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

      const pattern = await networkBridge.analyzeTrafficPattern(flows);
      expect(pattern.isBeaconing).toBe(true);
      expect(pattern.confidence).toBeGreaterThan(0.8);
    });

    it('should detect port scanning', async () => {
      const flows: TrafficPattern[] = [];
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

      const pattern = await networkBridge.analyzeTrafficPattern(flows);
      expect(pattern.scanType).toBe('vertical');
      expect(pattern.portsScanned).toBe(100);
    });

    it('should detect data exfiltration patterns', async () => {
      const flows: TrafficPattern[] = [];
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

      const pattern = await networkBridge.analyzeTrafficPattern(flows);
      expect(pattern.possibleExfiltration).toBe(true);
      expect(pattern.dataVolumeRatio).toBeGreaterThan(100);
    });
  });

  describe('Anomaly Detection', () => {
    it('should detect packet flood', async () => {
      const capture: NetworkCapture = {
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

      const anomalies = await networkBridge.detectAnomalies(capture);
      expect(anomalies).toContainEqual(expect.objectContaining({
        type: 'packet_flood',
        severity: 'high'
      }));
    });

    it('should detect protocol anomalies', async () => {
      // HTTP traffic on non-standard port
      const anomalousFlow: TrafficPattern = {
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

      const anomalies = await networkBridge.detectAnomalies({
        packets: [{
          timestamp: anomalousFlow.timestamp,
          length: 100,
          sourceIP: anomalousFlow.sourceIP,
          destIP: anomalousFlow.destIP,
          protocol: anomalousFlow.protocol,
          data: anomalousFlow.payload!
        }],
        startTime: anomalousFlow.timestamp,
        endTime: anomalousFlow.timestamp + 1000,
        totalPackets: 1,
        totalBytes: 100
      });

      expect(anomalies).toContainEqual(expect.objectContaining({
        type: 'protocol_anomaly',
        description: expect.stringContaining('non-standard port')
      }));
    });

    it('should calculate risk scores', async () => {
      const capture: NetworkCapture = {
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

      const riskScore = await networkBridge.calculateRiskScore(capture);
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Integration with Analysis Service', () => {
    it('should analyze network capture end-to-end', async () => {
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

      const capture: NetworkCapture = {
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

      const analysis = await networkBridge.analyzeNetworkCapture(capture);
      
      expect(analysis.summary).toBeDefined();
      expect(analysis.protocols).toContain('HTTP');
      expect(analysis.protocols).toContain('DNS');
      expect(analysis.protocols).toContain('TLS');
      expect(analysis.suspiciousActivities).toBeGreaterThan(0);
      expect(analysis.riskScore).toBeGreaterThan(0);
    });
  });
});

// Helper functions to create test packets
function createHTTPPacket(method: string, path: string, srcIP: string, dstIP: string): Uint8Array {
  const httpData = `${method} ${path} HTTP/1.1\r\nHost: example.com\r\n\r\n`;
  return createTCPPacket(srcIP, dstIP, 54321, 80, new TextEncoder().encode(httpData));
}

function createDNSPacket(domain: string, srcIP: string, dstIP: string): Uint8Array {
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

function createTLSPacket(sni: string, srcIP: string, dstIP: string): Uint8Array {
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

function createBeaconPacket(srcIP: string, dstIP: string): Uint8Array {
  // Small encrypted payload typical of C2 beacon
  const payload = new Uint8Array(64);
  crypto.getRandomValues(payload);
  return createTCPPacket(srcIP, dstIP, 54321, 443, payload);
}

function createTCPPacket(srcIP: string, dstIP: string, srcPort: number, dstPort: number, payload: Uint8Array): Uint8Array {
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

function createUDPPacket(srcIP: string, dstIP: string, srcPort: number, dstPort: number, payload: Uint8Array): Uint8Array {
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