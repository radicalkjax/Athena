# Component Mapping Guide: HTML Template to SolidJS

## Overview
This guide maps each HTML template element to its corresponding SolidJS component implementation.

## 1. Header Component Mapping

### HTML Template Structure
```html
<header class="header" role="banner">
  <div class="logo-section">
    <div class="logo" aria-hidden="true">⚔️</div>
    <div>
      <h1 class="logo-text">Athena Platform</h1>
      <div class="platform-subtitle">AI-Powered Malware Analysis</div>
    </div>
  </div>
  <div class="status-indicator" role="status" aria-live="polite">
    <div class="status-dot" aria-hidden="true"></div>
    <span>AI Providers Ready • WASM Runtime Online • 6 Models Active</span>
  </div>
</header>
```

### SolidJS Implementation
```tsx
// src/components/solid/layout/Header.tsx
import { Component, createSignal, createEffect } from 'solid-js';

export const Header: Component = () => {
  const [providerCount, setProviderCount] = createSignal(6);
  const [wasmStatus, setWasmStatus] = createSignal('Online');
  
  return (
    <header class="header" role="banner">
      <div class="logo-section">
        <div class="logo" aria-hidden="true">⚔️</div>
        <div>
          <h1 class="logo-text">Athena Platform</h1>
          <div class="platform-subtitle">AI-Powered Malware Analysis</div>
        </div>
      </div>
      <div class="status-indicator" role="status" aria-live="polite">
        <div class="status-dot" aria-hidden="true"></div>
        <span>AI Providers Ready • WASM Runtime {wasmStatus()} • {providerCount()} Models Active</span>
      </div>
    </header>
  );
};
```

### Required CSS Updates
```css
.header {
  background: var(--secondary-bg);
  border-bottom: 2px solid var(--border-color);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.logo {
  width: 40px;
  height: 40px;
  background: var(--barbie-gradient);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  box-shadow: 0 0 10px rgba(255, 107, 157, 0.3);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success-color);
  animation: pulse 2s ease-in-out infinite;
}
```

## 2. Sidebar Component Mapping

### Current vs Target Structure

**Current Sidebar.tsx Issues:**
- Missing proper styling classes
- No visual separation for priority sections
- AI status grid not properly styled

**Target Implementation:**
```tsx
// Updated Sidebar.tsx structure
export const Sidebar: Component<SidebarProps> = (props) => {
  return (
    <nav class="analysis-sidebar" role="navigation" aria-label="Analysis navigation">
      <div class="sidebar-header">
        <span aria-hidden="true">🔬</span>
        <h2>Malware Analysis</h2>
      </div>
      
      <div class="sidebar-content">
        {/* Priority sections with proper styling */}
      </div>
      
      {/* AI Ensemble Status with grid layout */}
      <div class="ensemble-status">
        <div class="ensemble-header">
          <span aria-hidden="true">🤖</span>
          <span>AI Provider Status</span>
        </div>
        <div class="agent-status-grid">
          {/* Status indicators */}
        </div>
      </div>
    </nav>
  );
};
```

### Required CSS Classes
```css
.analysis-sidebar {
  width: 320px;
  background: var(--secondary-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.priority-section {
  margin-bottom: 20px;
}

.priority-header {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.critical-priority .priority-header {
  background: rgba(255, 107, 107, 0.2);
  color: var(--critical-color);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin: 4px 0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.85rem;
  color: var(--text-secondary);
  text-decoration: none;
  border: 2px solid transparent;
}

.sidebar-item.active {
  background: var(--barbie-pink);
  color: white;
}

.ensemble-status {
  background: var(--panel-bg);
  border: 1px solid var(--accent-bg);
  border-radius: 8px;
  padding: 15px;
  margin: 15px;
}

.agent-status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.agent-status-dot.analyzing {
  background: var(--warning-color);
  animation: pulse 1s ease-in-out infinite;
}
```

## 3. Content Panel Components

### Upload Panel Structure
```tsx
// src/components/solid/analysis/FileUploadArea.tsx
import { Component, createSignal } from 'solid-js';

export const FileUploadArea: Component = () => {
  const [isDragging, setIsDragging] = createSignal(false);
  
  return (
    <div id="upload" class="content-panel active">
      <div class="upload-section">
        <h2 style="color: var(--barbie-pink); margin-bottom: 20px;">
          📤 Upload Malware Sample
        </h2>
        
        <div 
          class="upload-area"
          classList={{ 'dragging': isDragging() }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            // Handle file drop
          }}
        >
          <input type="file" id="file-upload" multiple />
          <div class="upload-icon">📤</div>
          <h3>Upload Malware Sample for Analysis</h3>
          <p id="upload-description">
            Drag and drop files here or click to browse<br/>
            Supports: PE, ELF, Mach-O, Office docs, PDFs, APKs, Archives<br/>
            Maximum file size: 100MB per file
          </p>
          <button class="btn btn-primary">Choose Files</button>
        </div>
      </div>
      
      <div class="config-grid">
        <AnalysisConfig />
        <QuickStats />
      </div>
    </div>
  );
};
```

### Analysis Panel Components
```tsx
// src/components/solid/analysis/AnalysisPanel.tsx
interface AnalysisPanelProps {
  title: string;
  icon: string;
  children: any;
}

export const AnalysisPanel: Component<AnalysisPanelProps> = (props) => {
  return (
    <div class="analysis-panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <span aria-hidden="true">{props.icon}</span>
          {props.title}
        </h3>
      </div>
      {props.children}
    </div>
  );
};
```

### Code Editor Component
```tsx
// src/components/solid/shared/CodeEditor.tsx
interface CodeEditorProps {
  title?: string;
  content: string;
  language?: string;
}

export const CodeEditor: Component<CodeEditorProps> = (props) => {
  return (
    <div class="code-editor">
      {props.title && (
        <div class="code-header">{props.title}</div>
      )}
      <div class="code-content">
        <pre>{props.content}</pre>
      </div>
    </div>
  );
};
```

## 4. AI Ensemble Components

### Ensemble Results Component
```tsx
// src/components/solid/analysis/AIEnsembleResults.tsx
interface AIResult {
  provider: string;
  icon: string;
  prediction: string;
  confidence: number;
}

export const AIEnsembleResults: Component = () => {
  const results: AIResult[] = [
    { provider: 'Claude 3.5 Sonnet', icon: '🤖', prediction: 'Identified vulnerable entry points...', confidence: 92 },
    { provider: 'GPT-4 Turbo', icon: '🧠', prediction: 'Architecture suggests multi-stage...', confidence: 88 },
    // etc.
  ];
  
  return (
    <div class="ensemble-results">
      <h3 style="color: var(--barbie-pink); margin-bottom: 15px;">
        🤖 AI Provider Ensemble Analysis
      </h3>
      
      <div class="ensemble-consensus">
        <div class="consensus-score">94% Confidence</div>
        <div style="color: var(--text-secondary);">
          <strong>Consensus:</strong> High-risk malware - Trojan/Info-stealer
        </div>
      </div>
      
      <div class="agent-results">
        <For each={results}>
          {(result) => (
            <div class="agent-result">
              <div class="agent-name">{result.icon} {result.provider}</div>
              <div class="agent-prediction">{result.prediction}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
};
```

## 5. Stat Cards Component

```tsx
// src/components/solid/shared/StatCard.tsx
interface StatCardProps {
  value: string | number;
  label: string;
}

export const StatCard: Component<StatCardProps> = (props) => {
  return (
    <div class="stat-card">
      <div class="stat-value">{props.value}</div>
      <div class="stat-label">{props.label}</div>
    </div>
  );
};

// Usage in grid
export const StatsOverview: Component = () => {
  return (
    <div class="stats-overview">
      <StatCard value="PE32" label="File Type" />
      <StatCard value="2.3MB" label="File Size" />
      <StatCard value="7.82" label="Entropy Score" />
      <StatCard value="UPX" label="Packer Detected" />
    </div>
  );
};
```

## 6. Button Components

```tsx
// src/components/solid/shared/Button.tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  onClick?: () => void;
  children: any;
}

export const Button: Component<ButtonProps> = (props) => {
  return (
    <button 
      class={`btn btn-${props.variant || 'primary'}`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
};
```

## Implementation Priority

1. **Phase 1 - Core Layout**
   - Update main.css with all template styles
   - Fix Header component styling
   - Update Sidebar with proper priority sections
   - Implement basic panel switching

2. **Phase 2 - Content Panels**
   - FileUploadArea with drag-drop
   - AnalysisPanel wrapper component
   - StatCard components
   - CodeEditor component

3. **Phase 3 - Analysis Pages**
   - Static Analysis page
   - Dynamic Analysis page
   - Network Analysis page
   - Memory Analysis page

4. **Phase 4 - Advanced Features**
   - AI Ensemble visualization
   - YARA Rules editor
   - Custom Workflows
   - Platform Configuration

## Testing Each Component
- Visual comparison with template screenshots
- Interaction testing (hover, active states)
- Responsive behavior
- Accessibility compliance