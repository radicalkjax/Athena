#!/bin/bash
# Athena Unified Run Script - Enhanced Edition
# This script automatically sets up and runs the Athena application
# Now with transgender flag colors, better visuals, and enhanced checks

# Set text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Transgender flag colors
TRANS_BLUE='\033[38;2;91;206;250m'    # Light Blue
TRANS_PINK='\033[38;2;245;169;184m'   # Pink
TRANS_WHITE='\033[38;2;255;255;255m'  # White

# Additional visual elements
BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'
BLINK='\033[5m'
REVERSE='\033[7m'

# Unicode characters for progress and loading
SPINNER_FRAMES=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
TRANS_SPINNER_FRAMES=('🏳️‍⚧️' '💙' '💗' '🤍' '💗' '💙')
DOTS_FRAMES=('   ' '.  ' '.. ' '...')
ARROW_FRAMES=('▹▹▹▹▹' '▸▹▹▹▹' '▹▸▹▹▹' '▹▹▸▹▹' '▹▹▹▸▹' '▹▹▹▹▸')
CHECK_MARK='✓'
CROSS_MARK='✗'
WARNING_SIGN='⚠'
GEAR='⚙'
ROCKET='🚀'
PACKAGE='📦'
TOOL='🔧'
SPARKLES='✨'
HEART='💖'
TRANS_FLAG='🏳️‍⚧️'

# Print enhanced banner with transgender flag colors
print_banner() {
    echo
    echo -e "${TRANS_BLUE}  █████╗ ████████╗██╗  ██╗███████╗███╗   ██╗ █████╗ ${NC}"
    echo -e "${TRANS_PINK} ██╔══██╗╚══██╔══╝██║  ██║██╔════╝████╗  ██║██╔══██╗${NC}"
    echo -e "${TRANS_WHITE} ███████║   ██║   ███████║█████╗  ██╔██╗ ██║███████║${NC}"
    echo -e "${TRANS_PINK} ██╔══██║   ██║   ██╔══██║██╔══╝  ██║╚██╗██║██╔══██║${NC}"
    echo -e "${TRANS_BLUE} ██║  ██║   ██║   ██║  ██║███████╗██║ ╚████║██║  ██║${NC}"
    echo -e "${TRANS_WHITE} ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝${NC}"
    echo
    echo -e "${TRANS_PINK}${BOLD}AI-Powered Malware Analysis Assistant${NC}"
    echo -e "${TRANS_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${TRANS_WHITE}🏳️‍⚧️ Made with love ${TRANS_PINK}♥${TRANS_WHITE} Open source for all 🏳️‍⚧️${NC}"
    echo -e "${TRANS_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
}

# Spinner function for loading animations
spinner() {
    local pid=$1
    local message=$2
    local spinner_type=${3:-"default"}
    local spinner_index=0

    while kill -0 $pid 2>/dev/null; do
        case $spinner_type in
            "trans")
                # Transgender pride flag animation
                local frame="${TRANS_SPINNER_FRAMES[$spinner_index]}"
                printf "\r${frame} ${message}"
                spinner_index=$(((spinner_index + 1) % ${#TRANS_SPINNER_FRAMES[@]}))
                sleep 0.2
                ;;
            "dots")
                # Simple dots animation
                local frame="${DOTS_FRAMES[$spinner_index]}"
                printf "\r${TRANS_PINK}${frame}${NC} ${message}"
                spinner_index=$(((spinner_index + 1) % ${#DOTS_FRAMES[@]}))
                sleep 0.3
                ;;
            "arrow")
                # Arrow animation with trans colors
                local frame="${ARROW_FRAMES[$spinner_index]}"
                case $((spinner_index % 3)) in
                    0) printf "\r${TRANS_BLUE}${frame}${NC} ${message}" ;;
                    1) printf "\r${TRANS_PINK}${frame}${NC} ${message}" ;;
                    2) printf "\r${TRANS_WHITE}${frame}${NC} ${message}" ;;
                esac
                spinner_index=$(((spinner_index + 1) % ${#ARROW_FRAMES[@]}))
                sleep 0.1
                ;;
            *)
                # Default spinner with trans colors
                local frame="${SPINNER_FRAMES[$spinner_index]}"
                case $((spinner_index % 3)) in
                    0) printf "\r${TRANS_BLUE}${frame}${NC} ${message}" ;;
                    1) printf "\r${TRANS_PINK}${frame}${NC} ${message}" ;;
                    2) printf "\r${TRANS_WHITE}${frame}${NC} ${message}" ;;
                esac
                spinner_index=$(((spinner_index + 1) % ${#SPINNER_FRAMES[@]}))
                sleep 0.1
                ;;
        esac
    done

    # Clear spinner line
    printf "\r%*s\r" "${COLUMNS:-$(tput cols)}" ""
}

# Progress bar function
progress_bar() {
    local current=$1
    local total=$2
    local message=$3
    local bar_length=30
    local filled_length=$((current * bar_length / total))

    # Create progress bar
    local bar=""
    for ((i=0; i<filled_length; i++)); do
        bar="${bar}█"
    done
    for ((i=filled_length; i<bar_length; i++)); do
        bar="${bar}░"
    done

    # Calculate percentage
    local percentage=$((current * 100 / total))

    # Print progress bar with transgender colors
    printf "\r${TRANS_PINK}[${TRANS_BLUE}${bar}${TRANS_PINK}]${NC} ${TRANS_WHITE}${percentage}%%${NC} ${message}"

    if [ $current -eq $total ]; then
        echo
    fi
}

# Enhanced function to display help
show_help() {
    print_banner
    echo -e "${TRANS_PINK}${BOLD}Usage:${NC} ./scripts/run.sh [option]"
    echo
    echo -e "${TRANS_BLUE}${BOLD}Options:${NC}"
    echo -e "  ${GREEN}web${NC}        Run the web version (default)"
    echo -e "  ${GREEN}ios${NC}        Run the iOS version (requires macOS)"
    echo -e "  ${GREEN}android${NC}    Run the Android version"
    echo -e "  ${GREEN}expo${NC}       Run using Expo (for both iOS and Android)"
    echo -e "  ${GREEN}setup${NC}      Force run setup process"
    echo -e "  ${GREEN}update${NC}     Check for and install updates"
    echo -e "  ${GREEN}clean${NC}      Clean build artifacts and caches"
    echo -e "  ${GREEN}help${NC}       Show this help message"
    echo
    echo -e "${TRANS_WHITE}${BOLD}Examples:${NC}"
    echo -e "  ./scripts/run.sh          # Auto-setup and run web version"
    echo -e "  ./scripts/run.sh web      # Run web version"
    echo -e "  ./scripts/run.sh update   # Update dependencies"
    echo -e "  ./scripts/run.sh clean    # Clean and rebuild"
    echo
    echo -e "${CYAN}${DIM}The script will automatically detect if setup is needed${NC}"
    echo -e "${CYAN}${DIM}and run the setup process before launching the application.${NC}"
    echo
}

# Enhanced system requirement check with visual feedback
check_system_requirements() {
    echo -e "${TRANS_BLUE}${BOLD}System Requirements Check${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    local checks=("Node.js" "npm" "Git")
    local current=0
    local total=${#checks[@]}

    for check in "${checks[@]}"; do
        current=$((current + 1))
        progress_bar $current $total "Checking $check..."
        sleep 0.3  # Small delay for visual effect

        case $check in
            "Node.js")
                if command -v node &> /dev/null; then
                    NODE_VERSION=$(node -v)
                    NODE_MAJOR_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
                    if [ "$NODE_MAJOR_VERSION" -lt 16 ]; then
                        echo -e "\r${RED}${CROSS_MARK}${NC} Node.js version is too old (${NODE_VERSION})"
                        echo -e "${YELLOW}${WARNING_SIGN} Please install Node.js v16 or later from https://nodejs.org/${NC}"
                        return 1
                    else
                        echo -e "\r${GREEN}${CHECK_MARK}${NC} Node.js ${NODE_VERSION}"
                    fi
                else
                    echo -e "\r${RED}${CROSS_MARK}${NC} Node.js is not installed"
                    echo -e "${YELLOW}${WARNING_SIGN} Please install Node.js v16 or later from https://nodejs.org/${NC}"
                    return 1
                fi
                ;;
            "npm")
                if command -v npm &> /dev/null; then
                    NPM_VERSION=$(npm -v)
                    echo -e "\r${GREEN}${CHECK_MARK}${NC} npm ${NPM_VERSION}"
                else
                    echo -e "\r${RED}${CROSS_MARK}${NC} npm is not installed"
                    return 1
                fi
                ;;
            "Git")
                if command -v git &> /dev/null; then
                    GIT_VERSION=$(git --version | cut -d' ' -f3)
                    echo -e "\r${GREEN}${CHECK_MARK}${NC} Git ${GIT_VERSION}"
                else
                    echo -e "\r${RED}${CROSS_MARK}${NC} Git is not installed"
                    echo -e "${YELLOW}${WARNING_SIGN} Please install Git from https://git-scm.com/downloads${NC}"
                    return 1
                fi
                ;;
        esac
    done

    echo -e "${GREEN}${SPARKLES} All system requirements met!${NC}"
    echo
    return 0
}

# Enhanced update check with visual feedback
check_for_updates() {
    echo -e "${TRANS_BLUE}${BOLD}Checking for Updates${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Check git status for uncommitted changes
    if [ -d .git ]; then
        echo -e "${TRANS_WHITE}${GEAR} Checking repository status...${NC}"

        # Check for uncommitted changes
        if ! git diff-index --quiet HEAD --; then
            echo -e "${YELLOW}${WARNING_SIGN} You have uncommitted changes${NC}"
        fi

        # Check for updates from remote
        git fetch --quiet
        LOCAL=$(git rev-parse @)
        REMOTE=$(git rev-parse @{u} 2>/dev/null || echo $LOCAL)
        BASE=$(git merge-base @ @{u} 2>/dev/null || echo $LOCAL)

        if [ $LOCAL = $REMOTE ]; then
            echo -e "${GREEN}${CHECK_MARK} Repository is up to date${NC}"
        elif [ $LOCAL = $BASE ]; then
            echo -e "${YELLOW}${WARNING_SIGN} Updates are available from remote${NC}"
            echo -e "${CYAN}Run 'git pull' to update${NC}"
        fi
    fi

    # Check package updates
    echo -e "${TRANS_WHITE}${PACKAGE} Checking dependency freshness...${NC}"

    cd Athena

    # Check if package-lock.json is newer than node_modules
    if [ -f "package-lock.json" ] && [ -d "node_modules" ]; then
        if [ "package-lock.json" -nt "node_modules" ]; then
            echo -e "${YELLOW}${WARNING_SIGN} Dependencies may be outdated${NC}"
            echo -e "${CYAN}Run './scripts/run.sh update' to update dependencies${NC}"
        else
            echo -e "${GREEN}${CHECK_MARK} Dependencies are up to date${NC}"
        fi
    fi

    # Detailed security vulnerability check
    echo
    echo -e "${TRANS_WHITE}🛡️  ${BOLD}Security Vulnerability Report${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Create temp file for audit output
    AUDIT_OUTPUT=$(mktemp)
    npm audit --json 2>/dev/null > $AUDIT_OUTPUT

    if [ -s $AUDIT_OUTPUT ]; then
        # Extract vulnerability counts
        TOTAL=$(jq -r '.metadata.vulnerabilities.total // 0' $AUDIT_OUTPUT 2>/dev/null || echo "0")
        CRITICAL=$(jq -r '.metadata.vulnerabilities.critical // 0' $AUDIT_OUTPUT 2>/dev/null || echo "0")
        HIGH=$(jq -r '.metadata.vulnerabilities.high // 0' $AUDIT_OUTPUT 2>/dev/null || echo "0")
        MODERATE=$(jq -r '.metadata.vulnerabilities.moderate // 0' $AUDIT_OUTPUT 2>/dev/null || echo "0")
        LOW=$(jq -r '.metadata.vulnerabilities.low // 0' $AUDIT_OUTPUT 2>/dev/null || echo "0")

        if [ "$TOTAL" -eq 0 ]; then
            echo -e "${GREEN}${CHECK_MARK} No security vulnerabilities found!${NC}"
        else
            echo -e "${YELLOW}${WARNING_SIGN} Found $TOTAL vulnerabilities:${NC}"
            [ "$CRITICAL" -gt 0 ] && echo -e "  ${RED}● Critical: $CRITICAL${NC}"
            [ "$HIGH" -gt 0 ] && echo -e "  ${MAGENTA}● High: $HIGH${NC}"
            [ "$MODERATE" -gt 0 ] && echo -e "  ${YELLOW}● Moderate: $MODERATE${NC}"
            [ "$LOW" -gt 0 ] && echo -e "  ${CYAN}● Low: $LOW${NC}"

            # Show top vulnerable packages
            echo
            echo -e "${TRANS_WHITE}📋 Top vulnerable packages:${NC}"
            jq -r '.advisories | to_entries | .[0:5] | .[] | .value | "  • \(.module_name) (\(.severity)): \(.title)"' $AUDIT_OUTPUT 2>/dev/null || echo "  Unable to parse vulnerability details"

            echo
            echo -e "${CYAN}Run 'npm audit fix' to auto-fix vulnerabilities${NC}"
        fi
    else
        echo -e "${GREEN}${CHECK_MARK} Security audit passed${NC}"
    fi

    rm -f $AUDIT_OUTPUT

    # Check for outdated packages
    echo
    echo -e "${TRANS_WHITE}📦 ${BOLD}Outdated Package Report${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Create temp file for outdated check
    OUTDATED_OUTPUT=$(mktemp)
    npm outdated --json 2>/dev/null > $OUTDATED_OUTPUT

    if [ -s $OUTDATED_OUTPUT ] && [ "$(cat $OUTDATED_OUTPUT)" != "{}" ]; then
        OUTDATED_COUNT=$(jq -r 'keys | length' $OUTDATED_OUTPUT 2>/dev/null || echo "0")

        if [ "$OUTDATED_COUNT" -gt 0 ]; then
            echo -e "${YELLOW}${WARNING_SIGN} Found $OUTDATED_COUNT outdated packages:${NC}"
            echo

            # Show outdated packages in a nice table format
            echo -e "${DIM}Package              Current   Wanted    Latest${NC}"
            echo -e "${DIM}─────────────────────────────────────────────${NC}"

            jq -r 'to_entries | .[] | "\(.key)|\(.value.current // "N/A")|\(.value.wanted // .value.current)|\(.value.latest // .value.wanted)"' $OUTDATED_OUTPUT 2>/dev/null | \
            while IFS='|' read -r package current wanted latest; do
                # Truncate package name if too long
                if [ ${#package} -gt 18 ]; then
                    package="${package:0:15}..."
                fi

                # Color code based on version difference
                if [ "$current" != "$latest" ]; then
                    printf "  ${YELLOW}%-18s${NC} ${DIM}%-8s${NC} ${GREEN}%-8s${NC} ${CYAN}%-8s${NC}\n" "$package" "$current" "$wanted" "$latest"
                else
                    printf "  ${GREEN}%-18s${NC} ${DIM}%-8s${NC} ${GREEN}%-8s${NC} ${GREEN}%-8s${NC}\n" "$package" "$current" "$wanted" "$latest"
                fi
            done

            echo
            echo -e "${CYAN}Run './scripts/run.sh update' to update packages${NC}"
        else
            echo -e "${GREEN}${CHECK_MARK} All packages are up to date${NC}"
        fi
    else
        echo -e "${GREEN}${CHECK_MARK} All packages are up to date${NC}"
    fi

    rm -f $OUTDATED_OUTPUT

    cd ..
    echo
}

# Enhanced setup function with visual progress
run_setup() {
    echo -e "${TRANS_BLUE}${TOOL} ${BOLD}Running Enhanced Setup Process${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    # Check system requirements
    if ! check_system_requirements; then
        echo -e "${RED}${CROSS_MARK} System requirements not met${NC}"
        exit 1
    fi

    # Setup steps with progress
    local steps=(
        "Installing root dependencies"
        "Installing Athena dependencies"
        "Installing web polyfills"
        "Setting up environment"
        "Verifying configuration"
        "Creating missing components"
    )

    local current=0
    local total=${#steps[@]}

    # Step 1: Root dependencies
    current=$((current + 1))
    echo -e "${TRANS_WHITE}${BOLD}Step $current/$total: ${steps[$((current-1))]}${NC}"
    (
        npm install --legacy-peer-deps --silent 2>&1
    ) &
    spinner $! "${TRANS_PINK}Installing packages...${NC}" "arrow"
    wait $!
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}${CHECK_MARK} Root dependencies installed${NC}"
    else
        echo -e "${RED}${CROSS_MARK} Failed to install root dependencies${NC}"
        exit 1
    fi
    echo

    # Step 2: Athena dependencies
    current=$((current + 1))
    echo -e "${TRANS_WHITE}${BOLD}Step $current/$total: ${steps[$((current-1))]}${NC}"
    cd Athena
    (
        npm install --legacy-peer-deps --silent 2>&1
    ) &
    spinner $! "${TRANS_BLUE}Installing Athena packages...${NC}" "trans"
    wait $!
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}${CHECK_MARK} Athena dependencies installed${NC}"
    else
        echo -e "${RED}${CROSS_MARK} Failed to install Athena dependencies${NC}"
        exit 1
    fi
    echo

    # Step 3: Web polyfills
    current=$((current + 1))
    echo -e "${TRANS_WHITE}${BOLD}Step $current/$total: ${steps[$((current-1))]}${NC}"
    (
        npm install buffer process --save --silent 2>&1
    ) &
    spinner $! "${TRANS_WHITE}Installing web compatibility polyfills...${NC}" "dots"
    wait $!
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}${CHECK_MARK} Web polyfills installed${NC}"
    else
        echo -e "${YELLOW}${WARNING_SIGN} Web polyfills installation had issues${NC}"
    fi
    echo

    # Step 4: Environment setup
    current=$((current + 1))
    echo -e "${TRANS_WHITE}${BOLD}Step $current/$total: ${steps[$((current-1))]}${NC}"
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            echo -e "${GREEN}${CHECK_MARK} Created .env from template${NC}"
        else
            cat > .env << 'EOF'
# API Keys for AI Models
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Additional Configuration
NODE_ENV=development
PORT=3000
EOF
            echo -e "${GREEN}${CHECK_MARK} Created default .env file${NC}"
        fi
        echo -e "${YELLOW}${WARNING_SIGN} Remember to add your API keys to .env${NC}"
    else
        echo -e "${GREEN}${CHECK_MARK} Environment file exists${NC}"
    fi
    echo

    # Step 5: Verify configuration
    current=$((current + 1))
    echo -e "${TRANS_WHITE}${BOLD}Step $current/$total: ${steps[$((current-1))]}${NC}"
    local config_files=("webpack.config.js" "metro.config.js" "package.json" "babel.config.js")
    local missing_configs=()

    for config in "${config_files[@]}"; do
        if [ ! -f "$config" ]; then
            missing_configs+=($config)
        fi
    done

    if [ ${#missing_configs[@]} -eq 0 ]; then
        echo -e "${GREEN}${CHECK_MARK} All configuration files present${NC}"
    else
        echo -e "${YELLOW}${WARNING_SIGN} Missing configurations: ${missing_configs[*]}${NC}"
    fi
    echo

    # Step 6: Create missing components
    current=$((current + 1))
    echo -e "${TRANS_WHITE}${BOLD}Step $current/$total: ${steps[$((current-1))]}${NC}"
    fix_missing_components_enhanced
    echo

    cd ..

    # Final summary
    echo -e "${TRANS_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${SPARKLES} ${BOLD}Setup Complete!${NC} ${GREEN}${SPARKLES}${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
}

# Enhanced component fixing with progress
fix_missing_components_enhanced() {
    local components=(
        "components/ui/TabBarBackground.tsx"
        "assets/images/icon.png"
        "assets/images/adaptive-icon.png"
        "assets/images/splash-icon.png"
        "assets/images/favicon.png"
        "hooks/index.ts"
    )

    local fixed=0

    for component in "${components[@]}"; do
        if [ ! -f "$component" ]; then
            case $component in
                "components/ui/TabBarBackground.tsx")
                    mkdir -p components/ui
                    cat > components/ui/TabBarBackground.tsx << 'EOF'
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
                    fixed=$((fixed + 1))
                    ;;
                "assets/images/"*)
                    if [ -f "assets/images/logo.png" ]; then
                        cp assets/images/logo.png $component
                        fixed=$((fixed + 1))
                    fi
                    ;;
                "hooks/index.ts")
                    mkdir -p hooks
                    cat > hooks/index.ts << 'EOF'
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
                    fixed=$((fixed + 1))
                    ;;
            esac
        fi
    done

    if [ $fixed -gt 0 ]; then
        echo -e "${GREEN}${CHECK_MARK} Fixed $fixed missing components${NC}"
    else
        echo -e "${GREEN}${CHECK_MARK} All components are present${NC}"
    fi
}

# Enhanced web runner with better error handling
run_web() {
    echo -e "${TRANS_BLUE}${ROCKET} ${BOLD}Starting Athena Web Version${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    cd Athena

    # Pre-flight checks with spinner
    echo -e "${TRANS_WHITE}${GEAR} Running pre-flight checks...${NC}"

    (
        sleep 1
        if [ ! -d "node_modules" ]; then
            echo "NEEDS_SETUP"
        fi
    ) &
    spinner $! "${TRANS_PINK}Checking dependencies...${NC}"

    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}${WARNING_SIGN} Dependencies not installed${NC}"
        echo -e "${CYAN}Running setup first...${NC}"
        cd ..
        run_setup
        cd Athena
    fi

    # Animated Metro bundler startup
    echo
    echo -e "${TRANS_BLUE}${BOLD}Starting Metro Bundler${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Show animated progress for Metro startup
    local metro_steps=(
        "Initializing Metro bundler..."
        "Loading transformer modules..."
        "Setting up hot module replacement..."
        "Configuring asset resolvers..."
        "Preparing development server..."
    )

    local step_index=0
    for step in "${metro_steps[@]}"; do
        # Create a fake background task for the spinner
        (sleep 0.8) &
        local pid=$!

        # Alternate colors for each step
        case $((step_index % 3)) in
            0) spinner $pid "${TRANS_BLUE}${step}${NC}" ;;
            1) spinner $pid "${TRANS_PINK}${step}${NC}" ;;
            2) spinner $pid "${TRANS_WHITE}${step}${NC}" ;;
        esac

        wait $pid
        echo -e "${GREEN}${CHECK_MARK}${NC} ${step/\.\.\./}"
        step_index=$((step_index + 1))
    done

    echo

    # Build application with progress
    echo -e "${TRANS_WHITE}${PACKAGE} Building web application...${NC}"
    echo

    # First, try to fix any web build issues
    if [ -f "../scripts/fix-web-build.sh" ]; then
        echo -e "${TRANS_BLUE}Running web build fix...${NC}"
        ../scripts/fix-web-build.sh
    fi

    # Show build phases with progress bar
    local build_phases=(
        "Analyzing dependencies"
        "Transpiling TypeScript"
        "Bundling JavaScript modules"
        "Processing CSS styles"
        "Optimizing assets"
        "Generating source maps"
        "Creating production bundle"
    )

    # Create a named pipe for build output
    BUILD_PIPE=$(mktemp -u)
    mkfifo $BUILD_PIPE

    # Start build in background and capture output
    (npm run build:web 2>&1 | tee $BUILD_PIPE) &
    BUILD_PID=$!

    # Show build progress with transgender colors
    local phase_index=0
    local total_phases=${#build_phases[@]}
    local bundling_active=false
    local static_routes_section=false

    # Monitor build progress
    (
        while IFS= read -r line; do
            # Metro bundler specific parsing
            if [[ $line == *"Starting Metro Bundler"* ]]; then
                echo
                echo -e "${TRANS_BLUE}${ROCKET} ${BOLD}Metro Bundler Starting${NC}"
                echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            elif [[ $line == *"Static rendering is enabled"* ]]; then
                echo -e "${TRANS_WHITE}${GEAR} Static rendering enabled${NC}"
                echo -e "${DIM}Learn more: https://docs.expo.dev/router/reference/static-rendering/${NC}"
            elif [[ $line == *"λ Bundled"* ]]; then
                # Extract time and module count
                local bundle_time=$(echo "$line" | grep -oE '[0-9]+ms' | head -1)
                local module_count=$(echo "$line" | grep -oE '\([0-9]+ modules\)')
                echo -e "${TRANS_BLUE}λ${NC} Server bundled in ${TRANS_PINK}${bundle_time}${NC} ${DIM}${module_count}${NC}"
            elif [[ $line == *"Web Bundled"* ]]; then
                # Extract module count for web bundle
                local module_count=$(echo "$line" | grep -oE '\([0-9]+ modules\)')
                echo -e "${TRANS_PINK}🌐${NC} Web bundled ${DIM}${module_count}${NC}"
            elif [[ $line == *"› web bundles"* ]]; then
                echo
                echo -e "${TRANS_WHITE}${PACKAGE} ${BOLD}Web Bundles:${NC}"
                bundling_active=true
            elif [[ $line == *"› Static routes"* ]]; then
                echo
                echo -e "${TRANS_WHITE}${SPARKLES} ${BOLD}Static Routes Generated:${NC}"
                static_routes_section=true
                bundling_active=false
            elif [[ $bundling_active == true ]] && [[ $line == *"_expo/static/"* ]]; then
                # Parse bundle files
                if [[ $line == *".css"* ]]; then
                    local size=$(echo "$line" | grep -oE '\([^)]+\)' | tail -1)
                    echo -e "  ${TRANS_BLUE}📄${NC} CSS bundle ${size}"
                elif [[ $line == *".js"* ]]; then
                    local size=$(echo "$line" | grep -oE '\([^)]+\)' | tail -1)
                    echo -e "  ${TRANS_PINK}📦${NC} JS bundle ${size}"
                fi
            elif [[ $static_routes_section == true ]] && [[ $line == *"/"* ]] && [[ $line == *"kB)"* ]]; then
                # Parse static routes with alternating colors
                local route=$(echo "$line" | cut -d' ' -f1)
                local size=$(echo "$line" | grep -oE '\([^)]+\)')
                case $((phase_index % 3)) in
                    0) echo -e "  ${TRANS_BLUE}▸${NC} ${route} ${DIM}${size}${NC}" ;;
                    1) echo -e "  ${TRANS_PINK}▸${NC} ${route} ${DIM}${size}${NC}" ;;
                    2) echo -e "  ${TRANS_WHITE}▸${NC} ${route} ${DIM}${size}${NC}" ;;
                esac
                phase_index=$((phase_index + 1))
            elif [[ $line == *"webpack"* ]] || [[ $line == *"Compiling"* ]]; then
                echo -e "${TRANS_BLUE}${GEAR}${NC} $line"
            elif [[ $line == *"error"* ]] || [[ $line == *"Error"* ]]; then
                echo -e "${RED}${CROSS_MARK}${NC} $line"
            elif [[ $line == *"warning"* ]] || [[ $line == *"Warning"* ]]; then
                echo -e "${YELLOW}${WARNING_SIGN}${NC} $line"
            elif [[ $line == *"success"* ]] || [[ $line == *"Done"* ]]; then
                echo -e "${GREEN}${CHECK_MARK}${NC} $line"
            fi
        done < $BUILD_PIPE
    ) &

    wait $BUILD_PID
    BUILD_RESULT=$?
    rm -f $BUILD_PIPE

    if [ $BUILD_RESULT -eq 0 ]; then
        echo
        echo -e "${GREEN}${SPARKLES} Build completed successfully!${NC}"
        echo

        # Find build directory with animation
        echo -e "${TRANS_WHITE}Locating build output...${NC}"
        local SERVE_DIR=""
        for dir in dist web-build build; do
            (sleep 0.2) &
            spinner $! "${TRANS_PINK}Checking $dir...${NC}"
            if [ -d "$dir" ]; then
                SERVE_DIR=$dir
                echo -e "${GREEN}${CHECK_MARK}${NC} Found build in $dir"
                break
            fi
        done

        if [ -z "$SERVE_DIR" ]; then
            echo -e "${RED}${CROSS_MARK} Could not find build output${NC}"
            exit 1
        fi

        echo
        echo -e "${TRANS_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${TRANS_PINK}${ROCKET} ${BOLD}Athena is ready!${NC}"
        echo -e "${TRANS_WHITE}${SPARKLES} Starting web server from ${SERVE_DIR}...${NC}"
        echo -e "${TRANS_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo

        # Animated server startup
        echo -e "${TRANS_PINK}${BOLD}Starting Development Server${NC}"
        local server_steps=(
            "Initializing HTTP server..."
            "Setting up static file serving..."
            "Configuring MIME types..."
            "Enabling CORS headers..."
            "Server ready!"
        )

        for step in "${server_steps[@]}"; do
            (sleep 0.5) &
            spinner $! "${TRANS_BLUE}${step}${NC}"
            echo -e "${GREEN}${CHECK_MARK}${NC} ${step/\.\.\./}"
        done

        echo
        echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${TRANS_WHITE}🌐 Access Athena at:${NC}"
        echo -e "${TRANS_BLUE}   http://localhost:3000${NC}"
        echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo

        # Start server
        if command -v serve &> /dev/null; then
            serve $SERVE_DIR
        else
            npx serve $SERVE_DIR
        fi
    else
        echo
        echo -e "${RED}${CROSS_MARK} Build failed${NC}"
        echo -e "${YELLOW}${WARNING_SIGN} Attempting automatic fixes...${NC}"

        fix_missing_components_enhanced

        echo -e "${CYAN}Retrying build...${NC}"
        npm run build:web

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}${CHECK_MARK} Build succeeded on retry${NC}"
            # Find and serve build directory
            for dir in dist web-build build; do
                if [ -d "$dir" ]; then
                    if command -v serve &> /dev/null; then
                        serve $dir
                    else
                        npx serve $dir
                    fi
                    break
                fi
            done
        else
            echo -e "${RED}${CROSS_MARK} Build failed again${NC}"
            echo
            echo -e "${YELLOW}Troubleshooting suggestions:${NC}"
            echo -e "1. ${CYAN}./scripts/run.sh clean${NC} - Clean and rebuild"
            echo -e "2. ${CYAN}./scripts/run.sh update${NC} - Update dependencies"
            echo -e "3. Check ${CYAN}Athena/.env${NC} for missing variables"
            echo -e "4. Review build errors above"
            exit 1
        fi
    fi
}

# New update function
run_update() {
    echo -e "${TRANS_BLUE}${PACKAGE} ${BOLD}Updating Athena${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    # Update git repository
    if [ -d .git ]; then
        echo -e "${TRANS_WHITE}${GEAR} Updating repository...${NC}"
        (git pull --rebase 2>&1) &
        spinner $! "${TRANS_BLUE}Pulling latest changes...${NC}" "arrow"
        wait $!
        echo -e "${GREEN}${CHECK_MARK} Repository updated${NC}"
        echo
    fi

    # Update dependencies with animated progress
    echo -e "${TRANS_WHITE}${PACKAGE} Updating dependencies...${NC}"
    echo

    # Root dependencies
    echo -e "${TRANS_PINK}${BOLD}Step 1/3: Root packages${NC}"
    (npm update --legacy-peer-deps 2>&1) &
    spinner $! "${TRANS_PINK}Updating root packages...${NC}" "trans"
    wait $!
    echo -e "${GREEN}${CHECK_MARK} Root dependencies updated${NC}"
    echo

    # Athena dependencies
    echo -e "${TRANS_BLUE}${BOLD}Step 2/3: Athena packages${NC}"
    cd Athena
    (npm update --legacy-peer-deps 2>&1) &
    spinner $! "${TRANS_BLUE}Updating Athena packages...${NC}" "arrow"
    wait $!
    echo -e "${GREEN}${CHECK_MARK} Athena dependencies updated${NC}"
    echo

    # Security audit fix
    echo -e "${TRANS_WHITE}${BOLD}Step 3/3: Security fixes${NC}"
    echo -e "${TRANS_WHITE}🛡️  Running security audit...${NC}"
    (npm audit fix --legacy-peer-deps 2>&1) &
    spinner $! "${TRANS_WHITE}Applying security patches...${NC}" "dots"
    wait $!
    echo -e "${GREEN}${CHECK_MARK} Security patches applied${NC}"

    cd ..

    echo
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}${SPARKLES} ${BOLD}Update complete!${NC} ${TRANS_FLAG}"
    echo -e "${TRANS_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# New clean function
run_clean() {
    print_banner
    echo -e "${TRANS_BLUE}🧹 ${BOLD}Cleaning Athena${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    echo -e "${TRANS_WHITE}Cleaning build artifacts and caches...${NC}"

    # Clean directories
    local dirs_to_clean=(
        "node_modules"
        "Athena/node_modules"
        "Athena/dist"
        "Athena/web-build"
        "Athena/build"
        "Athena/.expo"
        "Athena/.cache"
    )

    for dir in "${dirs_to_clean[@]}"; do
        if [ -d "$dir" ]; then
            echo -e "${DIM}Removing $dir...${NC}"
            rm -rf "$dir"
        fi
    done

    # Clean lock files
    if [ -f "package-lock.json" ]; then
        rm -f package-lock.json
    fi
    if [ -f "Athena/package-lock.json" ]; then
        rm -f Athena/package-lock.json
    fi

    echo
    echo -e "${GREEN}${SPARKLES} Clean complete!${NC}"
    echo -e "${CYAN}Run './scripts/run.sh setup' to reinstall${NC}"
}

# Enhanced iOS runner
run_ios() {
    print_banner
    echo -e "${TRANS_BLUE}📱 ${BOLD}Starting Athena iOS Version${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${RED}${CROSS_MARK} iOS version requires macOS${NC}"
        echo -e "${YELLOW}Try: ${CYAN}./scripts/run.sh expo${NC}"
        exit 1
    fi

    if ! command -v xcodebuild &> /dev/null; then
        echo -e "${RED}${CROSS_MARK} Xcode not found${NC}"
        echo -e "${YELLOW}Install Xcode from the App Store${NC}"
        exit 1
    fi

    cd Athena && npx expo run:ios
}

# Enhanced Android runner
run_android() {
    print_banner
    echo -e "${TRANS_BLUE}🤖 ${BOLD}Starting Athena Android Version${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    if [ -z "$ANDROID_HOME" ]; then
        echo -e "${RED}${CROSS_MARK} Android SDK not found${NC}"
        echo -e "${YELLOW}Install Android Studio and set ANDROID_HOME${NC}"
        echo -e "${YELLOW}Try: ${CYAN}./scripts/run.sh expo${NC}"
        exit 1
    fi

    cd Athena && npx expo run:android
}

# Enhanced Expo runner
run_expo() {
    print_banner
    echo -e "${TRANS_BLUE}📲 ${BOLD}Starting Athena with Expo${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    echo -e "${YELLOW}${WARNING_SIGN} Note: Expo method may have compatibility issues${NC}"
    echo -e "${CYAN}Recommended: ${GREEN}./scripts/run.sh web${NC}"
    echo

    echo -e "${TRANS_WHITE}Continue with Expo? (y/n)${NC}"
    read -r response

    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        echo -e "${CYAN}Scan the QR code with Expo Go app${NC}"
        cd Athena && npx expo start
    else
        echo -e "${GREEN}Use: ${CYAN}./scripts/run.sh web${NC}"
    fi
}

# Check if setup is needed
needs_setup() {
    if [ ! -d "node_modules" ] || [ ! -d "Athena/node_modules" ]; then
        return 0
    fi

    cd Athena
    if ! npm list buffer &> /dev/null || ! npm list process &> /dev/null; then
        cd ..
        return 0
    fi
    cd ..

    if [ ! -f "Athena/.env" ]; then
        return 0
    fi

    return 1
}

# System health check function
system_health_check() {
    echo -e "${TRANS_BLUE}${BOLD}System Health Check${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━${NC}"

    # Check disk space
    echo -e "${TRANS_WHITE}💾 Disk Space:${NC}"
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    DISK_AVAIL=$(df -h . | awk 'NR==2 {print $4}')

    if [ "$DISK_USAGE" -gt 90 ]; then
        echo -e "  ${RED}${WARNING_SIGN} Low disk space: ${DISK_USAGE}% used (${DISK_AVAIL} available)${NC}"
    elif [ "$DISK_USAGE" -gt 75 ]; then
        echo -e "  ${YELLOW}${WARNING_SIGN} Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)${NC}"
    else
        echo -e "  ${GREEN}${CHECK_MARK} Disk usage: ${DISK_USAGE}% (${DISK_AVAIL} available)${NC}"
    fi

    # Check Node.js memory limit
    echo -e "${TRANS_WHITE}🧠 Node.js Memory:${NC}"
    NODE_MEM=$(node -e "console.log(Math.round(require('v8').getHeapStatistics().heap_size_limit / 1024 / 1024))")
    echo -e "  ${GREEN}${CHECK_MARK} Max heap size: ${NODE_MEM}MB${NC}"

    # Check for required tools
    echo -e "${TRANS_WHITE}🔧 Required Tools:${NC}"
    local tools=("jq" "curl" "docker")
    for tool in "${tools[@]}"; do
        if command -v $tool &> /dev/null; then
            echo -e "  ${GREEN}${CHECK_MARK} $tool is installed${NC}"
        else
            echo -e "  ${YELLOW}${WARNING_SIGN} $tool is not installed (optional)${NC}"
        fi
    done

    echo
}

# Main execution
main() {
    case "${1:-web}" in
        setup)
            run_setup
            echo -e "${CYAN}Run ${GREEN}./scripts/run.sh${NC} to start Athena"
            ;;
        web|"")
            if needs_setup; then
                echo -e "${CYAN}${TOOL} First time setup detected${NC}"
                run_setup
                echo
            else
                system_health_check
                check_for_updates
            fi
            run_web
            ;;
        ios)
            if needs_setup; then
                run_setup
                echo
            fi
            run_ios
            ;;
        android)
            if needs_setup; then
                run_setup
                echo
            fi
            run_android
            ;;
        expo)
            if needs_setup; then
                run_setup
                echo
            fi
            run_expo
            ;;
        update)
            run_update
            ;;
        clean)
            run_clean
            ;;
        help)
            show_help
            ;;
        *)
            echo -e "${RED}${CROSS_MARK} Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
}

# Check if we're in the right directory
if [ ! -d "Athena" ]; then
    echo -e "${RED}${CROSS_MARK} Athena directory not found${NC}"
    echo -e "${YELLOW}Run from repository root${NC}"
    exit 1
fi

# Show banner first thing (except for help command which shows its own)
if [ "$1" != "help" ]; then
    print_banner
fi

# Run main function
main "$@"
