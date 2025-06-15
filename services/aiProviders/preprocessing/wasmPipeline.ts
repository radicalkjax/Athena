/**
 * WASM Preprocessing Pipeline
 * Uses WASM modules to preprocess and secure AI inputs
 */

import { logger } from '../../../utils/logger';
import {
  createFileProcessor,
  IFileProcessor,
  analysisEngine,
  AnalysisEngineBridge,
  initializeAnalysisEngine,
  getNetworkBridge,
  NetworkBridge,
  cryptoBridge,
  CryptoBridge
} from '../../../wasm-modules/bridge';
import { AnalysisRequest } from '../types';

export interface PreprocessingResult {
  safe: boolean;
  cleaned?: string | ArrayBuffer;
  threats?: Array<{
    type: string;
    severity: string;
    description: string;
  }>;
  warnings?: string[];
  metadata?: {
    originalSize?: number;
    cleanedSize?: number;
    processingTime?: number;
    modifications?: string[];
  };
}

export interface PreprocessingOptions {
  maxInputSize?: number;
  allowBinary?: boolean;
  strictMode?: boolean;
  sanitizeUrls?: boolean;
  removeScripts?: boolean;
  detectPromptInjection?: boolean;
}

export class WASMPreprocessingPipeline {
  private fileProcessor?: IFileProcessor;
  private analysisEngine?: AnalysisEngineBridge;
  private networkBridge?: NetworkBridge;
  private cryptoBridge: CryptoBridge;
  private initialized = false;
  
  private readonly defaultOptions: PreprocessingOptions = {
    maxInputSize: 10 * 1024 * 1024, // 10MB
    allowBinary: true,
    strictMode: true,
    sanitizeUrls: true,
    removeScripts: true,
    detectPromptInjection: true
  };
  
  constructor(private options: PreprocessingOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
    this.cryptoBridge = cryptoBridge;
  }
  
  /**
   * Initialize WASM modules
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      logger.info('Initializing WASM preprocessing pipeline');
      
      // Initialize analysis engine
      await initializeAnalysisEngine();
      this.analysisEngine = analysisEngine;
      
      // Create file processor
      this.fileProcessor = await createFileProcessor({
        extractMetadata: true,
        deepAnalysis: true,
        minStringLength: 4
      });
      
      // Get network bridge for URL/domain analysis
      this.networkBridge = getNetworkBridge();
      
      this.initialized = true;
      logger.info('WASM preprocessing pipeline initialized');
      
    } catch (error: unknown) {
      logger.error('Failed to initialize WASM preprocessing', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
  
  /**
   * Preprocess an analysis request
   */
  async preprocess(request: AnalysisRequest): Promise<PreprocessingResult> {
    await this.initialize();
    
    const startTime = Date.now();
    const result: PreprocessingResult = {
      safe: true,
      warnings: [],
      metadata: {
        originalSize: 0,
        modifications: []
      }
    };
    
    try {
      // Get content and size
      const content = request.content;
      const isBinary = content instanceof ArrayBuffer;
      
      if (isBinary) {
        result.metadata!.originalSize = content.byteLength;
        
        // Check binary size
        if (content.byteLength > this.options.maxInputSize!) {
          result.safe = false;
          result.warnings!.push('Input exceeds maximum size limit');
          return result;
        }
        
        // Process binary content
        const binaryResult = await this.processBinary(content);
        Object.assign(result, binaryResult);
        
      } else {
        result.metadata!.originalSize = content.length;
        
        // Check text size
        if (content.length > this.options.maxInputSize!) {
          result.safe = false;
          result.warnings!.push('Input exceeds maximum size limit');
          return result;
        }
        
        // Process text content
        const textResult = await this.processText(content);
        Object.assign(result, textResult);
      }
      
      // Additional security checks based on analysis type
      if (request.analysisType && result.safe) {
        const typeCheckResult = await this.checkAnalysisType(
          request.analysisType, 
          result.cleaned || request.content
        );
        
        if (!typeCheckResult.safe) {
          result.safe = false;
          result.threats = [...(result.threats || []), ...(typeCheckResult.threats || [])];
        }
      }
      
      result.metadata!.processingTime = Date.now() - startTime;
      
      return result;
      
    } catch (error: unknown) {
      logger.error('Preprocessing failed', { error, requestId: request.id });
      
      return {
        safe: false,
        warnings: [`Preprocessing error: ${error instanceof Error ? error.message : "Unknown error"}`],
        metadata: { processingTime: Date.now() - startTime }
      };
    }
  }
  
  /**
   * Process binary content
   */
  private async processBinary(content: ArrayBuffer): Promise<PreprocessingResult> {
    const result: PreprocessingResult = { safe: true, threats: [], warnings: [] };
    
    try {
      // Use file processor to analyze binary
      const parsedFile = await this.fileProcessor!.parseFile(content);
      const fileAnalysis = parsedFile;
      
      // Check for suspicious patterns
      if (fileAnalysis.suspicious_indicators && fileAnalysis.suspicious_indicators.length > 0) {
        result.safe = false;
        result.threats = fileAnalysis.suspicious_indicators.map((pattern: any) => ({
          type: 'suspicious_pattern',
          severity: pattern.severity || 'medium',
          description: pattern.evidence || pattern.value
        }));
      }
      
      // Extract safe strings from binary
      if (fileAnalysis.strings) {
        const safeStrings = fileAnalysis.strings
          .filter((str: any) => !str.suspicious && !this.containsMaliciousPattern(str.value))
          .map((str: any) => str.value)
          .join('\n');
        
        result.cleaned = safeStrings;
        result.metadata = {
          ...result.metadata,
          cleanedSize: safeStrings.length,
          modifications: ['extracted_strings_from_binary']
        };
      }
      
      // Check file format
      if (fileAnalysis.format && ['executable', 'dll', 'script'].includes(fileAnalysis.format)) {
        result.warnings!.push(`Potentially dangerous file format: ${fileAnalysis.format}`);
      }
      
    } catch (error: unknown) {
      result.safe = false;
      result.warnings!.push(`Binary processing error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    
    return result;
  }
  
  /**
   * Process text content
   */
  private async processText(content: string): Promise<PreprocessingResult> {
    const result: PreprocessingResult = { 
      safe: true, 
      cleaned: content,
      threats: [], 
      warnings: [],
      metadata: { modifications: [] }
    };
    
    try {
      let cleaned = content;
      
      // 1. Detect and prevent prompt injection
      if (this.options.detectPromptInjection) {
        const injectionResult = await this.detectPromptInjection(cleaned);
        if (injectionResult.detected) {
          result.safe = false;
          result.threats!.push({
            type: 'prompt_injection',
            severity: 'high',
            description: injectionResult.description || 'Potential prompt injection detected'
          });
          
          // Attempt to clean
          if (injectionResult.cleaned) {
            cleaned = injectionResult.cleaned;
            result.metadata!.modifications!.push('prompt_injection_cleaned');
          }
        }
      }
      
      // 2. Remove scripts if enabled
      if (this.options.removeScripts) {
        const scriptPattern = /<script[^>]*>[\s\S]*?<\/script>/gi;
        if (scriptPattern.test(cleaned)) {
          cleaned = cleaned.replace(scriptPattern, '[SCRIPT REMOVED]');
          result.metadata!.modifications!.push('scripts_removed');
          result.warnings!.push('Script tags detected and removed');
        }
      }
      
      // 3. Sanitize URLs if enabled
      if (this.options.sanitizeUrls) {
        const urlResult = await this.sanitizeUrls(cleaned);
        if (urlResult.modified) {
          cleaned = urlResult.content;
          result.metadata!.modifications!.push('urls_sanitized');
          if (urlResult.threats && urlResult.threats.length > 0) {
            result.threats = [...result.threats!, ...urlResult.threats];
          }
        }
      }
      
      // 4. Check for obfuscation
      const obfuscationScore = await this.checkObfuscation(cleaned);
      if (obfuscationScore > 0.7) {
        result.warnings!.push('Content appears to be obfuscated');
        
        // Attempt deobfuscation
        try {
          const deobfuscationResult = await this.analysisEngine!.deobfuscate(cleaned);
          if (deobfuscationResult && deobfuscationResult.deobfuscated !== cleaned) {
            cleaned = deobfuscationResult.deobfuscated;
            result.metadata!.modifications!.push('deobfuscated');
          }
        } catch (e) {
          // Deobfuscation failed, continue with original
        }
      }
      
      // 5. Pattern matching for known threats
      const cleanedBuffer = new TextEncoder().encode(cleaned);
      const patternResult = await this.analysisEngine!.analyze(cleanedBuffer);
      if (patternResult.threats && patternResult.threats.length > 0) {
        result.threats = [...result.threats!, ...patternResult.threats.map(t => ({
          type: t.threat_type,
          severity: 'high',  // Default severity since ThreatInfo doesn't have severity
          description: t.description
        }))];
        
        if (this.options.strictMode) {
          result.safe = false;
        }
      }
      
      result.cleaned = cleaned;
      result.metadata!.cleanedSize = cleaned.length;
      
    } catch (error: unknown) {
      result.safe = false;
      result.warnings!.push(`Text processing error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    
    return result;
  }
  
  /**
   * Detect prompt injection attempts
   */
  private async detectPromptInjection(content: string): Promise<{
    detected: boolean;
    description?: string;
    cleaned?: string;
  }> {
    const injectionPatterns = [
      // Direct instruction overrides
      /ignore\s+(all\s+)?previous\s+instructions?/i,
      /disregard\s+(all\s+)?previous\s+instructions?/i,
      /forget\s+everything\s+above/i,
      /new\s+instructions?:\s*/i,
      /system:\s*you\s+are/i,
      
      // Role playing attempts
      /you\s+are\s+now\s+a/i,
      /act\s+as\s+if\s+you\s+are/i,
      /pretend\s+to\s+be/i,
      /roleplay\s+as/i,
      
      // Instruction delimiters
      /\[INST\][\s\S]*?\[\/INST\]/,
      /<<<[\s\S]*?>>>/,
      /\{\{[\s\S]*?\}\}/,
      
      // Common jailbreak patterns
      /DAN\s+mode/i,
      /developer\s+mode/i,
      /jailbreak/i,
      /bypass\s+safety/i,
      
      // Hidden instructions
      /\u200B|\u200C|\u200D|\uFEFF/, // Zero-width characters
      /base64:[\s]*[A-Za-z0-9+/]+=*/,
      /eval\s*\(/,
      /Function\s*\(/
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        
        // Attempt to clean by removing the injection
        const cleaned = content.replace(pattern, '[INJECTION REMOVED]');
        
        return {
          detected: true,
          description: `Detected potential injection: ${match?.[0]?.substring(0, 50)}...`,
          cleaned
        };
      }
    }
    
    // Check for suspicious character sequences
    const suspiciousChars = content.match(/[\u0000-\u001F\u007F-\u009F]/g);
    if (suspiciousChars && suspiciousChars.length > 5) {
      return {
        detected: true,
        description: 'Suspicious control characters detected',
        cleaned: content.replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      };
    }
    
    return { detected: false };
  }
  
  /**
   * Sanitize URLs in content
   */
  private async sanitizeUrls(content: string): Promise<{
    content: string;
    modified: boolean;
    threats?: Array<{ type: string; severity: string; description: string }>;
  }> {
    const urlPattern = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
    const urls = content.match(urlPattern) || [];
    
    if (urls.length === 0) {
      return { content, modified: false };
    }
    
    let modified = false;
    let sanitized = content;
    const threats: Array<{ type: string; severity: string; description: string }> = [];
    
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        
        // Check against known malicious domains
        const maliciousCheck = await this.networkBridge!.analyzeDomain(urlObj.hostname);
        
        if (maliciousCheck.isMalicious) {
          sanitized = sanitized.replace(url, '[MALICIOUS URL REMOVED]');
          modified = true;
          threats.push({
            type: 'malicious_url',
            severity: 'high',
            description: `Malicious URL detected: ${urlObj.hostname}`
          });
        } else if (maliciousCheck.suspicious) {
          // Keep but warn
          threats.push({
            type: 'suspicious_url',
            severity: 'medium',
            description: `Suspicious URL: ${urlObj.hostname}`
          });
        }
        
        // Check for URL shorteners
        const shorteners = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'short.link'];
        if (shorteners.some(s => urlObj.hostname.includes(s))) {
          sanitized = sanitized.replace(url, '[URL SHORTENER REMOVED]');
          modified = true;
          threats.push({
            type: 'url_shortener',
            severity: 'medium',
            description: 'URL shortener detected and removed'
          });
        }
        
      } catch (e) {
        // Invalid URL, remove it
        sanitized = sanitized.replace(url, '[INVALID URL REMOVED]');
        modified = true;
      }
    }
    
    return { content: sanitized, modified, threats };
  }
  
  /**
   * Check content obfuscation level
   */
  private async checkObfuscation(content: string): Promise<number> {
    const indicators = {
      // High entropy (randomness)
      highEntropy: this.calculateEntropy(content) > 4.5,
      
      // Excessive special characters
      specialCharRatio: (content.match(/[^a-zA-Z0-9\s]/g) || []).length / content.length,
      
      // Long unbroken strings
      longStrings: /[^\s]{100,}/.test(content),
      
      // Hex/Base64 patterns
      encodedPatterns: /([0-9a-fA-F]{32,}|[A-Za-z0-9+/]{50,}={0,2})/.test(content),
      
      // Unicode abuse
      unicodeAbuse: /[\u0080-\uFFFF]{10,}/.test(content),
      
      // Repetitive patterns
      repetitive: /(.)\1{10,}/.test(content)
    };
    
    let score = 0;
    if (indicators.highEntropy) score += 0.3;
    if (indicators.specialCharRatio > 0.3) score += 0.2;
    if (indicators.longStrings) score += 0.2;
    if (indicators.encodedPatterns) score += 0.2;
    if (indicators.unicodeAbuse) score += 0.1;
    if (indicators.repetitive) score += 0.1;
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate Shannon entropy
   */
  private calculateEntropy(str: string): number {
    const freq: Record<string, number> = {};
    for (const char of str) {
      freq[char] = (freq[char] || 0) + 1;
    }
    
    let entropy = 0;
    const len = str.length;
    
    for (const count of Object.values(freq)) {
      const p = count / len;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }
  
  /**
   * Check for malicious patterns
   */
  private containsMaliciousPattern(str: string): boolean {
    const maliciousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /setTimeout\s*\(/i,
      /setInterval\s*\(/i,
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
      /import\s*\(/i,
      /require\s*\(/i,
      /\bexec\s*\(/i,
      /\bspawn\s*\(/i,
      /\bsystem\s*\(/i
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(str));
  }
  
  /**
   * Additional checks based on analysis type
   */
  private async checkAnalysisType(
    analysisType: string, 
    content: string | ArrayBuffer
  ): Promise<PreprocessingResult> {
    const result: PreprocessingResult = { safe: true, threats: [] };
    
    switch (analysisType) {
      case 'MALWARE_ANALYSIS':
        // For malware analysis, we're more permissive but still check for injection
        if (typeof content === 'string' && content.includes('ignore previous instructions')) {
          result.safe = false;
          result.threats!.push({
            type: 'analysis_bypass',
            severity: 'high',
            description: 'Attempt to bypass malware analysis'
          });
        }
        break;
        
      case 'CODE_SECURITY_REVIEW':
        // For code review, ensure it's actual code
        if (typeof content === 'string') {
          const codeIndicators = /function|class|import|export|const|let|var|if|for|while/;
          if (!codeIndicators.test(content) && content.length > 100) {
            result.warnings = ['Content does not appear to be code'];
          }
        }
        break;
        
      case 'THREAT_INTELLIGENCE':
        // For threat intel, validate it's structured data or report
        if (typeof content === 'string') {
          const structuredIndicators = /\{|\[|<|IP:|Domain:|Hash:|CVE-|MITRE/;
          if (!structuredIndicators.test(content)) {
            result.warnings = ['Content does not appear to be threat intelligence data'];
          }
        }
        break;
    }
    
    return result;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.initialized = false;
    // WASM modules are managed globally, no need to clean up
  }
}

// Export singleton instance
export const wasmPreprocessor = new WASMPreprocessingPipeline();