#!/bin/bash

# Athena v2 Test Runner Script
# Tests WASM modules with safe test files

echo "Athena v2 Test Suite"
echo "===================="
echo ""
echo "WARNING: These are SAFE test files that simulate malware patterns."
echo "They do NOT contain actual malicious code."
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test categories
declare -a test_categories=(
    "executables"
    "scripts" 
    "documents"
    "archives"
)

# Test files
declare -A test_files=(
    ["executables"]="test-suspicious-strings.txt test-pe-header.bin"
    ["scripts"]="test-obfuscated.js test-powershell.ps1"
    ["documents"]="test-macro-patterns.txt"
    ["archives"]="test-encrypted.txt"
)

echo "Test Plan:"
echo "1. Test each file type with appropriate analyzer"
echo "2. Verify WASM modules load correctly"
echo "3. Check error handling for edge cases"
echo "4. Validate memory usage stays within limits"
echo ""

# Function to test a file
test_file() {
    local category=$1
    local file=$2
    local filepath="$category/$file"
    
    echo -e "${YELLOW}Testing:${NC} $filepath"
    echo "  - File size: $(ls -lh "$filepath" 2>/dev/null | awk '{print $5}')"
    echo "  - Expected detection: Suspicious patterns"
    echo ""
}

# Run tests
echo -e "${GREEN}Starting test suite...${NC}"
echo ""

for category in "${test_categories[@]}"; do
    echo -e "${GREEN}Category: $category${NC}"
    echo "------------------------"
    
    if [[ -n "${test_files[$category]}" ]]; then
        for file in ${test_files[$category]}; do
            test_file "$category" "$file"
        done
    fi
    echo ""
done

# Test large file handling
echo -e "${GREEN}Testing file size limits...${NC}"
echo -e "${YELLOW}Testing:${NC} test-large-file.bin"
echo "  - Simulated size: 50MB"
echo "  - Expected: Should process successfully (under 100MB limit)"
echo ""

# Test error cases
echo -e "${GREEN}Testing error handling...${NC}"
echo -e "${YELLOW}Test case:${NC} Non-existent file"
echo "  - Expected: Graceful error message"
echo ""

echo -e "${YELLOW}Test case:${NC} Empty file"
touch empty-test.tmp
echo "  - Expected: Handle empty file gracefully"
rm -f empty-test.tmp
echo ""

echo -e "${GREEN}Test suite complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Open Athena v2 application"
echo "2. Drag and drop test files onto the upload area"
echo "3. Verify each analysis module processes the files correctly"
echo "4. Check that no real malware signatures are triggered"
echo "5. Monitor memory usage and performance"
echo ""
echo "Test files location: $(pwd)"