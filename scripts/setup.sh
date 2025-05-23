#!/bin/bash
# Athena Setup Script
# This script helps with the initial setup of the Athena application

# Set text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print banner
echo -e "${BLUE}"
echo "  █████╗ ████████╗██╗  ██╗███████╗███╗   ██╗ █████╗ "
echo " ██╔══██╗╚══██╔══╝██║  ██║██╔════╝████╗  ██║██╔══██╗"
echo " ███████║   ██║   ███████║█████╗  ██╔██╗ ██║███████║"
echo " ██╔══██║   ██║   ██╔══██║██╔══╝  ██║╚██╗██║██╔══██║"
echo " ██║  ██║   ██║   ██║  ██║███████╗██║ ╚████║██║  ██║"
echo " ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝"
echo -e "${NC}"
echo -e "${YELLOW}AI-Powered Malware Analysis Assistant${NC}"
echo -e "${BLUE}============================================${NC}\n"

# Check if Node.js is installed
echo -e "${BLUE}Checking for Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✓ Node.js is installed (${NODE_VERSION})${NC}"
else
    echo -e "${RED}✗ Node.js is not installed${NC}"
    echo -e "${YELLOW}Please install Node.js v16 or later from https://nodejs.org/${NC}"
    exit 1
fi

# Check if npm is installed
echo -e "${BLUE}Checking for npm...${NC}"
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✓ npm is installed (${NPM_VERSION})${NC}"
else
    echo -e "${RED}✗ npm is not installed${NC}"
    echo -e "${YELLOW}Please install npm v8 or later${NC}"
    exit 1
fi

# Check if Git is installed
echo -e "${BLUE}Checking for Git...${NC}"
if command -v git &> /dev/null; then
    GIT_VERSION=$(git --version)
    echo -e "${GREEN}✓ Git is installed (${GIT_VERSION})${NC}"
else
    echo -e "${RED}✗ Git is not installed${NC}"
    echo -e "${YELLOW}Please install Git from https://git-scm.com/downloads${NC}"
    exit 1
fi

# Check if we're in the right directory
echo -e "${BLUE}Checking directory structure...${NC}"
if [ -d "Athena" ]; then
    echo -e "${GREEN}✓ Athena directory found${NC}"
else
    echo -e "${RED}✗ Athena directory not found${NC}"
    echo -e "${YELLOW}Please run this script from the root of the repository${NC}"
    exit 1
fi

# Install dependencies
echo -e "\n${BLUE}Installing dependencies...${NC}"
npm install --legacy-peer-deps
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies installed successfully${NC}"
else
    echo -e "${RED}✗ Failed to install dependencies${NC}"
    exit 1
fi

# Check for .env file and create if it doesn't exist
echo -e "\n${BLUE}Checking for .env file...${NC}"
if [ -f "Athena/.env" ]; then
    echo -e "${GREEN}✓ .env file already exists${NC}"
else
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    if [ -f "Athena/.env.example" ]; then
        cp Athena/.env.example Athena/.env
        echo -e "${GREEN}✓ Created .env file from template${NC}"
        echo -e "${YELLOW}Please edit Athena/.env to add your API keys${NC}"
    else
        echo -e "${RED}✗ .env.example file not found${NC}"
        echo -e "${YELLOW}Creating empty .env file...${NC}"
        touch Athena/.env
        echo "# API Keys for AI Models" >> Athena/.env
        echo "OPENAI_API_KEY=your_openai_api_key_here" >> Athena/.env
        echo "CLAUDE_API_KEY=your_claude_api_key_here" >> Athena/.env
        echo "DEEPSEEK_API_KEY=your_deepseek_api_key_here" >> Athena/.env
        echo -e "${GREEN}✓ Created empty .env file${NC}"
        echo -e "${YELLOW}Please edit Athena/.env to add your API keys${NC}"
    fi
fi

# Setup complete
echo -e "\n${GREEN}✓ Setup complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Edit ${BLUE}Athena/.env${NC} to add your API keys"
echo -e "2. Run ${BLUE}cd Athena && npm run start:web${NC} to start the web application"
echo -e "3. Or run ${BLUE}cd Athena && npx expo start${NC} to start the Expo development server"
echo -e "\n${YELLOW}For more information, see the documentation:${NC}"
echo -e "- ${BLUE}docs/GETTING_STARTED.md${NC}"
echo -e "- ${BLUE}docs/USER_GUIDE.md${NC}"
echo -e "${BLUE}============================================${NC}\n"
