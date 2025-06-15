#!/bin/bash

# Fix window references in WASM bridge files
echo "Fixing window references in WASM bridge files..."

# List of files to fix
files=(
  "/workspaces/Athena/wasm-modules/bridge/analysis-engine-bridge-enhanced.ts"
  "/workspaces/Athena/wasm-modules/bridge/analysis-engine-bridge.ts"
  "/workspaces/Athena/wasm-modules/bridge/crypto-bridge.ts"
  "/workspaces/Athena/wasm-modules/bridge/deobfuscator-bridge.ts"
  "/workspaces/Athena/wasm-modules/bridge/network-bridge.ts"
  "/workspaces/Athena/wasm-modules/bridge/pattern-matcher-bridge.ts"
  "/workspaces/Athena/wasm-modules/bridge/sandbox-bridge.ts"
)

for file in "${files[@]}"; do
  echo "Processing $file..."
  
  # Check if file already imports from wasm-error-codes
  if ! grep -q "from './wasm-error-codes'" "$file"; then
    # Add import after the first import from './types'
    sed -i "/from '\.\/types';/a import { isBrowser } from './wasm-error-codes';" "$file"
  fi
  
  # Replace typeof window !== 'undefined' with isBrowser
  sed -i "s/typeof window !== 'undefined'/isBrowser/g" "$file"
done

echo "Fixed window references in ${#files[@]} files"