//! Memory capture module for sandbox dynamic analysis
//!
//! Provides functionality to capture process memory dumps during malware execution,
//! triggered by specific events like suspicious syscalls, process creation, or intervals.

use serde::{Serialize, Deserialize};
use std::path::PathBuf;

/// Trigger conditions for memory dumps
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DumpTrigger {
    /// Dump when process starts
    ProcessStart,
    /// Dump when a suspicious syscall is detected
    SuspiciousSyscall(String),
    /// Dump at regular intervals (milliseconds)
    Interval(u64),
    /// Dump when process exits
    ProcessExit,
    /// Dump when specific API is called
    ApiCall(String),
    /// Dump when YARA rule matches
    YaraMatch(String),
    /// Manual trigger
    Manual,
}

impl Default for DumpTrigger {
    fn default() -> Self {
        DumpTrigger::ProcessExit
    }
}

/// A captured memory dump
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryDump {
    /// Process ID that was dumped
    pub pid: u32,
    /// Timestamp when dump was captured (Unix millis)
    pub timestamp: u64,
    /// Path to the dump file in the container/sandbox
    pub dump_path: PathBuf,
    /// What triggered this dump
    pub trigger: DumpTrigger,
    /// Size of the dump in bytes
    pub size_bytes: u64,
    /// Process name at time of dump
    pub process_name: String,
    /// Command line of the process
    pub command_line: String,
}

/// Memory region information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryRegion {
    /// Start address of the region
    pub start_addr: u64,
    /// End address of the region
    pub end_addr: u64,
    /// Size in bytes
    pub size: u64,
    /// Permissions (r/w/x)
    pub permissions: String,
    /// Path to mapped file (if any)
    pub path: Option<String>,
    /// Is this region executable?
    pub executable: bool,
    /// Is this heap memory?
    pub is_heap: bool,
    /// Is this stack memory?
    pub is_stack: bool,
}

/// Extracted strings from memory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedString {
    /// The string content
    pub content: String,
    /// Address where found
    pub address: u64,
    /// Length of string
    pub length: usize,
    /// Encoding (ASCII, UTF-8, UTF-16)
    pub encoding: String,
}

/// Configuration for memory capture
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryCaptureConfig {
    /// Enable memory dumping
    pub enabled: bool,
    /// Triggers for when to capture dumps
    pub triggers: Vec<DumpTrigger>,
    /// Maximum dump size in bytes (0 = unlimited)
    pub max_dump_size: u64,
    /// Interval for periodic dumps (if Interval trigger is used)
    pub dump_interval_ms: u64,
    /// Whether to dump on suspicious syscalls automatically
    pub auto_dump_on_suspicious: bool,
    /// Suspicious syscalls that trigger dumps
    pub suspicious_syscalls: Vec<String>,
    /// Whether to extract strings from dumps
    pub extract_strings: bool,
    /// Minimum string length for extraction
    pub min_string_length: usize,
}

impl Default for MemoryCaptureConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            triggers: vec![
                DumpTrigger::ProcessStart,
                DumpTrigger::ProcessExit,
            ],
            max_dump_size: 512 * 1024 * 1024, // 512MB max
            dump_interval_ms: 5000, // 5 seconds
            auto_dump_on_suspicious: true,
            suspicious_syscalls: vec![
                "ptrace".to_string(),
                "mprotect".to_string(),
                "mmap".to_string(),
                "execve".to_string(),
            ],
            extract_strings: true,
            min_string_length: 4,
        }
    }
}

/// Result of memory analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryAnalysisResult {
    /// All captured dumps
    pub dumps: Vec<MemoryDump>,
    /// Memory regions found (from last dump)
    pub regions: Vec<MemoryRegion>,
    /// Extracted strings
    pub strings: Vec<ExtractedString>,
    /// Suspicious findings
    pub suspicious_findings: Vec<SuspiciousFinding>,
    /// Summary statistics
    pub statistics: MemoryStatistics,
}

/// A suspicious finding in memory
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuspiciousFinding {
    /// Type of finding
    pub finding_type: SuspiciousFindingType,
    /// Description
    pub description: String,
    /// Address where found
    pub address: Option<u64>,
    /// Associated region
    pub region: Option<String>,
    /// Confidence (0.0 - 1.0)
    pub confidence: f64,
    /// MITRE ATT&CK technique if applicable
    pub mitre_attack_id: Option<String>,
}

/// Types of suspicious memory findings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SuspiciousFindingType {
    /// Executable heap region
    ExecutableHeap,
    /// Executable stack region
    ExecutableStack,
    /// RWX (read-write-execute) memory
    RwxMemory,
    /// Shellcode pattern detected
    ShellcodePattern,
    /// API hooking detected
    ApiHook,
    /// Injected code in another process
    InjectedCode,
    /// Unpacked/decrypted code
    UnpackedCode,
    /// Suspicious string found
    SuspiciousString,
    /// Process hollowing indicators
    ProcessHollowing,
    /// Heap spray indicators
    HeapSpray,
}

/// Memory statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryStatistics {
    /// Total memory used
    pub total_memory_bytes: u64,
    /// Heap size
    pub heap_size_bytes: u64,
    /// Stack size
    pub stack_size_bytes: u64,
    /// Number of memory regions
    pub region_count: u64,
    /// Number of executable regions
    pub executable_region_count: u64,
    /// Number of RWX regions (suspicious)
    pub rwx_region_count: u64,
    /// Number of dumps captured
    pub dump_count: u64,
}

impl Default for MemoryStatistics {
    fn default() -> Self {
        Self {
            total_memory_bytes: 0,
            heap_size_bytes: 0,
            stack_size_bytes: 0,
            region_count: 0,
            executable_region_count: 0,
            rwx_region_count: 0,
            dump_count: 0,
        }
    }
}

/// Memory capture manager
pub struct MemoryCaptureManager {
    config: MemoryCaptureConfig,
}

impl MemoryCaptureManager {
    /// Create a new memory capture manager with default config
    pub fn new() -> Self {
        Self {
            config: MemoryCaptureConfig::default(),
        }
    }

    /// Create with custom config
    pub fn with_config(config: MemoryCaptureConfig) -> Self {
        Self { config }
    }

    /// Generate shell script commands for memory dumping in container
    pub fn generate_dump_script(&self, sample_pid_var: &str) -> String {
        let mut script = String::new();

        // Create memory output directory
        script.push_str("mkdir -p /sandbox/output/memory\n");

        // Function to dump process memory
        script.push_str(r#"
dump_memory() {
    local pid=$1
    local trigger=$2
    local timestamp=$(date +%s%3N)
    local dump_file="/sandbox/output/memory/dump_${pid}_${timestamp}_${trigger}.raw"

    # Try gcore first (creates ELF core dump)
    if command -v gcore &> /dev/null; then
        gcore -o "/sandbox/output/memory/core_${pid}_${timestamp}" "$pid" 2>/dev/null || true
    fi

    # Fallback: dump from /proc/PID/mem with maps
    if [ -r "/proc/$pid/maps" ] && [ -r "/proc/$pid/mem" ]; then
        cp "/proc/$pid/maps" "/sandbox/output/memory/maps_${pid}_${timestamp}.txt" 2>/dev/null || true

        # Dump readable memory regions
        while read line; do
            range=$(echo "$line" | cut -d' ' -f1)
            perms=$(echo "$line" | cut -d' ' -f2)

            # Only dump readable regions
            if [[ "$perms" == r* ]]; then
                start=$(echo "$range" | cut -d'-' -f1)
                end=$(echo "$range" | cut -d'-' -f2)

                # Record region info
                echo "$range $perms" >> "/sandbox/output/memory/regions_${pid}_${timestamp}.txt"
            fi
        done < "/proc/$pid/maps"
    fi

    echo "[MEMORY] Dumped PID $pid (trigger: $trigger)"
}

"#);

        // Add trigger for process start if configured
        if self.config.triggers.contains(&DumpTrigger::ProcessStart) {
            script.push_str(&format!(
                "# Dump on process start\ndump_memory ${} \"start\"\n\n",
                sample_pid_var
            ));
        }

        // Add periodic dump if configured
        if self.config.triggers.iter().any(|t| matches!(t, DumpTrigger::Interval(_))) {
            script.push_str(&format!(r#"
# Periodic memory dumps
(
    while kill -0 ${} 2>/dev/null; do
        dump_memory ${} "interval"
        sleep {}
    done
) &
MEMORY_DUMP_PID=$!

"#, sample_pid_var, sample_pid_var, self.config.dump_interval_ms / 1000));
        }

        script
    }

    /// Parse memory regions from /proc/PID/maps content
    pub fn parse_memory_maps(&self, maps_content: &str) -> Vec<MemoryRegion> {
        let mut regions = Vec::new();

        for line in maps_content.lines() {
            if line.is_empty() {
                continue;
            }

            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() < 5 {
                continue;
            }

            // Parse address range
            let range_parts: Vec<&str> = parts[0].split('-').collect();
            if range_parts.len() != 2 {
                continue;
            }

            let start_addr = u64::from_str_radix(range_parts[0], 16).unwrap_or(0);
            let end_addr = u64::from_str_radix(range_parts[1], 16).unwrap_or(0);
            let perms = parts[1].to_string();
            let path = if parts.len() > 5 { Some(parts[5].to_string()) } else { None };

            let is_heap = path.as_ref().map(|p| p.contains("[heap]")).unwrap_or(false);
            let is_stack = path.as_ref().map(|p| p.contains("[stack]")).unwrap_or(false);
            let executable = perms.contains('x');

            regions.push(MemoryRegion {
                start_addr,
                end_addr,
                size: end_addr.saturating_sub(start_addr),
                permissions: perms,
                path,
                executable,
                is_heap,
                is_stack,
            });
        }

        regions
    }

    /// Analyze memory regions for suspicious patterns
    pub fn analyze_regions(&self, regions: &[MemoryRegion]) -> Vec<SuspiciousFinding> {
        let mut findings = Vec::new();

        for region in regions {
            // Check for RWX regions (read-write-execute)
            if region.permissions.contains('r')
                && region.permissions.contains('w')
                && region.permissions.contains('x')
            {
                findings.push(SuspiciousFinding {
                    finding_type: SuspiciousFindingType::RwxMemory,
                    description: format!(
                        "RWX memory region at 0x{:x}-0x{:x} ({} bytes)",
                        region.start_addr, region.end_addr, region.size
                    ),
                    address: Some(region.start_addr),
                    region: region.path.clone(),
                    confidence: 0.8,
                    mitre_attack_id: Some("T1055".to_string()), // Process Injection
                });
            }

            // Check for executable heap
            if region.is_heap && region.executable {
                findings.push(SuspiciousFinding {
                    finding_type: SuspiciousFindingType::ExecutableHeap,
                    description: format!(
                        "Executable heap region at 0x{:x}-0x{:x}",
                        region.start_addr, region.end_addr
                    ),
                    address: Some(region.start_addr),
                    region: Some("[heap]".to_string()),
                    confidence: 0.9,
                    mitre_attack_id: Some("T1055".to_string()),
                });
            }

            // Check for executable stack
            if region.is_stack && region.executable {
                findings.push(SuspiciousFinding {
                    finding_type: SuspiciousFindingType::ExecutableStack,
                    description: format!(
                        "Executable stack region at 0x{:x}-0x{:x}",
                        region.start_addr, region.end_addr
                    ),
                    address: Some(region.start_addr),
                    region: Some("[stack]".to_string()),
                    confidence: 0.95,
                    mitre_attack_id: Some("T1055".to_string()),
                });
            }
        }

        findings
    }
}

impl Default for MemoryCaptureManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_memory_maps() {
        let manager = MemoryCaptureManager::new();

        let maps_content = r#"00400000-00452000 r-xp 00000000 08:01 1234 /bin/sample
00651000-00652000 r--p 00051000 08:01 1234 /bin/sample
00652000-00653000 rw-p 00052000 08:01 1234 /bin/sample
7f9a8c000000-7f9a8c021000 rw-p 00000000 00:00 0 [heap]
7fff12345000-7fff12366000 rw-p 00000000 00:00 0 [stack]
"#;

        let regions = manager.parse_memory_maps(maps_content);

        assert_eq!(regions.len(), 5);
        assert!(regions[0].executable);
        assert!(!regions[0].is_heap);
        assert!(regions[3].is_heap);
        assert!(regions[4].is_stack);
    }

    #[test]
    fn test_analyze_rwx_region() {
        let manager = MemoryCaptureManager::new();

        let regions = vec![
            MemoryRegion {
                start_addr: 0x1000,
                end_addr: 0x2000,
                size: 0x1000,
                permissions: "rwxp".to_string(),
                path: None,
                executable: true,
                is_heap: false,
                is_stack: false,
            },
        ];

        let findings = manager.analyze_regions(&regions);

        assert_eq!(findings.len(), 1);
        assert!(matches!(findings[0].finding_type, SuspiciousFindingType::RwxMemory));
    }

    #[test]
    fn test_generate_dump_script() {
        let manager = MemoryCaptureManager::new();
        let script = manager.generate_dump_script("SAMPLE_PID");

        assert!(script.contains("dump_memory"));
        assert!(script.contains("gcore"));
        assert!(script.contains("/proc/$pid/maps"));
    }
}
