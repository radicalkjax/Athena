#!/bin/bash

# Create performance directory if it doesn't exist
mkdir -p wasm-modules/performance

# Compile TypeScript
echo "Compiling TypeScript..."
npx tsc wasm-modules/performance/benchmark.ts --outDir dist/performance --module commonjs --target es2015 --lib es2015,es2017 --esModuleInterop --skipLibCheck --allowJs

# Run the benchmark
echo "Running WASM performance benchmark..."
node dist/performance/benchmark.js