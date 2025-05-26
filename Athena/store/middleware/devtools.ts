import { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';
import { devtools as zustandDevtools } from 'zustand/middleware';

type DevTools = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  options?: DevtoolsOptions
) => StateCreator<T, Mps, Mcs>;

interface DevtoolsOptions {
  name?: string;
  enabled?: boolean;
}

const devtoolsImpl: DevTools = (f, options = {}) => {
  const { name = 'AthenaStore', enabled = process.env.NODE_ENV === 'development' } = options;
  
  if (!enabled) {
    return f;
  }
  
  // Use zustand's built-in devtools middleware
  return zustandDevtools(f, { name });
};

export const devtools = devtoolsImpl;