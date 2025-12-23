import { Component, createSignal, createEffect, onCleanup, For } from 'solid-js';
import { ContainerService, ContainerInfo, ContainerExecutionResult } from '../../../services/containerService';
import './ContainerSandbox.css';

interface SandboxState {
  dockerAvailable: boolean;
  checking: boolean;
  containers: ContainerInfo[];
  selectedContainer?: ContainerInfo;
  logs: string;
  executing: boolean;
  lastResult?: ContainerExecutionResult;
  viewingLogsFor?: string;
  containerLogs: string;
  loadingLogs: boolean;
}

const ContainerSandbox: Component = () => {
  const [state, setState] = createSignal<SandboxState>({
    dockerAvailable: false,
    checking: true,
    containers: [],
    logs: '',
    executing: false,
    containerLogs: '',
    loadingLogs: false,
  });

  const [command, setCommand] = createSignal('');
  const [image, setImage] = createSignal('alpine:latest');
  const [memoryMB, setMemoryMB] = createSignal(256);
  const [cpuLimit, setCpuLimit] = createSignal(0.5);
  const [timeout, setTimeout] = createSignal(30);

  // Check Docker availability on mount
  createEffect(async () => {
    try {
      const available = await ContainerService.checkDockerAvailable();
      setState((prev) => ({ ...prev, dockerAvailable: available, checking: false }));

      if (available) {
        await refreshContainerList();
      }
    } catch (error) {
      console.error('Failed to check Docker:', error);
      setState((prev) => ({ ...prev, checking: false }));
    }
  });

  // Auto-refresh container list every 5 seconds
  const refreshInterval = setInterval(async () => {
    if (state().dockerAvailable) {
      await refreshContainerList();
    }
  }, 5000);

  onCleanup(() => {
    clearInterval(refreshInterval);
  });

  const refreshContainerList = async () => {
    try {
      const containers = await ContainerService.listSandboxContainers();
      setState((prev) => ({ ...prev, containers }));
    } catch (error) {
      console.error('Failed to list containers:', error);
    }
  };

  const createContainer = async () => {
    try {
      setState((prev) => ({ ...prev, executing: true }));

      const container = await ContainerService.createSandboxContainer(
        image(),
        memoryMB() * 1024 * 1024,
        cpuLimit()
      );

      setState((prev) => ({
        ...prev,
        selectedContainer: container,
        logs: `Container created: ${container.id}\n`,
      }));

      await refreshContainerList();
    } catch (error) {
      console.error('Failed to create container:', error);
      setState((prev) => ({
        ...prev,
        logs: prev.logs + `Error: ${error}\n`,
      }));
    } finally {
      setState((prev) => ({ ...prev, executing: false }));
    }
  };

  const executeCommand = async () => {
    const container = state().selectedContainer;
    if (!container) {
      alert('Please create a container first');
      return;
    }

    const cmd = command().trim();
    if (!cmd) {
      alert('Please enter a command');
      return;
    }

    try {
      setState((prev) => ({ ...prev, executing: true }));

      // Parse command into array
      const commandArray = cmd.split(' ').filter(s => s.length > 0);

      const result = await ContainerService.executeInContainer(
        container.id,
        commandArray,
        timeout()
      );

      setState((prev) => ({
        ...prev,
        lastResult: result,
        logs: prev.logs +
          `\n$ ${cmd}\n` +
          `Exit code: ${result.exit_code}\n` +
          `Time: ${result.execution_time_ms}ms\n` +
          `Output:\n${result.stdout}\n` +
          (result.stderr ? `Errors:\n${result.stderr}\n` : ''),
      }));
    } catch (error) {
      console.error('Failed to execute command:', error);
      setState((prev) => ({
        ...prev,
        logs: prev.logs + `Error: ${error}\n`,
      }));
    } finally {
      setState((prev) => ({ ...prev, executing: false }));
    }
  };

  const stopContainer = async (containerId: string) => {
    try {
      await ContainerService.stopContainer(containerId);
      setState((prev) => ({
        ...prev,
        logs: prev.logs + `Container ${containerId.substring(0, 12)} stopped\n`,
      }));
      await refreshContainerList();
    } catch (error) {
      console.error('Failed to stop container:', error);
      setState((prev) => ({
        ...prev,
        logs: prev.logs + `Error stopping container: ${error}\n`,
      }));
    }
  };

  const removeContainer = async (containerId: string) => {
    const shortId = containerId.substring(0, 12);
    if (!confirm(`Are you sure you want to remove container ${shortId}?`)) {
      return;
    }

    try {
      await ContainerService.removeContainer(containerId);
      setState((prev) => ({
        ...prev,
        logs: prev.logs + `Container ${shortId} removed\n`,
        selectedContainer: prev.selectedContainer?.id === containerId ? undefined : prev.selectedContainer,
        viewingLogsFor: prev.viewingLogsFor === containerId ? undefined : prev.viewingLogsFor,
      }));
      await refreshContainerList();
    } catch (error) {
      console.error('Failed to remove container:', error);
      setState((prev) => ({
        ...prev,
        logs: prev.logs + `Error removing container: ${error}\n`,
      }));
    }
  };

  const viewLogs = async (containerId: string) => {
    try {
      setState((prev) => ({ ...prev, loadingLogs: true, viewingLogsFor: containerId }));
      const logs = await ContainerService.getContainerLogs(containerId);
      setState((prev) => ({
        ...prev,
        containerLogs: logs || 'No logs available',
        loadingLogs: false,
      }));

      // Auto-scroll to logs section
      setTimeout(() => {
        const logsElement = document.getElementById('container-logs-viewer');
        if (logsElement) {
          logsElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (error) {
      console.error('Failed to get logs:', error);
      setState((prev) => ({
        ...prev,
        containerLogs: `Error loading logs: ${error}`,
        loadingLogs: false,
      }));
    }
  };

  const closeLogs = () => {
    setState((prev) => ({ ...prev, viewingLogsFor: undefined, containerLogs: '' }));
  };

  const copyLogs = () => {
    navigator.clipboard.writeText(state().containerLogs)
      .then(() => alert('Logs copied to clipboard'))
      .catch((error) => console.error('Failed to copy logs:', error));
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const getStatusClass = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('running') || statusLower.includes('up')) return 'status-running';
    if (statusLower.includes('exited')) return 'status-exited';
    if (statusLower.includes('created')) return 'status-created';
    return 'status-stopped';
  };

  return (
    <div class="container-sandbox">
      <h2>Docker Container Sandbox</h2>

      {state().checking && <p>Checking Docker availability...</p>}

      {!state().checking && !state().dockerAvailable && (
        <div class="alert alert-error">
          <strong>Docker Not Available</strong>
          <p>Docker is required for container sandboxing. Please ensure Docker Desktop is running.</p>
        </div>
      )}

      {state().dockerAvailable && (
        <>
          {/* Container Creation */}
          <div class="card">
            <h3>Create Sandbox Container</h3>
            <div class="form-group">
              <label>Docker Image:</label>
              <input
                type="text"
                value={image()}
                onInput={(e) => setImage(e.currentTarget.value)}
                placeholder="alpine:latest"
              />
            </div>
            <div class="form-group">
              <label>Memory Limit (MB):</label>
              <input
                type="number"
                value={memoryMB()}
                onInput={(e) => setMemoryMB(parseInt(e.currentTarget.value) || 256)}
                min="64"
                max="4096"
              />
            </div>
            <div class="form-group">
              <label>CPU Limit (0.1 - 4.0):</label>
              <input
                type="number"
                step="0.1"
                value={cpuLimit()}
                onInput={(e) => setCpuLimit(parseFloat(e.currentTarget.value) || 0.5)}
                min="0.1"
                max="4.0"
              />
            </div>
            <button
              onClick={createContainer}
              disabled={state().executing}
            >
              {state().executing ? 'Creating...' : 'Create Container'}
            </button>
          </div>

          {/* Command Execution */}
          {state().selectedContainer && (
            <div class="card">
              <h3>Execute Command</h3>
              <p>Container: <code>{state().selectedContainer?.name}</code></p>
              <div class="form-group">
                <label>Command:</label>
                <input
                  type="text"
                  value={command()}
                  onInput={(e) => setCommand(e.currentTarget.value)}
                  placeholder="ls -la"
                  onKeyPress={(e) => e.key === 'Enter' && executeCommand()}
                />
              </div>
              <div class="form-group">
                <label>Timeout (seconds):</label>
                <input
                  type="number"
                  value={timeout()}
                  onInput={(e) => setTimeout(parseInt(e.currentTarget.value) || 30)}
                  min="1"
                  max="300"
                />
              </div>
              <button
                onClick={executeCommand}
                disabled={state().executing || !command().trim()}
              >
                {state().executing ? 'Executing...' : 'Execute'}
              </button>
            </div>
          )}

          {/* Container List */}
          <div class="card">
            <h3>Running Containers ({state().containers.length})</h3>
            <div class="container-list">
              <For each={state().containers} fallback={<p>No containers running</p>}>
                {(container) => {
                  const isRunning = container.status.toLowerCase().includes('running') ||
                                   container.status.toLowerCase().includes('up');
                  const isStopped = container.status.toLowerCase().includes('exited') ||
                                   container.status.toLowerCase().includes('created');

                  return (
                    <div class="container-item">
                      <div class="container-info">
                        <div class="container-header">
                          <strong>{container.name}</strong>
                          <span class="container-id" title={container.id}>
                            {container.id.substring(0, 12)}
                          </span>
                        </div>
                        <div class="container-details">
                          <span class="container-image" title={container.image}>
                            {container.image}
                          </span>
                          <span class={`container-status ${getStatusClass(container.status)}`}>
                            {container.status}
                          </span>
                          <span class="container-created" title={new Date(container.created * 1000).toLocaleString()}>
                            {formatTimestamp(container.created)}
                          </span>
                        </div>
                      </div>
                      <div class="container-actions">
                        <button
                          onClick={() => setState((prev) => ({ ...prev, selectedContainer: container }))}
                          class="btn-small"
                          disabled={!isRunning}
                          title={isRunning ? "Select this container for command execution" : "Container must be running"}
                        >
                          Select
                        </button>
                        <button
                          onClick={() => viewLogs(container.id)}
                          class="btn-small btn-info"
                        >
                          View Logs
                        </button>
                        {isRunning && (
                          <button
                            onClick={() => stopContainer(container.id)}
                            class="btn-small btn-warning"
                          >
                            Stop
                          </button>
                        )}
                        {isStopped && (
                          <button
                            onClick={() => removeContainer(container.id)}
                            class="btn-small btn-danger"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Container Logs Viewer */}
          {state().viewingLogsFor && (
            <div class="card" id="container-logs-viewer">
              <div class="logs-header">
                <h3>Container Logs - {state().containers.find(c => c.id === state().viewingLogsFor)?.name || state().viewingLogsFor?.substring(0, 12)}</h3>
                <div class="logs-actions">
                  <button onClick={copyLogs} class="btn-small" disabled={state().loadingLogs}>
                    Copy Logs
                  </button>
                  <button onClick={closeLogs} class="btn-small">
                    Close
                  </button>
                </div>
              </div>
              {state().loadingLogs ? (
                <div class="logs-loading">Loading logs...</div>
              ) : (
                <pre class="logs-output logs-container-viewer">{state().containerLogs}</pre>
              )}
            </div>
          )}

          {/* Logs */}
          <div class="card">
            <h3>Execution Logs</h3>
            <pre class="logs-output">{state().logs || 'No logs yet...'}</pre>
            <button onClick={() => setState((prev) => ({ ...prev, logs: '' }))}>
              Clear Logs
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ContainerSandbox;
