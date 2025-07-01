// Performance optimization utilities without JSX

// Request animation frame based optimization
export function rafSchedule<T extends (...args: any[]) => any>(fn: T): T {
  let rafId: number | null = null;
  let lastArgs: Parameters<T>;
  
  const scheduled = (...args: Parameters<T>) => {
    lastArgs = args;
    
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        fn(...lastArgs);
        rafId = null;
      });
    }
  };
  
  return scheduled as T;
}

// Resource pooling for expensive operations
export class ResourcePool<T> {
  private pool: T[] = [];
  private inUse = new Set<T>();
  private createFn: () => T;
  private resetFn?: (resource: T) => void;
  private maxSize: number;
  
  constructor(
    createFn: () => T,
    options: { maxSize?: number; resetFn?: (resource: T) => void } = {}
  ) {
    this.createFn = createFn;
    this.maxSize = options.maxSize || 10;
    this.resetFn = options.resetFn;
  }
  
  acquire(): T {
    let resource = this.pool.pop();
    
    if (!resource) {
      resource = this.createFn();
    }
    
    this.inUse.add(resource);
    return resource;
  }
  
  release(resource: T) {
    if (!this.inUse.has(resource)) return;
    
    this.inUse.delete(resource);
    
    if (this.resetFn) {
      this.resetFn(resource);
    }
    
    if (this.pool.length < this.maxSize) {
      this.pool.push(resource);
    }
  }
  
  clear() {
    this.pool = [];
    this.inUse.clear();
  }
}

// Batch updates for better performance
export class BatchProcessor<T> {
  private queue: T[] = [];
  private processing = false;
  private batchSize: number;
  private delay: number;
  private processFn: (items: T[]) => void | Promise<void>;
  private timer: number | null = null;
  
  constructor(
    processFn: (items: T[]) => void | Promise<void>,
    options: { batchSize?: number; delay?: number } = {}
  ) {
    this.processFn = processFn;
    this.batchSize = options.batchSize || 50;
    this.delay = options.delay || 100;
  }
  
  add(item: T) {
    this.queue.push(item);
    this.scheduleProcess();
  }
  
  addMany(items: T[]) {
    this.queue.push(...items);
    this.scheduleProcess();
  }
  
  private scheduleProcess() {
    if (this.timer !== null) return;
    
    this.timer = window.setTimeout(() => {
      this.timer = null;
      this.process();
    }, this.delay);
  }
  
  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.batchSize);
      await this.processFn(batch);
    }
    
    this.processing = false;
  }
  
  flush() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    return this.process();
  }
}

// Cache with TTL
export class CacheWithTTL<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private defaultTTL: number;
  
  constructor(defaultTTL = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTTL = defaultTTL;
  }
  
  set(key: K, value: V, ttl?: number) {
    const expiry = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expiry });
  }
  
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }
  
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }
  
  delete(key: K) {
    this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  // Clean up expired entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }
}

// Debounce utility
export function useDebounce<T>(value: T, delay: number): T {
  let timeoutId: number;
  let debouncedValue = value;
  
  const debounce = (newValue: T) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      debouncedValue = newValue;
    }, delay);
  };
  
  return debouncedValue;
}