/**
 * Network Analysis Module Bridge
 * Provides TypeScript interface to WASM network analysis functions
 */

declare const window: any;
const isBrowser = typeof window !== 'undefined';

export interface NetworkResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface PacketAnalysis {
  packet_type: string;
  source_ip?: string;
  dest_ip?: string;
  source_port?: number;
  dest_port?: number;
  protocol: string;
  payload_size: number;
  flags: string[];
  timestamp?: number;
}

export interface PacketAnalysisResult extends PacketAnalysis {
  ethernetInfo?: {
    sourceMAC: string;
    destMAC: string;
  };
  ipInfo?: {
    version: number;
    sourceIP: string;
    destIP: string;
    protocol: number;
  };
  transportInfo?: {
    sourcePort: number;
    destPort: number;
    tcpFlags?: string[];
  };
  anomalies: string[];
}

export interface ProtocolInfo {
  protocol_type: string;
  version?: string;
  headers: any;
  payload?: string;
  is_encrypted: boolean;
}

export interface NetworkAnomaly {
  anomaly_type: string;
  severity: string;
  description: string;
  indicators: string[];
  timestamp: number;
}

export interface TrafficPattern {
  pattern_type: string;
  confidence: number;
  matches: string[];
  metadata: any;
  sourceIP?: string;
  destIP?: string;
  sourcePort?: number;
  destPort?: number;
  protocol?: number;
  timestamp?: number;
  bytesSent?: number;
  bytesReceived?: number;
  duration?: number;
  payload?: Uint8Array;
  isBeaconing?: boolean;
  scanType?: string;
  portsScanned?: number;
  possibleExfiltration?: boolean;
  dataVolumeRatio?: number;
}

export interface NetworkCapture {
  packets: Array<{
    timestamp: number;
    length: number;
    sourceIP: string;
    destIP: string;
    protocol: number;
    data: Uint8Array;
  }>;
  startTime: number;
  endTime: number;
  totalPackets: number;
  totalBytes: number;
  metadata?: {
    suspiciousConnections?: number;
    malformedPackets?: number;
    encryptedRatio?: number;
  };
}

export interface PortScanInfo {
  scan_type: string;
  source_ip: string;
  target_ips: string[];
  scanned_ports: number[];
  duration_ms: number;
  packet_count: number;
}

export interface DataExfiltrationInfo {
  source_ip: string;
  destination_ip: string;
  total_bytes: number;
  duration_ms: number;
  protocol: string;
  risk_score: number;
}

export interface CCPatternResult {
  patterns: Array<{
    pattern_type: string;
    confidence: number;
    indicators: string[];
    iocs: string[];
  }>;
  total_detected: number;
  high_confidence: number;
}

export interface PortScanResult {
  scans_detected: number;
  scan_details: PortScanInfo[];
}

export interface ExfiltrationResult {
  exfiltration_detected: boolean;
  high_risk_flows: number;
  flows: DataExfiltrationInfo[];
}

export class WASMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WASMError';
  }
}

export class NetworkBridge {
  private static instance: NetworkBridge;
  private module: any;
  private moduleInstance: any;
  private initialized = false;

  private constructor() {}

  static getInstance(): NetworkBridge {
    if (!NetworkBridge.instance) {
      NetworkBridge.instance = new NetworkBridge();
    }
    return NetworkBridge.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Platform-specific loading
      let wasmModule: any;
      if (isBrowser) {
        // Browser environment - network doesn't have pkg-web yet, use pkg
        wasmModule = await import('../core/network/pkg/network');
        await wasmModule.default();
      } else {
        // Node.js environment
        wasmModule = require('../core/network/pkg/network');
      }
      
      this.module = wasmModule;
      this.moduleInstance = new wasmModule.NetworkModule();
      
      if (!this.moduleInstance.is_initialized()) {
        throw new WASMError('Network module failed to initialize');
      }
      
      this.initialized = true;
      console.log(`Network WASM module initialized, version: ${this.moduleInstance.get_version()}`);
    } catch (error: unknown) {
      throw new WASMError(`Failed to initialize network module: ${error}`);
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.moduleInstance) {
      throw new WASMError('Network module not initialized. Call initialize() first.');
    }
  }

  // Packet analysis
  async analyzePacket(packetData: Uint8Array): Promise<PacketAnalysis> {
    this.ensureInitialized();
    
    try {
      const result: NetworkResult = this.moduleInstance.analyze_packet(packetData);
      
      if (!result.success) {
        throw new WASMError(result.error || 'Packet analysis failed');
      }
      
      return result.data as PacketAnalysis;
    } catch (error: unknown) {
      throw new WASMError(`Packet analysis error: ${error}`);
    }
  }

  // Protocol detection
  async detectProtocol(data: Uint8Array): Promise<ProtocolInfo> {
    this.ensureInitialized();
    
    try {
      const result: NetworkResult = this.moduleInstance.detect_protocol(data);
      
      if (!result.success) {
        throw new WASMError(result.error || 'Protocol detection failed');
      }
      
      return result.data as ProtocolInfo;
    } catch (error: unknown) {
      throw new WASMError(`Protocol detection error: ${error}`);
    }
  }

  // Traffic pattern analysis
  async analyzeTrafficPattern(packets: PacketAnalysis[]): Promise<TrafficPattern[]> {
    this.ensureInitialized();
    
    try {
      const packetsJson = JSON.stringify(packets);
      const result: NetworkResult = this.moduleInstance.analyze_traffic_pattern(packetsJson);
      
      if (!result.success) {
        throw new WASMError(result.error || 'Traffic pattern analysis failed');
      }
      
      return result.data as TrafficPattern[];
    } catch (error: unknown) {
      throw new WASMError(`Traffic pattern analysis error: ${error}`);
    }
  }

  // Anomaly detection
  async detectAnomalies(trafficData: PacketAnalysis[]): Promise<NetworkAnomaly[]> {
    this.ensureInitialized();
    
    try {
      const trafficJson = JSON.stringify(trafficData);
      const result: NetworkResult = this.moduleInstance.detect_anomalies(trafficJson);
      
      if (!result.success) {
        throw new WASMError(result.error || 'Anomaly detection failed');
      }
      
      return result.data as NetworkAnomaly[];
    } catch (error: unknown) {
      throw new WASMError(`Anomaly detection error: ${error}`);
    }
  }

  // DNS analysis
  async analyzeDNSQuery(dnsPacket: Uint8Array): Promise<any> {
    this.ensureInitialized();
    
    try {
      const result: NetworkResult = this.moduleInstance.analyze_dns_query(dnsPacket);
      
      if (!result.success) {
        throw new WASMError(result.error || 'DNS analysis failed');
      }
      
      return result.data;
    } catch (error: unknown) {
      throw new WASMError(`DNS analysis error: ${error}`);
    }
  }

  // HTTP analysis
  async analyzeHTTPRequest(httpData: Uint8Array): Promise<any> {
    this.ensureInitialized();
    
    try {
      const result: NetworkResult = this.moduleInstance.analyze_http_request(httpData);
      
      if (!result.success) {
        throw new WASMError(result.error || 'HTTP analysis failed');
      }
      
      return result.data;
    } catch (error: unknown) {
      throw new WASMError(`HTTP analysis error: ${error}`);
    }
  }

  // C&C detection
  async detectCCCommunication(trafficData: PacketAnalysis[]): Promise<CCPatternResult> {
    this.ensureInitialized();
    
    try {
      const trafficJson = JSON.stringify(trafficData);
      const result: NetworkResult = this.moduleInstance.detect_cc_communication(trafficJson);
      
      if (!result.success) {
        throw new WASMError(result.error || 'C&C detection failed');
      }
      
      return result.data as CCPatternResult;
    } catch (error: unknown) {
      throw new WASMError(`C&C detection error: ${error}`);
    }
  }

  // Port scan detection
  async detectPortScan(packets: PacketAnalysis[]): Promise<PortScanResult> {
    this.ensureInitialized();
    
    try {
      const packetsJson = JSON.stringify(packets);
      const result: NetworkResult = this.moduleInstance.detect_port_scan(packetsJson);
      
      if (!result.success) {
        throw new WASMError(result.error || 'Port scan detection failed');
      }
      
      return result.data as PortScanResult;
    } catch (error: unknown) {
      throw new WASMError(`Port scan detection error: ${error}`);
    }
  }

  // Data exfiltration detection
  async detectDataExfiltration(trafficData: PacketAnalysis[]): Promise<ExfiltrationResult> {
    this.ensureInitialized();
    
    try {
      const trafficJson = JSON.stringify(trafficData);
      const result: NetworkResult = this.moduleInstance.detect_data_exfiltration(trafficJson);
      
      if (!result.success) {
        throw new WASMError(result.error || 'Data exfiltration detection failed');
      }
      
      return result.data as ExfiltrationResult;
    } catch (error: unknown) {
      throw new WASMError(`Data exfiltration detection error: ${error}`);
    }
  }

  // Analyze a single packet with extended result format
  async analyzePacketExtended(packet: Uint8Array): Promise<PacketAnalysisResult> {
    try {
      const analysis = await this.analyzePacket(packet);
      return {
        ...analysis,
        ethernetInfo: analysis.source_ip ? {
          sourceMAC: 'aa:bb:cc:dd:ee:ff', // Mock for now
          destMAC: '00:11:22:33:44:55'
        } : undefined,
        ipInfo: analysis.source_ip ? {
          version: 4,
          sourceIP: analysis.source_ip,
          destIP: analysis.dest_ip || '',
          protocol: analysis.protocol === 'TCP' ? 6 : 17
        } : undefined,
        transportInfo: analysis.source_port ? {
          sourcePort: analysis.source_port,
          destPort: analysis.dest_port || 0,
          tcpFlags: analysis.flags
        } : undefined,
        anomalies: []
      };
    } catch (error: unknown) {
      throw new WASMError(`Packet analysis error: ${error}`);
    }
  }

  // Check if a domain is suspicious
  async isSuspiciousDomain(domain: string): Promise<boolean> {
    try {
      // Simple heuristic for now
      const randomChars = domain.split('').filter(c => 
        !'aeiou'.includes(c.toLowerCase())
      ).length;
      const ratio = randomChars / domain.length;
      return ratio > 0.8 || domain.length > 20;
    } catch (error: unknown) {
      throw new WASMError(`Domain check error: ${error}`);
    }
  }

  // Analyze network capture
  async analyzeNetworkCapture(capture: NetworkCapture): Promise<any> {
    try {
      const protocols = new Set<string>();
      let suspiciousActivities = 0;
      
      // Analyze each packet
      for (const packet of capture.packets) {
        try {
          const analysis = await this.analyzePacket(packet.data);
          protocols.add(analysis.protocol);
          // Check for suspicious patterns
          if (analysis.flags?.includes('suspicious')) {
            suspiciousActivities++;
          }
        } catch (error: unknown) {
          // Continue with next packet on error
          console.warn('Failed to analyze packet:', error);
        }
      }

      const riskScore = await this.calculateRiskScore(capture);
      
      return {
        summary: {
          totalPackets: capture.totalPackets,
          totalBytes: capture.totalBytes,
          duration: capture.endTime - capture.startTime
        },
        protocols: Array.from(protocols),
        suspiciousActivities,
        riskScore
      };
    } catch (error: unknown) {
      throw new WASMError(`Network capture analysis error: ${error}`);
    }
  }

  // Calculate risk score for a capture
  async calculateRiskScore(capture: NetworkCapture): Promise<number> {
    try {
      let score = 0;
      
      // Factor in metadata
      if (capture.metadata) {
        score += (capture.metadata.suspiciousConnections || 0) * 10;
        score += (capture.metadata.malformedPackets || 0) * 5;
        score += (1 - (capture.metadata.encryptedRatio || 0)) * 20;
      }
      
      // Factor in capture size
      const mbPerSecond = (capture.totalBytes / 1024 / 1024) / 
        ((capture.endTime - capture.startTime) / 1000);
      if (mbPerSecond > 10) score += 20;
      
      return Math.min(100, Math.max(0, score));
    } catch (error: unknown) {
      throw new WASMError(`Risk score calculation error: ${error}`);
    }
  }

  // Domain analysis for security checks
  async analyzeDomain(domain: string): Promise<{ isMalicious: boolean; suspicious: boolean; risk_score: number; details?: string }> {
    this.ensureInitialized();
    
    try {
      // For now, implement a basic domain analysis
      // In production, this would call the WASM module's domain analysis function
      const maliciousDomains = [
        'malicious.com', 'phishing.net', 'badsite.org', 'evil.com',
        'malware-download.net', 'cryptolocker.biz', 'ransomware.org'
      ];
      
      const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf'];
      const suspiciousPatterns = [
        /[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}/, // IP addresses
        /[a-z0-9]{32,}/, // Long random strings
        /(paypal|amazon|google|microsoft|apple).*\.(tk|ml|ga|cf)/, // Phishing patterns
        /[0-9]+-[0-9]+-[0-9]+/, // Multiple hyphens with numbers
      ];
      
      const domainLower = domain.toLowerCase();
      
      // Check if explicitly malicious
      const isMalicious = maliciousDomains.some(mal => domainLower.includes(mal));
      
      // Check if suspicious
      let suspicious = false;
      let risk_score = 0;
      
      // Check TLD
      if (suspiciousTLDs.some(tld => domainLower.endsWith(tld))) {
        suspicious = true;
        risk_score += 30;
      }
      
      // Check patterns
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(domainLower)) {
          suspicious = true;
          risk_score += 20;
        }
      }
      
      // Check domain length
      if (domain.length > 50) {
        suspicious = true;
        risk_score += 10;
      }
      
      // Check for homograph attacks (simplified)
      if (/[а-я]/.test(domain)) { // Cyrillic characters
        suspicious = true;
        risk_score += 40;
      }
      
      if (isMalicious) {
        risk_score = 100;
      }
      
      return {
        isMalicious,
        suspicious: suspicious || isMalicious,
        risk_score: Math.min(100, risk_score),
        details: isMalicious ? 'Known malicious domain' : 
                 suspicious ? 'Domain exhibits suspicious characteristics' : 
                 'Domain appears safe'
      };
    } catch (error: unknown) {
      throw new WASMError(`Domain analysis error: ${error}`);
    }
  }

  // Utility method to convert hex string to Uint8Array
  hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  // Utility method to convert Uint8Array to hex string
  bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Cleanup
  destroy(): void {
    if (this.moduleInstance) {
      this.moduleInstance.free();
      this.moduleInstance = null;
    }
    this.initialized = false;
  }
}

// Export singleton instance
export function getNetworkBridge(): NetworkBridge {
  return NetworkBridge.getInstance();
}