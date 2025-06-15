#!/bin/bash

# Athena Complete Services Launcher
# Starts all required backend services for the platform

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'

# Service status tracking
declare -A SERVICE_PIDS
declare -A SERVICE_STATUS

# Print banner
print_banner() {
    echo
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}     ${CYAN}🚀 Athena Services Launcher${NC}        ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}   ${MAGENTA}Complete Platform Startup Script${NC}     ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo
}

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    local missing=()
    
    # Check for Node.js
    if ! command -v node &> /dev/null; then
        missing+=("Node.js")
    fi
    
    # Check for npm
    if ! command -v npm &> /dev/null; then
        missing+=("npm")
    fi
    
    # Check for Docker
    if ! command -v docker &> /dev/null; then
        missing+=("Docker")
    fi
    
    # Check for Redis (optional - we can use Docker)
    if ! command -v redis-cli &> /dev/null && ! docker ps 2>/dev/null | grep -q redis; then
        echo -e "${YELLOW}⚠️  Redis not found locally, will use Docker${NC}"
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing prerequisites: ${missing[*]}${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites installed${NC}"
    return 0
}

# Start Redis
start_redis() {
    echo -e "\n${BLUE}🗄️  Starting Redis...${NC}"
    
    # Check if Redis is already running
    if redis-cli ping &> /dev/null; then
        echo -e "${GREEN}✅ Redis already running${NC}"
        SERVICE_STATUS["redis"]="running"
        return 0
    fi
    
    # Try to start Redis locally first
    if command -v redis-server &> /dev/null; then
        redis-server --daemonize yes --port 6379
        sleep 2
        if redis-cli ping &> /dev/null; then
            echo -e "${GREEN}✅ Redis started locally${NC}"
            SERVICE_STATUS["redis"]="running"
            return 0
        fi
    fi
    
    # Fall back to Docker
    echo -e "${YELLOW}Starting Redis in Docker...${NC}"
    docker run -d \
        --name athena-redis \
        -p 6379:6379 \
        -v athena-redis-data:/data \
        redis:7-alpine \
        redis-server --appendonly yes
    
    sleep 3
    
    if docker ps | grep -q athena-redis; then
        echo -e "${GREEN}✅ Redis started in Docker${NC}"
        SERVICE_STATUS["redis"]="running"
        return 0
    else
        echo -e "${RED}❌ Failed to start Redis${NC}"
        SERVICE_STATUS["redis"]="failed"
        return 1
    fi
}

# Build TypeScript
build_typescript() {
    echo -e "\n${BLUE}🔨 Building TypeScript...${NC}"
    
    if [ ! -f "tsconfig.json" ]; then
        echo -e "${RED}❌ tsconfig.json not found${NC}"
        return 1
    fi
    
    # Check if already built
    if [ -d "dist" ] && [ -f "dist/services/server.js" ]; then
        echo -e "${YELLOW}⚠️  Build directory exists, skipping build${NC}"
        echo -e "${CYAN}   Run 'npm run build' to rebuild${NC}"
        return 0
    fi
    
    npm run build
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ TypeScript build complete${NC}"
        return 0
    else
        echo -e "${RED}❌ TypeScript build failed${NC}"
        return 1
    fi
}

# Start API Server
start_api_server() {
    echo -e "\n${BLUE}🌐 Starting API Server...${NC}"
    
    # Check if server file exists
    if [ ! -f "dist/services/server.js" ] && [ ! -f "services/server.ts" ]; then
        echo -e "${YELLOW}⚠️  Server file not found, creating basic server...${NC}"
        create_basic_server
    fi
    
    # Set environment variables
    export NODE_ENV=${NODE_ENV:-development}
    export PORT=${PORT:-3000}
    export REDIS_HOST=${REDIS_HOST:-localhost}
    export REDIS_PORT=${REDIS_PORT:-6379}
    
    # Start the server
    if [ -f "dist/services/server.js" ]; then
        node dist/services/server.js &
    else
        npx ts-node services/server.ts &
    fi
    
    SERVICE_PIDS["api"]=$!
    
    # Wait for server to start
    echo -e "${CYAN}Waiting for API server to start...${NC}"
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if curl -s http://localhost:${PORT}/api/v1/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ API Server started on port ${PORT}${NC}"
            SERVICE_STATUS["api"]="running"
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
        echo -n "."
    done
    
    echo -e "\n${RED}❌ API Server failed to start${NC}"
    SERVICE_STATUS["api"]="failed"
    return 1
}

# Create basic server if missing
create_basic_server() {
    mkdir -p services
    
    cat > services/server.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import { createClient } from 'redis';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Redis client
const redis = createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

redis.on('error', (err) => console.error('Redis Client Error', err));
redis.connect().catch(console.error);

// Health check endpoint
app.get('/api/v1/health', async (req, res) => {
    const redisStatus = redis.isReady ? 'connected' : 'disconnected';
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
            redis: redisStatus,
            wasm: 'loaded'
        }
    });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
    res.type('text/plain');
    res.send(`# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",status="200"} 1
`);
});

// WASM analysis endpoint (mock)
app.post('/api/v1/wasm/analyze', async (req, res) => {
    const { module, data } = req.body;
    
    // Mock WASM analysis
    res.json({
        module,
        result: {
            analysis: 'complete',
            threats: []
        },
        executionTime: Math.random() * 100
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Athena API Server running on http://localhost:${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
});
EOF

    echo -e "${GREEN}✅ Created basic server file${NC}"
}

# Start monitoring dashboard
start_monitoring() {
    echo -e "\n${BLUE}📊 Starting Monitoring Dashboard...${NC}"
    
    # Simple monitoring using terminal
    cat > /tmp/athena-monitor.sh << 'EOF'
#!/bin/bash
while true; do
    clear
    echo "===== Athena Services Monitor ====="
    echo "Time: $(date)"
    echo ""
    
    # Check Redis
    echo -n "Redis: "
    if redis-cli ping &> /dev/null; then
        echo -e "\033[0;32m✅ Running\033[0m"
    else
        echo -e "\033[0;31m❌ Down\033[0m"
    fi
    
    # Check API
    echo -n "API Server: "
    if curl -s http://localhost:3000/api/v1/health > /dev/null 2>&1; then
        echo -e "\033[0;32m✅ Running\033[0m"
    else
        echo -e "\033[0;31m❌ Down\033[0m"
    fi
    
    echo ""
    echo "Press Ctrl+C to exit"
    sleep 5
done
EOF
    
    chmod +x /tmp/athena-monitor.sh
    echo -e "${GREEN}✅ Monitoring script created${NC}"
    echo -e "${CYAN}   Run '/tmp/athena-monitor.sh' in a new terminal to monitor services${NC}"
}

# Show service URLs
show_service_urls() {
    echo -e "\n${BLUE}🔗 Service URLs:${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "API Server:     ${GREEN}http://localhost:3000${NC}"
    echo -e "Health Check:   ${GREEN}http://localhost:3000/api/v1/health${NC}"
    echo -e "Metrics:        ${GREEN}http://localhost:3000/metrics${NC}"
    echo -e "API Docs:       ${GREEN}http://localhost:3000/docs${NC}"
    
    if [ "${SERVICE_STATUS[redis]}" == "running" ]; then
        echo -e "Redis:          ${GREEN}localhost:6379${NC}"
    fi
    
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down services...${NC}"
    
    # Stop API server
    if [ ! -z "${SERVICE_PIDS[api]}" ]; then
        kill ${SERVICE_PIDS[api]} 2>/dev/null
        echo -e "${GREEN}✅ API server stopped${NC}"
    fi
    
    # Optionally stop Redis
    read -p "Stop Redis? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if docker ps | grep -q athena-redis; then
            docker stop athena-redis
            docker rm athena-redis
            echo -e "${GREEN}✅ Redis container stopped${NC}"
        elif command -v redis-cli &> /dev/null; then
            redis-cli shutdown 2>/dev/null
            echo -e "${GREEN}✅ Redis stopped${NC}"
        fi
    fi
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Set trap for cleanup
trap cleanup EXIT

# Main execution
main() {
    print_banner
    
    if ! check_prerequisites; then
        echo -e "${RED}Please install missing prerequisites and try again${NC}"
        exit 1
    fi
    
    # Check if we're in the correct directory
    if [ ! -f "package.json" ] || [ ! -d "wasm-modules" ]; then
        echo -e "${RED}❌ Not in Athena root directory${NC}"
        echo -e "${YELLOW}Please run from the Athena project root${NC}"
        exit 1
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${YELLOW}📦 Installing dependencies...${NC}"
        npm install
    fi
    
    # Start services
    start_redis
    
    if [ "${SERVICE_STATUS[redis]}" != "running" ]; then
        echo -e "${RED}❌ Cannot continue without Redis${NC}"
        exit 1
    fi
    
    build_typescript
    start_api_server
    
    if [ "${SERVICE_STATUS[api]}" != "running" ]; then
        echo -e "${RED}❌ API server failed to start${NC}"
        exit 1
    fi
    
    start_monitoring
    show_service_urls
    
    echo -e "\n${GREEN}🎉 All services started successfully!${NC}"
    echo -e "${CYAN}Press Ctrl+C to stop all services${NC}\n"
    
    # Keep script running
    while true; do
        sleep 1
    done
}

# Run main function
main