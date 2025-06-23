# Athena v2 - Cross-Platform AI-Powered Malware Analysis

Athena v2 is a powerful, cross-platform malware analysis platform built with Tauri 2.0, offering native performance across desktop and mobile devices with a focus on AI-powered threat detection and analysis.

## 🚀 Platform Support

| Platform | Status | Notes |
|----------|--------|-------|
| macOS | ✅ Verified | Fully tested and operational |
| Windows | 🟡 Beta | Requires Visual Studio 2022 |
| Linux | 🟡 Beta | Requires system libraries |
| iOS | 🟡 Beta | Landscape mode enforced |
| Android | 🟡 Beta | Landscape mode enforced |
| Web | ✅ Verified | Limited features (no Tauri APIs) |

## Prerequisites

### All Platforms
- **Node.js** 18+ and npm
- **Rust** 1.70+ with cargo
- **Tauri CLI** 2.0+

### Platform-Specific Requirements

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Windows
- Visual Studio 2022 with C++ build tools
- WebView2 (usually pre-installed on Windows 10/11)

#### Linux
```bash
# Ubuntu/Debian
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

#### iOS Development
- macOS with Xcode 14+
- Apple Developer account (for device testing)
- iOS Simulator or physical device

#### Android Development
- Android Studio with SDK 24+
- Java 17+
- Android NDK
- Environment variables:
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk
  export NDK_HOME=$ANDROID_HOME/ndk/[version]
  ```

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/athena.git
   cd athena/athena-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Install Rust (if not already installed)**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

## 🚀 Quick Start

### Using the Athena Launcher Script
The easiest way to run Athena v2 is through the unified launcher:

```bash
cd .. # Go to Athena root directory
./scripts/athena
# Select option 11 for Tauri 2.0 App
```

### Direct Commands

#### Desktop Development
```bash
# macOS/Linux/Windows development
npm run tauri:dev

# Platform-specific builds
npm run tauri:build:macos    # macOS Universal
npm run tauri:build:windows  # Windows x64
npm run tauri:build:linux    # Linux x64
```

#### Mobile Development
```bash
# iOS
npm run tauri:ios init      # First time setup
npm run tauri:ios:dev       # Development

# Android
npm run tauri:android init  # First time setup
npm run tauri:android:dev   # Development
```

#### Web Development
```bash
# Development server with hot reload
npm run web:dev

# Production build
npm run web:build

# Preview production build
npm run web:preview
```

## 🏗️ Architecture

### Technology Stack
- **Frontend Framework**: SolidJS for reactive, high-performance UI
- **Backend Runtime**: Rust with Tauri 2.0 for native capabilities
- **Styling**: Modern CSS with Barbie aesthetic theme
- **State Management**: SolidJS reactive stores
- **Cross-Platform**: Single codebase for desktop and mobile

### Key Components
- **File Analysis Engine**: SHA-256 hashing, file type detection
- **AI Integration**: Multiple AI provider support with ensemble analysis
- **WASM Runtime**: Sandboxed execution environment
- **System Monitoring**: Real-time CPU, memory, and network analysis

## ✨ Features

### Core Functionality
- ✅ **Multi-Platform Support**: Windows, macOS, Linux, iOS, Android
- ✅ **File Upload & Analysis**: Drag-and-drop with SHA-256 hashing
- ✅ **AI Provider Integration**: Claude, DeepSeek, OpenAI ensemble
- ✅ **Priority Navigation**: Task-based UI organization
- ✅ **Responsive Design**: Adaptive layouts for all screen sizes
- ✅ **Landscape Mode**: Enforced on mobile devices

### Analysis Capabilities
- ✅ **Static Analysis**: File structure, strings, imports
- ✅ **Dynamic Analysis**: Behavioral monitoring, API calls
- ✅ **Memory Analysis**: Heap/stack inspection, memory maps
- ✅ **Network Analysis**: Traffic monitoring, protocol detection
- ✅ **Disassembly**: x86/x64 instruction analysis
- ✅ **YARA Scanning**: Rule-based malware detection

### Advanced Features
- 🚧 **WASM Sandbox**: Isolated malware execution
- 🚧 **Threat Intelligence**: IoC correlation
- 🚧 **Custom Workflows**: Automated analysis pipelines
- 🚧 **Report Generation**: PDF/JSON export

## 📁 Project Structure

```
athena-v2/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Application entry point
│   │   └── commands/       # Tauri command handlers
│   │       ├── file_ops.rs # File operations
│   │       ├── ai_analysis.rs # AI integration
│   │       ├── system_monitor.rs # System monitoring
│   │       └── wasm_runtime.rs # WASM execution
│   ├── tauri.conf.json     # Tauri configuration
│   └── Cargo.toml          # Rust dependencies
├── src/                    # Frontend application
│   ├── components/         # SolidJS components
│   │   ├── analysis/       # Analysis tools UI
│   │   ├── layout/         # Layout components
│   │   ├── visualization/  # Data visualizations
│   │   └── wasm/          # WASM interface
│   ├── stores/            # State management
│   ├── services/          # Business logic
│   └── styles/            # CSS styling
├── docs/                  # Documentation
│   ├── design-requirements/ # UI/UX specifications
│   └── prompts/           # Development guides
└── package.json           # Node dependencies
```

## 🔧 Configuration

### Tauri Configuration
The app is configured in `src-tauri/tauri.conf.json`:
- Window dimensions: 1200x800 (desktop)
- Minimum size: 900x600
- Mobile: Landscape orientation enforced

### Build Targets
- Desktop: Universal binaries for all platforms
- Mobile: SDK 24+ (Android), iOS 12+ (iOS)

## 🧪 Development

### Hot Reload
The development server supports hot module replacement for rapid iteration:
```bash
npm run tauri:dev
```

### Debugging
- **Frontend**: Browser DevTools in the Tauri window
- **Backend**: Rust debug logs in terminal
- **Mobile**: Platform-specific debugging tools

### Testing
```bash
# Run frontend tests
npm test

# Run Rust tests
cd src-tauri && cargo test
```

## 📦 Building for Production

### Desktop Builds
```bash
# Build for current platform
npm run tauri:build

# Cross-platform builds (requires additional setup)
npm run tauri:build:windows
npm run tauri:build:linux
npm run tauri:build:macos
```

### Mobile Builds
```bash
# iOS (requires macOS)
npm run tauri:ios build

# Android
npm run tauri:android build
```

### Build Outputs
- **Windows**: `.msi` installer
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage`, `.deb` packages
- **iOS**: `.ipa` (requires signing)
- **Android**: `.apk`, `.aab` bundles

## 🚢 Deployment

### Desktop Distribution
- **Windows**: Microsoft Store, direct download
- **macOS**: Mac App Store, direct download
- **Linux**: Snap Store, Flathub, AppImage

### Mobile Distribution
- **iOS**: Apple App Store, TestFlight
- **Android**: Google Play Store, APK distribution

## 🤝 Contributing

Please read our [Contributing Guide](../CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

- Tauri team for the amazing framework
- SolidJS for the reactive UI library
- The transgender tech community 🏳️‍⚧️ for inspiration and support