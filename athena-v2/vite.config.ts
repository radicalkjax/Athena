import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import { svelte } from '@sveltejs/vite-plugin-svelte';

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
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});