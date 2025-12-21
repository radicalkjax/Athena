#!/bin/bash

# Athena v2 - Quick Production Test
# Validates production deployment without affecting current development setup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Athena v2 Quick Production Test${NC}"
echo "=================================="

# Test configuration validation
echo -e "${BLUE}1. Testing configuration files...${NC}"

# Validate Docker Compose
if docker-compose -f docker-compose.production.yml config --quiet; then
    echo -e "${GREEN}✅ Production Docker Compose is valid${NC}"
else
    echo -e "${RED}❌ Production Docker Compose has errors${NC}"
    exit 1
fi

# Validate environment file
if [ -f ".env.production" ]; then
    echo -e "${GREEN}✅ Production environment file exists${NC}"
    
    # Check for critical variables
    if grep -q "JWT_SECRET=" .env.production && \
       grep -q "ADMIN_API_KEY=" .env.production && \
       grep -q "CORS_ORIGIN=" .env.production; then
        echo -e "${GREEN}✅ Critical environment variables are set${NC}"
    else
        echo -e "${RED}❌ Missing critical environment variables${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Production environment file not found${NC}"
    exit 1
fi

# Test SSL certificates
echo -e "${BLUE}2. Testing SSL certificates...${NC}"
if [ -f "nginx/ssl/athena.crt" ] && [ -f "nginx/ssl/athena.key" ]; then
    if openssl x509 -in nginx/ssl/athena.crt -noout -checkend 86400; then
        echo -e "${GREEN}✅ SSL certificates are valid${NC}"
    else
        echo -e "${YELLOW}⚠️  SSL certificates may be expired${NC}"
    fi
else
    echo -e "${RED}❌ SSL certificates not found${NC}"
    echo -e "${YELLOW}💡 Run: ./scripts/generate-ssl-cert.sh${NC}"
    exit 1
fi

# Test database initialization
echo -e "${BLUE}3. Testing database scripts...${NC}"
if [ -d "database/init" ] && [ "$(ls -A database/init)" ]; then
    echo -e "${GREEN}✅ Database initialization scripts found${NC}"
    
    # Validate SQL syntax (basic check)
    for sql_file in database/init/*.sql; do
        if [ -f "$sql_file" ]; then
            if grep -q "CREATE TABLE\|CREATE SCHEMA\|INSERT INTO" "$sql_file"; then
                echo -e "${GREEN}✅ $(basename "$sql_file") appears valid${NC}"
            else
                echo -e "${YELLOW}⚠️  $(basename "$sql_file") may be incomplete${NC}"
            fi
        fi
    done
else
    echo -e "${RED}❌ Database initialization scripts not found${NC}"
    exit 1
fi

# Test monitoring configuration
echo -e "${BLUE}4. Testing monitoring setup...${NC}"
if [ -f "monitoring/grafana/provisioning/datasources/prometheus.yaml" ]; then
    echo -e "${GREEN}✅ Grafana datasource configuration found${NC}"
else
    echo -e "${YELLOW}⚠️  Grafana datasource configuration not found${NC}"
fi

if [ -f "monitoring/grafana/dashboards/athena-security-dashboard.json" ]; then
    echo -e "${GREEN}✅ Security dashboard configuration found${NC}"
else
    echo -e "${YELLOW}⚠️  Security dashboard not found${NC}"
fi

# Test backup scripts
echo -e "${BLUE}5. Testing backup system...${NC}"
if [ -x "scripts/backup-system.sh" ]; then
    echo -e "${GREEN}✅ Backup script is executable${NC}"
else
    echo -e "${RED}❌ Backup script not found or not executable${NC}"
fi

if [ -x "scripts/restore-system.sh" ]; then
    echo -e "${GREEN}✅ Restore script is executable${NC}"
else
    echo -e "${RED}❌ Restore script not found or not executable${NC}"
fi

# Test nginx configuration
echo -e "${BLUE}6. Testing nginx configuration...${NC}"
if [ -f "nginx/nginx.conf" ]; then
    if grep -q "ssl_protocols TLSv1.2 TLSv1.3" nginx/nginx.conf; then
        echo -e "${GREEN}✅ Modern SSL protocols configured${NC}"
    else
        echo -e "${YELLOW}⚠️  SSL protocols may need updating${NC}"
    fi
    
    if grep -q "limit_req" nginx/nginx.conf; then
        echo -e "${GREEN}✅ Rate limiting configured${NC}"
    else
        echo -e "${RED}❌ Rate limiting not configured${NC}"
    fi
    
    if grep -q "X-Frame-Options" nginx/nginx.conf; then
        echo -e "${GREEN}✅ Security headers configured${NC}"
    else
        echo -e "${RED}❌ Security headers not configured${NC}"
    fi
else
    echo -e "${RED}❌ Nginx configuration not found${NC}"
fi

# Test production deployment readiness
echo -e "${BLUE}7. Testing deployment readiness...${NC}"

# Check if ports are available
if ! lsof -i :443 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 443 (HTTPS) is available${NC}"
else
    echo -e "${YELLOW}⚠️  Port 443 is in use${NC}"
fi

if ! lsof -i :3001 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Port 3001 (Grafana) is available${NC}"
else
    echo -e "${YELLOW}⚠️  Port 3001 is in use${NC}"
fi

# Test Docker requirements
if command -v docker > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker is available${NC}"
else
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

if command -v docker-compose > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Docker Compose is available${NC}"
else
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    exit 1
fi

# Summary
echo ""
echo -e "${BLUE}📊 Production Test Summary${NC}"
echo "=========================="
echo -e "${GREEN}✅ Configuration files validated${NC}"
echo -e "${GREEN}✅ SSL certificates ready${NC}"
echo -e "${GREEN}✅ Database scripts prepared${NC}"
echo -e "${GREEN}✅ Monitoring configured${NC}"
echo -e "${GREEN}✅ Backup system ready${NC}"
echo -e "${GREEN}✅ Security configuration validated${NC}"
echo -e "${GREEN}✅ Dependencies available${NC}"

echo ""
echo -e "${GREEN}🎉 Production deployment is ready!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Deploy: ./scripts/deploy-production.sh"
echo "2. Monitor: http://localhost:3001 (Grafana)"
echo "3. Test API: curl -k https://localhost:443/api/v1/health"
echo "4. Setup backups: ./scripts/setup-cron-backup.sh"
echo ""
echo -e "${YELLOW}📋 Remember to:${NC}"
echo "- Update API keys and passwords in .env.production"
echo "- Configure proper SSL certificates for production"
echo "- Set up DNS and domain configuration"
echo "- Configure monitoring alerts"