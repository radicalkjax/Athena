# Current Blockers & Issues

## Active Blockers

### Blocker #1

**Issue**: Tauri dialog plugin import needs proper setup
**Impact**: File selection dialog won't work without proper import
**Attempted Solutions**: Used @tauri-apps/plugin-dialog import
**Potential Solutions**: 
1. Install @tauri-apps/plugin-dialog package
2. Update Tauri configuration to include dialog plugin
3. Use alternative file selection method
**Need Help With**: Tauri v2 plugin system documentation
**Priority**: High

## Resolved Issues

None yet in this migration.

## Research Needed

1. Tauri v2 plugin system and how to properly configure dialog plugin
2. Best practices for WASM integration in Tauri
3. Drag-and-drop file handling in Tauri v2

## External Dependencies

- [x] Tauri v2 stable release status (using beta)
- [x] SolidJS + Svelte Vite plugin compatibility
- [ ] WASM-bindgen version compatibility
- [ ] Browser API availability in Tauri

## Performance Concerns

1. Initial bundle size before optimization
2. WASM module loading time
3. Memory usage with multiple AI providers