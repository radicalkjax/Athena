import { AIModel, MalwareFile, AnalysisResult, Vulnerability, ContainerConfig } from '@/types';
import { useAppStore } from '@/store';
import { generateId } from '@/utils/helpers';
import * as openaiService from './openai';
import * as claudeService from './claude';
import * as deepseekService from './deepseek';
import * as localModelsService from './localModels';
import * as containerDbService from './container-db';
import * as fileManagerService from './fileManager';
import * as metasploitService from './metasploit';
import { 
  analysisEngine, 
  initializeAnalysisEngine, 
  AnalysisResult as WASMAnalysisResult, 
  ThreatInfo,
  WASMError,
  WASMErrorCode,
  isHighSeverity
} from '../../wasm-modules/bridge';
import { createFileProcessor, IFileProcessor } from '../../wasm-modules/bridge/file-processor-bridge';
import { getPatternMatcher, PatternMatcherBridge } from '../../wasm-modules/bridge/pattern-matcher-bridge';
import { DeobfuscatorBridge } from '../../wasm-modules/bridge/deobfuscator-bridge';

// Type definitions
interface DeobfuscationResult {
  deobfuscatedCode: string;
  analysisReport: string;
}

interface VulnerabilityAnalysisResult {
  vulnerabilities: Vulnerability[];
  analysisReport: string;
}

interface NetworkActivity {
  protocol: string;
  destination: string;
  port: number;
}

interface FileActivity {
  operation: string;
  path: string;
}

interface ContainerAnalysisResults {
  logs: string;
  networkActivity: NetworkActivity[];
  fileActivity: FileActivity[];
}

// Utility function for promise-based delays
const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

// WASM Analysis Integration
let wasmInitialized = false;
let fileProcessor: IFileProcessor | null = null;
let patternMatcher: PatternMatcherBridge | null = null;
let deobfuscator: DeobfuscatorBridge | null = null;

const ensureWASMInitialized = async (): Promise<void> => {
  if (!wasmInitialized) {
    try {
      // Initialize all WASM modules in parallel
      const initPromises: Promise<void>[] = [
        initializeAnalysisEngine()
      ];

      // Initialize file processor
      fileProcessor = createFileProcessor({
        minStringLength: 4,
        extractMetadata: true,
        deepAnalysis: true
      });
      initPromises.push(fileProcessor.initialize());

      // Initialize pattern matcher
      patternMatcher = getPatternMatcher();
      initPromises.push(patternMatcher.initialize());

      // Initialize deobfuscator
      deobfuscator = DeobfuscatorBridge.getInstance();
      initPromises.push(deobfuscator.initialize());

      await Promise.all(initPromises);
      
      wasmInitialized = true;
      console.log('All WASM modules initialized successfully');
    } catch (error) {
      if (error instanceof WASMError) {
        console.error(`WASM initialization failed with code ${error.code}:`, error.message);
      } else {
        console.error('Failed to initialize WASM modules:', error);
      }
      throw new Error('WASM initialization failed');
    }
  }
};

/**
 * Convert WASM threat info to vulnerability format
 */
const convertThreatToVulnerability = (threat: ThreatInfo, index: number): Vulnerability => {
  return {
    id: generateId(),
    name: threat.threat_type,
    severity: threat.confidence > 0.8 ? 'high' : threat.confidence > 0.5 ? 'medium' : 'low',
    description: threat.description,
    cveId: '',
    affectedVersions: [],
    fixedVersions: [],
    references: threat.indicators.map(indicator => `Indicator: ${indicator}`),
    exploitAvailable: threat.confidence > 0.8,
    patchAvailable: false,
  };
};

/**
 * Run WASM-powered analysis on file content using all Phase 2 modules
 */
const runWASMAnalysis = async (fileContent: string, fileName: string): Promise<{
  deobfuscatedCode: string;
  analysisReport: string;
  vulnerabilities: Vulnerability[];
}> => {
  await ensureWASMInitialized();
  
  if (!fileProcessor || !patternMatcher || !deobfuscator) {
    throw new Error('WASM modules not properly initialized');
  }
  
  try {
    // Convert string to ArrayBuffer
    const encoder = new TextEncoder();
    const arrayBuffer = encoder.encode(fileContent).buffer;
    
    const startTime = Date.now();
    let analysisReport = `## WASM Analysis Report\n\n`;
    let vulnerabilities: Vulnerability[] = [];
    let deobfuscatedContent = fileContent;
    
    // Phase 1: File Processing
    analysisReport += `### File Processing\n\n`;
    try {
      const [fileFormat, parsedFile] = await Promise.all([
        fileProcessor.detectFormat(arrayBuffer, fileName),
        fileProcessor.parseFile(arrayBuffer)
      ]);
      
      analysisReport += `**File Format:** ${fileFormat.format} (confidence: ${(fileFormat.confidence * 100).toFixed(1)}%)\n`;
      analysisReport += `**MIME Type:** ${fileFormat.mime_type}\n`;
      
      if (parsedFile.metadata) {
        analysisReport += `**File Size:** ${parsedFile.metadata.size} bytes\n`;
        if (parsedFile.metadata.hashes?.sha256) {
          analysisReport += `**SHA256:** ${parsedFile.metadata.hashes.sha256}\n`;
        }
      }
      
      if (parsedFile.suspicious_indicators.length > 0) {
        analysisReport += `\n**Suspicious Indicators:**\n`;
        parsedFile.suspicious_indicators.forEach(indicator => {
          analysisReport += `- ${indicator}\n`;
        });
      }
      
      analysisReport += `\n`;
    } catch (fpError) {
      console.error('File processing error:', fpError);
      analysisReport += `File processing failed: ${fpError.message}\n\n`;
    }
    
    // Phase 2: Pattern Matching
    analysisReport += `### Pattern Matching\n\n`;
    try {
      const scanResult = await patternMatcher.scan(arrayBuffer);
      
      analysisReport += `**Threat Score:** ${scanResult.threat_score}/100\n`;
      analysisReport += `**Matches Found:** ${scanResult.matches.length}\n`;
      
      if (scanResult.has_malware) {
        analysisReport += `**⚠️ MALWARE DETECTED**\n`;
      }
      
      if (scanResult.matches.length > 0) {
        analysisReport += `\n**Pattern Matches:**\n`;
        scanResult.matches.forEach(match => {
          analysisReport += `- **${match.rule_name}** (severity: ${match.severity})\n`;
          analysisReport += `  - Pattern: ${match.pattern_name}\n`;
          if (match.metadata && Object.keys(match.metadata).length > 0) {
            analysisReport += `  - Metadata: ${JSON.stringify(match.metadata)}\n`;
          }
          
          // Convert pattern match to vulnerability
          vulnerabilities.push({
            id: generateId(),
            name: match.rule_name,
            severity: match.severity === 'critical' ? 'high' : match.severity as 'high' | 'medium' | 'low',
            description: `Pattern match: ${match.pattern_name}`,
            cveId: '',
            affectedVersions: [],
            fixedVersions: [],
            references: [],
            exploitAvailable: match.severity === 'critical',
            patchAvailable: false,
          });
        });
      }
      
      analysisReport += `\n`;
    } catch (pmError) {
      console.error('Pattern matching error:', pmError);
      analysisReport += `Pattern matching failed: ${pmError.message}\n\n`;
    }
    
    // Phase 3: Deobfuscation
    analysisReport += `### Deobfuscation Analysis\n\n`;
    try {
      // First detect obfuscation
      const obfuscationDetection = await deobfuscator.detectObfuscation(fileContent);
      
      if (obfuscationDetection.isObfuscated) {
        analysisReport += `**Obfuscation Detected:** Yes\n`;
        analysisReport += `**Confidence:** ${(obfuscationDetection.confidence * 100).toFixed(1)}%\n`;
        analysisReport += `**Techniques:** ${obfuscationDetection.techniques.join(', ')}\n\n`;
        
        // Perform deobfuscation
        const deobResult = await deobfuscator.deobfuscate(fileContent);
        
        if (deobResult.success) {
          deobfuscatedContent = deobResult.deobfuscated;
          analysisReport += `**Deobfuscation Successful**\n`;
          analysisReport += `**Layers Processed:** ${deobResult.layers.length}\n`;
          
          if (deobResult.layers.length > 0) {
            analysisReport += `\n**Deobfuscation Layers:**\n`;
            deobResult.layers.forEach((layer, idx) => {
              analysisReport += `${idx + 1}. ${layer.technique} (confidence: ${(layer.confidence * 100).toFixed(1)}%)\n`;
            });
          }
          
          if (deobResult.warnings.length > 0) {
            analysisReport += `\n**Warnings:**\n`;
            deobResult.warnings.forEach(warning => {
              analysisReport += `- ${warning}\n`;
            });
          }
        } else {
          analysisReport += `**Deobfuscation Failed:** ${deobResult.error || 'Unknown error'}\n`;
        }
      } else {
        analysisReport += `**Obfuscation Detected:** No\n`;
      }
      
      // Extract IOCs from deobfuscated content
      const iocs = await deobfuscator.extractIOCs(deobfuscatedContent);
      if (iocs.length > 0) {
        analysisReport += `\n**Indicators of Compromise (IOCs):**\n`;
        iocs.forEach(ioc => {
          analysisReport += `- ${ioc}\n`;
        });
      }
      
      analysisReport += `\n`;
    } catch (deobError) {
      console.error('Deobfuscation error:', deobError);
      analysisReport += `Deobfuscation failed: ${deobError.message}\n\n`;
    }
    
    // Phase 4: Original Analysis Engine (for backward compatibility)
    analysisReport += `### Core Analysis Engine\n\n`;
    try {
      // Convert deobfuscated content to ArrayBuffer for analysis engine
      const deobArrayBuffer = encoder.encode(deobfuscatedContent).buffer;
      
      const wasmResult = await analysisEngine.analyze(deobArrayBuffer, {
        enableDeobfuscation: false, // Already deobfuscated
        patternSets: ['malware', 'exploits', 'backdoors']
      });
      
      analysisReport += `**Engine Version:** ${wasmResult.metadata.engine_version}\n`;
      analysisReport += `**Severity:** ${wasmResult.severity.toUpperCase()}\n`;
      
      if (wasmResult.threats.length > 0) {
        analysisReport += `\n**Detected Threats:**\n`;
        wasmResult.threats.forEach((threat, index) => {
          analysisReport += `${index + 1}. **${threat.threat_type}** (Confidence: ${(threat.confidence * 100).toFixed(1)}%)\n`;
          analysisReport += `   - ${threat.description}\n`;
          if (threat.indicators.length > 0) {
            analysisReport += `   - Indicators:\n`;
            threat.indicators.forEach(indicator => {
              analysisReport += `     - ${indicator}\n`;
            });
          }
          analysisReport += `\n`;
        });
        
        // Add core engine vulnerabilities
        vulnerabilities.push(...wasmResult.threats.map(convertThreatToVulnerability));
      }
    } catch (coreError) {
      console.error('Core analysis engine error:', coreError);
      analysisReport += `Core analysis failed: ${coreError.message}\n`;
    }
    
    const analysisTime = Date.now() - startTime;
    analysisReport = `**Total Analysis Time:** ${analysisTime}ms\n\n` + analysisReport;
    
    // Deduplicate vulnerabilities
    const uniqueVulnerabilities = new Map<string, Vulnerability>();
    vulnerabilities.forEach(vuln => {
      const key = `${vuln.name}-${vuln.description}`;
      if (!uniqueVulnerabilities.has(key) || 
          (vuln.severity === 'high' && uniqueVulnerabilities.get(key)?.severity !== 'high')) {
        uniqueVulnerabilities.set(key, vuln);
      }
    });
    
    return {
      deobfuscatedCode: deobfuscatedContent,
      analysisReport,
      vulnerabilities: Array.from(uniqueVulnerabilities.values())
    };
  } catch (error) {
    if (error instanceof WASMError) {
      console.error(`WASM analysis failed with code ${error.code}:`, error.message);
      
      // Handle specific error codes
      switch (error.code) {
        case WASMErrorCode.TimeoutError:
          throw new Error('WASM analysis timed out. File may be too complex.');
        case WASMErrorCode.InvalidInput:
          throw new Error('Invalid file content for WASM analysis.');
        default:
          throw new Error(`WASM analysis failed: ${error.message}`);
      }
    } else {
      console.error('WASM analysis error:', error);
      throw new Error(`WASM analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

// Error handling utilities
class AnalysisError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'AnalysisError';
  }
}

const handleError = (error: unknown, context: string): never => {
  const err = error instanceof Error ? error : new Error(String(error));
  throw new AnalysisError(`${context}: ${err.message}`, err);
};

/**
 * Deobfuscate code using the selected AI model
 * @param code The obfuscated code to analyze
 * @param model The AI model to use
 * @returns Deobfuscated code and analysis
 */
export const deobfuscateCode = async (
  code: string,
  model: AIModel
): Promise<DeobfuscationResult> => {
  try {
    switch (model.type) {
      case 'openai':
        return await openaiService.deobfuscateCode(code, model.modelId);
      case 'claude':
        return await claudeService.deobfuscateCode(code, model.modelId);
      case 'deepseek':
        return await deepseekService.deobfuscateCode(code, model.modelId);
      case 'local':
        return await localModelsService.deobfuscateCode(code, model.id);
      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
  } catch (error) {
    console.error('Deobfuscation error:', error);
    handleError(error, 'Failed to deobfuscate code');
  }
};

/**
 * Analyze code for vulnerabilities using the selected AI model
 * @param code The code to analyze
 * @param model The AI model to use
 * @returns Vulnerability analysis
 */
export const analyzeVulnerabilities = async (
  code: string,
  model: AIModel
): Promise<VulnerabilityAnalysisResult> => {
  try {
    let result: VulnerabilityAnalysisResult;
    
    switch (model.type) {
      case 'openai':
        result = await openaiService.analyzeVulnerabilities(code, model.modelId);
        break;
      case 'claude':
        result = await claudeService.analyzeVulnerabilities(code, model.modelId);
        break;
      case 'deepseek':
        result = await deepseekService.analyzeVulnerabilities(code, model.modelId);
        break;
      case 'local':
        result = await localModelsService.analyzeVulnerabilities(code, model.id);
        break;
      default:
        throw new Error(`Unsupported model type: ${model.type}`);
    }
    
    // Enrich vulnerability data with Metasploit information if available
    try {
      if (await metasploitService.hasMetasploitConfig()) {
        result.vulnerabilities = await metasploitService.enrichVulnerabilityData(result.vulnerabilities);
      }
    } catch (error) {
      console.error('Error enriching vulnerability data:', error);
      // Continue without enrichment if it fails
    }
    
    return result;
  } catch (error) {
    console.error('Vulnerability analysis error:', error);
    handleError(error, 'Failed to analyze vulnerabilities');
  }
};

/**
 * Run a full analysis on a malware file
 * @param malwareFile The malware file to analyze
 * @param model The AI model to use
 * @param useContainer This parameter is kept for backward compatibility but is always true
 * @param containerConfig Optional container configuration
 * @returns Analysis result
 */
export const runAnalysis = async (
  malwareFile: MalwareFile,
  model: AIModel,
  useContainer: boolean = true,
  containerConfig?: ContainerConfig
): Promise<AnalysisResult> => {
  try {
    // Set analyzing state
    useAppStore.getState().setIsAnalyzing(true);
    
    // Create a new analysis result
    const resultId = generateId();
    const timestamp = Date.now();
    
    let deobfuscatedCode = '';
    let analysisReport = '';
    let vulnerabilities: Vulnerability[] = [];
    let error = '';
    
    try {
      // Get file content
      let fileContent = malwareFile.content || '';
      
      if (!fileContent) {
        fileContent = await fileManagerService.readFileAsText(malwareFile.uri);
      }
      
      if (useContainer && await containerDbService.hasContainerConfig()) {
        // Run analysis in container
        try {
          // Create container
          const fileBase64 = await fileManagerService.readFileAsBase64(malwareFile.uri);
          const container = await containerDbService.createContainer(
            malwareFile.id,
            fileBase64,
            malwareFile.name,
            containerConfig
          );
          
          // Convert database container model to store container model
          const storeContainer = {
            ...container,
            createdAt: container.createdAt instanceof Date ? container.createdAt.getTime() : Date.now(),
            updatedAt: container.updatedAt instanceof Date ? container.updatedAt.getTime() : Date.now(),
          };
          
          // Add container to store
          useAppStore.getState().addContainer(storeContainer);
          
          // Wait for container to be ready
          let status = container.status;
          while (status === 'creating') {
            await delay(1000);
            status = await containerDbService.getContainerStatus(container.id);
            
            // Update container status in store
            useAppStore.getState().updateContainer(container.id, { status });
          }
          
          if (status === 'error') {
            throw new Error('Container creation failed');
          }
          
          // Run malware analysis
          const analysisResults = await containerDbService.runMalwareAnalysis(container.id) as ContainerAnalysisResults;
          
          // Get file content from container if available
          try {
            const containerFileContent = await containerDbService.getContainerFile(
              container.id,
              `/malware/${malwareFile.name}`
            );
            
            if (containerFileContent) {
              fileContent = containerFileContent;
            }
          } catch (error) {
            console.error('Error getting file from container:', error);
            // Continue with original file content
          }
          
          // Add container logs to analysis report
          analysisReport += `\n\n## Container Analysis\n\n${analysisResults.logs}\n\n`;
          
          // Get monitoring summary
          try {
            const monitoringSummary = await containerDbService.getContainerMonitoringSummary(container.id);
            analysisReport += `\n\n## Container Monitoring Summary\n\n`;
            analysisReport += `- Average CPU Usage: ${monitoringSummary.averageCpuUsage.toFixed(2)}%\n`;
            analysisReport += `- Average Memory Usage: ${monitoringSummary.averageMemoryUsage.toFixed(2)} MB\n`;
            analysisReport += `- Total Network Inbound: ${monitoringSummary.totalNetworkInbound} bytes\n`;
            analysisReport += `- Total Network Outbound: ${monitoringSummary.totalNetworkOutbound} bytes\n`;
            analysisReport += `- Total File Operations: ${monitoringSummary.totalFileOperations}\n`;
            analysisReport += `- Total Processes: ${monitoringSummary.totalProcesses}\n`;
            analysisReport += `- Suspicious Activity Count: ${monitoringSummary.suspiciousActivityCount}\n`;
          } catch (monitoringError) {
            const error = monitoringError instanceof Error ? monitoringError : new Error(String(monitoringError));
            console.error('Error getting monitoring summary:', error);
            analysisReport += `\n\n## Container Monitoring\n\nUnable to retrieve monitoring data: ${error.message}\n\n`;
          }
          
          // Get suspicious activities
          try {
            const suspiciousActivities = await containerDbService.getSuspiciousActivities(container.id);
            
            if (suspiciousActivities.networkActivities.length > 0 || 
                suspiciousActivities.fileActivities.length > 0 || 
                suspiciousActivities.processActivities.length > 0) {
              
              analysisReport += `\n\n## Suspicious Activities\n\n`;
              
              if (suspiciousActivities.networkActivities.length > 0) {
                analysisReport += `### Suspicious Network Activities\n\n`;
                suspiciousActivities.networkActivities.forEach(activity => {
                  analysisReport += `- ${activity.protocol} ${activity.sourceIp}:${activity.sourcePort} -> ${activity.destinationIp}:${activity.destinationPort} (${activity.direction})\n`;
                  analysisReport += `  Process: ${activity.processName} (PID: ${activity.processId})\n`;
                  analysisReport += `  Reason: ${activity.maliciousReason}\n\n`;
                });
              }
              
              if (suspiciousActivities.fileActivities.length > 0) {
                analysisReport += `### Suspicious File Activities\n\n`;
                suspiciousActivities.fileActivities.forEach(activity => {
                  analysisReport += `- ${activity.operation} ${activity.filePath} (${activity.fileType})\n`;
                  analysisReport += `  Process: ${activity.processName} (PID: ${activity.processId})\n`;
                  analysisReport += `  Reason: ${activity.maliciousReason}\n\n`;
                });
              }
              
              if (suspiciousActivities.processActivities.length > 0) {
                analysisReport += `### Suspicious Process Activities\n\n`;
                suspiciousActivities.processActivities.forEach(activity => {
                  analysisReport += `- ${activity.processName} (PID: ${activity.processId})\n`;
                  analysisReport += `  Command: ${activity.commandLine}\n`;
                  analysisReport += `  User: ${activity.user}\n`;
                  analysisReport += `  Status: ${activity.status}\n`;
                  analysisReport += `  Reason: ${activity.maliciousReason}\n\n`;
                });
              }
            }
          } catch (suspiciousActivitiesError) {
            console.error('Error getting suspicious activities:', suspiciousActivitiesError);
          }
          
          // Add network activity to analysis report
          if (analysisResults.networkActivity.length > 0) {
            analysisReport += `\n\n## Network Activity\n\n`;
            analysisResults.networkActivity.forEach((activity) => {
              analysisReport += `- ${activity.protocol} ${activity.destination} (${activity.port})\n`;
            });
          }
          
          // Add file activity to analysis report
          if (analysisResults.fileActivity.length > 0) {
            analysisReport += `\n\n## File Activity\n\n`;
            analysisResults.fileActivity.forEach((activity) => {
              analysisReport += `- ${activity.operation} ${activity.path}\n`;
            });
          }
          
          // Get detailed monitoring data
          try {
            // Get network activity
            const networkActivities = await containerDbService.getNetworkActivityByContainerId(container.id, 10);
            if (networkActivities.length > 0) {
              analysisReport += `\n\n## Detailed Network Activity\n\n`;
              networkActivities.forEach(activity => {
                analysisReport += `- ${activity.timestamp.toISOString()} | ${activity.protocol} | ${activity.sourceIp}:${activity.sourcePort} -> ${activity.destinationIp}:${activity.destinationPort} | ${activity.status}\n`;
              });
            }
            
            // Get file activity
            const fileActivities = await containerDbService.getFileActivityByContainerId(container.id, 10);
            if (fileActivities.length > 0) {
              analysisReport += `\n\n## Detailed File Activity\n\n`;
              fileActivities.forEach(activity => {
                analysisReport += `- ${activity.timestamp.toISOString()} | ${activity.operation} | ${activity.filePath} | ${activity.processName}\n`;
              });
            }
            
            // Get process activity
            const processActivities = await containerDbService.getProcessActivityByContainerId(container.id, 10);
            if (processActivities.length > 0) {
              analysisReport += `\n\n## Detailed Process Activity\n\n`;
              processActivities.forEach(activity => {
                analysisReport += `- ${activity.timestamp.toISOString()} | ${activity.processName} (PID: ${activity.processId}) | ${activity.status} | ${activity.commandLine.substring(0, 50)}${activity.commandLine.length > 50 ? '...' : ''}\n`;
              });
            }
          } catch (detailedMonitoringError) {
            console.error('Error getting detailed monitoring data:', detailedMonitoringError);
          }
          
          // Remove container when done
          try {
            await containerDbService.removeContainer(container.id);
            useAppStore.getState().removeContainer(container.id);
          } catch (error) {
            console.error('Error removing container:', error);
            // Continue with analysis even if container removal fails
          }
        } catch (error) {
          const containerError = error as Error;
          console.error('Container analysis error:', containerError);
          analysisReport += `\n\nContainer analysis failed: ${containerError.message}\n\n`;
          // Continue with AI analysis even if container analysis fails
        }
      }
      
      // First, run WASM analysis for fast pattern detection
      try {
        const wasmAnalysis = await runWASMAnalysis(fileContent, malwareFile.name);
        analysisReport += `\n\n## WASM Engine Analysis\n\n${wasmAnalysis.analysisReport}`;
        
        // Use WASM deobfuscated content if available
        if (wasmAnalysis.deobfuscatedCode !== fileContent) {
          fileContent = wasmAnalysis.deobfuscatedCode;
          analysisReport += `\n\n### Deobfuscation Applied\n\nThe WASM engine successfully deobfuscated the content.\n`;
        }
        
        // Add WASM-detected vulnerabilities
        vulnerabilities.push(...wasmAnalysis.vulnerabilities);
      } catch (wasmError) {
        console.error('WASM analysis failed, continuing with AI analysis:', wasmError);
        analysisReport += `\n\n## WASM Analysis\n\nWASM analysis failed: ${wasmError.message}\n`;
      }
      
      // Run AI deobfuscation for additional insights
      const deobfuscationResult = await deobfuscateCode(fileContent, model);
      deobfuscatedCode = deobfuscationResult.deobfuscatedCode;
      analysisReport += `\n\n## AI Analysis\n\n${deobfuscationResult.analysisReport}`;
      
      // Run vulnerability analysis on the deobfuscated code
      const vulnerabilityResult = await analyzeVulnerabilities(
        deobfuscatedCode || fileContent,
        model
      );
      
      // Merge vulnerabilities from both analyses
      const aiVulnerabilities = vulnerabilityResult.vulnerabilities;
      
      // Deduplicate vulnerabilities by name
      const uniqueVulnerabilities = new Map<string, Vulnerability>();
      [...vulnerabilities, ...aiVulnerabilities].forEach(vuln => {
        if (!uniqueVulnerabilities.has(vuln.name) || 
            (vuln.severity === 'high' && uniqueVulnerabilities.get(vuln.name)?.severity !== 'high')) {
          uniqueVulnerabilities.set(vuln.name, vuln);
        }
      });
      
      vulnerabilities = Array.from(uniqueVulnerabilities.values());
      analysisReport += `\n\n## Vulnerability Analysis\n\n${vulnerabilityResult.analysisReport}`;
      
      // TODO: Implement saveAnalysisResult in fileManager service if needed
      // Currently, analysis results are stored in the app state
    } catch (analysisError) {
      console.error('Analysis error:', analysisError);
      error = (analysisError as Error).message;
    }
    
    // Create analysis result
    const result: AnalysisResult = {
      id: resultId,
      malwareId: malwareFile.id,
      modelId: model.id,
      timestamp,
      deobfuscatedCode,
      analysisReport,
      vulnerabilities,
      error,
    };
    
    // Add result to store
    useAppStore.getState().addAnalysisResult(result);
    
    // Reset analyzing state
    useAppStore.getState().setIsAnalyzing(false);
    
    return result;
  } catch (error) {
    // Reset analyzing state
    useAppStore.getState().setIsAnalyzing(false);
    
    console.error('Analysis service error:', error);
    handleError(error, 'Analysis failed');
  }
};

/**
 * Run WASM analysis directly (for testing and benchmarking)
 * @param fileContent The file content to analyze
 * @param fileName The name of the file
 * @returns Analysis results from WASM engine
 */
export const analyzeWithWASM = async (
  fileContent: string,
  fileName: string = 'unknown'
): Promise<{
  deobfuscatedCode: string;
  analysisReport: string;
  vulnerabilities: Vulnerability[];
}> => {
  return runWASMAnalysis(fileContent, fileName);
};

/**
 * Get WASM module statistics
 * @returns Statistics from all WASM modules
 */
export const getWASMStats = async (): Promise<{
  initialized: boolean;
  patternMatcherStats?: {
    rulesLoaded: number;
    totalScans: number;
    totalMatches: number;
    avgScanTime: number;
  };
  deobfuscatorConfig?: {
    maxLayers: number;
    timeoutMs: number;
    enableMlPredictions: boolean;
  };
}> => {
  await ensureWASMInitialized();
  
  const stats: any = {
    initialized: wasmInitialized
  };
  
  if (patternMatcher) {
    const pmStats = patternMatcher.getStats();
    stats.patternMatcherStats = {
      rulesLoaded: patternMatcher.getRuleCount(),
      totalScans: pmStats.totalScans,
      totalMatches: pmStats.totalMatches,
      avgScanTime: pmStats.avgScanTime
    };
  }
  
  if (deobfuscator) {
    stats.deobfuscatorConfig = await deobfuscator.getConfig();
  }
  
  return stats;
};

/**
 * Get available AI models
 * @returns Array of available AI models
 */
export const getAvailableModels = async (): Promise<AIModel[]> => {
  const models = useAppStore.getState().aiModels;
  const availableModels: AIModel[] = [];
  
  console.log('Checking available models from store:', models.length);
  
  for (const model of models) {
    try {
      console.log(`Checking model ${model.name} (${model.type}), isLocal: ${model.isLocal}`);
      
      if (model.isLocal) {
        // Skip local models
        console.log(`Skipping local model ${model.name}`);
      } else {
        // Check if API key is available for hosted models
        let hasApiKey = false;
        
        switch (model.type) {
          case 'openai':
            hasApiKey = await openaiService.hasOpenAIApiKey();
            console.log(`OpenAI model ${model.name} has API key: ${hasApiKey}`);
            break;
          case 'claude':
            hasApiKey = await claudeService.hasClaudeApiKey();
            console.log(`Claude model ${model.name} has API key: ${hasApiKey}`);
            break;
          case 'deepseek':
            hasApiKey = await deepseekService.hasDeepSeekApiKey();
            console.log(`DeepSeek model ${model.name} has API key: ${hasApiKey}`);
            break;
        }
        
        if (hasApiKey) {
          console.log(`Adding model ${model.name} to available models`);
          availableModels.push(model);
        } else {
          console.log(`Model ${model.name} is not available (no API key)`);
        }
      }
    } catch (error) {
      console.error(`Error checking model ${model.name}:`, error);
      // Skip this model if there's an error
    }
  }
  
  console.log(`Returning ${availableModels.length} available models`);
  return availableModels;
};
