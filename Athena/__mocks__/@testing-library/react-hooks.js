// Mock for @testing-library/react-hooks
import { vi } from 'vitest';

export const renderHook = vi.fn((hook, options = {}) => {
  let value;
  let error;
  
  try {
    value = hook();
  } catch (e) {
    error = e;
  }
  
  const result = {
    current: value,
    error,
  };
  
  return {
    result,
    rerender: vi.fn((newHook) => {
      try {
        result.current = (newHook || hook)();
        result.error = undefined;
      } catch (e) {
        result.error = e;
      }
    }),
    unmount: vi.fn(),
    waitFor: vi.fn(async (callback) => {
      await callback();
    }),
    waitForNextUpdate: vi.fn(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    }),
  };
});

export const act = vi.fn((callback) => {
  const result = callback();
  if (result && typeof result.then === 'function') {
    return result;
  }
  return Promise.resolve(result);
});

export const cleanup = vi.fn();

export default {
  renderHook,
  act,
  cleanup,
};