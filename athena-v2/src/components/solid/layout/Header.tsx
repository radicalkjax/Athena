import { Component, createSignal, onMount, onCleanup } from 'solid-js';
import { invokeCommand } from '../../../utils/tauriCompat';
import { backendService } from '../../../services/backendService';
import logoImg from '../../../assets/images/logo.png';

interface SystemStatus {
  platform: string;
  version: string;
  memory_usage: number;
}

export const Header: Component = () => {
  const [systemStatus, setSystemStatus] = createSignal<SystemStatus>({
    platform: '',
    version: '0.1.0',
    memory_usage: 0
  });
  const [backendConnected, setBackendConnected] = createSignal(false);
  let healthCheckInterval: number | null = null;

  const checkBackendHealth = async () => {
    try {
      await backendService.checkHealth();
      setBackendConnected(true);
    } catch {
      setBackendConnected(false);
    }
  };

  onMount(async () => {
    try {
      const status = await invokeCommand('get_system_status') as SystemStatus;
      setSystemStatus(status);
    } catch (err) {
      console.error('Failed to get system status:', err);
    }

    // Check backend health
    await checkBackendHealth();
    healthCheckInterval = window.setInterval(checkBackendHealth, 10000);
  });

  onCleanup(() => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
  });

  return (
    <header class="header">
      <div class="logo-section">
        <div class="logo">
          <img src={logoImg} alt="Athena Platform Logo" />
        </div>
        <div>
          <h1 class="logo-text">
            Athena Platform<span class="logo-separator">:</span>
            <span class="platform-subtitle">AI-Powered Malware Analysis</span>
          </h1>
        </div>
      </div>

      <div class="status-indicator" role="status" aria-live="polite">
        <div class={`status-dot ${backendConnected() ? 'online' : 'offline'}`} aria-hidden="true"></div>
        <span>
          {backendConnected() ? 'Backend Connected' : 'Backend Disconnected'} • WASM Runtime Online
        </span>
      </div>
    </header>
  );
};