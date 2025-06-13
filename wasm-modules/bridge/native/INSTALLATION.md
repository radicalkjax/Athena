# React Native WASM Bridge Installation Guide

This guide explains how to integrate the WASM Analysis Engine native modules into your React Native application.

## Prerequisites

- React Native 0.60+ (for autolinking support)
- iOS: Xcode 12+
- Android: Android Studio, Gradle 6+

## Installation Steps

### 1. Copy Native Modules

Copy the native module files to your React Native project:

```bash
# iOS
cp -r wasm-modules/bridge/native/ios/* ios/

# Android
cp -r wasm-modules/bridge/native/android/* android/app/src/main/java/
```

### 2. iOS Setup

#### 2.1 Add to Podfile

In your `ios/Podfile`, add:

```ruby
pod 'WASMAnalysisEngine', :path => '../wasm-modules/bridge/native/ios'
```

#### 2.2 Install Pods

```bash
cd ios && pod install
```

#### 2.3 Add WASM Runtime

For production, you'll need to integrate a WASM runtime like:
- [WasmEdge](https://wasmedge.org/) for iOS
- Or compile Rust to static library

#### 2.4 Bundle WASM Module

Add the WASM file to your Xcode project:
1. Open Xcode
2. Right-click on your project
3. Add Files to "[Your Project]"
4. Select `athena_analysis_engine.wasm`
5. Ensure "Copy items if needed" is checked

### 3. Android Setup

#### 3.1 Update settings.gradle

Add to `android/settings.gradle`:

```gradle
include ':wasm-analysis-engine'
project(':wasm-analysis-engine').projectDir = new File(rootProject.projectDir, '../wasm-modules/bridge/native/android')
```

#### 3.2 Update app/build.gradle

Add to dependencies in `android/app/build.gradle`:

```gradle
dependencies {
    implementation project(':wasm-analysis-engine')
    // Add WASM runtime
    implementation 'org.wasmer:wasmer-jni:1.0.0'
}
```

#### 3.3 Register Package

In `MainApplication.java`, add:

```java
import com.athena.wasm.WASMAnalysisEnginePackage;

@Override
protected List<ReactPackage> getPackages() {
    return Arrays.<ReactPackage>asList(
        new MainReactPackage(),
        new WASMAnalysisEnginePackage() // Add this line
    );
}
```

#### 3.4 Bundle WASM Module

Place the WASM file in `android/app/src/main/assets/`:

```bash
cp wasm-modules/core/analysis-engine/pkg-node/athena_analysis_engine_bg.wasm android/app/src/main/assets/
```

### 4. React Native Usage

```typescript
import { reactNativeBridge } from '@/wasm-modules/bridge/react-native-bridge';

// Initialize the bridge
await reactNativeBridge.initialize();

// Use the bridge
const result = await reactNativeBridge.analyze(fileContent);
```

## Platform-Specific Considerations

### iOS

- Minimum iOS version: 11.0
- Ensure proper code signing for WASM runtime
- Consider App Store restrictions on dynamic code execution

### Android

- Minimum SDK: 21 (Android 5.0)
- ProGuard rules may be needed:
  ```
  -keep class com.athena.wasm.** { *; }
  -keep class org.wasmer.** { *; }
  ```

## Troubleshooting

### Common Issues

1. **Module not found**: Ensure native modules are properly linked
2. **WASM initialization fails**: Check that WASM file is bundled correctly
3. **Performance issues**: Consider using release builds for testing

### Debug Commands

```bash
# iOS
react-native log-ios

# Android
react-native log-android
```

## Performance Optimization

1. **Preload WASM Module**: Initialize on app startup
2. **Use Background Threads**: Already implemented in native modules
3. **Cache Results**: Consider implementing result caching
4. **Memory Management**: Monitor memory usage, especially on Android

## Security Considerations

1. **Code Signing**: Ensure WASM modules are signed
2. **Input Validation**: Always validate input before passing to WASM
3. **Sandboxing**: WASM provides sandboxing by default
4. **Updates**: Plan for WASM module updates without app updates

## Next Steps

1. Implement actual WASM runtime integration
2. Add unit tests for native modules
3. Set up CI/CD for native module builds
4. Create example app demonstrating usage