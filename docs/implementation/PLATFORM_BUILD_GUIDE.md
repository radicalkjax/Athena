# Platform Build Guide for Athena v2

**Last Updated**: December 22, 2025
**Tauri Version**: 2.0 (Production)
**Supported Platforms**: macOS, Windows, Linux (Desktop only)

## Prerequisites

### All Platforms
- Node.js 18+ and npm
- Rust 1.75+ (edition 2021)
- cargo-component for WASM modules: `cargo install cargo-component --locked`
- wasm32-wasip1 target: `rustup target add wasm32-wasip1`

### Windows
- Visual Studio 2022 with C++ build tools
- WebView2 (usually pre-installed on Windows 10/11)

### Linux
- Development libraries:
  ```bash
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
  ```

### macOS
- macOS 10.15+ (Catalina or later)
- Xcode Command Line Tools: `xcode-select --install`

## Build Commands

### Quick Start

```bash
# Navigate to project directory
cd /Users/kali/Athena/Athena/athena-v2

# Install dependencies
npm install

# Development mode (hot reload)
npm run tauri:dev

# Production build (current platform)
npm run tauri:build
```

### Desktop Platform Builds

#### Windows

```bash
cd /Users/kali/Athena/Athena/athena-v2

# Development
npm run tauri:dev

# Production build
npm run tauri:build

# Specific target
npm run tauri build -- --target x86_64-pc-windows-msvc
```

**Output**:
- MSI installer: `src-tauri/target/release/bundle/msi/`
- Executable: `src-tauri/target/release/athena-v2.exe`

#### Linux

```bash
cd /Users/kali/Athena/Athena/athena-v2

# Development
npm run tauri:dev

# Production build (AppImage by default)
npm run tauri:build

# Build .deb package
npm run tauri build -- --bundles deb

# Build .rpm package
npm run tauri build -- --bundles rpm
```

**Output**:
- AppImage: `src-tauri/target/release/bundle/appimage/`
- .deb package: `src-tauri/target/release/bundle/deb/`
- .rpm package: `src-tauri/target/release/bundle/rpm/`

#### macOS

```bash
cd /Users/kali/Athena/Athena/athena-v2

# Development
npm run tauri:dev

# Production build
npm run tauri:build

# Universal binary (Intel + Apple Silicon)
npm run tauri build -- --target universal-apple-darwin
```

**Output**:
- DMG installer: `src-tauri/target/release/bundle/dmg/`
- App bundle: `src-tauri/target/release/bundle/macos/Athena.app`

### Build WASM Modules

Before building the main application, you may want to build the WASM modules:

```bash
# Build all WASM modules
cd /Users/kali/Athena/Athena/athena-v2/wasm-modules/core
for module in */; do
  (cd "$module" && cargo component build --release)
done

# Or build individual module
cd /Users/kali/Athena/Athena/athena-v2/wasm-modules/core/crypto
cargo component build --release
```

## Platform-Specific Notes

### Performance Optimization
- Desktop builds include full feature set
- All platforms support hardware acceleration
- WASM modules use Wasmtime for near-native performance
- Docker containers for isolated malware execution

### Troubleshooting

#### Windows
- If build fails, ensure Visual Studio is properly installed with C++ tools
- Run from "Developer Command Prompt" for best compatibility
- Check WebView2 is installed: Windows 10/11 include it by default

#### Linux
- Check all dependencies are installed with correct versions
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev build-essential
  ```
- May need additional libraries based on distribution
- For Fedora/RHEL, use `dnf` instead of `apt`

#### macOS
- Install Xcode Command Line Tools if missing:
  ```bash
  xcode-select --install
  ```
- Accept Xcode license if prompted
- For code signing, configure in `src-tauri/tauri.conf.json`

#### All Platforms
- Clear Rust cache if encountering build issues:
  ```bash
  cd /Users/kali/Athena/Athena/athena-v2/src-tauri
  cargo clean
  cargo build
  ```
- Update Rust toolchain:
  ```bash
  rustup update stable
  ```
- Rebuild WASM modules if changed:
  ```bash
  cd /Users/kali/Athena/Athena/athena-v2/wasm-modules/core
  ./build-all.sh
  ```

## Resources

- [Tauri 2.0 Documentation](https://v2.tauri.app/)
- [Cargo Component Documentation](https://github.com/bytecodealliance/cargo-component)
- [Wasmtime Documentation](https://docs.wasmtime.dev/)
- [Athena Architecture Docs](/Users/kali/Athena/Athena/docs/ARCHITECTURE.md)