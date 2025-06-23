import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Check if we're building for Tauri
const isTauri = process.env.TAURI_PLATFORM !== undefined;

export default defineConfig({
  plugins: [
    solidPlugin(),
    svelte({
      include: ['**/*.svelte'],
      exclude: ['**/node_modules/**'],
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Allow external connections for web version
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    // Output to different directories for web vs Tauri
    outDir: isTauri ? 'dist' : 'dist-web',
  },
  define: {
    // Define a global variable to check if running in Tauri
    '__TAURI__': isTauri,
  },
});