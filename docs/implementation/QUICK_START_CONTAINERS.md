# Quick Start: Docker Container Support - Athena v2

**Last Updated**: December 22, 2025
**Status**: Available
**Implementation**: Tauri 2.0 + bollard 0.16

## TL;DR

Athena v2 supports Docker containers for isolated malware analysis using native Tauri commands. Here's how to use it in 5 minutes.

## Prerequisites

### 1. Install Docker

**macOS**:
```bash
# Using Homebrew
brew install --cask docker

# Or download from docker.com
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get update
sudo apt-get install docker.io
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
# Logout and login for group changes to take effect
```

**Windows**:
- Download Docker Desktop from docker.com
- Install and restart Windows
- Ensure WSL2 is enabled

### 2. Verify Docker

```bash
# Check Docker is running
docker info

# Pull test image (optional but recommended)
docker pull alpine:latest
```

## Quick Start (Backend)

### Check Docker Availability

```typescript
import { invoke } from '@tauri-apps/api/core';

const available = await invoke<boolean>('check_docker_available');
console.log('Docker ready:', available);
```

### Create Container

```typescript
const container = await invoke('create_sandbox_container', {
  image: 'alpine:latest',
  memoryLimit: 268435456,  // 256MB
  cpuLimit: 0.5            // 50% CPU
});
```

### Execute Command

```typescript
const result = await invoke('execute_in_container', {
  containerId: container.id,
  command: ['ls', '-la'],
  timeoutSecs: 30
});

console.log('Output:', result.stdout);
console.log('Exit code:', result.exit_code);
```

### Cleanup

```typescript
await invoke('remove_container', { containerId: container.id });
```

## Quick Start (Frontend Service)

### Basic Usage

```typescript
import { ContainerService } from '@/services/containerService';

// Check Docker
if (!await ContainerService.checkDockerAvailable()) {
  alert('Docker not running!');
  return;
}

// Create container
const container = await ContainerService.createSandboxContainer(
  'alpine:latest',
  256 * 1024 * 1024,  // 256MB
  0.5                  // 50% CPU
);

try {
  // Run command
  const result = await ContainerService.executeInContainer(
    container.id,
    ['echo', 'Hello World'],
    30
  );

  console.log(result.stdout);  // "Hello World"
} finally {
  // Always cleanup
  await ContainerService.removeContainer(container.id);
}
```

### Analyze File in Sandbox

```typescript
const { container, result } = await ContainerService.analyzeFileInSandbox(
  '/path/to/file.exe',
  'alpine:latest',
  256 * 1024 * 1024,
  0.5,
  60
);

console.log('File info:', result.stdout);
// Container auto-cleaned up
```

## Quick Start (UI Component)

### 1. Import Component

```typescript
import ContainerSandbox from '@/components/solid/analysis/ContainerSandbox';
import '@/components/solid/analysis/ContainerSandbox.css';
```

### 2. Add to Your App

```tsx
<ContainerSandbox />
```

### 3. Use the UI

1. Verify Docker is running (shown at top)
2. Click "Create Container" with default settings
3. Enter a command like `ls -la`
4. Click "Execute"
5. View output in logs
6. Click "Remove" when done

## Common Commands to Try

```bash
# List files
ls -la /

# Check system info
uname -a

# Network test (will fail - network disabled)
ping google.com

# File operations
echo "test" > /tmp/test.txt
cat /tmp/test.txt
```

## 7 Available Commands

1. `check_docker_available()` - Check if Docker is running
2. `create_sandbox_container()` - Create isolated container
3. `execute_in_container()` - Run command in container
4. `stop_container()` - Stop running container
5. `remove_container()` - Delete container
6. `list_sandbox_containers()` - List all containers
7. `get_container_logs()` - Get container logs

## Security Features

All containers are created with:

- ✅ No network access
- ✅ Read-only filesystem
- ✅ Memory limits
- ✅ CPU limits
- ✅ All capabilities dropped
- ✅ No privilege escalation

## Troubleshooting

### Docker not available?

```bash
# Check if running
docker ps

# Start Docker Desktop (macOS/Windows)
# or
sudo systemctl start docker  # Linux
```

### Permission denied? (Linux only)

```bash
sudo usermod -aG docker $USER
# Then logout and login
```

### Slow container creation?

First time pulls the image (5MB-4GB). Subsequent creates are fast.

Pre-pull images:
```bash
docker pull alpine:latest
docker pull ubuntu:22.04
```

## Real-World Examples

### Example 1: Safe File Analysis

```typescript
const container = await ContainerService.createSandboxContainer(
  'alpine:latest', 256 * 1024 * 1024, 0.5
);

try {
  const result = await ContainerService.executeInContainer(
    container.id,
    ['file', '/suspected/malware.exe'],
    30
  );

  if (result.exit_code === 0) {
    console.log('File type:', result.stdout);
  }
} finally {
  await ContainerService.removeContainer(container.id);
}
```

### Example 2: Behavioral Analysis

```typescript
const result = await ContainerService.runMalwareAnalysis(
  '/samples/trojan.exe',
  ['strace', '-f', './trojan.exe'],
  300  // 5 minutes
);

console.log('System calls made:', result.stdout);
```

### Example 3: Batch Processing

```typescript
const files = ['/sample1.exe', '/sample2.exe', '/sample3.exe'];

for (const file of files) {
  const { result } = await ContainerService.analyzeFileInSandbox(
    file, 'ubuntu:22.04', 512 * 1024 * 1024, 1.0, 120
  );

  console.log(`${file}: ${result.stdout}`);
}
```

## Performance Tips

1. **Pre-pull images** before analysis
2. **Reuse containers** for multiple commands (create once, execute many)
3. **Set appropriate timeouts** (don't wait too long)
4. **Clean up containers** when done (prevents resource leaks)

## File Locations

All container-related code is in the athena-v2 directory:

- **Backend Implementation**: `/Users/kali/Athena/Athena/athena-v2/src-tauri/src/commands/container.rs`
- **Frontend Service**: `/Users/kali/Athena/Athena/athena-v2/src/services/containerService.ts`
- **UI Component**: `/Users/kali/Athena/Athena/athena-v2/src/components/solid/analysis/ContainerSandbox.tsx`
- **Types**: `/Users/kali/Athena/Athena/athena-v2/src/types/container.ts`

## Next Steps

- Read full implementation guide: `/Users/kali/Athena/Athena/docs/implementation/CONTAINER_IMPLEMENTATION.md`
- Review Tauri development guide: `/Users/kali/Athena/Athena/docs/implementation/TAURI_DEVELOPMENT_GUIDE.md`
- See security guidelines: `/Users/kali/Athena/Athena/.claude/rules/security.md`

## Complete Example

```typescript
import { ContainerService } from '@/services/containerService';

async function analyzeSuspiciousFile(filePath: string) {
  // 1. Check Docker
  if (!await ContainerService.checkDockerAvailable()) {
    throw new Error('Docker is required');
  }

  // 2. Create isolated container
  const container = await ContainerService.createSandboxContainer(
    'ubuntu:22.04',
    512 * 1024 * 1024,  // 512MB
    1.0                  // Full CPU
  );

  try {
    // 3. Run file command
    const fileInfo = await ContainerService.executeInContainer(
      container.id,
      ['file', filePath],
      30
    );
    console.log('File type:', fileInfo.stdout);

    // 4. Run strings command
    const strings = await ContainerService.executeInContainer(
      container.id,
      ['strings', filePath],
      60
    );
    console.log('Strings found:', strings.stdout);

    // 5. Check for signatures
    const signature = await ContainerService.executeInContainer(
      container.id,
      ['md5sum', filePath],
      30
    );
    console.log('MD5:', signature.stdout);

    return {
      fileType: fileInfo.stdout,
      strings: strings.stdout,
      md5: signature.stdout
    };
  } finally {
    // 6. Always cleanup
    await ContainerService.removeContainer(container.id);
  }
}

// Usage
analyzeSuspiciousFile('/samples/suspicious.exe')
  .then(result => console.log('Analysis complete:', result))
  .catch(error => console.error('Analysis failed:', error));
```

---

**Ready to use!** All code compiles and is functional.
