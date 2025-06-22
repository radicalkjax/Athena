<script lang="ts">
  export let activePanel: string;
  export let onPanelChange: (panel: string) => void;
  
  const criticalFeatures = [
    { id: 'upload', label: 'File Upload', icon: '📁' },
    { id: 'analysis', label: 'Analysis Dashboard', icon: '🔍' },
    { id: 'ai-models', label: 'AI Model Config', icon: '🤖' }
  ];
  
  const importantFeatures = [
    { id: 'static', label: 'Static Analysis', icon: '📊' },
    { id: 'dynamic', label: 'Dynamic Analysis', icon: '⚡' },
    { id: 'network', label: 'Network Analysis', icon: '🌐' }
  ];
  
  const advancedFeatures = [
    { id: 'hex', label: 'Hex Editor', icon: '🔢' },
    { id: 'disassembly', label: 'Disassembly', icon: '💾' },
    { id: 'yara', label: 'YARA Rules', icon: '🛡️' },
    { id: 'workflow', label: 'Workflow Designer', icon: '🔄' }
  ];
</script>

<aside class="sidebar">
  <nav aria-label="Main navigation">
    <div class="critical-priority">
      <div class="priority-header">
        <span>🔴</span> Critical Features
      </div>
      {#each criticalFeatures as feature}
        <button
          class="sidebar-item {activePanel === feature.id ? 'active' : ''}"
          on:click={() => onPanelChange(feature.id)}
          aria-current={activePanel === feature.id ? 'page' : undefined}
        >
          <span>{feature.icon}</span>
          {feature.label}
        </button>
      {/each}
    </div>
    
    <div class="important-priority">
      <div class="priority-header">
        <span>🟡</span> Important Features
      </div>
      {#each importantFeatures as feature}
        <button
          class="sidebar-item {activePanel === feature.id ? 'active' : ''}"
          on:click={() => onPanelChange(feature.id)}
          aria-current={activePanel === feature.id ? 'page' : undefined}
        >
          <span>{feature.icon}</span>
          {feature.label}
        </button>
      {/each}
    </div>
    
    <div class="advanced-priority">
      <div class="priority-header">
        <span>🟢</span> Advanced Features
      </div>
      {#each advancedFeatures as feature}
        <button
          class="sidebar-item {activePanel === feature.id ? 'active' : ''}"
          on:click={() => onPanelChange(feature.id)}
          aria-current={activePanel === feature.id ? 'page' : undefined}
        >
          <span>{feature.icon}</span>
          {feature.label}
        </button>
      {/each}
    </div>
  </nav>
</aside>