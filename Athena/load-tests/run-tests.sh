#!/bin/bash

# Athena Load Testing Suite Runner
# Requires k6 to be installed: https://k6.io/docs/getting-started/installation/

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
WS_URL="${WS_URL:-ws://localhost:3000}"
OUTPUT_DIR="./results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}🚀 Athena Load Testing Suite${NC}"
echo -e "${GREEN}================================${NC}"
echo "Base URL: $BASE_URL"
echo "WebSocket URL: $WS_URL"
echo "Output Directory: $OUTPUT_DIR"
echo ""

# Function to run a test
run_test() {
    local test_name=$1
    local test_file=$2
    local extra_args=$3
    
    echo -e "${YELLOW}Running $test_name...${NC}"
    
    if k6 run \
        --out json="$OUTPUT_DIR/${test_name}_${TIMESTAMP}.json" \
        --summary-export="$OUTPUT_DIR/${test_name}_${TIMESTAMP}_summary.json" \
        -e BASE_URL="$BASE_URL" \
        -e WS_URL="$WS_URL" \
        $extra_args \
        "$test_file"; then
        echo -e "${GREEN}✅ $test_name completed successfully${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# Function to generate HTML report
generate_report() {
    local test_name=$1
    local json_file="$OUTPUT_DIR/${test_name}_${TIMESTAMP}.json"
    local html_file="$OUTPUT_DIR/${test_name}_${TIMESTAMP}.html"
    
    if command -v k6-to-html &> /dev/null; then
        echo "Generating HTML report for $test_name..."
        k6-to-html "$json_file" -o "$html_file"
    else
        echo "k6-to-html not found. Install with: go install github.com/benc-uk/k6-to-html@latest"
    fi
}

# Pre-flight checks
echo -e "${YELLOW}Performing pre-flight checks...${NC}"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6 is not installed. Please install k6 first.${NC}"
    echo "Visit: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if API is accessible
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health" | grep -q "200"; then
    echo -e "${RED}❌ API is not accessible at $BASE_URL${NC}"
    echo "Please ensure the application is running."
    exit 1
fi

# Check if Redis is running (for cache tests)
if ! docker ps | grep -q "athena-redis"; then
    echo -e "${YELLOW}⚠️  Redis is not running. Cache tests may fail.${NC}"
    echo "Start Redis with: docker-compose up -d redis"
fi

echo -e "${GREEN}✅ Pre-flight checks passed${NC}"
echo ""

# Test selection menu
if [ "$1" == "" ]; then
    echo "Select tests to run:"
    echo "1) All tests"
    echo "2) Analysis endpoint load test"
    echo "3) Streaming analysis test"
    echo "4) AI failover and caching test"
    echo "5) Quick smoke test (5 minutes)"
    echo "6) Full stress test (30 minutes)"
    read -p "Enter your choice (1-6): " choice
else
    choice=$1
fi

# Execute tests based on selection
case $choice in
    1)
        echo -e "${GREEN}Running all tests...${NC}"
        run_test "analysis" "analysis.js"
        run_test "streaming" "streaming-analysis.js"
        run_test "ai_failover" "ai-failover.js"
        ;;
    2)
        run_test "analysis" "analysis.js"
        ;;
    3)
        run_test "streaming" "streaming-analysis.js"
        ;;
    4)
        run_test "ai_failover" "ai-failover.js"
        ;;
    5)
        echo -e "${GREEN}Running quick smoke test...${NC}"
        run_test "smoke" "analysis.js" "--stage '1m:10,1m:20,1m:10,1m:5,1m:0'"
        ;;
    6)
        echo -e "${GREEN}Running full stress test...${NC}"
        run_test "stress" "analysis.js" "--stage '5m:50,10m:200,10m:500,5m:100'"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Generate reports
echo ""
echo -e "${YELLOW}Generating reports...${NC}"

# Summary report
echo -e "${GREEN}Test Summary - $TIMESTAMP${NC}" > "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
echo "================================" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"

for summary in "$OUTPUT_DIR"/*_${TIMESTAMP}_summary.json; do
    if [ -f "$summary" ]; then
        test_name=$(basename "$summary" | cut -d'_' -f1)
        echo "" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
        echo "Test: $test_name" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
        echo "----------------" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
        
        # Extract key metrics using jq if available
        if command -v jq &> /dev/null; then
            jq -r '
                "Requests: \(.metrics.http_reqs.count // 0)",
                "Request Rate: \(.metrics.http_reqs.rate // 0) req/s",
                "Success Rate: \((1 - (.metrics.http_req_failed.rate // 0)) * 100)%",
                "Avg Duration: \(.metrics.http_req_duration.med // 0)ms",
                "P95 Duration: \(.metrics.http_req_duration["p(95)"] // 0)ms",
                "P99 Duration: \(.metrics.http_req_duration["p(99)"] // 0)ms"
            ' "$summary" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
        else
            cat "$summary" >> "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ Load testing completed!${NC}"
echo -e "Results saved to: ${YELLOW}$OUTPUT_DIR${NC}"
echo ""
echo "View summary: cat $OUTPUT_DIR/summary_${TIMESTAMP}.txt"

# Open summary if on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$OUTPUT_DIR/summary_${TIMESTAMP}.txt"
fi