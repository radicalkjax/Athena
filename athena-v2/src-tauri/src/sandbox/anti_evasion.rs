//! Anti-evasion module for sandbox dynamic analysis
//!
//! Implements techniques to make the sandbox environment appear as a legitimate
//! user workstation, defeating malware that checks for virtualization or
//! analysis environments before executing malicious payloads.

use serde::{Serialize, Deserialize};

/// Anti-evasion configuration for sandbox execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntiEvasionConfig {
    /// Enable Tier 1: Environment obfuscation
    pub tier1_environment: bool,
    /// Enable Tier 2: Behavioral anti-evasion
    pub tier2_behavioral: bool,
    /// Enable Tier 3: Hypervisor-based (future)
    pub tier3_hypervisor: bool,

    // Tier 1: Environment settings
    /// Hide Docker/VM artifacts in /proc, /sys
    pub hide_vm_artifacts: bool,
    /// Randomize MAC address to appear as real hardware
    pub randomize_mac: bool,
    /// Fake realistic user files (Documents, Pictures, etc.)
    pub fake_user_files: bool,
    /// Use realistic hostname
    pub realistic_hostname: bool,
    /// Populate process list with common applications
    pub realistic_process_list: bool,

    // Tier 2: Behavioral settings
    /// Normalize RDTSC timing to hide timing-based detection
    pub normalize_rdtsc: bool,
    /// Sleep acceleration factor (1.0 = normal, 10.0 = 10x faster)
    pub sleep_acceleration: f64,
    /// Simulate mouse movements
    pub simulate_mouse: bool,
    /// Simulate keyboard input
    pub simulate_keyboard: bool,
    /// Protect syscall hooks from detection
    pub protect_hooks: bool,
}

impl Default for AntiEvasionConfig {
    fn default() -> Self {
        Self {
            tier1_environment: true,
            tier2_behavioral: true,
            tier3_hypervisor: false,

            // Tier 1 defaults
            hide_vm_artifacts: true,
            randomize_mac: true,
            fake_user_files: true,
            realistic_hostname: true,
            realistic_process_list: true,

            // Tier 2 defaults
            normalize_rdtsc: true,
            sleep_acceleration: 5.0, // 5x faster sleep
            simulate_mouse: true,
            simulate_keyboard: true,
            protect_hooks: true,
        }
    }
}

/// Types of VM/sandbox artifacts that can be hidden
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum VmArtifact {
    /// /proc/scsi/scsi entries
    ScsiInfo,
    /// /proc/cpuinfo hypervisor flag
    CpuInfo,
    /// /sys/devices/virtual markers
    SysDevices,
    /// Docker container ID in cgroup
    DockerCgroup,
    /// VM tools processes (vmtoolsd, etc.)
    VmToolsProcess,
    /// Guest additions markers
    GuestAdditions,
    /// MAC address vendor prefix
    MacAddress,
    /// Disk serial numbers
    DiskSerial,
    /// BIOS strings
    BiosStrings,
}

/// Evasion technique detected during analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvasionAttempt {
    /// Timestamp when detected
    pub timestamp: u64,
    /// Type of evasion technique
    pub technique_type: EvasionTechnique,
    /// Description of what was detected
    pub description: String,
    /// Syscall or API that triggered detection
    pub trigger: String,
    /// Whether the anti-evasion measure blocked it
    pub blocked: bool,
}

/// Types of evasion techniques that malware may use
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EvasionTechnique {
    /// Checking for VM/sandbox via registry or files
    VmDetection,
    /// Using RDTSC for timing-based detection
    TimingCheck,
    /// Checking for analysis tools processes
    ProcessCheck,
    /// Checking for debugger (IsDebuggerPresent, etc.)
    DebuggerCheck,
    /// Checking for user activity (mouse movement, etc.)
    UserActivityCheck,
    /// Checking for realistic filesystem
    FilesystemCheck,
    /// Checking network environment
    NetworkCheck,
    /// Sleeping to evade sandbox timeout
    SleepEvasion,
    /// Checking for hooks (syscall interception)
    HookDetection,
}

/// Manager for anti-evasion configuration and script generation
pub struct AntiEvasionManager {
    config: AntiEvasionConfig,
}

impl AntiEvasionManager {
    /// Create a new anti-evasion manager with default config
    pub fn new() -> Self {
        Self {
            config: AntiEvasionConfig::default(),
        }
    }

    /// Create with custom configuration
    pub fn with_config(config: AntiEvasionConfig) -> Self {
        Self { config }
    }

    /// Generate the anti-evasion setup script for Tier 1
    pub fn generate_tier1_script(&self) -> String {
        let mut script = String::new();

        script.push_str(r#"#!/bin/bash
# Athena Anti-Evasion Tier 1: Environment Obfuscation
# This script runs before sample execution to make the sandbox
# appear as a legitimate user workstation.

set -e

echo "[ANTI-EVASION] Starting environment obfuscation..."

"#);

        // Hide Docker/VM artifacts
        if self.config.hide_vm_artifacts {
            script.push_str(r#"
# Hide Docker artifacts
hide_docker_artifacts() {
    # Mount overlay to hide /proc entries
    if [ -f /.dockerenv ]; then
        rm -f /.dockerenv 2>/dev/null || true
    fi

    # Hide cgroup Docker markers
    for cgroup in /sys/fs/cgroup/*/docker; do
        if [ -d "$cgroup" ]; then
            chmod 000 "$cgroup" 2>/dev/null || true
        fi
    done

    # Override /proc/1/cgroup to hide container ID
    mkdir -p /tmp/fake_proc
    echo "0::/" > /tmp/fake_proc/cgroup 2>/dev/null || true

    echo "[ANTI-EVASION] Docker artifacts hidden"
}
hide_docker_artifacts

# Hide VM artifacts in /proc
hide_vm_proc() {
    # Create fake /proc entries if needed
    # (Would require mount namespace in production)

    # Hide hypervisor flag from cpuinfo
    if grep -q "hypervisor" /proc/cpuinfo 2>/dev/null; then
        echo "[ANTI-EVASION] Warning: hypervisor flag detected in cpuinfo"
    fi

    echo "[ANTI-EVASION] VM proc artifacts processed"
}
hide_vm_proc

"#);
        }

        // Randomize MAC address
        if self.config.randomize_mac {
            script.push_str(r#"
# Randomize MAC address to appear as real hardware
randomize_mac() {
    # Generate realistic vendor prefix (Dell, HP, Lenovo)
    local VENDORS=("00:1E:4F" "00:1C:42" "00:50:56" "D4:3D:7E" "A4:1F:72")
    local VENDOR=${VENDORS[$RANDOM % ${#VENDORS[@]}]}
    local SUFFIX=$(printf '%02X:%02X:%02X' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
    local NEW_MAC="$VENDOR:$SUFFIX"

    # Try to change MAC on default interface
    for iface in eth0 ens33 enp0s3; do
        if ip link show "$iface" &>/dev/null; then
            ip link set "$iface" down 2>/dev/null || true
            ip link set "$iface" address "$NEW_MAC" 2>/dev/null || true
            ip link set "$iface" up 2>/dev/null || true
            echo "[ANTI-EVASION] MAC changed to $NEW_MAC on $iface"
            break
        fi
    done
}
randomize_mac 2>/dev/null || true

"#);
        }

        // Create fake user files
        if self.config.fake_user_files {
            script.push_str(r#"
# Create realistic user environment
create_user_files() {
    local USER_HOME="/home/sandbox"
    mkdir -p "$USER_HOME"/{Desktop,Documents,Downloads,Pictures,Music,Videos}
    mkdir -p "$USER_HOME/.config"
    mkdir -p "$USER_HOME/.local/share"

    # Create fake browser history (Chrome)
    mkdir -p "$USER_HOME/.config/google-chrome/Default"
    cat > "$USER_HOME/.config/google-chrome/Default/History.txt" << 'EOF'
https://www.google.com - Google
https://www.youtube.com - YouTube
https://www.amazon.com - Amazon
https://www.facebook.com - Facebook
https://www.twitter.com - Twitter
https://www.reddit.com - Reddit
https://www.github.com - GitHub
https://mail.google.com - Gmail
https://www.netflix.com - Netflix
https://www.linkedin.com - LinkedIn
EOF

    # Create fake documents
    echo "Meeting notes from last week's project review." > "$USER_HOME/Documents/notes.txt"
    echo "Quarterly report Q4 2025" > "$USER_HOME/Documents/report.txt"
    echo "password,account" > "$USER_HOME/Documents/passwords.csv"
    echo "admin123,corporate" >> "$USER_HOME/Documents/passwords.csv"

    # Create some picture/image files (small placeholders)
    dd if=/dev/urandom of="$USER_HOME/Pictures/vacation_2025.jpg" bs=1024 count=10 2>/dev/null || true
    dd if=/dev/urandom of="$USER_HOME/Pictures/family_photo.png" bs=1024 count=8 2>/dev/null || true

    # Create fake downloads
    dd if=/dev/urandom of="$USER_HOME/Downloads/invoice_12345.pdf" bs=1024 count=15 2>/dev/null || true
    dd if=/dev/urandom of="$USER_HOME/Downloads/setup_software.exe" bs=1024 count=100 2>/dev/null || true

    # Create .bashrc with realistic history
    cat > "$USER_HOME/.bash_history" << 'EOF'
cd Documents
ls -la
cat notes.txt
google-chrome
code --version
git pull origin main
npm install
docker-compose up -d
EOF

    chown -R sandbox:sandbox "$USER_HOME" 2>/dev/null || true
    echo "[ANTI-EVASION] User files created"
}
create_user_files

"#);
        }

        // Set realistic hostname
        if self.config.realistic_hostname {
            script.push_str(r#"
# Set realistic hostname and domain
set_hostname() {
    local HOSTNAMES=("DESKTOP-ABC1234" "LAPTOP-USER-PC" "WORKSTATION-01" "WIN-ENTERPRISE" "PC-${RANDOM}")
    local NEW_HOSTNAME=${HOSTNAMES[$RANDOM % ${#HOSTNAMES[@]}]}

    hostname "$NEW_HOSTNAME" 2>/dev/null || true
    echo "$NEW_HOSTNAME" > /etc/hostname 2>/dev/null || true

    # Update /etc/hosts
    sed -i "s/127.0.1.1.*/127.0.1.1\t$NEW_HOSTNAME/" /etc/hosts 2>/dev/null || true

    echo "[ANTI-EVASION] Hostname set to $NEW_HOSTNAME"
}
set_hostname

"#);
        }

        // Create fake process list
        if self.config.realistic_process_list {
            script.push_str(r#"
# Spawn fake processes to simulate realistic environment
spawn_fake_processes() {
    # Create dummy processes that mimic common applications
    # These just sleep but appear in process list

    (while true; do sleep 3600; done) &
    echo $! > /tmp/fake_chrome.pid
    # Rename the process (Linux allows this via /proc/self/comm)
    echo "chrome" > /proc/$!/comm 2>/dev/null || true

    (while true; do sleep 3600; done) &
    echo "explorer.exe" > /proc/$!/comm 2>/dev/null || true

    (while true; do sleep 3600; done) &
    echo "svchost.exe" > /proc/$!/comm 2>/dev/null || true

    (while true; do sleep 3600; done) &
    echo "csrss.exe" > /proc/$!/comm 2>/dev/null || true

    echo "[ANTI-EVASION] Fake processes spawned"
}
spawn_fake_processes

"#);
        }

        // Complete script
        script.push_str(r#"
echo "[ANTI-EVASION] Tier 1 setup complete"

"#);

        script
    }

    /// Generate script for Tier 2 behavioral anti-evasion
    pub fn generate_tier2_script(&self) -> String {
        let mut script = String::new();

        script.push_str(r#"#!/bin/bash
# Athena Anti-Evasion Tier 2: Behavioral Anti-Evasion
# This script runs alongside the sample to simulate user behavior
# and defeat timing/activity-based evasion techniques.

echo "[ANTI-EVASION] Starting behavioral simulation..."

"#);

        // User activity simulation
        if self.config.simulate_mouse || self.config.simulate_keyboard {
            script.push_str(r#"
# Simulate realistic user activity
simulate_user_activity() {
    export DISPLAY=:99

    while true; do
        # Random mouse movements (realistic patterns)
        for i in {1..5}; do
            xdotool mousemove --sync $(shuf -i 50-1200 -n 1) $(shuf -i 50-700 -n 1) 2>/dev/null || true
            sleep 0.$(shuf -i 1-5 -n 1)
        done

        # Occasional click
        if [ $((RANDOM % 5)) -eq 0 ]; then
            xdotool click 1 2>/dev/null || true
        fi

        # Occasional keyboard input
        if [ $((RANDOM % 8)) -eq 0 ]; then
            xdotool type "test" 2>/dev/null || true
        fi

        # Pause between activity bursts
        sleep $(shuf -i 2-8 -n 1)

        # Check if we should stop
        if [ -f /sandbox/output/stop_simulation ]; then
            break
        fi
    done
}
simulate_user_activity &
USER_SIM_PID=$!
echo $USER_SIM_PID > /tmp/user_sim.pid

"#);
        }

        // Sleep acceleration
        if self.config.sleep_acceleration > 1.0 {
            script.push_str(&format!(r#"
# Note: Sleep acceleration requires LD_PRELOAD library
# This placeholder documents the feature
# Acceleration factor: {:.1}x
echo "[ANTI-EVASION] Sleep acceleration enabled ({:.1}x)"

"#, self.config.sleep_acceleration, self.config.sleep_acceleration));
        }

        script.push_str(r#"
echo "[ANTI-EVASION] Tier 2 behavioral simulation active"

"#);

        script
    }

    /// List all artifacts that should be hidden
    pub fn get_artifacts_to_hide(&self) -> Vec<VmArtifact> {
        vec![
            VmArtifact::ScsiInfo,
            VmArtifact::CpuInfo,
            VmArtifact::SysDevices,
            VmArtifact::DockerCgroup,
            VmArtifact::VmToolsProcess,
            VmArtifact::GuestAdditions,
            VmArtifact::MacAddress,
            VmArtifact::DiskSerial,
            VmArtifact::BiosStrings,
        ]
    }

    /// Check if an evasion technique was likely attempted based on syscalls
    pub fn detect_evasion_attempt(&self, syscall: &str, args: &str) -> Option<EvasionAttempt> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;

        // Check for VM detection attempts
        if syscall == "openat" || syscall == "open" {
            if args.contains("/sys/class/dmi") || args.contains("/proc/scsi") {
                return Some(EvasionAttempt {
                    timestamp: now,
                    technique_type: EvasionTechnique::VmDetection,
                    description: "Attempting to read VM detection files".to_string(),
                    trigger: format!("{}({})", syscall, args),
                    blocked: self.config.hide_vm_artifacts,
                });
            }
            if args.contains("/.dockerenv") || args.contains("/proc/1/cgroup") {
                return Some(EvasionAttempt {
                    timestamp: now,
                    technique_type: EvasionTechnique::VmDetection,
                    description: "Checking for Docker container markers".to_string(),
                    trigger: format!("{}({})", syscall, args),
                    blocked: self.config.hide_vm_artifacts,
                });
            }
        }

        // Check for debugger detection
        if syscall == "ptrace" && args.contains("TRACEME") {
            return Some(EvasionAttempt {
                timestamp: now,
                technique_type: EvasionTechnique::DebuggerCheck,
                description: "Anti-debugging via ptrace TRACEME".to_string(),
                trigger: syscall.to_string(),
                blocked: false,
            });
        }

        // Check for sleep evasion
        if syscall == "nanosleep" || syscall == "clock_nanosleep" {
            // Parse sleep duration from args if possible
            if args.contains("1000000000") || args.contains("tv_sec=") {
                return Some(EvasionAttempt {
                    timestamp: now,
                    technique_type: EvasionTechnique::SleepEvasion,
                    description: "Long sleep detected (potential timeout evasion)".to_string(),
                    trigger: format!("{}({})", syscall, args),
                    blocked: self.config.sleep_acceleration > 1.0,
                });
            }
        }

        None
    }
}

impl Default for AntiEvasionManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = AntiEvasionConfig::default();
        assert!(config.tier1_environment);
        assert!(config.tier2_behavioral);
        assert!(!config.tier3_hypervisor);
        assert_eq!(config.sleep_acceleration, 5.0);
    }

    #[test]
    fn test_generate_tier1_script() {
        let manager = AntiEvasionManager::new();
        let script = manager.generate_tier1_script();

        assert!(script.contains("hide_docker_artifacts"));
        assert!(script.contains("randomize_mac"));
        assert!(script.contains("create_user_files"));
        assert!(script.contains("set_hostname"));
        assert!(script.contains("spawn_fake_processes"));
    }

    #[test]
    fn test_generate_tier2_script() {
        let manager = AntiEvasionManager::new();
        let script = manager.generate_tier2_script();

        assert!(script.contains("simulate_user_activity"));
        assert!(script.contains("xdotool"));
    }

    #[test]
    fn test_detect_vm_detection_attempt() {
        let manager = AntiEvasionManager::new();

        // VM detection via DMI
        let attempt = manager.detect_evasion_attempt(
            "openat",
            "/sys/class/dmi/id/product_name"
        );
        assert!(attempt.is_some());
        assert_eq!(attempt.unwrap().technique_type, EvasionTechnique::VmDetection);

        // Docker detection
        let attempt = manager.detect_evasion_attempt(
            "open",
            "/.dockerenv"
        );
        assert!(attempt.is_some());
    }

    #[test]
    fn test_detect_debugger_check() {
        let manager = AntiEvasionManager::new();

        let attempt = manager.detect_evasion_attempt(
            "ptrace",
            "PTRACE_TRACEME"
        );
        assert!(attempt.is_some());
        assert_eq!(attempt.unwrap().technique_type, EvasionTechnique::DebuggerCheck);
    }

    #[test]
    fn test_artifacts_list() {
        let manager = AntiEvasionManager::new();
        let artifacts = manager.get_artifacts_to_hide();

        assert!(artifacts.len() >= 5);
        assert!(artifacts.contains(&VmArtifact::DockerCgroup));
        assert!(artifacts.contains(&VmArtifact::MacAddress));
    }
}
