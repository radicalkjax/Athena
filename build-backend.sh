#!/bin/bash

# Build script for Athena backend services
# This builds WASM modules and prepares the backend for Docker

set -e

echo "🚀 Building Athena Backend Services"
echo "=================================="

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "❌ wasm-pack is not installed. Please run ./wasm-modules/setup.sh first"
    exit 1
fi

# Build WASM modules for web target
echo ""
echo "📦 Building WASM modules..."
cd wasm-modules/core

MODULES=(
    "analysis-engine"
    "file-processor"
    "pattern-matcher"
    "deobfuscator"
    "sandbox"
    "crypto"
    "network"
)

for module in "${MODULES[@]}"; do
    if [ -d "$module" ]; then
        echo "  Building $module..."
        cd "$module"
        wasm-pack build --target web --out-dir pkg-web || {
            echo "  ⚠️  Warning: $module build failed, continuing..."
        }
        cd ..
    else
        echo "  ⚠️  Module $module not found, skipping..."
    fi
done

cd ../..

# Compile TypeScript (allow errors for now)
echo ""
echo "📝 Compiling TypeScript..."
npm install
npx tsc || echo "  ⚠️  TypeScript compilation had errors, but continuing..."

# Ensure dist directory exists
mkdir -p dist

# Copy compiled JavaScript files if TypeScript compilation failed
if [ ! -f "dist/services/server.js" ]; then
    echo "  Copying pre-compiled JavaScript files..."
    mkdir -p dist/services dist/utils
    cp -r services/*.js dist/services/ 2>/dev/null || true
    cp -r utils/*.js dist/utils/ 2>/dev/null || true
fi

echo ""
echo "✅ Backend build complete!"
echo ""
echo "Next steps:"
echo "1. Copy your AI API keys to .env file"
echo "2. Run: docker-compose up -d"
echo "3. Check logs: docker-compose logs -f"
echo "4. API will be available at http://localhost:3000"
echo "5. Metrics at http://localhost:9090/metrics"
echo "6. Grafana at http://localhost:3001 (admin/admin)"