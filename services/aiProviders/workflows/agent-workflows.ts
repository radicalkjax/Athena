/**
 * Agent-Specific AI Workflows
 * Defines how each of the six agents (OWL, WEAVER, AEGIS, FORGE, POLIS, DORU)
 * should interact with AI providers through Athena
 */

import { AIOrchestrator, OrchestrationStrategy } from '../orchestrator';
import { AnalysisRequest, AnalysisResult } from '../types';

export interface AgentWorkflow {
  agentId: string;
  name: string;
  description: string;
  defaultStrategy: OrchestrationStrategy;
  steps: WorkflowStep[];
  validation?: WorkflowValidation;
}

export interface WorkflowStep {
  id: string;
  name: string;
  provider?: string;
  strategy?: OrchestrationStrategy;
  transform?: (input: any) => AnalysisRequest;
  validate?: (result: AnalysisResult) => boolean;
  onError?: 'retry' | 'fallback' | 'skip' | 'fail';
}

export interface WorkflowValidation {
  requiredConfidence?: number;
  requiredProviders?: number;
  maxLatency?: number;
  maxCost?: number;
}

/**
 * DORU (Malware RE) Agent Workflows
 */
export const doruWorkflows: AgentWorkflow[] = [
  {
    agentId: 'doru',
    name: 'malware_deep_analysis',
    description: 'Comprehensive malware analysis with behavioral extraction',
    defaultStrategy: { type: 'sequential' },
    steps: [
      {
        id: 'initial_detection',
        name: 'Initial Malware Detection',
        provider: 'deepseek',
        transform: (input) => ({
          id: `doru-${Date.now()}`,
          content: input.sample,
          analysisType: 'MALWARE_ANALYSIS',
          options: {
            model: 'deepseek-coder-33b',
            temperature: 0.1
          }
        })
      },
      {
        id: 'behavioral_analysis',
        name: 'Behavioral Pattern Extraction',
        provider: 'claude',
        transform: (input) => ({
          id: `doru-behavior-${Date.now()}`,
          content: input.executionTrace,
          context: input.previousResults,
          analysisType: 'BEHAVIORAL_ANALYSIS',
          options: {
            model: 'claude-3-opus-20240229',
            temperature: 0.3
          }
        })
      },
      {
        id: 'family_classification',
        name: 'Malware Family Classification',
        strategy: { type: 'ensemble', providers: ['deepseek', 'openai'] },
        transform: (input) => ({
          id: `doru-classify-${Date.now()}`,
          content: JSON.stringify(input.features),
          analysisType: 'CLASSIFICATION',
          priority: 'high'
        })
      }
    ],
    validation: {
      requiredConfidence: 0.8,
      maxLatency: 10000
    }
  }
];

/**
 * AEGIS (Threat Analysis) Agent Workflows
 */
export const aegisWorkflows: AgentWorkflow[] = [
  {
    agentId: 'aegis',
    name: 'incident_response_chain',
    description: 'Full incident response workflow',
    defaultStrategy: { type: 'specialized' },
    steps: [
      {
        id: 'threat_identification',
        name: 'Identify Threat Actors',
        strategy: { 
          type: 'ensemble', 
          providers: ['claude', 'openai'],
          consensusThreshold: 0.7
        },
        transform: (input) => ({
          id: `aegis-threat-${Date.now()}`,
          content: input.incidentData,
          analysisType: 'THREAT_INTELLIGENCE',
          priority: 'critical'
        })
      },
      {
        id: 'ioc_extraction',
        name: 'Extract IOCs',
        provider: 'deepseek',
        transform: (input) => ({
          id: `aegis-ioc-${Date.now()}`,
          content: input.artifacts,
          analysisType: 'IOC_EXTRACTION'
        }),
        validate: (result) => !!(result.threats && result.threats.length > 0)
      },
      {
        id: 'attack_chain',
        name: 'Reconstruct Attack Chain',
        provider: 'claude',
        transform: (input) => ({
          id: `aegis-chain-${Date.now()}`,
          content: JSON.stringify(input.timeline),
          context: input.iocs,
          analysisType: 'ATTACK_CHAIN_ANALYSIS'
        })
      }
    ],
    validation: {
      requiredProviders: 2,
      requiredConfidence: 0.85
    }
  }
];

/**
 * OWL (Security Testing) Agent Workflows
 */
export const owlWorkflows: AgentWorkflow[] = [
  {
    agentId: 'owl',
    name: 'vulnerability_assessment',
    description: 'Comprehensive vulnerability scanning and assessment',
    defaultStrategy: { type: 'ensemble' },
    steps: [
      {
        id: 'code_scan',
        name: 'Static Code Analysis',
        provider: 'claude',
        transform: (input) => ({
          id: `owl-scan-${Date.now()}`,
          content: input.sourceCode,
          analysisType: 'CODE_SECURITY_REVIEW',
          options: {
            model: 'claude-3-opus-20240229',
            maxTokens: 4000
          }
        })
      },
      {
        id: 'vulnerability_ranking',
        name: 'Rank Vulnerabilities',
        strategy: { 
          type: 'ensemble',
          providers: ['claude', 'openai', 'deepseek']
        },
        transform: (input) => ({
          id: `owl-rank-${Date.now()}`,
          content: JSON.stringify(input.vulnerabilities),
          analysisType: 'VULNERABILITY_ASSESSMENT',
          priority: 'high'
        })
      }
    ]
  }
];

/**
 * WEAVER (Security Design) Agent Workflows
 */
export const weaverWorkflows: AgentWorkflow[] = [
  {
    agentId: 'weaver',
    name: 'threat_modeling',
    description: 'Architecture threat modeling and risk assessment',
    defaultStrategy: { type: 'sequential' },
    steps: [
      {
        id: 'architecture_analysis',
        name: 'Analyze System Architecture',
        provider: 'claude',
        transform: (input) => ({
          id: `weaver-arch-${Date.now()}`,
          content: input.architectureDiagram,
          analysisType: 'ARCHITECTURE_REVIEW',
          options: {
            temperature: 0.2
          }
        })
      },
      {
        id: 'threat_identification',
        name: 'Identify Potential Threats',
        strategy: { 
          type: 'ensemble',
          providers: ['claude', 'openai']
        },
        transform: (input) => ({
          id: `weaver-threats-${Date.now()}`,
          content: input.systemDescription,
          context: input.architectureAnalysis,
          analysisType: 'THREAT_MODELING'
        })
      },
      {
        id: 'risk_scoring',
        name: 'Calculate Risk Scores',
        provider: 'openai',
        transform: (input) => ({
          id: `weaver-risk-${Date.now()}`,
          content: JSON.stringify(input.threats),
          analysisType: 'RISK_ASSESSMENT',
          options: {
            model: 'gpt-4-turbo'
          }
        })
      }
    ]
  }
];

/**
 * FORGE (Secure Development) Agent Workflows
 */
export const forgeWorkflows: AgentWorkflow[] = [
  {
    agentId: 'forge',
    name: 'secure_code_review',
    description: 'Comprehensive secure code review workflow',
    defaultStrategy: { type: 'specialized' },
    steps: [
      {
        id: 'vulnerability_scan',
        name: 'Scan for Vulnerabilities',
        provider: 'claude',
        transform: (input) => ({
          id: `forge-vuln-${Date.now()}`,
          content: input.code,
          analysisType: 'CODE_SECURITY_REVIEW',
          priority: 'high'
        })
      },
      {
        id: 'dependency_check',
        name: 'Check Dependencies',
        provider: 'openai',
        transform: (input) => ({
          id: `forge-deps-${Date.now()}`,
          content: input.packageManifest,
          analysisType: 'DEPENDENCY_ANALYSIS'
        })
      },
      {
        id: 'secure_patterns',
        name: 'Suggest Secure Patterns',
        provider: 'deepseek',
        transform: (input) => ({
          id: `forge-patterns-${Date.now()}`,
          content: input.vulnerableCode,
          context: input.vulnerabilities,
          analysisType: 'SECURE_CODING_SUGGESTIONS'
        })
      }
    ]
  }
];

/**
 * POLIS (SRE Security) Agent Workflows
 */
export const polisWorkflows: AgentWorkflow[] = [
  {
    agentId: 'polis',
    name: 'infrastructure_monitoring',
    description: 'Infrastructure security monitoring and analysis',
    defaultStrategy: { type: 'ensemble' },
    steps: [
      {
        id: 'log_analysis',
        name: 'Analyze Security Logs',
        provider: 'deepseek',
        transform: (input) => ({
          id: `polis-logs-${Date.now()}`,
          content: input.logs,
          analysisType: 'LOG_ANALYSIS',
          options: {
            temperature: 0.1
          }
        })
      },
      {
        id: 'anomaly_detection',
        name: 'Detect Anomalies',
        strategy: {
          type: 'ensemble',
          providers: ['claude', 'deepseek']
        },
        transform: (input) => ({
          id: `polis-anomaly-${Date.now()}`,
          content: JSON.stringify(input.metrics),
          context: input.baseline,
          analysisType: 'ANOMALY_DETECTION'
        })
      },
      {
        id: 'compliance_check',
        name: 'Check Compliance',
        provider: 'openai',
        transform: (input) => ({
          id: `polis-compliance-${Date.now()}`,
          content: input.configuration,
          analysisType: 'COMPLIANCE_ANALYSIS',
          options: {
            model: 'gpt-4-turbo'
          }
        })
      }
    ]
  }
];

/**
 * Collaborative Workflows (Multi-Agent)
 */
export const collaborativeWorkflows: AgentWorkflow[] = [
  {
    agentId: 'multi-agent',
    name: 'threat_discovery_chain',
    description: 'DORU → AEGIS → WEAVER → OWL threat discovery',
    defaultStrategy: { type: 'sequential' },
    steps: [
      {
        id: 'doru_analysis',
        name: 'DORU: Malware Analysis',
        provider: 'deepseek',
        transform: (input) => ({
          id: `collab-doru-${Date.now()}`,
          content: input.malwareSample,
          analysisType: 'MALWARE_ANALYSIS'
        })
      },
      {
        id: 'aegis_correlation',
        name: 'AEGIS: Threat Correlation',
        provider: 'claude',
        transform: (input) => ({
          id: `collab-aegis-${Date.now()}`,
          content: input.doruFindings,
          analysisType: 'THREAT_INTELLIGENCE',
          context: input.threatFeeds
        })
      },
      {
        id: 'weaver_modeling',
        name: 'WEAVER: Attack Modeling',
        provider: 'claude',
        transform: (input) => ({
          id: `collab-weaver-${Date.now()}`,
          content: JSON.stringify(input.attackPattern),
          analysisType: 'THREAT_MODELING'
        })
      },
      {
        id: 'owl_testing',
        name: 'OWL: Validation Testing',
        strategy: {
          type: 'ensemble',
          providers: ['claude', 'openai']
        },
        transform: (input) => ({
          id: `collab-owl-${Date.now()}`,
          content: input.testVectors,
          analysisType: 'SECURITY_TESTING'
        })
      }
    ],
    validation: {
      requiredConfidence: 0.9,
      maxLatency: 30000
    }
  }
];

/**
 * Workflow Executor
 */
export class WorkflowExecutor {
  constructor(private orchestrator: AIOrchestrator) {}

  async executeWorkflow(
    workflow: AgentWorkflow,
    input: any
  ): Promise<WorkflowResult> {
    const results: StepResult[] = [];
    let currentInput = input;
    
    for (const step of workflow.steps) {
      try {
        // Transform input for this step
        const request = step.transform 
          ? step.transform(currentInput)
          : currentInput;
        
        // Execute with appropriate strategy
        const strategy = step.strategy || workflow.defaultStrategy;
        const result = await this.orchestrator.analyze(request, strategy);
        
        // Validate if needed
        if (step.validate && !step.validate(result)) {
          throw new Error(`Validation failed for step: ${step.name}`);
        }
        
        results.push({
          stepId: step.id,
          success: true,
          result
        });
        
        // Prepare input for next step
        currentInput = {
          ...currentInput,
          [`${step.id}Results`]: result
        };
        
      } catch (error: unknown) {
        // Handle error based on step configuration
        const errorResult = await this.handleStepError(step, error, currentInput);
        results.push(errorResult);
        
        if (errorResult.fatal) {
          break;
        }
      }
    }
    
    // Validate overall workflow
    const validation = this.validateWorkflow(workflow, results);
    
    return {
      workflowId: workflow.name,
      agentId: workflow.agentId,
      success: validation.passed,
      results,
      validation,
      metadata: {
        duration: this.calculateDuration(results),
        cost: this.calculateCost(results)
      }
    };
  }
  
  private async handleStepError(
    step: WorkflowStep,
    error: any,
    input: any
  ): Promise<StepResult> {
    switch (step.onError) {
      case 'retry':
        // Implement retry logic
        return { stepId: step.id, success: false, error, fatal: false };
      
      case 'fallback':
        // Try fallback provider
        return { stepId: step.id, success: false, error, fatal: false };
      
      case 'skip':
        // Skip this step
        return { stepId: step.id, success: false, skipped: true, fatal: false };
      
      case 'fail':
      default:
        // Fail the workflow
        return { stepId: step.id, success: false, error, fatal: true };
    }
  }
  
  private validateWorkflow(
    workflow: AgentWorkflow,
    results: StepResult[]
  ): ValidationResult {
    const validation = workflow.validation || {};
    const passed = results.every(r => r.success || r.skipped);
    
    return {
      passed,
      confidence: this.calculateConfidence(results),
      latency: this.calculateDuration(results),
      cost: this.calculateCost(results)
    };
  }
  
  private calculateConfidence(results: StepResult[]): number {
    const confidences = results
      .filter(r => r.result?.confidence)
      .map(r => r.result!.confidence!);
    
    return confidences.length > 0
      ? confidences.reduce((a, b) => a + b) / confidences.length
      : 0;
  }
  
  private calculateDuration(results: StepResult[]): number {
    return results.reduce((sum, r) => 
      sum + (r.result?.metadata?.latency || 0), 0
    );
  }
  
  private calculateCost(results: StepResult[]): number {
    return results.reduce((sum, r) => 
      sum + (r.result?.metadata?.cost || 0), 0
    );
  }
}

// Types
interface StepResult {
  stepId: string;
  success: boolean;
  result?: AnalysisResult;
  error?: any;
  skipped?: boolean;
  fatal?: boolean;
}

interface WorkflowResult {
  workflowId: string;
  agentId: string;
  success: boolean;
  results: StepResult[];
  validation: ValidationResult;
  metadata: {
    duration: number;
    cost: number;
  };
}

interface ValidationResult {
  passed: boolean;
  confidence: number;
  latency: number;
  cost: number;
}

// Export all workflows
export const agentWorkflows = {
  doru: doruWorkflows,
  aegis: aegisWorkflows,
  owl: owlWorkflows,
  weaver: weaverWorkflows,
  forge: forgeWorkflows,
  polis: polisWorkflows,
  collaborative: collaborativeWorkflows
};