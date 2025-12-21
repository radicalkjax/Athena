# Claude Code Migration Prompt System

## Master Context Prompt

# Athena Migration Project: React Native → Tauri v2 + SolidJS/Svelte

## Project Mission

You are Claude Code, leading the migration of Athena (an AI-powered malware analysis platform) from React Native to Tauri v2 + SolidJS/Svelte. This migration will improve performance 3-5x and provide better WASM integration for security analysis.

## Context Management System

**CRITICAL**: Always read and update these files at the start of each session:

- `docs/prompts/master_context.md` (this file)
- `docs/prompts/current_phase.md`
- `docs/prompts/progress_tracker.md`
- `docs/prompts/decisions_log.md`
- `docs/prompts/current_blockers.md`

## Project Structure

```
athena-v2/
├── docs/prompts/           # Context management (you manage this)
├── src-tauri/             # Rust backend
├── src/                   # Frontend (SolidJS + Svelte)
├── wasm/                  # WASM modules
└── migration-notes/       # Implementation notes
```

## Framework Strategy

- **SolidJS**: Performance-critical components (analysis, WASM, real-time data)
- **Svelte**: UI-heavy components (forms, layout, reports)
- **Tauri v2**: Native backend with superior WASM integration

## Original Athena Features (HTML Reference)

The user provided a complete HTML implementation showing:

1. Complex malware analysis dashboard
2. AI provider ensemble (6 models: Claude, GPT-4, DeepSeek, Gemini, etc.)
3. Multi-stage analysis pipeline (static, dynamic, network)
4. Real-time status updates
5. Sandbox configuration (Windows/Linux/macOS)
6. Advanced features (hex editor, disassembly, YARA rules)
7. Workflow designer for agent orchestration
8. Comprehensive reporting system

## 10-Week Migration Timeline

- **Weeks 1-2**: Core Infrastructure (Tauri + basic SolidJS)
- **Weeks 3-4**: Core Components (layout, navigation, file upload)
- **Weeks 5-6**: Advanced Components (editors, visualization)
- **Weeks 7**: State Management & WASM Integration
- **Weeks 8-9**: Advanced Features (workflows, AI ensemble)
- **Weeks 10**: Performance & Testing

## Success Metrics

- [ ] File upload working with progress tracking
- [ ] AI provider status updates in real-time
- [ ] WASM analysis modules integrated
- [ ] All UI panels functional and responsive
- [ ] Performance: 3-5x faster than React Native version
- [ ] Bundle size: <5MB (vs 15MB React Native)

## Your Responsibilities

1. **Initialize** project structure if not exists
2. **Track progress** in `docs/prompts/progress_tracker.md`
3. **Log decisions** in `docs/prompts/decisions_log.md`
4. **Identify blockers** in `docs/prompts/current_blockers.md`
5. **Update current phase** in `docs/prompts/current_phase.md`
6. **Implement** according to the detailed migration plan
7. **Test** each component as you build it
8. **Document** any deviations or discoveries

## Key Implementation Files You'll Create

```
src-tauri/src/main.rs                    # Tauri app entry
src-tauri/src/commands/                  # Backend commands
src/App.tsx                              # Main SolidJS app
src/components/solid/analysis/           # Analysis components
src/components/svelte/layout/            # Layout components
src/stores/analysisStore.ts              # Global state
vite.config.ts                           # Build configuration
```

## Context Continuity Protocol

**ALWAYS start each session by:**

1. Reading all files in `docs/prompts/`
2. Checking `current_phase.md` for where you left off
3. Reviewing `progress_tracker.md` for completed tasks
4. Checking `current_blockers.md` for any issues
5. Updating these files as you work

## Emergency Protocols

If you encounter issues:

1. Log the problem in `current_blockers.md`
2. Research solutions in the context of Tauri v2 + SolidJS/Svelte
3. If blocked, document the issue and suggest alternatives
4. Never break working functionality

---

## Phase-Specific Prompts

Save these as separate files:

### `docs/prompts/phase_1_infrastructure.md`

# Phase 1: Core Infrastructure (Weeks 1-2)

## Current Objectives

- [ ] Set up Tauri v2 project structure
- [ ] Configure Vite for SolidJS + Svelte hybrid
- [ ] Create basic backend commands
- [ ] Implement file upload command
- [ ] Set up WASM runtime integration

## Key Files to Create

1. `src-tauri/Cargo.toml` - Tauri dependencies
2. `src-tauri/src/main.rs` - Main Tauri app
3. `src-tauri/src/commands/file_ops.rs` - File operations
4. `package.json` - Frontend dependencies
5. `vite.config.ts` - Hybrid build configuration
6. `src/App.tsx` - Main SolidJS application

## Implementation Steps

1. **Initialize Tauri Project**

   ```bash
   npm create tauri-app@latest athena-v2
   cd athena-v2
   ```

2. **Add Hybrid Framework Support**

   ```bash
   npm install solid-js @solidjs/router svelte @sveltejs/vite-plugin-svelte
   ```

3. **Configure Backend Commands**

   - File upload with progress tracking
   - File metadata extraction (hash, type, size)
   - Basic system status

4. **Test Basic Functionality**
   - File selection dialog works
   - File upload command returns metadata
   - Frontend can call backend commands

## Success Criteria

- [ ] `npm run dev` starts the app successfully
- [ ] File upload dialog opens
- [ ] Backend commands respond to frontend calls
- [ ] Basic UI renders without errors

## Context Updates

Update `progress_tracker.md` with:

- Completed setup steps
- Any configuration issues encountered
- Performance observations
- Next phase preparation notes

---

### `docs/prompts/phase_2_core_components.md`

# Phase 2: Core Components (Weeks 3-4)

## Current Objectives

- [ ] Implement layout structure (Header, Sidebar, Main)
- [ ] Create navigation system
- [ ] Build file upload area with progress
- [ ] Add basic analysis panels
- [ ] Implement AI provider status display

## Framework Assignments

- **Svelte**: Header, Sidebar, Navigation (mostly static)
- **SolidJS**: FileUploadArea, AnalysisProvider, StatusIndicators (reactive)

## Key Components to Build

### Svelte Components (UI-Heavy)

1. `src/components/svelte/layout/Header.svelte`
2. `src/components/svelte/navigation/Sidebar.svelte`
3. `src/components/svelte/layout/Layout.svelte`

### SolidJS Components (Performance-Critical)

1. `src/components/solid/analysis/FileUploadArea.tsx`
2. `src/components/solid/providers/AnalysisProvider.tsx`
3. `src/components/solid/providers/AIProviderStatus.tsx`

## Implementation Priority

1. **Layout Foundation** (Svelte)

   - Header with status indicator
   - Sidebar with priority-based navigation
   - Main content area with panel routing

2. **File Upload** (SolidJS)

   - Drag & drop functionality
   - Progress tracking with real-time updates
   - File type validation
   - Integration with Tauri file dialogs

3. **Navigation System**
   - Panel switching between upload, analysis, reports
   - Active state management
   - Keyboard navigation support

## Success Criteria

- [ ] Layout matches original HTML design
- [ ] File upload shows progress and handles errors
- [ ] Navigation between panels works smoothly
- [ ] AI provider status updates in real-time
- [ ] Responsive design works on different screen sizes

## Testing Checklist

- [ ] Upload large files (>50MB) without blocking UI
- [ ] Navigation works with keyboard and mouse
- [ ] Error states display appropriately
- [ ] Performance: UI stays responsive during file processing

---

### `docs/prompts/progress_tracker.md`

# Migration Progress Tracker

## Overall Progress: X% Complete

### Phase 1: Core Infrastructure ✅/⏳/❌

- [ ] Tauri project initialized
- [ ] Vite hybrid configuration working
- [ ] Backend commands structure created
- [ ] File upload command implemented
- [ ] WASM runtime initialized
- [ ] Basic error handling implemented

**Status**: Not Started | In Progress | Completed | Blocked
**Notes**:

### Phase 2: Core Components ⏳

- [ ] Header component (Svelte)
- [ ] Sidebar navigation (Svelte)
- [ ] File upload area (SolidJS)
- [ ] Analysis provider context (SolidJS)
- [ ] AI provider status (SolidJS)
- [ ] Panel routing system

**Status**:
**Notes**:

### Phase 3: Advanced Components

- [ ] Hex editor (SolidJS)
- [ ] Code editor with syntax highlighting
- [ ] Network traffic visualization
- [ ] Real-time data components
- [ ] Disassembly viewer

**Status**:
**Notes**:

### Phase 4: State Management & WASM

- [ ] Global analysis store
- [ ] WASM bridge components
- [ ] Performance monitoring
- [ ] Memory management
- [ ] Error boundary implementation

**Status**:
**Notes**:

### Phase 5: Advanced Features

- [ ] Workflow designer
- [ ] Report generation
- [ ] AI ensemble coordination
- [ ] Advanced configuration
- [ ] Export functionality

**Status**:
**Notes**:

### Phase 6: Performance & Testing

- [ ] Performance optimization
- [ ] Bundle size optimization
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] Production build testing

**Status**:
**Notes**:

## Performance Metrics

- Bundle size: Current vs Target (<5MB)
- Startup time: Current vs Target (<2s)
- Analysis performance: Current vs Target (3-5x faster)
- Memory usage: Current vs Acceptable
- WASM integration: Working vs Target (seamless)

## Known Issues

1.
2.
3.

## Next Session Priorities

1.
2.
3.

## Architecture Decisions Made

1.
2.
3.

---

### `docs/prompts/current_phase.md`

# Current Phase Status

## Active Phase: Phase 1 - Core Infrastructure

## Current Session Goals

1.
2.
3.

## Last Completed Task

**Task**:
**Date**:
**Notes**:

## Current Working On

**Task**:
**Started**:
**Expected Completion**:
**Blockers**:

## Next Up

1.
2.
3.

## Important Context for This Phase

-
-
-

## Files Currently Modified

-
-
-

## Testing Status

- [ ] Basic functionality works
- [ ] Error cases handled
- [ ] Performance acceptable
- [ ] Ready for next phase

---

### `docs/prompts/decisions_log.md`

# Architecture & Implementation Decisions

## Decision Log

### Decision #1: Framework Choice

**Date**:
**Decision**: SolidJS for performance-critical components, Svelte for UI-heavy components
**Reasoning**: SolidJS provides fine-grained reactivity for real-time analysis data, Svelte offers simplicity for forms and layout
**Impact**: Hybrid build system required, but better performance overall
**Alternatives Considered**: Pure SolidJS, Pure Svelte, React
**Status**: Committed

### Decision #2: State Management

**Date**:
**Decision**:
**Reasoning**:
**Impact**:
**Alternatives Considered**:
**Status**:

### Decision #3: WASM Integration

**Date**:
**Decision**:
**Reasoning**:
**Impact**:
**Alternatives Considered**:
**Status**:

## Technical Patterns Established

1. **File Structure**: Component type determines framework (solid/ vs svelte/ directories)
2. **State Sharing**: Use SolidJS stores for reactive state, props for component communication
3. **Tauri Commands**: Async/await pattern with proper error handling
4. **Performance**: Lazy loading for heavy components, virtualization for large lists

## Conventions

- **Naming**: PascalCase for components, camelCase for functions
- **File Extensions**: `.tsx` for SolidJS, `.svelte` for Svelte
- **CSS**: Shared CSS custom properties, component-scoped styles
- **Error Handling**: Consistent error boundaries and user feedback

## Open Questions

1.
2.
3.

---

### `docs/prompts/current_blockers.md`

# Current Blockers & Issues

## Active Blockers

### Blocker #1

**Issue**:
**Impact**:
**Attempted Solutions**:
**Potential Solutions**:
**Need Help With**:
**Priority**: High/Medium/Low

## Resolved Issues

### Issue #1

**Problem**:
**Solution**:
**Date Resolved**:
**Lessons Learned**:

## Research Needed

1.
2.
3.

## External Dependencies

- [ ] Tauri v2 stable release status
- [ ] SolidJS + Svelte Vite plugin compatibility
- [ ] WASM-bindgen version compatibility
- [ ] Browser API availability in Tauri

## Performance Concerns

1.
2.
3.

---

### `docs/prompts/session_startup.md`

# Session Startup Checklist

**Use this every time you start working on the project:**

## Context Loading ✅

- [ ] Read `docs/prompts/master_context.md`
- [ ] Check `docs/prompts/current_phase.md`
- [ ] Review `docs/prompts/progress_tracker.md`
- [ ] Check `docs/prompts/current_blockers.md`
- [ ] Review `docs/prompts/decisions_log.md`

## Environment Check ✅

- [ ] Project builds successfully (`npm run dev`)
- [ ] No critical errors in console
- [ ] Tauri backend responds to test commands
- [ ] Git status clean or understood

## Session Planning ✅

- [ ] Identified 2-3 specific tasks for this session
- [ ] Estimated time for each task
- [ ] Noted any blockers or dependencies
- [ ] Updated `current_phase.md` with session goals

## Ready to Code ✅

Start implementing according to the current phase objectives.
Remember to update progress files as you complete tasks.

---

## Usage Instructions for Claude Code

Save this entire prompt system as separate files in `docs/prompts/`. Then use this command:

```bash
# Start a new session
claude-code "Read docs/prompts/session_startup.md and follow the checklist. Then continue working on the Athena migration according to docs/prompts/current_phase.md. Update progress as you work."

# Continue an existing session
claude-code "Check docs/prompts/current_phase.md for where I left off and continue the Athena migration. Update docs/prompts/progress_tracker.md as you complete tasks."

# When switching phases
claude-code "I've completed Phase X. Update docs/prompts/progress_tracker.md, set docs/prompts/current_phase.md to Phase Y, and begin the next phase of the Athena migration."
```

This system ensures Claude Code maintains perfect context across sessions and can execute the complex 10-week migration plan systematically.
