# Athena Sandbox Usage Guide

**Status:** ✅ IMPLEMENTED - Fully Operational
**Docker Integration:** Complete with bollard crate
**Security:** Read-only root, seccomp profile, anti-evasion tiers 1-2

## Quick Start

### Prerequisites
- Docker installed and running
- Sandbox image built: `athena-sandbox:latest`

### Build Sandbox Image
```bash
cd athena-v2/docker
./build-sandbox.sh
```

### Basic Usage

```rust
use athena_v2::sandbox::{SandboxOrchestrator, SandboxConfig};
use std::time::Duration;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create orchestrator
    let orchestrator = SandboxOrchestrator::new().await?;

    // Configure sandbox
    let config = SandboxConfig {
        os_type: OsType::Linux,
        timeout: Duration::from_secs(120),
        capture_network: true,
        memory_limit: 512 * 1024 * 1024, // 512MB
        anti_evasion_tier: Some(2), // Enable tier 2 anti-evasion
        memory_capture_config: None,
        capture_video: false,
        video_config: None,
    };

    // Execute sample
    let report = orchestrator
        .execute_sample(PathBuf::from("/path/to/sample"), config)
        .await?;

    println!("Exit code: {}", report.exit_code);
    println!("Behavioral events: {}", report.behavioral_events.len());
    println!("Network connections: {}", report.network_connections.len());

    Ok(())
}
```

## Security Features

### Read-Only Root Filesystem
The sandbox runs with a read-only root filesystem. Only specific directories are writable:

- `/tmp` - 64MB tmpfs for temporary files
- `/sandbox/input` - 128MB tmpfs for input samples
- `/sandbox/output` - 512MB tmpfs for analysis results
- `/sandbox/output/memory` - 256MB tmpfs for memory dumps
- `/sandbox/output/screenshots` - 128MB tmpfs for screenshots

### Seccomp Profile
A restrictive seccomp profile blocks ~200 dangerous syscalls while allowing:
- Basic process operations (fork, exec, exit)
- File I/O (open, read, write)
- Network operations (socket, connect)
- Monitoring syscalls (ptrace for strace)

### Capabilities
All capabilities are dropped except:
- `SYS_PTRACE` - Required for strace monitoring
- `NET_RAW` - Required for tcpdump (when network capture enabled)
- `NET_ADMIN` - Required for network interface operations (when network capture enabled)

### Non-Root Execution
Containers run as the `sandbox` user (non-root) for additional security.

## Configuration Options

### Anti-Evasion Tiers

```rust
// No anti-evasion
anti_evasion_tier: None

// Tier 1: Environment setup only
anti_evasion_tier: Some(1)

// Tier 2: Environment + behavioral simulation
anti_evasion_tier: Some(2)
```

### Network Capture

```rust
// Enable network capture
capture_network: true  // Uses bridge network, allows tcpdump

// Disable network (complete isolation)
capture_network: false  // Uses "none" network mode
```

### Memory Capture

```rust
use athena_v2::sandbox::memory_capture::{MemoryCaptureConfig, DumpTrigger};

let mem_config = MemoryCaptureConfig {
    enabled: true,
    triggers: vec![
        DumpTrigger::ProcessStart,
        DumpTrigger::ProcessExit,
        DumpTrigger::SuspiciousSyscall("ptrace".to_string()),
    ],
    max_dump_size: 100 * 1024 * 1024, // 100MB
    dump_interval_ms: 5000,
    auto_dump_on_suspicious: true,
    suspicious_syscalls: vec!["ptrace".to_string(), "mprotect".to_string()],
    extract_strings: true,
    min_string_length: 4,
};

let config = SandboxConfig {
    memory_capture_config: Some(mem_config),
    // ... other config
};
```

## Output Analysis

### Execution Report
```rust
pub struct ExecutionReport {
    pub session_id: String,
    pub exit_code: i32,
    pub execution_time_ms: u64,
    pub behavioral_events: Vec<BehaviorEvent>,
    pub file_operations: Vec<FileOperation>,
    pub network_connections: Vec<NetworkConnection>,
    pub processes_created: Vec<ProcessInfo>,
    pub syscall_summary: HashMap<String, u64>,
    pub stdout: String,
    pub stderr: String,
    pub mitre_attacks: Vec<MitreAttack>,
    pub memory_dumps: Vec<MemoryDump>,
    pub video_recording: Option<VideoRecording>,
}
```

### Behavioral Events
Automatically detected suspicious behaviors:
- Process execution (`execve`)
- Network connections (`socket`, `connect`)
- File access to sensitive paths (`/etc/passwd`, `/etc/shadow`)
- Memory protection changes (`mprotect`)
- Process injection attempts (`ptrace`)

### MITRE ATT&CK Mapping
Events are automatically mapped to MITRE ATT&CK techniques:
- T1059 - Command and Scripting Interpreter
- T1106 - Native API
- T1071 - Application Layer Protocol
- T1003 - OS Credential Dumping
- T1055 - Process Injection
- T1547 - Boot or Logon Autostart Execution

## Troubleshooting

### Docker Not Available
```
Error: Docker connection error: Failed to connect to Docker
```
**Solution**: Ensure Docker daemon is running:
```bash
docker ps
```

### Image Not Found
```
Error: Sandbox image 'athena-sandbox:latest' not found
```
**Solution**: Build the sandbox image:
```bash
cd athena-v2/docker && ./build-sandbox.sh
```

### Permission Denied
```
Error: Failed to upload to container: permission denied
```
**Solution**: This may occur if tmpfs mounts fail. Check Docker logs:
```bash
docker logs <container-id>
```

### Timeout Errors
```
Error: Execution timeout
```
**Solution**: Increase timeout in config:
```rust
timeout: Duration::from_secs(300), // 5 minutes
```

## Performance Tuning

### Memory Limits
Adjust based on sample size:
```rust
// For small samples (< 10MB)
memory_limit: 256 * 1024 * 1024, // 256MB

// For large samples (> 100MB)
memory_limit: 1024 * 1024 * 1024, // 1GB
```

### Tmpfs Sizes
Can be configured in orchestrator.rs if defaults are insufficient:
```rust
tmpfs.insert("/sandbox/output", "size=1G,mode=0755");
```

### CPU Limits
Currently fixed at 1 CPU. To modify:
```rust
host_config.nano_cpus = Some(2_000_000_000); // 2 CPUs
```

## Security Considerations

### Malware Handling
- Never execute malware samples on production systems
- Always use the sandbox for analysis
- Samples are isolated but should be treated as hostile
- Review execution reports before handling output files

### Container Escape Prevention
The security hardening prevents common escape techniques:
- Mount namespace escapes (blocked via seccomp)
- Kernel module loading (blocked via seccomp)
- Privilege escalation (non-root user, capability restrictions)
- File system tampering (read-only root)

### Network Isolation
When `capture_network: false`:
- No egress traffic possible
- No ingress traffic possible
- Complete network isolation

When `capture_network: true`:
- Isolated bridge network
- Traffic captured by tcpdump
- Still isolated from host network

## Testing

### Unit Tests
```bash
cd athena-v2/src-tauri
cargo test sandbox
```

### Integration Tests
```bash
cargo test --test sandbox_tests --ignored
```

### Manual Testing
```bash
# Test basic execution
cargo run --example sandbox_test

# Test with network capture
cargo run --example sandbox_network_test

# Test anti-evasion
cargo run --example sandbox_antievasion_test
```

## Advanced Features

### Custom Monitoring Scripts
Upload custom scripts to container:
```rust
orchestrator.upload_script_to_container(
    container_id,
    script_content,
    "/tmp/custom_monitor.sh"
).await?;
```

### Video Recording
Capture execution as video (X11 required):
```rust
use athena_v2::sandbox::video_capture::VideoCaptureConfig;

let video_config = VideoCaptureConfig {
    fps: 10,
    resolution: "1024x768".to_string(),
    format: "mp4".to_string(),
};

let config = SandboxConfig {
    capture_video: true,
    video_config: Some(video_config),
    // ... other config
};
```

### Volatility Memory Analysis
Analyze memory dumps with Volatility:
```rust
use athena_v2::sandbox::volatility::{VolatilityRunner, VolatilityConfig};

let vol_config = VolatilityConfig {
    profile: "LinuxUbuntu22x64".to_string(),
    plugins: vec!["pslist", "netstat", "malfind"],
};

let vol_runner = VolatilityRunner::new(vol_config);
let analysis = vol_runner.analyze(&memory_dump_path).await?;
```

## References

- [Container Security Documentation](CONTAINER_SECURITY_HARDENING.md)
- [Sandbox Orchestrator API](../src/sandbox/orchestrator.rs)
- [Memory Capture Guide](../src/sandbox/memory_capture.rs)
- [Anti-Evasion Techniques](../src/sandbox/anti_evasion.rs)
