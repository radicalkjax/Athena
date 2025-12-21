#!/bin/bash

# Athena v2 - Test Runner Script
# This script helps you run the Vitest test suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Athena v2 - Test Runner${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found!${NC}"
    echo "Please run this script from the athena-v2 directory."
    exit 1
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Dependencies not installed. Installing...${NC}"
    npm install
    echo ""
fi

# Parse command line arguments
MODE="${1:-run}"

case "$MODE" in
    "install")
        echo -e "${GREEN}Installing test dependencies...${NC}"
        npm install
        echo -e "${GREEN}Dependencies installed successfully!${NC}"
        ;;

    "run")
        echo -e "${GREEN}Running tests...${NC}"
        npm test
        ;;

    "watch")
        echo -e "${GREEN}Running tests in watch mode...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to exit${NC}"
        npm run test:watch
        ;;

    "coverage")
        echo -e "${GREEN}Running tests with coverage...${NC}"
        npm run test:coverage

        if [ -f "coverage/index.html" ]; then
            echo ""
            echo -e "${GREEN}Coverage report generated!${NC}"
            echo -e "Open ${YELLOW}coverage/index.html${NC} in your browser to view the report."

            # Try to open the report automatically
            if command -v open &> /dev/null; then
                echo -e "${GREEN}Opening coverage report...${NC}"
                open coverage/index.html
            elif command -v xdg-open &> /dev/null; then
                echo -e "${GREEN}Opening coverage report...${NC}"
                xdg-open coverage/index.html
            fi
        fi
        ;;

    "count")
        echo -e "${GREEN}Counting test cases...${NC}"
        echo ""

        # Count tests in each file
        for file in src/services/__tests__/*.test.ts src/components/solid/analysis/__tests__/*.test.tsx; do
            if [ -f "$file" ]; then
                count=$(grep -c "^\s*it(" "$file" || echo "0")
                echo -e "${YELLOW}$(basename $file):${NC} $count tests"
            fi
        done

        echo ""
        total=$(find src -name "*.test.ts" -o -name "*.test.tsx" | xargs grep -c "^\s*it(" | awk -F: '{sum+=$2} END {print sum}')
        echo -e "${GREEN}Total test cases: $total${NC}"
        ;;

    "help")
        echo "Usage: ./run-tests.sh [command]"
        echo ""
        echo "Commands:"
        echo "  install   - Install test dependencies"
        echo "  run       - Run tests once (default)"
        echo "  watch     - Run tests in watch mode"
        echo "  coverage  - Run tests with coverage report"
        echo "  count     - Count total test cases"
        echo "  help      - Show this help message"
        echo ""
        echo "Examples:"
        echo "  ./run-tests.sh              # Run tests once"
        echo "  ./run-tests.sh watch        # Watch mode for development"
        echo "  ./run-tests.sh coverage     # Generate coverage report"
        ;;

    *)
        echo -e "${RED}Unknown command: $MODE${NC}"
        echo "Run './run-tests.sh help' for usage information."
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
