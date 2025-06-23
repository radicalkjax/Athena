export interface BehavioralAnalysis {
  id: string;
  timestamp: number;
  behaviors: BehaviorPattern[];
  riskScore: number;
  sandboxEscape: boolean;
  persistence: PersistenceMechanism[];
  networkActivity: NetworkBehavior[];
  fileOperations: FileOperation[];
  processActivity: ProcessBehavior[];
  registryModifications: RegistryChange[];
}

export interface BehaviorPattern {
  type: 'evasion' | 'persistence' | 'lateral_movement' | 'data_theft' | 'destruction' | 'communication';
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  evidence: string[];
}

export interface PersistenceMechanism {
  technique: string;
  location: string;
  details: string;
  mitreTechnique?: string;
}

export interface NetworkBehavior {
  type: 'dns_query' | 'http_request' | 'tcp_connection' | 'udp_traffic';
  destination: string;
  port: number;
  protocol: string;
  data?: string;
  suspicious: boolean;
  timestamp: number;
}

export interface FileOperation {
  operation: 'create' | 'read' | 'write' | 'delete' | 'rename' | 'execute';
  path: string;
  process: string;
  timestamp: number;
  suspicious: boolean;
}

export interface ProcessBehavior {
  operation: 'create' | 'terminate' | 'inject' | 'hollow';
  processName: string;
  pid: number;
  parentPid?: number;
  commandLine?: string;
  suspicious: boolean;
  timestamp: number;
}

export interface RegistryChange {
  operation: 'create' | 'modify' | 'delete';
  key: string;
  value?: string;
  data?: string;
  process: string;
  suspicious: boolean;
  timestamp: number;
}

export interface YaraMatch {
  rule: string;
  namespace?: string;
  tags: string[];
  meta: Record<string, string>;
  strings: YaraString[];
  confidence: number;
}

export interface YaraString {
  identifier: string;
  offset: number;
  value: string;
  length: number;
}

export interface ThreatIntelligence {
  source: string;
  timestamp: number;
  indicators: ThreatIndicator[];
  malwareFamily?: string;
  campaigns?: string[];
  actors?: string[];
  ttps?: string[]; // Tactics, Techniques, and Procedures
  references: string[];
}

export interface ThreatIndicator {
  type: 'hash' | 'ip' | 'domain' | 'url' | 'email' | 'file_path' | 'registry_key';
  value: string;
  confidence: number;
  firstSeen?: number;
  lastSeen?: number;
  tags: string[];
}

export interface AdvancedAnalysisResult {
  behavioral: BehavioralAnalysis;
  yaraMatches: YaraMatch[];
  threatIntel: ThreatIntelligence[];
  sandboxReport?: SandboxReport;
  timeline: TimelineEvent[];
}

export interface SandboxReport {
  environment: string;
  duration: number;
  screenshots: string[];
  networkCapture?: string;
  memoryDumps?: string[];
  droppedFiles: string[];
  terminated: boolean;
  terminationReason?: string;
}

export interface TimelineEvent {
  timestamp: number;
  type: string;
  description: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  details?: any;
}