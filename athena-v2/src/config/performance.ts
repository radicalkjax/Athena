/**
 * Performance optimization configuration for Athena v2
 */

export const performanceConfig = {
  // Lazy loading configuration
  lazyLoading: {
    // Components that should always be loaded
    eagerComponents: ['upload', 'header', 'sidebar'],
    
    // Delay before showing loading spinner (ms)
    loadingDelay: 200,
    
    // Preload components when hovering over nav items
    preloadOnHover: true,
    
    // Preload delay (ms)
    preloadDelay: 150,
  },
  
  // Virtual scrolling for large lists
  virtualScrolling: {
    enabled: true,
    itemHeight: 40,
    overscan: 5,
    threshold: 100, // Use virtual scrolling when items > threshold
  },
  
  // Debounce/throttle timings
  inputDebounce: {
    search: 300,
    filter: 200,
    resize: 150,
  },
  
  // Memory management
  memory: {
    // Maximum file size for in-memory processing (MB)
    maxInMemoryFileSize: 10,
    
    // Clear cache when memory usage exceeds (MB)
    cacheThreshold: 500,
    
    // WASM memory limits (MB)
    wasmMemoryLimit: 512,
  },
  
  // Animation settings
  animations: {
    // Disable animations on low-end devices
    respectReducedMotion: true,
    
    // Animation durations (ms)
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
  },
  
  // Rendering optimizations
  rendering: {
    // Use CSS containment for better performance
    useContainment: true,
    
    // Use will-change for frequently animated elements
    useWillChange: true,
    
    // Batch DOM updates
    batchUpdates: true,
  },
  
  // Network optimizations
  network: {
    // Retry failed requests
    maxRetries: 3,
    
    // Request timeout (ms)
    timeout: 30000,
    
    // Use compression
    compression: true,
  },
};