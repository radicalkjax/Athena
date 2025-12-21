# Architecture & Implementation Decisions

## Decision Log

### Decision #1: Framework Choice
**Date**: 2025-01-22
**Decision**: SolidJS for performance-critical components, Svelte for UI-heavy components
**Reasoning**: SolidJS provides fine-grained reactivity for real-time analysis data, Svelte offers simplicity for forms and layout
**Impact**: Hybrid build system required, but better performance overall
**Alternatives Considered**: Pure SolidJS, Pure Svelte, React
**Status**: Partially Implemented (SolidJS only currently)

### Decision #2: State Management
**Date**: 2025-01-22
**Decision**: Using SolidJS stores for global state management
**Reasoning**: Native to SolidJS, provides reactive updates across components
**Impact**: Simple and performant state management
**Alternatives Considered**: Zustand, Redux, Context API
**Status**: Basic implementation complete

### Decision #3: WASM Integration
**Date**: 2025-01-22
**Decision**: Pending - Need to implement WASM runtime in Tauri
**Reasoning**: Required for high-performance malware analysis
**Impact**: Critical for achieving 3-5x performance improvement
**Alternatives Considered**: Pure Rust implementation, WebWorkers
**Status**: Not Started

### Decision #4: File Operations
**Date**: 2025-01-22
**Decision**: Using Tauri commands with SHA256 hashing
**Reasoning**: Secure file handling with integrity verification
**Impact**: Reliable file metadata extraction
**Alternatives Considered**: Browser File API, Direct filesystem access
**Status**: Implemented

## Technical Patterns Established

1. **File Structure**: Component type determines framework (solid/ vs svelte/ directories)
2. **State Sharing**: Use SolidJS stores for reactive state, props for component communication
3. **Tauri Commands**: Async/await pattern with proper error handling
4. **Performance**: Lazy loading for heavy components, virtualization for large lists (planned)

## Conventions

- **Naming**: PascalCase for components, camelCase for functions
- **File Extensions**: `.tsx` for SolidJS, `.svelte` for Svelte
- **CSS**: Shared CSS custom properties, component-scoped styles
- **Error Handling**: Consistent error boundaries and user feedback

## Open Questions

1. How to best integrate Svelte components with SolidJS routing?
2. WASM module loading strategy - bundled or dynamic?
3. Best approach for real-time progress updates from Rust to frontend?