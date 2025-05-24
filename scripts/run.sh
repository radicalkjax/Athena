#!/bin/bash
# Athena Unified Run Script
# This script automatically sets up and runs the Athena application

# Set text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
    echo -e "  ${GREEN}setup${NC}      Force run setup process"
    echo -e "  ${GREEN}help${NC}       Show this help message"
    echo
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  ./scripts/run.sh          # Auto-setup and run web version"
    echo -e "  ./scripts/run.sh web      # Run web version"
    echo -e "  ./scripts/run.sh ios      # Run iOS version"
    echo -e "  ./scripts/run.sh setup    # Force setup"
    echo
    echo -e "${CYAN}Note: The script will automatically detect if setup is needed${NC}"
    echo -e "${CYAN}and run the setup process before launching the application.${NC}"
    echo
}

# Function to check if Node.js is installed and meets version requirements
check_nodejs() {
    echo -e "${BLUE}Checking for Node.js...${NC}"
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo -e "${GREEN}✓ Node.js is installed (${NODE_VERSION})${NC}"
        
        # Check Node.js version (require v16+)
        NODE_MAJOR_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR_VERSION" -lt 16 ]; then
            echo -e "${RED}✗ Node.js version is too old (${NODE_VERSION})${NC}"
            echo -e "${YELLOW}Please install Node.js v16 or later from https://nodejs.org/${NC}"
            exit 1
        fi
    else
        echo -e "${RED}✗ Node.js is not installed${NC}"
        echo -e "${YELLOW}Please install Node.js v16 or later from https://nodejs.org/${NC}"
        exit 1
    fi
}

# Function to check if npm is installed
check_npm() {
    echo -e "${BLUE}Checking for npm...${NC}"
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm -v)
        echo -e "${GREEN}✓ npm is installed (${NPM_VERSION})${NC}"
    else
        echo -e "${RED}✗ npm is not installed${NC}"
        echo -e "${YELLOW}Please install npm v8 or later${NC}"
        exit 1
    fi
}

# Function to check if Git is installed
check_git() {
    echo -e "${BLUE}Checking for Git...${NC}"
    if command -v git &> /dev/null; then
        GIT_VERSION=$(git --version)
        echo -e "${GREEN}✓ Git is installed (${GIT_VERSION})${NC}"
    else
        echo -e "${RED}✗ Git is not installed${NC}"
        echo -e "${YELLOW}Please install Git from https://git-scm.com/downloads${NC}"
        exit 1
    fi
}

# Function to check if setup is needed
needs_setup() {
    # Check if node_modules exists in both root and Athena
    if [ ! -d "node_modules" ] || [ ! -d "Athena/node_modules" ]; then
        return 0  # true - needs setup
    fi
    
    # Check if critical polyfills are installed
    cd Athena
    if ! npm list buffer &> /dev/null || ! npm list process &> /dev/null; then
        cd ..
        return 0  # true - needs setup
    fi
    cd ..
    
    # Check if .env file exists
    if [ ! -f "Athena/.env" ]; then
        return 0  # true - needs setup
    fi
    
    return 1  # false - setup not needed
}

# Function to check for updates
check_updates() {
    echo -e "${BLUE}Checking for dependency updates...${NC}"
    
    # Check if package-lock.json is newer than node_modules
    if [ "Athena/package-lock.json" -nt "Athena/node_modules" ]; then
        echo -e "${YELLOW}⚠ Dependencies may be outdated, updating...${NC}"
        cd Athena
        npm install --legacy-peer-deps
        cd ..
    fi
    
    # Check for missing polyfills
    cd Athena
    if ! npm list buffer &> /dev/null || ! npm list process &> /dev/null; then
        echo -e "${YELLOW}⚠ Web polyfills missing, installing...${NC}"
        npm install buffer process --save
    fi
    cd ..
}

# Function to run setup
run_setup() {
    echo -e "${CYAN}🔧 Running setup process...${NC}\n"
    
    # Check system requirements
    check_nodejs
    check_npm
    check_git
    
    # Install root dependencies first
    echo -e "\n${BLUE}Installing root dependencies...${NC}"
    npm install --legacy-peer-deps
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Root dependencies installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install root dependencies${NC}"
        exit 1
    fi
    
    # Install Athena dependencies
    echo -e "\n${BLUE}Installing Athena dependencies...${NC}"
    cd Athena
    npm install --legacy-peer-deps
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Athena dependencies installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install Athena dependencies${NC}"
        exit 1
    fi
    
    # Install critical polyfill dependencies for web compatibility
    echo -e "\n${BLUE}Installing web compatibility polyfills...${NC}"
    npm install buffer process --save
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Web polyfills installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install web polyfills${NC}"
        echo -e "${YELLOW}This may cause browser compatibility issues${NC}"
    fi
    
    # Install serve for web deployment
    echo -e "\n${BLUE}Installing serve for web deployment...${NC}"
    npm install -g serve
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Serve installed globally${NC}"
    else
        echo -e "${YELLOW}⚠ Failed to install serve globally, trying local installation...${NC}"
        npm install serve --save-dev
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Serve installed locally${NC}"
        else
            echo -e "${RED}✗ Failed to install serve${NC}"
            echo -e "${YELLOW}Web deployment may not work properly${NC}"
        fi
    fi
    
    # Go back to root directory
    cd ..
    
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
    
    # Verify critical files exist
    echo -e "\n${BLUE}Verifying project configuration...${NC}"
    
    # Check webpack config
    if [ -f "Athena/webpack.config.js" ]; then
        echo -e "${GREEN}✓ Webpack configuration found${NC}"
    else
        echo -e "${RED}✗ Webpack configuration missing${NC}"
        echo -e "${YELLOW}This may cause web build issues${NC}"
    fi
    
    # Check metro config
    if [ -f "Athena/metro.config.js" ]; then
        echo -e "${GREEN}✓ Metro configuration found${NC}"
    else
        echo -e "${RED}✗ Metro configuration missing${NC}"
        echo -e "${YELLOW}This may cause mobile build issues${NC}"
    fi
    
    # Check package.json
    if [ -f "Athena/package.json" ]; then
        echo -e "${GREEN}✓ Package.json found${NC}"
        
        # Check if buffer and process are in dependencies
        if grep -q '"buffer"' Athena/package.json && grep -q '"process"' Athena/package.json; then
            echo -e "${GREEN}✓ Web polyfills are configured${NC}"
        else
            echo -e "${YELLOW}⚠ Web polyfills may not be properly configured${NC}"
        fi
    else
        echo -e "${RED}✗ Package.json missing${NC}"
        exit 1
    fi
    
    echo -e "\n${GREEN}✓ Setup complete!${NC}"
}

# Function to check and fix missing components
fix_missing_components() {
    echo -e "${BLUE}Checking for missing components...${NC}"
    
    # Check for TabBarBackground component
    if [ ! -f "Athena/components/ui/TabBarBackground.tsx" ]; then
        echo -e "${YELLOW}⚠ Creating missing TabBarBackground component...${NC}"
        mkdir -p Athena/components/ui
        cat > Athena/components/ui/TabBarBackground.tsx << 'EOF'
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

export default function TabBarBackground() {
  return (
    <BlurView
      tint="systemMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}
EOF
        echo -e "${GREEN}✓ Created TabBarBackground component${NC}"
    fi
    
    # Check for required app icons
    if [ ! -f "Athena/assets/images/icon.png" ]; then
        echo -e "${YELLOW}⚠ Creating missing app icon...${NC}"
        if [ -f "Athena/assets/images/logo.png" ]; then
            cp Athena/assets/images/logo.png Athena/assets/images/icon.png
            echo -e "${GREEN}✓ Created app icon from logo${NC}"
        else
            echo -e "${RED}✗ No logo.png found to create app icon${NC}"
        fi
    fi
    
    # Check for adaptive icon
    if [ ! -f "Athena/assets/images/adaptive-icon.png" ]; then
        echo -e "${YELLOW}⚠ Creating missing adaptive icon...${NC}"
        if [ -f "Athena/assets/images/logo.png" ]; then
            cp Athena/assets/images/logo.png Athena/assets/images/adaptive-icon.png
            echo -e "${GREEN}✓ Created adaptive icon from logo${NC}"
        else
            echo -e "${RED}✗ No logo.png found to create adaptive icon${NC}"
        fi
    fi
    
    # Check for splash icon
    if [ ! -f "Athena/assets/images/splash-icon.png" ]; then
        echo -e "${YELLOW}⚠ Creating missing splash icon...${NC}"
        if [ -f "Athena/assets/images/logo.png" ]; then
            cp Athena/assets/images/logo.png Athena/assets/images/splash-icon.png
            echo -e "${GREEN}✓ Created splash icon from logo${NC}"
        else
            echo -e "${RED}✗ No logo.png found to create splash icon${NC}"
        fi
    fi
    
    # Check for favicon
    if [ ! -f "Athena/assets/images/favicon.png" ]; then
        echo -e "${YELLOW}⚠ Creating missing favicon...${NC}"
        if [ -f "Athena/assets/images/logo.png" ]; then
            cp Athena/assets/images/logo.png Athena/assets/images/favicon.png
            echo -e "${GREEN}✓ Created favicon from logo${NC}"
        else
            echo -e "${RED}✗ No logo.png found to create favicon${NC}"
        fi
    fi
    
    # Check for hooks index file
    if [ ! -f "Athena/hooks/index.ts" ]; then
        echo -e "${YELLOW}⚠ Creating missing hooks index file...${NC}"
        mkdir -p Athena/hooks
        cat > Athena/hooks/index.ts << 'EOF'
import { useColorScheme as useNativeColorScheme } from 'react-native';

export function useColorScheme() {
  return useNativeColorScheme() ?? 'light';
}

const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: '#0a7ea4',
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: '#0a7ea4',
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: '#fff',
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#fff',
  },
};

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[theme][colorName];
  }
}
EOF
        echo -e "${GREEN}✓ Created hooks index file${NC}"
    fi
}

# Function to run the web version
run_web() {
    echo -e "${BLUE}Starting Athena web version...${NC}"
    
    # Check if dependencies are installed
    echo -e "${YELLOW}Checking dependencies...${NC}"
    cd Athena
    
    if [ ! -d "node_modules" ]; then
        echo -e "${RED}✗ Dependencies not installed${NC}"
        echo -e "${YELLOW}Running setup first...${NC}"
        cd ..
        run_setup
        cd Athena
    fi
    
    # Check for critical polyfills
    if ! npm list buffer &> /dev/null || ! npm list process &> /dev/null; then
        echo -e "${YELLOW}⚠ Web polyfills may be missing, installing them now...${NC}"
        npm install buffer process --save
        if [ $? -ne 0 ]; then
            echo -e "${RED}✗ Failed to install web polyfills${NC}"
            echo -e "${YELLOW}This may cause browser compatibility issues${NC}"
        fi
    fi
    
    # Fix missing components before building
    fix_missing_components
    
    echo -e "${YELLOW}Building the web application...${NC}"
    npm run build:web
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Build completed successfully${NC}"
        echo -e "${BLUE}Starting web server...${NC}"
        
        # Check what directory was actually created by expo export
        if [ -d "dist" ]; then
            SERVE_DIR="dist"
        elif [ -d "web-build" ]; then
            SERVE_DIR="web-build"
        elif [ -d "build" ]; then
            SERVE_DIR="build"
        else
            echo -e "${RED}✗ Could not find build output directory${NC}"
            echo -e "${YELLOW}Looking for build output...${NC}"
            ls -la | grep -E "(dist|build|web-build)"
            exit 1
        fi
        
        echo -e "${GREEN}✓ Found build output in: ${SERVE_DIR}${NC}"
        
        # Try to use serve, fallback to npx serve if global install failed
        if command -v serve &> /dev/null; then
            serve $SERVE_DIR
        else
            npx serve $SERVE_DIR
        fi
    else
        echo -e "${RED}✗ Build failed${NC}"
        echo -e "${YELLOW}Attempting to fix common issues and retry...${NC}"
        
        # Try to fix missing components and retry once
        fix_missing_components
        
        echo -e "${YELLOW}Retrying build...${NC}"
        npm run build:web
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Build completed successfully on retry${NC}"
            echo -e "${BLUE}Starting web server...${NC}"
            
            # Check what directory was actually created by expo export
            if [ -d "dist" ]; then
                SERVE_DIR="dist"
            elif [ -d "web-build" ]; then
                SERVE_DIR="web-build"
            elif [ -d "build" ]; then
                SERVE_DIR="build"
            else
                echo -e "${RED}✗ Could not find build output directory${NC}"
                exit 1
            fi
            
            # Try to use serve, fallback to npx serve if global install failed
            if command -v serve &> /dev/null; then
                serve $SERVE_DIR
            else
                npx serve $SERVE_DIR
            fi
        else
            echo -e "${RED}✗ Build failed again${NC}"
            echo -e "${YELLOW}Common issues and solutions:${NC}"
            echo -e "1. Run ${BLUE}./scripts/run.sh setup${NC} to force setup"
            echo -e "2. Check that Node.js version is 16 or later: ${BLUE}node -v${NC}"
            echo -e "3. Clear cache and reinstall: ${BLUE}rm -rf node_modules package-lock.json && npm install${NC}"
            echo -e "4. Check for any missing environment variables in ${BLUE}.env${NC}"
            echo -e "5. Check for missing components in ${BLUE}components/ui/${NC}"
            echo -e "6. Try using expo start --web instead: ${BLUE}cd Athena && npx expo start --web${NC}"
            exit 1
        fi
    fi
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

# Main execution logic
main() {
    # Parse command line arguments
    case "${1:-web}" in
        setup)
            run_setup
            echo -e "\n${GREEN}Setup complete! Run ${BLUE}./scripts/run.sh${NC} to start the application."
            ;;
        web|"")
            # Check if setup is needed
            if needs_setup; then
                echo -e "${CYAN}🔧 First time setup detected, running setup process...${NC}\n"
                run_setup
                echo -e "\n${CYAN}🚀 Setup complete! Now starting the application...${NC}\n"
            else
                echo -e "${GREEN}✓ Setup already complete${NC}"
                check_updates
            fi
            run_web
            ;;
        ios)
            # Check if setup is needed
            if needs_setup; then
                echo -e "${CYAN}🔧 First time setup detected, running setup process...${NC}\n"
                run_setup
                echo -e "\n${CYAN}🚀 Setup complete! Now starting the application...${NC}\n"
            else
                check_updates
            fi
            run_ios
            ;;
        android)
            # Check if setup is needed
            if needs_setup; then
                echo -e "${CYAN}🔧 First time setup detected, running setup process...${NC}\n"
                run_setup
                echo -e "\n${CYAN}🚀 Setup complete! Now starting the application...${NC}\n"
            else
                check_updates
            fi
            run_android
            ;;
        expo)
            # Check if setup is needed
            if needs_setup; then
                echo -e "${CYAN}🔧 First time setup detected, running setup process...${NC}\n"
                run_setup
                echo -e "\n${CYAN}🚀 Setup complete! Now starting the application...${NC}\n"
            else
                check_updates
            fi
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
}

# Run main function with all arguments
main "$@"
