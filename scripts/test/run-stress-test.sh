#!/bin/bash

# Athena Stress Test Runner - 1000+ RPS Target
# This script runs high-load stress tests including failover scenarios

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BASE_URL="${BASE_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-test-api-key}"
OUTPUT_DIR="./test-results/stress-$(date +%Y%m%d_%H%M%S)"

echo -e "${BLUE}🚀 Athena Stress Test Runner${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Target: 1000+ requests per second"
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

# Pre-stress system check
echo ""
echo -e "${YELLOW}📊 Pre-stress system metrics...${NC}"
echo "Capturing baseline metrics..."

# If running in Kubernetes, get pod status
if command -v kubectl &> /dev/null; then
    echo "Kubernetes pod status:"
    kubectl get pods -n athena 2>/dev/null || echo "Not running in Kubernetes"
    echo ""
fi

# Warm up the system
echo -e "${YELLOW}🔥 Warming up the system...${NC}"
k6 run \
    -e BASE_URL="$BASE_URL" \
    -e API_KEY="$API_KEY" \
    --vus 10 \
    --duration 30s \
    ./tests/load/simple-load-test.js \
    --quiet \
    2>&1 | tee "$OUTPUT_DIR/warmup.log"

echo -e "${GREEN}✅ Warmup complete${NC}"
echo ""

# Run the stress test
echo -e "${RED}💪 Starting STRESS TEST - 1000+ RPS${NC}"
echo "This test will:"
echo "  1. Ramp up to 1500 RPS over 10 minutes"
echo "  2. Test failover scenarios"
echo "  3. Send burst traffic up to 2500 RPS"
echo ""
echo "Total duration: ~15 minutes"
echo ""
echo -e "${YELLOW}Press Ctrl+C to abort${NC}"
sleep 3

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Run stress test with detailed output
k6 run \
    -e BASE_URL="$BASE_URL" \
    -e API_KEY="$API_KEY" \
    ./tests/load/stress-test-1000rps.js \
    --out json="$OUTPUT_DIR/stress-test-metrics.json" \
    --summary-export="$OUTPUT_DIR/stress-test-summary.json" \
    2>&1 | tee "$OUTPUT_DIR/stress-test.log"

# Check if stress test completed
STRESS_TEST_EXIT_CODE=$?
if [ $STRESS_TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Stress test completed successfully${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Stress test completed with exit code: $STRESS_TEST_EXIT_CODE${NC}"
fi

# Post-stress analysis
echo ""
echo -e "${YELLOW}📈 Analyzing results...${NC}"

# Extract key metrics from log
ACTUAL_RPS=$(grep "Actual RPS:" "$OUTPUT_DIR/stress-test.log" | tail -1 | awk '{print $3}')
ERROR_RATE=$(grep "Error Rate:" "$OUTPUT_DIR/stress-test.log" | tail -1 | awk '{print $3}')
P95_LATENCY=$(grep "P95 Latency:" "$OUTPUT_DIR/stress-test.log" | tail -1 | awk '{print $3}')

# Generate summary report
cat > "$OUTPUT_DIR/stress-test-summary.md" << EOF
# Athena Stress Test Summary Report

**Date**: $(date)
**Base URL**: $BASE_URL
**Test Type**: High-Load Stress Test (1000+ RPS)

## Executive Summary

The Athena platform was subjected to extreme load conditions to validate its ability to handle 1000+ requests per second.

### Key Results
- **Actual RPS Achieved**: $ACTUAL_RPS
- **Error Rate**: $ERROR_RATE
- **P95 Latency**: $P95_LATENCY

## Test Scenarios Executed

### 1. Gradual Load Increase (10 minutes)
- Started at 50 RPS
- Ramped to 1500 RPS
- Sustained peak load for 3 minutes

### 2. Failover Testing (2 minutes)
- Simulated pod failures
- Tested service availability during disruption
- Verified auto-recovery mechanisms

### 3. Burst Traffic (5 minutes)
- Sudden spikes up to 2500 RPS
- Multiple burst cycles
- Tested auto-scaling response

## Performance Targets

\`\`\`
$(grep -E "(✅|❌)" "$OUTPUT_DIR/stress-test.log" | grep -E "(1000\+ RPS|P95 latency|Error rate)" | tail -3)
\`\`\`

## Files Generated
- Full log: stress-test.log
- Metrics data: stress-test-metrics.json
- Summary data: stress-test-summary.json
- HTML report: stress-test-results.html

## Recommendations

$(
if [[ $(echo "$ACTUAL_RPS >= 1000" | bc -l) -eq 1 ]]; then
    echo "✅ System successfully handles 1000+ RPS. Ready for production scale."
else
    echo "⚠️  System peaked at $ACTUAL_RPS RPS. Consider:"
    echo "   - Increasing replica count"
    echo "   - Optimizing slow endpoints"
    echo "   - Adding more cache layers"
fi
)

EOF

echo -e "${GREEN}✅ Summary report generated${NC}"

# Display results summary
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 STRESS TEST COMPLETE!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📊 Quick Results:"
echo "   - RPS Achieved: $ACTUAL_RPS"
echo "   - Error Rate: $ERROR_RATE"
echo "   - P95 Latency: $P95_LATENCY"
echo ""
echo "📁 Full results saved to: $OUTPUT_DIR"
echo ""
echo "📋 View detailed reports:"
echo "   - HTML Report: $OUTPUT_DIR/stress-test-results.html"
echo "   - Summary: $OUTPUT_DIR/stress-test-summary.md"
echo "   - Raw data: $OUTPUT_DIR/stress-test-metrics.json"
echo ""

# Final status
if [[ $(echo "$ACTUAL_RPS >= 1000" | bc -l) -eq 1 ]] && [ $STRESS_TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Athena is ready for high-scale production workloads!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Review the results and consider optimizations before production deployment.${NC}"
    exit 1
fi