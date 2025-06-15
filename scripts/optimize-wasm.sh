#!/bin/bash

# WASM Optimization Script
# This script optimizes all WASM modules using wasm-opt

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
WASM_DIR="wasm-modules/core"
OPTIMIZATION_LEVEL="O3"  # O1, O2, O3, or Os (size optimization)
ENABLE_SIMD=true
ENABLE_THREADS=false
STRIP_DEBUG=true

echo -e "${GREEN}🚀 Starting WASM optimization process...${NC}"

# Check if wasm-opt is installed
if ! command -v wasm-opt &> /dev/null; then
    echo -e "${YELLOW}⚠️  wasm-opt not found. Installing binaryen...${NC}"
    
    # Install binaryen based on OS
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget https://github.com/WebAssembly/binaryen/releases/download/version_116/binaryen-version_116-x86_64-linux.tar.gz
        tar -xzf binaryen-version_116-x86_64-linux.tar.gz
        export PATH="$PWD/binaryen-version_116/bin:$PATH"
        rm binaryen-version_116-x86_64-linux.tar.gz
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install binaryen
    else
        echo -e "${RED}❌ Unsupported OS. Please install binaryen manually.${NC}"
        exit 1
    fi
fi

# Function to optimize a single WASM file
optimize_wasm() {
    local input_file=$1
    local module_name=$(basename $(dirname $(dirname $input_file)))
    local output_file="${input_file%.wasm}.optimized.wasm"
    
    echo -e "${YELLOW}📦 Optimizing ${module_name}...${NC}"
    
    # Get original size
    original_size=$(stat -f%z "$input_file" 2>/dev/null || stat -c%s "$input_file" 2>/dev/null)
    
    # Build optimization flags
    local opt_flags="-${OPTIMIZATION_LEVEL}"
    
    if [ "$ENABLE_SIMD" = true ]; then
        opt_flags="$opt_flags --enable-simd"
    fi
    
    if [ "$ENABLE_THREADS" = true ]; then
        opt_flags="$opt_flags --enable-threads"
    fi
    
    if [ "$STRIP_DEBUG" = true ]; then
        opt_flags="$opt_flags --strip-debug"
    fi
    
    # Additional optimizations
    opt_flags="$opt_flags --converge"  # Run until convergence
    opt_flags="$opt_flags --coalesce-locals"  # Coalesce local variables
    opt_flags="$opt_flags --reorder-functions"  # Reorder functions for better compression
    opt_flags="$opt_flags --merge-blocks"  # Merge blocks
    opt_flags="$opt_flags --optimize-instructions"  # Optimize individual instructions
    opt_flags="$opt_flags --vacuum"  # Remove dead code
    opt_flags="$opt_flags --dce"  # Dead code elimination
    opt_flags="$opt_flags --simplify-locals"  # Simplify local variables
    opt_flags="$opt_flags --strip-producers"  # Strip producer section
    
    # Run wasm-opt
    wasm-opt $opt_flags "$input_file" -o "$output_file"
    
    # Get optimized size
    optimized_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null)
    
    # Calculate reduction
    reduction=$(( (original_size - optimized_size) * 100 / original_size ))
    
    echo -e "  Original:  $(( original_size / 1024 ))KB"
    echo -e "  Optimized: $(( optimized_size / 1024 ))KB"
    echo -e "  Reduction: ${GREEN}${reduction}%${NC}"
    
    # Backup original and replace with optimized
    cp "$input_file" "${input_file}.backup"
    mv "$output_file" "$input_file"
    
    return $optimized_size
}

# Find all WASM files
echo -e "${YELLOW}🔍 Finding WASM modules...${NC}"
wasm_files=$(find "$WASM_DIR" -name "*.wasm" -type f | grep -v node_modules | grep -v deps | grep -v backup)

total_original_size=0
total_optimized_size=0

# Optimize each WASM file
for wasm_file in $wasm_files; do
    # Skip already optimized files
    if [[ $wasm_file == *.optimized.wasm ]]; then
        continue
    fi
    
    # Get original size for total
    original_size=$(stat -f%z "$wasm_file" 2>/dev/null || stat -c%s "$wasm_file" 2>/dev/null)
    total_original_size=$((total_original_size + original_size))
    
    # Optimize
    optimized_size=$(optimize_wasm "$wasm_file")
    total_optimized_size=$((total_optimized_size + optimized_size))
    
    echo ""
done

# Summary
echo -e "${GREEN}✅ Optimization complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Total original size:  $(( total_original_size / 1024 / 1024 ))MB"
echo -e "Total optimized size: $(( total_optimized_size / 1024 / 1024 ))MB"
echo -e "Total reduction:      $(( (total_original_size - total_optimized_size) * 100 / total_original_size ))%"

# Create size report
cat > "$WASM_DIR/optimization-report.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "optimization_level": "$OPTIMIZATION_LEVEL",
  "flags": {
    "simd": $ENABLE_SIMD,
    "threads": $ENABLE_THREADS,
    "strip_debug": $STRIP_DEBUG
  },
  "modules": [
EOF

first=true
for wasm_file in $wasm_files; do
    if [[ $wasm_file == *.optimized.wasm ]]; then
        continue
    fi
    
    module_name=$(basename $(dirname $(dirname $wasm_file)))
    size=$(stat -f%z "$wasm_file" 2>/dev/null || stat -c%s "$wasm_file" 2>/dev/null)
    
    if [ "$first" = true ]; then
        first=false
    else
        echo "," >> "$WASM_DIR/optimization-report.json"
    fi
    
    cat >> "$WASM_DIR/optimization-report.json" << EOF
    {
      "module": "$module_name",
      "path": "$wasm_file",
      "size_bytes": $size,
      "size_mb": $(echo "scale=2; $size / 1024 / 1024" | bc)
    }
EOF
done

cat >> "$WASM_DIR/optimization-report.json" << EOF

  ],
  "total_size_bytes": $total_optimized_size,
  "total_size_mb": $(echo "scale=2; $total_optimized_size / 1024 / 1024" | bc),
  "reduction_percentage": $(( (total_original_size - total_optimized_size) * 100 / total_original_size ))
}
EOF

echo -e "${GREEN}📊 Optimization report saved to: $WASM_DIR/optimization-report.json${NC}"