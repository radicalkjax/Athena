# WASM Migration Context Prompt for Claude

## Mission Statement
You are helping rebuild the Athena malware analysis application to be WASM-forward. This is a critical security-focused migration that will transform the app from a React Native/TypeScript application into a WASM-secured architecture with perfect isolation for malware analysis.

## Current Status Check
Before responding, ALWAYS:
1. Check `/docs/prompts/WASM/tracking/migration-progress.md` for current phase and completed tasks
2. Review the active todo list using TodoRead
3. Identify which phase and week we're currently in

## Core Documents (Read These First)
1. **Migration Plan**: `/docs/prompts/WASM/plan/WASM-Migration-Plan.md`
   - Contains the complete 24-week roadmap
   - Defines all phases and deliverables
   - Your north star for what needs to be built

2. **Architecture Guide**: `/docs/prompts/WASM/architecture/WASM-architecture.md`
   - Security requirements and constraints
   - WASM module specifications
   - Integration patterns

3. **Progress Tracker**: `/docs/prompts/WASM/tracking/migration-progress.md`
   - Current phase and week
   - Completed vs pending tasks
   - Blockers and issues

4. **Technical Decisions**: `/docs/prompts/WASM/tracking/technical-decisions.md`
   - Architectural decisions already made
   - Rationale for key choices
   - Must follow these decisions

## Project Structure
```
/workspaces/Athena/
├── src/                      # Existing TypeScript/React Native code
├── wasm-modules/            # NEW: WASM modules (create in Phase 1)
│   ├── core/               # Core WASM modules
│   │   ├── analysis-engine/
│   │   ├── file-processor/
│   │   └── security/
│   ├── shared/             # Shared utilities
│   └── bridge/             # Platform bridges
├── docs/prompts/WASM/       # All WASM documentation
│   ├── plan/               # Migration plans
│   ├── tracking/           # Progress tracking
│   └── architecture/       # Architecture docs
```

## Key Technical Stack
- **WASM Language**: Rust
- **Build Tool**: wasm-pack, cargo
- **Optimization**: wasm-opt
- **TypeScript Integration**: wasm-bindgen
- **Testing**: Rust tests + Jest
- **Platforms**: Web, iOS, Android (via React Native)

## Phase Overview
1. **Phase 1 (Weeks 1-4)**: Foundation - Environment setup, bridge development
2. **Phase 2 (Weeks 5-12)**: Core Analysis Engine - File validation, pattern matching, deobfuscation
3. **Phase 3 (Weeks 13-16)**: Security Sandbox - Perfect isolation implementation
4. **Phase 4 (Weeks 17-20)**: AI Integration - Secure preprocessing pipeline
5. **Phase 5 (Weeks 21-24)**: Platform Optimization - Performance tuning

## Critical Constraints
1. **Security First**: Every design decision must prioritize security
2. **Zero Trust**: Assume all input files are malicious
3. **Performance**: 2x faster than current JavaScript implementation
4. **Memory**: 50% reduction in memory usage
5. **Compatibility**: Must work on Web, iOS, and Android

## When Starting Work
1. **Check Progress**: Read migration-progress.md to understand current state
2. **Update Todos**: Use TodoWrite to track what you're working on
3. **Follow Plan**: Stick to the phase plan in WASM-Migration-Plan.md
4. **Document Changes**: Update tracking docs as you make progress
5. **Test Everything**: Follow the testing strategy defined in the plan

## Module Boundaries
- **analysis-engine**: Deobfuscation, pattern matching, vulnerability scanning
- **file-processor**: File parsing, validation, content extraction
- **security**: Sandboxing, crypto operations, signature verification

## Integration Rules
1. **Don't Break Existing Code**: The app must continue working during migration
2. **TypeScript Interfaces**: Keep existing interfaces, add WASM bridge layer
3. **Gradual Migration**: Replace one service at a time
4. **Test Coverage**: Minimum 80% coverage for all WASM modules

## Progress Tracking
After completing ANY task:
1. Update `/docs/prompts/WASM/tracking/migration-progress.md`
2. Mark todos as completed using TodoWrite
3. Document any technical decisions in technical-decisions.md
4. Note any blockers or issues encountered

## Error Handling
- All WASM functions return Result<T, E>
- Convert to TypeScript discriminated unions
- Include detailed error context
- Never panic in WASM code

## Performance Benchmarks
Track these metrics:
- File analysis speed (target: 2x improvement)
- Memory usage (target: 50% reduction)
- Startup time (target: <100ms)
- Pattern matching throughput (target: 100MB/s)

## Communication Style
When providing updates:
1. State which phase/week you're working on
2. List completed tasks from the current phase
3. Identify next immediate tasks
4. Flag any blockers or concerns
5. Keep responses focused on the migration

## Remember
- This is a 6-month project - pace yourself according to the plan
- Security is paramount - this analyzes malware
- The existing app must keep working during migration
- Document everything in the tracking folder
- Follow the established technical decisions

## Quick Reference Commands
```bash
# Build WASM module
cd wasm-modules/core/[module-name]
wasm-pack build --target web

# Run Rust tests
cargo test

# Optimize WASM
wasm-opt -O3 -o optimized.wasm pkg/module_bg.wasm

# Integration test
npm run test:wasm
```

---
**USE THIS PROMPT**: When context is lost or you need to refocus, read this document first to realign with the project goals and current status.