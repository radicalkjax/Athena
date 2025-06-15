"use strict";
/**
 * AI Provider API Router
 * Main Express router for AI provider endpoints
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const index_1 = require("../index");
const agent_workflows_1 = require("../workflows/agent-workflows");
const logger_1 = require("../../../utils/logger");
const router = (0, express_1.Router)();
// Middleware for API key authentication
function authenticateRequest(req, res, next) {
    var _a;
    const apiKey = req.headers['x-api-key'] || ((_a = req.headers['authorization']) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', ''));
    if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
    }
    // In production, validate against stored API keys
    // For now, just check if it exists
    if (!apiKey || apiKey.length < 10) {
        return res.status(403).json({ error: 'Invalid API key' });
    }
    next();
}
// Rate limiting middleware (simple in-memory implementation)
const requestCounts = new Map();
function rateLimiter(limit = 60) {
    return (req, res, next) => {
        const key = req.headers['x-api-key'] || req.ip;
        const now = Date.now();
        const userLimit = requestCounts.get(key);
        if (!userLimit || userLimit.resetTime < now) {
            requestCounts.set(key, { count: 1, resetTime: now + 60000 }); // 1 minute window
            return next();
        }
        if (userLimit.count >= limit) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
            });
        }
        userLimit.count++;
        next();
    };
}
/**
 * Health check endpoint
 * GET /api/v1/health
 */
router.get('/health', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orchestrator = (0, index_1.getOrchestrator)();
        const status = yield orchestrator.getProviderStatus();
        res.json({
            status: 'healthy',
            providers: Object.fromEntries(status),
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));
/**
 * Analyze content endpoint
 * POST /api/v1/analyze
 */
router.post('/analyze', authenticateRequest, rateLimiter(60), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { content, analysisType, priority = 'normal', strategy = 'specialized', metadata = {} } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        // Parse base64 content if provided
        let processedContent = content;
        if (metadata.encoding === 'base64') {
            processedContent = Buffer.from(content, 'base64');
        }
        const result = yield (0, index_1.analyzeContent)(processedContent, {
            analysisType,
            priority,
            strategy,
            metadata
        });
        res.json(result);
    }
    catch (error) {
        logger_1.logger.error('Analysis failed', { error });
        res.status(500).json({
            error: 'Analysis failed',
            message: error.message
        });
    }
}));
/**
 * List available workflows for an agent
 * GET /api/v1/workflows/:agentId
 */
router.get('/workflows/:agentId', authenticateRequest, (req, res) => {
    const { agentId } = req.params;
    const workflows = agent_workflows_1.agentWorkflows[agentId] || [];
    res.json({
        agentId,
        workflows: workflows.map(w => ({
            id: w.name,
            name: w.name,
            description: w.description,
            steps: w.steps.length,
            defaultStrategy: w.defaultStrategy || 'specialized'
        }))
    });
});
/**
 * Execute a workflow
 * POST /api/v1/workflows/:agentId/:workflowName/execute
 */
router.post('/workflows/:agentId/:workflowName/execute', authenticateRequest, rateLimiter(30), // Lower rate limit for workflow execution
(req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { agentId, workflowName } = req.params;
        const { input, context = {}, options = {} } = req.body;
        if (!input) {
            return res.status(400).json({ error: 'Input is required' });
        }
        const orchestrator = (0, index_1.getOrchestrator)();
        const executor = new agent_workflows_1.WorkflowExecutor(orchestrator);
        // Find the workflow
        const workflows = agent_workflows_1.agentWorkflows[agentId];
        if (!workflows) {
            return res.status(404).json({ error: 'Agent not found' });
        }
        const workflow = workflows.find(w => w.name === workflowName);
        if (!workflow) {
            return res.status(404).json({ error: 'Workflow not found' });
        }
        // Execute workflow
        const result = yield executor.executeWorkflow(workflow, input, context);
        res.json({
            workflowId: `${agentId}/${workflowName}`,
            executionId: result.executionId || `exec-${Date.now()}`,
            result
        });
    }
    catch (error) {
        logger_1.logger.error('Workflow execution failed', { error });
        res.status(500).json({
            error: 'Workflow execution failed',
            message: error.message
        });
    }
}));
/**
 * Stream analysis results
 * POST /api/v1/analyze/stream
 */
router.post('/analyze/stream', authenticateRequest, rateLimiter(30), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    try {
        const { content, analysisType, priority = 'normal', metadata = {} } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        // Set up SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        const orchestrator = (0, index_1.getOrchestrator)();
        const request = {
            id: `stream-${Date.now()}`,
            content,
            analysisType,
            priority,
            metadata
        };
        // Stream results
        const provider = orchestrator.selectBestProvider(request);
        if (!provider.stream) {
            return res.status(400).json({ error: 'Provider does not support streaming' });
        }
        try {
            for (var _d = true, _e = __asyncValues(provider.stream(request)), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                _c = _f.value;
                _d = false;
                const chunk = _c;
                res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
        res.write('data: [DONE]\n\n');
        res.end();
    }
    catch (error) {
        logger_1.logger.error('Stream analysis failed', { error });
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
    }
}));
/**
 * Get provider capabilities
 * GET /api/v1/providers
 */
router.get('/providers', authenticateRequest, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const orchestrator = (0, index_1.getOrchestrator)();
        const providers = orchestrator.getAvailableProviders();
        res.json({
            providers: providers.map(p => ({
                name: p.name,
                capabilities: p.getCapabilities(),
                status: p.status || 'unknown'
            }))
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get providers', { error });
        res.status(500).json({ error: 'Failed to retrieve providers' });
    }
}));
exports.default = router;
