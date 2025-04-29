# Container Database Service

This service provides database integration for the container service, allowing container configurations and instances to be stored in a PostgreSQL database.

## Overview

The container-db service extends the functionality of the container service by adding database persistence. It wraps the container service functions and adds database operations to store and retrieve container information.

## Prerequisites

- PostgreSQL database set up and running (see [DATABASE_SETUP.md](../docs/DATABASE_SETUP.md))
- Database initialized with the required tables

## Usage

### Importing the Service

```typescript
import * as containerDbService from './container-db';
```

### Creating Containers

#### Basic Container Creation

```typescript
const container = await containerDbService.createContainer(
  'malware-123',
  malwareBase64Content,
  'malware.bin',
  {
    os: 'windows',
    architecture: 'x64',
    version: 'windows-10',
  }
);
```

#### OS-Specific Container Creation

For Windows:

```typescript
const windowsContainer = await containerDbService.createWindowsContainer(
  'malware-123',
  malwareBase64Content,
  'malware.bin',
  'x64',
  'windows-10'
);
```

For Linux:

```typescript
const linuxContainer = await containerDbService.createLinuxContainer(
  'malware-123',
  malwareBase64Content,
  'malware.bin',
  'x64',
  'ubuntu-22.04'
);
```

For macOS:

```typescript
const macosContainer = await containerDbService.createMacOSContainer(
  'malware-123',
  malwareBase64Content,
  'malware.bin',
  'arm64',
  'macos-14'
);
```

### Container Operations

#### Get Container Status

```typescript
const status = await containerDbService.getContainerStatus(container.id);
```

#### Execute Command in Container

```typescript
const result = await containerDbService.executeCommand(container.id, 'ls -la');
console.log(result.output);
```

#### Run Malware Analysis

```typescript
const analysisResults = await containerDbService.runMalwareAnalysis(container.id);
console.log(analysisResults.logs);
console.log(analysisResults.networkActivity);
console.log(analysisResults.fileActivity);
```

#### Get File from Container

```typescript
const fileContent = await containerDbService.getContainerFile(container.id, '/path/to/file');
```

#### Remove Container

```typescript
await containerDbService.removeContainer(container.id);
```

### Database Operations

#### Get All Containers

```typescript
const containers = await containerDbService.getAllContainers();
```

#### Get Container by ID

```typescript
const container = await containerDbService.getContainerById('container-id');
```

#### Update Container

```typescript
await containerDbService.updateContainer('container-id', { status: 'stopped' });
```

#### Delete Container

```typescript
await containerDbService.deleteContainer('container-id');
```

### Container Configuration Operations

#### Create Container Configuration

```typescript
const config = await containerDbService.createContainerConfig(
  {
    os: 'windows',
    architecture: 'x64',
    version: 'windows-10',
    imageTag: 'windows-10-x64:latest',
  },
  {
    cpu: 2,
    memory: 4096,
    diskSpace: 10240,
    networkSpeed: 20,
    ioOperations: 2000,
  },
  {
    readOnlyRootFilesystem: true,
    noNewPrivileges: true,
    seccomp: true,
    appArmor: true,
    addressSpaceLayoutRandomization: true,
    windowsDefender: true,
    memoryProtection: true,
    controlFlowGuard: true,
  }
);
```

#### Get All Container Configurations

```typescript
const configs = await containerDbService.getAllContainerConfigs();
```

#### Get Container Configuration by ID

```typescript
const config = await containerDbService.getContainerConfigById('config-id');
```

#### Update Container Configuration

```typescript
await containerDbService.updateContainerConfig('config-id', { version: 'windows-11' });
```

#### Delete Container Configuration

```typescript
await containerDbService.deleteDbContainerConfig('config-id');
```

## Security Features

The container-db service includes OS-specific security hardening:

### Windows Security Options

- Windows Defender
- Memory Protection
- Control Flow Guard
- Data Execution Prevention
- Secure Boot
- Hypervisor-enforced Code Integrity

### Linux Security Options

- SELinux
- AppArmor
- Seccomp
- Capabilities
- Namespace Isolation
- Cgroups v2
- Restricted Syscalls

### macOS Security Options

- Sandbox Profile
- Transparency Consent
- System Integrity Protection
- Gatekeeper
- XPC Security
- App Sandbox
- File Quarantine
- Library Validation

## Integration with Analysis Service

The container-db service is integrated with the analysis service to provide database persistence for containers used in malware analysis. The analysis service uses the container-db service to create, manage, and remove containers during the analysis process.

## Error Handling

All functions in the container-db service include error handling to catch and log errors. If an error occurs, the function will throw an error with a descriptive message.

## Database Schema

The container-db service uses the following database models:

- `Container`: Stores container instances
- `ContainerConfig`: Stores container configurations
- `ContainerResource`: Stores container resource limits
- `ContainerSecurity`: Stores container security options

For more information about the database schema, see [DATABASE_SETUP.md](../docs/DATABASE_SETUP.md).
