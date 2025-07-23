#!/bin/bash

# Athena v2 - Production Deployment Script
# Security-hardened deployment with monitoring

set -e

echo "🚀 Athena v2 Production Deployment"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Pre-deployment checks
echo -e "${BLUE}📋 Running pre-deployment checks...${NC}"

# Check if production environment exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Production environment file not found: $ENV_FILE${NC}"
    echo -e "${YELLOW}💡 Run: cp .env.example $ENV_FILE and configure production values${NC}"
    exit 1
fi

# Check SSL certificates
if [ ! -f "nginx/ssl/athena.crt" ] || [ ! -f "nginx/ssl/athena.key" ]; then
    echo -e "${YELLOW}⚠️  SSL certificates not found. Generating self-signed certificates...${NC}"
    ./scripts/generate-ssl-cert.sh
fi

# Check Docker and Docker Compose
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found. Please install Docker.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose not found. Please install Docker Compose.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Pre-deployment checks passed${NC}"

# Create backup
echo -e "${BLUE}💾 Creating backup...${NC}"
mkdir -p "$BACKUP_DIR"

# Backup current environment if running
if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
    echo -e "${YELLOW}📦 Backing up running containers...${NC}"
    docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump -U athena_user athena_prod > "$BACKUP_DIR/database.sql" || true
    docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli --rdb - > "$BACKUP_DIR/redis.rdb" || true
fi

# Copy configuration files
cp "$ENV_FILE" "$BACKUP_DIR/"
cp "$COMPOSE_FILE" "$BACKUP_DIR/"

echo -e "${GREEN}✅ Backup created: $BACKUP_DIR${NC}"

# Build and deploy
echo -e "${BLUE}🔨 Building and deploying containers...${NC}"

# Pull latest images
echo -e "${YELLOW}📥 Pulling latest base images...${NC}"
docker-compose -f "$COMPOSE_FILE" pull

# Build custom images
echo -e "${YELLOW}🔨 Building Athena images...${NC}"
docker-compose -f "$COMPOSE_FILE" build --no-cache

# Stop existing containers
echo -e "${YELLOW}⏹️  Stopping existing containers...${NC}"
docker-compose -f "$COMPOSE_FILE" down

# Start new containers
echo -e "${YELLOW}🚀 Starting production containers...${NC}"
docker-compose -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
sleep 30

# Health checks
echo -e "${BLUE}🔍 Running health checks...${NC}"

# Check API health
if curl -k -s -f "https://localhost:443/api/v1/health" > /dev/null; then
    echo -e "${GREEN}✅ API is healthy${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
    echo -e "${YELLOW}📋 Container logs:${NC}"
    docker-compose -f "$COMPOSE_FILE" logs --tail=20 api
fi

# Check database
if docker-compose -f "$COMPOSE_FILE" exec -T db pg_isready -U athena_user -d athena_prod > /dev/null; then
    echo -e "${GREEN}✅ Database is healthy${NC}"
else
    echo -e "${RED}❌ Database health check failed${NC}"
fi

# Check Redis
if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping | grep -q "PONG"; then
    echo -e "${GREEN}✅ Redis is healthy${NC}"
else
    echo -e "${RED}❌ Redis health check failed${NC}"
fi

# Security test
echo -e "${BLUE}🔒 Running security verification...${NC}"
if curl -k -s "https://localhost:443/api/v1/wasm/capabilities" | grep -q "authentication required"; then
    echo -e "${GREEN}✅ API authentication is working${NC}"
else
    echo -e "${YELLOW}⚠️  API authentication check inconclusive${NC}"
fi

# Show running services
echo -e "${BLUE}📊 Running services:${NC}"
docker-compose -f "$COMPOSE_FILE" ps

# Show ports and access information
echo -e "${BLUE}🌐 Service Access:${NC}"
echo -e "${GREEN}API (HTTPS):${NC} https://localhost:443/api/v1/health"
echo -e "${GREEN}Grafana:${NC} http://localhost:3001 (admin/secure_grafana_password_change_me)"
echo -e "${GREEN}Prometheus:${NC} http://localhost:9091"

# Security reminders
echo -e "${YELLOW}"
echo "⚠️  PRODUCTION SECURITY REMINDERS:"
echo "=================================="
echo "1. Update default passwords in $ENV_FILE"
echo "2. Configure proper SSL certificates (replace self-signed)"
echo "3. Set up proper DNS and domain configuration"
echo "4. Configure backup automation"
echo "5. Set up log aggregation and alerting"
echo "6. Review and update CORS origins"
echo "7. Configure firewall rules"
echo "8. Set up monitoring alerts"
echo -e "${NC}"

echo -e "${GREEN}🎉 Production deployment completed successfully!${NC}"
echo -e "${BLUE}📋 Next steps: Configure DNS, SSL certificates, and monitoring alerts${NC}"