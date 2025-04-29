# Container Monitoring System

The Container Monitoring System in Athena provides comprehensive monitoring of containers used for malware analysis. This document describes the monitoring system's architecture, features, and usage.

## Overview

The monitoring system tracks various aspects of container activity during malware analysis:

1. **Resource Usage**: CPU, memory, disk, and network usage
2. **Network Activity**: Inbound and outbound connections, protocols, and data transfer
3. **File System Activity**: File creation, modification, deletion, and access
4. **Process Activity**: Process creation, termination, and resource usage

All monitoring data is stored in a PostgreSQL database for later analysis and reporting.

## Architecture

The monitoring system consists of several components:

### Database Models

- **ContainerMonitoring**: Stores container resource usage metrics
- **NetworkActivity**: Stores detailed network connection information
- **FileActivity**: Stores file system operations
- **ProcessActivity**: Stores process lifecycle and resource usage

### Services

- **monitoring.ts**: Core monitoring service that collects and stores monitoring data
- **container-db.ts**: Integration with container service and database
- **analysisService.ts**: Integration with analysis workflow

## Features

### Real-time Monitoring

- Automatic monitoring of containers when they are created or transition to running state
- Configurable monitoring interval (default: 5 seconds)
- Automatic cleanup of monitoring resources when containers are removed

### Resource Monitoring

- CPU usage percentage
- Memory usage in MB
- Disk usage in MB
- Network inbound/outbound traffic in bytes
- Process count
- Open file count
- Open socket count

### Network Activity Monitoring

- Protocol (TCP, UDP, ICMP, HTTP, HTTPS, DNS)
- Source and destination IP addresses and ports
- Connection direction (inbound/outbound)
- Data size and duration
- Process responsible for the connection
- Connection status (established, closed, blocked, attempted)

### File Activity Monitoring

- Operation type (create, read, write, delete, modify, execute, rename, move)
- File path and type
- File size and permissions
- Process responsible for the operation
- File hash and content (for suspicious files)

### Process Activity Monitoring

- Process ID and parent process ID
- Process name and command line
- User running the process
- Start and end times
- CPU and memory usage
- Process status (running, stopped, terminated, zombie)

### Malicious Activity Detection

- Flagging of suspicious network connections
- Identification of suspicious file operations
- Detection of suspicious processes
- Reason tracking for flagged activities

## Usage

### Starting Monitoring

Monitoring starts automatically when a container is created or transitions to the running state:

```typescript
// Monitoring starts automatically when creating a container
const container = await containerDbService.createContainer(
  malwareId,
  malwareContent,
  malwareName,
  containerConfig
);
```

### Accessing Monitoring Data

#### Get Container Monitoring Summary

```typescript
const summary = await containerDbService.getContainerMonitoringSummary(containerId);
console.log(`Average CPU Usage: ${summary.averageCpuUsage}%`);
console.log(`Average Memory Usage: ${summary.averageMemoryUsage} MB`);
console.log(`Total Network Inbound: ${summary.totalNetworkInbound} bytes`);
console.log(`Total Network Outbound: ${summary.totalNetworkOutbound} bytes`);
console.log(`Total File Operations: ${summary.totalFileOperations}`);
console.log(`Total Processes: ${summary.totalProcesses}`);
console.log(`Suspicious Activity Count: ${summary.suspiciousActivityCount}`);
```

#### Get Suspicious Activities

```typescript
const suspiciousActivities = await containerDbService.getSuspiciousActivities(containerId);
console.log(`Suspicious Network Activities: ${suspiciousActivities.networkActivities.length}`);
console.log(`Suspicious File Activities: ${suspiciousActivities.fileActivities.length}`);
console.log(`Suspicious Process Activities: ${suspiciousActivities.processActivities.length}`);
```

#### Get Detailed Activity Data

```typescript
// Get network activity
const networkActivities = await containerDbService.getNetworkActivityByContainerId(containerId);

// Get file activity
const fileActivities = await containerDbService.getFileActivityByContainerId(containerId);

// Get process activity
const processActivities = await containerDbService.getProcessActivityByContainerId(containerId);
```

### Integration with Analysis Results

The monitoring data is automatically included in the analysis results:

- Container monitoring summary
- Suspicious activities
- Detailed network, file, and process activity

## Security Considerations

The monitoring system is designed with security in mind:

- All monitoring is performed within the isolated container environment
- Monitoring data is stored securely in the database
- Suspicious activities are flagged for further investigation
- Monitoring is automatically stopped when containers are removed

## Performance Considerations

- Monitoring interval is configurable to balance between detail and performance
- Monitoring data is stored efficiently in the database
- Pagination is supported for retrieving large amounts of monitoring data

## Future Enhancements

- Machine learning-based anomaly detection
- Real-time alerts for suspicious activities
- Integration with external threat intelligence feeds
- Custom monitoring rules and thresholds
- Visualization of monitoring data
