#!/bin/bash

# Athena v2 - System Restore Script
# Restore from automated backups

set -e

# Configuration
BACKUP_DIR="/var/backups/athena"
COMPOSE_FILE="docker-compose.production.yml"
LOG_FILE="/var/log/athena/restore-$(date +%Y%m%d_%H%M%S).log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Show usage
usage() {
    echo "Usage: $0 [OPTIONS] BACKUP_DATE"
    echo ""
    echo "Restore Athena system from backup"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -f, --file FILE     Restore from specific backup file"
    echo "  -c, --config-only   Restore configuration files only"
    echo "  -d, --database-only Restore database only"
    echo "  -r, --redis-only    Restore Redis only"
    echo "  --dry-run          Show what would be restored without executing"
    echo ""
    echo "Examples:"
    echo "  $0 20250707_143022                    # Restore from date folder"
    echo "  $0 -f athena_backup_20250707.tar.gz  # Restore from compressed backup"
    echo "  $0 -d 20250707_143022                 # Restore database only"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_DIR" 2>/dev/null | grep -E "^d.*20[0-9]{6}_[0-9]{6}" | awk '{print $9}' || echo "  No backups found"
    echo ""
    ls -la "$BACKUP_DIR" 2>/dev/null | grep "athena_backup_.*\.tar\.gz$" | awk '{print $9}' || echo "  No compressed backups found"
}

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Verify backup integrity
verify_backup() {
    local backup_path=$1
    
    log "${BLUE}🔍 Verifying backup integrity...${NC}"
    
    if [ -f "$backup_path.sha256" ]; then
        if cd "$(dirname "$backup_path")" && sha256sum -c "$(basename "$backup_path").sha256" > /dev/null 2>&1; then
            log "${GREEN}✅ Backup checksums are valid${NC}"
            return 0
        else
            log "${RED}❌ Backup checksums do not match${NC}"
            return 1
        fi
    else
        log "${YELLOW}⚠️  No checksum file found, skipping verification${NC}"
        return 0
    fi
}

# Extract compressed backup
extract_backup() {
    local backup_file=$1
    local extract_dir=$2
    
    log "${BLUE}📦 Extracting backup...${NC}"
    
    if [ ! -f "$backup_file" ]; then
        log "${RED}❌ Backup file not found: $backup_file${NC}"
        return 1
    fi
    
    # Verify before extracting
    if ! verify_backup "$backup_file"; then
        log "${RED}❌ Backup verification failed${NC}"
        return 1
    fi
    
    # Extract
    mkdir -p "$extract_dir"
    tar -xzf "$backup_file" -C "$extract_dir" --strip-components=1
    
    log "${GREEN}✅ Backup extracted to $extract_dir${NC}"
}

# Restore database
restore_database() {
    local backup_dir=$1
    
    log "${BLUE}🗄️  Restoring database...${NC}"
    
    if [ ! -f "$backup_dir/database_full.sql.gz" ]; then
        log "${RED}❌ Database backup not found${NC}"
        return 1
    fi
    
    # Stop application to prevent connections
    log "${YELLOW}⏹️  Stopping application services...${NC}"
    docker-compose -f "$COMPOSE_FILE" stop api
    
    # Wait for connections to close
    sleep 5
    
    # Drop existing database and recreate
    log "${YELLOW}🔄 Recreating database...${NC}"
    docker-compose -f "$COMPOSE_FILE" exec -T db psql -U athena_user -d postgres -c "DROP DATABASE IF EXISTS athena_prod;"
    docker-compose -f "$COMPOSE_FILE" exec -T db psql -U athena_user -d postgres -c "CREATE DATABASE athena_prod OWNER athena_user;"
    
    # Restore database
    log "${YELLOW}📥 Restoring database data...${NC}"
    gunzip -c "$backup_dir/database_full.sql.gz" | docker-compose -f "$COMPOSE_FILE" exec -T db psql -U athena_user -d athena_prod
    
    # Restart application
    log "${YELLOW}▶️  Restarting application services...${NC}"
    docker-compose -f "$COMPOSE_FILE" start api
    
    log "${GREEN}✅ Database restored successfully${NC}"
}

# Restore Redis
restore_redis() {
    local backup_dir=$1
    
    log "${BLUE}🔴 Restoring Redis...${NC}"
    
    if [ ! -f "$backup_dir/redis_dump.rdb" ]; then
        log "${RED}❌ Redis backup not found${NC}"
        return 1
    fi
    
    # Stop Redis to restore data
    log "${YELLOW}⏹️  Stopping Redis...${NC}"
    docker-compose -f "$COMPOSE_FILE" stop redis
    
    # Restore RDB file
    log "${YELLOW}📥 Restoring Redis data...${NC}"
    docker run --rm -v "$(pwd)_redis_data:/data" -v "$backup_dir:/backup" redis:7-alpine sh -c "cp /backup/redis_dump.rdb /data/dump.rdb"
    
    # Restart Redis
    log "${YELLOW}▶️  Restarting Redis...${NC}"
    docker-compose -f "$COMPOSE_FILE" start redis
    
    # Wait for Redis to start
    sleep 5
    
    # Verify Redis is running
    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping | grep -q "PONG"; then
        log "${GREEN}✅ Redis restored successfully${NC}"
    else
        log "${RED}❌ Redis restore failed${NC}"
        return 1
    fi
}

# Restore configuration
restore_config() {
    local backup_dir=$1
    
    log "${BLUE}⚙️  Restoring configuration...${NC}"
    
    if [ ! -d "$backup_dir/config" ]; then
        log "${RED}❌ Configuration backup not found${NC}"
        return 1
    fi
    
    # Backup current config
    mkdir -p "./config_backup_$(date +%Y%m%d_%H%M%S)"
    cp -r nginx/ monitoring/ database/ scripts/ *.yml .env.* prometheus.yml "./config_backup_$(date +%Y%m%d_%H%M%S)/" 2>/dev/null || true
    
    # Restore configuration files
    log "${YELLOW}📥 Restoring configuration files...${NC}"
    cp -r "$backup_dir/config/"* . 2>/dev/null || true
    
    # Set proper permissions
    chmod +x scripts/*.sh 2>/dev/null || true
    chmod 600 nginx/ssl/*.key 2>/dev/null || true
    
    log "${GREEN}✅ Configuration restored successfully${NC}"
}

# Restore SSL certificates
restore_ssl() {
    local backup_dir=$1
    
    log "${BLUE}🔒 Restoring SSL certificates...${NC}"
    
    if [ ! -d "$backup_dir/ssl" ]; then
        log "${YELLOW}⚠️  SSL backup not found, skipping${NC}"
        return 0
    fi
    
    # Create SSL directory
    mkdir -p nginx/ssl
    
    # Restore certificates
    cp "$backup_dir/ssl/"* nginx/ssl/ 2>/dev/null || true
    
    # Set proper permissions
    chmod 600 nginx/ssl/*.key 2>/dev/null || true
    chmod 644 nginx/ssl/*.crt nginx/ssl/*.pem 2>/dev/null || true
    
    log "${GREEN}✅ SSL certificates restored${NC}"
}

# Main restore function
main() {
    local backup_date=""
    local backup_file=""
    local config_only=false
    local database_only=false
    local redis_only=false
    local dry_run=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                usage
                exit 0
                ;;
            -f|--file)
                backup_file="$2"
                shift 2
                ;;
            -c|--config-only)
                config_only=true
                shift
                ;;
            -d|--database-only)
                database_only=true
                shift
                ;;
            -r|--redis-only)
                redis_only=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            *)
                backup_date="$1"
                shift
                ;;
        esac
    done
    
    # Validate arguments
    if [ -z "$backup_date" ] && [ -z "$backup_file" ]; then
        log "${RED}❌ No backup specified${NC}"
        usage
        exit 1
    fi
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log "${BLUE}🔄 Starting Athena Restore Process${NC}"
    log "Restore started at: $(date)"
    
    # Determine backup location
    local backup_dir=""
    local temp_dir=""
    
    if [ -n "$backup_file" ]; then
        # Restore from compressed backup
        if [[ "$backup_file" != /* ]]; then
            backup_file="$BACKUP_DIR/$backup_file"
        fi
        
        temp_dir="/tmp/athena_restore_$(date +%Y%m%d_%H%M%S)"
        extract_backup "$backup_file" "$temp_dir"
        backup_dir="$temp_dir"
    else
        # Restore from date directory
        backup_dir="$BACKUP_DIR/$backup_date"
        
        if [ ! -d "$backup_dir" ]; then
            log "${RED}❌ Backup directory not found: $backup_dir${NC}"
            exit 1
        fi
    fi
    
    # Verify backup exists and has components
    if [ ! -f "$backup_dir/backup_info.json" ]; then
        log "${YELLOW}⚠️  Backup metadata not found, proceeding anyway${NC}"
    else
        log "${BLUE}📋 Backup information:${NC}"
        cat "$backup_dir/backup_info.json" | jq . 2>/dev/null || cat "$backup_dir/backup_info.json"
    fi
    
    # Dry run mode
    if [ "$dry_run" = true ]; then
        log "${BLUE}🔍 DRY RUN MODE - Showing what would be restored:${NC}"
        
        [ -f "$backup_dir/database_full.sql.gz" ] && log "${GREEN}  ✓ Database backup found${NC}"
        [ -f "$backup_dir/redis_dump.rdb" ] && log "${GREEN}  ✓ Redis backup found${NC}"
        [ -d "$backup_dir/config" ] && log "${GREEN}  ✓ Configuration backup found${NC}"
        [ -d "$backup_dir/ssl" ] && log "${GREEN}  ✓ SSL certificates backup found${NC}"
        
        log "${BLUE}No changes were made (dry run mode)${NC}"
        exit 0
    fi
    
    # Confirmation prompt
    if [ "$config_only" = false ] && [ "$database_only" = false ] && [ "$redis_only" = false ]; then
        echo -e "${YELLOW}⚠️  This will restore the entire Athena system and may overwrite current data.${NC}"
        echo -e "${YELLOW}Are you sure you want to continue? (yes/no)${NC}"
        read -r confirmation
        if [ "$confirmation" != "yes" ]; then
            log "${BLUE}Restore cancelled by user${NC}"
            exit 0
        fi
    fi
    
    # Execute restore based on options
    local error_count=0
    
    if [ "$config_only" = true ]; then
        restore_config "$backup_dir" || ((error_count++))
        restore_ssl "$backup_dir" || ((error_count++))
    elif [ "$database_only" = true ]; then
        restore_database "$backup_dir" || ((error_count++))
    elif [ "$redis_only" = true ]; then
        restore_redis "$backup_dir" || ((error_count++))
    else
        # Full restore
        restore_config "$backup_dir" || ((error_count++))
        restore_ssl "$backup_dir" || ((error_count++))
        restore_database "$backup_dir" || ((error_count++))
        restore_redis "$backup_dir" || ((error_count++))
    fi
    
    # Cleanup temporary directory
    if [ -n "$temp_dir" ] && [ -d "$temp_dir" ]; then
        rm -rf "$temp_dir"
    fi
    
    # Final status
    if [ $error_count -eq 0 ]; then
        log "${GREEN}🎉 Restore completed successfully${NC}"
        log "${BLUE}💡 Remember to restart services if needed: docker-compose -f $COMPOSE_FILE restart${NC}"
    else
        log "${RED}❌ Restore completed with $error_count errors${NC}"
        exit 1
    fi
    
    log "Restore finished at: $(date)"
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi