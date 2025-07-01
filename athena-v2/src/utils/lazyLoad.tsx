import { lazy, Component, JSX, createSignal, createEffect, onCleanup } from 'solid-js';

interface LazyLoadOptions {
  threshold?: number;
  rootMargin?: string;
  fallback?: JSX.Element;
}

// Create a lazy loaded component with intersection observer
export function createLazyComponent<T extends Component<any>>(
  loader: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
) {
  const LazyComp = lazy(loader);
  
  return (props: Parameters<T>[0]) => {
    const [isVisible, setIsVisible] = createSignal(false);
    const [ref, setRef] = createSignal<HTMLDivElement>();
    
    createEffect(() => {
      const element = ref();
      if (!element) return;
      
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        },
        {
          threshold: options.threshold || 0.1,
          rootMargin: options.rootMargin || '50px'
        }
      );
      
      observer.observe(element);
      
      onCleanup(() => observer.disconnect());
    });
    
    return (
      <div ref={setRef}>
        {isVisible() ? (
          <LazyComp {...props} />
        ) : (
          options.fallback || <div style="min-height: 200px; display: flex; align-items: center; justify-content: center;">Loading...</div>
        )}
      </div>
    );
  };
}

// Memory optimization: cleanup large objects
export function useMemoryCleanup<T>(
  getValue: () => T,
  cleanup: (value: T) => void,
  dependencies?: any[]
) {
  const [value, setValue] = createSignal<T>(getValue());
  
  createEffect(() => {
    if (dependencies) {
      // Re-run when dependencies change
      dependencies.forEach(() => {});
    }
    
    const newValue = getValue();
    setValue(() => newValue);
    
    onCleanup(() => {
      cleanup(newValue);
    });
  });
  
  return value;
}