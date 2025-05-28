# Container Monitoring Component

The `ContainerMonitoring` component provides a comprehensive UI for monitoring container activity during malware analysis. This document describes the component's features, usage, and integration with the monitoring system.

## Overview

The `ContainerMonitoring` component displays real-time monitoring data for a container, including:

- Resource usage summary (CPU, memory, disk, network)
- Suspicious activities detected
- Network activity details
- File system activity details
- Process activity details

The component automatically refreshes the data at regular intervals to provide up-to-date information.

## Usage

### Basic Usage

```tsx
import ContainerMonitoring from '@/components/ContainerMonitoring';

// In your component
<ContainerMonitoring containerId="container-123" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `containerId` | string | (required) | ID of the container to monitor |
| `refreshInterval` | number | 5000 | Interval in milliseconds to refresh monitoring data |

## Features

### Resource Usage Summary

The component displays a summary of container resource usage:

- CPU usage percentage
- Memory usage in MB
- Network inbound/outbound traffic
- File operations count
- Process count
- Suspicious activity count

### Suspicious Activities

If suspicious activities are detected, they are displayed in a dedicated section with collapsible panels for:

- Suspicious network activities
- Suspicious file activities
- Suspicious process activities

Each suspicious activity includes details about why it was flagged as suspicious.

### Network Activity

The component displays detailed information about network connections:

- Protocol (TCP, UDP, etc.)
- Source and destination IP addresses and ports
- Connection direction (inbound/outbound)
- Connection status
- Process responsible for the connection
- Data size

### File Activity

The component displays detailed information about file operations:

- Operation type (create, read, write, etc.)
- File path
- File type
- File size
- File permissions
- Process responsible for the operation

### Process Activity

The component displays detailed information about processes:

- Process name and ID
- Command line
- User running the process
- Process status
- CPU and memory usage

## Integration with Monitoring System

The `ContainerMonitoring` component integrates with the container monitoring system through the `container-db` service. It uses the following functions:

- `getContainerMonitoringSummary`: Gets summary statistics for the container
- `getSuspiciousActivities`: Gets suspicious activities detected in the container
- `getNetworkActivityByContainerId`: Gets detailed network activity
- `getFileActivityByContainerId`: Gets detailed file activity
- `getProcessActivityByContainerId`: Gets detailed process activity

## Styling

The component uses themed components from the Athena design system:

- `ThemedText`: For text elements
- `ThemedView`: For container elements
- `Collapsible`: For collapsible sections

The component adapts to the current theme (light/dark) using the `useThemeColor` hook.

## Example

Here's an example of how to use the `ContainerMonitoring` component in an analysis results screen:

```tsx
import React from 'react';
import { View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import ContainerMonitoring from '@/components/ContainerMonitoring';

const AnalysisResultScreen = ({ route }) => {
  const { containerId } = route.params;
  
  return (
    <View style={{ flex: 1 }}>
      <ThemedText style={{ fontSize: 20, fontWeight: 'bold', padding: 16 }}>
        Container Monitoring
      </ThemedText>
      <ContainerMonitoring 
        containerId={containerId} 
        refreshInterval={3000} 
      />
    </View>
  );
};

export default AnalysisResultScreen;
```

## Performance Considerations

- The component uses pagination for activity data to limit the amount of data loaded at once
- Data is refreshed at regular intervals, which can be adjusted using the `refreshInterval` prop
- Loading states are displayed while data is being fetched
- Error handling is implemented to display error messages if data fetching fails

## Future Enhancements

- Add filtering options for activity data
- Add sorting options for activity data
- Add search functionality for activity data
- Add visualization of resource usage over time
- Add export functionality for monitoring data
