#!/bin/bash

# Build script for all WASM modules
set -e

echo "Building WASM modules..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Create output directory
mkdir -p ../public/wasm

# List of modules to build
MODULES=("analysis-engine" "crypto" "deobfuscator" "file-processor" "pattern-matcher" "network" "sandbox")

# Function to build a module
build_module() {
    local module=$1
    echo -e "${GREEN}Building $module...${NC}"
    
    if [ -d "$module" ] && [ -f "$module/Cargo.toml" ]; then
        cd "$module"
        
        # Build the module
        wasm-pack build --target web --out-dir ../../public/wasm/$module --no-typescript
        
        # Go back to wasm-modules directory
        cd ..
        
        echo -e "${GREEN}✓ $module built successfully${NC}"
    else
        echo -e "${RED}✗ $module directory not found or missing Cargo.toml${NC}"
    fi
}

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo -e "${RED}wasm-pack is not installed. Installing...${NC}"
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build each module
for module in "${MODULES[@]}"; do
    build_module "$module"
done

echo -e "${GREEN}All WASM modules built successfully!${NC}"

# List the generated files
echo -e "\nGenerated WASM files:"
find ../public/wasm -name "*.wasm" -type f | while read -r file; do
    size=$(du -h "$file" | cut -f1)
    echo "  - $file ($size)"
done