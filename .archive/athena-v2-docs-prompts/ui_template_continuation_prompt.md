# UI Template Implementation Continuation Prompt

## Context
We are updating the Athena v2 Tauri application UI to exactly match the HTML template design. The template is located at `/docs/prompts/tauri/athena_tauri_UI_template.html` and template screenshots are in `/athena-v2/docs/prompts/tmp/template_screenshots/`.

## Current Status
We have analyzed the template and created implementation plans. The UI components exist but don't match the template's visual design. We need to implement exact styling, layouts, and visual elements from the template.

## Key Files Created/Updated
1. **UI Implementation Plan**: `/athena-v2/docs/prompts/ui_template_implementation_plan.md`
2. **Component Checklist**: `/athena-v2/docs/prompts/ui_template_component_checklist.md`
3. **Technical Implementation**: `/athena-v2/docs/prompts/ui_template_technical_implementation.md`

## Critical Visual Elements to Implement

### 1. Panel Styling (ALL PANELS)
```css
background: #252545;
border: 2px dotted #ff6b9d;
border-radius: 8px;
padding: 20px;
```

### 2. Stat Cards
```css
.stat-card {
  background: linear-gradient(135deg, rgba(255,107,157,0.1) 0%, rgba(255,107,157,0.05) 100%);
  border: 1px solid rgba(255,107,157,0.3);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}
```

### 3. Layout Structure
- Use `analysis-grid` class with `grid-template-columns: 2fr 1fr`
- Left column: `analysis-main` containing multiple `analysis-panel`
- Right column: `ensemble-results` for AI results and stats

## Components Requiring Updates

### Priority 1: FileUploadArea.tsx
- Add pink dotted border container
- Split into two-column layout (main + stats sidebar)
- Add Analysis Configuration section with checkboxes
- Implement Quick Stats cards (2,847 Samples, 94.3% Accuracy, 1.2s Time)

### Priority 2: StaticAnalysis.tsx  
- Add top stat cards row (PE32, 2.3MB, 7.82, UPX)
- Use exact `analysis-grid` layout
- Style code blocks with dark background (#1e1e3f)
- Match ensemble results sidebar structure

### Priority 3: DynamicAnalysis.tsx
- Add CAPE Sandbox branding
- Color-coded console output (green/yellow/red)
- MITRE ATT&CK mapping cards
- Recommendations section

### Priority 4: AIEnsemble.tsx
- Large consensus percentage display
- Provider cards with emoji icons
- Ensemble Metrics sidebar
- Generated Artifacts buttons

### Priority 5: Sidebar.tsx
- Pink highlighted active item
- Provider status indicators (green dots)
- Priority sections (Critical/Important/Advanced)

## CSS Classes from Template
```css
/* Core layout */
.content-panel
.analysis-grid
.analysis-main
.analysis-panel
.ensemble-results

/* Visual elements */
.stat-card
.stat-value
.stat-label
.code-editor
.code-content
.panel-header
.panel-title

/* Sidebar */
.priority-section
.critical-priority
.important-priority
.advanced-priority
.sidebar-item
.sidebar-item.active
.agent-status-grid
```

## Next Steps
1. Update `main.css` with all CSS classes from the technical implementation guide
2. Create reusable components (StatCard, AnalysisPanel, CodeEditor)
3. Update each panel component to match exact template structure
4. Test visual consistency against template screenshots

## Important Notes
- The template HTML has all exact styling and structure needed
- Screenshots show the expected visual output for each panel
- All panels must have pink dotted borders
- Maintain exact color values (#ff6b9d for pink, #1e1e3f for code backgrounds)
- Use exact font families (Inter for UI, JetBrains Mono for code)

## File Locations
- Template HTML: `/Users/kali/Athena/Athena/docs/prompts/tauri/athena_tauri_UI_template.html`
- Screenshots: `/Users/kali/Athena/Athena/athena-v2/docs/prompts/tmp/template_screenshots/`
- Components: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/`
- Styles: `/Users/kali/Athena/Athena/athena-v2/src/styles/main.css`

Continue implementing the UI updates following the exact specifications from the template.