# UI Template Component Update Checklist

## Global CSS Updates

### 1. Main Stylesheet (main.css)
- [ ] Add stat-card classes with gradient backgrounds
- [ ] Update content-panel with dotted border styling
- [ ] Add panel-header consistent styling
- [ ] Implement button variants (btn-primary, btn-secondary)
- [ ] Add focus states and hover effects
- [ ] Ensure all colors match template exactly

### 2. Component-Specific Styles
- [ ] Create dedicated CSS modules for complex components
- [ ] Implement responsive grid layouts
- [ ] Add animation transitions for interactions

## Component Updates by Priority

### Priority 1: FileUploadArea.tsx
- [ ] Wrap in content-panel with pink dotted border
- [ ] Split into two-column layout (main + stats sidebar)
- [ ] Add Analysis Configuration section:
  - [ ] Static Analysis checkbox
  - [ ] Dynamic Analysis checkbox
  - [ ] AI Provider Ensemble checkbox
  - [ ] Advanced Reverse Engineering checkbox
  - [ ] Sandbox Environment dropdown
- [ ] Implement Quick Stats sidebar:
  - [ ] Samples Analyzed Today card
  - [ ] AI Provider Accuracy card
  - [ ] Avg Analysis Time card
- [ ] Style upload area to match template exactly
- [ ] Change button to blue "Choose Files" style

### Priority 2: StaticAnalysis.tsx
- [ ] Add top stat cards row:
  - [ ] File Type card (PE32)
  - [ ] File Size card (2.3MB)
  - [ ] Entropy Score card (7.82)
  - [ ] Packer Detected card (UPX)
- [ ] Restructure layout to two columns
- [ ] Style code blocks with dark background (#1e1e3f)
- [ ] Format hashes with proper spacing
- [ ] Add visual separators between sections

### Priority 3: DynamicAnalysis.tsx
- [ ] Update header with CAPE Sandbox branding
- [ ] Style behavioral analysis with proper prefixes
- [ ] Add "View Screenshots" button in header
- [ ] Format network activity section
- [ ] Style MITRE ATT&CK cards
- [ ] Add recommendations with bullet points
- [ ] Implement color-coded output lines

### Priority 4: AIEnsemble.tsx
- [ ] Create large consensus percentage display
- [ ] Add final classification banner
- [ ] Style provider cards with:
  - [ ] Provider emoji icons
  - [ ] Confidence percentages
  - [ ] Detailed predictions
- [ ] Add Ensemble Metrics sidebar
- [ ] Implement Generated Artifacts buttons

### Priority 5: Sidebar.tsx
- [ ] Update active item highlighting (pink background)
- [ ] Add provider status indicators (green dots)
- [ ] Implement proper section headers
- [ ] Add priority badges (Critical/Important/Advanced)
- [ ] Ensure proper spacing and alignment

### Priority 6: New Components

#### StatCard Component
```tsx
interface StatCardProps {
  value: string;
  label: string;
  color?: string;
}
```
- [ ] Create reusable StatCard component
- [ ] Implement gradient background
- [ ] Add hover effects

#### AnalysisConfiguration Component
- [ ] Create checkbox group component
- [ ] Add sandbox environment selector
- [ ] Implement configuration state management

#### Reports.tsx (New)
- [ ] Create Reports panel component
- [ ] Add report generation options
- [ ] Implement export format selection
- [ ] Add historical reports list

### Priority 7: Additional UI Elements
- [ ] Header status pills (AI Providers Ready, etc.)
- [ ] Loading states with pink accents
- [ ] Error states with proper styling
- [ ] Success notifications
- [ ] Progress indicators

## Testing Checklist
- [ ] Visual regression testing against template
- [ ] Responsive behavior at different screen sizes
- [ ] Dark mode consistency
- [ ] Accessibility compliance (WCAG AA)
- [ ] Cross-browser compatibility

## Visual Consistency Checks
- [ ] All panels have pink dotted borders
- [ ] Consistent emoji usage in headers
- [ ] Proper font weights and sizes
- [ ] Color accuracy (#ff6b9d for pink)
- [ ] Spacing and padding consistency
- [ ] Shadow and depth effects

## Performance Considerations
- [ ] Optimize CSS for production
- [ ] Lazy load heavy components
- [ ] Minimize re-renders
- [ ] Bundle size optimization