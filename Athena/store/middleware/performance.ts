import { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';
import { logger } from '@/shared/logging/logger';

type Performance = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string
) => StateCreator<T, Mps, Mcs>;

type PerformanceImpl = <T>(
  f: StateCreator<T, [], []>,
  name?: string
) => StateCreator<T, [], []>;

const performanceImpl: PerformanceImpl = (f, name) => (set, get, store) => {
  const performanceSet: typeof set = (...args) => {
    const start = performance.now();
    set(...args);
    const end = performance.now();
    const duration = end - start;
    
    // Log if update took more than 16ms (1 frame at 60fps)
    if (duration > 16) {
      logger.warn(`[Store${name ? ` - ${name}` : ''}] Slow state update`, {
        duration: `${duration.toFixed(2)}ms`,
        threshold: '16ms',
      });
    }
  };

  store.setState = performanceSet;

  return f(performanceSet, get, store);
};

export const performanceMonitor = performanceImpl as Performance;