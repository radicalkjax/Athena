import { Component, createSignal, onMount } from 'solid-js';
import { invokeCommand } from '../../../utils/tauriCompat';
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

  onMount(async () => {
    try {
      const status = await invokeCommand('get_system_status') as SystemStatus;
      setSystemStatus(status);
    } catch (err) {
      console.error('Failed to get system status:', err);
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
        <div class="status-dot" aria-hidden="true"></div>
        <span>AI Providers Ready • WASM Runtime Online • 6 Models Active</span>
      </div>
    </header>
  );
};