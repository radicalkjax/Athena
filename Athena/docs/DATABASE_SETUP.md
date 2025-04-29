# PostgreSQL Database Setup for Athena

This document provides instructions for setting up and using the PostgreSQL database with the Athena application.

## Prerequisites

- PostgreSQL server installed and running
- Node.js and npm installed
- Athena project cloned and dependencies installed

## Database Configuration

The database connection is configured using environment variables in the `.env` file:

```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=athena_db
DB_USER=postgres
DB_PASSWORD=postgres
DB_DIALECT=postgres
```

You can modify these values to match your PostgreSQL server configuration.

## Database Setup

### Option 1: Automated Setup (Recommended)

The easiest way to set up the PostgreSQL database is using the automated setup script:

```bash
npm run db:setup
```

This script will:
1. Check if Docker and Docker Compose are installed
2. Create a `.env` file from `.env.example` if it doesn't exist
3. Start the PostgreSQL and pgAdmin containers
4. Create the database
5. Initialize the database schema
6. Run a test to verify the setup
7. Display connection information

### Option 2: Manual Setup with Docker Compose

If you prefer to set up the database manually with Docker Compose:

1. Make sure Docker and Docker Compose are installed on your system
2. Start the PostgreSQL database and pgAdmin:

```bash
npm run db:start
```

This will:
- Start a PostgreSQL container with the configuration from your .env file
- Start a pgAdmin container for database management
- Create a Docker network for the containers to communicate
- Mount volumes for data persistence

To stop the database:

```bash
npm run db:stop
```

You can access pgAdmin at http://localhost:5050 (or the port specified in your .env file) with the credentials from your .env file.

After starting the containers, you need to:

1. Create the Database:

```bash
npm run db:create
```

2. Initialize the Database:

```bash
npm run init-db
```

### Option 3: Using an Existing PostgreSQL Server

If you already have PostgreSQL installed or prefer not to use Docker:

1. Create the Database:

```bash
npm run db:create
```

This script will:
- Connect to the PostgreSQL server using the provided credentials
- Check if the database already exists
- Create the database if it doesn't exist

2. Initialize the Database:

Run the following command to initialize the database schema:

```bash
npm run init-db
```

This script will:
- Connect to the database
- Create all the necessary tables based on the defined models
- Set up relationships between tables

## Testing the Database

To test the database implementation:

```bash
npm run db:test
```

This script will:
- Initialize the database
- Create container configurations for Windows, Linux, and macOS
- Create container instances for each OS
- Retrieve and display all container configurations and instances

## Database Models

The Athena application uses the following database models:

### Container

Stores information about container instances:

- `id`: UUID (primary key)
- `status`: Container status (creating, running, stopped, error)
- `malwareId`: ID of the malware file being analyzed
- `error`: Error message (if any)
- `os`: Operating system (windows, linux, macos)
- `architecture`: CPU architecture (x86, x64, arm, arm64)
- `version`: OS version
- `imageTag`: Docker image tag
- `distribution`: Linux distribution (for Linux containers)
- `configId`: Reference to container configuration

### ContainerConfig

Stores container configuration information:

- `id`: UUID (primary key)
- `os`: Operating system (windows, linux, macos)
- `architecture`: CPU architecture (x86, x64, arm, arm64)
- `version`: OS version
- `imageTag`: Docker image tag
- `distribution`: Linux distribution (for Linux containers)

### ContainerResource

Stores container resource limits:

- `id`: UUID (primary key)
- `cpu`: CPU cores
- `memory`: Memory in MB
- `diskSpace`: Disk space in MB
- `networkSpeed`: Network speed in Mbps
- `ioOperations`: I/O operations per second
- `configId`: Reference to container configuration

### ContainerSecurity

Stores container security options:

- `id`: UUID (primary key)
- `readOnlyRootFilesystem`: Whether the root filesystem is read-only
- `noNewPrivileges`: Whether new privileges are disabled
- `seccomp`: Whether seccomp is enabled
- `appArmor`: Whether AppArmor is enabled
- `addressSpaceLayoutRandomization`: Whether ASLR is enabled
- Various OS-specific security options
- `configId`: Reference to container configuration

## Database Service

The `database.ts` service provides functions for interacting with the database:

### Container Configuration

- `createContainerConfig`: Create a new container configuration
- `getContainerConfigById`: Get a container configuration by ID
- `getAllContainerConfigs`: Get all container configurations
- `updateContainerConfig`: Update a container configuration
- `deleteContainerConfig`: Delete a container configuration

### Container

- `createContainer`: Create a new container
- `getContainerById`: Get a container by ID
- `getAllContainers`: Get all containers
- `updateContainer`: Update a container
- `deleteContainer`: Delete a container

## Usage Example

```typescript
import { createContainerConfig, createContainer } from '../services/database';

// Create a container configuration
const containerConfig = await createContainerConfig(
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

// Create a container
const container = await createContainer({
  status: 'creating',
  malwareId: 'malware-123',
  os: 'windows',
  architecture: 'x64',
  version: 'windows-10',
  imageTag: 'windows-10-x64:latest',
  configId: containerConfig.id,
});
```

## Troubleshooting

### Connection Issues

If you encounter connection issues, check the following:

1. Ensure PostgreSQL server is running
2. Verify the connection details in the `.env` file
3. Check if the database exists
4. Ensure the user has appropriate permissions

### Schema Issues

If you encounter schema issues, try the following:

1. Drop and recreate the database
2. Run the initialization script again
3. Check the console for error messages
