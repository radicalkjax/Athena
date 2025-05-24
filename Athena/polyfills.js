// Polyfills for Node.js modules in browser environment
import { Buffer } from 'buffer';
import process from 'process/browser';

// Complete hrtime polyfill
const hrtime = (previousTimestamp) => {
  const now = performance.now ? performance.now() : Date.now();
  const seconds = Math.floor(now / 1000);
  const nanoseconds = Math.floor((now % 1000) * 1000000);
  
  if (previousTimestamp) {
    const [prevSeconds, prevNanoseconds] = previousTimestamp;
    return [seconds - prevSeconds, nanoseconds - prevNanoseconds];
  }
  
  return [seconds, nanoseconds];
};

// Add bigint method to hrtime
hrtime.bigint = () => {
  const now = performance.now ? performance.now() : Date.now();
  return BigInt(Math.floor(now * 1000000));
};

// Enhanced process polyfill with missing methods
const enhancedProcess = {
  ...process,
  exit: (code = 0) => {
    console.warn(`process.exit(${code}) called in browser environment - ignoring`);
    // In browser, we can't actually exit, so we just log a warning
  },
  hrtime: hrtime
};

// Make Buffer and enhanced process available globally
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.process = enhancedProcess;
  window.global = window;
}

// Also make them available on globalThis
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer;
  globalThis.process = enhancedProcess;
  globalThis.global = globalThis;
}

export { Buffer, enhancedProcess as process };
