# Docker Container Support for Athena Sandbox

This document describes the Docker container integration for isolated malware analysis in Athena.

## Overview

Athena now includes full Docker container support via the `bollard` crate, enabling:

- **Isolated execution** of malware samples in containers
- **Resource limits** (CPU, memory) for security
- **Network isolation** to prevent malware communication
- **Read-only filesystems** to prevent persistence
- **Security hardening** (dropped capabilities, no-new-privileges)

## Prerequisites

1. **Docker Desktop** or **Docker Engine** must be installed and running
2. Docker daemon must be accessible from the application

### Installation

**macOS:**
```bash
brew install --cask docker
# Or download from https://www.docker.com/products/docker-desktop
```

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group (logout/login required)
sudo usermod -aG docker $USER
```

**Windows:**
Download and install Docker Desktop from https://www.docker.com/products/docker-desktop

## Backend API

### Tauri Commands

All commands are async and return `Result<T, String>` for error handling.

#### 1. `check_docker_available()`

Check if Docker is available and running.

```rust
#[tauri::command]
pub async fn check_docker_available() -> Result<bool, String>
```

**Returns:** `true` if Docker is available, `false` otherwise

**Example:**
```typescript
const available = await invoke<boolean>('check_docker_available');
```

---

#### 2. `create_sandbox_container(image, memory_limit, cpu_limit)`

Create a new sandbox container with security restrictions.

```rust
#[tauri::command]
pub async fn create_sandbox_container(
    image: String,
    memory_limit: u64,
    cpu_limit: f64,
) -> Result<ContainerInfo, String>
```

**Parameters:**
- `image` - Docker image name (e.g., "alpine:latest", "ubuntu:22.04")
- `memory_limit` - Memory limit in bytes (e.g., 256MB = 268435456)
- `cpu_limit` - CPU limit as fraction (e.g., 0.5 = 50% of one CPU core)

**Security Features:**
- Network disabled (no internet access)
- Read-only root filesystem
- All Linux capabilities dropped
- No new privileges flag set
- Memory and CPU limits enforced

**Returns:** `ContainerInfo` with container ID, name, image, status, created timestamp

**Example:**
```typescript
const container = await invoke<ContainerInfo>('create_sandbox_container', {
  image: 'alpine:latest',
  memoryLimit: 256 * 1024 * 1024, // 256MB
  cpuLimit: 0.5 // 50% CPU
});
```

---

#### 3. `execute_in_container(container_id, command, timeout_secs)`

Execute a command inside a running container.

```rust
#[tauri::command]
pub async fn execute_in_container(
    container_id: String,
    command: Vec<String>,
    timeout_secs: u64,
) -> Result<ContainerExecutionResult, String>
```

**Parameters:**
- `container_id` - Container ID from `create_sandbox_container()`
- `command` - Command and arguments as array (e.g., `["ls", "-la", "/"]`)
- `timeout_secs` - Execution timeout in seconds

**Returns:** `ContainerExecutionResult` with:
- `exit_code` - Command exit code (0 = success)
- `stdout` - Standard output
- `stderr` - Standard error
- `execution_time_ms` - Actual execution time in milliseconds

**Example:**
```typescript
const result = await invoke<ContainerExecutionResult>('execute_in_container', {
  containerId: container.id,
  command: ['echo', 'hello world'],
  timeoutSecs: 10
});

console.log('Exit code:', result.exit_code);
console.log('Output:', result.stdout);
```

---

#### 4. `stop_container(container_id)`

Stop a running container gracefully (10 second timeout before force kill).

```rust
#[tauri::command]
pub async fn stop_container(container_id: String) -> Result<(), String>
```

**Example:**
```typescript
await invoke('stop_container', { containerId: container.id });
```

---

#### 5. `remove_container(container_id)`

Remove a container (stops it first if running).

```rust
#[tauri::command]
pub async fn remove_container(container_id: String) -> Result<(), String>
```

**Example:**
```typescript
await invoke('remove_container', { containerId: container.id });
```

---

#### 6. `list_sandbox_containers()`

List all Athena sandbox containers (names starting with "athena-sandbox-").

```rust
#[tauri::command]
pub async fn list_sandbox_containers() -> Result<Vec<ContainerInfo>, String>
```

**Returns:** Array of `ContainerInfo` objects

**Example:**
```typescript
const containers = await invoke<ContainerInfo[]>('list_sandbox_containers');
for (const container of containers) {
  console.log(`${container.name}: ${container.status}`);
}
```

---

#### 7. `get_container_logs(container_id)`

Retrieve logs from a container (last 1000 lines).

```rust
#[tauri::command]
pub async fn get_container_logs(container_id: String) -> Result<String, String>
```

**Returns:** Combined stdout/stderr logs as string

**Example:**
```typescript
const logs = await invoke<string>('get_container_logs', { containerId: container.id });
console.log('Container logs:', logs);
```

---

## Frontend Service

The `ContainerService` TypeScript class provides a convenient wrapper around the Tauri commands.

### Import

```typescript
import { ContainerService } from '@/services/containerService';
```

### Basic Usage

```typescript
// Check if Docker is available
const dockerAvailable = await ContainerService.checkDockerAvailable();
if (!dockerAvailable) {
  alert('Docker is not running. Please start Docker Desktop.');
  return;
}

// Create a sandbox container
const container = await ContainerService.createSandboxContainer(
  'alpine:latest',
  256 * 1024 * 1024, // 256MB
  0.5 // 50% CPU
);

try {
  // Execute commands
  const result = await ContainerService.executeInContainer(
    container.id,
    ['ls', '-la', '/'],
    30 // 30 second timeout
  );

  console.log('Output:', result.stdout);
} finally {
  // Always cleanup
  await ContainerService.removeContainer(container.id);
}
```

### Malware Analysis Example

```typescript
async function analyzeMalwareSample(samplePath: string) {
  const dockerAvailable = await ContainerService.checkDockerAvailable();
  if (!dockerAvailable) {
    throw new Error('Docker is required for malware analysis');
  }

  // Run analysis in isolated container
  const result = await ContainerService.runMalwareAnalysis(
    samplePath,
    ['python3', '/opt/analyze.py', samplePath],
    600 // 10 minute timeout
  );

  if (result.exit_code === 0) {
    console.log('Analysis successful');
    console.log('Results:', result.stdout);
  } else {
    console.error('Analysis failed:', result.stderr);
  }
}
```

### File Analysis Example

```typescript
async function quickFileAnalysis(filePath: string) {
  const { container, result } = await ContainerService.analyzeFileInSandbox(
    filePath,
    'alpine:latest',
    256 * 1024 * 1024, // 256MB
    0.5, // 50% CPU
    60 // 1 minute timeout
  );

  console.log('File type:', result.stdout);
  // Container is automatically cleaned up
}
```

---

## Security Considerations

### Container Security

1. **Network Isolation**: Containers have `network_mode: "none"` and `network_disabled: true` to prevent network access
2. **Read-only Filesystem**: Root filesystem is read-only to prevent malware persistence
3. **Dropped Capabilities**: All Linux capabilities are dropped
4. **No New Privileges**: Prevents privilege escalation
5. **Resource Limits**: Memory and CPU limits prevent resource exhaustion

### Best Practices

1. **Always cleanup containers**: Use try/finally blocks to ensure containers are removed
2. **Use timeouts**: Set appropriate execution timeouts to prevent hanging
3. **Monitor resources**: Check container resource usage periodically
4. **Validate outputs**: Sanitize and validate all data from containers before display
5. **Use minimal images**: Prefer small base images (alpine) for faster startup

### Limitations

1. **Not a full sandbox**: Containers provide isolation but not complete security
2. **Kernel vulnerabilities**: Container escape vulnerabilities may exist
3. **Docker dependency**: Requires Docker to be installed and running
4. **Resource overhead**: Each container has startup/shutdown overhead

---

## Docker Images for Malware Analysis

### Recommended Base Images

1. **alpine:latest** (5MB)
   - Minimal Linux distribution
   - Fast startup
   - Good for basic analysis

2. **ubuntu:22.04** (~77MB)
   - Full Ubuntu environment
   - More tools available
   - Good for complex analysis

3. **remnux/remnux-distro** (~4GB)
   - Specialized malware analysis distribution
   - Pre-installed analysis tools
   - Best for professional analysis

### Custom Analysis Image

Create a Dockerfile for your analysis environment:

```dockerfile
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    file \
    binutils \
    strace \
    ltrace \
    && rm -rf /var/lib/apt/lists/*

COPY analyze.py /opt/analyze.py
RUN chmod +x /opt/analyze.py

CMD ["/bin/bash"]
```

Build and use:
```bash
docker build -t athena-analyzer:latest .
```

```typescript
const container = await ContainerService.createSandboxContainer(
  'athena-analyzer:latest',
  512 * 1024 * 1024,
  1.0
);
```

---

## Troubleshooting

### Docker Not Available

**Error:** `Failed to connect to Docker: ... Is Docker running?`

**Solution:**
1. Check Docker Desktop/daemon is running: `docker ps`
2. On Linux, ensure user is in docker group: `groups`
3. Try starting Docker: `sudo systemctl start docker` (Linux)

### Permission Denied

**Error:** `permission denied while trying to connect to the Docker daemon socket`

**Solution (Linux):**
```bash
sudo usermod -aG docker $USER
# Logout and login again
```

### Container Creation Slow

**Issue:** First container creation is slow

**Explanation:** Docker is pulling the image. Subsequent creations are fast.

**Solution:** Pre-pull images:
```bash
docker pull alpine:latest
docker pull ubuntu:22.04
```

### Out of Disk Space

**Error:** `no space left on device`

**Solution:** Clean up old containers and images:
```bash
docker system prune -a
```

---

## Implementation Details

### Files Modified/Created

1. **Backend:**
   - `/athena-v2/src-tauri/Cargo.toml` - Added `bollard = "0.16"` dependency
   - `/athena-v2/src-tauri/src/commands/container.rs` - Container commands implementation
   - `/athena-v2/src-tauri/src/commands/mod.rs` - Added `pub mod container;`
   - `/athena-v2/src-tauri/src/main.rs` - Registered 7 container commands

2. **Frontend:**
   - `/athena-v2/src/services/containerService.ts` - TypeScript service wrapper

### Dependencies

- **bollard 0.16** - Docker client for Rust
  - Uses hyper for HTTP communication with Docker daemon
  - Async/await with tokio
  - Full Docker API support

### Error Handling

All commands follow the Rust backend standards:
- Return `Result<T, String>` for Tauri compatibility
- User-friendly error messages
- Proper async/await with tokio
- No `.unwrap()` in production paths

---

## Testing

### Manual Testing

```bash
# 1. Start Docker
docker info

# 2. Build and run Athena
cd athena-v2
npm run tauri:dev

# 3. Test from DevTools console
const available = await window.__TAURI__.invoke('check_docker_available');
console.log('Docker available:', available);

const container = await window.__TAURI__.invoke('create_sandbox_container', {
  image: 'alpine:latest',
  memoryLimit: 268435456,
  cpuLimit: 0.5
});
console.log('Container:', container);

await window.__TAURI__.invoke('remove_container', {
  containerId: container.id
});
```

### Integration Tests

The container module includes integration tests (marked with `#[ignore]` as they require Docker):

```bash
cd athena-v2/src-tauri
cargo test --test '*' -- --ignored --test-threads=1
```

---

## Future Enhancements

1. **Volume mounting** for file transfer in/out of containers
2. **Custom networks** for controlled network analysis
3. **Container snapshots** for state preservation
4. **GPU support** for accelerated analysis
5. **Kubernetes support** for distributed analysis
6. **Pre-built analysis images** bundled with Athena

---

## License & Security Notice

This container implementation is part of Athena, an AI-powered malware analysis platform.

**Security Warning:** Container isolation is not foolproof. Always:
- Run on isolated analysis machines
- Use proper network segmentation
- Keep Docker and host OS updated
- Follow your organization's security policies

For production malware analysis, consider additional layers:
- Dedicated analysis VMs/bare metal
- Network-isolated analysis networks
- Regular security audits
- Incident response procedures
