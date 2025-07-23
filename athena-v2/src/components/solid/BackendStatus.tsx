import { Component, createSignal, onMount, onCleanup, Show } from 'solid-js';
import { backendService } from '../../services/backendService';
import { logger } from '../../services/loggingService';
import './BackendStatus.css';

export const BackendStatus: Component = () => {
  const [isConnected, setIsConnected] = createSignal(false);
  const [status, setStatus] = createSignal<any>(null);
  const [error, setError] = createSignal<string | null>(null);
  let interval: number | null = null;

  const checkBackendStatus = async () => {
    try {
      const health = await backendService.checkHealth();
      setIsConnected(true);
      setStatus(health);
      setError(null);
      logger.info('Backend status checked:', health);
    } catch (err) {
      setIsConnected(false);
      setError(err.message || 'Failed to connect to backend');
      logger.error('Backend connection failed:', err);
    }
  };

  onMount(async () => {
    // Initial check
    await checkBackendStatus();
    
    // Check every 10 seconds
    interval = window.setInterval(checkBackendStatus, 10000);
  });

  onCleanup(() => {
    if (interval) {
      clearInterval(interval);
    }
  });

  return (
    <div class={`backend-status ${isConnected() ? 'connected' : 'disconnected'}`}>
      <div class="status-indicator">
        <span class={`status-dot ${isConnected() ? 'online' : 'offline'}`}></span>
        <span class="status-text">
          Backend: {isConnected() ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <Show when={error()}>
        <div class="status-error">
          ⚠️ {error()}
        </div>
      </Show>
      
      <Show when={status()}>
        <div class="status-details">
          <div class="service-status">
            <span>API: {status()?.services?.api || 'unknown'}</span>
            <span>Cache: {status()?.services?.cache || 'unknown'}</span>
            <span>WASM: {status()?.services?.wasm || 'unknown'}</span>
          </div>
        </div>
      </Show>
    </div>
  );
};