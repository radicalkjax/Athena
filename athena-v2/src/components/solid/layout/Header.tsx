import { Component, createSignal, onMount } from 'solid-js';
import { invoke } from '@tauri-apps/api/core';

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
      const status = await invoke<SystemStatus>('get_system_status');
      setSystemStatus(status);
    } catch (err) {
      console.error('Failed to get system status:', err);
    }
  });

  return (
    <header class="header">
      <div class="logo-section">
        <div class="logo">A</div>
        <h1 class="app-title">Athena Platform</h1>
      </div>
      
      <div class="header-status">
        <span class="status-item">
          <span class="status-icon">💻</span>
          {systemStatus().platform || 'Loading...'}
        </span>
        <span class="status-item">
          <span class="status-icon">📊</span>
          v{systemStatus().version}
        </span>
      </div>
    </header>
  );
};