#!/bin/bash

# Athena Platform Launcher
# Provides multiple options for launching the complete Athena platform

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Print banner
print_banner() {
    clear
    echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}                                                    ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}     ${CYAN}🚀 ATHENA PLATFORM LAUNCHER${NC}                   ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}     ${MAGENTA}Advanced Malware Analysis System${NC}              ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}                                                    ${BLUE}║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
    echo
}

# Show menu
show_menu() {
    echo -e "${CYAN}Select launch method:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo
    echo -e "  ${GREEN}1)${NC} 🐳 Docker Compose ${YELLOW}(Recommended)${NC}"
    echo -e "     Complete platform with monitoring"
    echo
    echo -e "  ${GREEN}2)${NC} 🖥️  Local Development"
    echo -e "     Run services locally (requires Redis)"
    echo
    echo -e "  ${GREEN}3)${NC} ☸️  Kubernetes"
    echo -e "     Deploy to local Kubernetes cluster"
    echo
    echo -e "  ${GREEN}4)${NC} 🧪 Test Mode"
    echo -e "     Minimal setup for testing"
    echo
    echo -e "  ${GREEN}5)${NC} 📊 Run Load Tests"
    echo -e "     Execute performance tests"
    echo
    echo -e "  ${GREEN}6)${NC} 📚 View Documentation"
    echo -e "     Open API documentation"
    echo
    echo -e "  ${GREEN}q)${NC} Quit"
    echo
}

# Check Docker
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        echo -e "${YELLOW}Please install Docker from https://docker.com${NC}"
        return 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker daemon is not running${NC}"
        echo -e "${YELLOW}Please start Docker Desktop${NC}"
        return 1
    fi
    
    return 0
}

# Launch with Docker Compose
launch_docker_compose() {
    echo -e "\n${BLUE}🐳 Launching with Docker Compose...${NC}\n"
    
    if ! check_docker; then
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        echo -e "${YELLOW}Creating .env file...${NC}"
        cat > .env << EOF
# AI Provider Keys
CLAUDE_API_KEY=your_claude_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here
OPENAI_API_KEY=your_openai_api_key_here

# Redis
REDIS_PASSWORD=athena_redis_password_$(openssl rand -hex 16)

# Environment
NODE_ENV=development
EOF
        echo -e "${GREEN}✅ Created .env file${NC}"
        echo -e "${YELLOW}⚠️  Please add your API keys to .env${NC}"
        read -p "Press Enter to continue..."
    fi
    
    # Pull/build images
    echo -e "${CYAN}Building images...${NC}"
    docker-compose build
    
    # Start services
    echo -e "${CYAN}Starting services...${NC}"
    docker-compose up -d
    
    # Wait for services
    echo -e "${CYAN}Waiting for services to start...${NC}"
    sleep 5
    
    # Check health
    echo -e "\n${BLUE}Service Status:${NC}"
    docker-compose ps
    
    # Show URLs
    echo -e "\n${GREEN}🎉 Athena Platform is running!${NC}\n"
    echo -e "${CYAN}Service URLs:${NC}"
    echo -e "  API Server:    ${GREEN}http://localhost:3000${NC}"
    echo -e "  Health Check:  ${GREEN}http://localhost:3000/api/v1/health${NC}"
    echo -e "  Prometheus:    ${GREEN}http://localhost:9091${NC}"
    echo -e "  Grafana:       ${GREEN}http://localhost:3001${NC} (admin/admin)"
    echo
    echo -e "${YELLOW}To view logs:${NC} docker-compose logs -f"
    echo -e "${YELLOW}To stop:${NC} docker-compose down"
}

# Launch local development
launch_local() {
    echo -e "\n${BLUE}🖥️  Launching Local Development...${NC}\n"
    
    cd "$PROJECT_ROOT"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        return 1
    fi
    
    # Install dependencies
    if [ ! -d "node_modules" ]; then
        echo -e "${CYAN}Installing dependencies...${NC}"
        npm install
    fi
    
    # Use the start-all-services script
    ./scripts/start-all-services.sh
}

# Launch Kubernetes
launch_kubernetes() {
    echo -e "\n${BLUE}☸️  Deploying to Kubernetes...${NC}\n"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}❌ kubectl is not installed${NC}"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Create namespace
    echo -e "${CYAN}Creating namespace...${NC}"
    kubectl create namespace athena --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply configurations
    echo -e "${CYAN}Applying configurations...${NC}"
    kubectl apply -k k8s/base/ -n athena
    
    # Wait for deployment
    echo -e "${CYAN}Waiting for pods to be ready...${NC}"
    kubectl wait --for=condition=ready pod -l app=athena -n athena --timeout=300s
    
    # Port forward
    echo -e "${GREEN}✅ Deployment complete${NC}"
    echo -e "${CYAN}Setting up port forwarding...${NC}"
    kubectl port-forward -n athena svc/athena-service 3000:80 &
    
    echo -e "\n${GREEN}🎉 Athena is running on Kubernetes!${NC}"
    echo -e "  API Server: ${GREEN}http://localhost:3000${NC}"
}

# Launch test mode
launch_test_mode() {
    echo -e "\n${BLUE}🧪 Launching Test Mode...${NC}\n"
    
    cd "$PROJECT_ROOT"
    
    # Start mock server
    echo -e "${CYAN}Starting mock server...${NC}"
    if [ -f "tests/load/mock-server.js" ]; then
        node tests/load/mock-server.js &
        MOCK_PID=$!
        echo -e "${GREEN}✅ Mock server started (PID: $MOCK_PID)${NC}"
    fi
    
    # Run tests
    echo -e "${CYAN}Running tests...${NC}"
    npm test
    
    # Cleanup
    if [ ! -z "$MOCK_PID" ]; then
        kill $MOCK_PID 2>/dev/null
    fi
}

# Run load tests
run_load_tests() {
    echo -e "\n${BLUE}📊 Running Load Tests...${NC}\n"
    
    cd "$PROJECT_ROOT"
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        echo -e "${YELLOW}Installing k6...${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install k6
        else
            sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
            echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
            sudo apt-get update
            sudo apt-get install k6
        fi
    fi
    
    # Select test type
    echo -e "${CYAN}Select test type:${NC}"
    echo -e "  1) Simple load test"
    echo -e "  2) Full API test"
    echo -e "  3) Stress test (1000+ RPS)"
    read -p "Choice: " test_choice
    
    case $test_choice in
        1)
            ./scripts/run-load-test.sh
            ;;
        2)
            k6 run tests/load/full-api-load-test.js
            ;;
        3)
            ./scripts/run-stress-test.sh
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            ;;
    esac
}

# View documentation
view_documentation() {
    echo -e "\n${BLUE}📚 Opening Documentation...${NC}\n"
    
    cd "$PROJECT_ROOT"
    
    # Start a simple HTTP server for docs
    echo -e "${CYAN}Starting documentation server...${NC}"
    
    if command -v python3 &> /dev/null; then
        cd docs/api
        python3 -m http.server 8080 &
        DOC_PID=$!
        echo -e "${GREEN}✅ Documentation server started${NC}"
        echo -e "${CYAN}Opening browser...${NC}"
        
        # Open browser
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open "http://localhost:8080/swagger-ui.html"
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open "http://localhost:8080/swagger-ui.html"
        fi
        
        echo -e "\n${YELLOW}Press Enter to stop the documentation server${NC}"
        read
        kill $DOC_PID 2>/dev/null
    else
        echo -e "${YELLOW}Python3 not found. View docs at:${NC}"
        echo -e "  ${CYAN}docs/api/openapi.yaml${NC}"
        echo -e "  ${CYAN}docs/deployment/production-deployment-guide.md${NC}"
    fi
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    # Kill any background processes
    jobs -p | xargs -r kill 2>/dev/null
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set trap
trap cleanup EXIT

# Main execution
main() {
    print_banner
    
    while true; do
        show_menu
        read -p "Enter choice: " choice
        
        case $choice in
            1)
                launch_docker_compose
                ;;
            2)
                launch_local
                ;;
            3)
                launch_kubernetes
                ;;
            4)
                launch_test_mode
                ;;
            5)
                run_load_tests
                ;;
            6)
                view_documentation
                ;;
            q|Q)
                echo -e "\n${GREEN}Thanks for using Athena!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice${NC}"
                sleep 1
                ;;
        esac
        
        echo -e "\n${YELLOW}Press Enter to return to menu...${NC}"
        read
        print_banner
    done
}

# Run main
main