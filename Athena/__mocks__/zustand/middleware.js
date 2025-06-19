import { vi } from 'vitest';

// Enhanced middleware mocks that properly handle zustand patterns
export const devtools = vi.fn((config) => {
  return (set, get, api) => {
    if (typeof config === 'function') {
      return config(set, get, api);
    }
    return config;
  };
});

export const persist = vi.fn((config, options) => {
  return (set, get, api) => {
    if (typeof config === 'function') {
      return config(set, get, api);
    }
    return config;
  };
});

export const subscribeWithSelector = vi.fn((config) => {
  return (set, get, api) => {
    if (typeof config === 'function') {
      return config(set, get, api);
    }
    return config;
  };
});

export const immer = vi.fn((config) => {
  return (set, get, api) => {
    if (typeof config === 'function') {
      return config(set, get, api);
    }
    return config;
  };
});

export const combine = vi.fn((initialState, config) => {
  return (set, get, api) => {
    const combinedSet = (partial, replace) => {
      if (typeof partial === 'function') {
        return set(partial, replace);
      }
      return set({ ...get(), ...partial }, replace);
    };
    
    const initialResult = typeof initialState === 'function' 
      ? initialState(combinedSet, get, api)
      : initialState;
    
    const configResult = typeof config === 'function'
      ? config(combinedSet, get, api)
      : config || {};
    
    return {
      ...initialResult,
      ...configResult
    };
  };
});

export default {
  devtools,
  persist,
  subscribeWithSelector,
  immer,
  combine
};