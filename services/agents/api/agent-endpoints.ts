import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { getAgentManager } from '../agent-manager';
import { AgentRegistration } from '../base/agent-interface';
import { AgentId } from '../base/types';

const router = Router();
const agentManager = getAgentManager();

// Initialize agent manager on startup
agentManager.initialize().catch(console.error);

// Async handler wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => 
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * Register a new external agent
 */
router.post('/agents/register', [
  body('agentId').isString().notEmpty(),
  body('name').isString().notEmpty(),
  body('version').isString().notEmpty(),
  body('endpoint').isURL(),
  body('capabilities').isObject(),
  body('requiredWasmModules').isArray(),
  body('requiredAiProviders').isArray(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const registration: AgentRegistration = req.body;
    const result = await agentManager.registerAgent(registration);

    if (result.success) {
      res.status(200).json({
        success: true,
        token: result.token,
        message: `Agent ${registration.agentId} registered successfully`,
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Agent registration failed',
      });
    }
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}));

/**
 * Agent heartbeat endpoint
 */
router.post('/agents/:agentId/heartbeat', [
  param('agentId').isString().notEmpty(),
  body('token').isString().notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { agentId } = req.params;
    const { token } = req.body;

    const registry = (agentManager as any).registry;
    await registry.heartbeat(agentId as AgentId, token);

    res.status(200).json({
      success: true,
      message: 'Heartbeat recorded',
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Heartbeat failed',
    });
  }
}));

/**
 * Report agent metrics
 */
router.post('/agents/:agentId/metrics', [
  param('agentId').isString().notEmpty(),
  body('token').isString().notEmpty(),
  body('metrics').isObject(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { agentId } = req.params;
    const { metrics } = req.body;

    const registry = (agentManager as any).registry;
    await registry.reportMetrics(agentId as AgentId, metrics);

    res.status(200).json({
      success: true,
      message: 'Metrics recorded',
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Metrics update failed',
    });
  }
}));

/**
 * Get all registered agents
 */
router.get('/agents', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const agents = agentManager.getAgentStatus();
    res.status(200).json({
      success: true,
      agents,
      count: agents.length,
    });
  } catch (error) {
    console.error('Get agents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve agents',
    });
  }
}));

/**
 * Get specific agent status
 */
router.get('/agents/:agentId', [
  param('agentId').isString().notEmpty(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { agentId } = req.params;
    const agents = agentManager.getAgentStatus();
    const agent = agents.find(a => a.agentId === agentId);

    if (agent) {
      res.status(200).json({
        success: true,
        agent,
      });
    } else {
      res.status(404).json({
        success: false,
        message: `Agent ${agentId} not found`,
      });
    }
  } catch (error) {
    console.error('Get agent error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve agent',
    });
  }
}));

/**
 * Execute security analysis
 */
router.post('/analysis', [
  body('type').isIn(['malware', 'network', 'vulnerability', 'incident']),
  body('payload').notEmpty(),
  body('options').optional().isObject(),
], asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { type, payload, options } = req.body;

    const result = await agentManager.executeAnalysis({
      type,
      payload,
      options,
    });

    res.status(200).json({
      success: true,
      summary: result.summary,
      results: Array.from(result.results.entries()).map(([agentId, response]) => ({
        agentId,
        ...response,
      })),
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Analysis failed',
    });
  }
}));

/**
 * Health check all agents
 */
router.get('/agents/health/all', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const healthResults = await agentManager.healthCheckAgents();
    const results = Array.from(healthResults.entries()).map(([agentId, healthy]) => ({
      agentId,
      healthy,
    }));

    res.status(200).json({
      success: true,
      results,
      healthy: results.filter(r => r.healthy).length,
      unhealthy: results.filter(r => !r.healthy).length,
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
    });
  }
}));

/**
 * Get system metrics
 */
router.get('/metrics', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const metrics = agentManager.getMetrics();
    res.status(200).json({
      success: true,
      metrics,
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve metrics',
    });
  }
}));

/**
 * Server-Sent Events endpoint for real-time agent updates
 */
router.get('/agents/events', (req: Request, res: Response) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write('data: {"type": "connected"}\n\n');

  // Subscribe to agent events
  const handlers = {
    'agent:registered': (agentId: AgentId) => {
      res.write(`data: ${JSON.stringify({ event: 'agent:registered', agentId })}\n\n`);
    },
    'agent:unregistered': (agentId: AgentId) => {
      res.write(`data: ${JSON.stringify({ event: 'agent:unregistered', agentId })}\n\n`);
    },
    'agent:unhealthy': (agentId: AgentId) => {
      res.write(`data: ${JSON.stringify({ event: 'agent:unhealthy', agentId })}\n\n`);
    },
    'agent:metrics': (data: any) => {
      res.write(`data: ${JSON.stringify({ event: 'agent:metrics', ...data })}\n\n`);
    },
  };

  // Register event handlers
  Object.entries(handlers).forEach(([event, handler]) => {
    agentManager.on(event, handler);
  });

  // Keep connection alive
  const keepAliveInterval = setInterval(() => {
    res.write(':keep-alive\n\n');
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    // Cleanup event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      agentManager.off(event, handler);
    });
    clearInterval(keepAliveInterval);
    console.log('SSE connection closed');
  });
});

export default router;