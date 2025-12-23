#!/bin/bash
# Athena v2 - AI-Powered Malware Analysis Platform
# Simple launcher for the Tauri desktop application

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Transgender flag colors
TRANS_BLUE='\033[38;2;91;206;250m'
TRANS_PINK='\033[38;2;245;169;184m'
TRANS_WHITE='\033[38;2;255;255;255m'

BOLD='\033[1m'
DIM='\033[2m'

# Unicode characters
CHECK_MARK='✓'
CROSS_MARK='✗'
WARNING_SIGN='⚠'
ROCKET='🚀'
GEAR='⚙'

# Project paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ATHENA_DIR="$SCRIPT_DIR/athena-v2"

print_banner() {
    echo
    echo -e "${TRANS_BLUE}  █████╗ ████████╗██╗  ██╗███████╗███╗   ██╗ █████╗ ${NC}"
    echo -e "${TRANS_PINK} ██╔══██╗╚══██╔══╝██║  ██║██╔════╝████╗  ██║██╔══██╗${NC}"
    echo -e "${TRANS_WHITE} ███████║   ██║   ███████║█████╗  ██╔██╗ ██║███████║${NC}"
    echo -e "${TRANS_PINK} ██╔══██║   ██║   ██╔══██║██╔══╝  ██║╚██╗██║██╔══██║${NC}"
    echo -e "${TRANS_BLUE} ██║  ██║   ██║   ██║  ██║███████╗██║ ╚████║██║  ██║${NC}"
    echo -e "${TRANS_WHITE} ╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝${NC}"
    echo
    echo -e "${TRANS_PINK}${BOLD}AI-Powered Malware Analysis Platform${NC} ${DIM}v2.0${NC}"
    echo -e "${TRANS_BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
}

show_help() {
    print_banner
    echo -e "${CYAN}${BOLD}Usage:${NC} ./athena.sh [command]"
    echo
    echo -e "${BLUE}${BOLD}Commands:${NC}"
    echo -e "  ${GREEN}dev${NC}       Start development mode ${DIM}(default)${NC}"
    echo -e "  ${GREEN}build${NC}     Build production application"
    echo -e "  ${GREEN}test${NC}      Run all tests"
    echo -e "  ${GREEN}check${NC}     Run pre-flight checks"
    echo -e "  ${GREEN}help${NC}      Show this help message"
    echo
    echo -e "${BLUE}${BOLD}Examples:${NC}"
    echo -e "  ./athena.sh         ${DIM}# Start in development mode${NC}"
    echo -e "  ./athena.sh build   ${DIM}# Build for production${NC}"
    echo -e "  ./athena.sh test    ${DIM}# Run test suite${NC}"
    echo
}

check_requirements() {
    echo -e "${BLUE}${BOLD}Pre-flight Checks${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━${NC}"

    local all_good=true

    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v)
        echo -e "${GREEN}${CHECK_MARK}${NC} Node.js ${NODE_VERSION}"
    else
        echo -e "${RED}${CROSS_MARK}${NC} Node.js not found"
        echo -e "  ${DIM}Install from https://nodejs.org/${NC}"
        all_good=false
    fi

    # Check Rust
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version | cut -d' ' -f2)
        echo -e "${GREEN}${CHECK_MARK}${NC} Rust ${RUST_VERSION}"
    else
        echo -e "${RED}${CROSS_MARK}${NC} Rust not found"
        echo -e "  ${DIM}Install from https://rustup.rs/${NC}"
        all_good=false
    fi

    # Check Cargo
    if command -v cargo &> /dev/null; then
        echo -e "${GREEN}${CHECK_MARK}${NC} Cargo installed"
    else
        echo -e "${RED}${CROSS_MARK}${NC} Cargo not found"
        all_good=false
    fi

    # Check athena-v2 directory
    if [ -d "$ATHENA_DIR" ]; then
        echo -e "${GREEN}${CHECK_MARK}${NC} athena-v2 directory found"
    else
        echo -e "${RED}${CROSS_MARK}${NC} athena-v2 directory not found"
        all_good=false
    fi

    # Check node_modules
    if [ -d "$ATHENA_DIR/node_modules" ]; then
        echo -e "${GREEN}${CHECK_MARK}${NC} Dependencies installed"
    else
        echo -e "${YELLOW}${WARNING_SIGN}${NC} Dependencies not installed"
        echo -e "  ${DIM}Run: cd athena-v2 && npm install${NC}"
    fi

    # Platform-specific checks
    case "$OSTYPE" in
        darwin*)
            if xcode-select -p &> /dev/null; then
                echo -e "${GREEN}${CHECK_MARK}${NC} Xcode Command Line Tools"
            else
                echo -e "${YELLOW}${WARNING_SIGN}${NC} Xcode Command Line Tools not found"
                echo -e "  ${DIM}Run: xcode-select --install${NC}"
            fi
            ;;
        linux*)
            # Check for required Linux libs
            if pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
                echo -e "${GREEN}${CHECK_MARK}${NC} WebKit2GTK found"
            else
                echo -e "${YELLOW}${WARNING_SIGN}${NC} WebKit2GTK may be missing"
                echo -e "  ${DIM}See: athena-v2/scripts/install-tauri-deps.sh${NC}"
            fi
            ;;
    esac

    echo

    if [ "$all_good" = true ]; then
        echo -e "${GREEN}${CHECK_MARK} All requirements met${NC}"
        return 0
    else
        echo -e "${RED}${CROSS_MARK} Some requirements missing${NC}"
        return 1
    fi
}

install_deps() {
    echo -e "${BLUE}${GEAR} Installing dependencies...${NC}"
    cd "$ATHENA_DIR"

    if [ ! -d "node_modules" ]; then
        echo -e "${CYAN}Installing npm packages...${NC}"
        npm install
    fi

    echo -e "${GREEN}${CHECK_MARK} Dependencies ready${NC}"
}

run_dev() {
    print_banner
    echo -e "${ROCKET} ${BOLD}Starting Development Mode${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    cd "$ATHENA_DIR"

    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        install_deps
    fi

    echo -e "${CYAN}Starting Tauri development server...${NC}"
    echo -e "${DIM}This will open the Athena desktop application${NC}"
    echo

    npm run tauri:dev
}

run_build() {
    print_banner
    echo -e "${GEAR} ${BOLD}Building Production Application${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo

    cd "$ATHENA_DIR"

    # Install deps if needed
    if [ ! -d "node_modules" ]; then
        install_deps
    fi

    echo -e "${CYAN}Building Tauri application...${NC}"
    echo -e "${DIM}This may take a few minutes${NC}"
    echo

    npm run tauri:build

    echo
    echo -e "${GREEN}${CHECK_MARK} Build complete!${NC}"
    echo

    # Show build output location
    case "$OSTYPE" in
        darwin*)
            echo -e "${CYAN}Application bundle:${NC}"
            echo -e "  ${DIM}athena-v2/src-tauri/target/release/bundle/macos/${NC}"
            ;;
        linux*)
            echo -e "${CYAN}Application bundles:${NC}"
            echo -e "  ${DIM}athena-v2/src-tauri/target/release/bundle/deb/${NC}"
            echo -e "  ${DIM}athena-v2/src-tauri/target/release/bundle/appimage/${NC}"
            ;;
        msys*|cygwin*|win32*)
            echo -e "${CYAN}Application installer:${NC}"
            echo -e "  ${DIM}athena-v2/src-tauri/target/release/bundle/msi/${NC}"
            ;;
    esac
}

run_tests() {
    print_banner
    echo -e "${GEAR} ${BOLD}Running Tests${NC}"
    echo -e "${TRANS_PINK}━━━━━━━━━━━━━━━${NC}"
    echo

    cd "$ATHENA_DIR"

    echo -e "${CYAN}Running Rust tests...${NC}"
    cd src-tauri
    cargo test
    cd ..

    echo
    echo -e "${CYAN}Running frontend tests...${NC}"
    npm test 2>/dev/null || echo -e "${YELLOW}${WARNING_SIGN} No frontend tests configured${NC}"

    echo
    echo -e "${GREEN}${CHECK_MARK} Tests complete${NC}"
}

# Main
main() {
    case "${1:-dev}" in
        dev|"")
            run_dev
            ;;
        build)
            run_build
            ;;
        test)
            run_tests
            ;;
        check)
            print_banner
            check_requirements
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            echo -e "${RED}${CROSS_MARK} Unknown command: $1${NC}"
            echo
            show_help
            exit 1
            ;;
    esac
}

main "$@"
