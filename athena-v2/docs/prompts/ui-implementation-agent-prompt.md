# UI Implementation Agent Prompt

## 🚨 CRITICAL: Context Management Protocol 🚨

**MANDATORY CONTEXT MONITORING**: You MUST check your context usage after EVERY major task completion. When you reach approximately 15% remaining context (before auto-compact):

1. **IMMEDIATELY STOP** all implementation work
2. **CREATE** a new handoff document: `ui-implementation-handoff-v3.md`
3. **DOCUMENT** all completed work with:
   - Exact file paths and line numbers for changes
   - Before/after code snippets for significant modifications
   - Visual verification notes
4. **LIST** remaining tasks with priority levels
5. **SAVE** all changes and inform the user about context limit
6. **DO NOT** continue implementing after 15% threshold

## Your Mission

Continue implementing UI styling for the Athena Platform malware analysis tool to achieve perfect visual parity with the reference template. The app has been scaled to 80% size, and several components have been styled. Your focus is on completing the remaining styling tasks.

## Essential References

### Template File (Your Visual Bible)
```
Path: /Users/kali/Athena/Athena/docs/prompts/tauri/athena_tauri_UI_template.html
```
**ACTION**: Open this file in a browser immediately to see the target design. Every styling decision must match this template exactly.

### Current Application State
- App is running with 80% scale applied
- Core layout and many components already styled
- Pink/Barbie aesthetic implemented throughout
- Scrollable panels implemented with custom scrollbar styling

## High Priority Tasks (In Order)

### 1. Console Output Styling in Dynamic Analysis
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/DynamicAnalysis.tsx`

**Required Implementation**:
```css
.behavioral-console {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  background: var(--code-bg);
  padding: 15px;
  border-radius: 6px;
  overflow: auto;
  max-height: 400px;
}

.console-line {
  margin: 2px 0;
}

.console-line.success { color: var(--success-color); }
.console-line.warning { color: var(--warning-color); }
.console-line.danger { color: var(--danger-color); }
.console-line.info { color: var(--info-color); }
```

**Check for**: Look in the Behavioral Analysis section for console output display

### 2. AI Ensemble Results Formatting
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/AIEnsemble.tsx`

**Verify**:
- Consensus score display format (should be large, centered)
- Agent result cards spacing (gap: 10px)
- Background colors match template
- Model names are properly formatted

### 3. Static Analysis Page Fixes
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/StaticAnalysis.tsx`

**Required**:
- Hash displays: `font-family: 'JetBrains Mono', monospace`
- File properties: proper key-value formatting
- Entropy visualization: gradient bar with percentage

### 4. Dynamic Analysis MITRE ATT&CK Cards
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/DynamicAnalysis.tsx`

**Style Requirements**:
- Cards with technique codes
- Proper categorization layout
- Color coding by severity

### 5. Reports Page Export Buttons
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/Reports.tsx`

**Button Styling**:
```css
.btn-export {
  background: linear-gradient(135deg, var(--barbie-pink) 0%, var(--barbie-accent) 100%);
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-export:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(255, 107, 157, 0.4);
}
```

## Working Directory Structure
```
/Users/kali/Athena/Athena/athena-v2/
├── src/
│   ├── styles/
│   │   └── main.css                 # Global styles (already has 80% scale)
│   ├── components/solid/
│   │   ├── analysis/
│   │   │   ├── DynamicAnalysis.tsx  # Console output, MITRE cards
│   │   │   ├── StaticAnalysis.tsx   # Hash display, file properties
│   │   │   ├── Reports.tsx          # Export buttons, report preview
│   │   │   ├── AIEnsemble.tsx       # AI consensus results
│   │   │   ├── AIEnsemble.css       # Component-specific styles
│   │   │   └── [component].css      # Other component styles
│   │   └── shared/
│   │       └── StatCard.tsx         # Already styled correctly
└── docs/prompts/tauri/athena_tauri_UI_template.html  # YOUR REFERENCE
```

## Testing Protocol

1. **Start the application**:
   ```bash
   cd /Users/kali/Athena/Athena/athena-v2
   npm run tauri dev
   ```

2. **Open template for comparison**:
   - Open the HTML template in a browser
   - Position windows side-by-side

3. **Test each component**:
   - Navigate to each analysis tab
   - Compare visually with template
   - Check hover states and animations
   - Verify color accuracy

## CSS Variables Reference
```css
/* Core colors - use these consistently */
--barbie-pink: #ff6b9d;
--barbie-accent: #ff9ec7;
--code-bg: #1e1e3f;
--success-color: #4ecdc4;
--warning-color: #ffd93d;
--danger-color: #ff6b6b;
--info-color: #74b9ff;
--text-secondary: #b8b8d4;
```

## Implementation Guidelines

### DO:
- ✅ Use TodoWrite to track progress
- ✅ Check template visually after each change
- ✅ Monitor context usage after each component
- ✅ Test in the running application
- ✅ Use component-specific CSS files when they exist
- ✅ Maintain the 80% scale that's already applied

### DON'T:
- ❌ Change the app scale (it's already 80%)
- ❌ Modify core layout structure
- ❌ Add dark backgrounds to panel headers
- ❌ Change completed components without testing
- ❌ Continue past 15% context remaining

## Context Monitoring Commands

Use these to track your progress:
```bash
# Search for TODOs
rg "TODO|FIXME" src/

# Find specific components
rg "console|behavioral|Console" src/components/solid/analysis/

# Check CSS usage
rg "behavioral-console|console-line" src/styles/
```

## Handoff Document Template

When you reach 15% context, create `ui-implementation-handoff-v3.md`:

```markdown
# UI Implementation Handoff - Phase 3

## Context Usage at Handoff: [X]%

## Completed Tasks
1. [Task name]
   - File: [path]
   - Changes: [description]
   - Lines: [line numbers]

## Remaining Tasks
1. [Task name]
   - Priority: [High/Medium/Low]
   - Location: [file path]
   - Required changes: [specific description]

## Notes for Next Agent
- [Any gotchas or important observations]
- [Testing notes]
- [Visual verification status]
```

## Success Metrics

Your implementation is successful when:
1. Console output shows proper colors and monospace font
2. All code displays use JetBrains Mono
3. Export buttons have gradient backgrounds
4. MITRE ATT&CK cards are properly styled
5. No visual discrepancies with template remain

## Final Reminder

**CHECK CONTEXT USAGE NOW** and after each major task. The success of this implementation depends on proper handoff to the next agent if needed. The user wants all styling completed, so ensure smooth continuation by creating detailed handoff documentation.

---
*Created for: Claude Code UI Implementation Agent*
*Reference Template: athena_tauri_UI_template.html*
*Current Scale: 80% (already applied)*
*Priority: Complete all remaining UI styling tasks*