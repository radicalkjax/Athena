#!/bin/bash

# Fix isBrowser not found errors
echo "Fixing isBrowser references..."

# Add isBrowser check at the top of files that need it
files=(
  "wasm-modules/bridge/analysis-engine-bridge.ts"
  "wasm-modules/bridge/crypto-bridge.ts"
  "wasm-modules/bridge/deobfuscator-bridge.ts"
  "wasm-modules/bridge/network-bridge.ts"
  "wasm-modules/bridge/pattern-matcher-bridge.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Check if isBrowser is already defined
    if ! grep -q "const isBrowser" "$file"; then
      # Add isBrowser definition after imports
      sed -i '/^import/,/^$/s/^$/\nconst isBrowser = typeof window !== "undefined";\n/' "$file"
      echo "Added isBrowser to $file"
    fi
  fi
done

echo "TypeScript error fixes applied!"