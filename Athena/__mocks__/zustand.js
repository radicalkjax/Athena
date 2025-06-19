import { vi } from 'vitest';
import { act } from '@testing-library/react-native';

// Create a simple store factory
const createStore = (initialState) => {
  let state = initialState;
  const listeners = new Set();

  const setState = (partial, replace) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    
    if (replace) {
      state = nextState;
    } else {
      state = Object.assign({}, state, nextState);
    }
    
    listeners.forEach(listener => listener(state));
  };

  const getState = () => state;
  
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const destroy = () => {
    listeners.clear();
  };

  const api = { setState, getState, subscribe, destroy };
  
  return api;
};

// Mock zustand's create function
export const create = vi.fn((createState) => {
  return (createStateWithMiddleware) => {
    const actualStateCreator = createStateWithMiddleware || createState;
    
    const api = createStore({});
    
    // Handle both direct state creators and middleware-wrapped creators
    let initialState;
    if (typeof actualStateCreator === 'function') {
      // Check if it's a state creator function or middleware wrapper
      try {
        initialState = actualStateCreator(api.setState, api.getState, api);
        if (typeof initialState === 'function') {
          // It's middleware, call it again
          initialState = initialState(api.setState, api.getState, api);
        }
      } catch (e) {
        // If error, just set empty state
        initialState = {};
      }
    } else {
      initialState = actualStateCreator || {};
    }
    
    api.setState(initialState, true);
    
    // Return a hook that works with React
    const useStore = (selector) => {
      if (!selector) {
        return api.getState();
      }
      return selector(api.getState());
    };
    
    // Add getState and setState methods to the hook
    useStore.getState = api.getState;
    useStore.setState = api.setState;
    useStore.subscribe = api.subscribe;
    useStore.destroy = api.destroy;
    
    return useStore;
  };
});

// Mock zustand middleware
export const devtools = vi.fn((fn) => fn);
export const persist = vi.fn((fn) => fn);
export const subscribeWithSelector = vi.fn((fn) => fn);

export default {
  create,
  devtools,
  persist,
  subscribeWithSelector
};