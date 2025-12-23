# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-12-21

### Added (December 2025 - Production Release)
- **WASM Module Enhancements (9 modules - 100% complete)**:
  - Control flow flattening detection in deobfuscator with CFG analysis
  - AES/DES S-box detection in crypto module
  - TLS certificate parsing with ClientHello, SNI, and extension extraction
  - HTTP/2 protocol detection with preface and frame parsing
  - ELF library extraction using goblin `.libraries` field
  - Decompiler loop condition extraction from x86 code
  - Emulator unpacker with memory region extraction and pattern detection
  - Proper checksums for network packet export (MAC, TCP, UDP)

- **Testing & Quality**:
  - Comprehensive test suite with 169+ tests across Rust backend, WASM modules, and frontend
  - 40+ WASM module tests with 100% pass rate
  - 57 Rust backend tests for Tauri commands
  - 72 frontend tests with Vitest

- **Infrastructure**:
  - Docker container support via bollard crate with 7 Tauri commands
  - Container resource limits enforcement (memory, CPU, network isolation)
  - Retry logic with exponential backoff for AI provider failures
  - Real health status checks for AI providers (Claude, OpenAI, DeepSeek)

- **Analysis Capabilities**:
  - Loop detection and dominator trees in control flow graph analysis
  - Syscall tracking and virtual filesystem in sandbox module
  - Proper offline mode with caching for analysis services
  - DOMPurify sanitization for XSS prevention

### Changed
- Migrated from Electron to Tauri 2.0 for desktop application
- Upgraded WASM runtime from wasmer to wasmtime 29.0 with Component Model
- Upgraded SolidJS from 1.8.x to 1.9.5
- Upgraded Vite from 5.0.10 to 7.1.10 with comprehensive optimizations
- Replaced `.unwrap()` calls with proper error handling using `?` operator
- Improved error messages across file analysis, network, and AI commands
- Enhanced loading states with timeout handling in frontend components
- **Mock Data Elimination (December 2025)**:
  - Replaced all `Math.random()` simulation with real backend calls
  - Removed setTimeout fake progress in favor of real milestone-based progress
  - Eliminated hardcoded test results in YARA scanner
  - Fixed type safety issues (removed 9 `as any` casts)

### Fixed
- **Security Vulnerabilities**:
  - XSS vulnerability in DynamicAnalysis component (added DOMPurify sanitization)
  - XSS vulnerability in CodeEditor component (added DOMPurify sanitization)
  - AI cache panic risk from `.expect()` calls
  - Unsafe unwrap in API server error handling

- **Mock Data Issues (December 2025)**:
  - AIProviderStatus random simulation → real `get_ai_provider_status` command
  - WasmBridge fake progress → real milestone-based progress tracking
  - NetworkAnalysis setTimeout mock → real `analyze_network_packet` command
  - YaraScanner hardcoded results → new `validate_yara_rule` command with real metrics
  - AnalysisDashboard simulated analysis → real static/dynamic/behavioral analysis
  - tauriCompat random CPU/memory → proper "unavailable in web mode" errors

- **WASM Module Fixes**:
  - ELF import parsing now uses actual DT_NEEDED parsing with goblin `.libraries`
  - Decompiler hardcoded "true" condition → `find_loop_condition()` extracts real x86 conditions
  - Emulator unpacker always None → extracts actual memory regions with pattern detection
  - Network placeholder checksums → proper MAC generation + TCP/UDP checksums

- **General Fixes**:
  - PCAP export now generates valid libpcap format with proper headers
  - Pattern matcher statistics calculation (division-by-zero fix)
  - Command name mismatches between frontend and backend

### Security
- Added path validation to prevent directory traversal attacks
- Implemented WASM resource limits (memory and fuel consumption)
- Added input sanitization for all user-provided content with DOMPurify
- Removed API keys and secrets from source code
- Added signature verification for PE (Authenticode) and ELF (GPG/PGP) binaries
- **December 2025 Security Audit**:
  - Fixed XSS vulnerabilities in CodeEditor and DynamicAnalysis components
  - Replaced all innerHTML with sanitized content
  - Added proper error handling to prevent information leakage
  - Eliminated insecure `as any` type casts

## [0.1.0] - 2025-01-15

### Added
- **Tauri 2.0 Desktop Application**: Cross-platform desktop app (macOS, Windows, Linux)
- **Rust Backend**: High-performance backend with async support
  - File operations (upload, read, write, temp files)
  - System monitoring (CPU, memory, disk, network, processes)
  - AI provider integration (Claude, OpenAI, DeepSeek)
  - Circuit breaker pattern for provider failures
  - Queue manager for request rate limiting
  - Cache system with Redis and in-memory backends
  - WASM runtime with session management
  - Workflow job management
  - Embedded axum API server on port 3000
  - YARA rule scanning integration
  - Metrics collection and recording

- **WASM Security Analysis Modules**: 9 core modules built with Rust (Component Model)
  - **analysis-engine**: Advanced binary analysis with CFG, decompiler, emulator, loop detection
  - **crypto**: Cryptographic algorithm detection with AES/DES S-box identification
  - **deobfuscator**: Code deobfuscation with control flow flattening detection
  - **disassembler**: x86/x64/ARM instruction decoding
  - **file-processor**: PE, ELF, and Mach-O binary parsing with library extraction
  - **network**: Network protocol analysis (DNS, HTTP, TLS, HTTP/2) with certificate parsing
  - **pattern-matcher**: YARA-x integration with pattern matching
  - **sandbox**: Execution sandboxing with syscall tracking and behavioral analysis
  - **security**: Security validation and threat detection

- **SolidJS Frontend**: Modern reactive UI
  - File upload with drag-and-drop support
  - Real-time analysis results display
  - AI model selector with provider switching
  - System resource monitoring views
  - Disassembly viewer with syntax highlighting
  - Memory and CPU monitors
  - Batch export functionality
  - YARA rule editor
  - Hex viewer for binary inspection
  - Control flow graph visualization

- **AI Integration**: Multi-provider AI analysis
  - Claude Sonnet/Opus support with streaming
  - OpenAI GPT-4 support with tool use
  - DeepSeek integration
  - Automatic failover between providers
  - Rate limiting and circuit breaking
  - Structured analysis prompts

- **Container-Based Sandboxing**: Safe malware execution
  - Docker integration via bollard crate
  - Volume mounting and lifecycle management
  - Resource limits (memory, CPU, network isolation)
  - Container monitoring UI

- **Workflow Engine**: Customizable analysis workflows
  - Job queue management
  - Parallel execution support
  - Progress tracking and event emission
  - Error handling and recovery

### Technical Stack
- Tauri 2.0 (desktop framework)
- Rust 1.75+ (backend)
- SolidJS 1.9.5 (frontend)
- Wasmtime 29.0 (WASM runtime)
- Vite 7.1.10 (build tool)
- TypeScript 5.x (type safety)
- YARA-x 0.11 (pattern matching)

### Documentation
- Comprehensive README with architecture overview
- Development setup guide
- Docker container integration guide
- Test documentation (169+ tests)
- API documentation for all Tauri commands
- Security guidelines for contributors

[Unreleased]: https://github.com/athena/athena/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/athena/athena/releases/tag/v1.0.0
[0.1.0]: https://github.com/athena/athena/releases/tag/v0.1.0
