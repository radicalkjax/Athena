#!/bin/bash

echo "Testing Simple WASM Analysis..."
echo ""

# Simple test without base64 encoding
echo "Test 1: Simple Analysis Request"
curl -s -X POST "http://localhost:3000/api/v1/analyze" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-key-123" \
  -d '{
    "content": "Simple test content for WASM analysis",
    "analysisType": "GENERAL_ANALYSIS",
    "metadata": {
      "fileType": "text"
    }
  }' | jq .

echo ""
echo "Test 2: WASM Module Status"
curl -s "http://localhost:3000/api/v1/status/wasm" | jq '.wasmTest'