#!/bin/bash

echo "Running test summary for Athena project..."
echo "=========================================="

# Count test files
echo "Total test files:"
find __tests__ -name "*.test.*" -type f | wc -l

echo ""
echo "Unit test files:"
find __tests__/unit -name "*.test.*" -type f | wc -l

echo ""
echo "Integration test files:"
find __tests__/integration -name "*.test.*" -type f | wc -l

echo ""
echo "Files containing 'describe.skip':"
grep -l "describe\.skip" __tests__/**/*.test.* 2>/dev/null || echo "None found"

echo ""
echo "Originally failing tests that are now fixed:"
echo "- __tests__/unit/components/FileUploader.test.tsx"
echo "- __tests__/unit/hooks/useStreamingAnalysis.test.tsx"
echo "- __tests__/unit/services/config/featureFlags.test.ts"
echo ""
echo "Additional test fixed:"
echo "- __tests__/unit/components/ContainerConfigSelector.test.tsx"

echo ""
echo "Key changes made:"
echo "1. Changed ContainerConfigSelector and ContainerMonitoring from default to named exports"
echo "2. Created proper mocks for @/design-system components"
echo "3. Fixed test data structures to match component expectations"
echo "4. Added proper timer cleanup with jest.useFakeTimers() and jest.useRealTimers()"
echo "5. Fixed service function names to match actual exports"
echo "6. Updated prop names to match component interfaces"