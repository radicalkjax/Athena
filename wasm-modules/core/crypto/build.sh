#!/bin/bash

echo "Building WASM Crypto Module..."

# Clean previous builds
rm -rf pkg

# Build for web target
wasm-pack build --target web --out-dir pkg/web

# Build for Node.js target
wasm-pack build --target nodejs --out-dir pkg/node

# Generate TypeScript definitions
echo "Build complete! Output in pkg/"
ls -la pkg/