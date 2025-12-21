#!/bin/bash
# Athena Anti-Evasion Tier 1: Environment Obfuscation
# This script runs before sample execution to make the sandbox
# appear as a legitimate user workstation.

set -e

echo "[ANTI-EVASION] Starting environment obfuscation..."

# ============================================
# HIDE DOCKER/VM ARTIFACTS
# ============================================

hide_docker_artifacts() {
    # Remove obvious Docker markers
    if [ -f /.dockerenv ]; then
        rm -f /.dockerenv 2>/dev/null || true
    fi

    # Hide cgroup Docker markers (requires privileges)
    for cgroup in /sys/fs/cgroup/*/docker; do
        if [ -d "$cgroup" ]; then
            chmod 000 "$cgroup" 2>/dev/null || true
        fi
    done

    echo "[ANTI-EVASION] Docker artifacts hidden"
}

hide_vm_proc() {
    # Note: Fully hiding /proc entries requires mount namespace
    # This is a best-effort approach

    # Check for hypervisor flag
    if grep -q "hypervisor" /proc/cpuinfo 2>/dev/null; then
        echo "[ANTI-EVASION] Warning: hypervisor flag in cpuinfo (cannot hide without kernel module)"
    fi

    echo "[ANTI-EVASION] VM proc artifacts processed"
}

# ============================================
# RANDOMIZE MAC ADDRESS
# ============================================

randomize_mac() {
    # Realistic vendor prefixes (Dell, HP, Lenovo, ASUS, Intel)
    local VENDORS=("00:1E:4F" "00:1C:42" "D4:3D:7E" "A4:1F:72" "00:1A:A0" "3C:52:82")
    local VENDOR=${VENDORS[$RANDOM % ${#VENDORS[@]}]}
    local SUFFIX=$(printf '%02X:%02X:%02X' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
    local NEW_MAC="$VENDOR:$SUFFIX"

    # Try to change MAC on available interfaces
    for iface in eth0 ens33 enp0s3 enp0s31f6; do
        if ip link show "$iface" &>/dev/null; then
            ip link set "$iface" down 2>/dev/null || true
            ip link set "$iface" address "$NEW_MAC" 2>/dev/null || true
            ip link set "$iface" up 2>/dev/null || true
            echo "[ANTI-EVASION] MAC changed to $NEW_MAC on $iface"
            return 0
        fi
    done

    echo "[ANTI-EVASION] No network interface found to modify"
}

# ============================================
# CREATE REALISTIC USER ENVIRONMENT
# ============================================

create_user_files() {
    local USER_HOME="/home/sandbox"

    # Create standard user directories
    mkdir -p "$USER_HOME"/{Desktop,Documents,Downloads,Pictures,Music,Videos,.config,.local/share}

    # Create fake browser profile (Chrome-like)
    mkdir -p "$USER_HOME/.config/google-chrome/Default"
    cat > "$USER_HOME/.config/google-chrome/Default/Bookmarks" << 'EOF'
{
   "checksum": "abcd1234",
   "roots": {
      "bookmark_bar": {
         "children": [
            {"name": "Google", "type": "url", "url": "https://www.google.com/"},
            {"name": "YouTube", "type": "url", "url": "https://www.youtube.com/"},
            {"name": "Amazon", "type": "url", "url": "https://www.amazon.com/"},
            {"name": "Facebook", "type": "url", "url": "https://www.facebook.com/"},
            {"name": "GitHub", "type": "url", "url": "https://www.github.com/"},
            {"name": "Gmail", "type": "url", "url": "https://mail.google.com/"}
         ],
         "name": "Bookmarks Bar",
         "type": "folder"
      }
   }
}
EOF

    # Create fake browsing history
    cat > "$USER_HOME/.config/google-chrome/Default/History.txt" << 'EOF'
2025-12-18 09:15:00 https://www.google.com - Google Search
2025-12-18 09:20:00 https://mail.google.com - Gmail
2025-12-18 10:00:00 https://www.youtube.com/watch?v=abc123 - YouTube
2025-12-18 11:30:00 https://www.amazon.com - Shopping
2025-12-18 14:00:00 https://github.com/user/project - GitHub
2025-12-18 15:45:00 https://www.linkedin.com - LinkedIn
2025-12-19 08:30:00 https://news.google.com - News
2025-12-19 09:00:00 https://www.reddit.com/r/technology - Reddit
EOF

    # Create realistic documents
    cat > "$USER_HOME/Documents/meeting_notes.txt" << 'EOF'
Meeting Notes - December 2025

Attendees: John, Sarah, Mike, Lisa

Agenda:
1. Q4 Review
2. 2026 Planning
3. Budget Discussion

Action Items:
- John: Finalize report by Friday
- Sarah: Schedule follow-up meeting
- Mike: Update project timeline
EOF

    cat > "$USER_HOME/Documents/todo_list.txt" << 'EOF'
TODO List:
- [ ] Finish quarterly report
- [ ] Call dentist for appointment
- [ ] Buy groceries
- [x] Update laptop software
- [ ] Review team feedback
- [ ] Plan vacation for March
EOF

    # Create fake password file (honeypot)
    cat > "$USER_HOME/Documents/passwords.txt" << 'EOF'
Email: myemail@gmail.com / Summer2025!
Bank: checking123 / Banking#456
Work VPN: jsmith / Corp@ccess2025
Amazon: john.smith / ShopNow$99
EOF

    # Create some image placeholders
    dd if=/dev/urandom of="$USER_HOME/Pictures/vacation_2025.jpg" bs=1024 count=50 2>/dev/null || true
    dd if=/dev/urandom of="$USER_HOME/Pictures/family_photo.png" bs=1024 count=30 2>/dev/null || true
    dd if=/dev/urandom of="$USER_HOME/Pictures/screenshot_2025.png" bs=1024 count=20 2>/dev/null || true

    # Create downloads
    dd if=/dev/urandom of="$USER_HOME/Downloads/invoice_12345.pdf" bs=1024 count=25 2>/dev/null || true
    dd if=/dev/urandom of="$USER_HOME/Downloads/presentation.pptx" bs=1024 count=100 2>/dev/null || true
    touch "$USER_HOME/Downloads/setup_latest.exe"

    # Create bash history
    cat > "$USER_HOME/.bash_history" << 'EOF'
cd Documents
ls -la
cat meeting_notes.txt
google-chrome &
code .
git status
git pull origin main
npm install
docker ps
sudo apt update
ping google.com
curl https://api.example.com/status
ssh user@server.example.com
EOF

    # Create .bashrc
    cat > "$USER_HOME/.bashrc" << 'EOF'
# ~/.bashrc
export PATH=$PATH:/usr/local/bin
alias ll='ls -la'
alias gs='git status'
alias gp='git pull'
export EDITOR=vim
PS1='[\u@\h \W]\$ '
EOF

    # Set proper ownership
    chown -R sandbox:sandbox "$USER_HOME" 2>/dev/null || true

    echo "[ANTI-EVASION] User files created in $USER_HOME"
}

# ============================================
# SET REALISTIC HOSTNAME
# ============================================

set_realistic_hostname() {
    local HOSTNAMES=(
        "DESKTOP-${RANDOM}ABC"
        "LAPTOP-WORK-PC"
        "WORKSTATION-01"
        "WIN-ENTERPRISE"
        "PC-JOHN-HOME"
        "DESKTOP-CORP-IT"
    )
    local NEW_HOSTNAME=${HOSTNAMES[$RANDOM % ${#HOSTNAMES[@]}]}

    hostname "$NEW_HOSTNAME" 2>/dev/null || true
    echo "$NEW_HOSTNAME" > /etc/hostname 2>/dev/null || true

    # Update /etc/hosts
    if [ -f /etc/hosts ]; then
        sed -i "s/127.0.1.1.*/127.0.1.1\t$NEW_HOSTNAME/" /etc/hosts 2>/dev/null || true
    fi

    echo "[ANTI-EVASION] Hostname set to $NEW_HOSTNAME"
}

# ============================================
# SPAWN FAKE PROCESSES
# ============================================

spawn_fake_processes() {
    # Spawn background processes that mimic common applications
    # These just sleep but appear in process list

    # Fake Chrome process
    (while true; do sleep 3600; done) &
    CHROME_PID=$!
    echo "chrome" > /proc/$CHROME_PID/comm 2>/dev/null || true

    # Fake system processes
    (while true; do sleep 3600; done) &
    echo "svchost.exe" > /proc/$!/comm 2>/dev/null || true

    (while true; do sleep 3600; done) &
    echo "explorer.exe" > /proc/$!/comm 2>/dev/null || true

    (while true; do sleep 3600; done) &
    echo "csrss.exe" > /proc/$!/comm 2>/dev/null || true

    (while true; do sleep 3600; done) &
    echo "lsass.exe" > /proc/$!/comm 2>/dev/null || true

    (while true; do sleep 3600; done) &
    echo "services.exe" > /proc/$!/comm 2>/dev/null || true

    # Store PIDs for cleanup
    echo $CHROME_PID > /tmp/fake_processes.pids

    echo "[ANTI-EVASION] Fake processes spawned"
}

# ============================================
# SET ENVIRONMENT VARIABLES
# ============================================

set_environment() {
    # Set variables that malware might check
    export USERNAME="John"
    export USER="John"
    export COMPUTERNAME="DESKTOP-WORK01"
    export USERDOMAIN="CORP"
    export LOGONSERVER="\\\\DC01"
    export HOMEPATH="\\Users\\John"
    export HOMEDRIVE="C:"
    export OS="Windows_NT"
    export PROCESSOR_ARCHITECTURE="AMD64"
    export NUMBER_OF_PROCESSORS="8"
    export PROCESSOR_IDENTIFIER="Intel64 Family 6 Model 142 Stepping 10, GenuineIntel"

    # Linux-specific but helpful
    export HOME="/home/sandbox"
    export LANG="en_US.UTF-8"
    export DISPLAY=":99"

    echo "[ANTI-EVASION] Environment variables set"
}

# ============================================
# MAIN EXECUTION
# ============================================

echo "[ANTI-EVASION] Tier 1 Environment Obfuscation"

# Run all obfuscation functions
hide_docker_artifacts
hide_vm_proc
randomize_mac 2>/dev/null || true
create_user_files
set_realistic_hostname
spawn_fake_processes
set_environment

echo "[ANTI-EVASION] Tier 1 setup complete"
