import { useEffect, useRef } from 'react';
import { useAppStore } from '../index';
import { AppState } from '../types';

/**
 * Subscribe to specific state changes with cleanup
 * @param selector State selector function
 * @param callback Function to call when selected state changes
 * @param equalityFn Optional equality function
 */
export function useStoreSubscription<T>(
  selector: (state: AppState) => T,
  callback: (value: T) => void,
  equalityFn?: (a: T, b: T) => boolean
) {
  const previousValueRef = useRef<T>();
  
  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      (state) => selector(state),
      (value) => {
        const previousValue = previousValueRef.current;
        const isEqual = equalityFn
          ? equalityFn(previousValue as T, value)
          : previousValue === value;
          
        if (!isEqual) {
          previousValueRef.current = value;
          callback(value);
        }
      }
    );
    
    return unsubscribe;
  }, [selector, callback, equalityFn]);
}

/**
 * Subscribe to multiple state properties
 * @param selectors Object with selector functions
 * @param callback Function to call when any selected state changes
 */
export function useMultipleSubscriptions<T extends Record<string, any>>(
  selectors: { [K in keyof T]: (state: AppState) => T[K] },
  callback: (values: T) => void
) {
  const valuesRef = useRef<T>({} as T);
  
  useEffect(() => {
    const unsubscribes = Object.entries(selectors).map(([key, selector]) => {
      return useAppStore.subscribe(
        selector as (state: AppState) => any,
        (value) => {
          valuesRef.current = { ...valuesRef.current, [key]: value };
          callback(valuesRef.current);
        }
      );
    });
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [selectors, callback]);
}

/**
 * Performance monitor for store updates
 */
export function useStorePerformanceMonitor() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    
    let updateCount = 0;
    const startTime = Date.now();
    
    const unsubscribe = useAppStore.subscribe(
      (state) => state,
      () => {
        updateCount++;
      }
    );
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const updatesPerSecond = updateCount / elapsed;
      
      if (updatesPerSecond > 60) {
        console.warn(`High store update frequency: ${updatesPerSecond.toFixed(2)} updates/sec`);
      }
    }, 5000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);
}