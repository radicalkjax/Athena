# Claude Code Session Continuation Prompt

## Context for Next Session

You are continuing the Athena Platform migration from React Native to Tauri v2 + SolidJS/Svelte. This prompt contains everything you need to continue where we left off.

## Current Status Overview

- **Project**: Athena Platform - AI-powered malware analysis
- **Migration**: React Native → Tauri v2 + SolidJS/Svelte
- **Progress**: 45% complete (Phase 3 - 60% done)
- **Working Directory**: `/Users/kali/Athena/Athena/athena-v2`

## What Was Just Completed (Latest Session)

1. ✅ Implemented Hex Editor component with virtual scrolling and inline editing
2. ✅ Created Code Editor with syntax highlighting and auto-closing brackets
3. ✅ Built Network Traffic Visualization with real-time packet analysis
4. ✅ Fixed Tauri build issues (escaped characters in Rust code)
5. ✅ Added network analysis backend commands
6. ✅ Integrated all new components into main app

## Current State of the App

### Working Features:
- **File Upload** with progress events via Tauri
- **Analysis Dashboard** with 4 stages (Static, Dynamic, Network, Behavioral)
- **AI Provider Status** display (Claude, GPT-4, DeepSeek, Gemini, Mistral, Llama)
- **Hex Editor** - Binary file viewer/editor with ASCII representation
- **Code Editor** - Syntax highlighting for multiple languages
- **Network Traffic Visualization** - Real-time packet capture simulation
- **Sandbox Configuration** UI
- **Navigation** between Upload, Analysis, Reports, Hex, Code, and Network panels

### Technical Stack:
- **Frontend**: SolidJS (performance-critical) + Svelte (UI-heavy) - hybrid setup
- **Backend**: Tauri v2 with Rust commands
- **Build**: Vite configured for both frameworks
- **Styling**: CSS with Barbie aesthetic theme (#ff6b9d)
- **Dependencies Added**: uuid (for network capture sessions)

## Phase 3 Progress (Advanced Components)

### Completed:
1. ✅ Hex editor (SolidJS) - with virtual scrolling
2. ✅ Code editor with syntax highlighting
3. ✅ Network traffic visualization

### Remaining:
4. ⏳ Real-time data components (CPU, memory, processes)
5. ⏳ Disassembly viewer
6. ⏳ WASM runtime integration

## Recent Code Additions

### Frontend Components:
- `/src/components/solid/editors/HexEditor.tsx` - High-performance hex editor
- `/src/components/solid/editors/CodeEditor.tsx` - Syntax highlighting editor
- `/src/components/solid/visualization/NetworkTraffic.tsx` - Network packet visualization
- `/src/components/solid/analysis/HexViewer.tsx` - Hex editor wrapper
- `/src/components/solid/analysis/CodeViewer.tsx` - Code editor wrapper
- `/src/components/solid/analysis/NetworkAnalysis.tsx` - Network analysis wrapper

### Backend Commands:
- `read_file_binary` - Read files as binary for hex editor
- `write_file_binary` - Save binary edits
- `read_file_text` - Read files as text for code editor
- `write_file_text` - Save text edits
- `analyze_network_packet` - Analyze network packets
- `export_network_capture` - Export PCAP files
- `start_packet_capture` - Start network capture
- `stop_packet_capture` - Stop network capture

### CSS Additions:
- Hex editor styles with Barbie theme
- Code editor with syntax token colors
- Network traffic visualization styles
- All maintaining consistent pink accent (#ff6b9d)

## Known Issues (Non-Critical)

1. **TypeScript False Positives**: TypeScript shows errors for SolidJS JSX syntax, but builds succeed
2. **Port Conflict**: Port 5173 sometimes has conflicts. Use: `lsof -ti:5173 | xargs kill -9`
3. **Network Capture**: Currently using mock data - real pcap integration pending

## Next Steps

1. **Real-time Data Components**:
   - CPU usage monitor
   - Memory usage visualization
   - Process tree viewer
   - File system activity monitor

2. **Disassembly Viewer**:
   - x86/x64 disassembly
   - Control flow graphs
   - Function detection
   - String extraction

3. **WASM Integration**:
   - WASM runtime for sandboxed analysis
   - Binary instrumentation
   - Dynamic analysis hooks

## Important Files to Review

1. **Master Prompt**: `docs/prompts/master_tauri_prompt.md` - Full project plan
2. **Current Phase**: `docs/prompts/current_phase.md` - Phase 3 in progress
3. **Progress Tracker**: `docs/prompts/progress_tracker.md` - 45% overall progress
4. **App Entry**: `src/App.tsx` - Main app with all component integrations

## Commands to Start

```bash
# Navigate to project
cd /Users/kali/Athena/Athena/athena-v2

# Kill any existing processes on port 5173
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Start the development server
npm run tauri:dev

# Build the app
npm run tauri:build

# Frontend only
npm run dev

# Check Rust compilation
cd src-tauri && cargo check
```

## Architecture Decisions

1. **SolidJS**: Used for all performance-critical components (hex editor, network viz, real-time data)
2. **Virtual Scrolling**: Implemented in hex editor for handling large files
3. **Mock Network Data**: Using simulated packets for demo, real pcap integration planned
4. **Modular Commands**: Separate Rust modules for file_ops, system, and network
5. **Component Wrappers**: Analysis wrappers handle file loading and Tauri integration

## Testing Status

- ✅ Frontend builds without errors
- ✅ Rust backend compiles successfully
- ✅ Tauri app builds and creates DMG
- ✅ All component integrations working
- ⏳ Real network capture needs implementation
- ⏳ Performance testing with large files pending

## File Structure Overview

```
athena-v2/
├── src/
│   ├── components/
│   │   └── solid/
│   │       ├── analysis/        # Analysis wrappers
│   │       ├── editors/         # Hex & Code editors
│   │       ├── visualization/   # Network traffic viz
│   │       ├── layout/          # Header
│   │       ├── navigation/      # Sidebar
│   │       └── providers/       # AI status
│   ├── stores/
│   │   └── analysisStore.ts     # Global state
│   └── App.tsx                  # Main app
├── src-tauri/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── file_ops.rs      # File operations
│   │   │   ├── system.rs        # System info
│   │   │   └── network.rs       # Network analysis
│   │   └── main.rs              # Tauri entry
│   └── Cargo.toml               # Rust deps
└── docs/prompts/                # Context files
```

## Key Context

This is a sophisticated malware analysis platform with:
- AI ensemble analysis (6 models)
- Multi-stage analysis pipeline
- Binary analysis tools (hex editor, disassembly planned)
- Network traffic analysis
- WASM integration (planned)
- Real-time system monitoring (next task)

Maintain the "Barbie aesthetic" theme with pink accents (#ff6b9d) throughout the UI.

## Continue With

Next session should focus on:
1. Implementing real-time data components (CPU, memory, processes)
2. Creating the disassembly viewer
3. Beginning WASM runtime integration

The app is stable and all current features are working. Phase 3 is 60% complete.