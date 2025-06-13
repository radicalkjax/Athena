import { PatternMatcher as WasmPatternMatcher, StreamingScanner, Stats } from '../core/pattern-matcher/pkg-web/pattern_matcher';

export interface PatternMatch {
  rule_id: string;
  rule_name: string;
  pattern_id: string;
  offset: number;
  length: number;
  severity: string;
  category: string;
  confidence: number;
  matched_data_base64: string;
}

export interface ScanResult {
  matches: PatternMatch[];
  total_rules_evaluated: number;
  scan_time_ms: number;
  bytes_scanned: number;
  threat_score: number;
}

export interface PatternMatcherStats {
  total_scans: number;
  total_matches: number;
  average_scan_time_ms: number;
  throughput_mbps: number;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  patterns: Pattern[];
  condition: Condition;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  category: 'Malware' | 'Exploit' | 'Obfuscation' | 'Suspicious' | 'PII' | 'Secret';
  tags: string[];
  metadata?: any;
}

export interface Pattern {
  id: string;
  pattern_type: 'Exact' | 'Regex' | 'Binary' | 'Fuzzy';
  value: string | Uint8Array;
  mask?: Uint8Array;
  description: string;
  weight: number;
}

export type Condition = 
  | { type: 'All' }
  | { type: 'Any'; count: number }
  | { type: 'Not'; condition: Condition }
  | { type: 'And'; conditions: Condition[] }
  | { type: 'Or'; conditions: Condition[] }
  | { type: 'PatternRef'; pattern_id: string };

export class PatternMatcherBridge {
  private matcher?: WasmPatternMatcher;
  private initialized = false;
  private wasmModule: any;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import for better code splitting
      const wasmModule = await import('../core/pattern-matcher/pkg-web/pattern_matcher');
      this.wasmModule = wasmModule;
      
      // Initialize WASM module
      await wasmModule.default();
      
      this.matcher = new wasmModule.PatternMatcher();
      await this.matcher.load_default_rules();
      
      this.initialized = true;
      console.log('PatternMatcher WASM module initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PatternMatcher WASM module:', error);
      throw new Error(`PatternMatcher initialization failed: ${error}`);
    }
  }

  async scan(data: ArrayBuffer): Promise<ScanResult> {
    if (!this.initialized || !this.matcher) {
      await this.initialize();
    }

    try {
      const uint8Array = new Uint8Array(data);
      const result = await this.matcher!.scan(uint8Array);
      return result as ScanResult;
    } catch (error) {
      console.error('Pattern scanning failed:', error);
      throw new Error(`Scan failed: ${error}`);
    }
  }

  async addRule(ruleText: string): Promise<string> {
    if (!this.initialized || !this.matcher) {
      await this.initialize();
    }

    try {
      const ruleId = await this.matcher!.add_rule_text(ruleText);
      return ruleId;
    } catch (error) {
      console.error('Failed to add rule:', error);
      throw new Error(`Add rule failed: ${error}`);
    }
  }

  async addRules(rules: Rule[]): Promise<void> {
    // Convert rules to YARA-like format and add them
    for (const rule of rules) {
      const yaraRule = this.convertToYaraFormat(rule);
      await this.addRule(yaraRule);
    }
  }

  private convertToYaraFormat(rule: Rule): string {
    let yaraRule = `rule ${rule.name}\n{\n`;
    
    // Add metadata
    if (rule.tags.length > 0 || rule.metadata) {
      yaraRule += '  meta:\n';
      yaraRule += `    description = "${rule.description}"\n`;
      yaraRule += `    severity = "${rule.severity}"\n`;
      yaraRule += `    category = "${rule.category}"\n`;
      if (rule.tags.length > 0) {
        yaraRule += `    tags = "${rule.tags.join(', ')}"\n`;
      }
    }
    
    // Add patterns
    yaraRule += '  strings:\n';
    for (const pattern of rule.patterns) {
      yaraRule += `    $${pattern.id} = `;
      
      switch (pattern.pattern_type) {
        case 'Exact':
          yaraRule += `"${pattern.value}"\n`;
          break;
        case 'Regex':
          yaraRule += `/${pattern.value}/\n`;
          break;
        case 'Binary':
          if (pattern.value instanceof Uint8Array) {
            const hexString = Array.from(pattern.value)
              .map(b => b.toString(16).padStart(2, '0').toUpperCase())
              .join(' ');
            yaraRule += `{ ${hexString} }\n`;
          }
          break;
      }
    }
    
    // Add condition
    yaraRule += '  condition:\n';
    yaraRule += `    ${this.conditionToString(rule.condition)}\n`;
    yaraRule += '}\n';
    
    return yaraRule;
  }

  private conditionToString(condition: Condition): string {
    if ('type' in condition) {
      switch (condition.type) {
        case 'All':
          return 'all of them';
        case 'Any':
          return `any of them`;
        case 'PatternRef':
          return `$${condition.pattern_id}`;
        case 'And':
          return condition.conditions.map(c => this.conditionToString(c)).join(' and ');
        case 'Or':
          return condition.conditions.map(c => this.conditionToString(c)).join(' or ');
        case 'Not':
          return `not ${this.conditionToString(condition.condition)}`;
      }
    }
    return 'all of them';
  }

  async scanStreaming(stream: ReadableStream<Uint8Array>, chunkSize: number = 1024 * 1024): AsyncIterable<ScanResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const scanner = new this.wasmModule.StreamingScanner(chunkSize);
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          const finalResult = await scanner.finish();
          if (finalResult) {
            yield finalResult as ScanResult;
          }
          break;
        }

        const result = await scanner.process_chunk(value);
        if (result) {
          yield result as ScanResult;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  getRuleCount(): number {
    if (!this.initialized || !this.matcher) {
      throw new Error('PatternMatcher not initialized');
    }
    return this.matcher.get_rule_count();
  }

  getStats(): PatternMatcherStats {
    if (!this.initialized || !this.matcher) {
      throw new Error('PatternMatcher not initialized');
    }
    
    const stats = this.matcher.get_stats();
    return {
      total_scans: stats.total_scans,
      total_matches: stats.total_matches,
      average_scan_time_ms: stats.average_scan_time_ms,
      throughput_mbps: stats.throughput_mbps
    };
  }

  clearRules(): void {
    if (!this.initialized || !this.matcher) {
      throw new Error('PatternMatcher not initialized');
    }
    this.matcher.clear_rules();
  }

  destroy(): void {
    if (this.matcher) {
      this.matcher.free();
      this.matcher = undefined;
    }
    this.initialized = false;
  }
}

// Singleton instance
let patternMatcherInstance: PatternMatcherBridge | null = null;

export function getPatternMatcher(): PatternMatcherBridge {
  if (!patternMatcherInstance) {
    patternMatcherInstance = new PatternMatcherBridge();
  }
  return patternMatcherInstance;
}

// Helper function to decode base64 matched data
export function decodeMatchedData(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper function to convert matched data to string
export function matchedDataToString(base64: string): string {
  const bytes = decodeMatchedData(base64);
  return new TextDecoder().decode(bytes);
}