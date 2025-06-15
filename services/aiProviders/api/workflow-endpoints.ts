/**
 * API Endpoints for Agent Workflow Execution
 * External agents call these endpoints to execute their workflows
 */

import { Router, Request, Response } from 'express';
import { WorkflowExecutor, agentWorkflows, AgentWorkflow } from '../workflows/agent-workflows';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimit } from '../middleware/rateLimit';
import { logger } from '../../../utils/logger';
import { getOrchestrator } from '../index';

const router = Router();

/**
 * List available workflows for an agent
 * GET /api/v1/workflows/:agentId
 */
router.get('/workflows/:agentId', 
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { agentId } = req.params;
    
    try {
      const workflows = agentWorkflows[agentId as keyof typeof agentWorkflows] || [];
      
      res.json({
        agentId,
        workflows: workflows.map((w: AgentWorkflow) => ({
          id: w.name,
          name: w.name,
          description: w.description,
          steps: w.steps.length,
          defaultStrategy: w.defaultStrategy
        }))
      });
    } catch (error: unknown) {
      logger.error('Failed to list workflows', { error, agentId });
      res.status(500).json({ error: 'Failed to retrieve workflows' });
    }
  }
);

/**
 * Execute a specific workflow
 * POST /api/v1/workflows/:agentId/:workflowId/execute
 */
router.post('/workflows/:agentId/:workflowId/execute',
  authenticate,
  rateLimit(30),
  validateRequest([
    { field: 'input', required: true, type: 'object' }
  ]),
  async (req: Request, res: Response): Promise<void> => {
    const { agentId, workflowId } = req.params;
    const input = req.body;
    
    try {
      // Find the workflow
      const agentFlows = agentWorkflows[agentId as keyof typeof agentWorkflows];
      const workflow = agentFlows?.find((w: AgentWorkflow) => w.name === workflowId);
      
      if (!workflow) {
        res.status(404).json({ 
          error: 'Workflow not found',
          agentId,
          workflowId 
        });
        return;
      }
      
      // Execute workflow
      logger.info('Executing workflow', { agentId, workflowId });
      
      const orchestrator = getOrchestrator();
      const workflowExecutor = new WorkflowExecutor(orchestrator);
      const result = await workflowExecutor.executeWorkflow(workflow, input);
      
      // Log metrics
      logger.info('Workflow completed', {
        agentId,
        workflowId,
        success: result.success,
        duration: result.metadata.duration,
        cost: result.metadata.cost
      });
      
      res.json({
        success: result.success,
        workflowId: result.workflowId,
        results: result.results.map((r: any) => ({
          stepId: r.stepId,
          success: r.success,
          confidence: r.result?.confidence,
          threats: r.result?.threats,
          error: r.error?.message
        })),
        metadata: result.metadata
      });
      
    } catch (error: unknown) {
      logger.error('Workflow execution failed', { 
        error, 
        agentId, 
        workflowId 
      });
      
      res.status(500).json({ 
        error: 'Workflow execution failed',
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
);

/**
 * Execute a custom workflow (not predefined)
 * POST /api/v1/workflows/execute
 */
router.post('/workflows/execute',
  authenticate,
  rateLimit(30),
  validateRequest([
    { field: 'workflow', required: true, type: 'object' },
    { field: 'input', required: true, type: 'object' }
  ]),
  async (req: Request, res: Response): Promise<void> => {
    const { workflow, input } = req.body;
    
    try {
      // Validate custom workflow structure
      if (!isValidWorkflow(workflow)) {
        res.status(400).json({ 
          error: 'Invalid workflow structure' 
        });
        return;
      }
      
      // Execute custom workflow
      const orchestrator = getOrchestrator();
      const workflowExecutor = new WorkflowExecutor(orchestrator);
      const result = await workflowExecutor.executeWorkflow(
        workflow as AgentWorkflow,
        input
      );
      
      res.json({
        success: result.success,
        results: result.results,
        metadata: result.metadata
      });
      
    } catch (error: unknown) {
      logger.error('Custom workflow execution failed', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ 
        error: 'Workflow execution failed',
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  }
);

/**
 * Get workflow execution status (for long-running workflows)
 * GET /api/v1/workflows/status/:executionId
 */
router.get('/workflows/status/:executionId',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { executionId } = req.params;
    
    try {
      // In a real implementation, this would check a job queue
      const status = await getWorkflowStatus(executionId);
      
      res.json(status);
    } catch (error: unknown) {
      res.status(404).json({ 
        error: 'Execution not found' 
      });
    }
  }
);

/**
 * Stream workflow execution results
 * SSE endpoint for real-time updates
 * GET /api/v1/workflows/:agentId/:workflowId/stream
 */
router.get('/workflows/:agentId/:workflowId/stream',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const { agentId, workflowId } = req.params;
    
    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      const agentFlows = agentWorkflows[agentId as keyof typeof agentWorkflows];
      const workflow = agentFlows?.find((w: AgentWorkflow) => w.name === workflowId);
      
      if (!workflow) {
        res.write(`event: error\ndata: ${JSON.stringify({ 
          error: 'Workflow not found' 
        })}\n\n`);
        res.end();
        return;
      }
      
      // Execute workflow with streaming
      for await (const update of executeWorkflowStream(workflow, req.body)) {
        res.write(`event: ${update.type}\ndata: ${JSON.stringify(update)}\n\n`);
      }
      
      res.write('event: complete\ndata: {}\n\n');
      res.end();
      
    } catch (error: unknown) {
      res.write(`event: error\ndata: ${JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error" 
      })}\n\n`);
      res.end();
    }
  }
);

/**
 * Collaborative workflow execution
 * POST /api/v1/workflows/collaborative/:workflowId/execute
 */
router.post('/workflows/collaborative/:workflowId/execute',
  authenticate,
  rateLimit(10),
  async (req: Request, res: Response): Promise<void> => {
    const { workflowId } = req.params;
    const { agents, input } = req.body;
    
    try {
      // Verify all required agents are authenticated
      const requiredAgents = getRequiredAgents(workflowId);
      const missingAgents = requiredAgents.filter(a => !agents.includes(a));
      
      if (missingAgents.length > 0) {
        res.status(403).json({
          error: 'Missing required agents',
          required: requiredAgents,
          missing: missingAgents
        });
        return;
      }
      
      // Find collaborative workflow
      const workflow = agentWorkflows.collaborative.find(
        (w: AgentWorkflow) => w.name === workflowId
      );
      
      if (!workflow) {
        res.status(404).json({ 
          error: 'Collaborative workflow not found' 
        });
        return;
      }
      
      // Execute collaborative workflow
      const orchestrator = getOrchestrator();
      const workflowExecutor = new WorkflowExecutor(orchestrator);
      const result = await workflowExecutor.executeWorkflow(workflow, input);
      
      res.json({
        success: result.success,
        workflow: workflowId,
        participatingAgents: agents,
        results: result.results,
        metadata: result.metadata
      });
      
    } catch (error: unknown) {
      logger.error('Collaborative workflow failed', { 
        error, 
        workflowId 
      });
      
      res.status(500).json({ 
        error: 'Collaborative workflow execution failed' 
      });
    }
  }
);

/**
 * Helper functions
 */
function isValidWorkflow(workflow: any): boolean {
  return workflow 
    && workflow.agentId 
    && workflow.name 
    && Array.isArray(workflow.steps)
    && workflow.steps.length > 0;
}

async function getWorkflowStatus(executionId: string) {
  // Mock implementation - would check real job queue
  return {
    executionId,
    status: 'running',
    progress: 0.6,
    currentStep: 'behavioral_analysis',
    startTime: new Date().toISOString(),
    estimatedCompletion: new Date(Date.now() + 5000).toISOString()
  };
}

async function* executeWorkflowStream(workflow: AgentWorkflow, input: any) {
  // Mock streaming implementation
  for (const step of workflow.steps) {
    yield {
      type: 'step_start',
      stepId: step.id,
      stepName: step.name
    };
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    yield {
      type: 'step_complete',
      stepId: step.id,
      result: { confidence: 0.85 }
    };
  }
}

function getRequiredAgents(workflowId: string): string[] {
  const agentMap: Record<string, string[]> = {
    'threat_discovery_chain': ['doru', 'aegis', 'weaver', 'owl'],
    'code_audit_chain': ['forge', 'owl', 'weaver'],
    'incident_response_chain': ['aegis', 'polis', 'doru']
  };
  
  return agentMap[workflowId] || [];
}

export default router;