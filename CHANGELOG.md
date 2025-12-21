# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive test suite with 169+ tests across Rust backend, WASM modules, and frontend
- Docker container support via bollard crate with 7 Tauri commands
- Container resource limits enforcement (memory, CPU, network isolation)
- Retry logic with exponential backoff for AI provider failures
- Real health status checks for AI providers (Claude, OpenAI, DeepSeek)
- Loop detection and dominator trees in control flow graph analysis
- Syscall tracking and virtual filesystem in sandbox module
- Proper offline mode with caching for analysis services

### Changed
- Migrated from Electron to Tauri 2.0 for desktop application
- Upgraded WASM runtime from wasmer to wasmtime 29.0 with Component Model
- Upgraded SolidJS from 1.8.x to 1.9.5
- Upgraded Vite from 5.0.10 to 7.1.10 with comprehensive optimizations
- Replaced `.unwrap()` calls with proper error handling using `?` operator
- Improved error messages across file analysis, network, and AI commands
- Enhanced loading states with timeout handling in frontend components

### Fixed
- XSS vulnerability in DynamicAnalysis component (added DOMPurify sanitization)
- AI cache panic risk from `.expect()` calls
- Unsafe unwrap in API server error handling
- ELF import parsing now uses actual DT_NEEDED parsing instead of hardcoded values
- PCAP export now generates valid libpcap format with proper headers
- Pattern matcher statistics calculation (division-by-zero fix)
- Command name mismatches between frontend and backend

### Security
- Added path validation to prevent directory traversal attacks
- Implemented WASM resource limits (memory and fuel consumption)
- Added input sanitization for all user-provided content
- Removed API keys and secrets from source code
- Added signature verification for PE (Authenticode) and ELF (GPG/PGP) binaries

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

- **WASM Security Analysis Modules**: 7 core modules built with Rust
  - **analysis-engine**: Advanced binary analysis with CFG, decompiler, emulator
  - **crypto**: Cryptographic algorithm detection and analysis
  - **deobfuscator**: Code deobfuscation techniques
  - **file-processor**: PE, ELF, and Mach-O binary parsing
  - **network**: Network protocol analysis (DNS, HTTP, TLS)
  - **pattern-matcher**: YARA-based pattern matching
  - **sandbox**: Execution sandboxing with syscall tracking

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

[Unreleased]: https://github.com/athena/athena/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/athena/athena/releases/tag/v0.1.0
