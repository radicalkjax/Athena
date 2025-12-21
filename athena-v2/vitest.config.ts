import { defineConfig } from 'vitest/config';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ]
    }
  },
  resolve: {
    conditions: ['development', 'browser'],
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
});
