import { Component, createSignal, Show, For, createEffect } from 'solid-js';
import AnalysisPanel from '../shared/AnalysisPanel';
import { StatCard } from '../shared/StatCard';
import './CustomWorkflows.css';

interface WorkflowNode {
  id: string;
  type: 'input' | 'analysis' | 'condition' | 'output';
  name: string;
  icon: string;
  x: number;
  y: number;
  config?: any;
  inputs?: string[];
  outputs?: string[];
}

interface WorkflowConnection {
  id: string;
  from: string;
  to: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  created: Date;
  modified: Date;
}

const CustomWorkflows: Component = () => {
  const [workflows, setWorkflows] = createSignal<Workflow[]>([
    {
      id: '1',
      name: 'Advanced Malware Analysis',
      description: 'Comprehensive analysis workflow with AI ensemble',
      nodes: [],
      connections: [],
      created: new Date(),
      modified: new Date()
    },
    {
      id: '2',
      name: 'Quick Triage',
      description: 'Fast initial assessment for suspicious files',
      nodes: [],
      connections: [],
      created: new Date(),
      modified: new Date()
    }
  ]);
  
  const [selectedWorkflow, setSelectedWorkflow] = createSignal<Workflow | null>(null);
  const [isCreating, setIsCreating] = createSignal(false);
  const [showNodePalette, setShowNodePalette] = createSignal(false);
  const [draggedNode, setDraggedNode] = createSignal<string | null>(null);
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [connectionStart, setConnectionStart] = createSignal<{ nodeId: string; port: 'input' | 'output' } | null>(null);
  const [tempConnection, setTempConnection] = createSignal<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  const nodeTypes = [
    { type: 'input', name: 'File Input', icon: '📁', category: 'Input' },
    { type: 'input', name: 'URL Input', icon: '🌐', category: 'Input' },
    { type: 'input', name: 'Hash Input', icon: '🔐', category: 'Input' },
    { type: 'analysis', name: 'Static Analysis', icon: '🔍', category: 'Analysis' },
    { type: 'analysis', name: 'Dynamic Analysis', icon: '⚡', category: 'Analysis' },
    { type: 'analysis', name: 'AI Analysis', icon: '🤖', category: 'Analysis' },
    { type: 'analysis', name: 'YARA Scan', icon: '📝', category: 'Analysis' },
    { type: 'analysis', name: 'Memory Analysis', icon: '🧠', category: 'Analysis' },
    { type: 'condition', name: 'If/Else', icon: '🔀', category: 'Logic' },
    { type: 'condition', name: 'Score Check', icon: '📊', category: 'Logic' },
    { type: 'condition', name: 'Pattern Match', icon: '🎯', category: 'Logic' },
    { type: 'output', name: 'Report', icon: '📄', category: 'Output' },
    { type: 'output', name: 'Alert', icon: '🚨', category: 'Output' },
    { type: 'output', name: 'Export', icon: '💾', category: 'Output' }
  ];

  // Debug effect to log workflow changes
  createEffect(() => {
    const workflow = selectedWorkflow();
    if (workflow) {
      console.log('Selected workflow updated:', {
        id: workflow.id,
        name: workflow.name,
        nodes: workflow.nodes.length,
        connections: workflow.connections
      });
    }
  });

  const createNewWorkflow = () => {
    const newWorkflow: Workflow = {
      id: Date.now().toString(),
      name: 'New Workflow',
      description: 'Custom analysis workflow',
      nodes: [],
      connections: [],
      created: new Date(),
      modified: new Date()
    };
    
    setWorkflows(prev => [...prev, newWorkflow]);
    setSelectedWorkflow(newWorkflow);
    setIsCreating(false);
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
    if (selectedWorkflow()?.id === id) {
      setSelectedWorkflow(null);
    }
  };

  const addNode = (nodeType: typeof nodeTypes[0]) => {
    if (!selectedWorkflow()) return;
    
    const newNode: WorkflowNode = {
      id: Date.now().toString(),
      type: nodeType.type as any,
      name: nodeType.name,
      icon: nodeType.icon,
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 300
    };
    
    const workflow = selectedWorkflow()!;
    const updatedWorkflow = {
      ...workflow,
      nodes: [...workflow.nodes, newNode],
      modified: new Date()
    };
    
    setWorkflows(workflows().map(w => 
      w.id === workflow.id ? updatedWorkflow : w
    ));
    
    // Update the selected workflow reference to trigger reactivity
    setSelectedWorkflow(updatedWorkflow);
    
    setShowNodePalette(false);
  };

  const handleNodeMouseDown = (e: MouseEvent, nodeId: string) => {
    // Don't start dragging if clicking on a port
    if ((e.target as HTMLElement).classList.contains('input-port') || 
        (e.target as HTMLElement).classList.contains('output-port')) {
      return;
    }
    
    e.preventDefault();
    const node = selectedWorkflow()?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const canvasRect = (e.currentTarget as HTMLElement).closest('.canvas-area')?.getBoundingClientRect();
    if (!canvasRect) return;
    
    setDragOffset({
      x: e.clientX - canvasRect.left - node.x,
      y: e.clientY - canvasRect.top - node.y
    });
    setDraggedNode(nodeId);
  };

  const handleCanvasMouseMove = (e: MouseEvent) => {
    const canvasRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - canvasRect.left;
    const mouseY = e.clientY - canvasRect.top;

    if (draggedNode()) {
      const workflow = selectedWorkflow();
      if (!workflow) return;

      const x = mouseX - dragOffset().x;
      const y = mouseY - dragOffset().y;

      const updatedWorkflow = {
        ...workflow,
        nodes: workflow.nodes.map(n => 
          n.id === draggedNode() ? { ...n, x, y } : n
        )
      };

      setWorkflows(workflows().map(w => 
        w.id === workflow.id ? updatedWorkflow : w
      ));
      setSelectedWorkflow(updatedWorkflow);
    }

    if (isConnecting() && connectionStart()) {
      const startNode = selectedWorkflow()?.nodes.find(n => n.id === connectionStart()!.nodeId);
      if (startNode) {
        const startPort = connectionStart()!.port;
        const startX = startNode.x + (startPort === 'output' ? 150 : 0);
        const startY = startNode.y + 25;

        // Find nearest port for magnetic snap
        let endX = mouseX;
        let endY = mouseY;
        
        const workflow = selectedWorkflow();
        if (workflow) {
          let minDistance = Infinity;
          let snapPort: { x: number; y: number } | null = null;

          workflow.nodes.forEach(node => {
            if (node.id !== connectionStart()!.nodeId) {
              // Check the opposite port type
              const portX = node.x + (startPort === 'output' ? 0 : 150);
              const portY = node.y + 25;
              
              const distance = Math.sqrt(
                Math.pow(mouseX - portX, 2) + 
                Math.pow(mouseY - portY, 2)
              );
              
              if (distance < 30 && distance < minDistance) {
                minDistance = distance;
                snapPort = { x: portX, y: portY };
              }
            }
          });

          if (snapPort) {
            endX = snapPort.x;
            endY = snapPort.y;
          }
        }

        setTempConnection({
          startX,
          startY,
          endX,
          endY
        });
      }
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggedNode(null);
    setIsConnecting(false);
    setConnectionStart(null);
    setTempConnection(null);
  };

  const handlePortClick = (e: MouseEvent, nodeId: string, port: 'input' | 'output') => {
    e.stopPropagation();
    e.preventDefault();
    
    if (!isConnecting()) {
      // Start a new connection
      setIsConnecting(true);
      setConnectionStart({ nodeId, port });
    } else {
      // Complete connection
      const start = connectionStart();
      if (start && start.nodeId !== nodeId) {
        // Only connect if one is output and one is input
        if ((start.port === 'output' && port === 'input') || 
            (start.port === 'input' && port === 'output')) {
          const workflow = selectedWorkflow();
          if (!workflow) return;

          // Create the connection with proper from/to assignment
          const fromNodeId = start.port === 'output' ? start.nodeId : nodeId;
          const toNodeId = start.port === 'output' ? nodeId : start.nodeId;

          const newConnection: WorkflowConnection = {
            id: `${fromNodeId}-${toNodeId}-${Date.now()}`,
            from: fromNodeId,
            to: toNodeId
          };

          // Create a completely new workflow object
          const newWorkflow: Workflow = {
            ...workflow,
            connections: [...workflow.connections, newConnection],
            modified: new Date()
          };

          // Update the workflows array
          setWorkflows(prev => prev.map(w => 
            w.id === workflow.id ? newWorkflow : w
          ));
          
          // Update the selected workflow to trigger re-render
          setSelectedWorkflow(newWorkflow);
        }
      }
      
      // Reset connection state
      setIsConnecting(false);
      setConnectionStart(null);
      setTempConnection(null);
    }
  };

  const deleteNode = (nodeId: string) => {
    const workflow = selectedWorkflow();
    if (!workflow) return;

    const updatedWorkflow = {
      ...workflow,
      nodes: workflow.nodes.filter(n => n.id !== nodeId),
      connections: workflow.connections.filter(c => c.from !== nodeId && c.to !== nodeId),
      modified: new Date()
    };

    setWorkflows(workflows().map(w => 
      w.id === workflow.id ? updatedWorkflow : w
    ));
    setSelectedWorkflow(updatedWorkflow);
  };

  return (
    <div class="content-panel">
      <div class="panel-header">
        <h2><span style="color: var(--barbie-pink);">🔗</span> Custom Workflows</h2>
        <p>Design and automate your analysis pipelines</p>
      </div>

      <AnalysisPanel title="Workflow Manager" icon="🔗">
        <div class="workflows-container">
          <div class="workflows-sidebar">
          <div class="sidebar-header">
            <h3>My Workflows</h3>
            <button 
              class="btn-primary"
              onClick={() => setIsCreating(true)}
            >
              <span>➕</span> New
            </button>
          </div>

          <div class="workflows-list">
            <For each={workflows()}>
              {(workflow) => (
                <div 
                  class={`workflow-item ${selectedWorkflow()?.id === workflow.id ? 'active' : ''}`}
                  onClick={() => setSelectedWorkflow(workflow)}
                >
                  <div class="workflow-info">
                    <h4>{workflow.name}</h4>
                    <p>{workflow.description}</p>
                    <span class="workflow-date">
                      Modified: {workflow.modified.toLocaleDateString()}
                    </span>
                  </div>
                  <button 
                    class="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkflow(workflow.id);
                    }}
                  >
                    🗑️
                  </button>
                </div>
              )}
            </For>
          </div>

          <Show when={isCreating()}>
            <div class="create-workflow-modal">
              <h4>Create New Workflow</h4>
              <input 
                type="text" 
                placeholder="Workflow name"
                class="workflow-input"
              />
              <textarea 
                placeholder="Description"
                class="workflow-textarea"
              />
              <div class="modal-actions">
                <button 
                  class="btn-secondary"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button 
                  class="btn-primary"
                  onClick={createNewWorkflow}
                >
                  Create
                </button>
              </div>
            </div>
          </Show>
        </div>

        <div class="workflow-canvas">
          <Show when={selectedWorkflow()}>
            <div class="canvas-header">
              <h3>{selectedWorkflow()!.name}</h3>
              <div class="canvas-controls">
                <button 
                  class="btn-secondary"
                  onClick={() => {
                    console.log('Current workflow:', selectedWorkflow());
                    setShowNodePalette(!showNodePalette());
                  }}
                >
                  <span>➕</span> Add Node
                </button>
                <button class="btn-primary">
                  <span>▶️</span> Run
                </button>
                <button class="btn-secondary">
                  <span>💾</span> Save
                </button>
              </div>
            </div>

            <div 
              class="canvas-area"
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            >
              <Show when={selectedWorkflow()!.nodes.length === 0}>
                <div class="empty-canvas">
                  <p>Click "Add Node" to start building your workflow</p>
                </div>
              </Show>

              {/* Render connections */}
              <svg class="connections-layer" style="overflow: visible;">
                {(() => {
                  const workflow = selectedWorkflow();
                  if (!workflow) return null;
                  
                  return workflow.connections.map(connection => {
                    const fromNode = workflow.nodes.find(n => n.id === connection.from);
                    const toNode = workflow.nodes.find(n => n.id === connection.to);
                    
                    if (!fromNode || !toNode) return null;
                    
                    const startX = fromNode.x + 150;
                    const startY = fromNode.y + 25;
                    const endX = toNode.x;
                    const endY = toNode.y + 25;
                    const midX = (startX + endX) / 2;
                    
                    return (
                      <path
                        d={`M ${startX} ${startY} Q ${midX} ${startY} ${midX} ${(startY + endY) / 2} T ${endX} ${endY}`}
                        stroke="var(--barbie-pink)"
                        stroke-width="2"
                        fill="none"
                      />
                    );
                  });
                })()}
                
                {/* Temporary connection while dragging */}
                <Show when={tempConnection() && isConnecting()}>
                  {(() => {
                    const tc = tempConnection()!;
                    const controlPointOffset = Math.abs(tc.endX - tc.startX) / 2;
                    return (
                      <path
                        d={`M ${tc.startX} ${tc.startY} C ${tc.startX + controlPointOffset} ${tc.startY}, ${tc.endX - controlPointOffset} ${tc.endY}, ${tc.endX} ${tc.endY}`}
                        stroke="var(--barbie-pink)"
                        stroke-width="2"
                        stroke-dasharray="5,5"
                        fill="none"
                        opacity="0.7"
                      />
                    );
                  })()}
                </Show>
              </svg>

              <For each={selectedWorkflow()!.nodes}>
                {(node) => (
                  <div 
                    class={`workflow-node ${node.type}`}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  >
                    <button 
                      class="node-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNode(node.id);
                      }}
                      title="Delete node"
                    >
                      ×
                    </button>
                    <div class="node-header">
                      <span class="node-icon">{node.icon}</span>
                      <span class="node-name">{node.name}</span>
                    </div>
                    <div class="node-ports">
                      <div 
                        class={`input-port ${isConnecting() && connectionStart()?.port === 'output' ? 'port-connecting' : ''}`}
                        onClick={(e) => handlePortClick(e, node.id, 'input')}
                      ></div>
                      <div 
                        class={`output-port ${isConnecting() && connectionStart()?.port === 'input' ? 'port-connecting' : ''}`}
                        onClick={(e) => handlePortClick(e, node.id, 'output')}
                      ></div>
                    </div>
                  </div>
                )}
              </For>
            </div>

            <Show when={showNodePalette()}>
              <div class="node-palette">
                <h4>Add Node</h4>
                <div class="node-categories">
                  <div class="category">
                    <h5>Input</h5>
                    <For each={nodeTypes.filter(n => n.category === 'Input')}>
                      {(nodeType) => (
                        <button 
                          class="node-option"
                          onClick={() => addNode(nodeType)}
                        >
                          <span>{nodeType.icon}</span>
                          {nodeType.name}
                        </button>
                      )}
                    </For>
                  </div>
                  
                  <div class="category">
                    <h5>Analysis</h5>
                    <For each={nodeTypes.filter(n => n.category === 'Analysis')}>
                      {(nodeType) => (
                        <button 
                          class="node-option"
                          onClick={() => addNode(nodeType)}
                        >
                          <span>{nodeType.icon}</span>
                          {nodeType.name}
                        </button>
                      )}
                    </For>
                  </div>
                  
                  <div class="category">
                    <h5>Logic</h5>
                    <For each={nodeTypes.filter(n => n.category === 'Logic')}>
                      {(nodeType) => (
                        <button 
                          class="node-option"
                          onClick={() => addNode(nodeType)}
                        >
                          <span>{nodeType.icon}</span>
                          {nodeType.name}
                        </button>
                      )}
                    </For>
                  </div>
                  
                  <div class="category">
                    <h5>Output</h5>
                    <For each={nodeTypes.filter(n => n.category === 'Output')}>
                      {(nodeType) => (
                        <button 
                          class="node-option"
                          onClick={() => addNode(nodeType)}
                        >
                          <span>{nodeType.icon}</span>
                          {nodeType.name}
                        </button>
                      )}
                    </For>
                  </div>
                </div>
              </div>
            </Show>
          </Show>

          <Show when={!selectedWorkflow()}>
            <div class="no-workflow-selected">
              <p>Select a workflow or create a new one to get started</p>
            </div>
          </Show>
          </div>
        </div>
      </AnalysisPanel>
    </div>
  );
};

export default CustomWorkflows;