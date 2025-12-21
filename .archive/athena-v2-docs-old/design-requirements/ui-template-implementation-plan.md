# Athena UI Template Implementation Plan

## Overview
This document outlines the technical plan to implement the Athena UI template (HTML/CSS) into our Tauri 2 + SolidJS application to achieve 1:1 visual parity.

## Design System Foundation

### Color Palette & CSS Variables
```css
:root {
  /* Primary colors */
  --primary-bg: #1a1a2e;
  --secondary-bg: #16213e;
  --accent-bg: #0f3460;
  --panel-bg: #252545;
  --border-color: #ff6b9d;
  --text-primary: #ffffff;
  --text-secondary: #b8b8d4;
  --text-accent: #ff6b9d;
  
  /* Status colors */
  --success-color: #4ecdc4;
  --warning-color: #ffd93d;
  --danger-color: #ff6b6b;
  --info-color: #74b9ff;
  --code-bg: #1e1e3f;
  
  /* Barbie aesthetic */
  --barbie-pink: #ff6b9d;
  --barbie-accent: #ff9ec7;
  --barbie-light: #ffcde1;
  --barbie-gradient: linear-gradient(135deg, #ff6b9d 0%, #c7ecee 100%);
  
  /* Priority indicators */
  --critical-color: #ff6b6b;
  --important-color: #ffd93d;
  --advanced-color: #4ecdc4;
}
```

### Typography
- Primary font: 'Inter' for UI elements
- Monospace font: 'JetBrains Mono' for code/technical content
- Font weights: 300, 400, 500, 600, 700

## Component Architecture

### 1. Layout Components

#### App Container
- **Current**: Basic flex layout
- **Target**: Full viewport height with proper overflow handling
- **Implementation**:
  ```tsx
  // App.tsx structure
  <div class="app-container">
    <Header />
    <div class="main-content">
      <Sidebar />
      <AnalysisArea />
    </div>
  </div>
  ```

#### Header Component
- **Current**: Basic header with title
- **Target**: 
  - Logo with gradient background and glow effect
  - Platform subtitle
  - Live status indicator with pulse animation
  - Height: Fixed 60-70px
  - Border-bottom: 2px solid var(--border-color)

#### Sidebar Component
- **Current**: Basic navigation list
- **Target**:
  - Width: 320px
  - Three priority sections (Critical, Important, Advanced)
  - Colored priority headers with icons
  - Active state with pink background
  - AI Provider Status grid at bottom
  - Hover states with background color transitions

### 2. Page Components

#### Sample Upload Page
- Upload area with dashed pink border
- Drag-and-drop functionality
- Configuration panel (Analysis Types)
- OS/Architecture selectors with dropdowns
- Quick Stats cards with gradient top border

#### Static Analysis Page
- Stats overview cards (File Type, Size, Entropy, Packer)
- Two-column grid layout
- Code editor panels with syntax highlighting
- AI Ensemble results sidebar

#### Dynamic Analysis Page
- Behavioral analysis console with colored output
- Network activity monitor
- MITRE ATT&CK mapping
- Process tree visualization

#### AI Ensemble Page
- Provider status cards
- Consensus score display
- Individual model results
- Confidence meters

#### Threat Intelligence Page
- IOC extraction panel
- Threat feed integration
- Attribution analysis

#### Analysis Reports Page
- Report generation interface
- Export options
- Template selection

### 3. Shared Components

#### Button Styles
```css
.btn {
  padding: 10px 20px;
  border: 2px solid transparent;
  border-radius: 6px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.btn-primary {
  background: var(--barbie-gradient);
  color: white;
  border-color: var(--barbie-pink);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(255, 107, 157, 0.3);
}
```

#### Panel Component
```css
.analysis-panel {
  background: var(--panel-bg);
  border: 1px solid var(--accent-bg);
  border-radius: 8px;
  padding: 20px;
}
```

#### Code Editor Component
```css
.code-editor {
  background: var(--code-bg);
  border: 1px solid var(--accent-bg);
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. **CSS Architecture**
   - Import template CSS variables into main.css
   - Set up font imports (Google Fonts)
   - Configure scrollbar styling
   - Add animation keyframes

2. **Layout Structure**
   - Update App.tsx with proper container structure
   - Implement responsive grid system
   - Add proper overflow handling

### Phase 2: Core Components (Week 1-2)
1. **Header Component**
   - Logo with gradient background
   - Status indicator with animations
   - Proper typography and spacing

2. **Sidebar Navigation**
   - Priority sections with proper styling
   - Active/hover states
   - AI Provider status grid
   - Smooth transitions

3. **Content Panels**
   - Tab navigation system
   - Panel switching logic
   - Active panel styling

### Phase 3: Page Components (Week 2-3)
1. **Upload Page**
   - Drag-drop area with visual feedback
   - Configuration panels
   - OS selector with dynamic options
   - Stats cards

2. **Analysis Pages**
   - Static Analysis with code viewers
   - Dynamic Analysis with console output
   - Network Analysis graphs
   - Memory Analysis visualizations

3. **Advanced Features**
   - YARA Rules editor
   - Custom Workflows builder
   - Platform Configuration

### Phase 4: Polish & Animations (Week 3-4)
1. **Animations**
   - Status dot pulse effects
   - Button hover transforms
   - Panel transitions
   - Loading states

2. **Accessibility**
   - ARIA labels and roles
   - Keyboard navigation
   - Focus states with proper outlines
   - Screen reader support

3. **Responsive Design**
   - Mobile breakpoints
   - Collapsible sidebar
   - Touch-friendly interactions

## Technical Considerations

### State Management
- Use SolidJS stores for:
  - Active panel/tab state
  - Analysis results
  - AI provider status
  - File upload state

### Tauri Integration
- File upload handling through Tauri APIs
- System file dialogs
- Native OS integration for drag-drop

### Performance
- Lazy load heavy components
- Virtual scrolling for large lists
- Memoize expensive computations
- Optimize re-renders

### Testing Strategy
1. Visual regression tests
2. Component unit tests
3. E2E tests for workflows
4. Accessibility audits

## Migration Checklist

- [ ] Import color variables and fonts
- [ ] Update layout structure
- [ ] Style Header component
- [ ] Style Sidebar with priority sections
- [ ] Implement tab navigation
- [ ] Create panel components
- [ ] Style buttons and forms
- [ ] Add animations and transitions
- [ ] Implement drag-drop upload
- [ ] Create analysis result displays
- [ ] Add AI ensemble visualization
- [ ] Implement responsive design
- [ ] Add accessibility features
- [ ] Perform visual QA against template

## Success Criteria
- 1:1 visual match with HTML template
- All animations and transitions working
- Fully responsive across devices
- Accessible with keyboard navigation
- Smooth performance with large datasets