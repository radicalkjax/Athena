import { Component, createSignal, createEffect, onCleanup, For, JSX } from 'solid-js';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => JSX.Element;
  overscan?: number;
  getKey?: (item: T, index: number) => string | number;
}

export function VirtualList<T>(props: VirtualListProps<T>): JSX.Element {
  const [scrollTop, setScrollTop] = createSignal(0);
  const [containerRef, setContainerRef] = createSignal<HTMLDivElement>();
  
  const overscan = props.overscan || 3;
  const totalHeight = () => props.items.length * props.itemHeight;
  
  const visibleRange = () => {
    const start = Math.floor(scrollTop() / props.itemHeight);
    const end = Math.ceil((scrollTop() + props.containerHeight) / props.itemHeight);
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(props.items.length, end + overscan)
    };
  };
  
  const visibleItems = () => {
    const { start, end } = visibleRange();
    return props.items.slice(start, end).map((item, i) => ({
      item,
      index: start + i,
      top: (start + i) * props.itemHeight
    }));
  };
  
  const handleScroll = (e: Event) => {
    const target = e.target as HTMLDivElement;
    setScrollTop(target.scrollTop);
  };
  
  createEffect(() => {
    const container = containerRef();
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      
      onCleanup(() => {
        container.removeEventListener('scroll', handleScroll);
      });
    }
  });
  
  return (
    <div
      ref={setContainerRef}
      style={{
        height: `${props.containerHeight}px`,
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div
        style={{
          height: `${totalHeight()}px`,
          position: 'relative'
        }}
      >
        <For each={visibleItems()}>
          {({ item, index, top }) => (
            <div
              style={{
                position: 'absolute',
                top: `${top}px`,
                left: '0',
                right: '0',
                height: `${props.itemHeight}px`
              }}
            >
              {props.renderItem(item, index)}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

// Performance optimization hook for debouncing
export function useDebounce<T>(value: () => T, delay: number): () => T {
  const [debouncedValue, setDebouncedValue] = createSignal<T>(value());
  
  createEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(() => value());
    }, delay);
    
    onCleanup(() => clearTimeout(timer));
  });
  
  return debouncedValue;
}

// Performance optimization hook for throttling
export function useThrottle<T>(value: () => T, delay: number): () => T {
  const [throttledValue, setThrottledValue] = createSignal<T>(value());
  const [lastRun, setLastRun] = createSignal(0);
  
  createEffect(() => {
    const now = Date.now();
    const timeSinceLastRun = now - lastRun();
    
    if (timeSinceLastRun >= delay) {
      setThrottledValue(() => value());
      setLastRun(now);
    } else {
      const timer = setTimeout(() => {
        setThrottledValue(() => value());
        setLastRun(Date.now());
      }, delay - timeSinceLastRun);
      
      onCleanup(() => clearTimeout(timer));
    }
  });
  
  return throttledValue;
}

// Lazy loading wrapper component
interface LazyComponentProps {
  component: () => Promise<{ default: Component }>;
  fallback?: JSX.Element;
}

export const LazyComponent: Component<LazyComponentProps> = (props) => {
  const [Component, setComponent] = createSignal<Component | null>(null);
  const [error, setError] = createSignal<Error | null>(null);
  
  createEffect(() => {
    props.component()
      .then(module => setComponent(() => module.default))
      .catch(err => setError(err));
  });
  
  if (error()) {
    return <div class="error-message">Failed to load component: {error()!.message}</div>;
  }
  
  const Comp = Component();
  if (Comp) {
    return <Comp />;
  }
  
  return props.fallback || <div class="loading">Loading...</div>;
};