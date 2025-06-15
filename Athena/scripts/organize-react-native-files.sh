#!/bin/bash

# Script to organize React Native .js files into a separate directory
# This prevents conflicts with Expo Router

echo "Organizing React Native files..."

# Create the directory structure
mkdir -p react-native-dist

# Function to recreate directory structure and move file
move_with_structure() {
    local file="$1"
    local dir=$(dirname "$file")
    
    # Create the directory structure in react-native-dist
    mkdir -p "react-native-dist/$dir"
    
    # Move the file
    mv "$file" "react-native-dist/$file"
    echo "Moved: $file -> react-native-dist/$file"
}

# Find all .js files that have .ts or .tsx counterparts
find . -type f -name "*.js" ! -path "./node_modules/*" ! -path "./react-native-dist/*" ! -path "./.expo/*" ! -path "./dist/*" | while read jsfile; do
    # Get the base name without extension
    base="${jsfile%.*}"
    
    # Skip if this is the root index.js (needed for Expo)
    if [ "$jsfile" = "./index.js" ]; then
        continue
    fi
    
    # Check if a .ts or .tsx version exists
    if [ -f "${base}.ts" ] || [ -f "${base}.tsx" ]; then
        move_with_structure "$jsfile"
    fi
done

echo "React Native files organized successfully!"
echo ""
echo "To use the React Native version, the files are now in: react-native-dist/"
echo "The Expo version will use the .tsx/.ts files in the main directories."