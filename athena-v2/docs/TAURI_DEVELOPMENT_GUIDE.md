# Tauri 2.0 Development Guide

This guide provides comprehensive information for developing, building, and deploying the Athena v2 application using Tauri 2.0.

## Table of Contents

1. [Overview](#overview)
2. [Development Setup](#development-setup)
3. [Platform-Specific Development](#platform-specific-development)
4. [Architecture Details](#architecture-details)
5. [Common Tasks](#common-tasks)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)

## Overview

Athena v2 uses Tauri 2.0 to provide:
- Native desktop applications for Windows, macOS, and Linux
- Mobile applications for iOS and Android
- Single codebase with platform-specific optimizations
- Rust backend for performance and security
- SolidJS frontend for reactive UI

## Development Setup

### Prerequisites Check

```bash
# Check Node.js version (18+ required)
node --version

# Check Rust installation
rustc --version
cargo --version

# Check Tauri CLI
npm list -g @tauri-apps/cli
```

### Initial Setup

1. **Install Tauri CLI globally**
   ```bash
   npm install -g @tauri-apps/cli@next
   ```

2. **Install project dependencies**
   ```bash
   cd athena-v2
   npm install
   ```

3. **Install Rust dependencies**
   ```bash
   cd src-tauri
   cargo build
   ```

## Platform-Specific Development

### macOS Development

**Status**: ✅ Fully Verified

```bash
# Development
npm run tauri:dev

# Build
npm run tauri:build:macos

# Build universal binary
npm run tauri build -- --target universal-apple-darwin
```

**Requirements**:
- Xcode Command Line Tools
- Code signing certificate (for distribution)

### Windows Development

**Status**: 🟡 Beta

```bash
# Development
npm run tauri:dev

# Build
npm run tauri:build:windows

# Build for specific architecture
npm run tauri build -- --target x86_64-pc-windows-msvc
```

**Requirements**:
- Visual Studio 2022 with C++ tools
- Windows SDK
- WebView2 runtime

**Common Issues**:
- If WebView2 is missing, download from Microsoft
- Ensure Visual Studio includes "Desktop development with C++"

### Linux Development

**Status**: 🟡 Beta

```bash
# Development
npm run tauri:dev

# Build AppImage
npm run tauri:build:linux

# Build .deb package
npm run tauri build -- --bundles deb
```

**Requirements**:
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel \
  openssl-devel \
  gtk3-devel \
  libappindicator-gtk3-devel
```

### iOS Development

**Status**: 🟡 Beta (Landscape Mode Enforced)

```bash
# One-time setup
npm run tauri:ios init

# Development with simulator
npm run tauri:ios:dev

# Development on device
npm run tauri ios dev -- --open

# Build for release
npm run tauri ios build
```

**Requirements**:
- macOS with Xcode 14+
- Apple Developer account
- iOS device or simulator

**Configuration**:
- Landscape orientation is enforced in `src-tauri/gen/apple/Info.plist`
- Minimum iOS version: 12.0

### Android Development

**Status**: 🟡 Beta (Landscape Mode Enforced)

```bash
# One-time setup
npm run tauri:android init

# Development
npm run tauri:android:dev

# Build APK
npm run tauri android build -- --apk

# Build AAB for Play Store
npm run tauri android build
```

**Requirements**:
- Android Studio
- Android SDK (API 24+)
- Java 17+
- Android NDK

**Environment Setup**:
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export ANDROID_SDK_ROOT=$ANDROID_HOME
export NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

**Configuration**:
- Landscape orientation enforced in `AndroidManifest.xml`
- Minimum SDK: 24 (Android 7.0)

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
src-tauri/
├── src/
│   ├── main.rs              # App initialization
│   └── commands/            # Tauri commands
│       ├── mod.rs           # Module exports
│       ├── file_ops.rs      # File operations
│       ├── ai_analysis.rs   # AI integration
│       ├── system_monitor.rs # System monitoring
│       └── wasm_runtime.rs  # WASM sandbox
├── tauri.conf.json         # Tauri configuration
├── Cargo.toml              # Rust dependencies
└── icons/                  # App icons
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