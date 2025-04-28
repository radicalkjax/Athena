#!/bin/bash
# Athena Run Script
# This script helps run the Athena application in different modes

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

# Check if we're in the right directory
if [ ! -d "Athena" ]; then
    echo -e "${RED}✗ Athena directory not found${NC}"
    echo -e "${YELLOW}Please run this script from the root of the repository${NC}"
    exit 1
fi

# Function to display help
show_help() {
    echo -e "${YELLOW}Usage:${NC} ./scripts/run.sh [option]"
    echo
    echo -e "${YELLOW}Options:${NC}"
    echo -e "  ${GREEN}web${NC}        Run the web version (default)"
    echo -e "  ${GREEN}ios${NC}        Run the iOS version (requires macOS)"
    echo -e "  ${GREEN}android${NC}    Run the Android version"
    echo -e "  ${GREEN}expo${NC}       Run using Expo (for both iOS and Android)"
    echo -e "  ${GREEN}help${NC}       Show this help message"
    echo
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  ./scripts/run.sh web"
    echo -e "  ./scripts/run.sh ios"
    echo -e "  ./scripts/run.sh android"
    echo -e "  ./scripts/run.sh expo"
    echo
}

# Function to run the web version
run_web() {
    echo -e "${BLUE}Starting Athena web version...${NC}"
    cd Athena && npx serve dist
}

# Function to run the iOS version
run_ios() {
    echo -e "${BLUE}Starting Athena iOS version...${NC}"
    
    # Check if running on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${RED}✗ iOS version can only be run on macOS${NC}"
        echo -e "${YELLOW}Try running the Expo version instead: ./scripts/run.sh expo${NC}"
        exit 1
    fi
    
    # Check if Xcode is installed
    if ! command -v xcodebuild &> /dev/null; then
        echo -e "${RED}✗ Xcode not found${NC}"
        echo -e "${YELLOW}Please install Xcode from the App Store${NC}"
        exit 1
    fi
    
    cd Athena && npx expo run:ios
}

# Function to run the Android version
run_android() {
    echo -e "${BLUE}Starting Athena Android version...${NC}"
    
    # Check if Android SDK is installed
    if [ -z "$ANDROID_HOME" ]; then
        echo -e "${RED}✗ Android SDK not found${NC}"
        echo -e "${YELLOW}Please install Android Studio and set up the Android SDK${NC}"
        echo -e "${YELLOW}Try running the Expo version instead: ./scripts/run.sh expo${NC}"
        exit 1
    fi
    
    cd Athena && npx expo run:android
}

# Function to run using Expo
run_expo() {
    echo -e "${BLUE}Starting Athena using Expo...${NC}"
    echo -e "${RED}WARNING: The Expo launch method is currently not working.${NC}"
    echo -e "${YELLOW}Please use the web version instead: ./scripts/run.sh web${NC}"
    
    echo -e "\n${YELLOW}Do you still want to try running with Expo? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${YELLOW}This will display a QR code that you can scan with the Expo Go app on your device${NC}"
        cd Athena && npx expo start
    else
        echo -e "${GREEN}Exiting. Try using the web version with: ./scripts/run.sh web${NC}"
    fi
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    # No arguments provided, default to web
    run_web
else
    case "$1" in
        web)
            run_web
            ;;
        ios)
            run_ios
            ;;
        android)
            run_android
            ;;
        expo)
            run_expo
            ;;
        help)
            show_help
            ;;
        *)
            echo -e "${RED}✗ Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
fi
