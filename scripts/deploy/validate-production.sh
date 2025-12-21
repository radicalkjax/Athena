#!/bin/bash

# Athena v2 - Production Validation Script
# Comprehensive validation of production readiness

set -e

echo "🔍 Athena v2 Production Validation"
echo "================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
check_passed() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASSED++))
}

check_failed() {
    echo -e "${RED}❌ $1${NC}"
    ((FAILED++))
}

check_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

# 1. Environment Configuration Checks
echo -e "${BLUE}📋 1. Environment Configuration${NC}"

if [ -f ".env.production" ]; then
    check_passed "Production environment file exists"
    
    # Check for default/weak passwords
    if grep -q "change_me" .env.production; then
        check_failed "Default passwords found in .env.production"
    else
        check_passed "No default passwords found"
    fi
    
    # Check API key length
    if grep -E "API_KEY=.{64,}" .env.production > /dev/null; then
        check_passed "API keys are sufficiently long"
    else
        check_failed "API keys should be at least 64 characters"
    fi
    
    # Check JWT secret
    if grep -E "JWT_SECRET=.{64,}" .env.production > /dev/null; then
        check_passed "JWT secret is sufficiently long"
    else
        check_failed "JWT secret should be at least 64 characters"
    fi
else
    check_failed "Production environment file not found"
fi

# 2. SSL/TLS Configuration
echo -e "${BLUE}📋 2. SSL/TLS Configuration${NC}"

if [ -f "nginx/ssl/athena.crt" ] && [ -f "nginx/ssl/athena.key" ]; then
    check_passed "SSL certificates exist"
    
    # Check certificate validity
    if openssl x509 -in nginx/ssl/athena.crt -checkend 86400 > /dev/null 2>&1; then
        check_passed "SSL certificate is valid"
    else
        check_failed "SSL certificate is expired or invalid"
    fi
    
    # Check if self-signed
    if openssl x509 -in nginx/ssl/athena.crt -text | grep -q "Issuer.*Subject"; then
        check_warning "Using self-signed certificate (replace with CA certificate for production)"
    else
        check_passed "Using CA-signed certificate"
    fi
else
    check_failed "SSL certificates not found"
fi

# 3. Docker Configuration
echo -e "${BLUE}📋 3. Docker Configuration${NC}"

if [ -f "docker-compose.production.yml" ]; then
    check_passed "Production Docker Compose file exists"
    
    # Check for proper health checks
    if grep -q "healthcheck:" docker-compose.production.yml; then
        check_passed "Health checks configured"
    else
        check_warning "No health checks found in Docker Compose"
    fi
    
    # Check for resource limits
    if grep -q "limits:" docker-compose.production.yml; then
        check_passed "Resource limits configured"
    else
        check_warning "No resource limits configured"
    fi
else
    check_failed "Production Docker Compose file not found"
fi

# 4. Security Configuration
echo -e "${BLUE}📋 4. Security Configuration${NC}"

if [ -f "nginx/nginx.conf" ]; then
    check_passed "Nginx configuration exists"
    
    # Check for security headers
    if grep -q "X-Frame-Options" nginx/nginx.conf; then
        check_passed "Security headers configured"
    else
        check_failed "Security headers not configured"
    fi
    
    # Check for rate limiting
    if grep -q "limit_req" nginx/nginx.conf; then
        check_passed "Rate limiting configured"
    else
        check_failed "Rate limiting not configured"
    fi
    
    # Check SSL configuration
    if grep -q "ssl_protocols TLSv1.2 TLSv1.3" nginx/nginx.conf; then
        check_passed "Modern SSL protocols configured"
    else
        check_failed "SSL protocols not properly configured"
    fi
else
    check_failed "Nginx configuration not found"
fi

# 5. Monitoring Setup
echo -e "${BLUE}📋 5. Monitoring Setup${NC}"

if [ -d "monitoring/grafana" ]; then
    check_passed "Grafana monitoring configured"
else
    check_warning "Grafana monitoring not configured"
fi

if [ -f "prometheus.yml" ]; then
    check_passed "Prometheus configuration exists"
else
    check_warning "Prometheus configuration not found"
fi

# 6. Backup Strategy
echo -e "${BLUE}📋 6. Backup Strategy${NC}"

if grep -q "BACKUP_ENABLED=true" .env.production 2>/dev/null; then
    check_passed "Backup configuration enabled"
else
    check_warning "Backup strategy not configured"
fi

# 7. File Permissions
echo -e "${BLUE}📋 7. File Permissions${NC}"

if [ -f "nginx/ssl/athena.key" ]; then
    PERMS=$(stat -f "%A" nginx/ssl/athena.key 2>/dev/null || stat -c "%a" nginx/ssl/athena.key 2>/dev/null)
    if [ "$PERMS" = "600" ]; then
        check_passed "SSL private key has correct permissions (600)"
    else
        check_failed "SSL private key permissions should be 600, found: $PERMS"
    fi
fi

# 8. Script Permissions
echo -e "${BLUE}📋 8. Script Permissions${NC}"

for script in scripts/*.sh; do
    if [ -x "$script" ]; then
        check_passed "$(basename "$script") is executable"
    else
        check_warning "$(basename "$script") is not executable"
    fi
done

# 9. Production Dependencies
echo -e "${BLUE}📋 9. Production Dependencies${NC}"

# Check Docker
if command -v docker &> /dev/null; then
    check_passed "Docker is installed"
else
    check_failed "Docker is not installed"
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    check_passed "Docker Compose is installed"
else
    check_failed "Docker Compose is not installed"
fi

# Check OpenSSL
if command -v openssl &> /dev/null; then
    check_passed "OpenSSL is available"
else
    check_failed "OpenSSL is not available"
fi

# 10. Network Configuration Check
echo -e "${BLUE}📋 10. Network Configuration${NC}"

# Check if ports are available
if ! lsof -i :443 > /dev/null 2>&1; then
    check_passed "Port 443 (HTTPS) is available"
else
    check_warning "Port 443 is already in use"
fi

if ! lsof -i :80 > /dev/null 2>&1; then
    check_passed "Port 80 (HTTP) is available"
else
    check_warning "Port 80 is already in use"
fi

# Summary
echo -e "\n${BLUE}📊 Validation Summary${NC}"
echo "====================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failed: $FAILED${NC}"

if [ $FAILED -eq 0 ] && [ $WARNINGS -le 3 ]; then
    echo -e "\n${GREEN}🎉 Production deployment is READY!${NC}"
    echo -e "${BLUE}💡 Run: ./scripts/deploy-production.sh to deploy${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "\n${YELLOW}⚠️  Production deployment has warnings but can proceed${NC}"
    echo -e "${BLUE}💡 Address warnings before production deployment${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Production deployment is NOT ready${NC}"
    echo -e "${YELLOW}💡 Fix the failed checks before deploying${NC}"
    exit 1
fi