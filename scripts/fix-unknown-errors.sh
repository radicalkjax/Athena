#!/bin/bash

# Fix unknown error types in TypeScript catch blocks

echo "Fixing unknown error types in TypeScript files..."

# Find all TypeScript files and fix the pattern
find /workspaces/Athena -name "*.ts" -type f | while read -r file; do
    # Skip node_modules
    if [[ "$file" == *"node_modules"* ]]; then
        continue
    fi
    
    # Create a temporary file
    temp_file="${file}.tmp"
    
    # Replace error patterns
    sed -E 's/\$\{error\.message\}/\${error instanceof Error ? error.message : String(error)}/g' "$file" > "$temp_file"
    
    # Check if file was modified
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        echo "Fixed: $file"
    else
        rm "$temp_file"
    fi
done

# Also fix patterns where error is used without template literal
find /workspaces/Athena -name "*.ts" -type f | while read -r file; do
    # Skip node_modules
    if [[ "$file" == *"node_modules"* ]]; then
        continue
    fi
    
    # Create a temporary file
    temp_file="${file}.tmp"
    
    # Replace catch (error) patterns to include type assertion
    perl -pe 's/catch \(error\)/catch (error: unknown)/g' "$file" > "$temp_file"
    
    # Check if file was modified
    if ! cmp -s "$file" "$temp_file"; then
        mv "$temp_file" "$file"
        echo "Fixed catch blocks in: $file"
    else
        rm "$temp_file"
    fi
done

echo "Done fixing unknown error types!"