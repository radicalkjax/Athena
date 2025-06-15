"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withMetrics = withMetrics;
exports.trackInitialization = trackInitialization;
exports.trackMemoryUsage = trackMemoryUsage;
exports.trackModuleSize = trackModuleSize;
exports.createMetricsFactory = createMetricsFactory;
const metrics_1 = require("../../services/monitoring/metrics");
const perf_hooks_1 = require("perf_hooks");
/**
 * Wraps a WASM bridge with automatic metrics collection
 */
function withMetrics(bridgeInstance, moduleName) {
    const proxy = new Proxy(bridgeInstance, {
        get(target, prop) {
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
            return async function (...args) {
                const start = perf_hooks_1.performance.now();
                let success = true;
                try {
                    const result = await original.apply(target, args);
                    return result;
                }
                catch (error) {
                    success = false;
                    throw error;
                }
                finally {
                    const duration = (perf_hooks_1.performance.now() - start) / 1000; // Convert to seconds
                    (0, metrics_1.recordWASMOperation)(moduleName, prop.toString(), duration, success);
                }
            };
        }
    });
    return proxy;
}
/**
 * Track WASM module initialization
 */
async function trackInitialization(moduleName, initFn) {
    const start = perf_hooks_1.performance.now();
    try {
        const result = await initFn();
        const duration = (perf_hooks_1.performance.now() - start) / 1000;
        metrics_1.wasmMetrics.initializationDuration
            .labels(moduleName)
            .observe(duration);
        return result;
    }
    catch (error) {
        const duration = (perf_hooks_1.performance.now() - start) / 1000;
        metrics_1.wasmMetrics.initializationDuration
            .labels(moduleName)
            .observe(duration);
        metrics_1.wasmMetrics.operationCounter
            .labels(moduleName, 'initialization', 'failure')
            .inc();
        throw error;
    }
}
/**
 * Track WASM module memory usage
 */
function trackMemoryUsage(moduleName, memoryBytes) {
    metrics_1.wasmMetrics.memoryUsageBytes
        .labels(moduleName)
        .set(memoryBytes);
}
/**
 * Track WASM module size
 */
function trackModuleSize(moduleName, sizeBytes) {
    metrics_1.wasmMetrics.moduleSizeBytes
        .labels(moduleName)
        .set(sizeBytes);
}
/**
 * Create a metrics-enabled factory for WASM bridges
 */
function createMetricsFactory(moduleName, factory) {
    return async () => {
        const instance = await trackInitialization(moduleName, factory);
        return withMetrics(instance, moduleName);
    };
}
