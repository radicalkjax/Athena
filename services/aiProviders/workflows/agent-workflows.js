"use strict";
/**
 * Agent-Specific AI Workflows
 * Defines how each of the six agents (OWL, WEAVER, AEGIS, FORGE, POLIS, DORU)
 * should interact with AI providers through Athena
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentWorkflows = exports.WorkflowExecutor = exports.collaborativeWorkflows = exports.polisWorkflows = exports.forgeWorkflows = exports.weaverWorkflows = exports.owlWorkflows = exports.aegisWorkflows = exports.doruWorkflows = void 0;
/**
 * DORU (Malware RE) Agent Workflows
 */
exports.doruWorkflows = [
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
exports.aegisWorkflows = [
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
                validate: (result) => result.threats && result.threats.length > 0
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
exports.owlWorkflows = [
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
exports.weaverWorkflows = [
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
exports.forgeWorkflows = [
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
exports.polisWorkflows = [
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
exports.collaborativeWorkflows = [
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
class WorkflowExecutor {
    constructor(orchestrator) {
        this.orchestrator = orchestrator;
    }
    executeWorkflow(workflow, input) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            let currentInput = input;
            for (const step of workflow.steps) {
                try {
                    // Transform input for this step
                    const request = step.transform
                        ? step.transform(currentInput)
                        : currentInput;
                    // Execute with appropriate strategy
                    const strategy = step.strategy || workflow.defaultStrategy;
                    const result = yield this.orchestrator.analyze(request, strategy);
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
                    currentInput = Object.assign(Object.assign({}, currentInput), { [`${step.id}Results`]: result });
                }
                catch (error) {
                    // Handle error based on step configuration
                    const errorResult = yield this.handleStepError(step, error, currentInput);
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
        });
    }
    handleStepError(step, error, input) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    validateWorkflow(workflow, results) {
        const validation = workflow.validation || {};
        const passed = results.every(r => r.success || r.skipped);
        return {
            passed,
            confidence: this.calculateConfidence(results),
            latency: this.calculateDuration(results),
            cost: this.calculateCost(results)
        };
    }
    calculateConfidence(results) {
        const confidences = results
            .filter(r => { var _a; return (_a = r.result) === null || _a === void 0 ? void 0 : _a.confidence; })
            .map(r => r.result.confidence);
        return confidences.length > 0
            ? confidences.reduce((a, b) => a + b) / confidences.length
            : 0;
    }
    calculateDuration(results) {
        return results.reduce((sum, r) => { var _a, _b; return sum + (((_b = (_a = r.result) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.latency) || 0); }, 0);
    }
    calculateCost(results) {
        return results.reduce((sum, r) => { var _a, _b; return sum + (((_b = (_a = r.result) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.cost) || 0); }, 0);
    }
}
exports.WorkflowExecutor = WorkflowExecutor;
// Export all workflows
exports.agentWorkflows = {
    doru: exports.doruWorkflows,
    aegis: exports.aegisWorkflows,
    owl: exports.owlWorkflows,
    weaver: exports.weaverWorkflows,
    forge: exports.forgeWorkflows,
    polis: exports.polisWorkflows,
    collaborative: exports.collaborativeWorkflows
};
