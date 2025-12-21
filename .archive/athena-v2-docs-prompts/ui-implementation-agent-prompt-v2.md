# UI Implementation Agent Prompt - Phase 4

## 🚨 CRITICAL: Context Management Protocol 🚨

**MANDATORY CONTEXT MONITORING**: You MUST check your context usage after EVERY major task completion. When you reach approximately 15% remaining context (before auto-compact):

1. **IMMEDIATELY STOP** all implementation work
2. **CREATE** a new handoff document: `ui-implementation-handoff-v4.md`
3. **DOCUMENT** all completed work with:
   - Exact file paths and line numbers for changes
   - Before/after code snippets for significant modifications
   - Visual verification notes
4. **LIST** remaining tasks with priority levels
5. **SAVE** all changes and inform the user about context limit
6. **DO NOT** continue implementing after 15% threshold

## Your Mission

Continue implementing UI styling for the Athena Platform malware analysis tool to achieve perfect visual parity with the reference template. Many components have been styled already - your task is to complete the remaining pages while maintaining consistency with established patterns.

## Essential Context

### Previous Work Completed
Read the handoff document FIRST: `/Users/kali/Athena/Athena/athena-v2/docs/prompts/ui-implementation-handoff-v3.md`

This contains:
- All completed styling tasks
- Established patterns and conventions
- Remaining work prioritized

### Template File (Your Visual Bible)
```
Path: /Users/kali/Athena/Athena/docs/prompts/tauri/athena_tauri_UI_template.html
```
**ACTION**: Open this file in a browser to see the target design. Every styling decision must match this template exactly.

### Current Application State
- App is running with 80% scale applied (DO NOT CHANGE)
- Core layout and many analysis pages already styled
- Pink/Barbie aesthetic implemented throughout
- Logo integrated in header
- Custom scrollbar styling implemented

## High Priority Remaining Tasks

### 1. Memory Analysis Page
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/MemoryAnalysis.tsx`

**Required Styling**:
- Memory dump display with hex viewer styling
- Process list with proper table formatting
- String analysis section with monospace font
- Memory usage visualization

### 2. YARA Scanner Page
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/YaraScanner.tsx`

**Required Styling**:
- Rule editor with syntax highlighting
- Scan results table with match highlighting
- Rule management sidebar
- Progress indicators for scanning

### 3. Custom Workflows Page
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/CustomWorkflows.tsx`

**Required Styling**:
- Workflow builder canvas
- Node connection lines
- Execution status indicators
- Workflow templates gallery

### 4. Behavioral Analysis Page
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/BehavioralAnalysis.tsx`

**Required Styling**:
- Timeline visualization
- Event cards with severity indicators
- Risk score displays
- Behavior pattern matching

### 5. System Monitor Page
**Location**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/SystemMonitor.tsx`

**Required Styling**:
- Resource usage graphs
- Process viewer table
- Performance metrics cards
- Real-time update indicators

## Working Directory Structure
```
/Users/kali/Athena/Athena/athena-v2/
├── src/
│   ├── styles/
│   │   └── main.css                 # Global styles (80% scale already applied)
│   ├── assets/
│   │   └── images/
│   │       └── logo.png            # Athena logo
│   ├── components/solid/
│   │   ├── analysis/
│   │   │   ├── MemoryAnalysis.tsx  # Needs styling
│   │   │   ├── YaraScanner.tsx     # Needs styling
│   │   │   ├── CustomWorkflows.tsx # Needs styling
│   │   │   ├── BehavioralAnalysis.tsx # Needs styling
│   │   │   ├── SystemMonitor.tsx   # Needs styling
│   │   │   └── [component].css     # Create CSS files as needed
│   │   └── shared/
│   │       └── [shared components] # Already styled
└── docs/prompts/
    ├── tauri/athena_tauri_UI_template.html  # Reference template
    └── ui-implementation-handoff-v3.md       # Previous work documentation
```

## Implementation Guidelines

### Established Patterns (MUST FOLLOW)
1. **Code/Monospace Text**:
   ```css
   font-family: 'JetBrains Mono', monospace;
   font-size: 0.85rem;
   ```

2. **Cards/Panels**:
   ```css
   background: var(--panel-bg);
   border: 1px solid var(--accent-bg);
   border-radius: 8px;
   padding: 20px;
   ```

3. **Primary Buttons**:
   ```css
   background: linear-gradient(135deg, var(--barbie-pink) 0%, var(--barbie-accent) 100%);
   color: white;
   border: none;
   padding: 10px 20px;
   border-radius: 6px;
   font-weight: 600;
   cursor: pointer;
   transition: all 0.3s ease;
   ```

4. **Hover Effects**:
   ```css
   transform: translateY(-2px);
   box-shadow: 0 5px 15px rgba(255, 107, 157, 0.4);
   ```

### CSS Variables Reference
```css
/* Use these consistently */
--barbie-pink: #ff6b9d;
--barbie-accent: #ff9ec7;
--code-bg: #1e1e3f;
--panel-bg: (defined in main.css);
--accent-bg: (defined in main.css);
--success-color: #4ecdc4;
--warning-color: #ffd93d;
--danger-color: #ff6b6b;
--info-color: #74b9ff;
--text-primary: (defined in main.css);
--text-secondary: #b8b8d4;
```

## Testing Protocol

1. **Start the application**:
   ```bash
   cd /Users/kali/Athena/Athena/athena-v2
   npm run tauri dev
   ```

2. **Visual Comparison**:
   - Open template HTML in browser
   - Position windows side-by-side
   - Match colors, spacing, fonts exactly

3. **Interaction Testing**:
   - Test all hover states
   - Verify animations work
   - Check responsive behavior

## Context Monitoring Strategy

### After Each Component
1. Check remaining context percentage
2. If below 20%, prepare for handoff
3. If below 15%, STOP and create handoff document

### Use These Commands
```bash
# Track your changes
git status
git diff

# Search for components needing styling
rg "TODO|FIXME" src/
rg "className=\"\"" src/components/solid/analysis/
```

## Success Criteria

Your implementation is successful when:
1. All remaining analysis pages are styled
2. No visual discrepancies with template
3. All interactions (hover, click) work properly
4. Code follows established patterns
5. Proper handoff documentation if context limit reached

## Emergency Handoff Template

If you reach 15% context, create `ui-implementation-handoff-v4.md`:

```markdown
# UI Implementation Handoff - Phase 4

## Context Usage at Handoff: [X]%

## Completed in This Session
1. [Component name]
   - File: [path]
   - CSS created: [yes/no]
   - Key changes: [list]

## Still Remaining
1. [Component name]
   - Priority: [High/Medium/Low]
   - Estimated complexity: [Simple/Medium/Complex]

## Notes for Next Agent
- [Any discoveries or gotchas]
- [Testing status]
```

## Final Instructions

1. **Read the handoff document first**
2. **Start with Memory Analysis** (highest priority)
3. **Create component-specific CSS files**
4. **Test after each component**
5. **Monitor context constantly**
6. **Document everything**

Remember: Quality over quantity. It's better to properly style fewer components than rush through many with poor quality.

---
*Created for: Claude Code UI Styling Agent*
*Mission: Complete UI styling for Athena Platform*
*Reference: athena_tauri_UI_template.html*
*Critical: Monitor context usage constantly*