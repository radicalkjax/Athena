#!/bin/bash

# Athena Full Load Test Runner
# This script runs comprehensive load tests against the Athena API

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-test-api-key}"
OUTPUT_DIR="./test-results/$(date +%Y%m%d_%H%M%S)"

echo -e "${GREEN}🚀 Athena Load Test Runner${NC}"
echo "================================"
echo "Base URL: $BASE_URL"
echo "Output Directory: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6 is not installed. Please install k6 first.${NC}"
    echo "Visit: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if server is running
echo -e "${YELLOW}🔍 Checking server health...${NC}"
if ! curl -s "$BASE_URL/api/v1/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not responding at $BASE_URL${NC}"
    echo "Please ensure the server is running."
    exit 1
fi
echo -e "${GREEN}✅ Server is healthy${NC}"

# Run simple load test first
echo ""
echo -e "${YELLOW}📊 Running simple load test...${NC}"
k6 run \
    -e BASE_URL="$BASE_URL" \
    ./tests/load/simple-load-test.js \
    --out json="$OUTPUT_DIR/simple-test-results.json" \
    --summary-export="$OUTPUT_DIR/simple-test-summary.json" \
    2>&1 | tee "$OUTPUT_DIR/simple-test.log"

# Check if simple test passed
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Simple load test completed${NC}"
else
    echo -e "${RED}❌ Simple load test failed${NC}"
    exit 1
fi

# Run full API load test
echo ""
echo -e "${YELLOW}🔥 Running full API load test...${NC}"
echo "This will take approximately 25 minutes to complete."
echo ""

k6 run \
    -e BASE_URL="$BASE_URL" \
    -e API_KEY="$API_KEY" \
    ./tests/load/full-api-load-test.js \
    --out json="$OUTPUT_DIR/full-test-results.json" \
    --summary-export="$OUTPUT_DIR/full-test-summary.json" \
    2>&1 | tee "$OUTPUT_DIR/full-test.log"

# Check if full test passed
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Full load test completed${NC}"
else
    echo -e "${YELLOW}⚠️  Full load test completed with warnings${NC}"
fi

# Generate summary report
echo ""
echo -e "${YELLOW}📝 Generating summary report...${NC}"

cat > "$OUTPUT_DIR/test-summary.md" << EOF
# Athena Load Test Summary

**Date**: $(date)
**Base URL**: $BASE_URL

## Test Results

### Simple Load Test
- Log: simple-test.log
- Results: simple-test-results.json
- Summary: simple-test-summary.json

### Full API Load Test
- Log: full-test.log
- Results: full-test-results.json
- Summary: full-test-summary.json
- HTML Report: full-load-test-results.html

## Key Metrics

\`\`\`
$(grep -E "(Total Requests|Average RPS|Error Rate|Cache Hit Rate|P95)" "$OUTPUT_DIR/full-test.log" | tail -20)
\`\`\`

## Performance Targets

\`\`\`
$(grep -E "(✅|❌)" "$OUTPUT_DIR/full-test.log" | tail -10)
\`\`\`

EOF

echo -e "${GREEN}✅ Summary report generated${NC}"
echo ""
echo "📁 All test results saved to: $OUTPUT_DIR"
echo ""

# Display final summary
echo "================================"
echo -e "${GREEN}🎉 Load Testing Complete!${NC}"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Review the HTML report: $OUTPUT_DIR/full-load-test-results.html"
echo "2. Analyze detailed metrics: $OUTPUT_DIR/full-test-summary.json"
echo "3. Check logs for any errors: $OUTPUT_DIR/*.log"
echo ""

# Check if we met all targets
if grep -q "❌" "$OUTPUT_DIR/full-test.log"; then
    echo -e "${YELLOW}⚠️  Some performance targets were not met. Please review the results.${NC}"
    exit 1
else
    echo -e "${GREEN}✅ All performance targets met!${NC}"
    exit 0
fi