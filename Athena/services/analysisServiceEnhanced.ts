/**
 * Enhanced Analysis Service with Streaming Support
 * Phase 7: AI Integration Enhancement
 */

import { AIModel, MalwareFile, AnalysisResult, Vulnerability, ContainerConfig } from '@/types';
import { useAppStore } from '@/store';
import { generateId } from '@/utils/helpers';
import { aiServiceManager } from './ai/manager';
import { StreamingAnalysis } from './ai/types';
import * as containerDbService from './container-db';
import * as fileManagerService from './fileManager';
import * as metasploitService from './metasploit';
import { logger } from '@/shared/logging/logger';

// Re-export original service functions for backward compatibility
export * from './analysisService';

/**
 * Analyze malware with streaming support and provider failover
 */
export async function analyzeMalwareStreaming(
  malwareFile: MalwareFile,
  aiModel: AIModel | null,
  containerConfig?: ContainerConfig,
  streamingCallbacks?: Partial<StreamingAnalysis>
): Promise<AnalysisResult> {
  const startTime = Date.now();
  const analysisId = generateId();
  
  try {
    // Get the app store instance
    const store = useAppStore.getState();
    
    // Set analyzing state
    store.setIsAnalyzing(true);
    
    // Initialize progress tracking
    const progress: StreamingAnalysis = {
      onProgress: (percent) => {
        streamingCallbacks?.onProgress?.(percent);
        store.setAnalysisProgress({
          progress: percent,
          stage: 'analyzing',
          message: `Analysis progress: ${percent.toFixed(0)}%`,
          timestamp: Date.now()
        });
      },
      
      onChunk: (chunk) => {
        streamingCallbacks?.onChunk?.(chunk);
        
        if (chunk.type === 'progress' && chunk.data) {
          store.setAnalysisProgress({
            progress: chunk.data.progress || 0,
            stage: chunk.data.stage || 'processing',
            message: chunk.data.message || 'Processing...',
            provider: chunk.data.provider,
            timestamp: chunk.timestamp
          });
        }
      },
      
      onComplete: (result) => {
        streamingCallbacks?.onComplete?.(result);
      },
      
      onError: (error) => {
        streamingCallbacks?.onError?.(error);
        logger.error('Streaming analysis error:', error);
      }
    };
    
    // Get file content
    let fileContent = malwareFile.content || '';
    if (!fileContent && fileManagerService.readFile) {
      try {
        fileContent = await fileManagerService.readFile(malwareFile.uri);
      } catch (error: unknown) {
        logger.error('Error reading file:', error);
      }
    }
    
    // Create container if config provided
    let containerId: string | undefined;
    if (containerConfig && containerDbService.createContainer) {
      try {
        progress.onChunk({
          type: 'progress',
          data: {
            stage: 'container_setup',
            message: 'Setting up isolated container...',
            progress: 10
          },
          timestamp: Date.now()
        });
        
        const container = await containerDbService.createContainer(
          malwareFile.id,
          containerConfig
        );
        
        if (container?.id) {
          containerId = container.id;
          store.addContainer(container);
          
          // Upload malware to container
          await containerDbService.uploadMalwareToContainer(
            container.id,
            malwareFile.name,
            fileContent
          );
          
          // Run analysis in container
          const containerResults = await containerDbService.runMalwareAnalysis(container.id);
          
          // Try to get updated file content from container
          try {
            const containerFileContent = await containerDbService.getContainerFile(
              container.id,
              `/malware/${malwareFile.name}`
            );
            if (containerFileContent) {
              fileContent = containerFileContent;
            }
          } catch (error: unknown) {
            logger.warn('Could not retrieve file from container:', error);
          }
        }
      } catch (error: unknown) {
        logger.error('Container setup error:', error);
        // Continue without container
      }
    }
    
    // Perform AI analysis with streaming and failover
    progress.onChunk({
      type: 'progress',
      data: {
        stage: 'ai_analysis',
        message: 'Starting AI analysis with provider failover...',
        progress: 30
      },
      timestamp: Date.now()
    });
    
    // Analyze for vulnerabilities using the streaming manager
    const vulnerabilityResult = await aiServiceManager.analyzeWithFailover(
      fileContent,
      'vulnerabilities',
      progress
    );
    
    // Deobfuscate code if needed
    let deobfuscationResult = null;
    if (fileContent.includes('eval') || fileContent.includes('Function')) {
      progress.onChunk({
        type: 'progress',
        data: {
          stage: 'deobfuscation',
          message: 'Deobfuscating code...',
          progress: 70
        },
        timestamp: Date.now()
      });
      
      deobfuscationResult = await aiServiceManager.analyzeWithFailover(
        fileContent,
        'deobfuscate',
        progress
      );
    }
    
    // Check for Metasploit modules
    let metasploitModules: string[] = [];
    if ('vulnerabilities' in vulnerabilityResult && vulnerabilityResult.vulnerabilities) {
      progress.onChunk({
        type: 'progress',
        data: {
          stage: 'metasploit_check',
          message: 'Checking for Metasploit modules...',
          progress: 90
        },
        timestamp: Date.now()
      });
      
      for (const vuln of vulnerabilityResult.vulnerabilities) {
        if (vuln.cveId && metasploitService.searchMetasploitModule) {
          try {
            const modules = await metasploitService.searchMetasploitModule(vuln.cveId);
            metasploitModules = metasploitModules.concat(modules);
          } catch (error: unknown) {
            logger.warn('Metasploit search error:', error);
          }
        }
      }
    }
    
    // Clean up container
    if (containerId && containerDbService.stopContainer) {
      try {
        await containerDbService.stopContainer(containerId);
      } catch (error: unknown) {
        logger.error('Error stopping container:', error);
      }
    }
    
    // Create analysis result
    const analysisResult: AnalysisResult = {
      id: analysisId,
      malwareId: malwareFile.id,
      modelId: aiModel?.id || 'ai-manager',
      timestamp: Date.now(),
      deobfuscatedCode: deobfuscationResult ? 
        ('deobfuscatedCode' in deobfuscationResult ? deobfuscationResult.deobfuscatedCode : '') : 
        undefined,
      analysisReport: vulnerabilityResult ? 
        ('analysisReport' in vulnerabilityResult ? vulnerabilityResult.analysisReport : '') : 
        '',
      vulnerabilities: 'vulnerabilities' in vulnerabilityResult ? 
        vulnerabilityResult.vulnerabilities.map((v, index) => ({
          ...v,
          id: `${analysisId}-vuln-${index}`,
          metasploitModule: metasploitModules[index]
        })) : 
        []
    };
    
    // Complete the analysis
    progress.onProgress(100);
    progress.onComplete(analysisResult);
    
    // Add to store
    store.addAnalysisResult(analysisResult);
    store.setIsAnalyzing(false);
    
    logger.info('Streaming analysis completed', {
      analysisId,
      duration: Date.now() - startTime,
      vulnerabilities: analysisResult.vulnerabilities?.length || 0
    });
    
    return analysisResult;
    
  } catch (error: unknown) {
    logger.error('Analysis failed:', error);
    
    const errorResult: AnalysisResult = {
      id: analysisId,
      malwareId: malwareFile.id,
      modelId: aiModel?.id || 'ai-manager',
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    // Update store
    const store = useAppStore.getState();
    store.addAnalysisResult(errorResult);
    store.setIsAnalyzing(false);
    
    throw error;
  }
}

/**
 * Get provider health status
 */
export function getProviderHealthStatus() {
  return {
    providers: Array.from(aiServiceManager.getProviderStatus().entries()).map(([name, health]) => ({
      name,
      ...health
    })),
    circuitBreakers: Array.from(aiServiceManager.getCircuitBreakerStatus().entries()).map(([name, stats]) => ({
      name,
      ...stats
    }))
  };
}