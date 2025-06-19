import { vi } from 'vitest';

// Mock AsyncStorage implementation
const store = new Map();

const AsyncStorage = {
  getItem: vi.fn(async (key) => {
    return store.get(key) || null;
  }),
  
  setItem: vi.fn(async (key, value) => {
    store.set(key, value);
  }),
  
  removeItem: vi.fn(async (key) => {
    store.delete(key);
  }),
  
  multiGet: vi.fn(async (keys) => {
    return keys.map(key => [key, store.get(key) || null]);
  }),
  
  multiSet: vi.fn(async (keyValuePairs) => {
    keyValuePairs.forEach(([key, value]) => {
      store.set(key, value);
    });
  }),
  
  multiRemove: vi.fn(async (keys) => {
    keys.forEach(key => store.delete(key));
  }),
  
  getAllKeys: vi.fn(async () => {
    return Array.from(store.keys());
  }),
  
  clear: vi.fn(async () => {
    store.clear();
  }),
  
  flushGetRequests: vi.fn(),
  
  // Additional methods for completeness
  mergeItem: vi.fn(async (key, value) => {
    const existingValue = store.get(key);
    if (existingValue) {
      try {
        const existingObject = JSON.parse(existingValue);
        const newObject = JSON.parse(value);
        const merged = { ...existingObject, ...newObject };
        store.set(key, JSON.stringify(merged));
      } catch (error) {
        store.set(key, value);
      }
    } else {
      store.set(key, value);
    }
  }),
  
  multiMerge: vi.fn(async (keyValuePairs) => {
    for (const [key, value] of keyValuePairs) {
      await AsyncStorage.mergeItem(key, value);
    }
  })
};

export default AsyncStorage;