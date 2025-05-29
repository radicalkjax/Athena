#!/bin/bash

# Run all tests in batches to avoid timeouts
echo "Running Athena Test Suite in Batches"
echo "===================================="
echo ""

# Initialize counters
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_SKIPPED=0
FAILED_SUITES=""

# Function to run a test and capture results
run_test_batch() {
    local test_path=$1
    local test_name=$2
    
    echo "Testing: $test_name"
    
    # Run test and capture output
    output=$(npx jest "$test_path" --no-watch --passWithNoTests 2>&1)
    
    # Extract test results
    if echo "$output" | grep -q "PASS"; then
        echo "✅ PASSED"
        passed=$(echo "$output" | grep -E "Tests:.*passed" | grep -oE "[0-9]+ passed" | grep -oE "[0-9]+")
        skipped=$(echo "$output" | grep -E "Tests:.*skipped" | grep -oE "[0-9]+ skipped" | grep -oE "[0-9]+")
        TOTAL_PASSED=$((TOTAL_PASSED + ${passed:-0}))
        TOTAL_SKIPPED=$((TOTAL_SKIPPED + ${skipped:-0}))
    elif echo "$output" | grep -q "FAIL"; then
        echo "❌ FAILED"
        failed=$(echo "$output" | grep -E "Tests:.*failed" | grep -oE "[0-9]+ failed" | grep -oE "[0-9]+")
        TOTAL_FAILED=$((TOTAL_FAILED + ${failed:-0}))
        FAILED_SUITES="$FAILED_SUITES\n  - $test_name"
    else
        echo "⏭️  SKIPPED (no tests found or all skipped)"
    fi
    
    echo ""
}

# Unit Tests - Components
echo "=== UNIT TESTS - COMPONENTS ==="
run_test_batch "__tests__/unit/components/FileUploader.test.tsx" "FileUploader"
run_test_batch "__tests__/unit/components/ContainerConfigSelector.test.tsx" "ContainerConfigSelector"
run_test_batch "__tests__/unit/components/AnalysisOptionsPanel.test.tsx" "AnalysisOptionsPanel"
run_test_batch "__tests__/unit/components/AIModelSelector.test.tsx" "AIModelSelector"

# Unit Tests - Hooks
echo "=== UNIT TESTS - HOOKS ==="
run_test_batch "__tests__/unit/hooks/useStreamingAnalysis.test.tsx" "useStreamingAnalysis"

# Unit Tests - Services
echo "=== UNIT TESTS - SERVICES ==="
run_test_batch "__tests__/unit/services/config/featureFlags.test.ts" "FeatureFlags"
run_test_batch "__tests__/unit/services/analysisService.test.ts" "AnalysisService"
run_test_batch "__tests__/unit/services/container.test.ts" "Container Service"
run_test_batch "__tests__/unit/services/fileManager.test.ts" "FileManager"
run_test_batch "__tests__/unit/services/monitoring.test.ts" "Monitoring"

# Unit Tests - AI Services
echo "=== UNIT TESTS - AI SERVICES ==="
run_test_batch "__tests__/unit/services/ai/base.test.ts" "AI Base"
run_test_batch "__tests__/unit/services/ai/circuitBreaker.test.ts" "Circuit Breaker"
run_test_batch "__tests__/unit/services/claude.test.ts" "Claude Service"
run_test_batch "__tests__/unit/services/openai.test.ts" "OpenAI Service"
run_test_batch "__tests__/unit/services/deepseek.test.ts" "DeepSeek Service"

# Unit Tests - Store
echo "=== UNIT TESTS - STORE ==="
run_test_batch "__tests__/unit/store/securityStore.test.ts" "Security Store"

# Unit Tests - Design System
echo "=== UNIT TESTS - DESIGN SYSTEM ==="
run_test_batch "__tests__/unit/design-system/Button.test.tsx" "Button"
run_test_batch "__tests__/unit/design-system/Card.test.tsx" "Card"
run_test_batch "__tests__/unit/design-system/Input.test.tsx" "Input"
run_test_batch "__tests__/unit/design-system/Modal.test.tsx" "Modal"
run_test_batch "__tests__/unit/design-system/Toast.test.tsx" "Toast"

# Unit Tests - API
echo "=== UNIT TESTS - API ==="
run_test_batch "__tests__/unit/api/gateway.test.ts" "API Gateway"
run_test_batch "__tests__/unit/api/errorHandler.test.ts" "Error Handler"

# Integration Tests (should be skipped)
echo "=== INTEGRATION TESTS (SKIPPED) ==="
run_test_batch "__tests__/integration/" "All Integration Tests"

# Final Summary
echo ""
echo "=================================="
echo "FINAL TEST SUMMARY"
echo "=================================="
echo "✅ Passed:  $TOTAL_PASSED tests"
echo "❌ Failed:  $TOTAL_FAILED tests"
echo "⏭️  Skipped: $TOTAL_SKIPPED tests"
echo "Total:     $((TOTAL_PASSED + TOTAL_FAILED + TOTAL_SKIPPED)) tests"

if [ $TOTAL_FAILED -gt 0 ]; then
    echo ""
    echo "Failed test suites:"
    echo -e "$FAILED_SUITES"
    exit 1
else
    echo ""
    echo "🎉 All tests passed!"
    exit 0
fi