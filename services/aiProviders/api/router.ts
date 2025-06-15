/**
 * AI Provider API Router
 * Main Express router for AI provider endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { getOrchestrator, analyzeContent } from '../index';
import { WorkflowExecutor, agentWorkflows, AgentWorkflow } from '../workflows/agent-workflows';
import { logger } from '../../../utils/logger';
import { AnalysisRequest } from '../types';

const router = Router();

// Type for agent workflow keys
type AgentWorkflowKey = keyof typeof agentWorkflows;

// Middleware for API key authentication
function authenticateRequest(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  
  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }
  
  // In production, validate against stored API keys
  // For now, just check if it exists
  if (!apiKey || apiKey.length < 10) {
    res.status(403).json({ error: 'Invalid API key' });
    return;
  }
  
  next();
}

// Rate limiting middleware (simple in-memory implementation)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function rateLimiter(limit: number = 60) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.headers['x-api-key'] as string || req.ip;
    const now = Date.now();
    
    const userLimit = requestCounts.get(key || '');
    
    if (!userLimit || userLimit.resetTime < now) {
      requestCounts.set(key || '', { count: 1, resetTime: now + 60000 }); // 1 minute window
      return next();
    }
    
    if (userLimit.count >= limit) {
      res.status(429).json({ 
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil((userLimit.resetTime - now) / 1000)
      });
      return;
    }
    
    userLimit.count++;
    next();
  };
}

/**
 * Health check endpoint
 * GET /api/v1/health
 */
router.get('/health', async (_req, res): Promise<void> => {
  try {
    const orchestrator = getOrchestrator();
    const providers = await orchestrator.getAvailableProviders();
    
    res.json({
      status: 'healthy',
      providers,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    res.status(503).json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Analyze content endpoint
 * POST /api/v1/analyze
 */
router.post('/analyze',
  authenticateRequest,
  rateLimiter(60),
  async (req, res): Promise<void> => {
    try {
      const {
        content,
        analysisType,
        priority = 'normal',
        strategy = 'specialized',
        metadata = {}
      } = req.body;
      
      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }
      
      // Parse base64 content if provided
      let processedContent = content;
      if (metadata.encoding === 'base64') {
        processedContent = Buffer.from(content, 'base64');
      }
      
      const result = await analyzeContent(processedContent, {
        analysisType,
        priority,
        strategy: strategy as 'single' | 'ensemble' | 'sequential' | 'specialized',
        metadata
      });
      
      res.json(result);
      
    } catch (error: unknown) {
      logger.error('Analysis failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: 'Analysis failed',
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
);

/**
 * Get available workflows endpoint
 * GET /api/v1/workflows
 */
router.get('/workflows',
  authenticateRequest,
  async (_req, res): Promise<void> => {
    try {
      const workflows = Object.entries(agentWorkflows).reduce((acc, [agent, workflows]) => {
        acc[agent] = workflows.map((w: AgentWorkflow) => ({
          name: w.name,
          description: w.description,
          agentId: w.agentId,
          defaultStrategy: w.defaultStrategy
        }));
        return acc;
      }, {} as Record<string, any>);
      
      res.json({
        agents: Object.keys(agentWorkflows),
        workflows,
        totalWorkflows: Object.values(agentWorkflows).flat().length
      });
    } catch (error: unknown) {
      logger.error('Failed to get workflows', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: 'Failed to get workflows',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
      });
    }
  }
);

/**
 * Execute workflow endpoint
 * POST /api/v1/workflow/execute
 */
router.post('/workflow/execute',
  authenticateRequest,
  rateLimiter(30),
  async (req, res): Promise<void> => {
    try {
      const { agent, workflow, input } = req.body;
      
      if (!agent || !workflow || !input) {
        res.status(400).json({ 
          error: 'Missing required fields',
          required: ['agent', 'workflow', 'input']
        });
        return;
      }
      
      const agentKey = agent as AgentWorkflowKey;
      if (!(agentKey in agentWorkflows)) {
        res.status(400).json({ 
          error: 'Invalid agent',
          validAgents: Object.keys(agentWorkflows)
        });
        return;
      }
      
      const workflows = agentWorkflows[agentKey];
      const targetWorkflow = workflows.find((w: AgentWorkflow) => w.name === workflow);
      
      if (!targetWorkflow) {
        res.status(400).json({ 
          error: 'Invalid workflow',
          validWorkflows: workflows.map((w: AgentWorkflow) => w.name)
        });
        return;
      }
      
      const orchestrator = getOrchestrator();
      const executor = new WorkflowExecutor(orchestrator);
      const result = await executor.executeWorkflow(targetWorkflow, input);
      
      res.json({
        agent,
        workflow,
        success: result.success,
        executionTime: result.metadata.duration,
        results: result.results,
        timestamp: new Date().toISOString()
      });
      
    } catch (error: unknown) {
      logger.error('Workflow execution failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: 'Workflow execution failed',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
      });
    }
  }
);

/**
 * Stream analysis endpoint (Server-Sent Events)
 * POST /api/v1/analyze/stream
 */
router.post('/analyze/stream',
  authenticateRequest,
  rateLimiter(30),
  async (req, res): Promise<void> => {
    try {
      const { content, analysisType, strategy = 'specialized' } = req.body;
      
      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }
      
      // Set up SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Parse base64 if needed
      let processedContent = content;
      if (req.body.metadata?.encoding === 'base64') {
        processedContent = Buffer.from(content, 'base64');
      }
      
      // Create analysis stream
      const analysisRequest: AnalysisRequest = {
        id: `stream-${Date.now()}`,
        content: processedContent,
        analysisType,
        priority: 'normal',
        metadata: req.body.metadata || {}
      };
      
      // Stream results
      const orchestrator = getOrchestrator();
      if ('stream' in orchestrator && typeof orchestrator.stream === 'function') {
        const stream = await orchestrator.stream(analysisRequest);
        
        for await (const chunk of stream) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      } else {
        // Fallback to non-streaming
        const result = await analyzeContent(processedContent, {
          analysisType: analysisRequest.analysisType,
          priority: analysisRequest.priority,
          strategy: strategy as 'single' | 'ensemble' | 'sequential' | 'specialized',
          metadata: analysisRequest.metadata
        });
        res.write(`data: ${JSON.stringify(result)}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
      
    } catch (error: unknown) {
      logger.error('Stream analysis failed', { error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error' });
      res.status(500).json({ 
        error: 'Stream analysis failed',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
      });
    }
  }
);

/**
 * Get provider status endpoint
 * GET /api/v1/providers/status
 */
router.get('/providers/status',
  authenticateRequest,
  async (_req, res): Promise<void> => {
    try {
      const orchestrator = getOrchestrator();
      const providers = await orchestrator.getAvailableProviders();
      
      const status = await Promise.all(
        providers.map(async (providerName: string) => {
          try {
            // Get provider instance from orchestrator's internal map
            const providerExists = providers.includes(providerName);
            
            return {
              name: providerName,
              available: providerExists,
              capabilities: [],
              status: providerExists ? 'available' : 'unavailable'
            };
          } catch (error: unknown) {
            return {
              name: providerName,
              available: false,
              capabilities: [],
              status: 'error'
            };
          }
        })
      );
      
      res.json({
        providers: status,
        timestamp: new Date().toISOString()
      });
    } catch (error: unknown) {
      logger.error('Failed to get provider status', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: 'Failed to get provider status',
        message: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : 'Unknown error'
      });
    }
  }
);

export default router;