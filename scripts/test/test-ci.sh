#!/bin/bash
# CI test runner that handles TypeScript configuration

# Set CI environment
export CI=true
export NODE_ENV=test

# For Athena tests, temporarily use the CI tsconfig
if [ -f "Athena/tsconfig.json" ] && [ -f "Athena/tsconfig.ci.json" ]; then
  echo "Backing up Athena tsconfig.json for CI..."
  mv Athena/tsconfig.json Athena/tsconfig.json.bak
  cp Athena/tsconfig.ci.json Athena/tsconfig.json
fi

# Run tests
npm test

# Capture exit code
TEST_EXIT_CODE=$?

# Restore original tsconfig
if [ -f "Athena/tsconfig.json.bak" ]; then
  echo "Restoring original Athena tsconfig.json..."
  mv Athena/tsconfig.json.bak Athena/tsconfig.json
fi

# Exit with test exit code
exit $TEST_EXIT_CODE