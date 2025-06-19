import { vi } from 'vitest';

export interface PatternMatch {
  pattern: string;
  offset: number;
  length: number;
  confidence: number;
  context?: string;
  category?: string;
  severity?: string;
  rule_name?: string;
  rule_id?: string;
  matched_data_base64?: string;
}

export interface Signature {
  name: string;
  description: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface ScanResult {
  success?: boolean;
  data?: { matches: PatternMatch[] };
  matches: PatternMatch[];
  signatures: Signature[];
  totalMatches: number;
  scanTime: number;
  threat_score?: number;
}

export class PatternMatcherBridge {
  private static instance: PatternMatcherBridge | null = null;
  private initialized = false;
  private rules: any[] = [];

  static getInstance(): PatternMatcherBridge {
    if (!PatternMatcherBridge.instance) {
      PatternMatcherBridge.instance = new PatternMatcherBridge();
    }
    return PatternMatcherBridge.instance;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // Pattern matching operations
  findPatterns = vi.fn().mockImplementation(async (data: Uint8Array, patterns: string[]): Promise<PatternMatch[]> => {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const matches: PatternMatch[] = [];
    
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          pattern,
          offset: match.index,
          length: match[0].length,
          confidence: 0.95,
          context: text.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20)
        });
      }
    }
    
    return matches;
  });

  scanForSignatures = vi.fn().mockImplementation(async (data: Uint8Array): Promise<ScanResult> => {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const matches: PatternMatch[] = [];
    const signatures: Signature[] = [];
    
    // Enhanced pattern detection for specific test cases
    const patterns = [
      // JavaScript eval with base64
      { pattern: 'eval\\(', name: 'JavaScript Eval', category: 'Obfuscation', severity: 'High', threat: 8 },
      { pattern: 'atob\\(', name: 'Base64 Decode', category: 'Obfuscation', severity: 'High', threat: 7 },
      
      // PHP backdoor patterns
      { pattern: 'eval\\(\\$_POST', name: 'PHP Eval Backdoor', category: 'Malware', severity: 'Critical', threat: 10 },
      { pattern: 'shell_exec', name: 'Shell Execution', category: 'Malware', severity: 'Critical', threat: 9 },
      
      // PowerShell patterns  
      { pattern: '-EncodedCommand', name: 'PowerShell Encoded', category: 'Obfuscation', severity: 'High', threat: 8 },
      { pattern: 'powershell', name: 'PowerShell Usage', category: 'Suspicious', severity: 'Medium', threat: 5 },
      
      // PE header
      { pattern: 'MZ', name: 'PE Header', category: 'Executable', severity: 'Medium', threat: 4, binary: true },
      
      // Generic patterns
      { pattern: 'CreateRemoteThread', name: 'Process Injection', category: 'Malware', severity: 'High', threat: 8 },
      { pattern: 'VirtualAlloc', name: 'Memory Allocation', category: 'Suspicious', severity: 'Medium', threat: 5 }
    ];
    
    let totalThreatScore = 0;
    
    for (const { pattern, name, category, severity, threat, binary } of patterns) {
      const regex = new RegExp(pattern, binary ? 'g' : 'gi');
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({
          pattern,
          offset: match.index,
          length: match[0].length,
          confidence: 0.9,
          context: text.substring(Math.max(0, match.index - 20), match.index + match[0].length + 20),
          category,
          severity,
          rule_name: name,
          rule_id: `rule_${name.toLowerCase().replace(/\s+/g, '_')}`
        });
        
        signatures.push({
          name,
          description: `Detected ${name.toLowerCase()} pattern`,
          pattern,
          severity: severity.toLowerCase() as any
        });
        
        totalThreatScore += threat;
      }
    }
    
    return {
      matches,
      signatures,
      totalMatches: matches.length,
      scanTime: 50,
      threat_score: totalThreatScore
    };
  });

  searchRegex = vi.fn().mockImplementation(async (data: Uint8Array, regex: string, flags = 'gi'): Promise<PatternMatch[]> => {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const pattern = new RegExp(regex, flags);
    const matches: PatternMatch[] = [];
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({
        pattern: regex,
        offset: match.index,
        length: match[0].length,
        confidence: 0.95,
        context: text.substring(Math.max(0, match.index - 10), match.index + match[0].length + 10)
      });
    }
    
    return matches;
  });

  findStrings = vi.fn().mockImplementation(async (data: Uint8Array, minLength = 4): Promise<string[]> => {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const strings = text.match(/[a-zA-Z0-9\s]{4,}/g) || [];
    return strings.filter(s => s.length >= minLength);
  });

  scanForURLs = vi.fn().mockImplementation(async (data: Uint8Array): Promise<string[]> => {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
    return text.match(urlRegex) || [];
  });

  scanForEmails = vi.fn().mockImplementation(async (data: Uint8Array): Promise<string[]> => {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    return text.match(emailRegex) || [];
  });

  matchYaraRules = vi.fn().mockImplementation(async (data: Uint8Array, rules: string[]): Promise<PatternMatch[]> => {
    // Mock YARA rule matching
    const matches: PatternMatch[] = [];
    const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
    
    for (const rule of rules) {
      if (text.includes('malware') && rule.includes('malware')) {
        matches.push({
          pattern: rule,
          offset: text.indexOf('malware'),
          length: 7,
          confidence: 0.95
        });
      }
    }
    
    return matches;
  });

  getRuleCount = vi.fn().mockImplementation((): number => {
    return 1500; // Mock rule count
  });

  scan = vi.fn().mockImplementation(async (data: ArrayBuffer): Promise<ScanResult> => {
    const uint8Data = new Uint8Array(data);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(uint8Data);
    
    // First get standard signatures
    const standardResult = await this.scanForSignatures(uint8Data);
    
    // Check custom rules
    const customMatches: PatternMatch[] = [];
    for (const ruleObj of this.rules) {
      if (typeof ruleObj === 'object' && ruleObj.rule && ruleObj.id) {
        const rule = ruleObj.rule;
        
        // Extract strings from YARA-like rule
        const stringsMatch = rule.match(/strings:\s*\$\w+\s*=\s*"([^"]+)"/);
        if (stringsMatch) {
          const searchPattern = stringsMatch[1];
          if (text.includes(searchPattern)) {
            const offset = text.indexOf(searchPattern);
            customMatches.push({
              pattern: searchPattern,
              offset,
              length: searchPattern.length,
              confidence: 0.95,
              context: text.substring(Math.max(0, offset - 20), offset + searchPattern.length + 20),
              category: 'Custom',
              severity: 'High',
              rule_name: ruleObj.id,
              rule_id: ruleObj.id,
              matched_data_base64: btoa(searchPattern) // Add base64 encoded matched data
            });
          }
        }
      }
    }
    
    const allMatches = [...standardResult.matches, ...customMatches];
    
    // Add JS-specific patterns for the test
    if (text.includes('cookie')) {
      allMatches.push({
        pattern: 'document.cookie access',
        offset: text.indexOf('cookie'),
        length: 6,
        confidence: 0.95,
        category: 'Suspicious',
        severity: 'high',
        rule_id: 'js-cookie-access',
        rule_name: 'Cookie Access Detection'
      });
    }
    
    if (text.includes('eval')) {
      allMatches.push({
        pattern: 'eval() usage',
        offset: text.indexOf('eval'),
        length: 4,
        confidence: 0.9,
        category: 'Dangerous',
        severity: 'high',
        rule_id: 'js-eval-usage',
        rule_name: 'Dynamic Code Execution'
      });
    }
    
    if (text.includes('encryptFile') || text.includes('cipher') || text.includes('aes-256-cbc')) {
      allMatches.push({
        pattern: 'encryption routine',
        offset: text.indexOf('encrypt') !== -1 ? text.indexOf('encrypt') : text.indexOf('cipher'),
        length: 10,
        confidence: 0.95,
        category: 'Ransomware',
        severity: 'critical',
        rule_id: 'ransomware-encrypt',
        rule_name: 'File Encryption Detection'
      });
    }
    
    if (text.includes('c2Server') || text.includes('BotClient') || text.includes('command') || text.includes('botnet')) {
      allMatches.push({
        pattern: 'C2 communication',
        offset: text.indexOf('c2') !== -1 ? text.indexOf('c2') : text.indexOf('Bot'),
        length: 15,
        confidence: 0.9,
        category: 'Botnet',
        severity: 'critical',
        rule_id: 'botnet-c2-comm',
        rule_name: 'C2 Communication Detection'
      });
    }
    
    return {
      success: true,
      data: { matches: allMatches },
      matches: allMatches,
      signatures: standardResult.signatures,
      totalMatches: allMatches.length,
      scanTime: standardResult.scanTime,
      threat_score: standardResult.threat_score
    };
  });

  addRule = vi.fn().mockImplementation(async (rule: string): Promise<string> => {
    // Extract rule name from YARA-like syntax
    const ruleNameMatch = rule.match(/rule\s+(\w+)/);
    const ruleId = ruleNameMatch ? ruleNameMatch[1] : `rule_${this.rules.length}`;
    
    this.rules.push({ rule, id: ruleId });
    return ruleId;
  });

  scanStreaming = vi.fn().mockImplementation(async function* (stream: ReadableStream) {
    // Mock streaming scanner with realistic results
    yield { 
      progress: 50, 
      matches: [{
        pattern: 'eval(',
        offset: 0,
        length: 5,
        confidence: 0.9,
        category: 'Obfuscation',
        severity: 'High'
      }] 
    };
    yield { 
      progress: 100, 
      matches: [{
        pattern: 'atob(',
        offset: 10,
        length: 5,
        confidence: 0.9,
        category: 'Obfuscation',
        severity: 'High'
      }], 
      completed: true 
    };
  });

  getStats = vi.fn().mockImplementation(() => {
    return {
      total_scans: 10,
      total_matches: 5,
      average_scan_time: 25,
      average_scan_time_ms: 25.5,
      throughput_mbps: 12.3,
      rules_loaded: this.rules.length || 1500
    };
  });

  destroy = vi.fn().mockImplementation((): void => {
    this.initialized = false;
  });

  cleanup(): void {
    this.initialized = false;
  }
}

export const patternMatcherBridge = PatternMatcherBridge.getInstance();

// Export the functions that tests expect
export const getPatternMatcher = () => PatternMatcherBridge.getInstance();

export const matchedDataToString = vi.fn().mockImplementation((base64Data: string): string => {
  try {
    return atob(base64Data);
  } catch {
    return '';
  }
});