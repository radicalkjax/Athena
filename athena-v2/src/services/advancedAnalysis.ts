import { invoke } from '@tauri-apps/api/core';
import type {
  BehavioralAnalysis,
  BehaviorPattern,
  YaraMatch,
  ThreatIntelligence,
  AdvancedAnalysisResult,
  TimelineEvent,
  NetworkBehavior,
  FileOperation,
  ProcessBehavior
} from '../types/analysis';

class AdvancedAnalysisService {
  private activeAnalyses: Map<string, AdvancedAnalysisResult> = new Map();
  private yaraRules: Map<string, string> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules() {
    // Initialize with some common YARA rules
    this.yaraRules.set('emotet_detection', `
      rule Emotet_Trojan {
        meta:
          description = "Detects Emotet trojan variants"
          author = "Athena Platform"
          date = "2024-01-01"
          severity = "critical"
        strings:
          $a = {C7 45 ?? ?? ?? ?? ?? C7 45 ?? ?? ?? ?? ??}
          $b = "urlmon.dll" nocase
          $c = "URLDownloadToFile" nocase
        condition:
          uint16(0) == 0x5A4D and filesize < 1MB and all of them
      }
    `);

    this.yaraRules.set('ransomware_generic', `
      rule Generic_Ransomware {
        meta:
          description = "Generic ransomware detection"
          author = "Athena Platform"
        strings:
          $encrypt1 = "AES" nocase
          $encrypt2 = "RSA" nocase
          $ransom1 = "bitcoin" nocase
          $ransom2 = "decrypt" nocase
          $ext = /\.(locked|encrypted|cry|enc)$/
        condition:
          2 of ($encrypt*) and 1 of ($ransom*) and $ext
      }
    `);
  }

  async analyzeBehavior(
    fileHash: string,
    fileData: Uint8Array
  ): Promise<BehavioralAnalysis> {
    // Propagate errors to UI - zero tolerance for mock data
    const result = await invoke<BehavioralAnalysis>('analyze_behavior', {
      fileHash,
      fileData: Array.from(fileData)
    });
    return result;
  }

  // Mock behavioral analysis removed - zero tolerance for mock data in production

  private calculateRiskScore(
    behaviors: BehaviorPattern[],
    network: NetworkBehavior[],
    files: FileOperation[],
    processes: ProcessBehavior[]
  ): number {
    let score = 0;
    
    // Weight behaviors by severity
    behaviors.forEach(behavior => {
      const weight = behavior.severity === 'critical' ? 25 : 
                    behavior.severity === 'high' ? 15 : 
                    behavior.severity === 'medium' ? 10 : 5;
      score += weight * behavior.confidence;
    });

    // Add points for suspicious activities
    score += network.filter(n => n.suspicious).length * 10;
    score += files.filter(f => f.suspicious).length * 8;
    score += processes.filter(p => p.suspicious).length * 12;

    // Normalize to 0-100
    return Math.min(100, Math.round(score));
  }

  async runYaraScans(
    fileData: Uint8Array,
    customRules?: string[]
  ): Promise<YaraMatch[]> {
    const rules = customRules || Array.from(this.yaraRules.values());
    const result = await invoke<YaraMatch[]>('scan_file_with_yara', {
      fileData: Array.from(fileData),
      rules
    });
    return result;
  }


  async getThreatIntelligence(
    fileHash: string,
    iocs: string[]
  ): Promise<ThreatIntelligence[]> {
    const result = await invoke<ThreatIntelligence[]>('get_threat_intelligence', {
      fileHash,
      iocs
    });
    return result;
  }


  async generateTimeline(
    behavioral: BehavioralAnalysis,
    yaraMatches: YaraMatch[]
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];

    // Add process events
    behavioral.processActivity.forEach(proc => {
      events.push({
        timestamp: proc.timestamp,
        type: 'process',
        description: `Process ${proc.operation}: ${proc.processName} (PID: ${proc.pid})`,
        severity: proc.suspicious ? 'high' : 'info',
        details: proc
      });
    });

    // Add network events
    behavioral.networkActivity.forEach(net => {
      events.push({
        timestamp: net.timestamp,
        type: 'network',
        description: `${net.type} to ${net.destination}:${net.port}`,
        severity: net.suspicious ? 'medium' : 'info',
        details: net
      });
    });

    // Add file events
    behavioral.fileOperations.forEach(file => {
      events.push({
        timestamp: file.timestamp,
        type: 'file',
        description: `File ${file.operation}: ${file.path}`,
        severity: file.suspicious ? 'medium' : 'info',
        details: file
      });
    });

    // Add YARA match events
    yaraMatches.forEach(match => {
      const severity = match.meta.severity as 'low' | 'medium' | 'high' | 'critical' | undefined;
      events.push({
        timestamp: Date.now(),
        type: 'detection',
        description: `YARA rule matched: ${match.rule}`,
        severity: severity || 'high',
        details: match
      });
    });

    // Sort by timestamp
    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  async performAdvancedAnalysis(
    fileHash: string,
    fileData: Uint8Array
  ): Promise<AdvancedAnalysisResult> {
    // Run all analyses in parallel
    const [behavioral, yaraMatches, threatIntel] = await Promise.all([
      this.analyzeBehavior(fileHash, fileData),
      this.runYaraScans(fileData),
      this.getThreatIntelligence(fileHash, [])
    ]);

    // Generate timeline
    const timeline = await this.generateTimeline(behavioral, yaraMatches);

    const result: AdvancedAnalysisResult = {
      behavioral,
      yaraMatches,
      threatIntel,
      timeline,
      sandboxReport: {
        environment: 'Windows 10 x64',
        duration: 300000, // 5 minutes
        screenshots: ['screenshot1.png', 'screenshot2.png'],
        networkCapture: 'capture.pcap',
        memoryDumps: ['memory1.dmp'],
        droppedFiles: behavioral.fileOperations
          .filter(f => f.operation === 'create')
          .map(f => f.path),
        terminated: false
      }
    };

    this.activeAnalyses.set(fileHash, result);
    return result;
  }

  addYaraRule(name: string, rule: string) {
    this.yaraRules.set(name, rule);
  }

  getYaraRules(): Map<string, string> {
    return this.yaraRules;
  }

  getAnalysisResult(fileHash: string): AdvancedAnalysisResult | undefined {
    return this.activeAnalyses.get(fileHash);
  }
}

export const advancedAnalysis = new AdvancedAnalysisService();