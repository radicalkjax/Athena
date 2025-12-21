# Athena UI Implementation Roadmap

## Current State Analysis

### ✅ What's Already Implemented
1. **CSS Foundation**
   - Color variables match template
   - Font imports (Inter, JetBrains Mono)
   - Basic layout structure
   - Animation keyframes

2. **Components**
   - Header component exists but needs styling updates
   - Sidebar component exists with correct structure
   - Analysis panels are created
   - File upload area exists

### ❌ Gaps Identified

1. **Header Component**
   - Logo needs gradient background and glow effect
   - Logo should display ⚔️ icon instead of "A"
   - Status dot missing pulse animation
   - Missing proper styling classes

2. **Sidebar Component**
   - Missing ensemble status styling at bottom
   - AI provider status grid needs proper layout
   - Missing margin for ensemble-status section

3. **Content Panels**
   - Missing dotted border style on panels
   - Upload area needs exact template styling
   - Missing stat cards with gradient backgrounds
   - Panel headers need dark background

4. **Analysis Pages**
   - Missing proper grid layouts (2fr 1fr)
   - Code editor panels need styling
   - AI Ensemble results sidebar styling
   - Missing console output styling

## Implementation Roadmap

### Phase 1: Core Layout Fixes (Day 1-2)

#### Task 1.1: Update Header Component
```tsx
// Header.tsx updates needed:
- Change logo text from "A" to "⚔️"
- Add box-shadow: 0 0 10px rgba(255, 107, 157, 0.3) to logo
- Add status-dot element with pulse animation
- Update class names to match template
```

#### Task 1.2: Fix Sidebar Styling
```css
/* Updates needed in main.css */
.analysis-sidebar {
  width: 320px; /* Change from 260px */
  background: var(--secondary-bg); /* Change from #0f1420 */
  border-right: 1px solid var(--border-color); /* Change color */
}

.ensemble-status {
  margin: 15px; /* Add margin */
}
```

#### Task 1.3: Update Main Layout Structure
```tsx
// App.tsx structure update:
<div class="app-container">
  <Header />
  <div class="main-content"> {/* Change from main-layout */}
    <Sidebar />
    <main class="analysis-area">
      <div class="content-panels">
        {/* Panel content */}
      </div>
    </main>
  </div>
</div>
```

### Phase 2: Panel Styling (Day 2-3)

#### Task 2.1: Create Shared Panel Styles
```css
/* All panels need dotted border */
.analysis-panel {
  background: rgba(37, 37, 69, 0.6);
  border: 2px dotted var(--barbie-pink);
  border-radius: 12px;
  padding: 0;
  overflow: hidden;
}

.panel-header {
  padding: 15px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 107, 157, 0.2);
}
```

#### Task 2.2: Update Upload Area
- Add proper grid layout for configuration panels
- Style checkboxes with accent color
- Add dropdown styling for OS selectors
- Fix button gradient styling

#### Task 2.3: Create Stat Card Component
```tsx
// Create StatCard.tsx with gradient background
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
```

### Phase 3: Analysis Pages (Day 3-5)

#### Task 3.1: Static Analysis Page
- Implement 2fr 1fr grid layout
- Add stats overview with gradient cards
- Style code editor panels
- Add AI Ensemble results sidebar

#### Task 3.2: Dynamic Analysis Page
- Add console output styling with colors
- Create behavioral analysis panel
- Add network activity display
- Implement MITRE ATT&CK cards

#### Task 3.3: AI Ensemble Page
- Create provider cards with hover effects
- Add consensus display with confidence score
- Implement individual model results
- Add ensemble metrics panel

### Phase 4: Advanced Components (Day 5-7)

#### Task 4.1: Code Editor Enhancement
- Add line numbers
- Syntax highlighting colors
- Proper monospace font
- Scrollbar styling

#### Task 4.2: Network Analysis
- Traffic visualization
- Packet analysis panel
- Export functionality

#### Task 4.3: Memory Analysis
- Memory usage visualization
- Process tree display
- Resource monitoring

### Phase 5: Polish & Animations (Day 7-8)

#### Task 5.1: Animations
- Status dot pulse effect
- Button hover transforms
- Panel transitions
- Loading states

#### Task 5.2: Responsive Design
- Mobile breakpoints
- Collapsible sidebar
- Grid adjustments

#### Task 5.3: Accessibility
- ARIA labels
- Keyboard navigation
- Focus states
- Screen reader support

## File-by-File Changes Required

### 1. `/src/components/solid/layout/Header.tsx`
```tsx
// Changes needed:
- Update logo div to show ⚔️ icon
- Add status-dot element before text
- Update status text structure
- Add proper class names
```

### 2. `/src/components/solid/navigation/Sidebar.tsx`
```tsx
// Changes needed:
- Ensure ensemble-status is inside sidebar
- Update AI provider grid styling
- Add proper spacing
```

### 3. `/src/styles/main.css`
```css
// Major additions needed:
- Stat card gradient styles
- Panel dotted borders
- Console output colors
- Proper grid layouts
- Button gradient styles
```

### 4. `/src/components/solid/analysis/FileUploadArea.tsx`
```tsx
// Changes needed:
- Add configuration grid
- Style dropdowns
- Update checkbox styling
- Add stats section
```

### 5. Create New Components:
- `/src/components/solid/shared/StatCard.tsx`
- `/src/components/solid/shared/AnalysisPanel.tsx`
- `/src/components/solid/shared/CodeEditor.tsx`
- `/src/components/solid/analysis/AIEnsembleResults.tsx`

## Testing Checklist

### Visual Testing
- [ ] Compare each page with template screenshots
- [ ] Verify color accuracy
- [ ] Check spacing and alignment
- [ ] Test animations and transitions

### Functional Testing
- [ ] File upload drag-and-drop
- [ ] Tab switching
- [ ] Button interactions
- [ ] Dropdown functionality

### Responsive Testing
- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

### Accessibility Testing
- [ ] Keyboard navigation
- [ ] Screen reader compatibility
- [ ] Color contrast ratios
- [ ] Focus indicators

## Priority Order

1. **Critical (Must Have)**
   - Header styling fixes
   - Sidebar width and styling
   - Panel dotted borders
   - Stat card gradients
   - Upload area styling

2. **Important (Should Have)**
   - AI Ensemble results layout
   - Console output styling
   - Code editor improvements
   - Grid layouts

3. **Nice to Have**
   - Animations
   - Advanced visualizations
   - Responsive improvements

## Success Metrics
- 95% visual match with template
- All core features styled correctly
- Smooth animations and transitions
- Accessible to screen readers
- Responsive on all devices