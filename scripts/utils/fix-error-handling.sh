#!/bin/bash

# Fix unknown error type issues in TypeScript files
echo "Fixing error handling in TypeScript files..."

# Find all TypeScript files with catch blocks
files=$(find /workspaces/Athena/services/aiProviders -name "*.ts" -type f | grep -v node_modules | grep -v ".bak")

for file in $files; do
  # Check if file has catch (error) blocks
  if grep -q "catch (error)" "$file"; then
    echo "Processing $file..."
    
    # Replace patterns where error.message is used without type checking
    sed -i 's/error\.message/error instanceof Error ? error.message : "Unknown error"/g' "$file"
    
    # Replace patterns where error is logged directly in object literals
    sed -i 's/{ error }/{ error: error instanceof Error ? error.message : String(error) }/g' "$file"
  fi
done

echo "Fixed error handling in multiple files"