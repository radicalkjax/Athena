# Tauri 2.0 Development Guide - Athena v2

This guide provides comprehensive information for developing, building, and deploying the Athena v2 malware analysis platform using Tauri 2.0.

**Last Updated**: December 22, 2025
**Tauri Version**: 2.0
**Project Status**: Implementation Complete

## Table of Contents

1. [Overview](#overview)
2. [Development Setup](#development-setup)
3. [Platform-Specific Development](#platform-specific-development)
4. [Architecture Details](#architecture-details)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Overview

Athena v2 is a **desktop-only** malware analysis platform using Tauri 2.0 to provide:
- Native desktop applications for Windows, macOS, and Linux
- Rust backend for performance and security (Tauri commands)
- SolidJS frontend for reactive UI
- WASM modules using Wasmtime 29.0 Component Model
- Embedded axum API server on port 3000
- Docker container support via bollard crate

### Tech Stack (December 2025)

| Component | Version | Purpose |
|-----------|---------|---------|
| Tauri | 2.0 | Desktop wrapper and IPC |
| Rust | 1.75+ | Backend logic and commands |
| SolidJS | 1.9.5 | Reactive frontend UI |
| Vite | 7.1.10 | Frontend build tool |
| Wasmtime | 29.0 | WASM runtime engine |
| bollard | 0.16 | Docker integration |

## Development Setup

### Prerequisites Check

```bash
# Check Node.js version (18+ required)
node --version  # Should be v18.0.0 or higher

# Check Rust installation (1.75+ required)
rustc --version
cargo --version

# Check wasm32-wasip1 target (for WASM modules)
rustup target list --installed | grep wasm32-wasip1
```

### Initial Setup

1. **Install system dependencies**
   ```bash
   # Rust and cargo
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

   # WASM target
   rustup target add wasm32-wasip1

   # cargo-component for WASM Component Model
   cargo install cargo-component --locked
   ```

2. **Install project dependencies**
   ```bash
   cd /Users/kali/Athena/Athena/athena-v2
   npm install
   ```

3. **Build Rust backend**
   ```bash
   cd /Users/kali/Athena/Athena/athena-v2/src-tauri
   cargo build
   ```

4. **Build WASM modules (optional for development)**
   ```bash
   cd /Users/kali/Athena/Athena/athena-v2/wasm-modules/core
   ./build-all.sh  # Or build individual modules
   ```

## Platform-Specific Development

### macOS Development

**Status**: ✅ Implemented

```bash
# Development mode
cd /Users/kali/Athena/Athena/athena-v2
npm run tauri:dev

# Production build
npm run tauri:build

# Build universal binary (Intel + Apple Silicon)
npm run tauri build -- --target universal-apple-darwin
```

**Requirements**:
- macOS 10.15+ (Catalina or later)
- Xcode Command Line Tools: `xcode-select --install`
- Code signing certificate (for distribution outside App Store)

**Output Location**:
- DMG installer: `athena-v2/src-tauri/target/release/bundle/dmg/`
- App bundle: `athena-v2/src-tauri/target/release/bundle/macos/Athena.app`

### Windows Development

**Status**: ✅ Implemented

```bash
# Development
cd /Users/kali/Athena/Athena/athena-v2
npm run tauri:dev

# Production build
npm run tauri:build

# Build for specific architecture
npm run tauri build -- --target x86_64-pc-windows-msvc
```

**Requirements**:
- Windows 10/11
- Visual Studio 2022 with C++ build tools
- Windows SDK
- WebView2 runtime (pre-installed on Windows 10/11)

**Output Location**:
- MSI installer: `athena-v2/src-tauri/target/release/bundle/msi/`
- Executable: `athena-v2/src-tauri/target/release/athena-v2.exe`

**Common Issues**:
- If WebView2 is missing, download from Microsoft
- Ensure Visual Studio includes "Desktop development with C++"
- Run builds from "Developer Command Prompt" for best compatibility

### Linux Development

**Status**: ✅ Implemented

```bash
# Development
cd /Users/kali/Athena/Athena/athena-v2
npm run tauri:dev

# Production build (creates AppImage)
npm run tauri:build

# Build .deb package for Debian/Ubuntu
npm run tauri build -- --bundles deb

# Build .rpm package for Fedora/RHEL
npm run tauri build -- --bundles rpm
```

**Requirements**:
```bash
# Ubuntu/Debian 20.04+
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora/RHEL
sudo dnf install webkit2gtk4.1-devel \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

**Output Location**:
- AppImage: `athena-v2/src-tauri/target/release/bundle/appimage/`
- .deb package: `athena-v2/src-tauri/target/release/bundle/deb/`
- .rpm package: `athena-v2/src-tauri/target/release/bundle/rpm/`

### Mobile Platforms (Not Supported)

Athena v2 is designed as a **desktop-only** application. Mobile platforms (iOS/Android) are not supported due to:
- Docker container requirements
- WASM module complexity
- Desktop-focused UI/UX design
- System resource requirements

For mobile malware analysis, consider using Athena's web-based API or a companion mobile app that connects to a desktop Athena instance.

## Architecture Details

### Frontend-Backend Communication

Tauri uses a command system for IPC:

**Frontend (TypeScript)**:
```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Call Rust function
const result = await invoke('analyze_file', { 
  path: '/path/to/file' 
});
```

**Backend (Rust)**:
```rust
#[tauri::command]
async fn analyze_file(path: String) -> Result<FileAnalysis, String> {
    // Implementation
}
```

### File Structure

```
/Users/kali/Athena/Athena/athena-v2/
├── src/                             # Frontend (SolidJS + TypeScript)
│   ├── components/solid/            # UI components
│   ├── services/                    # Frontend services
│   ├── types/                       # TypeScript type definitions
│   └── utils/                       # Helper utilities
├── src-tauri/                       # Backend (Rust + Tauri)
│   ├── src/
│   │   ├── main.rs                  # App initialization
│   │   ├── lib.rs                   # Library exports
│   │   ├── api_server.rs            # Embedded axum server
│   │   ├── commands/                # Tauri command modules
│   │   │   ├── mod.rs
│   │   │   ├── file_ops.rs          # File operations
│   │   │   ├── file_analysis.rs     # Binary analysis
│   │   │   ├── ai_analysis.rs       # AI provider integration
│   │   │   ├── system_monitor.rs    # System metrics
│   │   │   ├── wasm_runtime.rs      # WASM execution
│   │   │   ├── container.rs         # Docker containers
│   │   │   ├── network.rs           # Network/PCAP
│   │   │   ├── yara_scanner.rs      # YARA scanning
│   │   │   └── workflow.rs          # Job orchestration
│   │   ├── ai_providers/            # AI provider clients
│   │   ├── sandbox/                 # Sandbox orchestrator
│   │   ├── workflow/                # Workflow engine
│   │   └── threat_intel/            # STIX/TAXII parsing
│   ├── tauri.conf.json              # Tauri configuration
│   ├── Cargo.toml                   # Rust dependencies
│   └── capabilities/                # Tauri 2.0 permissions
└── wasm-modules/core/               # WASM security modules
    ├── analysis-engine/             # Disassembly, CFG, decompiler
    ├── crypto/                      # Hash, encryption detection
    ├── deobfuscator/                # Code deobfuscation
    ├── disassembler/                # x86/ARM disassembly
    ├── file-processor/              # PE/ELF/Mach-O parsing
    ├── network/                     # Protocol parsing
    ├── pattern-matcher/             # YARA engine
    ├── sandbox/                     # Syscall tracking
    └── security/                    # Security utilities
```

### State Management

**Frontend State** (SolidJS):
```typescript
// src/stores/analysisStore.ts
import { createStore } from 'solid-js/store';

export const [analysisState, setAnalysisState] = createStore({
  currentFile: null,
  results: [],
  loading: false
});
```

**Backend State** (Rust):
```rust
use tauri::State;
use std::sync::Mutex;

struct AppState {
    analysis_cache: Mutex<HashMap<String, AnalysisResult>>
}

#[tauri::command]
fn get_analysis(state: State<AppState>, hash: String) -> Option<AnalysisResult> {
    state.analysis_cache.lock().unwrap().get(&hash).cloned()
}
```

## Common Tasks

### Adding a New Command

1. **Create Rust function** in `src-tauri/src/commands/`:
   ```rust
   #[tauri::command]
   pub async fn my_command(param: String) -> Result<String, String> {
       Ok(format!("Processed: {}", param))
   }
   ```

2. **Register in main.rs**:
   ```rust
   tauri::Builder::default()
       .invoke_handler(tauri::generate_handler![
           my_command,
           // other commands...
       ])
   ```

3. **Use in frontend**:
   ```typescript
   const result = await invoke('my_command', { param: 'test' });
   ```

### Working with Files

**File Selection**:
```typescript
import { open } from '@tauri-apps/api/dialog';

const selected = await open({
  multiple: false,
  filters: [{
    name: 'Executable',
    extensions: ['exe', 'dll', 'so', 'dylib']
  }]
});
```

**File Reading**:
```rust
use std::fs;

#[tauri::command]
async fn read_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| e.to_string())
}
```

### Platform Detection

```typescript
import { platform } from '@tauri-apps/api/os';

const currentPlatform = await platform();
// Returns: 'darwin' | 'windows' | 'linux' | 'ios' | 'android'
```

### Window Management

```typescript
import { appWindow } from '@tauri-apps/api/window';

// Minimize
await appWindow.minimize();

// Toggle fullscreen
await appWindow.setFullscreen(true);

// Set size
await appWindow.setSize(new LogicalSize(1200, 800));
```

## Troubleshooting

### Common Issues

**Build Fails on Windows**
- Ensure Visual Studio 2022 is installed with C++ tools
- Run build from "Developer Command Prompt"
- Check WebView2 is installed

**iOS Simulator Won't Start**
- Open Xcode and accept licenses
- Ensure iOS simulators are downloaded
- Try: `xcrun simctl list devices`

**Android Build Fails**
- Verify ANDROID_HOME is set correctly
- Check NDK is installed via Android Studio
- Ensure Java 17 is default: `java -version`

**Rust Compilation Errors**
- Update Rust: `rustup update`
- Clean build: `cd src-tauri && cargo clean`
- Check Cargo.lock isn't corrupted

### Debug Logging

**Enable Rust debug logs**:
```bash
RUST_LOG=debug npm run tauri:dev
```

**Frontend debugging**:
- Right-click in app window → "Inspect Element"
- Use browser DevTools

**Mobile debugging**:
- iOS: Safari → Develop → Device
- Android: Chrome → chrome://inspect

## Best Practices

### Security

1. **Validate all inputs** from frontend:
   ```rust
   #[tauri::command]
   fn process_path(path: String) -> Result<(), String> {
       // Validate path is within allowed directories
       let path = PathBuf::from(path);
       if !path.starts_with("/allowed/directory") {
           return Err("Invalid path".to_string());
       }
       // Process...
   }
   ```

2. **Use allowlist** for commands in `tauri.conf.json`

3. **Sanitize file paths** to prevent directory traversal

### Performance

1. **Use async commands** for long operations:
   ```rust
   #[tauri::command]
   async fn heavy_operation() -> Result<String, String> {
       tokio::task::spawn_blocking(|| {
           // CPU-intensive work
       }).await.map_err(|e| e.to_string())
   }
   ```

2. **Cache results** when appropriate

3. **Batch operations** to reduce IPC overhead

### Code Organization

1. **Separate concerns**: Keep UI logic in frontend, business logic in backend
2. **Use modules**: Organize commands by feature
3. **Error handling**: Use Result types consistently
4. **Documentation**: Document public APIs and complex logic

### Testing

**Frontend tests**:
```bash
npm test
```

**Rust tests**:
```bash
cd src-tauri
cargo test
```

**Integration tests**:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_file_analysis() {
        let result = analyze_file("test.exe".to_string()).await;
        assert!(result.is_ok());
    }
}
```

## Resources

- [Tauri 2.0 Documentation](https://beta.tauri.app/)
- [SolidJS Documentation](https://www.solidjs.com/)
- [Rust Book](https://doc.rust-lang.org/book/)
- [Athena GitHub Repository](https://github.com/yourusername/athena)

## Support

For issues specific to:
- **Tauri**: Check Tauri Discord or GitHub issues
- **Athena**: Open issue in project repository
- **Platform-specific**: Consult platform documentation