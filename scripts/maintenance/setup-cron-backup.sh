#!/bin/bash

# Athena v2 - Automated Backup Cron Setup
# Sets up automated backups with cron scheduling

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-system.sh"
CRON_USER="${CRON_USER:-root}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}⏰ Setting up Athena Automated Backups${NC}"
echo "======================================"

# Check if backup script exists
if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo -e "${RED}❌ Backup script not found: $BACKUP_SCRIPT${NC}"
    exit 1
fi

# Make sure backup script is executable
chmod +x "$BACKUP_SCRIPT"

# Backup schedule options
show_schedule_options() {
    echo ""
    echo -e "${BLUE}Select backup schedule:${NC}"
    echo "1) Daily at 2:00 AM"
    echo "2) Daily at 3:00 AM"
    echo "3) Every 6 hours"
    echo "4) Every 12 hours"
    echo "5) Weekly (Sunday at 2:00 AM)"
    echo "6) Custom schedule"
    echo "7) Show current cron jobs"
    echo "8) Remove backup schedule"
    echo ""
}

# Get cron expression for schedule
get_cron_expression() {
    local choice=$1
    
    case $choice in
        1) echo "0 2 * * *" ;;           # Daily at 2:00 AM
        2) echo "0 3 * * *" ;;           # Daily at 3:00 AM
        3) echo "0 */6 * * *" ;;         # Every 6 hours
        4) echo "0 */12 * * *" ;;        # Every 12 hours
        5) echo "0 2 * * 0" ;;           # Weekly on Sunday at 2:00 AM
        6) 
            echo -e "${YELLOW}Enter custom cron expression (e.g., '0 2 * * *' for daily at 2 AM):${NC}"
            read -r custom_cron
            echo "$custom_cron"
            ;;
        *) echo "" ;;
    esac
}

# Install cron job
install_cron_job() {
    local cron_expression=$1
    local job_comment="# Athena v2 Automated Backup"
    local job_command="$cron_expression $BACKUP_SCRIPT >> /var/log/athena/cron-backup.log 2>&1"
    
    echo -e "${BLUE}📅 Installing cron job...${NC}"
    
    # Create log directory
    mkdir -p /var/log/athena
    
    # Remove existing Athena backup jobs
    (crontab -l 2>/dev/null | grep -v "# Athena v2 Automated Backup" | grep -v "$BACKUP_SCRIPT") | crontab -
    
    # Add new cron job
    (crontab -l 2>/dev/null; echo "$job_comment"; echo "$job_command") | crontab -
    
    echo -e "${GREEN}✅ Cron job installed successfully${NC}"
    echo -e "${BLUE}Schedule: $cron_expression${NC}"
    echo -e "${BLUE}Command: $BACKUP_SCRIPT${NC}"
    echo -e "${BLUE}Log file: /var/log/athena/cron-backup.log${NC}"
}

# Remove cron job
remove_cron_job() {
    echo -e "${BLUE}🗑️  Removing Athena backup cron jobs...${NC}"
    
    # Remove Athena backup jobs
    (crontab -l 2>/dev/null | grep -v "# Athena v2 Automated Backup" | grep -v "$BACKUP_SCRIPT") | crontab -
    
    echo -e "${GREEN}✅ Athena backup cron jobs removed${NC}"
}

# Show current cron jobs
show_current_jobs() {
    echo -e "${BLUE}📋 Current cron jobs for user $USER:${NC}"
    echo "=================================="
    
    if crontab -l 2>/dev/null; then
        echo ""
        echo -e "${BLUE}Athena backup jobs:${NC}"
        crontab -l 2>/dev/null | grep -E "(Athena|$BACKUP_SCRIPT)" || echo "No Athena backup jobs found"
    else
        echo "No cron jobs found"
    fi
    echo ""
}

# Test backup script
test_backup_script() {
    echo -e "${BLUE}🧪 Testing backup script...${NC}"
    
    if [ ! -f "$BACKUP_SCRIPT" ]; then
        echo -e "${RED}❌ Backup script not found${NC}"
        return 1
    fi
    
    if [ ! -x "$BACKUP_SCRIPT" ]; then
        echo -e "${RED}❌ Backup script is not executable${NC}"
        return 1
    fi
    
    # Test dry run (if supported)
    echo -e "${YELLOW}Running backup script test...${NC}"
    if "$BACKUP_SCRIPT" --help > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backup script is functional${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot test backup script (no --help option)${NC}"
    fi
    
    # Check dependencies
    echo -e "${BLUE}Checking dependencies...${NC}"
    
    command -v docker >/dev/null 2>&1 && echo -e "${GREEN}✅ Docker available${NC}" || echo -e "${RED}❌ Docker not found${NC}"
    command -v docker-compose >/dev/null 2>&1 && echo -e "${GREEN}✅ Docker Compose available${NC}" || echo -e "${RED}❌ Docker Compose not found${NC}"
    command -v crontab >/dev/null 2>&1 && echo -e "${GREEN}✅ Crontab available${NC}" || echo -e "${RED}❌ Crontab not found${NC}"
    
    # Check backup directory permissions
    local backup_dir="/var/backups/athena"
    if mkdir -p "$backup_dir" 2>/dev/null; then
        echo -e "${GREEN}✅ Backup directory accessible${NC}"
    else
        echo -e "${RED}❌ Cannot create backup directory: $backup_dir${NC}"
    fi
}

# Setup logrotate for backup logs
setup_logrotate() {
    echo -e "${BLUE}📜 Setting up log rotation...${NC}"
    
    local logrotate_config="/etc/logrotate.d/athena-backup"
    
    if [ -w "/etc/logrotate.d" ]; then
        cat > "$logrotate_config" << 'EOF'
/var/log/athena/cron-backup.log
/var/log/athena/backup-*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        /bin/systemctl reload rsyslog > /dev/null 2>&1 || true
    endscript
}
EOF
        echo -e "${GREEN}✅ Logrotate configuration created${NC}"
    else
        echo -e "${YELLOW}⚠️  Cannot create logrotate config (insufficient permissions)${NC}"
        echo -e "${YELLOW}💡 Manually create $logrotate_config with appropriate permissions${NC}"
    fi
}

# Main menu
main() {
    # Check if running as root for system-wide cron
    if [ "$EUID" -ne 0 ] && [ "$CRON_USER" = "root" ]; then
        echo -e "${YELLOW}⚠️  Running as non-root user. Cron job will be installed for user: $USER${NC}"
        echo -e "${YELLOW}💡 Run with sudo for system-wide installation${NC}"
        echo ""
    fi
    
    while true; do
        show_schedule_options
        echo -e "${BLUE}Enter your choice (1-8): ${NC}"
        read -r choice
        
        case $choice in
            1|2|3|4|5|6)
                cron_expr=$(get_cron_expression "$choice")
                if [ -n "$cron_expr" ]; then
                    install_cron_job "$cron_expr"
                    setup_logrotate
                    echo ""
                    echo -e "${GREEN}🎉 Automated backup setup complete!${NC}"
                    echo ""
                    echo -e "${BLUE}Next steps:${NC}"
                    echo "1. Monitor backup logs: tail -f /var/log/athena/cron-backup.log"
                    echo "2. Test manual backup: $BACKUP_SCRIPT"
                    echo "3. Verify backup files in: /var/backups/athena"
                    echo ""
                    break
                else
                    echo -e "${RED}❌ Invalid cron expression${NC}"
                fi
                ;;
            7)
                show_current_jobs
                ;;
            8)
                remove_cron_job
                ;;
            *)
                echo -e "${RED}❌ Invalid choice${NC}"
                ;;
        esac
    done
}

# Show help
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Athena v2 - Automated Backup Setup"
    echo ""
    echo "This script sets up automated backups using cron."
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --help, -h     Show this help message"
    echo "  --test         Test backup script functionality"
    echo "  --show         Show current cron jobs"
    echo "  --remove       Remove backup cron jobs"
    echo ""
    echo "Environment Variables:"
    echo "  CRON_USER      User to install cron job for (default: root)"
    echo ""
    exit 0
fi

# Handle command line options
case "$1" in
    --test)
        test_backup_script
        exit $?
        ;;
    --show)
        show_current_jobs
        exit 0
        ;;
    --remove)
        remove_cron_job
        exit 0
        ;;
    *)
        test_backup_script
        echo ""
        main
        ;;
esac