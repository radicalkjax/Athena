/**
 * Simple WASM Benchmark
 * Tests basic performance of WASM modules without complex dependencies
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
    module: string;
    sizeKB: number;
    loadTimeMs: number;
    status: 'success' | 'failed';
    error?: string;
}

async function benchmarkWASMModules() {
    console.log('🚀 WASM Module Size and Load Time Benchmark\n');
    
    const wasmDir = path.join(__dirname, '../core');
    const results: BenchmarkResult[] = [];
    
    // List of WASM modules to test
    const modules = [
        'analysis-engine/target/wasm32-unknown-unknown/release/athena_analysis_engine.wasm',
        'crypto/target/wasm32-unknown-unknown/release/crypto.wasm',
        'deobfuscator/target/wasm32-unknown-unknown/release/deobfuscator.wasm',
        'file-processor/target/wasm32-unknown-unknown/release/file_processor.wasm',
        'network/target/wasm32-unknown-unknown/release/network.wasm',
        'pattern-matcher/target/wasm32-unknown-unknown/release/pattern_matcher.wasm',
        'sandbox/target/wasm32-unknown-unknown/release/sandbox.wasm'
    ];
    
    for (const modulePath of modules) {
        const fullPath = path.join(wasmDir, modulePath);
        const moduleName = path.basename(path.dirname(path.dirname(path.dirname(modulePath))));
        
        try {
            // Get file size
            const stats = fs.statSync(fullPath);
            const sizeKB = stats.size / 1024;
            
            // Measure load time
            const startTime = performance.now();
            const wasmBuffer = fs.readFileSync(fullPath);
            const wasmModule = await (global as any).WebAssembly.compile(wasmBuffer);
            const loadTime = performance.now() - startTime;
            
            results.push({
                module: moduleName,
                sizeKB: Math.round(sizeKB),
                loadTimeMs: Math.round(loadTime * 100) / 100,
                status: 'success'
            });
            
            console.log(`✅ ${moduleName}: ${Math.round(sizeKB)}KB loaded in ${loadTime.toFixed(2)}ms`);
            
        } catch (error: unknown) {
            results.push({
                module: moduleName,
                sizeKB: 0,
                loadTimeMs: 0,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            console.error(`❌ ${moduleName}: Failed to load - ${error}`);
        }
    }
    
    // Summary
    console.log('\n📊 Benchmark Summary:');
    console.log('================================');
    
    const successful = results.filter(r => r.status === 'success');
    const totalSize = successful.reduce((sum, r) => sum + r.sizeKB, 0);
    const avgLoadTime = successful.reduce((sum, r) => sum + r.loadTimeMs, 0) / successful.length;
    
    console.log(`Total modules: ${results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${results.length - successful.length}`);
    console.log(`Total WASM size: ${(totalSize / 1024).toFixed(1)}MB`);
    console.log(`Average load time: ${avgLoadTime.toFixed(2)}ms`);
    
    // Performance targets
    console.log('\n🎯 Performance Targets:');
    console.log('Total size target: <7MB', totalSize / 1024 < 7 ? '✅' : '❌');
    console.log('Load time target: <100ms per module', avgLoadTime < 100 ? '✅' : '❌');
    
    // Save results
    const outputPath = path.join(__dirname, '../../docs/wasm-benchmark-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        results,
        summary: {
            totalModules: results.length,
            successful: successful.length,
            failed: results.length - successful.length,
            totalSizeMB: totalSize / 1024,
            avgLoadTimeMs: avgLoadTime
        }
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${outputPath}`);
}

// Run benchmark
benchmarkWASMModules().catch(console.error);