#!/bin/bash
# Verification script for memory analysis implementation

echo "=== Memory Analysis Implementation Verification ==="
echo ""

# Check if files exist
echo "Checking files..."
FILES=(
    "athena-v2/src-tauri/src/commands/memory_analysis.rs"
    "athena-v2/src-tauri/src/commands/mod.rs"
    "athena-v2/src-tauri/src/main.rs"
    "athena-v2/src-tauri/tests/memory_analysis_integration_test.rs"
    "athena-v2/src/types/memoryAnalysis.ts"
    "athena-v2/src-tauri/docs/MEMORY_ANALYSIS_COMMANDS.md"
    "MEMORY_ANALYSIS_IMPLEMENTATION.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ MISSING: $file"
    fi
done

echo ""
echo "Checking module registration..."
if grep -q "pub mod memory_analysis;" athena-v2/src-tauri/src/commands/mod.rs; then
    echo "✅ Module registered in mod.rs"
else
    echo "❌ Module NOT registered in mod.rs"
fi

echo ""
echo "Checking command registration..."
if grep -q "commands::memory_analysis::get_memory_regions" athena-v2/src-tauri/src/main.rs; then
    echo "✅ get_memory_regions registered"
else
    echo "❌ get_memory_regions NOT registered"
fi

if grep -q "commands::memory_analysis::extract_strings_from_dump" athena-v2/src-tauri/src/main.rs; then
    echo "✅ extract_strings_from_dump registered"
else
    echo "❌ extract_strings_from_dump NOT registered"
fi

echo ""
echo "Code statistics..."
echo "Lines in memory_analysis.rs: $(wc -l < athena-v2/src-tauri/src/commands/memory_analysis.rs)"
echo "Lines in integration tests: $(wc -l < athena-v2/src-tauri/tests/memory_analysis_integration_test.rs)"
echo "Lines in TypeScript types: $(wc -l < athena-v2/src/types/memoryAnalysis.ts)"

echo ""
echo "Function count..."
echo "Tauri commands: $(grep -c "#\[tauri::command\]" athena-v2/src-tauri/src/commands/memory_analysis.rs)"
echo "Helper functions: $(grep -c "^fn " athena-v2/src-tauri/src/commands/memory_analysis.rs)"
echo "Test functions: $(grep -c "#\[tokio::test\]" athena-v2/src-tauri/tests/memory_analysis_integration_test.rs)"

echo ""
echo "Documentation..."
DOCS_SIZE=$(wc -c < athena-v2/src-tauri/docs/MEMORY_ANALYSIS_COMMANDS.md)
echo "Documentation size: $DOCS_SIZE bytes"

echo ""
echo "=== Verification Complete ==="
echo ""
echo "To compile and test:"
echo "  cd athena-v2/src-tauri"
echo "  cargo check  # Check compilation"
echo "  cargo test memory_analysis  # Run tests (once other errors fixed)"
echo ""
echo "To use from frontend:"
echo "  import { invoke } from '@tauri-apps/api/core';"
echo "  const regions = await invoke('get_memory_regions', { filePath: '...' });"
echo "  const strings = await invoke('extract_strings_from_dump', { filePath: '...', minLength: 4, encoding: 'both' });"
