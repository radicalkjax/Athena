import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    target: 'es2020'
  },
  define: {
    '__DEV__': 'true'
  },
  resolve: {
    conditions: ['module', 'import', 'node'],
    alias: {
      // CRITICAL: picker must be first to override module resolution
      '@react-native-picker/picker': path.resolve(__dirname, './__mocks__/@react-native-picker/picker.js'),
      
      // React Native mocks
      'react-native': path.resolve(__dirname, './__mocks__/react-native.js'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, './__mocks__/@react-native-async-storage/async-storage.js'),
      'expo': path.resolve(__dirname, './__mocks__/expo.js'),
      'expo-router': path.resolve(__dirname, './__mocks__/expo-router.js'),
      'expo-font': path.resolve(__dirname, './__mocks__/expo-font.js'),
      'expo-secure-store': path.resolve(__dirname, './__mocks__/expo-secure-store.js'),
      'expo-device': path.resolve(__dirname, './__mocks__/expo-device.js'),
      'expo-constants': path.resolve(__dirname, './__mocks__/expo-constants.js'),
      'expo-file-system': path.resolve(__dirname, './__mocks__/expo-file-system.js'),
      'expo-document-picker': path.resolve(__dirname, './__mocks__/expo-document-picker.js'),
      'react-native-screens': path.resolve(__dirname, './__mocks__/react-native-screens.js'),
      'react-native-safe-area-context': path.resolve(__dirname, './__mocks__/react-native-safe-area-context.js'),
      'react-native-reanimated': path.resolve(__dirname, './__mocks__/react-native-reanimated.js'),
      'react-native-gesture-handler': path.resolve(__dirname, './__mocks__/react-native-gesture-handler.js'),
      '@testing-library/react-native': path.resolve(__dirname, './__mocks__/@testing-library/react-native.js'),
      '@testing-library/react-hooks': path.resolve(__dirname, './__mocks__/@testing-library/react-hooks.js'),
      '@expo/vector-icons': path.resolve(__dirname, './__mocks__/@expo/vector-icons.js'),
      '@expo/vector-icons/MaterialIcons': path.resolve(__dirname, './__mocks__/@expo/vector-icons/MaterialIcons.js'),
      '@react-native-community/slider': path.resolve(__dirname, './__mocks__/@react-native-community/slider.js'),
      'zustand$': path.resolve(__dirname, './__mocks__/zustand.js'),
      'zustand/middleware$': path.resolve(__dirname, './__mocks__/zustand/middleware.js'),
      
      // Database mocks
      'sequelize': path.resolve(__dirname, './__mocks__/sequelize.js'),
      'sequelize-typescript': path.resolve(__dirname, './__mocks__/sequelize-typescript.js'),
      
      // Project structure aliases
      '@': path.resolve(__dirname, '.'),
      '~': path.resolve(__dirname, '.'),
      '@env': path.resolve(__dirname, './__mocks__/@env.js'),
      '@/design-system': path.resolve(__dirname, './__mocks__/design-system.js'),
      '@/services/wasm-stubs': path.resolve(__dirname, './__mocks__/services/wasm-stubs.ts'),
      '../../../config/proxy': path.resolve(__dirname, './__mocks__/config/proxy.js'),
      '../../../store/securityStore': path.resolve(__dirname, './__mocks__/store/securityStore.ts'),
      '@/store': path.resolve(__dirname, './__mocks__/store/index.ts'),
      
      // Component mocks
      '@/components/ContainerConfigSelector': path.resolve(__dirname, './__mocks__/components/ContainerConfigSelector.tsx'),
      'Athena/components/ContainerConfigSelector': path.resolve(__dirname, './__mocks__/components/ContainerConfigSelector.tsx'),
      './Athena/components/ContainerConfigSelector': path.resolve(__dirname, './__mocks__/components/ContainerConfigSelector.tsx'),
      
      // React Navigation mocks
      '@react-navigation/native': path.resolve(__dirname, './__mocks__/@react-navigation/native.js'),
      '@react-navigation/stack': path.resolve(__dirname, './__mocks__/@react-navigation/stack.js'),
      
      // WASM bridge mocks for testing
      '^.*bridge/crypto-bridge$': path.resolve(__dirname, '../wasm-modules/bridge/__mocks__/crypto-bridge.ts'),
      '^.*bridge/analysis-engine-bridge-enhanced$': path.resolve(__dirname, '../wasm-modules/bridge/__mocks__/analysis-engine-bridge-enhanced.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
      '**/react-native-dist/**',
      '**/node_modules/@react-native-picker/picker/**',
      // Skip React Native component tests
      '__tests__/unit/components/**',
      '__tests__/unit/design-system/**',
      '__tests__/unit/hooks/**',
      '__tests__/integration/container-configuration-flow.test.tsx',
      '__tests__/integration/file-upload-results-flow.test.tsx',
      '__tests__/integration/malware-analysis-workflow.test.tsx'
    ],
    server: {
      deps: {
        external: []
      }
    },
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '__tests__/',
        '__mocks__/',
        '../wasm-modules/',
        '../services/',
        'react-native-dist/'
      ]
    }
  }
});