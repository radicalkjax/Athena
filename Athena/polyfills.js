// Polyfills for Node.js modules in browser environment
import { Buffer } from 'buffer';
import process from 'process/browser';

// Make Buffer and process available globally
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.process = process;
  window.global = window;
}

// Also make them available on globalThis
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer;
  globalThis.process = process;
  globalThis.global = globalThis;
}

export { Buffer, process };
