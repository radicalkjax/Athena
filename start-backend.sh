#!/bin/bash

# Quick start script for Athena backend services
# Uses simplified Docker setup without WASM compilation

set -e

echo "🚀 Starting Athena Backend Services (Development Mode)"
echo "===================================================="

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found. Creating from template..."
    cat > .env << EOF
# AI Provider Keys
CLAUDE_API_KEY=
DEEPSEEK_API_KEY=
OPENAI_API_KEY=

# Redis Configuration
REDIS_PASSWORD=

# Server Configuration
PORT=3000
NODE_ENV=development
EOF
    echo "✅ Created .env file. Please add your API keys."
fi

# Check if any API keys are set
if grep -q "API_KEY=$" .env; then
    echo ""
    echo "⚠️  WARNING: No API keys found in .env file"
    echo "   The API will start but AI features won't work."
    echo "   Add at least one API key to .env file:"
    echo "   - CLAUDE_API_KEY"
    echo "   - DEEPSEEK_API_KEY"
    echo "   - OPENAI_API_KEY"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Stop any existing containers
echo ""
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose.dev.yml down 2>/dev/null || true

# Start services
echo ""
echo "🐳 Starting Docker services..."
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready
echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Check service health
echo ""
echo "🔍 Checking service status..."
echo ""

# Check Redis
if docker-compose -f docker-compose.dev.yml exec -T redis redis-cli ping &> /dev/null; then
    echo "✅ Redis is running"
else
    echo "❌ Redis failed to start"
fi

# Check API
if curl -s http://localhost:3000/api/v1/health &> /dev/null; then
    echo "✅ API server is running"
else
    echo "⚠️  API server is still starting..."
fi

# Check Prometheus
if curl -s http://localhost:9091/metrics &> /dev/null; then
    echo "✅ Prometheus is running"
else
    echo "⚠️  Prometheus is still starting..."
fi

echo ""
echo "📊 Service URLs:"
echo "  - API Server: http://localhost:3000"
echo "  - API Health: http://localhost:3000/api/v1/health"
echo "  - Metrics: http://localhost:9090/metrics"
echo "  - Prometheus: http://localhost:9091"
echo ""
echo "📝 Useful commands:"
echo "  - View logs: docker-compose -f docker-compose.dev.yml logs -f"
echo "  - Stop services: docker-compose -f docker-compose.dev.yml down"
echo "  - Restart services: docker-compose -f docker-compose.dev.yml restart"
echo ""
echo "✅ Backend services are starting up!"
echo "   Check logs if services don't respond immediately."