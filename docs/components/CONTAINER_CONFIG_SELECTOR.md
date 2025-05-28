# Container Configuration Selector

The Container Configuration Selector is a UI component that allows users to select and configure container settings for malware analysis. This component provides a user-friendly interface for selecting the operating system, architecture, version, and resource limits for containers.

## Component Architecture

```mermaid
graph TB
    subgraph "Container Config Selector"
        CCS[ContainerConfigSelector<br/>━━━━━━━━<br/>• State Management<br/>• Config Updates<br/>• System Checks]
        
        subgraph "OS Configuration"
            OS[OS Selector<br/>━━━━━━━━<br/>• Windows<br/>• Linux<br/>• macOS]
            ARCH[Architecture<br/>━━━━━━━━<br/>• x86/x64<br/>• ARM/ARM64]
            VER[Version Selector<br/>━━━━━━━━<br/>• OS-specific<br/>• Arch-specific]
            DIST[Distribution<br/>━━━━━━━━<br/>• Linux only<br/>• Multiple distros]
        end
        
        subgraph "Resource Management"
            PRESET[Resource Presets<br/>━━━━━━━━<br/>• Minimal<br/>• Standard<br/>• Performance<br/>• Intensive]
            CUSTOM[Custom Resources<br/>━━━━━━━━<br/>• CPU Cores<br/>• Memory<br/>• Disk Space<br/>• Network<br/>• IOPS]
        end
        
        SUMMARY[Configuration Summary<br/>━━━━━━━━<br/>• Real-time Updates<br/>• System Requirements<br/>• Warnings]
    end
    
    subgraph "External Services"
        CS[Container Service<br/>━━━━━━━━<br/>• Version Lists<br/>• Resource Presets<br/>• System Checks]
        TOAST[Toast Service<br/>━━━━━━━━<br/>• Warnings<br/>• Notifications]
    end
    
    CCS --> OS
    CCS --> ARCH
    CCS --> VER
    CCS --> DIST
    CCS --> PRESET
    CCS --> CUSTOM
    CCS --> SUMMARY
    
    CCS -.-> CS
    CCS -.-> TOAST
    
    style CCS fill:#e1e5ff
    style OS fill:#e1f5e1
    style ARCH fill:#e1f5e1
    style VER fill:#e1f5e1
    style DIST fill:#fff4e1
    style PRESET fill:#e1f5e1
    style CUSTOM fill:#fff4e1
    style SUMMARY fill:#e1e5ff
    style CS fill:#e1e5ff
    style TOAST fill:#ffe4e1
```

## State Management Flow

```mermaid
stateDiagram-v2
    [*] --> Initialize: Component Mount
    
    state Initialize {
        [*] --> LoadInitialConfig
        LoadInitialConfig --> SetDefaultValues: No Initial Config
        LoadInitialConfig --> ApplyInitialConfig: Has Initial Config
        SetDefaultValues --> LoadAvailableOptions
        ApplyInitialConfig --> LoadAvailableOptions
    }
    
    LoadAvailableOptions --> Ready
    
    state Ready {
        [*] --> WaitingForInput
        
        WaitingForInput --> OSChange: Select OS
        WaitingForInput --> ArchChange: Select Architecture
        WaitingForInput --> VersionChange: Select Version
        WaitingForInput --> DistroChange: Select Distribution
        WaitingForInput --> PresetChange: Select Resource Preset
        WaitingForInput --> CustomResource: Adjust Resources
    }
    
    OSChange --> UpdateVersions
    ArchChange --> UpdateVersions
    DistroChange --> UpdateVersions
    
    UpdateVersions --> CheckSystemRequirements
    PresetChange --> CheckSystemRequirements
    CustomResource --> CheckSystemRequirements
    VersionChange --> CheckSystemRequirements
    
    CheckSystemRequirements --> ShowWarning: Requirements Not Met
    CheckSystemRequirements --> UpdateConfig: Requirements Met
    ShowWarning --> UpdateConfig
    
    UpdateConfig --> TriggerCallback
    TriggerCallback --> WaitingForInput
    
    note right of CheckSystemRequirements
        Validates CPU, memory,
        disk space against
        system capabilities
    end note
```

## Features

- OS selection (Windows, Linux, macOS)
- Architecture selection (x86, x64, ARM, ARM64)
- OS version selection based on the selected OS and architecture
- Linux distribution selection when Linux is selected
- Resource configuration with predefined presets and custom options
- Real-time summary of the selected configuration
- System requirements validation with warnings
- Toast notifications for important messages

## Usage

### Basic Usage

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import ContainerConfigSelector from '@/components/ContainerConfigSelector';
import { ContainerConfig } from '@/types';

const MyComponent = () => {
  const [containerConfig, setContainerConfig] = useState<ContainerConfig>({
    os: 'windows',
    architecture: 'x64',
    version: 'windows-10'
  });

  const handleConfigChange = (config: ContainerConfig) => {
    setContainerConfig(config);
    console.log('Container configuration updated:', config);
  };

  return (
    <View style={{ flex: 1 }}>
      <ContainerConfigSelector
        onConfigChange={handleConfigChange}
        initialConfig={containerConfig}
      />
    </View>
  );
};
```

### With Initial Configuration

```tsx
import React, { useState } from 'react';
import { View } from 'react-native';
import ContainerConfigSelector from '@/components/ContainerConfigSelector';
import { ContainerConfig } from '@/types';
import { getResourcePreset } from '@/services/container';

const MyComponent = () => {
  const initialConfig: ContainerConfig = {
    os: 'linux',
    architecture: 'arm64',
    version: 'ubuntu-22.04',
    distribution: 'ubuntu',
    resources: getResourcePreset('performance')
  };

  const handleConfigChange = (config: ContainerConfig) => {
    console.log('Container configuration updated:', config);
    // Do something with the updated configuration
  };

  return (
    <View style={{ flex: 1 }}>
      <ContainerConfigSelector
        onConfigChange={handleConfigChange}
        initialConfig={initialConfig}
      />
    </View>
  );
};
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onConfigChange` | `(config: ContainerConfig) => void` | Yes | Callback function that is called when the container configuration changes |
| `initialConfig` | `Partial<ContainerConfig>` | No | Initial container configuration |

## Integration with Analysis Options

The Container Configuration Selector is designed to be used within the Analysis Options panel. See the `AnalysisOptionsPanel` component for an example of how to integrate the Container Configuration Selector into a larger UI.

```tsx
import React from 'react';
import { View } from 'react-native';
import AnalysisOptionsPanel from '@/components/AnalysisOptionsPanel';
import { AnalysisOptions } from '@/components/AnalysisOptionsPanel';

const MyAnalysisScreen = () => {
  const handleOptionsChange = (options: AnalysisOptions) => {
    console.log('Analysis options updated:', options);
    // Do something with the updated options
  };

  return (
    <View style={{ flex: 1 }}>
      <AnalysisOptionsPanel onOptionsChange={handleOptionsChange} />
    </View>
  );
};
```

## Resource Management

The Container Configuration Selector includes a resource management section that allows users to configure the following resource limits:

- **CPU Cores**: Number of CPU cores allocated to the container (0.5 to 8 cores)
- **Memory**: Amount of RAM in MB allocated to the container (512 MB to 16 GB)
- **Disk Space**: Amount of disk space in MB allocated to the container (1 GB to 50 GB)
- **Network Speed**: Network bandwidth in Mbps allocated to the container (1 to 200 Mbps)
- **I/O Operations**: Maximum I/O operations per second (IOPS) allowed for the container (100 to 20,000 IOPS)

### Resource Presets

The component provides predefined resource presets that are OS-specific to ensure optimal performance for each operating system:

#### Windows Resource Presets

```mermaid
graph TD
    A[Windows Resource Presets] --> B[Minimal]
    A --> C[Standard]
    A --> D[Performance]
    A --> E[Intensive]
    
    B --> B1[CPU: 1 core]
    B --> B2[Memory: 2,048 MB]
    B --> B3[Disk: 8,192 MB]
    B --> B4[Network: 5 Mbps]
    B --> B5[I/O: 500 IOPS]
    
    C --> C1[CPU: 2 cores]
    C --> C2[Memory: 4,096 MB]
    C --> C3[Disk: 10,240 MB]
    C --> C4[Network: 20 Mbps]
    C --> C5[I/O: 2,000 IOPS]
    
    D --> D1[CPU: 4 cores]
    D --> D2[Memory: 8,192 MB]
    D --> D3[Disk: 20,480 MB]
    D --> D4[Network: 50 Mbps]
    D --> D5[I/O: 5,000 IOPS]
    
    E --> E1[CPU: 8 cores]
    E --> E2[Memory: 16,384 MB]
    E --> E3[Disk: 40,960 MB]
    E --> E4[Network: 100 Mbps]
    E --> E5[I/O: 10,000 IOPS]
```

| Preset | CPU Cores | Memory (MB) | Disk Space (MB) | Network Speed (Mbps) | I/O Operations (IOPS) | Use Case |
|--------|-----------|------------|-----------------|---------------------|----------------------|----------|
| Minimal | 1 | 2,048 | 8,192 | 5 | 500 | Simple malware analysis with minimal resource requirements |
| Standard | 2 | 4,096 | 10,240 | 20 | 2,000 | General-purpose malware analysis |
| Performance | 4 | 8,192 | 20,480 | 50 | 5,000 | Complex malware analysis requiring more resources |
| Intensive | 8 | 16,384 | 40,960 | 100 | 10,000 | Advanced malware analysis for resource-intensive samples |

#### Linux Resource Presets

```mermaid
graph TD
    A[Linux Resource Presets] --> B[Minimal]
    A --> C[Standard]
    A --> D[Performance]
    A --> E[Intensive]
    
    B --> B1[CPU: 0.5 core]
    B --> B2[Memory: 1,024 MB]
    B --> B3[Disk: 4,096 MB]
    B --> B4[Network: 5 Mbps]
    B --> B5[I/O: 500 IOPS]
    
    C --> C1[CPU: 1 core]
    C --> C2[Memory: 2,048 MB]
    C --> C3[Disk: 8,192 MB]
    C --> C4[Network: 20 Mbps]
    C --> C5[I/O: 2,000 IOPS]
    
    D --> D1[CPU: 2 cores]
    D --> D2[Memory: 4,096 MB]
    D --> D3[Disk: 10,240 MB]
    D --> D4[Network: 50 Mbps]
    D --> D5[I/O: 5,000 IOPS]
    
    E --> E1[CPU: 4 cores]
    E --> E2[Memory: 8,192 MB]
    E --> E3[Disk: 20,480 MB]
    E --> E4[Network: 100 Mbps]
    E --> E5[I/O: 10,000 IOPS]
```

| Preset | CPU Cores | Memory (MB) | Disk Space (MB) | Network Speed (Mbps) | I/O Operations (IOPS) | Use Case |
|--------|-----------|------------|-----------------|---------------------|----------------------|----------|
| Minimal | 0.5 | 1,024 | 4,096 | 5 | 500 | Simple malware analysis with minimal resource requirements |
| Standard | 1 | 2,048 | 8,192 | 20 | 2,000 | General-purpose malware analysis |
| Performance | 2 | 4,096 | 10,240 | 50 | 5,000 | Complex malware analysis requiring more resources |
| Intensive | 4 | 8,192 | 20,480 | 100 | 10,000 | Advanced malware analysis for resource-intensive samples |

#### macOS Resource Presets

```mermaid
graph TD
    A[macOS Resource Presets] --> B[Minimal]
    A --> C[Standard]
    A --> D[Performance]
    A --> E[Intensive]
    
    B --> B1[CPU: 2 cores]
    B --> B2[Memory: 4,096 MB]
    B --> B3[Disk: 16,384 MB]
    B --> B4[Network: 10 Mbps]
    B --> B5[I/O: 1,000 IOPS]
    
    C --> C1[CPU: 4 cores]
    C --> C2[Memory: 8,192 MB]
    C --> C3[Disk: 20,480 MB]
    C --> C4[Network: 20 Mbps]
    C --> C5[I/O: 2,000 IOPS]
    
    D --> D1[CPU: 6 cores]
    D --> D2[Memory: 12,288 MB]
    D --> D3[Disk: 30,720 MB]
    D --> D4[Network: 50 Mbps]
    D --> D5[I/O: 5,000 IOPS]
    
    E --> E1[CPU: 8 cores]
    E --> E2[Memory: 16,384 MB]
    E --> E3[Disk: 40,960 MB]
    E --> E4[Network: 100 Mbps]
    E --> E5[I/O: 10,000 IOPS]
```

| Preset | CPU Cores | Memory (MB) | Disk Space (MB) | Network Speed (Mbps) | I/O Operations (IOPS) | Use Case |
|--------|-----------|------------|-----------------|---------------------|----------------------|----------|
| Minimal | 2 | 4,096 | 16,384 | 10 | 1,000 | Simple malware analysis with minimal resource requirements |
| Standard | 4 | 8,192 | 20,480 | 20 | 2,000 | General-purpose malware analysis |
| Performance | 6 | 12,288 | 30,720 | 50 | 5,000 | Complex malware analysis requiring more resources |
| Intensive | 8 | 16,384 | 40,960 | 100 | 10,000 | Advanced malware analysis for resource-intensive samples |

Users can also select the "Custom" preset to manually configure each resource limit.

## Configuration Update Flow

```mermaid
sequenceDiagram
    participant User
    participant CCS as ContainerConfigSelector
    participant CS as Container Service
    participant Parent as Parent Component
    participant Toast as Toast Notifications

    User->>CCS: Select OS
    CCS->>CS: getAvailableVersions(os, arch)
    CS-->>CCS: Return version list
    CCS->>CCS: Update available versions
    
    alt Linux OS Selected
        CCS->>CS: getAvailableLinuxDistributions()
        CS-->>CCS: Return distributions
        CCS->>CCS: Show distribution selector
    end
    
    User->>CCS: Select Resource Preset
    alt Preset is not "Custom"
        CCS->>CS: getResourcePreset(preset, os)
        CS-->>CCS: Return preset values
        CCS->>CCS: Apply preset resources
    else Preset is "Custom"
        CCS->>CCS: Show resource sliders
        User->>CCS: Adjust resource values
    end
    
    CCS->>CS: checkSystemRequirements(resources)
    CS-->>CCS: Return requirements check
    
    alt Requirements not met
        CCS->>Toast: Show warning message
        Toast-->>User: Display warning
    end
    
    CCS->>Parent: onConfigChange(config)
    Parent->>Parent: Update analysis options
```

## Mock UI Representation

```mermaid
graph TB
    subgraph "Container Configuration UI"
        OS["<b>Operating System</b> ▼<br/>━━━━━━━━━━━━━━━━━━<br/>Windows"]
        
        ARCH["<b>Architecture</b> ▼<br/>━━━━━━━━━━━━━━━━━━<br/>x64 (64-bit)"]
        
        VER["<b>Windows Version</b> ▼<br/>━━━━━━━━━━━━━━━━━━<br/>Windows 10"]
        
        RES["<b>Resource Configuration</b> ▼<br/>━━━━━━━━━━━━━━━━━━<br/>Standard"]
        
        SUMMARY["<b>Configuration Summary</b><br/>━━━━━━━━━━━━━━━━━━<br/>OS: Windows<br/>Architecture: x64<br/>Version: windows-10<br/>Resource Preset: standard<br/>CPU: 2 cores<br/>Memory: 4096 MB<br/>Disk Space: 10240 MB<br/>Network Speed: 20 Mbps<br/>I/O Operations: 2000 IOPS<br/><br/>✓ System meets requirements"]
    end
    
    OS --> ARCH
    ARCH --> VER
    VER --> RES
    RES --> SUMMARY
    
    style OS fill:#e1f5e1
    style ARCH fill:#e1f5e1
    style VER fill:#e1f5e1
    style RES fill:#e1f5e1
    style SUMMARY fill:#e1e5ff
```

## System Requirements Validation

```mermaid
flowchart LR
    subgraph "Resource Configuration"
        CPU[CPU Cores]
        MEM[Memory]
        DISK[Disk Space]
        NET[Network]
        IO[I/O Operations]
    end
    
    subgraph "System Check"
        CHECK[Check System<br/>Requirements]
        COMPARE[Compare Against<br/>Available Resources]
    end
    
    subgraph "Results"
        PASS[Requirements Met<br/>━━━━━━━━<br/>✓ Show success]
        WARN[Requirements Not Met<br/>━━━━━━━━<br/>⚠️ Show warnings]
    end
    
    CPU --> CHECK
    MEM --> CHECK
    DISK --> CHECK
    NET --> CHECK
    IO --> CHECK
    
    CHECK --> COMPARE
    
    COMPARE --> PASS
    COMPARE --> WARN
    
    WARN --> TOAST[Toast Notification<br/>━━━━━━━━<br/>Display specific<br/>resource warnings]
    
    style CPU fill:#e1e5ff
    style MEM fill:#e1e5ff
    style DISK fill:#e1e5ff
    style NET fill:#e1e5ff
    style IO fill:#e1e5ff
    style CHECK fill:#fff4e1
    style COMPARE fill:#fff4e1
    style PASS fill:#e1f5e1
    style WARN fill:#ffe4e1
    style TOAST fill:#ffe4e1
```

## Custom Resource Configuration

When "Custom" preset is selected, the component displays interactive sliders:

```mermaid
graph TB
    subgraph "Custom Resource Controls"
        CPU["<b>CPU Cores: 2</b><br/>━━━━━━━━━━━━━━<br/>[----■----------] 0.5 → 8"]
        
        MEM["<b>Memory: 4096 MB</b><br/>━━━━━━━━━━━━━━<br/>[-------■-------] 512 → 16384"]
        
        DISK["<b>Disk Space: 10240 MB</b><br/>━━━━━━━━━━━━━━<br/>[-----■---------] 1024 → 51200"]
        
        NET["<b>Network Speed: 20 Mbps</b><br/>━━━━━━━━━━━━━━<br/>[--■------------] 1 → 200"]
        
        IO["<b>I/O Operations: 2000 IOPS</b><br/>━━━━━━━━━━━━━━<br/>[--■------------] 100 → 20000"]
    end
    
    CPU --> MEM
    MEM --> DISK
    DISK --> NET
    NET --> IO
    
    style CPU fill:#fff4e1
    style MEM fill:#fff4e1
    style DISK fill:#fff4e1
    style NET fill:#fff4e1
    style IO fill:#fff4e1
```

## Integration with Container Service

```mermaid
graph LR
    subgraph "ContainerConfigSelector"
        SEL[Selector Component]
    end
    
    subgraph "Container Service API"
        GWV[getAvailableWindowsVersions]
        GLV[getAvailableLinuxVersions]
        GMV[getAvailableMacOSVersions]
        GLD[getAvailableLinuxDistributions]
        GRP[getResourcePreset]
        CSR[checkSystemRequirements]
    end
    
    subgraph "Data Flow"
        SEL --> |OS Change| GWV
        SEL --> |OS Change| GLV
        SEL --> |OS Change| GMV
        SEL --> |Linux Selected| GLD
        SEL --> |Preset Selected| GRP
        SEL --> |Resources Updated| CSR
    end
    
    style SEL fill:#e1e5ff
    style GWV fill:#e1f5e1
    style GLV fill:#e1f5e1
    style GMV fill:#e1f5e1
    style GLD fill:#e1f5e1
    style GRP fill:#fff4e1
    style CSR fill:#ffe4e1
```

## Modernization Benefits

The Phase 9 modernization brings several improvements to the Container Configuration Selector:

- **Real-time Validation**: System requirements are checked in real-time as configurations change
- **Toast Notifications**: Clear warnings when system requirements aren't met
- **Improved State Management**: Efficient updates with proper React hooks
- **Better UX**: Collapsible sections for cleaner interface
- **Type Safety**: Full TypeScript support with strict typing
- **Performance**: Optimized re-renders and efficient state updates
- **Design System Integration**: Uses modernized Card and Toast components

## Example

See the `analysis-options-example.tsx` file for a complete example of how to use the Container Configuration Selector within an analysis options screen.
