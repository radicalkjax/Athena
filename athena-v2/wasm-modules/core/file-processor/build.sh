#!/bin/bash

# Build script for file-processor WASM module

set -e

echo "🔨 Building file-processor WASM module..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo -e "${RED}Error: wasm-pack is not installed${NC}"
    echo "Please install it with: curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh"
    exit 1
fi

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf pkg-web pkg-node

# Run tests first
echo -e "${YELLOW}Running tests...${NC}"
cargo test

# Build for web
echo -e "${YELLOW}Building for web target...${NC}"
wasm-pack build --target web --out-dir pkg-web --release

# Build for Node.js
echo -e "${YELLOW}Building for Node.js target...${NC}"
wasm-pack build --target nodejs --out-dir pkg-node --release

# Create a unified package.json
echo -e "${YELLOW}Creating unified package configuration...${NC}"
cat > pkg-web/package.json << EOF
{
  "name": "@athena/file-processor-wasm",
  "version": "0.1.0",
  "description": "WASM file processor for Athena security platform",
  "main": "file_processor.js",
  "types": "file_processor.d.ts",
  "files": [
    "file_processor_bg.wasm",
    "file_processor.js",
    "file_processor.d.ts",
    "file_processor_bg.js",
    "file_processor_bg.wasm.d.ts"
  ],
  "module": "file_processor.js",
  "sideEffects": false,
  "keywords": ["wasm", "file", "parser", "security", "athena"],
  "license": "MIT"
}
EOF

echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "Web build:    ./pkg-web/"
echo "Node build:   ./pkg-node/"
echo ""
echo "To use in TypeScript:"
echo "  import { FileProcessor } from './pkg-web/file_processor';"