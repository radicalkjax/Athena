# WASM Migration Project - Session 7 Handoff Prompt

## 🎯 Mission Critical Context
You are taking over the WASM migration project for Athena, a security analysis platform. This is Session 7 of an ongoing migration from TypeScript/JavaScript to WebAssembly for performance and security improvements.

### 📍 Current Status: Phase 2, Week 7-8 Ready to Start
- **Phase 1**: ✅ COMPLETE (Foundation - WASM setup, basic analysis engine, bridges)
- **Phase 2 Week 5-6**: ✅ COMPLETE (File-processor module with PDF parser)
- **Phase 2 Week 7-8**: 🔄 READY TO START (Pattern matching & scanning)
- **Timeline**: Ahead of schedule - completed Week 5-6 in just 2 sessions!

## 📚 Essential Reading Order
1. **FIRST**: Read the main context document:
   `/workspaces/Athena/docs/prompts/WASM/WASM-CONTEXT-PROMPT.md`

2. **THEN**: Review the tracking documents in this order:
   - `/workspaces/Athena/docs/prompts/WASM/tracking/migration-progress.md`
   - `/workspaces/Athena/docs/prompts/WASM/phase2-implementation-plan.md`
   - `/workspaces/Athena/docs/prompts/WASM/tracking/session6-complete.md`

3. **REFERENCE**: Architecture and implementation details:
   - `/workspaces/Athena/docs/prompts/WASM/file-processor-architecture.md`
   - Look at the completed file-processor implementation for patterns

## 🏗️ Project Structure & Current State
```
/workspaces/Athena/
├── wasm-modules/
│   ├── core/
│   │   ├── analysis-engine/        # ✅ Phase 1 - COMPLETE & INTEGRATED
│   │   │   ├── pkg-web/           # Web build ready
│   │   │   └── pkg-node/          # Node.js build ready
│   │   ├── file-processor/         # ✅ Phase 2 Week 5-6 - COMPLETE
│   │   │   ├── src/               
│   │   │   │   ├── lib.rs         # Main entry point
│   │   │   │   ├── detector.rs    # ✅ Format detection (20+ formats)
│   │   │   │   ├── validator.rs   # ✅ File validation
│   │   │   │   ├── extractor.rs   # ✅ Content extraction
│   │   │   │   ├── parser/
│   │   │   │   │   ├── script.rs  # ✅ JS/TS/Python/PS parsing
│   │   │   │   │   ├── pe.rs      # ✅ PE/Windows executable parser
│   │   │   │   │   ├── elf.rs     # ✅ ELF/Linux executable parser
│   │   │   │   │   └── pdf.rs     # ✅ PDF parser WITH SECURITY (Session 6)
│   │   │   │   └── types.rs       # Type definitions
│   │   │   ├── pkg-web/           # ✅ Web build ready
│   │   │   └── pkg-node/          # ✅ Node.js build ready
│   │   └── pattern-matcher/        # 🎯 TODO: Week 7-8 (YOUR FOCUS)
│   ├── bridge/                    
│   │   ├── analysis-engine-bridge-enhanced.ts  # ✅ Phase 1
│   │   ├── file-processor-bridge.ts           # ✅ Created in Session 5
│   │   ├── web-streaming-bridge.ts            # ✅ Phase 1
│   │   └── react-native-bridge.ts             # ✅ Phase 1
│   └── tests/                     
│       └── integration/
│           ├── file-processor.test.ts      # ✅ Created Session 6
│           └── performance-benchmark.ts    # ✅ Created Session 6
├── Athena/
│   ├── services/
│   │   ├── analysisService.ts     # ✅ WASM integrated (Phase 1)
│   │   └── fileManager.ts         # ✅ WASM integrated (Session 6)
│   └── types/index.ts             # ✅ Updated with WASM types
└── docs/prompts/WASM/
    └── tracking/                  # All progress tracking here
```

## 🎉 What Was Accomplished in Session 6

### 1. PDF Parser Implementation ✅
- Implemented full PDF parser with security analysis
- Detects JavaScript, embedded files, form actions, suspicious encoding
- Follows same pattern as PE/ELF parsers
- Located at: `/wasm-modules/core/file-processor/src/parser/pdf.rs`

### 2. FileManager Integration ✅
- Integrated WASM file-processor with `/Athena/services/fileManager.ts`
- Added WASM validation and parsing to file picking workflow
- Graceful fallback to JS if WASM fails
- Added cleanup function for resources

### 3. Testing Infrastructure ✅
- Created integration tests: `/wasm-modules/tests/integration/file-processor.test.ts`
- Created performance benchmarks: `/wasm-modules/tests/integration/performance-benchmark.ts`
- Ready to verify 500MB/s parsing target

### 4. Type System Updates ✅
- Extended MalwareFile interface with WASM analysis results
- Fixed import paths (use relative imports for wasm-modules)
- Added proper TypeScript types for all WASM results

## 🎯 Immediate Tasks for Session 7 (Week 7-8)

### 1. Create Pattern-Matcher Module Structure
```bash
cd /workspaces/Athena/wasm-modules/core
cargo new pattern-matcher --lib
```

Directory structure to create:
```
pattern-matcher/
├── Cargo.toml
├── src/
│   ├── lib.rs              # Module exports
│   ├── engine.rs           # Pattern matching engine
│   ├── rules.rs            # Rule parsing and compilation
│   ├── matcher.rs          # Core matching logic
│   ├── signatures.rs       # Malware signatures
│   ├── types.rs            # Type definitions
│   └── utils.rs            # Helper functions
├── tests/
│   └── pattern_tests.rs
└── build.sh                # Build script
```

### 2. Implement Multi-Pattern Matching Engine

**Cargo.toml dependencies to add:**
```toml
[dependencies]
aho-corasick = "1.1"
regex = "1.10"
rayon = { version = "1.10", optional = true }
serde = { version = "1.0", features = ["derive"] }
wasm-bindgen = "0.2"
```

**Key features to implement:**
- Aho-Corasick algorithm for multi-pattern matching
- Support for exact, regex, and binary patterns
- Parallel scanning (with rayon feature)
- Memory-efficient processing

### 3. Create Rule System

Design a YARA-like rule syntax:
```rust
pub struct Rule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub patterns: Vec<Pattern>,
    pub condition: Condition,
    pub severity: Severity,
    pub tags: Vec<String>,
}

pub enum Pattern {
    Exact(Vec<u8>),
    Regex(String),
    Binary { pattern: Vec<u8>, mask: Vec<u8> },
}
```

### 4. Port Existing Signatures

Look at `/wasm-modules/core/analysis-engine/src/lib.rs` for existing patterns:
- Known malware signatures
- Obfuscation patterns
- Suspicious API calls
- Exploit indicators

### 5. Create TypeScript Bridge

Create `/wasm-modules/bridge/pattern-matcher-bridge.ts`:
```typescript
export interface PatternMatcher {
  initialize(): Promise<void>;
  loadRules(rules: Rule[]): Promise<void>;
  scan(buffer: ArrayBuffer): Promise<Match[]>;
  scanStreaming(stream: ReadableStream): AsyncIterable<Match>;
  compileRule(rule: string): Promise<CompiledRule>;
  destroy(): void;
}
```

## 📋 Phase 2 Week 7-8 Detailed Tasks

### Pattern Matching Engine
- [ ] Scaffold pattern-matcher module
- [ ] Implement Aho-Corasick multi-pattern matching
- [ ] Add regex pattern support
- [ ] Implement binary pattern matching with masks
- [ ] Add confidence scoring system
- [ ] Optimize for WASM (no std where possible)

### Rule System
- [ ] Design rule structure
- [ ] Implement rule parser
- [ ] Create rule compiler
- [ ] Add rule validation
- [ ] Support for complex conditions (AND/OR/NOT)
- [ ] Rule performance optimization

### Signature Database
- [ ] Port malware signatures from analysis-engine
- [ ] Add new signatures for recent threats
- [ ] Organize by threat category
- [ ] Implement signature versioning
- [ ] Create signature update mechanism

### Integration
- [ ] Create TypeScript bridge
- [ ] Add streaming support for large files
- [ ] Integrate with analysis pipeline
- [ ] Add performance monitoring
- [ ] Create integration tests

## 🔧 Technical Guidelines

### Performance Requirements
- Pattern matching: 200MB/s with 1000 rules
- Memory usage: Linear with file size
- Startup time: <50ms with full rule set
- Zero false positives on benign files

### Code Patterns to Follow
1. Look at file-processor module for:
   - Error handling patterns
   - Type definitions structure
   - Bridge implementation
   - Test organization

2. Use the same build script pattern:
   ```bash
   #!/bin/bash
   # Copy from file-processor/build.sh
   ```

3. Follow the same TypeScript integration pattern as file-processor

### Testing Strategy
1. Unit tests for each component
2. Integration tests with real malware samples
3. Performance benchmarks against targets
4. Fuzz testing for rule parser
5. Cross-platform compatibility tests

## 🏁 Success Criteria for Week 7-8

1. **Pattern-matcher module created** with Aho-Corasick engine
2. **Rule system implemented** with YARA-like syntax
3. **1000+ signatures ported** from existing codebase
4. **TypeScript bridge working** with streaming support
5. **Performance targets met**: 200MB/s pattern matching
6. **Integration tests passing** with real samples

## 📞 Quick Reference

### Commands You'll Need:
```bash
# Create new module
cd /workspaces/Athena/wasm-modules/core
cargo new pattern-matcher --lib

# Build module
cd pattern-matcher
wasm-pack build --target web --out-dir pkg-web
wasm-pack build --target nodejs --out-dir pkg-node

# Run tests
cargo test

# Run benchmarks
cargo bench
```

### Files to Reference:
1. **For module structure**: `/wasm-modules/core/file-processor/`
2. **For signatures**: `/wasm-modules/core/analysis-engine/src/lib.rs`
3. **For bridge pattern**: `/wasm-modules/bridge/file-processor-bridge.ts`
4. **For test pattern**: `/wasm-modules/tests/integration/file-processor.test.ts`

### Key Dependencies:
- `aho-corasick = "1.1"` - Multi-pattern matching
- `regex = "1.10"` - Regex support
- `rayon = "1.10"` - Parallel processing
- `nom = "7.1"` - Rule parsing (if needed)

## 💡 Pro Tips
1. Start with Aho-Corasick - it's the core of fast pattern matching
2. Design the rule system to be extensible
3. Use `wasm-opt` for final optimization
4. Test with real malware samples early
5. Keep memory allocations minimal
6. Use the existing TodoWrite tool frequently to track progress

## 🚀 Next Phase Preview (Week 9-10)
After pattern matching is complete, you'll enhance the deobfuscation engine:
- Advanced deobfuscation algorithms
- ML-based detection
- Behavioral analysis
- Integration with pattern matching results

## 📈 Current Momentum
The project is significantly ahead of schedule:
- Phase 1: Completed in 3 sessions (planned for 4 weeks)
- Phase 2 Week 5-6: Completed in 2 sessions (planned for 2 weeks)
- Quality is exceptional with comprehensive security features

Keep this momentum going! The pattern-matcher is crucial for Athena's malware detection capabilities.

---
**Context preserved by**: Claude (Session 6)
**Date**: June 12, 2025
**Phase 2 Status**: Week 5-6 COMPLETE, Week 7-8 READY TO START
**Key Achievement**: PDF parser with advanced security analysis
**Next Focus**: Pattern matching engine with 200MB/s target