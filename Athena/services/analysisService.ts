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
        fileContent = await fileManagerService.readFileContent(malwareFile.uri);
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
      
      // Run AI deobfuscation
      const deobfuscationResult = await deobfuscateCode(fileContent, model);
      deobfuscatedCode = deobfuscationResult.deobfuscatedCode;
      analysisReport += deobfuscationResult.analysisReport;
      
      // Run vulnerability analysis on the deobfuscated code
      const vulnerabilityResult = await analyzeVulnerabilities(
        deobfuscatedCode || fileContent,
        model
      );
      vulnerabilities = vulnerabilityResult.vulnerabilities;
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
