# Platform Build Guide for Athena V2

## Prerequisites

### All Platforms
- Node.js 18+ and npm
- Rust 1.70+
- Tauri CLI 2.0: `npm install -g @tauri-apps/cli@next`

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
- Xcode Command Line Tools: `xcode-select --install`

### iOS
- macOS with Xcode 14+
- Apple Developer account (for device testing)
- iOS Simulator or physical device

### Android
- Android Studio with SDK 24+
- Java 17+
- Android NDK
- Set environment variables:
  ```bash
  export ANDROID_HOME=$HOME/Android/Sdk
  export NDK_HOME=$ANDROID_HOME/ndk/[version]
  ```

## Build Commands

### Desktop Platforms

#### Windows
```bash
npm run tauri:build:windows
```

#### Linux
```bash
npm run tauri:build:linux
```

#### macOS
```bash
npm run tauri:build:macos
```

### Mobile Platforms

#### iOS

1. Initialize iOS project (first time only):
   ```bash
   npm run tauri:ios init
   ```

2. Development:
   ```bash
   npm run tauri:ios:dev
   ```

3. Production build:
   ```bash
   npm run tauri:ios build
   ```

#### Android

1. Initialize Android project (first time only):
   ```bash
   npm run tauri:android init
   ```

2. Development:
   ```bash
   npm run tauri:android:dev
   ```

3. Production build:
   ```bash
   npm run tauri:android build
   ```

## Platform-Specific Notes

### Landscape Orientation
- **iOS**: Enforced via Info.plist configuration
- **Android**: Enforced via AndroidManifest.xml with `android:screenOrientation="landscape"`

### Performance Optimization
- Mobile builds use optimized bundle sizes
- Desktop builds include full feature set
- All platforms support hardware acceleration

### Troubleshooting

#### Windows
- If build fails, ensure Visual Studio is properly installed
- Run as Administrator if permission errors occur

#### Linux
- Check all dependencies are installed with correct versions
- May need to install additional libraries based on distro

#### iOS
- Ensure developer certificate is properly configured
- Check provisioning profiles for device testing

#### Android
- Verify ANDROID_HOME and NDK_HOME are set correctly
- Ensure minimum SDK version (24) is installed