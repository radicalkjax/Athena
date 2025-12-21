import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

// Check if we're building for Tauri
const isTauri = process.env.TAURI_PLATFORM !== undefined;
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    solidPlugin(),
  ],

  // Vite 7: Improved dev server configuration
  server: {
    port: 5173,
    strictPort: true,
    host: host || true, // Allow external connections for web version

    // Vite 7: Better HMR
    hmr: host
      ? {
          protocol: 'ws',
          host: host,
          port: 1430,
        }
      : {
          overlay: true,
        },

    // Vite 7: Optimized file watching
    watch: {
      // Ignore large directories for better performance
      ignored: ['**/node_modules/**', '**/target/**', '**/.git/**'],
    },
  },

  // Clear screen on reload (Vite 7 default)
  clearScreen: false,

  // Environment variable prefix
  envPrefix: ['VITE_', 'TAURI_'],

  // Vite 7: Updated browser targets for modern support
  build: {
    // Modern browser targets (Vite 7 recommendation)
    target: process.env.TAURI_PLATFORM === 'windows'
      ? 'chrome105'  // Windows WebView2
      : process.env.TAURI_PLATFORM
      ? 'safari13'   // macOS/iOS WebKit
      : ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'], // Web version

    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,

    // Output to different directories for web vs Tauri
    outDir: isTauri ? 'dist' : 'dist-web',

    // Vite 7: Optimize chunk splitting
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Vendor chunks for better caching
          if (id.includes('node_modules')) {
            if (id.includes('solid-js')) {
              return 'vendor-solid';
            }
            return 'vendor';
          }
          // Separate WASM modules
          if (id.includes('wasm-modules')) {
            return 'wasm';
          }
        },
      },
    },

    // Vite 7: Inline assets smaller than 4kb
    assetsInlineLimit: 4096,

    // Vite 7: Enable CSS code splitting
    cssCodeSplit: true,
  },

  // Vite 7: Optimize dependency pre-bundling
  optimizeDeps: {
    include: ['solid-js', 'solid-js/web', '@solidjs/router'],
    exclude: ['@tauri-apps/api', '@tauri-apps/plugin-dialog'],
  },

  // Vite 7: Path resolution
  resolve: {
    alias: {
      '@': '/src',
      '~': '/src',
    },
  },

  define: {
    // Define a global variable to check if running in Tauri
    '__TAURI__': isTauri,
  },
});