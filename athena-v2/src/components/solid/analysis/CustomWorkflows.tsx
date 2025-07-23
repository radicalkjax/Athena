import { Component, createSignal, For, Show, onMount } from 'solid-js';
import { createStore } from 'solid-js/store';
import './CustomWorkflows.css';

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
  const [draggedNode, setDraggedNode] = createSignal<any>(null);
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

  let canvasRef: HTMLDivElement | undefined;

  onMount(() => {
    loadWorkflows();
  });

  const loadWorkflows = () => {
    // Load saved workflows from storage
    const saved = localStorage.getItem('athena-workflows');
    if (saved) {
      setWorkflows(JSON.parse(saved));
    } else {
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
    setCurrentWorkflow({
      id: crypto.randomUUID(),
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
    if (currentWorkflow.name && currentWorkflow.nodes.length > 0) {
      const existing = workflows.findIndex(w => w.id === currentWorkflow.id);
      if (existing >= 0) {
        setWorkflows(existing, currentWorkflow);
      } else {
        setWorkflows([...workflows, currentWorkflow]);
      }
      saveWorkflows();
      setIsDesigning(false);
    }
  };

  const handleNodeDragStart = (_e: DragEvent, nodeType: any) => {
    setDraggedNode(nodeType);
  };

  const handleCanvasDrop = (e: DragEvent) => {
    e.preventDefault();
    const node = draggedNode();
    if (node && canvasRef) {
      const rect = canvasRef.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: 'analysis',
        name: node.name,
        config: { type: node.type },
        position: { x, y },
        inputs: getNodeInputs(node.type),
        outputs: getNodeOutputs(node.type),
      };

      setCurrentWorkflow('nodes', [...currentWorkflow.nodes, newNode]);
    }
    setDraggedNode(null);
  };

  const handleCanvasDragOver = (e: DragEvent) => {
    e.preventDefault();
  };

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
    setCurrentWorkflow('nodes', nodes => nodes.filter(n => n.id !== nodeId));
    setCurrentWorkflow('connections', conns => 
      conns.filter(c => c.from !== nodeId && c.to !== nodeId)
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
      setCurrentWorkflow('connections', [...currentWorkflow.connections, newConnection]);
    }
    setConnecting(false);
    setConnectionStart(null);
  };

  const runWorkflow = async (_workflow: Workflow) => {
    // Implementation would execute the workflow
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
              value={currentWorkflow.name}
              onInput={(e) => setCurrentWorkflow('name', e.currentTarget.value)}
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
              <div class="node-category">
                <For each={analysisNodes}>
                  {(node) => (
                    <div 
                      class="palette-node"
                      draggable
                      onDragStart={(e) => handleNodeDragStart(e, node)}
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
                      class="palette-node condition"
                      draggable
                      onDragStart={(e) => handleNodeDragStart(e, node)}
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
                      class="palette-node action"
                      draggable
                      onDragStart={(e) => handleNodeDragStart(e, node)}
                    >
                      <span class="node-icon">{node.icon}</span>
                      <span class="node-name">{node.name}</span>
                    </div>
                  )}
                </For>
              </div>
            </div>

            <div 
              class="workflow-canvas"
              ref={canvasRef}
              onDrop={handleCanvasDrop}
              onDragOver={handleCanvasDragOver}
            >
              <svg class="connections-svg">
                <For each={currentWorkflow.connections}>
                  {(conn) => {
                    const fromNode = currentWorkflow.nodes.find(n => n.id === conn.from);
                    const toNode = currentWorkflow.nodes.find(n => n.id === conn.to);
                    if (fromNode && toNode) {
                      return (
                        <line
                          x1={fromNode.position.x + 100}
                          y1={fromNode.position.y + 30}
                          x2={toNode.position.x}
                          y2={toNode.position.y + 30}
                          stroke="#ff6b9d"
                          stroke-width="2"
                        />
                      );
                    }
                    return null;
                  }}
                </For>
              </svg>

              <For each={currentWorkflow.nodes}>
                {(node) => (
                  <div 
                    class={`workflow-node ${selectedNode()?.id === node.id ? 'selected' : ''}`}
                    style={{
                      left: `${node.position.x}px`,
                      top: `${node.position.y}px`
                    }}
                    onClick={() => selectNode(node)}
                  >
                    <div class="node-header">
                      <span>{node.name}</span>
                      <button onClick={() => deleteNode(node.id)} class="delete-node">
                        ×
                      </button>
                    </div>
                    
                    <div class="node-ports">
                      <div class="input-ports">
                        <For each={node.inputs}>
                          {(port) => (
                            <div 
                              class="port input"
                              onClick={() => completeConnection(node.id, port)}
                              title={port}
                            />
                          )}
                        </For>
                      </div>
                      
                      <div class="output-ports">
                        <For each={node.outputs}>
                          {(port) => (
                            <div 
                              class="port output"
                              onClick={() => startConnection(node.id, port)}
                              title={port}
                            />
                          )}
                        </For>
                      </div>
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
                  >
                    ▶️ Run
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default CustomWorkflows;