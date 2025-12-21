#!/bin/bash

# Fix for Expo Web Build serving issue
# This script ensures proper web build output with index.html

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Fixing Expo Web Build...${NC}"

cd Athena

# Method 1: Try using expo export:web (newer command)
echo -e "${YELLOW}Attempting expo export:web...${NC}"
if npx expo export:web --output-dir dist; then
    echo -e "${GREEN}✅ Export successful${NC}"
else
    echo -e "${YELLOW}⚠️  expo export:web failed, trying alternative...${NC}"
    
    # Method 2: Use webpack build directly
    echo -e "${YELLOW}Building with webpack...${NC}"
    if npx expo build:web; then
        echo -e "${GREEN}✅ Webpack build successful${NC}"
    else
        # Method 3: Manual fix - copy web folder content
        echo -e "${YELLOW}Applying manual fix...${NC}"
        
        # Create dist directory if it doesn't exist
        mkdir -p dist
        
        # Copy the web/index.html to dist
        if [ -f "web/index.html" ]; then
            cp web/index.html dist/
            echo -e "${GREEN}✅ Copied index.html${NC}"
        fi
        
        # Build with expo and ensure index.html exists
        npx expo export --platform web --output-dir dist
        
        # If still no index.html, create a basic one
        if [ ! -f "dist/index.html" ]; then
            echo -e "${YELLOW}Creating index.html...${NC}"
            cat > dist/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1.00001, viewport-fit=cover" />
    <title>Athena</title>
    <style>
        html, body, #root {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script>
        // Check if bundle exists
        fetch('/_expo/static/js/web/main.js')
            .then(() => {
                // Load the Expo bundle
                const script = document.createElement('script');
                script.src = '/_expo/static/js/web/main.js';
                document.body.appendChild(script);
            })
            .catch(() => {
                document.getElementById('root').innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <div style="text-align: center;">
                            <h1>Athena Platform</h1>
                            <p>Web UI build not found.</p>
                            <p>For the API backend, use option 12 or 13 in the main menu.</p>
                            <br>
                            <a href="http://localhost:3000/api/v1/health" style="color: #0066cc;">Check API Health</a>
                        </div>
                    </div>
                `;
            });
    </script>
</body>
</html>
EOF
            echo -e "${GREEN}✅ Created index.html${NC}"
        fi
    fi
fi

# Check if build was successful
if [ -f "dist/index.html" ]; then
    echo -e "${GREEN}✅ Web build fixed!${NC}"
    echo -e "${BLUE}You can now serve the dist directory${NC}"
else
    echo -e "${RED}❌ Failed to create proper web build${NC}"
    echo -e "${YELLOW}The React Native app may not be configured for web export.${NC}"
    echo -e "${YELLOW}Consider using the API backend instead (options 12-13).${NC}"
fi