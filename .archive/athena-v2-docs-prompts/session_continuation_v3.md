# Claude Code Session Continuation Prompt

## Context for Next Session

You are continuing the Athena Platform migration from React Native to Tauri v2 + SolidJS/Svelte. This prompt contains everything you need to continue where we left off.

## Current Status Overview

- **Project**: Athena Platform - AI-powered malware analysis
- **Migration**: React Native → Tauri v2 + SolidJS/Svelte
- **Progress**: 65% complete (Phase 3 Complete, Phase 4 Starting)
- **Working Directory**: `/Users/kali/Athena/Athena/athena-v2`

## What Was Just Completed (Latest Session)

1. ✅ Implemented Real-time System Monitoring Components:
   - CPU usage monitor with per-core visualization
   - Memory monitor with donut charts
   - Process tree viewer with kill functionality
   - Disk usage and network interface statistics
2. ✅ Created Disassembly Viewer with:
   - Instruction listing and navigation
   - Function detection and listing
   - String extraction from binaries
   - Control flow graph visualization
   - Section information display
3. ✅ Fixed all Rust compilation issues
4. ✅ Integrated all components into main app
5. ✅ Completed Phase 3 (100%)

## Current State of the App

### Working Features:
- **File Upload** with progress events via Tauri
- **Analysis Dashboard** with 4 stages (Static, Dynamic, Network, Behavioral)
- **AI Provider Status** display (Claude, GPT-4, DeepSeek, Gemini, Mistral, Llama)
- **Hex Editor** - Binary file viewer/editor with ASCII representation
- **Code Editor** - Syntax highlighting for multiple languages
- **Network Traffic Visualization** - Real-time packet capture simulation
- **System Monitor** - CPU, Memory, Process, Disk, Network monitoring
- **Disassembly Viewer** - Binary analysis with CFG visualization
- **Sandbox Configuration** UI
- **Navigation** between Upload, Analysis, Reports, Hex, Code, Network, System, and Disassembly panels

### Technical Stack:
- **Frontend**: SolidJS (performance-critical) + Svelte (UI-heavy) - hybrid setup
- **Backend**: Tauri v2 with Rust commands
- **Build**: Vite configured for both frameworks
- **Styling**: CSS with Barbie aesthetic theme (#ff6b9d)
- **Dependencies Added**: uuid, sysinfo

## Phase 3 Completed ✅

### All Components Implemented:
1. ✅ Hex editor (SolidJS) - with virtual scrolling
2. ✅ Code editor with syntax highlighting
3. ✅ Network traffic visualization
4. ✅ Real-time data components (CPU, Memory, Process monitoring)
5. ✅ Disassembly viewer with Control Flow Graph visualization

## Phase 4 Starting (State Management & WASM)

### To Be Implemented:
1. ⏳ WASM runtime initialization
2. ⏳ WASM bridge components
3. ⏳ Performance monitoring
4. ⏳ Memory management
5. ⏳ Error boundary implementation

## Recent Code Additions

### Frontend Components:
- `/src/components/solid/visualization/CpuMonitor.tsx` - CPU usage visualization
- `/src/components/solid/visualization/MemoryMonitor.tsx` - Memory usage charts
- `/src/components/solid/visualization/ProcessViewer.tsx` - Process tree viewer
- `/src/components/solid/analysis/SystemMonitor.tsx` - System monitor dashboard
- `/src/components/solid/visualization/DisassemblyViewer.tsx` - Disassembly viewer
- `/src/components/solid/visualization/ControlFlowGraph.tsx` - CFG visualization
- `/src/components/solid/analysis/Disassembly.tsx` - Disassembly wrapper

### Backend Commands:
- `get_cpu_info` - Get CPU usage and core information
- `get_memory_info` - Get memory usage statistics
- `get_processes` - Get process list with tree structure
- `get_disk_info` - Get disk usage information
- `get_network_info` - Get network interface statistics
- `get_system_stats` - Get all system information
- `kill_process` - Terminate a process by PID
- `disassemble_file` - Disassemble binary files
- `get_control_flow_graph` - Generate CFG for functions

### CSS Additions:
- System monitor styles with real-time graphs
- Process viewer with tree visualization
- Disassembly viewer with instruction highlighting
- Control flow graph with interactive blocks
- All maintaining consistent pink accent (#ff6b9d)

## Known Issues (Non-Critical)

1. **TypeScript False Positives**: TypeScript shows errors for SolidJS JSX syntax, but builds succeed
2. **Port Conflict**: Port 5173 sometimes has conflicts. Use: `lsof -ti:5173 | xargs kill -9`
3. **Disassembly**: Currently using mock implementation - real capstone integration pending
4. **Network Capture**: Currently using mock data - real pcap integration pending

## Next Steps (Phase 4)

1. **WASM Runtime Integration**:
   - Initialize WASM runtime environment
   - Create sandboxed execution context
   - Implement binary instrumentation
   - Add dynamic analysis hooks

2. **WASM Bridge Components**:
   - Create communication layer between JS and WASM
   - Implement shared memory management
   - Build analysis API for WASM modules

3. **Performance & Memory Management**:
   - Implement performance monitoring
   - Add memory usage tracking
   - Create garbage collection strategies
   - Optimize large file handling

## Important Files to Review

1. **Master Prompt**: `docs/prompts/master_tauri_prompt.md` - Full project plan
2. **Current Phase**: `docs/prompts/current_phase.md` - Phase 4 starting
3. **Progress Tracker**: `docs/prompts/progress_tracker.md` - 65% overall progress
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

1. **SolidJS**: Used for all performance-critical components (hex editor, network viz, real-time data, disassembly)
2. **Virtual Scrolling**: Implemented in hex editor and process viewer for handling large datasets
3. **Mock Implementations**: Disassembly and network capture use mock data for demo
4. **Modular Commands**: Separate Rust modules for file_ops, system, network, system_monitor, disassembly
5. **Component Wrappers**: Analysis wrappers handle file loading and Tauri integration

## Testing Status

- ✅ Frontend builds without errors
- ✅ Rust backend compiles successfully
- ✅ Tauri app builds and creates DMG
- ✅ All component integrations working
- ✅ Real-time system monitoring functional
- ✅ Disassembly viewer operational
- ⏳ Real network capture needs implementation
- ⏳ Real disassembly with capstone pending
- ⏳ Performance testing with large files pending
- ⏳ WASM integration not started

## File Structure Overview

```
athena-v2/
├── src/
│   ├── components/
│   │   └── solid/
│   │       ├── analysis/        # Analysis wrappers
│   │       ├── editors/         # Hex & Code editors
│   │       ├── visualization/   # Network, CPU, Memory, Process, Disassembly
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
│   │   │   ├── network.rs       # Network analysis
│   │   │   ├── system_monitor.rs # Real-time monitoring
│   │   │   └── disassembly.rs   # Binary disassembly
│   │   └── main.rs              # Tauri entry
│   └── Cargo.toml               # Rust deps
└── docs/prompts/                # Context files
```

## Key Context

This is a sophisticated malware analysis platform with:
- AI ensemble analysis (6 models)
- Multi-stage analysis pipeline
- Binary analysis tools (hex editor, disassembly)
- Network traffic analysis
- Real-time system monitoring
- WASM integration (next phase)
- Control flow visualization

Maintain the "Barbie aesthetic" theme with pink accents (#ff6b9d) throughout the UI.

## Continue With

Next session should focus on:
1. Beginning WASM runtime initialization
2. Creating WASM bridge components
3. Implementing performance monitoring
4. Setting up memory management strategies

The app is stable and all Phase 3 features are working. Ready to begin Phase 4.

## Phase Summary

- **Phase 1**: Core Infrastructure (90% - missing WASM runtime)
- **Phase 2**: Core Components (80% - missing analysis context, full routing)
- **Phase 3**: Advanced Components (100% ✅)
- **Phase 4**: State Management & WASM (10% - just starting)
- **Phase 5**: Advanced Features (0% - not started)
- **Phase 6**: Performance & Testing (0% - not started)