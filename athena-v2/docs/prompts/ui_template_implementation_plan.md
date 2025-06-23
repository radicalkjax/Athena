# UI Template Implementation Plan - EXACT MATCH

## Current Status
- UI components exist but don't match template visual design
- Need to implement exact styling, layouts, and visual elements from template
- Focus on pixel-perfect recreation of template design

## Critical Visual Elements to Match:

### 1. Panel Styling (ALL PANELS)
- **Border**: Pink dotted border (2px dotted #ff6b9d)
- **Background**: Dark panel background (#252545)
- **Border Radius**: 8px
- **Padding**: 20px
- **Box Shadow**: Subtle shadow for depth

### 2. Typography Standards
- **Headers**: Pink color (#ff6b9d), Inter font, bold
- **Panel Titles**: Emoji + text format, consistent sizing
- **Code/Data**: JetBrains Mono font, #b8b8d4 color
- **Stat Numbers**: Large, bold, pink color

### 3. Stat Cards (Critical for Static Analysis)
```css
.stat-card {
  background: linear-gradient(135deg, rgba(255,107,157,0.1) 0%, rgba(255,107,157,0.05) 100%);
  border: 1px solid rgba(255,107,157,0.3);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}
.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  color: #ff6b9d;
  margin-bottom: 5px;
}
.stat-label {
  font-size: 0.9rem;
  color: #b8b8d4;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

## Priority Updates by Panel:

### Priority 1: Sample Upload Panel
**Current**: Simple upload area
**Required Changes**:
1. Add pink dotted border container
2. Implement two-column layout:
   - Left: Upload area + Analysis Configuration
   - Right: Quick Stats sidebar
3. Analysis Configuration section:
   - Checkboxes for analysis types
   - Dropdown for sandbox environment
   - Blue "Choose Files" button
4. Quick Stats cards:
   - "2,847" Samples Analyzed Today
   - "94.3%" AI Provider Accuracy
   - "1.2s" Avg Analysis Time

### Priority 2: Static Analysis Panel
**Current**: Text-based display
**Required Changes**:
1. Top stat cards row (4 cards):
   - PE32 (File Type)
   - 2.3MB (File Size)
   - 7.82 (Entropy Score)
   - UPX (Packer Detected)
2. Two-column layout below stats:
   - Left: File Hashes & Properties + Strings & Indicators
   - Right: AI Provider Ensemble Analysis
3. Code blocks with proper styling:
   - Dark background (#1e1e3f)
   - Monospace font
   - Syntax highlighting

### Priority 3: Dynamic Analysis Panel
**Current**: Basic layout
**Required Changes**:
1. CAPE Sandbox branding in header
2. Two main sections with pink dotted borders:
   - Behavioral Analysis (with View Screenshots button)
   - Network Activity
3. Right sidebar:
   - MITRE ATT&CK Mapping cards
   - Recommendations section
4. Color-coded console output (green/yellow/red prefixes)

### Priority 4: AI Provider Ensemble Panel
**Current**: Not properly styled
**Required Changes**:
1. Large consensus percentage (94% Consensus)
2. Final classification banner
3. Provider cards with:
   - Emoji icons for each provider
   - Confidence percentages
   - Detailed predictions
4. Right sidebar:
   - Ensemble Metrics
   - Generated Artifacts buttons

### Priority 5: All Panels - Common Elements
1. **Sidebar Navigation**:
   - Pink highlighted active item
   - Provider status indicators (green dots)
   - Proper spacing and icons

2. **Header Bar**:
   - Gradient logo
   - Status pills on right
   - Consistent height and padding

3. **Buttons**:
   - Primary: Pink background, white text
   - Secondary: Transparent with border
   - Consistent padding and hover states

## CSS Updates Required:
```css
/* Panel container */
.content-panel {
  background: #252545;
  border: 2px dotted #ff6b9d;
  border-radius: 8px;
  padding: 20px;
  margin: 20px;
}

/* Analysis grid */
.analysis-grid {
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 20px;
}

/* Code editor blocks */
.code-editor {
  background: #1e1e3f;
  border-radius: 6px;
  padding: 15px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.9rem;
  color: #b8b8d4;
  overflow-x: auto;
}
```

## Implementation Order:
1. Update global CSS with exact colors and fonts
2. Create reusable stat-card component
3. Update each panel to match exact template layout
4. Implement missing visual elements (dots, gradients, shadows)
5. Ensure responsive behavior matches template