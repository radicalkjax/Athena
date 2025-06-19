# Athena Frontend Launch Methods Documentation

## Overview

This document explains the frontend launch methods for the Athena platform, particularly the recent transition from expo-router to direct navigation setup using React Navigation.

## Current Launch Method: Direct Navigation

As of the latest update (commit 24fde78f), Athena uses a **direct navigation setup** instead of expo-router. This change was implemented to resolve compatibility issues during the WASM integration phase.

### Entry Point Configuration

#### 1. Main Entry File (`index.js`)

```javascript
import { registerRootComponent } from 'expo';
import App from './App';

// Use the App component directly instead of expo-router
registerRootComponent(App);
```

This approach:
- Uses Expo's `registerRootComponent` to register the main App component
- Bypasses expo-router entirely
- Provides direct control over the navigation setup

#### 2. App Component (`App.tsx`)

```typescript
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from './app/(tabs)/index';
import AboutScreen from './app/(tabs)/about';
import SettingsScreen from './app/(tabs)/settings';
import { IconSymbol } from './components/ui/IconSymbol';
import { Colors } from './constants/Colors';
import { useColorScheme } from './hooks';
import { ErrorBoundary } from './shared/error-handling';
import { initializeAIModels } from './services/initializeModels';

const Tab = createBottomTabNavigator();

export default function App() {
  console.log('App.tsx loaded - using direct navigation setup');
  
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
```

### Key Components of Direct Navigation Setup

1. **NavigationContainer**: Root navigation context provider
2. **Tab Navigator**: Bottom tab navigation with three screens
3. **Error Boundary**: Wraps the entire app for error handling
4. **AI Model Initialization**: Triggered on app startup

## Previous Method: Expo Router

Prior to the WASM integration, Athena used expo-router for file-based routing. The remnants of this setup can still be found in:

- `/app` directory structure
- `app.config.js` with expo-router plugin
- Various `_layout.tsx` files

### Why the Change?

The switch from expo-router to direct navigation was made to:

1. **Resolve WASM Integration Issues**: Expo router was causing conflicts during the WASM module integration
2. **Simplify Navigation**: Direct control over navigation setup
3. **Improve Compatibility**: Better compatibility with the WASM bridge layer
4. **Faster Development**: Easier to debug and modify navigation behavior

## Launch Scripts

### Development Mode

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web"
  }
}
```

### Web Configuration

The app uses Metro bundler for web builds:

```json
{
  "expo": {
    "web": {
      "bundler": "metro"
    }
  }
}
```

## WASM Stubs for Development

During development, WASM modules are stubbed out to allow the frontend to run without the full WASM environment:

```typescript
// services/wasm-stubs/index.ts
export const WasmBridge = {
  AnalysisEngine: createStub('AnalysisEngine'),
  FileProcessor: createStub('FileProcessor'),
  PatternMatcher: createStub('PatternMatcher'),
  Deobfuscator: createStub('Deobfuscator'),
  Sandbox: createStub('Sandbox'),
  Crypto: createStub('Crypto'),
  Network: createStub('Network')
};
```

## Benefits of Current Approach

1. **Simplicity**: Direct navigation is easier to understand and debug
2. **Control**: Full control over navigation lifecycle
3. **Performance**: No overhead from file-based routing
4. **Compatibility**: Works seamlessly with WASM modules
5. **Type Safety**: Better TypeScript support with direct imports

## Migration Notes

If migrating from an older version using expo-router:

1. The `/app` directory structure is preserved but not used for routing
2. Navigation is handled entirely in `App.tsx`
3. Screens are imported directly from their file locations
4. No need for special `_layout` files for navigation

## Future Considerations

1. **Expo Router Return**: May consider returning to expo-router once WASM integration stabilizes
2. **Navigation V7**: Currently using React Navigation v7 for compatibility
3. **Deep Linking**: Will need custom implementation without expo-router
4. **Web Routing**: May need additional configuration for web URL routing

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [WASM Architecture](./WASM-ARCHITECTURE-COMPLETE.md)
- [Getting Started Guide](./GETTING_STARTED.md)
- [React Navigation Upgrade](./modernization/REACT_NAVIGATION_V7_UPGRADE.md)

---

**Last Updated**: 2025-06-15
**Status**: ✅ Active
**Version**: 1.0.0