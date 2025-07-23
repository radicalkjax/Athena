#!/bin/bash

set -e

echo "Building WASM modules for Node.js..."

# Array of all WASM modules
modules=(
    "analysis-engine"
    "crypto"
    "deobfuscator"
    "file-processor"
    "pattern-matcher"
    "network"
    "sandbox"
)

# Build each module
for module in "${modules[@]}"; do
    echo ""
    echo "🔨 Building $module..."
    
    cd "core/$module"
    
    # Build for Node.js target (disable wasm-opt due to bulk memory operations)
    wasm-pack build --target nodejs --out-dir pkg-node --no-opt
    
    # Optimize if wasm-opt is available
    if command -v wasm-opt &> /dev/null; then
        wasm-opt -O3 --enable-bulk-memory -o "pkg-node/${module//-/_}_bg_optimized.wasm" "pkg-node/${module//-/_}_bg.wasm" || echo "⚠️  wasm-opt failed, using unoptimized version"
        # Only replace if optimization succeeded
        if [ -f "pkg-node/${module//-/_}_bg_optimized.wasm" ]; then
            mv "pkg-node/${module//-/_}_bg_optimized.wasm" "pkg-node/${module//-/_}_bg.wasm"
        fi
    fi
    
    echo "✅ $module built successfully"
    
    cd ../..
done

echo ""
echo "🎉 All Node.js WASM packages built successfully!"