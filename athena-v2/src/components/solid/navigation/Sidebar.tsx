import { Component, For } from 'solid-js';

interface SidebarProps {
  activePanel: string;
  onPanelChange: (panel: string) => void;
}

interface Feature {
  id: string;
  label: string;
  icon: string;
}

export const Sidebar: Component<SidebarProps> = (props) => {
  const criticalFeatures: Feature[] = [
    { id: 'upload', label: 'File Upload', icon: '📁' },
    { id: 'analysis', label: 'Analysis Dashboard', icon: '🔍' },
    { id: 'ai-models', label: 'AI Model Config', icon: '🤖' }
  ];
  
  const importantFeatures: Feature[] = [
    { id: 'static', label: 'Static Analysis', icon: '📊' },
    { id: 'dynamic', label: 'Dynamic Analysis', icon: '⚡' },
    { id: 'network', label: 'Network Analysis', icon: '🌐' }
  ];
  
  const advancedFeatures: Feature[] = [
    { id: 'hex', label: 'Hex Editor', icon: '🔢' },
    { id: 'disassembly', label: 'Disassembly', icon: '💾' },
    { id: 'yara', label: 'YARA Rules', icon: '🛡️' },
    { id: 'workflow', label: 'Workflow Designer', icon: '🔄' }
  ];

  return (
    <aside class="sidebar">
      <nav aria-label="Main navigation">
        <div class="critical-priority">
          <div class="priority-header">
            <span>🔴</span> Critical Features
          </div>
          <For each={criticalFeatures}>
            {(feature) => (
              <button
                class={`sidebar-item ${props.activePanel === feature.id ? 'active' : ''}`}
                onClick={() => props.onPanelChange(feature.id)}
                aria-current={props.activePanel === feature.id ? 'page' : undefined}
              >
                <span>{feature.icon}</span>
                {feature.label}
              </button>
            )}
          </For>
        </div>
        
        <div class="important-priority">
          <div class="priority-header">
            <span>🟡</span> Important Features
          </div>
          <For each={importantFeatures}>
            {(feature) => (
              <button
                class={`sidebar-item ${props.activePanel === feature.id ? 'active' : ''}`}
                onClick={() => props.onPanelChange(feature.id)}
                aria-current={props.activePanel === feature.id ? 'page' : undefined}
              >
                <span>{feature.icon}</span>
                {feature.label}
              </button>
            )}
          </For>
        </div>
        
        <div class="advanced-priority">
          <div class="priority-header">
            <span>🟢</span> Advanced Features
          </div>
          <For each={advancedFeatures}>
            {(feature) => (
              <button
                class={`sidebar-item ${props.activePanel === feature.id ? 'active' : ''}`}
                onClick={() => props.onPanelChange(feature.id)}
                aria-current={props.activePanel === feature.id ? 'page' : undefined}
              >
                <span>{feature.icon}</span>
                {feature.label}
              </button>
            )}
          </For>
        </div>
      </nav>
    </aside>
  );
};