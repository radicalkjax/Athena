import { Component, createSignal, createMemo, For, Show, onMount } from 'solid-js';
import { createStore, produce } from 'solid-js/store';
import './CustomWorkflows.css';
import { jobService, type ProgressUpdate } from '../../../services/jobService';
import { analysisStore } from '../../../stores/analysisStore';

interface WorkflowNode {
  id: string;
  type: 'analysis' | 'condition' | 'action' | 'output';
  name: string;
  config: any;
  position: { x: number; y: number };
  inputs: string[];
  outputs: string[];
}

interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
  fromPort: string;
  toPort: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: Date;
  updatedAt: Date;
}

const analysisNodes = [
  { type: 'static', name: 'Static Analysis', icon: '🔍' },
  { type: 'yara', name: 'YARA Scanner', icon: '🎯' },
  { type: 'wasm', name: 'WASM Analysis', icon: '⚡' },
  { type: 'ai', name: 'AI Analysis', icon: '🤖' },
  { type: 'network', name: 'Network Analysis', icon: '🌐' },
  { type: 'behavioral', name: 'Behavioral Analysis', icon: '🔬' },
];

const conditionNodes = [
  { type: 'threshold', name: 'Score Threshold', icon: '📊' },
  { type: 'pattern', name: 'Pattern Match', icon: '🔎' },
  { type: 'time', name: 'Time Condition', icon: '⏰' },
];

const actionNodes = [
  { type: 'alert', name: 'Send Alert', icon: '🚨' },
  { type: 'quarantine', name: 'Quarantine File', icon: '🔒' },
  { type: 'report', name: 'Generate Report', icon: '📄' },
  { type: 'api', name: 'API Call', icon: '🔌' },
];

const CustomWorkflows: Component = () => {
  const [workflows, setWorkflows] = createStore<Workflow[]>([]);
  const [isDesigning, setIsDesigning] = createSignal(false);

  // Use signals for canvas nodes/connections for reactivity
  const [canvasNodes, setCanvasNodes] = createSignal<WorkflowNode[]>([]);
  const [canvasConnections, setCanvasConnections] = createSignal<WorkflowConnection[]>([]);
  const [workflowName, setWorkflowName] = createSignal('New Workflow');
  const [workflowId, setWorkflowId] = createSignal('');

  // Keep store for workflow metadata
  const [currentWorkflow, setCurrentWorkflow] = createStore<Workflow>({
    id: '',
    name: '',
    description: '',
    nodes: [],
    connections: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const [selectedNode, setSelectedNode] = createSignal<WorkflowNode | null>(null);
  const [, setConnecting] = createSignal(false);
  const [connectionStart, setConnectionStart] = createSignal<{node: string, port: string} | null>(null);
  const [runningJobId, setRunningJobId] = createSignal<string | null>(null);
  const [executionProgress, setExecutionProgress] = createSignal(0);
  const [executionMessage, setExecutionMessage] = createSignal('');

  // Palette selection - click to select, click canvas to place
  const [selectedPaletteNode, setSelectedPaletteNode] = createSignal<any>(null);

  // Canvas node dragging state
  const [draggingNodeId, setDraggingNodeId] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });

  let canvasRef: HTMLDivElement | undefined;

  onMount(() => {
    loadWorkflows();
  });

  const loadWorkflows = () => {
    // Load saved workflows from storage
    const saved = localStorage.getItem('athena-workflows');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate that parsed data is an array of workflows
        if (!Array.isArray(parsed)) {
          console.warn('Invalid workflows format: expected array');
          localStorage.removeItem('athena-workflows');
        } else {
          // Validate each workflow has required fields
          const validWorkflows = parsed.filter((w: unknown) => {
            if (typeof w !== 'object' || w === null) return false;
            const workflow = w as Record<string, unknown>;
            return typeof workflow.id === 'string' &&
                   typeof workflow.name === 'string' &&
                   Array.isArray(workflow.nodes);
          });
          setWorkflows(validWorkflows);
          return;
        }
      } catch (err) {
        console.warn('Failed to parse saved workflows:', err);
        localStorage.removeItem('athena-workflows');
      }
    }
    // Fall through to default workflows if parsing fails or no saved data
    {
      // Add default workflows
      setWorkflows([
        {
          id: 'default-malware',
          name: 'Malware Detection',
          description: 'Comprehensive malware analysis workflow',
          nodes: [
            {
              id: 'node1',
              type: 'analysis',
              name: 'Static Analysis',
              config: { type: 'static' },
              position: { x: 100, y: 100 },
              inputs: [],
              outputs: ['score', 'threats']
            },
            {
              id: 'node2',
              type: 'condition',
              name: 'High Risk Check',
              config: { threshold: 70 },
              position: { x: 300, y: 100 },
              inputs: ['score'],
              outputs: ['true', 'false']
            },
            {
              id: 'node3',
              type: 'action',
              name: 'Alert Security',
              config: { type: 'alert', severity: 'high' },
              position: { x: 500, y: 50 },
              inputs: ['trigger'],
              outputs: []
            }
          ],
          connections: [
            {
              id: 'conn1',
              from: 'node1',
              to: 'node2',
              fromPort: 'score',
              toPort: 'score'
            },
            {
              id: 'conn2',
              from: 'node2',
              to: 'node3',
              fromPort: 'true',
              toPort: 'trigger'
            }
          ],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    }
  };

  const saveWorkflows = () => {
    localStorage.setItem('athena-workflows', JSON.stringify(workflows));
  };

  const createNewWorkflow = () => {
    const newId = crypto.randomUUID();
    setWorkflowId(newId);
    setWorkflowName('New Workflow');
    setCanvasNodes([]);
    setCanvasConnections([]);
    setCurrentWorkflow({
      id: newId,
      name: 'New Workflow',
      description: '',
      nodes: [],
      connections: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    setIsDesigning(true);
  };

  const saveCurrentWorkflow = () => {
    const nodes = canvasNodes();
    const connections = canvasConnections();
    const name = workflowName();

    if (name && nodes.length > 0) {
      const workflowToSave: Workflow = {
        id: workflowId() || crypto.randomUUID(),
        name: name,
        description: currentWorkflow.description,
        nodes: nodes,
        connections: connections,
        createdAt: currentWorkflow.createdAt,
        updatedAt: new Date(),
      };

      const existing = workflows.findIndex(w => w.id === workflowToSave.id);
      if (existing >= 0) {
        setWorkflows(existing, workflowToSave);
      } else {
        setWorkflows([...workflows, workflowToSave]);
      }
      saveWorkflows();
      setIsDesigning(false);
    }
  };

  // Click on palette node to select it for placement
  const handlePaletteNodeClick = (nodeType: any) => {
    setSelectedPaletteNode(nodeType);
  };

  // Click on canvas to place selected palette node OR start dragging existing node
  const handleCanvasClick = (e: MouseEvent) => {
    // Only handle direct canvas clicks, not clicks on nodes
    if ((e.target as HTMLElement).closest('.workflow-node')) {
      return;
    }

    const paletteNode = selectedPaletteNode();
    if (paletteNode && canvasRef) {
      const rect = canvasRef.getBoundingClientRect();
      const x = e.clientX - rect.left - 75;
      const y = e.clientY - rect.top - 30;

      // Determine node category
      const isConditionNode = conditionNodes.some(n => n.type === paletteNode.type);
      const isActionNode = actionNodes.some(n => n.type === paletteNode.type);
      const nodeType: WorkflowNode['type'] = isConditionNode ? 'condition'
        : isActionNode ? 'action'
        : 'analysis';

      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: nodeType,
        name: paletteNode.name,
        config: { type: paletteNode.type },
        position: { x: Math.max(0, x), y: Math.max(0, y) },
        inputs: getNodeInputs(paletteNode.type),
        outputs: getNodeOutputs(paletteNode.type),
      };

      setCanvasNodes((prev) => [...prev, newNode]);
      setSelectedPaletteNode(null); // Clear selection after placing
    }
  };

  // Mouse down on canvas node - start dragging
  const handleNodeMouseDown = (e: MouseEvent, nodeId: string) => {
    // Don't drag if clicking delete button or ports
    if ((e.target as HTMLElement).closest('.delete-node, .port')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const node = canvasNodes().find(n => n.id === nodeId);
    if (!node || !canvasRef) return;

    const rect = canvasRef.getBoundingClientRect();
    setDraggingNodeId(nodeId);
    setDragOffset({
      x: e.clientX - rect.left - node.position.x,
      y: e.clientY - rect.top - node.position.y
    });

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!canvasRef) return;
      const dragId = draggingNodeId();
      if (!dragId) return;

      const rect = canvasRef.getBoundingClientRect();
      const offset = dragOffset();
      const x = Math.max(0, moveEvent.clientX - rect.left - offset.x);
      const y = Math.max(0, moveEvent.clientY - rect.top - offset.y);

      setCanvasNodes((prev) =>
        prev.map((n) => n.id === dragId ? { ...n, position: { x, y } } : n)
      );
    };

    const handleMouseUp = () => {
      setDraggingNodeId(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Node dimensions for connector position calculations (must match CSS)
  const NODE_WIDTH = 150;
  const NODE_HEIGHT = 70;

  // Get connector position based on side
  const getConnectorPosition = (node: WorkflowNode, side: string) => {
    const x = node.position.x;
    const y = node.position.y;

    switch (side) {
      case 'top':
        return { x: x + NODE_WIDTH / 2, y: y };
      case 'right':
        return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT / 2 };
      case 'bottom':
        return { x: x + NODE_WIDTH / 2, y: y + NODE_HEIGHT };
      case 'left':
        return { x: x, y: y + NODE_HEIGHT / 2 };
      default:
        // Default to right side for output
        return { x: x + NODE_WIDTH, y: y + NODE_HEIGHT / 2 };
    }
  };

  // Reactive memo for connection paths - recalculates when nodes or connections change
  const connectionPaths = createMemo(() => {
    const nodes = canvasNodes();
    const connections = canvasConnections();

    return connections.map(conn => {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);

      if (!fromNode || !toNode) return { id: conn.id, d: '' };

      const fromPos = getConnectorPosition(fromNode, conn.fromPort);
      const toPos = getConnectorPosition(toNode, conn.toPort);

      // Calculate control points for a smooth bezier curve
      const dx = Math.abs(toPos.x - fromPos.x);
      const dy = Math.abs(toPos.y - fromPos.y);
      const curvature = Math.min(50, Math.max(dx, dy) / 2);

      // Determine control point offsets based on connector sides
      let cp1x = fromPos.x, cp1y = fromPos.y;
      let cp2x = toPos.x, cp2y = toPos.y;

      if (conn.fromPort === 'right') cp1x += curvature;
      else if (conn.fromPort === 'left') cp1x -= curvature;
      else if (conn.fromPort === 'top') cp1y -= curvature;
      else if (conn.fromPort === 'bottom') cp1y += curvature;

      if (conn.toPort === 'right') cp2x += curvature;
      else if (conn.toPort === 'left') cp2x -= curvature;
      else if (conn.toPort === 'top') cp2y -= curvature;
      else if (conn.toPort === 'bottom') cp2y += curvature;

      return {
        id: conn.id,
        d: `M ${fromPos.x} ${fromPos.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${toPos.x} ${toPos.y}`
      };
    });
  });

  const getNodeInputs = (type: string): string[] => {
    const inputs: Record<string, string[]> = {
      static: [],
      yara: [],
      wasm: [],
      ai: ['context'],
      network: [],
      behavioral: [],
      threshold: ['value'],
      pattern: ['data'],
      time: [],
      alert: ['trigger'],
      quarantine: ['file'],
      report: ['data'],
      api: ['payload'],
    };
    return inputs[type] || [];
  };

  const getNodeOutputs = (type: string): string[] => {
    const outputs: Record<string, string[]> = {
      static: ['score', 'threats', 'metadata'],
      yara: ['matches', 'count'],
      wasm: ['results', 'modules'],
      ai: ['analysis', 'confidence'],
      network: ['connections', 'protocols'],
      behavioral: ['behaviors', 'anomalies'],
      threshold: ['true', 'false'],
      pattern: ['match', 'nomatch'],
      time: ['triggered'],
      alert: [],
      quarantine: ['status'],
      report: ['url'],
      api: ['response'],
    };
    return outputs[type] || [];
  };

  const selectNode = (node: WorkflowNode) => {
    setSelectedNode(node);
  };

  const deleteNode = (nodeId: string) => {
    // Update signals
    setCanvasNodes(prev => prev.filter(n => n.id !== nodeId));
    setCanvasConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));

    // Update store
    setCurrentWorkflow(
      produce((state) => {
        state.nodes = state.nodes.filter(n => n.id !== nodeId);
        state.connections = state.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
      })
    );
    setSelectedNode(null);
  };

  const startConnection = (nodeId: string, port: string) => {
    setConnecting(true);
    setConnectionStart({ node: nodeId, port });
  };

  const completeConnection = (nodeId: string, port: string) => {
    const start = connectionStart();
    if (start && start.node !== nodeId) {
      const newConnection: WorkflowConnection = {
        id: `conn-${Date.now()}`,
        from: start.node,
        to: nodeId,
        fromPort: start.port,
        toPort: port,
      };
      // Update signal
      setCanvasConnections(prev => [...prev, newConnection]);

      // Update store
      setCurrentWorkflow(
        produce((state) => {
          state.connections.push(newConnection);
        })
      );
    }
    setConnecting(false);
    setConnectionStart(null);
  };

  const runWorkflow = async (workflow: Workflow) => {
    try {
      // Validate workflow has nodes
      if (!workflow.nodes || workflow.nodes.length === 0) {
        alert('Workflow has no nodes to execute');
        return;
      }

      // Check if a file is uploaded (required for workflows)
      const currentFile = analysisStore.currentFile;
      if (!currentFile) {
        setExecutionMessage('Please upload a file before executing the workflow');
        alert('Please upload a file before executing the workflow');
        return;
      }

      // Determine workflow type based on nodes
      const workflowType = determineWorkflowType(workflow);

      // Convert workflow to input format for backend
      const workflowInput = {
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        nodes: workflow.nodes.map(node => ({
          id: node.id,
          type: node.type,
          name: node.name,
          config: node.config,
        })),
        connections: workflow.connections,
        metadata: {
          description: workflow.description,
          created_at: workflow.createdAt,
        },
      };

      // Start the job
      setExecutionMessage('Starting workflow execution...');
      setExecutionProgress(0);
      setRunningJobId('starting'); // Show progress UI immediately

      const jobId = await jobService.startJob(workflowType, workflowInput);
      setRunningJobId(jobId);

      // Subscribe to progress updates
      const unsubscribe = jobService.onProgress(jobId, (update: ProgressUpdate) => {
        setExecutionProgress(update.progress * 100);
        setExecutionMessage(update.message);
      });

      // Poll for job completion
      let completed = false;
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes with 1 second intervals

      while (!completed && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          const job = await jobService.getJobStatus(jobId);

          if (job.status === 'Completed') {
            completed = true;
            setExecutionProgress(100);
            setExecutionMessage('Workflow completed successfully!');

            // Show results
            if (job.output) {
              alert(`Workflow completed successfully!\n\nResults:\n${JSON.stringify(job.output, null, 2)}`);
            }

            // Clear state after a delay
            setTimeout(() => {
              setRunningJobId(null);
              setExecutionProgress(0);
              setExecutionMessage('');
            }, 3000);

          } else if (job.status === 'Failed') {
            completed = true;
            const errorMsg = job.error || 'Unknown error occurred';
            setExecutionMessage(`Workflow failed: ${errorMsg}`);
            alert(`Workflow execution failed:\n${errorMsg}`);

            setTimeout(() => {
              setRunningJobId(null);
              setExecutionProgress(0);
              setExecutionMessage('');
            }, 3000);

          } else if (job.status === 'Cancelled') {
            completed = true;
            setExecutionMessage('Workflow was cancelled');

            setTimeout(() => {
              setRunningJobId(null);
              setExecutionProgress(0);
              setExecutionMessage('');
            }, 3000);
          }
          // Update progress from job status
          else if (job.status === 'Running') {
            setExecutionProgress(job.progress * 100);
          }

        } catch (error) {
          console.error('Error checking job status:', error);
        }

        attempts++;
      }

      // Cleanup
      unsubscribe();

      if (!completed) {
        setExecutionMessage('Workflow execution timed out');
        alert('Workflow execution timed out. Check the job status manually.');
        setTimeout(() => {
          setRunningJobId(null);
          setExecutionProgress(0);
          setExecutionMessage('');
        }, 3000);
      }

    } catch (error) {
      console.error('Failed to start workflow:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setExecutionMessage(`Error: ${errorMsg}`);
      alert(`Failed to execute workflow:\n${errorMsg}`);

      setTimeout(() => {
        setRunningJobId(null);
        setExecutionProgress(0);
        setExecutionMessage('');
      }, 3000);
    }
  };

  const determineWorkflowType = (workflow: Workflow): string => {
    // Analyze workflow nodes to determine the appropriate workflow type
    const nodeTypes = workflow.nodes.map(n => n.config?.type || n.name.toLowerCase());

    // Check for file analysis patterns
    if (nodeTypes.some(t => ['static', 'yara', 'wasm', 'ai'].includes(t))) {
      return 'FileAnalysis';
    }

    // Check for batch scanning patterns
    if (nodeTypes.some(t => t.includes('batch') || t.includes('scan'))) {
      return 'BatchScan';
    }

    // Check for threat hunting patterns
    if (nodeTypes.some(t => ['network', 'behavioral', 'pattern'].includes(t))) {
      return 'ThreatHunting';
    }

    // Check for report generation patterns
    if (nodeTypes.some(t => t.includes('report') || t === 'report')) {
      return 'ReportGeneration';
    }

    // Default to FileAnalysis
    return 'FileAnalysis';
  };

  return (
    <div class="custom-workflows">
      <div class="workflows-header">
        <h2>Custom Workflows</h2>
        <button onClick={createNewWorkflow} class="primary-button">
          ➕ New Workflow
        </button>
      </div>

      <Show when={!isDesigning()} fallback={
        <div class="workflow-designer">
          <div class="designer-header">
            <input
              type="text"
              placeholder="Workflow Name"
              value={workflowName()}
              onInput={(e) => {
                setWorkflowName(e.currentTarget.value);
                setCurrentWorkflow('name', e.currentTarget.value);
              }}
              class="workflow-name-input"
            />
            <div class="designer-actions">
              <button onClick={saveCurrentWorkflow} class="save-button">
                💾 Save
              </button>
              <button onClick={() => setIsDesigning(false)} class="cancel-button">
                ❌ Cancel
              </button>
            </div>
          </div>

          <div class="designer-content">
            <div class="nodes-palette">
              <h3>Analysis Nodes</h3>
              <p style="font-size: 12px; color: #888; margin-bottom: 10px;">
                {selectedPaletteNode()
                  ? `Click canvas to place "${selectedPaletteNode().name}"`
                  : 'Click a node, then click canvas to place'}
              </p>
              <p style="font-size: 12px; color: var(--barbie-pink); margin-bottom: 10px;">
                Nodes on canvas: {canvasNodes().length}
              </p>
              <Show when={selectedPaletteNode()}>
                <button
                  style="margin-bottom: 10px; padding: 5px 10px; background: #666; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;"
                  onClick={() => setSelectedPaletteNode(null)}
                >
                  Cancel Selection
                </button>
              </Show>
              <div class="node-category">
                <For each={analysisNodes}>
                  {(node) => (
                    <div
                      class={`palette-node ${selectedPaletteNode()?.type === node.type ? 'selected' : ''}`}
                      onClick={() => handlePaletteNodeClick(node)}
                    >
                      <span class="node-icon">{node.icon}</span>
                      <span class="node-name">{node.name}</span>
                    </div>
                  )}
                </For>
              </div>

              <h3>Conditions</h3>
              <div class="node-category">
                <For each={conditionNodes}>
                  {(node) => (
                    <div
                      class={`palette-node condition ${selectedPaletteNode()?.type === node.type ? 'selected' : ''}`}
                      onClick={() => handlePaletteNodeClick(node)}
                    >
                      <span class="node-icon">{node.icon}</span>
                      <span class="node-name">{node.name}</span>
                    </div>
                  )}
                </For>
              </div>

              <h3>Actions</h3>
              <div class="node-category">
                <For each={actionNodes}>
                  {(node) => (
                    <div
                      class={`palette-node action ${selectedPaletteNode()?.type === node.type ? 'selected' : ''}`}
                      onClick={() => handlePaletteNodeClick(node)}
                    >
                      <span class="node-icon">{node.icon}</span>
                      <span class="node-name">{node.name}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div
              class={`workflow-canvas ${selectedPaletteNode() ? 'placing-node' : ''}`}
              ref={(el) => { canvasRef = el; }}
              onClick={handleCanvasClick}
            >
              <svg class="connections-svg">
                <For each={connectionPaths()}>
                  {(path) => (
                    <Show when={path.d}>
                      <path
                        d={path.d}
                        stroke="#ff6b9d"
                        stroke-width="2"
                        fill="none"
                        stroke-linecap="round"
                      />
                    </Show>
                  )}
                </For>
              </svg>

              <For each={canvasNodes()}>
                {(node) => (
                  <div
                    class={`workflow-node ${selectedNode()?.id === node.id ? 'selected' : ''} ${draggingNodeId() === node.id ? 'dragging' : ''}`}
                    style={{
                      position: 'absolute',
                      left: `${node.position.x}px`,
                      top: `${node.position.y}px`,
                      cursor: 'move'
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    onClick={() => selectNode(node)}
                  >
                    {/* Connection dots on all four sides */}
                    <div
                      class="connector connector-top"
                      onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'top'); }}
                      title="Top connector"
                    />
                    <div
                      class="connector connector-right"
                      onClick={(e) => { e.stopPropagation(); startConnection(node.id, 'right'); }}
                      title="Right connector"
                    />
                    <div
                      class="connector connector-bottom"
                      onClick={(e) => { e.stopPropagation(); completeConnection(node.id, 'bottom'); }}
                      title="Bottom connector"
                    />
                    <div
                      class="connector connector-left"
                      onClick={(e) => { e.stopPropagation(); completeConnection(node.id, 'left'); }}
                      title="Left connector"
                    />

                    <div class="node-header">
                      <span>{node.name}</span>
                      <button onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }} class="delete-node">
                        ×
                      </button>
                    </div>

                    <div class="node-body">
                      <span class="node-type-badge">{node.type}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <Show when={selectedNode()}>
              <div class="node-config">
                <h3>Node Configuration</h3>
                <p>Selected: {selectedNode()?.name}</p>
                <pre>{JSON.stringify(selectedNode()?.config, null, 2)}</pre>
              </div>
            </Show>
          </div>
        </div>
      }>
        <div class="workflows-list">
          <For each={workflows}>
            {(workflow) => (
              <div class="workflow-card">
                <h3>{workflow.name}</h3>
                <p>{workflow.description}</p>
                <div class="workflow-stats">
                  <span>📊 {workflow.nodes.length} nodes</span>
                  <span>🔗 {workflow.connections.length} connections</span>
                </div>
                <div class="workflow-actions">
                  <button
                    onClick={() => {
                      // Populate signals for reactivity
                      setWorkflowId(workflow.id);
                      setWorkflowName(workflow.name);
                      setCanvasNodes([...workflow.nodes]);
                      setCanvasConnections([...workflow.connections]);
                      // Also set store for compatibility
                      setCurrentWorkflow(workflow);
                      setIsDesigning(true);
                    }}
                    class="edit-button"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => runWorkflow(workflow)}
                    class="run-button"
                    disabled={runningJobId() !== null || !analysisStore.currentFile}
                    title={!analysisStore.currentFile ? 'Please upload a file first' : ''}
                  >
                    ▶️ Run
                  </button>
                </div>
                <Show when={runningJobId()}>
                  <div class="workflow-execution-status">
                    <div class="execution-message">{executionMessage() || 'Initializing...'}</div>
                    <div class="execution-progress-bar">
                      <div
                        class="execution-progress-fill"
                        style={{ width: `${executionProgress()}%` }}
                      />
                    </div>
                    <div class="execution-progress-text">
                      {Math.round(executionProgress())}%
                    </div>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default CustomWorkflows;