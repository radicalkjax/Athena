import { wasmMetrics, recordWASMOperation } from '../../services/monitoring/metrics';
import { performance } from 'perf_hooks';

/**
 * Wraps a WASM bridge with automatic metrics collection
 */
export function withMetrics<T extends object>(
    bridgeInstance: T,
    moduleName: string
): T {
    const proxy = new Proxy(bridgeInstance, {
        get(target: any, prop: string | symbol) {
            const original = target[prop];
            
            // Only wrap functions
            if (typeof original !== 'function') {
                return original;
            }
            
            // Don't wrap internal methods
            if (prop.toString().startsWith('_') || prop === 'constructor') {
                return original;
            }
            
            // Return wrapped function
            return async function (...args: any[]) {
                const start = performance.now();
                let success = true;
                
                try {
                    const result = await original.apply(target, args);
                    return result;
                } catch (error: unknown) {
                    success = false;
                    throw error;
                } finally {
                    const duration = (performance.now() - start) / 1000; // Convert to seconds
                    recordWASMOperation(moduleName, prop.toString(), duration, success);
                }
            };
        }
    });
    
    return proxy as T;
}

/**
 * Track WASM module initialization
 */
export async function trackInitialization<T>(
    moduleName: string,
    initFn: () => Promise<T>
): Promise<T> {
    const start = performance.now();
    
    try {
        const result = await initFn();
        const duration = (performance.now() - start) / 1000;
        
        wasmMetrics.initializationDuration
            .labels(moduleName)
            .observe(duration);
        
        return result;
    } catch (error: unknown) {
        const duration = (performance.now() - start) / 1000;
        
        wasmMetrics.initializationDuration
            .labels(moduleName)
            .observe(duration);
        
        wasmMetrics.operationCounter
            .labels(moduleName, 'initialization', 'failure')
            .inc();
        
        throw error;
    }
}

/**
 * Track WASM module memory usage
 */
export function trackMemoryUsage(moduleName: string, memoryBytes: number) {
    wasmMetrics.memoryUsageBytes
        .labels(moduleName)
        .set(memoryBytes);
}

/**
 * Track WASM module size
 */
export function trackModuleSize(moduleName: string, sizeBytes: number) {
    wasmMetrics.moduleSizeBytes
        .labels(moduleName)
        .set(sizeBytes);
}

/**
 * Create a metrics-enabled factory for WASM bridges
 */
export function createMetricsFactory<T extends object>(
    moduleName: string,
    factory: () => Promise<T>
): () => Promise<T> {
    return async () => {
        const instance = await trackInitialization(moduleName, factory);
        return withMetrics(instance, moduleName) as T;
    };
}