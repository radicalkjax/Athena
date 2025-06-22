<script lang="ts">
  import { onMount } from 'svelte';
  
  let systemStatus = {
    platform: '',
    version: '0.1.0',
    memory: 0
  };
  
  onMount(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke('get_system_status');
      systemStatus = status as typeof systemStatus;
    } catch (err) {
      console.error('Failed to get system status:', err);
    }
  });
</script>

<header class="header">
  <div class="logo-section">
    <div class="logo">A</div>
    <h1 class="app-title">Athena Platform</h1>
  </div>
  
  <div class="header-status">
    <span class="status-item">
      <span class="status-icon">💻</span>
      {systemStatus.platform || 'Loading...'}
    </span>
    <span class="status-item">
      <span class="status-icon">📊</span>
      v{systemStatus.version}
    </span>
  </div>
</header>

<style>
  .header-status {
    display: flex;
    gap: 20px;
    align-items: center;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  
  .status-icon {
    font-size: 1rem;
  }
</style>