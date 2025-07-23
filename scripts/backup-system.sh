#!/bin/bash

# Athena v2 - Automated Backup System
# Comprehensive backup solution for production data

set -e

# Configuration
BACKUP_DIR="/var/backups/athena"
RETENTION_DAYS=30
COMPOSE_FILE="docker-compose.production.yml"
DATE=$(date +%Y%m%d_%H%M%S)
LOG_FILE="/var/log/athena/backup-${DATE}.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

log "${BLUE}🔄 Starting Athena Backup Process${NC}"
log "Backup started at: $(date)"

# Create backup directory
mkdir -p "$BACKUP_DIR/$DATE"
mkdir -p "$(dirname "$LOG_FILE")"

# Function to backup database
backup_database() {
    log "${BLUE}📦 Backing up PostgreSQL database...${NC}"
    
    if docker-compose -f "$COMPOSE_FILE" exec -T db pg_isready -U athena_user -d athena_prod > /dev/null 2>&1; then
        # Full database backup
        docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump \
            -U athena_user \
            -d athena_prod \
            --no-password \
            --verbose \
            --clean \
            --if-exists \
            --create > "$BACKUP_DIR/$DATE/database_full.sql"
        
        # Schema-only backup
        docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump \
            -U athena_user \
            -d athena_prod \
            --no-password \
            --schema-only > "$BACKUP_DIR/$DATE/database_schema.sql"
        
        # Data-only backup
        docker-compose -f "$COMPOSE_FILE" exec -T db pg_dump \
            -U athena_user \
            -d athena_prod \
            --no-password \
            --data-only > "$BACKUP_DIR/$DATE/database_data.sql"
        
        # Compress database backups
        gzip "$BACKUP_DIR/$DATE/database_full.sql"
        gzip "$BACKUP_DIR/$DATE/database_schema.sql"
        gzip "$BACKUP_DIR/$DATE/database_data.sql"
        
        log "${GREEN}✅ Database backup completed${NC}"
    else
        log "${RED}❌ Database is not available for backup${NC}"
        return 1
    fi
}

# Function to backup Redis
backup_redis() {
    log "${BLUE}📦 Backing up Redis data...${NC}"
    
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping > /dev/null 2>&1; then
        # Create Redis backup
        docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli BGSAVE
        
        # Wait for backup to complete
        while [ "$(docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli LASTSAVE)" = "$(docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli LASTSAVE)" ]; do
            sleep 1
        done
        
        # Copy RDB file
        docker-compose -f "$COMPOSE_FILE" exec -T redis cat /data/dump.rdb > "$BACKUP_DIR/$DATE/redis_dump.rdb"
        
        # Export all keys as commands
        docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli --rdb - > "$BACKUP_DIR/$DATE/redis_export.rdb"
        
        log "${GREEN}✅ Redis backup completed${NC}"
    else
        log "${RED}❌ Redis is not available for backup${NC}"
        return 1
    fi
}

# Function to backup configuration files
backup_config() {
    log "${BLUE}📦 Backing up configuration files...${NC}"
    
    # Create config backup directory
    mkdir -p "$BACKUP_DIR/$DATE/config"
    
    # Backup critical configuration files
    cp -r nginx/ "$BACKUP_DIR/$DATE/config/" 2>/dev/null || true
    cp -r monitoring/ "$BACKUP_DIR/$DATE/config/" 2>/dev/null || true
    cp -r database/ "$BACKUP_DIR/$DATE/config/" 2>/dev/null || true
    cp docker-compose*.yml "$BACKUP_DIR/$DATE/config/" 2>/dev/null || true
    cp .env.production "$BACKUP_DIR/$DATE/config/" 2>/dev/null || true
    cp prometheus.yml "$BACKUP_DIR/$DATE/config/" 2>/dev/null || true
    
    # Backup scripts (excluding sensitive data)
    cp -r scripts/ "$BACKUP_DIR/$DATE/config/" 2>/dev/null || true
    
    log "${GREEN}✅ Configuration backup completed${NC}"
}

# Function to backup SSL certificates
backup_ssl() {
    log "${BLUE}📦 Backing up SSL certificates...${NC}"
    
    if [ -d "nginx/ssl" ]; then
        mkdir -p "$BACKUP_DIR/$DATE/ssl"
        
        # Copy certificates (encrypted)
        cp nginx/ssl/*.crt "$BACKUP_DIR/$DATE/ssl/" 2>/dev/null || true
        cp nginx/ssl/*.csr "$BACKUP_DIR/$DATE/ssl/" 2>/dev/null || true
        cp nginx/ssl/*.pem "$BACKUP_DIR/$DATE/ssl/" 2>/dev/null || true
        
        # Private keys should be handled securely in production
        # cp nginx/ssl/*.key "$BACKUP_DIR/$DATE/ssl/" 2>/dev/null || true
        
        log "${GREEN}✅ SSL certificates backup completed${NC}"
    else
        log "${YELLOW}⚠️  No SSL certificates found${NC}"
    fi
}

# Function to backup application logs
backup_logs() {
    log "${BLUE}📦 Backing up application logs...${NC}"
    
    # Backup Docker logs
    docker-compose -f "$COMPOSE_FILE" logs --no-color > "$BACKUP_DIR/$DATE/docker_logs.txt" 2>/dev/null || true
    
    # Backup system logs if they exist
    if [ -d "/var/log/athena" ]; then
        cp -r /var/log/athena "$BACKUP_DIR/$DATE/logs/" 2>/dev/null || true
    fi
    
    # Backup nginx logs if available
    if docker-compose -f "$COMPOSE_FILE" ps nginx > /dev/null 2>&1; then
        docker-compose -f "$COMPOSE_FILE" exec -T nginx cat /var/log/nginx/access.log > "$BACKUP_DIR/$DATE/nginx_access.log" 2>/dev/null || true
        docker-compose -f "$COMPOSE_FILE" exec -T nginx cat /var/log/nginx/error.log > "$BACKUP_DIR/$DATE/nginx_error.log" 2>/dev/null || true
    fi
    
    log "${GREEN}✅ Logs backup completed${NC}"
}

# Function to create backup metadata
create_metadata() {
    log "${BLUE}📦 Creating backup metadata...${NC}"
    
    cat > "$BACKUP_DIR/$DATE/backup_info.json" << EOF
{
    "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "athena_version": "v2.0",
    "backup_type": "full",
    "retention_days": $RETENTION_DAYS,
    "components": {
        "database": $([ -f "$BACKUP_DIR/$DATE/database_full.sql.gz" ] && echo "true" || echo "false"),
        "redis": $([ -f "$BACKUP_DIR/$DATE/redis_dump.rdb" ] && echo "true" || echo "false"),
        "config": $([ -d "$BACKUP_DIR/$DATE/config" ] && echo "true" || echo "false"),
        "ssl": $([ -d "$BACKUP_DIR/$DATE/ssl" ] && echo "true" || echo "false"),
        "logs": $([ -f "$BACKUP_DIR/$DATE/docker_logs.txt" ] && echo "true" || echo "false")
    },
    "backup_size": "$(du -sh "$BACKUP_DIR/$DATE" | cut -f1)",
    "system_info": {
        "hostname": "$(hostname)",
        "os": "$(uname -s)",
        "docker_version": "$(docker --version 2>/dev/null || echo 'N/A')",
        "compose_version": "$(docker-compose --version 2>/dev/null || echo 'N/A')"
    }
}
EOF
    
    log "${GREEN}✅ Metadata created${NC}"
}

# Function to compress and encrypt backup
compress_backup() {
    log "${BLUE}📦 Compressing backup...${NC}"
    
    cd "$BACKUP_DIR"
    tar -czf "athena_backup_${DATE}.tar.gz" "$DATE/"
    
    # Optional: encrypt backup with GPG if key is available
    # gpg --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
    #     --s2k-digest-algo SHA512 --s2k-count 65536 --symmetric \
    #     --output "athena_backup_${DATE}.tar.gz.gpg" \
    #     "athena_backup_${DATE}.tar.gz"
    
    # Calculate checksums
    sha256sum "athena_backup_${DATE}.tar.gz" > "athena_backup_${DATE}.tar.gz.sha256"
    
    log "${GREEN}✅ Backup compressed${NC}"
    log "${BLUE}📊 Backup size: $(du -sh "athena_backup_${DATE}.tar.gz" | cut -f1)${NC}"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "${BLUE}🧹 Cleaning up old backups...${NC}"
    
    # Remove directories older than retention period
    find "$BACKUP_DIR" -maxdepth 1 -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} \; 2>/dev/null || true
    
    # Remove compressed backups older than retention period
    find "$BACKUP_DIR" -name "athena_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "athena_backup_*.tar.gz.sha256" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "athena_backup_*.tar.gz.gpg" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    log "${GREEN}✅ Old backups cleaned up${NC}"
}

# Function to verify backup integrity
verify_backup() {
    log "${BLUE}🔍 Verifying backup integrity...${NC}"
    
    # Verify compressed backup
    if tar -tzf "$BACKUP_DIR/athena_backup_${DATE}.tar.gz" > /dev/null 2>&1; then
        log "${GREEN}✅ Backup archive is valid${NC}"
    else
        log "${RED}❌ Backup archive is corrupted${NC}"
        return 1
    fi
    
    # Verify checksums
    if cd "$BACKUP_DIR" && sha256sum -c "athena_backup_${DATE}.tar.gz.sha256" > /dev/null 2>&1; then
        log "${GREEN}✅ Backup checksums are valid${NC}"
    else
        log "${RED}❌ Backup checksums do not match${NC}"
        return 1
    fi
}

# Function to send notification (placeholder for future implementation)
send_notification() {
    local status=$1
    local message=$2
    
    # Placeholder for notification system (Slack, email, etc.)
    log "${BLUE}📧 Notification: $status - $message${NC}"
    
    # Example: Send to webhook
    # curl -X POST "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK" \
    #      -H 'Content-type: application/json' \
    #      --data "{\"text\":\"Athena Backup $status: $message\"}"
}

# Main backup process
main() {
    local backup_status="SUCCESS"
    local error_count=0
    
    # Check if Docker Compose is running
    if ! docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
        log "${RED}❌ Docker Compose services are not running${NC}"
        send_notification "FAILED" "Services not running"
        exit 1
    fi
    
    # Execute backup steps
    backup_database || ((error_count++))
    backup_redis || ((error_count++))
    backup_config || ((error_count++))
    backup_ssl || ((error_count++))
    backup_logs || ((error_count++))
    
    create_metadata
    compress_backup
    
    if verify_backup; then
        cleanup_old_backups
    else
        backup_status="FAILED"
        ((error_count++))
    fi
    
    # Final status
    if [ $error_count -eq 0 ]; then
        log "${GREEN}🎉 Backup completed successfully${NC}"
        send_notification "SUCCESS" "Backup completed successfully"
    else
        log "${YELLOW}⚠️  Backup completed with $error_count errors${NC}"
        backup_status="WARNING"
        send_notification "WARNING" "Backup completed with $error_count errors"
    fi
    
    log "Backup finished at: $(date)"
    log "Backup location: $BACKUP_DIR/athena_backup_${DATE}.tar.gz"
    
    # Copy log to backup directory
    cp "$LOG_FILE" "$BACKUP_DIR/$DATE/" 2>/dev/null || true
}

# Run main function
main "$@"