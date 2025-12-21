#!/bin/bash

# Run Integration Tests for WASM Modules

echo "🧪 Running WASM Module Integration Tests..."
echo "========================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to wasm-modules directory
cd "$(dirname "$0")/.." || exit 1

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing test dependencies...${NC}"
    npm install
fi

# Run different test suites
echo -e "\n${GREEN}1. Running Analysis Engine Tests${NC}"
npm test -- tests/integration/analysis-engine.test.ts --verbose

echo -e "\n${GREEN}2. Running Bridge Integration Tests${NC}"
npm test -- tests/integration/bridge.test.ts --verbose

echo -e "\n${GREEN}3. Running React Native Bridge Tests${NC}"
npm test -- tests/integration/react-native-bridge.test.ts --verbose

# Run all tests together with coverage
echo -e "\n${GREEN}4. Running All Tests with Coverage${NC}"
npm test -- tests/integration/*.test.ts --coverage --coverageDirectory=./coverage

# Generate coverage report
if [ -d "coverage" ]; then
    echo -e "\n${GREEN}Coverage Report Generated${NC}"
    echo "View detailed report at: wasm-modules/coverage/lcov-report/index.html"
fi

echo -e "\n${GREEN}✅ Integration Tests Complete!${NC}"
echo "========================================"

# Check if any tests failed
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Some tests failed. Please check the output above.${NC}"
    exit 1
fi