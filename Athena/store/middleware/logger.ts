import { StateCreator, StoreApi, StoreMutatorIdentifier } from 'zustand';
import { logger } from '@/shared/logging/logger';

type Logger = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string
) => StateCreator<T, Mps, Mcs>;

type LoggerImpl = <T>(
  f: StateCreator<T, [], []>,
  name?: string
) => StateCreator<T, [], []>;

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...args) => {
    const prevState = get();
    set(...args);
    const nextState = get();
    
    // Log state changes
    logger.debug(`[Store${name ? ` - ${name}` : ''}] State changed`, {
      prevState,
      nextState,
      diff: getDiff(prevState, nextState),
    });
  };

  store.setState = loggedSet;

  return f(loggedSet, get, store);
};

// Helper function to get the diff between two states
function getDiff(prevState: any, nextState: any): Record<string, any> {
  const diff: Record<string, any> = {};
  
  // Check for changed properties
  for (const key in nextState) {
    if (prevState[key] !== nextState[key]) {
      diff[key] = {
        from: prevState[key],
        to: nextState[key],
      };
    }
  }
  
  // Check for removed properties
  for (const key in prevState) {
    if (!(key in nextState)) {
      diff[key] = {
        from: prevState[key],
        to: undefined,
      };
    }
  }
  
  return diff;
}

export const zustandLogger = loggerImpl as Logger;