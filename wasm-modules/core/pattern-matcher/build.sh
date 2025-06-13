#!/bin/bash

# Build script for pattern-matcher WASM module

set -e

echo "🔨 Building pattern-matcher WASM module..."

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
  "name": "@athena/pattern-matcher-wasm",
  "version": "0.1.0",
  "description": "WASM pattern matcher for Athena security platform",
  "main": "pattern_matcher.js",
  "types": "pattern_matcher.d.ts",
  "files": [
    "pattern_matcher_bg.wasm",
    "pattern_matcher.js",
    "pattern_matcher.d.ts",
    "pattern_matcher_bg.js",
    "pattern_matcher_bg.wasm.d.ts"
  ],
  "module": "pattern_matcher.js",
  "sideEffects": false,
  "keywords": ["wasm", "pattern", "matching", "security", "athena", "malware"],
  "license": "MIT"
}
EOF

echo -e "${GREEN}✅ Build complete!${NC}"
echo ""
echo "Web build:    ./pkg-web/"
echo "Node build:   ./pkg-node/"
echo ""
echo "To use in TypeScript:"
echo "  import { PatternMatcher } from './pkg-web/pattern_matcher';"