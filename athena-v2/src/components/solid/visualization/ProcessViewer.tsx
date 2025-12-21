import { createSignal, onCleanup, onMount, For, Show, createMemo } from 'solid-js';
import { invokeCommand } from '../../../utils/tauriCompat';
import AnalysisPanel from '../shared/AnalysisPanel';

interface ProcessInfo {
  pid: number;
  name: string;
  cpu_usage: number;
  memory: number;
  status: string;
  parent_pid: number | null;
  command: string[];
}

interface ProcessNode extends ProcessInfo {
  children: ProcessNode[];
  expanded?: boolean;
}

export default function ProcessViewer() {
  const [processes, setProcesses] = createSignal<ProcessInfo[]>([]);
  const [processTree, setProcessTree] = createSignal<ProcessNode[]>([]);
  const [selectedProcess, setSelectedProcess] = createSignal<ProcessInfo | null>(null);
  const [sortBy, setSortBy] = createSignal<'cpu' | 'memory' | 'name'>('cpu');
  const [searchTerm, setSearchTerm] = createSignal('');
  const [error, setError] = createSignal<string>('');
  
  let intervalId: number;

  const updateProcesses = async () => {
    try {
      const data = await invokeCommand('get_processes') as ProcessInfo[];
      setProcesses(data);
      buildProcessTree(data);
      setError('');
    } catch (err) {
      setError(`Failed to get processes: ${err}`);
    }
  };

  const buildProcessTree = (procs: ProcessInfo[]) => {
    const processMap = new Map<number, ProcessNode>();
    const rootProcesses: ProcessNode[] = [];

    // First pass: create all nodes
    procs.forEach(proc => {
      processMap.set(proc.pid, { ...proc, children: [], expanded: false });
    });

    // Second pass: build tree structure
    procs.forEach(proc => {
      const node = processMap.get(proc.pid)!;
      if (proc.parent_pid && processMap.has(proc.parent_pid)) {
        const parent = processMap.get(proc.parent_pid)!;
        parent.children.push(node);
      } else {
        rootProcesses.push(node);
      }
    });

    setProcessTree(rootProcesses);
  };

  const killProcess = async (pid: number) => {
    try {
      const success = await invokeCommand('kill_process', { pid }) as boolean;
      if (success) {
        await updateProcesses();
      } else {
        setError('Failed to kill process');
      }
    } catch (err) {
      setError(`Failed to kill process: ${err}`);
    }
  };

  onMount(() => {
    updateProcesses();
    intervalId = window.setInterval(updateProcesses, 2000);
  });

  onCleanup(() => {
    if (intervalId) clearInterval(intervalId);
  });

  const formatMemory = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  const sortedProcesses = createMemo(() => {
    let procs = [...processes()];
    const term = searchTerm().toLowerCase();
    
    if (term) {
      procs = procs.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.command.join(' ').toLowerCase().includes(term)
      );
    }

    switch (sortBy()) {
      case 'cpu':
        return procs.sort((a, b) => b.cpu_usage - a.cpu_usage);
      case 'memory':
        return procs.sort((a, b) => b.memory - a.memory);
      case 'name':
        return procs.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return procs;
    }
  });

  const toggleExpand = (node: ProcessNode) => {
    node.expanded = !node.expanded;
    setProcessTree([...processTree()]);
  };

  const renderProcessNode = (node: ProcessNode, level: number = 0) => {
    return (
      <div class="process-node" style={{ "padding-left": `${level * 20}px` }}>
        <div 
          class="process-row"
          classList={{ selected: selectedProcess()?.pid === node.pid }}
          onClick={() => setSelectedProcess(node)}
        >
          {node.children.length > 0 && (
            <button 
              class="expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(node);
              }}
              style="background: none; border: none; color: var(--barbie-pink); cursor: pointer; padding: 0 5px;"
            >
              {node.expanded ? '▼' : '▶'}
            </button>
          )}
          <span class="process-name">{node.name}</span>
          <span class="process-pid">PID: {node.pid}</span>
          <span class="process-cpu" style={{ color: node.cpu_usage > 50 ? '#ef4444' : '#4ade80' }}>
            {node.cpu_usage.toFixed(1)}%
          </span>
          <span class="process-memory">{formatMemory(node.memory)}</span>
          <span class="process-status">{node.status}</span>
        </div>
        <Show when={node.expanded}>
          <For each={node.children}>
            {child => renderProcessNode(child, level + 1)}
          </For>
        </Show>
      </div>
    );
  };

  return (
    <AnalysisPanel title="Process Viewer" icon="📊">
      <div class="content-panel">
      
      {error() && (
        <div class="error-message">{error()}</div>
      )}

        <div class="process-controls" style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center;">
          <input
            type="text"
            placeholder="Search processes..."
            value={searchTerm()}
            onInput={(e) => setSearchTerm(e.currentTarget.value)}
            class="input-field"
            style="flex: 1;"
          />
          
          <div class="sort-controls" style="display: flex; align-items: center; gap: 10px;">
            <label style="color: #888;">Sort by:</label>
            <select 
              value={sortBy()} 
              onChange={(e) => setSortBy(e.currentTarget.value as any)}
              class="input-field"
              style="width: auto;"
            >
              <option value="cpu">CPU Usage</option>
              <option value="memory">Memory</option>
              <option value="name">Name</option>
            </select>
          </div>

          <div class="stat-badge" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 8px 16px; border-radius: 8px;">
            <span style="color: white; font-weight: 600;">Total: {processes().length}</span>
          </div>
        </div>

        <div class="analysis-grid">
          <div class="panel" style="grid-column: span 2;">
            <div class="panel-header">
              <h4>Process List</h4>
            </div>
            <div class="process-header" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; padding: 10px; background: #2a2a2a; border-bottom: 1px solid #444; font-weight: 600; color: #888;">
            <span>Name</span>
            <span>PID</span>
            <span>CPU</span>
            <span>Memory</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          
            <div class="process-list-content" style="max-height: 400px; overflow-y: auto;">
            <For each={sortedProcesses().slice(0, 50)}>
              {(process) => (
                <div 
                  class="process-item"
                  classList={{ selected: selectedProcess()?.pid === process.pid }}
                  onClick={() => setSelectedProcess(process)}
                  style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr; padding: 10px; border-bottom: 1px solid #333; cursor: pointer; transition: all 0.2s ease;"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 107, 157, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedProcess()?.pid === process.pid ? 'rgba(255, 107, 157, 0.2)' : 'transparent'}
                >
                  <span class="process-name">{process.name}</span>
                  <span class="process-pid">{process.pid}</span>
                  <span class="process-cpu" style={{ 
                    color: process.cpu_usage > 50 ? '#ef4444' : 
                           process.cpu_usage > 20 ? '#fbbf24' : '#4ade80' 
                  }}>
                    {process.cpu_usage.toFixed(1)}%
                  </span>
                  <span class="process-memory">{formatMemory(process.memory)}</span>
                  <span class="process-status">{process.status}</span>
                  <button 
                    class="btn-secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Kill process ${process.name} (PID: ${process.pid})?`)) {
                        killProcess(process.pid);
                      }
                    }}
                    style="padding: 4px 12px; font-size: 12px;"
                  >
                    Kill
                  </button>
                </div>
              )}
            </For>
          </div>
        </div>

          <div class="panel">
            <div class="panel-header">
              <h4>Process Tree</h4>
            </div>
            <div class="tree-content" style="max-height: 400px; overflow-y: auto; padding: 15px;">
            <For each={processTree()}>
              {node => renderProcessNode(node)}
            </For>
          </div>
        </div>
      </div>

        <Show when={selectedProcess()}>
          <div class="panel" style="grid-column: span 3; margin-top: 20px;">
            <div class="panel-header">
              <h4>Process Details</h4>
            </div>
            <div style="padding: 20px;">
              <div class="detail-row" style="display: flex; gap: 15px; margin-bottom: 10px;">
                <span class="label" style="color: #888; min-width: 120px;">Name:</span>
                <span class="value" style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{selectedProcess()!.name}</span>
          </div>
              <div class="detail-row" style="display: flex; gap: 15px; margin-bottom: 10px;">
                <span class="label" style="color: #888; min-width: 120px;">PID:</span>
                <span class="value" style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{selectedProcess()!.pid}</span>
          </div>
              <div class="detail-row" style="display: flex; gap: 15px; margin-bottom: 10px;">
                <span class="label" style="color: #888; min-width: 120px;">Parent PID:</span>
                <span class="value" style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{selectedProcess()!.parent_pid || 'None'}</span>
          </div>
              <div class="detail-row" style="display: flex; gap: 15px; margin-bottom: 10px;">
                <span class="label" style="color: #888; min-width: 120px;">CPU Usage:</span>
                <span class="value" style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{selectedProcess()!.cpu_usage.toFixed(2)}%</span>
          </div>
              <div class="detail-row" style="display: flex; gap: 15px; margin-bottom: 10px;">
                <span class="label" style="color: #888; min-width: 120px;">Memory:</span>
                <span class="value" style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{formatMemory(selectedProcess()!.memory)}</span>
          </div>
              <div class="detail-row" style="display: flex; gap: 15px; margin-bottom: 10px;">
                <span class="label" style="color: #888; min-width: 120px;">Status:</span>
                <span class="value" style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace;">{selectedProcess()!.status}</span>
          </div>
              <div class="detail-row" style="display: flex; gap: 15px; margin-bottom: 10px;">
                <span class="label" style="color: #888; min-width: 120px;">Command:</span>
                <span class="value command" style="color: #e0e0e0; font-family: 'JetBrains Mono', monospace; word-break: break-all;">{selectedProcess()!.command.join(' ')}</span>
          </div>
            </div>
          </div>
        </Show>
      </div>
    </AnalysisPanel>
  );
}