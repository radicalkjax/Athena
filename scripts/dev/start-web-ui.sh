#!/bin/bash

# Athena Web UI Starter
# Handles the React Native/Expo web interface

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}     ${CYAN}🌐 Athena Web UI Launcher${NC}            ${BLUE}║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo

cd Athena

# Check if this is what the user wants
echo -e "${YELLOW}⚠️  Note: This launches the React Native UI only.${NC}"
echo -e "${YELLOW}   For the full malware analysis platform, use:${NC}"
echo -e "${CYAN}   Option 12: Launch with Docker${NC}"
echo -e "${CYAN}   Option 13: Start Local Services${NC}"
echo
read -p "Continue with UI only? (y/n) " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}Returning to main menu...${NC}"
    exit 0
fi

echo -e "\n${BLUE}Starting Expo Web UI...${NC}"

# Method 1: Try Expo development server (recommended)
echo -e "${CYAN}Starting Expo development server...${NC}"
echo -e "${YELLOW}This will open in your browser automatically.${NC}"
echo

# Start Expo in web mode
npm run web

# Note: npm run web starts the Expo dev server, which handles everything