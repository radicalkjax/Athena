# WASM Migration Project - Session 6 Handoff Prompt

## 🎯 Mission Critical Context
You are taking over the WASM migration project for Athena, a security analysis platform. This is Session 6 of an ongoing migration from TypeScript/JavaScript to WebAssembly for performance and security improvements.

### 📍 Current Status: Phase 2, Week 5-6 Implementation (80% Complete)
- **Phase 1**: ✅ COMPLETE (Foundation - WASM setup, basic analysis engine, bridges)
- **Phase 2**: 🔄 IN PROGRESS (Core Analysis Engine enhancement - Week 5-6 of Weeks 5-12)
- **Timeline**: Still ahead of schedule

## 📚 Essential Reading Order
1. **FIRST**: Read the main context document:
   `/workspaces/Athena/docs/prompts/WASM/WASM-CONTEXT-PROMPT.md`

2. **THEN**: Review the tracking documents in this order:
   - `/workspaces/Athena/docs/prompts/WASM/tracking/migration-progress.md`
   - `/workspaces/Athena/docs/prompts/WASM/phase2-implementation-plan.md`
   - `/workspaces/Athena/docs/prompts/WASM/tracking/session5-complete.md`

3. **REFERENCE**: Architecture and plans:
   - `/workspaces/Athena/docs/prompts/WASM/file-processor-architecture.md`
   - `/workspaces/Athena/docs/prompts/WASM/security-sandbox-plan.md`

## 🏗️ Project Structure & Current State
```
/workspaces/Athena/
├── wasm-modules/
│   ├── core/
│   │   ├── analysis-engine/        # ✅ Phase 1 - COMPLETE & INTEGRATED
│   │   │   ├── pkg-web/           # Web build ready
│   │   │   └── pkg-node/          # Node.js build ready
│   │   ├── file-processor/         # 🔄 Phase 2 - 80% COMPLETE
│   │   │   ├── src/               
│   │   │   │   ├── lib.rs         # Main entry point
│   │   │   │   ├── detector.rs    # ✅ Format detection (20+ formats)
│   │   │   │   ├── validator.rs   # ✅ File validation
│   │   │   │   ├── extractor.rs   # ✅ Content extraction
│   │   │   │   ├── parser/
│   │   │   │   │   ├── script.rs  # ✅ JS/TS/Python/PS parsing
│   │   │   │   │   ├── pe.rs      # ✅ PE/Windows executable parser
│   │   │   │   │   ├── elf.rs     # ✅ ELF/Linux executable parser
│   │   │   │   │   └── pdf.rs     # ❌ TODO: PDF parser (stub only)
│   │   │   │   └── types.rs       # Type definitions
│   │   │   ├── pkg-web/           # ✅ Web build ready
│   │   │   └── pkg-node/          # ✅ Node.js build ready
│   │   └── pattern-matcher/        # ❌ TODO: Week 7-8
│   ├── bridge/                    
│   │   ├── analysis-engine-bridge-enhanced.ts  # ✅ Phase 1
│   │   ├── file-processor-bridge.ts           # ✅ Created in Session 5
│   │   ├── web-streaming-bridge.ts            # ✅ Phase 1
│   │   └── react-native-bridge.ts             # ✅ Phase 1
│   └── tests/                     # ✅ Integration tests framework ready
├── Athena/
│   └── services/
│       ├── analysisService.ts     # ✅ WASM integrated (Phase 1)
│       └── fileManager.ts         # ❌ TODO: Integrate file-processor
└── docs/prompts/WASM/
    └── tracking/                  # All progress tracking here
```

## 🎯 Immediate Tasks for Session 6

### 1. Complete PDF Parser Implementation
**File**: `/wasm-modules/core/file-processor/src/parser/pdf.rs`

The PDF parser needs to:
- Parse PDF header and version
- Extract document metadata (author, creation date, etc.)
- Detect embedded JavaScript
- Extract text streams
- Identify suspicious patterns (embedded executables, obfuscated JS)
- Handle malformed PDFs safely

Reference the PE and ELF parsers for the pattern.

### 2. Integrate File-Processor with fileManager.ts
**File**: `/Athena/services/fileManager.ts`

Steps:
1. Import the file-processor bridge
2. Initialize the WASM module
3. Replace existing validation logic with WASM calls
4. Add performance monitoring
5. Ensure backward compatibility
6. Handle errors gracefully

### 3. Create Integration Tests
Create tests in `/wasm-modules/tests/` for:
- File format detection accuracy
- Parser output validation
- Performance benchmarks
- Security detection verification

### 4. Run Full Test Suite
```bash
cd /workspaces/Athena/wasm-modules/tests
./run-integration-tests.sh
```

## 📋 Phase 2 Remaining Work

### Week 5-6 (Current - Finish These First):
- [ ] PDF parser implementation
- [ ] fileManager.ts integration
- [ ] Integration tests
- [ ] Performance benchmarks

### Week 7-8 (Next):
- [ ] Create pattern-matcher module
- [ ] Implement rule engine
- [ ] Port signature detection
- [ ] Optimize pattern matching

### Week 9-10:
- [ ] Enhance deobfuscation engine
- [ ] Add ML-based detection
- [ ] Implement behavioral analysis

### Week 11-12:
- [ ] Full integration testing
- [ ] Performance optimization
- [ ] Documentation
- [ ] Bug fixes

## 🔧 Technical Context & Decisions

### Build Commands:
```bash
# Build file-processor module
cd /workspaces/Athena/wasm-modules/core/file-processor
./build.sh

# Run tests
cargo test

# Check types
cd /workspaces/Athena && npm run typecheck
```

### Key Technical Decisions Made:
1. **rustc-hash instead of ahash** - For WASM compatibility
2. **FileFormat enum uses camelCase** - For JSON serialization
3. **Comprehensive error types** - FileProcessorError enum
4. **Security-first parsing** - All parsers do bounds checking

### Performance Targets:
- File parsing: 500MB/s for common formats
- Pattern matching: 200MB/s with 1000 rules
- Memory usage: <100MB for 1GB file
- Zero crashes on malformed input

## ⚠️ Important Implementation Notes

### PDF Parser Guidelines:
1. Use nom for parsing (already in dependencies)
2. Follow the same pattern as PE/ELF parsers
3. Focus on security indicators
4. Handle streams carefully (they can be compressed)
5. Look for:
   - `/JS` and `/JavaScript` tags
   - Embedded files (`/EmbeddedFiles`)
   - Suspicious form actions
   - Unusual compression/encoding

### Integration Guidelines:
1. The file-processor bridge is at `/wasm-modules/bridge/file-processor-bridge.ts`
2. It exports `createFileProcessor()` factory function
3. Always initialize before use: `await processor.initialize()`
4. Use proper error handling with try-catch
5. Clean up with `processor.destroy()` when done

### Testing Guidelines:
1. Test with real malware samples if available
2. Include malformed files in test suite
3. Benchmark against current JS implementation
4. Verify all security detections work

## 🏁 Success Criteria for Session 6

1. **PDF parser fully implemented** with security detection
2. **fileManager.ts integrated** with WASM file-processor
3. **All tests passing** including new integration tests
4. **Performance benchmarks** showing improvement
5. **Week 5-6 marked complete** in tracking

## 📞 Quick Reference

### Key Files to Work On:
1. `/wasm-modules/core/file-processor/src/parser/pdf.rs` - Implement PDF parser
2. `/Athena/services/fileManager.ts` - Integrate WASM module
3. `/wasm-modules/tests/integration/file-processor.test.ts` - Create tests

### Existing Examples to Reference:
1. PE parser: `/wasm-modules/core/file-processor/src/parser/pe.rs`
2. ELF parser: `/wasm-modules/core/file-processor/src/parser/elf.rs`
3. Analysis service integration: `/Athena/services/analysisService.ts`

### Type Definitions:
- Rust types: `/wasm-modules/core/file-processor/src/types.rs`
- TypeScript types: `/wasm-modules/bridge/file-processor-bridge.ts`

## 💡 Pro Tips
1. The PE and ELF parsers are excellent examples - follow their pattern
2. PDF format is complex - start with basic structure, add features incrementally
3. Test with both valid and malicious PDFs
4. The file-processor module is already well-structured - just fill in the gaps
5. Don't forget to update the todo list as you work

## 🎉 What's Been Achieved So Far
- Phase 1: 100% complete (4 weeks of work in 3 sessions)
- Phase 2 Week 5-6: 80% complete
- File-processor module: Core functionality done
- Security features: Comprehensive detection implemented
- Performance: Framework ready for benchmarking

The foundation is extremely solid. You just need to complete the PDF parser and integration to finish Week 5-6, then move on to the pattern matcher for Week 7-8.

Good luck with Session 6! 🚀

---
**Context preserved by**: Claude (Session 5)
**Date**: June 12, 2025
**Ready for**: PDF parser implementation and fileManager.ts integration