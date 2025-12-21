#!/bin/bash

set -e

echo "🔨 Building Athena Analysis Engine WASM module..."

# Build for web target
echo "📦 Building for web..."
wasm-pack build --target web --out-dir pkg-web

# Build for Node.js (React Native)
echo "📦 Building for Node.js..."
wasm-pack build --target nodejs --out-dir pkg-node

# Optimize the WASM files
if command -v wasm-opt &> /dev/null; then
    echo "🚀 Optimizing WASM files..."
    wasm-opt -O3 -o pkg-web/athena_analysis_engine_bg_optimized.wasm pkg-web/athena_analysis_engine_bg.wasm
    wasm-opt -O3 -o pkg-node/athena_analysis_engine_bg_optimized.wasm pkg-node/athena_analysis_engine_bg.wasm
    
    # Replace original with optimized
    mv pkg-web/athena_analysis_engine_bg_optimized.wasm pkg-web/athena_analysis_engine_bg.wasm
    mv pkg-node/athena_analysis_engine_bg_optimized.wasm pkg-node/athena_analysis_engine_bg.wasm
else
    echo "⚠️  wasm-opt not found, skipping optimization"
fi

echo "✅ Build complete!"
echo ""
echo "Output:"
echo "  - Web: pkg-web/"
echo "  - Node.js: pkg-node/"