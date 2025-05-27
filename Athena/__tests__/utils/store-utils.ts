import { create, StateCreator } from 'zustand';
import { devtools } from 'zustand/middleware';

// Create test store without persistence
export const createTestStore = <T>(
  stateCreator: StateCreator<T>,
  name: string = 'test-store'
) => {
  return create<T>()(
    devtools(stateCreator, { name, enabled: false })
  );
};

// Reset all stores
export const resetAllStores = () => {
  // Get all store instances and reset them
  const stores = (global as any).__zustand_stores || [];
  stores.forEach((store: any) => {
    if (store.getState && store.setState) {
      const initialState = store.getInitialState?.() || {};
      store.setState(initialState, true);
    }
  });
};

// Mock store state
export const mockStoreState = (store: any, state: any) => {
  store.setState(state, true);
};

// Wait for store update
export const waitForStoreUpdate = (store: any, timeout = 1000) => {
  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      unsubscribe();
      resolve(store.getState());
    });

    setTimeout(() => {
      unsubscribe();
      resolve(store.getState());
    }, timeout);
  });
};