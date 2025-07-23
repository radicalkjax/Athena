#!/bin/bash

# Test file upload endpoint

echo "Testing file upload endpoint..."

# Create a test file
echo "This is a test file for malware analysis" > test-upload.txt

# Upload the file
echo "Uploading file..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/analysis/upload \
  -H "x-api-key: test-key-12345" \
  -F "file=@test-upload.txt" \
  -F "analysisType=comprehensive" \
  -F "priority=normal")

echo "Upload response:"
echo "$RESPONSE" | jq .

# Extract analysis ID
ANALYSIS_ID=$(echo "$RESPONSE" | jq -r '.analysisId')

if [ "$ANALYSIS_ID" != "null" ]; then
    echo -e "\nChecking analysis status..."
    sleep 2
    
    # Check status
    curl -s -X GET "http://localhost:3000/api/v1/analysis/$ANALYSIS_ID/status" \
      -H "x-api-key: test-key-12345" | jq .
    
    echo -e "\nWaiting for analysis to complete..."
    sleep 5
    
    # Get results
    echo -e "\nGetting analysis results..."
    curl -s -X GET "http://localhost:3000/api/v1/analysis/$ANALYSIS_ID/results" \
      -H "x-api-key: test-key-12345" | jq .
fi

# Clean up
rm -f test-upload.txt

echo -e "\nTest complete!"