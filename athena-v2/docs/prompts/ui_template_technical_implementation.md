# UI Template Technical Implementation Guide

## Exact CSS Classes from Template

### Core Layout Classes
```css
.app-container /* Main app wrapper */
.header /* Top header bar */
.main-content /* Contains sidebar + analysis area */
.analysis-sidebar /* Left navigation sidebar */
.analysis-area /* Central content area */
.content-panels /* Container for all panels */
.content-panel /* Individual panel container */
.content-panel.active /* Active panel display */
```

### Panel Structure Classes
```css
.analysis-grid /* Grid: 2fr 1fr layout */
.analysis-main /* Left column in grid */
.analysis-panel /* Individual analysis section */
.panel-header /* Header with title + actions */
.panel-title /* Title with emoji + text */
.ensemble-results /* Right sidebar in grid */
```

### Visual Elements Classes
```css
.stat-card /* Stat cards with gradient border */
.stat-value /* Large pink numbers */
.stat-label /* Small gray labels */
.code-editor /* Dark code display blocks */
.code-content /* Content inside code blocks */
.ensemble-consensus /* Consensus score block */
.consensus-score /* Large percentage text */
.agent-results /* Container for AI results */
.agent-result /* Individual AI result */
.agent-name /* Provider name */
.agent-prediction /* Provider prediction text */
```

### Button Classes
```css
.btn /* Base button class */
.btn-primary /* Pink gradient button */
.btn-secondary /* Dark button with border */
```

### Sidebar Classes
```css
.sidebar-header /* Section headers in sidebar */
.sidebar-content /* Scrollable content area */
.priority-section /* Priority grouping */
.priority-header /* Priority section header */
.critical-priority /* Red priority styling */
.important-priority /* Yellow priority styling */
.advanced-priority /* Teal priority styling */
.sidebar-item /* Navigation items */
.sidebar-item.active /* Active nav item (pink bg) */
.ensemble-status /* AI provider status section */
.agent-status-grid /* Grid for provider statuses */
.agent-status /* Individual provider status */
.agent-status-dot /* Status indicator dot */
```

## Key Styling Rules from Template

### 1. Panel Container (ALL panels must have this)
```css
background: #252545;
border: 2px dotted #ff6b9d;
border-radius: 8px;
padding: 20px;
```

### 2. Stat Cards
```css
background: linear-gradient(135deg, rgba(255,107,157,0.1) 0%, rgba(255,107,157,0.05) 100%);
border: 1px solid rgba(255,107,157,0.3);
border-radius: 8px;
padding: 20px;
text-align: center;
/* Plus gradient top border */
::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(135deg, #ff6b9d 0%, #c7ecee 100%);
}
```

### 3. Code Editor Blocks
```css
background: #1e1e3f;
border: 1px solid #0f3460;
border-radius: 8px;
font-family: 'JetBrains Mono', monospace;
font-size: 0.85rem;
padding: 15px;
color: #b8b8d4;
```

### 4. Analysis Grid Layout
```css
display: grid;
grid-template-columns: 2fr 1fr;
gap: 20px;
```

## SolidJS Component Mapping

### 1. Update FileUploadArea.tsx Structure
```tsx
<div class="content-panel">
  <h2 style="color: var(--barbie-pink);">📤 Upload Malware Sample</h2>
  
  <div class="upload-area">
    {/* Upload implementation */}
  </div>
  
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
    <div class="analysis-panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <span>⚙️</span> Analysis Configuration
        </h3>
      </div>
      {/* Configuration options */}
    </div>
    
    <div class="analysis-panel">
      <div class="panel-header">
        <h3 class="panel-title">
          <span>📊</span> Quick Stats
        </h3>
      </div>
      <div class="stats-overview">
        {/* Stat cards */}
      </div>
    </div>
  </div>
</div>
```

### 2. Update StaticAnalysis.tsx Structure
```tsx
<div class="content-panel">
  <h2 style="color: var(--barbie-pink);">🔍 Static Analysis Results</h2>
  
  <div class="stats-overview">
    <div class="stat-card">
      <div class="stat-value">PE32</div>
      <div class="stat-label">File Type</div>
    </div>
    {/* More stat cards */}
  </div>
  
  <div class="analysis-grid">
    <div class="analysis-main">
      <div class="analysis-panel">
        <div class="panel-header">
          <h3 class="panel-title">
            <span>🔐</span> File Hashes & Properties
          </h3>
        </div>
        <div class="code-editor">
          <div class="code-content">
            {/* Hash content */}
          </div>
        </div>
      </div>
      {/* More panels */}
    </div>
    
    <div class="ensemble-results">
      <h3 style="color: var(--barbie-pink);">
        🤖 AI Provider Ensemble Analysis
      </h3>
      <div class="ensemble-consensus">
        <div class="consensus-score">94% Confidence</div>
        {/* Consensus details */}
      </div>
      <div class="agent-results">
        {/* AI results */}
      </div>
    </div>
  </div>
</div>
```

### 3. Required CSS Additions to main.css
```css
/* Panel with dotted border */
.content-panel {
  background: #252545;
  border: 2px dotted #ff6b9d;
  border-radius: 8px;
  padding: 20px;
  margin: 20px;
}

/* Stat cards */
.stat-card {
  background: linear-gradient(135deg, rgba(255,107,157,0.1) 0%, rgba(255,107,157,0.05) 100%);
  border: 1px solid rgba(255,107,157,0.3);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(135deg, #ff6b9d 0%, #c7ecee 100%);
}

/* Stats grid */
.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

/* Analysis grid */
.analysis-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  height: calc(100vh - 300px);
}

/* Code editor styling */
.code-editor {
  background: #1e1e3f;
  border: 1px solid #0f3460;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  overflow: auto;
}

.code-content {
  padding: 15px;
  line-height: 1.4;
  color: #b8b8d4;
}

/* Panel headers */
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.panel-title {
  font-weight: 600;
  color: #ff6b9d;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Ensemble results */
.ensemble-consensus {
  background: #1e1e3f;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
  border-left: 4px solid #4ecdc4;
}

.consensus-score {
  font-size: 1.5rem;
  font-weight: 700;
  color: #4ecdc4;
  margin-bottom: 5px;
}

/* Agent results */
.agent-results {
  display: grid;
  gap: 10px;
}

.agent-result {
  background: #1e1e3f;
  border-radius: 6px;
  padding: 12px;
  font-size: 0.85rem;
}

.agent-name {
  font-weight: 600;
  color: #ff6b9d;
  margin-bottom: 5px;
}

.agent-prediction {
  color: #b8b8d4;
  line-height: 1.4;
}
```

## Implementation Steps

1. **Update Global CSS**
   - Copy all CSS classes from template to main.css
   - Ensure color variables match exactly
   - Add missing classes for panels, grids, etc.

2. **Create Reusable Components**
   - StatCard.tsx component
   - AnalysisPanel.tsx wrapper
   - CodeEditor.tsx component

3. **Update Each Panel Component**
   - Wrap in content-panel div
   - Use exact class names from template
   - Match HTML structure precisely

4. **Fix Sidebar**
   - Add priority sections with proper colors
   - Add AI provider status grid at bottom
   - Use exact sidebar-item classes

5. **Header Updates**
   - Add status pills on right
   - Use gradient logo background
   - Match exact spacing

## Component Props

### StatCard Component
```tsx
interface StatCardProps {
  value: string;
  label: string;
}
```

### AnalysisPanel Component
```tsx
interface AnalysisPanelProps {
  title: string;
  icon: string;
  children: JSX.Element;
  actions?: JSX.Element;
}
```

### AgentResult Component
```tsx
interface AgentResultProps {
  provider: string;
  icon: string;
  confidence: number;
  prediction: string;
}
```