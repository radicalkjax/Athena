# Container Security Hardening

This document describes the security hardening measures implemented for the Athena sandbox container environment.

## Overview

The sandbox now implements multiple layers of defense-in-depth security:

1. **Seccomp Profile** - Restricts available syscalls
2. **Read-Only Root Filesystem** - Prevents modification of system files
3. **Non-Root User** - Runs containers as unprivileged user
4. **Capability Dropping** - Removes all capabilities except essential ones
5. **Resource Limits** - Enforces memory, CPU, and process limits

## Seccomp Profile

### Location
`/Users/kali/Athena/Athena/athena-v2/src-tauri/src/sandbox/seccomp.rs`

### Purpose
Restricts the syscalls available to malware samples, reducing attack surface while allowing monitoring tools (strace, tcpdump) to function.

### Blocked Syscalls
The following dangerous syscalls are explicitly blocked to prevent container escape:

- **Module Loading**: `init_module`, `delete_module`, `finit_module`, `create_module`
- **Kernel Operations**: `kexec_load`, `kexec_file_load`, `reboot`, `syslog`, `_sysctl`
- **Container Escape**: `mount`, `umount`, `umount2`, `pivot_root`, `setns`, `unshare`
- **Privileged I/O**: `ioperm`, `iopl`
- **System Time**: `clock_settime`, `settimeofday`, `stime`
- **Namespace Operations**: `name_to_handle_at`, `open_by_handle_at`
- **Memory Operations**: `process_vm_readv`, `process_vm_writev`, `get_mempolicy`, `set_mempolicy`
- **Quota Management**: `quotactl`
- **Performance Monitoring**: `perf_event_open`
- **BPF Programs**: `bpf`

### Allowed Syscalls
Standard syscalls for:
- Process operations (fork, clone, execve, exit)
- File I/O (open, read, write, close)
- Network operations (socket, connect, bind, send, recv)
- Memory management (mmap, munmap, mprotect)
- Signal handling (rt_sigaction, rt_sigprocmask)
- Time operations (clock_gettime, nanosleep)
- **Monitoring**: `ptrace` (required for strace)

### Implementation
```rust
use crate::sandbox::seccomp;

let seccomp_json = seccomp::to_docker_seccomp_json()?;
host_config.security_opt = Some(vec![
    "no-new-privileges:true".to_string(),
    format!("seccomp={}", seccomp_json),
]);
```

## Read-Only Root Filesystem

### Configuration
The container's root filesystem is mounted read-only to prevent malware from:
- Modifying system binaries
- Installing backdoors in system directories
- Tampering with monitoring tools

### Writable Tmpfs Mounts
The following directories are mounted as tmpfs (memory-backed, writable):

```rust
tmpfs.insert("/tmp", "size=64M,mode=1777");
tmpfs.insert("/sandbox/input", "size=128M,mode=0755");
tmpfs.insert("/sandbox/output", "size=512M,mode=0755");
tmpfs.insert("/sandbox/output/memory", "size=256M,mode=0755");
tmpfs.insert("/sandbox/output/screenshots", "size=128M,mode=0755");
```

### Benefits
- **Immutability**: System files cannot be modified
- **Ephemeral**: All changes are lost when container stops
- **Performance**: tmpfs is memory-backed (fast I/O)
- **Size Control**: Each tmpfs has explicit size limits

## Non-Root User Execution

### Dockerfile Configuration
```dockerfile
# Create sandbox user
RUN useradd -m -s /bin/bash sandbox && \
    chown -R sandbox:sandbox /sandbox

# Switch to non-root user
USER sandbox
```

### Security Benefits
- Prevents privilege escalation from uid 0
- Limits damage from exploits
- Enforces least privilege principle
- Aligns with security best practices

## Capability Restrictions

### Dropped Capabilities
All Linux capabilities are dropped by default:
```rust
host_config.cap_drop = Some(vec!["ALL".to_string()]);
```

### Added Capabilities (Essential Only)
```rust
let mut caps = vec!["SYS_PTRACE"]; // For strace monitoring
if config.capture_network {
    caps.push("NET_RAW");    // For tcpdump packet capture
    caps.push("NET_ADMIN");  // For network interface operations
}
host_config.cap_add = Some(caps);
```

## Resource Limits

### Memory
```rust
host_config.memory = Some(config.memory_limit as i64);
host_config.memory_swap = Some(config.memory_limit as i64); // No swap
```
- Default: 512 MB
- No swap allowed (prevents swap-based attacks)

### CPU
```rust
host_config.nano_cpus = Some(1_000_000_000); // 1 CPU
```
- Limited to 1 CPU core
- Prevents resource exhaustion

### Processes
```rust
host_config.pids_limit = Some(256);
```
- Maximum 256 processes
- Prevents fork bomb attacks

## Network Isolation

### No Network Mode (Default)
```rust
host_config.network_mode = Some("none");
```
- Complete network isolation
- No egress or ingress traffic

### Bridge Mode (When Capture Enabled)
```rust
host_config.network_mode = Some("bridge");
```
- Isolated bridge network
- Allows packet capture with tcpdump
- Still isolated from host network

## Testing

### Unit Tests
```bash
cargo test --lib seccomp
```

All tests verify:
- ✅ Seccomp profile structure is valid
- ✅ Dangerous syscalls are blocked
- ✅ Essential syscalls are allowed
- ✅ Ptrace is allowed for monitoring
- ✅ JSON serialization works correctly

### Integration Testing
To test the hardened container:
```bash
# Build the sandbox image
cd athena-v2/docker && ./build-sandbox.sh

# Run sandbox tests (requires Docker)
cd ../src-tauri && cargo test --test sandbox_tests --ignored
```

## Security Impact

### Attack Surface Reduction
- **Before**: ~350 syscalls available, writable root filesystem, root user
- **After**: ~150 syscalls allowed, read-only root, non-root user
- **Reduction**: ~57% fewer syscalls, immutable system

### Container Escape Prevention
Blocked syscalls prevent common container escape techniques:
- Mount namespace escapes (mount, pivot_root)
- Kernel module injection (init_module)
- Process namespace manipulation (setns, unshare)
- Direct kernel access (ioperm, iopl)

### Monitoring Preservation
Despite restrictions, all monitoring tools still function:
- ✅ strace (via SYS_PTRACE capability)
- ✅ tcpdump (via NET_RAW capability)
- ✅ inotify file monitoring
- ✅ Memory dumping with gdb
- ✅ Process monitoring with procps

## Compliance

This implementation follows security best practices from:
- Docker Security Documentation
- CIS Docker Benchmark
- NIST Application Container Security Guide
- OWASP Container Security Cheat Sheet

## Future Enhancements

Potential additional hardening measures:

1. **AppArmor/SELinux Profiles** - Additional MAC layer
2. **User Namespaces** - Map container root to unprivileged host user
3. **Rootless Docker** - Run Docker daemon as non-root
4. **Network Egress Filtering** - Allowlist specific destinations
5. **Syscall Auditing** - Log blocked syscall attempts
6. **Runtime Threat Detection** - Detect anomalous behavior patterns

## References

- [Docker Seccomp Security Profiles](https://docs.docker.com/engine/security/seccomp/)
- [Linux Capabilities](https://man7.org/linux/man-pages/man7/capabilities.7.html)
- [Container Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CIS Docker Benchmark v1.4.0](https://www.cisecurity.org/benchmark/docker)
