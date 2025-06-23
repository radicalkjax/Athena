import { Component, createSignal, createEffect, onMount, For, Show } from 'solid-js';
import { wasmService } from '../../../services/wasmService';
import type { WasmModule, WasmRuntimeStatus } from '../../../types/wasm';
import './WasmRuntime.css';

const WasmRuntime: Component = () => {
  const [status, setStatus] = createSignal<WasmRuntimeStatus>({
    initialized: false,
    totalMemory: 0,
    modules: [],
  });
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedModule, setSelectedModule] = createSignal<string | null>(null);

  // Initialize runtime on mount
  onMount(async () => {
    await initializeRuntime();
  });

  // Poll for status updates
  createEffect(() => {
    const interval = setInterval(async () => {
      if (status().initialized) {
        await updateStatus();
      }
    }, 2000);

    return () => clearInterval(interval);
  });

  const initializeRuntime = async () => {
    setLoading(true);
    setError(null);
    
    try {
      await wasmService.initializeRuntime();
      await updateStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize WASM runtime');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async () => {
    try {
      const newStatus = await wasmService.getRuntimeStatus();
      setStatus(newStatus);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const loadTestModule = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create a simple test WASM module
      const testModule = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // WASM magic number
        0x01, 0x00, 0x00, 0x00, // Version
        // Add minimal valid WASM content
      ]);

      const moduleId = `test_module_${Date.now()}`;
      await wasmService.loadModule(moduleId, testModule);
      await updateStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test module');
    } finally {
      setLoading(false);
    }
  };

  const unloadModule = async (moduleId: string) => {
    setLoading(true);
    try {
      await wasmService.unloadModule(moduleId);
      await updateStatus();
      if (selectedModule() === moduleId) {
        setSelectedModule(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unload module');
    } finally {
      setLoading(false);
    }
  };

  const formatMemory = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div class="wasm-runtime">
      <h2>WASM Runtime Manager</h2>

      <div class="runtime-status">
        <div class="status-item">
          <span class="status-label">Status:</span>
          <span class={`status-value ${status().initialized ? 'active' : 'inactive'}`}>
            {status().initialized ? 'Initialized' : 'Not Initialized'}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">Memory Usage:</span>
          <span class="status-value">{formatMemory(status().totalMemory)}</span>
        </div>
        <div class="status-item">
          <span class="status-label">Loaded Modules:</span>
          <span class="status-value">{status().modules.length}</span>
        </div>
      </div>

      <Show when={error()}>
        <div class="error-message">{error()}</div>
      </Show>

      <div class="runtime-actions">
        <button
          class="btn btn-primary"
          onClick={initializeRuntime}
          disabled={loading() || status().initialized}
        >
          Initialize Runtime
        </button>
        <button
          class="btn btn-secondary"
          onClick={loadTestModule}
          disabled={loading() || !status().initialized}
        >
          Load Test Module
        </button>
      </div>

      <div class="modules-section">
        <h3>Loaded Modules</h3>
        <Show when={status().modules.length > 0} fallback={<p>No modules loaded</p>}>
          <div class="modules-grid">
            <For each={status().modules}>
              {(module: WasmModule) => (
                <div
                  class={`module-card ${selectedModule() === module.id ? 'selected' : ''}`}
                  onClick={() => setSelectedModule(module.id)}
                >
                  <div class="module-header">
                    <h4>{module.name}</h4>
                    <span class={`module-status ${module.loaded ? 'loaded' : 'unloaded'}`}>
                      {module.loaded ? '●' : '○'}
                    </span>
                  </div>
                  <div class="module-info">
                    <p>ID: {module.id}</p>
                    <p>Memory: {formatMemory(module.memory_usage)}</p>
                  </div>
                  <button
                    class="btn btn-small btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      unloadModule(module.id);
                    }}
                    disabled={loading()}
                  >
                    Unload
                  </button>
                </div>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show when={selectedModule()}>
        <div class="module-details">
          <h3>Module Details: {selectedModule()}</h3>
          <div class="details-content">
            <p>Additional module information would be displayed here.</p>
            <p>This could include exported functions, memory layout, etc.</p>
          </div>
        </div>
      </Show>
    </div>
  );
};

export default WasmRuntime;