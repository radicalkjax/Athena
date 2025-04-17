import { AIModel, MalwareFile, AnalysisResult, Vulnerability } from '@/types';
import { useAppStore } from '@/store';
import { generateId } from '@/utils/helpers';
import * as openaiService from './openai';
import * as claudeService from './claude';
import * as deepseekService from './deepseek';
import * as localModelsService from './localModels';
import * as containerService from './container';
import * as fileManagerService from './fileManager';
import * as metasploitService from './metasploit';

/**
 * Deobfuscate code using the selected AI model
 * @param code The obfuscated code to analyze
 * @param model The AI model to use
 * @returns Deobfuscated code and analysis
 */
export const deobfuscateCode = async (
  code: string,
  model: AIModel
): Promise<{ deobfuscatedCode: string; analysisReport: string }> => {
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
    throw new Error(`Failed to deobfuscate code: ${(error as Error).message}`);
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
): Promise<{ vulnerabilities: Vulnerability[]; analysisReport: string }> => {
  try {
    let result;
    
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
    throw new Error(`Failed to analyze vulnerabilities: ${(error as Error).message}`);
  }
};

/**
 * Run a full analysis on a malware file
 * @param malwareFile The malware file to analyze
 * @param model The AI model to use
 * @param useContainer Whether to use a container for analysis
 * @returns Analysis result
 */
export const runAnalysis = async (
  malwareFile: MalwareFile,
  model: AIModel,
  useContainer: boolean = true
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
      
      if (useContainer && await containerService.hasContainerConfig()) {
        // Run analysis in container
        try {
          // Create container
          const fileBase64 = await fileManagerService.readFileBase64(malwareFile.uri);
          const container = await containerService.createContainer(
            malwareFile.id,
            fileBase64,
            malwareFile.name
          );
          
          // Add container to store
          useAppStore.getState().addContainer(container);
          
          // Wait for container to be ready
          let status = container.status;
          while (status === 'creating') {
            await new Promise(resolve => setTimeout(resolve, 1000));
            status = await containerService.getContainerStatus(container.id);
            
            // Update container status in store
            useAppStore.getState().updateContainer(container.id, { status });
          }
          
          if (status === 'error') {
            throw new Error('Container creation failed');
          }
          
          // Run malware analysis
          const analysisResults = await containerService.runMalwareAnalysis(container.id);
          
          // Get file content from container if available
          try {
            const containerFileContent = await containerService.getContainerFile(
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
          
          // Add network activity to analysis report
          if (analysisResults.networkActivity.length > 0) {
            analysisReport += `\n\n## Network Activity\n\n`;
            analysisResults.networkActivity.forEach(activity => {
              analysisReport += `- ${activity.protocol} ${activity.destination} (${activity.port})\n`;
            });
          }
          
          // Add file activity to analysis report
          if (analysisResults.fileActivity.length > 0) {
            analysisReport += `\n\n## File Activity\n\n`;
            analysisResults.fileActivity.forEach(activity => {
              analysisReport += `- ${activity.operation} ${activity.path}\n`;
            });
          }
          
          // Remove container when done
          try {
            await containerService.removeContainer(container.id);
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
      
      // Save analysis result to file
      await fileManagerService.saveAnalysisResult(
        resultId,
        `# Analysis Result\n\n## Deobfuscated Code\n\n\`\`\`\n${deobfuscatedCode}\n\`\`\`\n\n## Analysis Report\n\n${analysisReport}`
      );
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
    throw new Error(`Analysis failed: ${(error as Error).message}`);
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
