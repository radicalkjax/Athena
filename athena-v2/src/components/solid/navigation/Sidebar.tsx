import { Component, For } from 'solid-js';
import { preloadService } from '../../../services/preloadService';

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
    { id: 'upload', label: 'Sample Upload', icon: '📤' },
    { id: 'static', label: 'Static Analysis', icon: '🔍' },
    { id: 'dynamic', label: 'Dynamic Analysis', icon: '⚡' },
    { id: 'ai-ensemble', label: 'AI Provider Ensemble', icon: '🤖' },
    { id: 'threat-intel', label: 'Threat Intelligence', icon: '🚨' },
    { id: 'reports', label: 'Analysis Reports', icon: '📊' }
  ];
  
  const importantFeatures: Feature[] = [
    { id: 'hex', label: 'Hex Editor', icon: '🔢' },
    { id: 'disassembly', label: 'Disassembly', icon: '⚙️' },
    { id: 'network', label: 'Network Analysis', icon: '🌐' },
    { id: 'memory', label: 'Memory Analysis', icon: '🧠' }
  ];
  
  const advancedFeatures: Feature[] = [
    { id: 'workflows', label: 'Custom Workflows', icon: '🔗' },
    { id: 'yara', label: 'YARA Rules', icon: '📝' },
    { id: 'platform-config', label: 'Platform Config', icon: '🛠️' }
  ];

  return (
    <nav class="analysis-sidebar" role="navigation" aria-label="Analysis navigation">
      <div class="sidebar-header">
        <span aria-hidden="true">🧰</span>
        <h2>Malware Analysis Toolbox</h2>
      </div>
      
      <div class="sidebar-content">
        {/* Core Analysis */}
        <div class="priority-section critical-priority">
          <div class="priority-header">
            <span aria-hidden="true">🎯</span>
            <span>Core Analysis</span>
          </div>
          
          <For each={criticalFeatures}>
            {(feature) => (
              <a
                href="#"
                class={`sidebar-item ${props.activePanel === feature.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  props.onPanelChange(feature.id);
                }}
                onMouseEnter={() => preloadService.preloadComponent(feature.id)}
                onMouseLeave={() => preloadService.cancelPreload(feature.id)}
                data-tab={feature.id}
              >
                <span aria-hidden="true">{feature.icon}</span>
                <span>{feature.label}</span>
              </a>
            )}
          </For>
        </div>
        
        {/* Deep Inspection */}
        <div class="priority-section important-priority">
          <div class="priority-header">
            <span aria-hidden="true">🔬</span>
            <span>Deep Inspection</span>
          </div>
          
          <For each={importantFeatures}>
            {(feature) => (
              <a
                href="#"
                class={`sidebar-item ${props.activePanel === feature.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  props.onPanelChange(feature.id);
                }}
                onMouseEnter={() => preloadService.preloadComponent(feature.id)}
                onMouseLeave={() => preloadService.cancelPreload(feature.id)}
                data-tab={feature.id}
              >
                <span aria-hidden="true">{feature.icon}</span>
                <span>{feature.label}</span>
              </a>
            )}
          </For>
        </div>
        
        {/* Automation & Config */}
        <div class="priority-section advanced-priority">
          <div class="priority-header">
            <span aria-hidden="true">⚙️</span>
            <span>Automation & Config</span>
          </div>
          
          <For each={advancedFeatures}>
            {(feature) => (
              <a
                href="#"
                class={`sidebar-item ${props.activePanel === feature.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  props.onPanelChange(feature.id);
                }}
                onMouseEnter={() => preloadService.preloadComponent(feature.id)}
                onMouseLeave={() => preloadService.cancelPreload(feature.id)}
                data-tab={feature.id}
              >
                <span aria-hidden="true">{feature.icon}</span>
                <span>{feature.label}</span>
              </a>
            )}
          </For>
        </div>
      </div>
      
      {/* AI Ensemble Status */}
      <div class="ensemble-status">
        <div class="ensemble-header">
          <span aria-hidden="true">🤖</span>
          <span>AI Provider Status</span>
        </div>
        <div class="agent-status-grid">
          <div class="agent-status">
            <div class="agent-status-dot" aria-label="Online"></div>
            <span>Claude 3.5</span>
          </div>
          <div class="agent-status">
            <div class="agent-status-dot" aria-label="Online"></div>
            <span>GPT-4 Turbo</span>
          </div>
          <div class="agent-status">
            <div class="agent-status-dot analyzing" aria-label="Analyzing"></div>
            <span>DeepSeek V3</span>
          </div>
          <div class="agent-status">
            <div class="agent-status-dot" aria-label="Online"></div>
            <span>Claude 3 Opus</span>
          </div>
          <div class="agent-status">
            <div class="agent-status-dot" aria-label="Online"></div>
            <span>GPT-4o</span>
          </div>
          <div class="agent-status">
            <div class="agent-status-dot" aria-label="Online"></div>
            <span>Gemini Pro</span>
          </div>
        </div>
      </div>
    </nav>
  );
};