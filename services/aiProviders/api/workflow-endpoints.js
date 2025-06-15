"use strict";
/**
 * API Endpoints for Agent Workflow Execution
 * External agents call these endpoints to execute their workflows
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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const orchestrator_1 = require("../orchestrator");
const agent_workflows_1 = require("../workflows/agent-workflows");
const auth_1 = require("../middleware/auth");
const validation_1 = require("../middleware/validation");
const rateLimit_1 = require("../middleware/rateLimit");
const logger_1 = require("@/utils/logger");
const router = (0, express_1.Router)();
const orchestrator = new orchestrator_1.AIOrchestrator( /* config */);
const workflowExecutor = new agent_workflows_1.WorkflowExecutor(orchestrator);
/**
 * List available workflows for an agent
 * GET /api/v1/workflows/:agentId
 */
router.get('/workflows/:agentId', auth_1.authenticateAgent, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { agentId } = req.params;
    try {
        const workflows = agent_workflows_1.agentWorkflows[agentId] || [];
        res.json({
            agentId,
            workflows: workflows.map(w => ({
                id: w.name,
                name: w.name,
                description: w.description,
                steps: w.steps.length,
                defaultStrategy: w.defaultStrategy
            }))
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to list workflows', { error, agentId });
        res.status(500).json({ error: 'Failed to retrieve workflows' });
    }
}));
/**
 * Execute a specific workflow
 * POST /api/v1/workflows/:agentId/:workflowId/execute
 */
router.post('/workflows/:agentId/:workflowId/execute', auth_1.authenticateAgent, auth_1.authorizeWorkflow, rateLimit_1.rateLimiter, validation_1.validateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { agentId, workflowId } = req.params;
    const input = req.body;
    try {
        // Find the workflow
        const agentFlows = agent_workflows_1.agentWorkflows[agentId];
        const workflow = agentFlows === null || agentFlows === void 0 ? void 0 : agentFlows.find(w => w.name === workflowId);
        if (!workflow) {
            return res.status(404).json({
                error: 'Workflow not found',
                agentId,
                workflowId
            });
        }
        // Execute workflow
        logger_1.logger.info('Executing workflow', { agentId, workflowId });
        const result = yield workflowExecutor.executeWorkflow(workflow, input);
        // Log metrics
        logger_1.logger.info('Workflow completed', {
            agentId,
            workflowId,
            success: result.success,
            duration: result.metadata.duration,
            cost: result.metadata.cost
        });
        res.json({
            success: result.success,
            workflowId: result.workflowId,
            results: result.results.map(r => {
                var _a, _b, _c;
                return ({
                    stepId: r.stepId,
                    success: r.success,
                    confidence: (_a = r.result) === null || _a === void 0 ? void 0 : _a.confidence,
                    threats: (_b = r.result) === null || _b === void 0 ? void 0 : _b.threats,
                    error: (_c = r.error) === null || _c === void 0 ? void 0 : _c.message
                });
            }),
            metadata: result.metadata
        });
    }
    catch (error) {
        logger_1.logger.error('Workflow execution failed', {
            error,
            agentId,
            workflowId
        });
        res.status(500).json({
            error: 'Workflow execution failed',
            message: error.message
        });
    }
}));
/**
 * Execute a custom workflow (not predefined)
 * POST /api/v1/workflows/execute
 */
router.post('/workflows/execute', auth_1.authenticateAgent, rateLimit_1.rateLimiter, validation_1.validateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { workflow, input } = req.body;
    try {
        // Validate custom workflow structure
        if (!isValidWorkflow(workflow)) {
            return res.status(400).json({
                error: 'Invalid workflow structure'
            });
        }
        // Execute custom workflow
        const result = yield workflowExecutor.executeWorkflow(workflow, input);
        res.json({
            success: result.success,
            results: result.results,
            metadata: result.metadata
        });
    }
    catch (error) {
        logger_1.logger.error('Custom workflow execution failed', { error });
        res.status(500).json({
            error: 'Workflow execution failed',
            message: error.message
        });
    }
}));
/**
 * Get workflow execution status (for long-running workflows)
 * GET /api/v1/workflows/status/:executionId
 */
router.get('/workflows/status/:executionId', auth_1.authenticateAgent, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { executionId } = req.params;
    try {
        // In a real implementation, this would check a job queue
        const status = yield getWorkflowStatus(executionId);
        res.json(status);
    }
    catch (error) {
        res.status(404).json({
            error: 'Execution not found'
        });
    }
}));
/**
 * Stream workflow execution results
 * SSE endpoint for real-time updates
 * GET /api/v1/workflows/:agentId/:workflowId/stream
 */
router.get('/workflows/:agentId/:workflowId/stream', auth_1.authenticateAgent, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const { agentId, workflowId } = req.params;
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
        const agentFlows = agent_workflows_1.agentWorkflows[agentId];
        const workflow = agentFlows === null || agentFlows === void 0 ? void 0 : agentFlows.find(w => w.name === workflowId);
        if (!workflow) {
            res.write(`event: error\ndata: ${JSON.stringify({
                error: 'Workflow not found'
            })}\n\n`);
            return res.end();
        }
        try {
            // Execute workflow with streaming
            for (var _d = true, _e = __asyncValues(executeWorkflowStream(workflow, req.body)), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                _c = _f.value;
                _d = false;
                const update = _c;
                res.write(`event: ${update.type}\ndata: ${JSON.stringify(update)}\n\n`);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        res.write('event: complete\ndata: {}\n\n');
        res.end();
    }
    catch (error) {
        res.write(`event: error\ndata: ${JSON.stringify({
            error: error.message
        })}\n\n`);
        res.end();
    }
}));
/**
 * Collaborative workflow execution
 * POST /api/v1/workflows/collaborative/:workflowId/execute
 */
router.post('/workflows/collaborative/:workflowId/execute', auth_1.authenticateAgent, rateLimit_1.rateLimiter, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { workflowId } = req.params;
    const { agents, input } = req.body;
    try {
        // Verify all required agents are authenticated
        const requiredAgents = getRequiredAgents(workflowId);
        const missingAgents = requiredAgents.filter(a => !agents.includes(a));
        if (missingAgents.length > 0) {
            return res.status(403).json({
                error: 'Missing required agents',
                required: requiredAgents,
                missing: missingAgents
            });
        }
        // Find collaborative workflow
        const workflow = agent_workflows_1.agentWorkflows.collaborative.find(w => w.name === workflowId);
        if (!workflow) {
            return res.status(404).json({
                error: 'Collaborative workflow not found'
            });
        }
        // Execute collaborative workflow
        const result = yield workflowExecutor.executeWorkflow(workflow, input);
        res.json({
            success: result.success,
            workflow: workflowId,
            participatingAgents: agents,
            results: result.results,
            metadata: result.metadata
        });
    }
    catch (error) {
        logger_1.logger.error('Collaborative workflow failed', {
            error,
            workflowId
        });
        res.status(500).json({
            error: 'Collaborative workflow execution failed'
        });
    }
}));
/**
 * Helper functions
 */
function isValidWorkflow(workflow) {
    return workflow
        && workflow.agentId
        && workflow.name
        && Array.isArray(workflow.steps)
        && workflow.steps.length > 0;
}
function getWorkflowStatus(executionId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Mock implementation - would check real job queue
        return {
            executionId,
            status: 'running',
            progress: 0.6,
            currentStep: 'behavioral_analysis',
            startTime: new Date().toISOString(),
            estimatedCompletion: new Date(Date.now() + 5000).toISOString()
        };
    });
}
function executeWorkflowStream(workflow, input) {
    return __asyncGenerator(this, arguments, function* executeWorkflowStream_1() {
        // Mock streaming implementation
        for (const step of workflow.steps) {
            yield yield __await({
                type: 'step_start',
                stepId: step.id,
                stepName: step.name
            });
            // Simulate processing
            yield __await(new Promise(resolve => setTimeout(resolve, 1000)));
            yield yield __await({
                type: 'step_complete',
                stepId: step.id,
                result: { confidence: 0.85 }
            });
        }
    });
}
function getRequiredAgents(workflowId) {
    const agentMap = {
        'threat_discovery_chain': ['doru', 'aegis', 'weaver', 'owl'],
        'code_audit_chain': ['forge', 'owl', 'weaver'],
        'incident_response_chain': ['aegis', 'polis', 'doru']
    };
    return agentMap[workflowId] || [];
}
exports.default = router;
