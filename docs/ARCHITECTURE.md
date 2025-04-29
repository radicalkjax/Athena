# Athena Architecture Documentation

> **IMPORTANT DISCLAIMER:** The containerization and analysis components described in this documentation are still being designed and developed. Their current implementation and documentation are not reflective of what the final design could be. This documentation represents a conceptual overview and may change significantly as development progresses.

This document provides a detailed overview of Athena's architecture, explaining how the different components work together to provide a secure and efficient malware analysis platform.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Component Structure](#component-structure)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Services Layer](#services-layer)
- [Cross-Platform Implementation](#cross-platform-implementation)
- [Security Architecture](#security-architecture)

## Overview

Athena is built using React Native with Expo, enabling cross-platform compatibility across iOS, Android, and web platforms. The application follows a modular architecture with clear separation of concerns, making it maintainable and extensible.

## System Architecture

The high-level architecture of Athena consists of the following layers:

```mermaid
flowchart TD
    A[User Interface Layer] --> B[State Management Layer]
    B --> C[Services Layer]
    C --> D[External APIs]
    C --> E[Local Storage]
    C --> F[Container Execution]
```

- **User Interface Layer**: React Native components that make up the application's UI
- **State Management Layer**: Zustand store for managing application state
- **Services Layer**: Business logic and integration with external systems
- **External APIs**: Integration with AI model APIs (OpenAI, Claude, DeepSeek)
- **Local Storage**: Persistent storage for files, analysis results, and settings
- **Container Execution**: Isolated environment for running malware analysis

## Component Structure

Athena is built with a component-based architecture, with reusable UI components that can be composed to create complex interfaces.

```mermaid
flowchart TD
    A[App] --> B[Navigation]
    B --> C[Tab Navigator]
    C --> D[Home Screen]
    C --> E[Settings Screen]
    C --> F[About Screen]
    
    D --> G[AIModelSelector]
    D --> H[FileUploader]
    D --> I[AnalysisResults]
    
    G --> G1[ThemedView]
    G --> G2[ThemedText]
    
    H --> H1[ThemedView]
    H --> H2[ThemedText]
    
    I --> I1[ThemedView]
    I --> I2[ThemedText]
```

### Key Components

#### AIModelSelector

The AIModelSelector component allows users to select from available AI models for analysis.

- Displays a list of configured AI models (cloud and local)
- Checks for API key availability for cloud models
- Allows selection of a model for analysis

#### FileUploader

The FileUploader component handles file selection and management, with separate implementations for web and native platforms.

- **Web Implementation**: Uses the browser's File API to select files
- **Native Implementation**: Uses Expo's DocumentPicker and FileSystem APIs

#### AnalysisResults

The AnalysisResults component displays the results of malware analysis in three tabs:

- **Deobfuscated Code**: Shows the cleaned, readable version of the malware code
- **Analysis Report**: Provides a detailed report of the analysis findings
- **Vulnerabilities**: Lists detected vulnerabilities with severity ratings and details

## Data Flow

The application follows a unidirectional data flow pattern, where user actions trigger state changes through the Zustand store, which then propagate to the UI components.

```mermaid
sequenceDiagram
    User->>UI: Select AI Model
    UI->>Store: Update Selected Model
    User->>UI: Upload File
    UI->>Services: Handle File Upload
    Services->>Store: Add File to Store
    User->>UI: Click Analyze
    UI->>Services: Run Analysis
    
    alt Cloud AI Model
        Services->>External APIs: Send to Cloud AI Model
        External APIs->>Services: Return Results
    else Local AI Model
        Services->>Local Model: Send to Local Model API
        Local Model->>Services: Return Results
    end
    
    Services->>Store: Add Analysis Result
    Store->>UI: Update UI with Results
    UI->>User: Display Analysis Results
```

## State Management

Athena uses Zustand for state management, providing a simple and efficient way to manage application state.

```mermaid
flowchart LR
    A[Zustand Store] --> B[AI Models State]
    A --> C[Malware Files State]
    A --> D[Analysis Results State]
    A --> E[Containers State]
    A --> F[Settings State]
    A --> G[UI State]
    
    B --> B1[Cloud Models]
    B --> B2[Local Models]
    
    B1 --> B1a[OpenAI]
    B1 --> B1b[Claude]
    B1 --> B1c[DeepSeek]
    
    B2 --> B2a[Model Config]
    B2 --> B2b[API Settings]
```

The store is structured into several slices:

- **AI Models**: Manages available AI models and the currently selected model
- **Malware Files**: Manages uploaded malware files and the currently selected file
- **Analysis Results**: Stores analysis results and the currently selected result
- **Containers**: Manages container instances for isolated malware execution
- **Settings**: Stores application settings and preferences
- **UI State**: Manages UI-related state such as loading indicators

The store is persisted using AsyncStorage, allowing the application to maintain state across sessions.

## Services Layer

The services layer provides a clean API for interacting with external systems and performing business logic.

```mermaid
flowchart TD
    A[Analysis Service] --> B[OpenAI Service]
    A --> C[Claude Service]
    A --> D[DeepSeek Service]
    A --> E[Local Models Service]
    A --> F[Container Service]
    A --> G[File Manager Service]
    A --> H[Metasploit Service]
    
    E --> E1[Local Model Config]
    E --> E2[Model Execution]
    E --> E3[API Integration]
    
    E1 --> E1a[Config Storage]
    E1 --> E1b[Model Discovery]
    
    E2 --> E2a[Deobfuscation]
    E2 --> E2b[Vulnerability Analysis]
    
    E3 --> E3a[API Endpoints]
    E3 --> E3b[Request Handling]
```

### Key Services

#### Analysis Service

The Analysis Service orchestrates the malware analysis process, coordinating between different AI models, container execution, and result processing.

Key functions:
- `runAnalysis`: Runs a full analysis on a malware file
- `deobfuscateCode`: Deobfuscates code using the selected AI model
- `analyzeVulnerabilities`: Analyzes code for vulnerabilities

#### AI Model Services (OpenAI, Claude, DeepSeek)

These services handle communication with external AI model APIs, providing a consistent interface for deobfuscation and vulnerability analysis.

Key functions:
- `deobfuscateCode`: Sends code to the AI model for deobfuscation
- `analyzeVulnerabilities`: Sends code to the AI model for vulnerability analysis
- API key management functions

#### Container Service

The Container Service manages isolated container environments for safer malware analysis.

Key functions:
- `createContainer`: Creates a new container for malware analysis
- `runMalwareAnalysis`: Runs analysis within the container
- `getContainerStatus`: Checks the status of a container

#### File Manager Service

The File Manager Service handles file operations, with platform-specific implementations for web and native platforms.

Key functions:
- `pickFile`: Opens a file picker dialog
- `readFileContent`: Reads the content of a file
- `saveAnalysisResult`: Saves analysis results to a file

#### Metasploit Service

The Metasploit Service integrates with the Metasploit database to provide additional context about identified vulnerabilities.

Key functions:
- `enrichVulnerabilityData`: Adds Metasploit module information to vulnerabilities
- `hasMetasploitConfig`: Checks if Metasploit is configured

## Cross-Platform Implementation

Athena is designed to work across multiple platforms, with platform-specific implementations where necessary.

```mermaid
flowchart TD
    A[Cross-Platform Code] --> B[Platform-Specific Code]
    
    B --> C[Web Implementation]
    B --> D[Native Implementation]
    
    C --> C1[Web File Handling]
    C --> C2[Web UI Components]
    
    D --> D1[Native File Handling]
    D --> D2[Native UI Components]
```

Platform-specific implementations are used for:

- **File Handling**: Different APIs are used for file selection and management on web and native platforms
- **UI Components**: Some UI components have platform-specific implementations
- **Storage**: Different storage mechanisms are used on web and native platforms

## Security Architecture

Athena implements several security measures to protect sensitive data and provide a secure environment for malware analysis.

```mermaid
flowchart TD
    A[Security Features] --> B[API Key Security]
    A --> C[Container Isolation]
    A --> D[Input Sanitization]
    A --> E[Secure Storage]
    
    B --> B1[Environment Variables]
    B --> B2[AsyncStorage]
    B --> B3[Memory Cache]
    
    E --> E1[Secure API Key Storage]
    E --> E2[File Isolation]
```

### API Key Security

The API key security implementation uses a multi-layered approach:

1. **Environment Variables**: API keys are primarily stored in `.env` files which are excluded from version control
2. **AsyncStorage**: For keys entered through the UI, secure AsyncStorage is used for persistence
3. **Memory Cache**: During runtime, keys are cached in memory for efficient access
4. **Fallback Mechanism**: The system checks environment variables first, then AsyncStorage if needed

### Container Isolation

Malware analysis can be performed in isolated containers to prevent potentially harmful code from affecting the host system. The container isolation feature provides a secure environment for executing and analyzing potentially harmful code.

```mermaid
flowchart TD
    A[Container Isolation] --> B[Container Manager]
    A --> C[Resource Management]
    A --> D[OS-Specific Containers]
    A --> E[Security Boundaries]
    
    B --> B1[Container Creation]
    B --> B2[Container Monitoring]
    B --> B3[Container Destruction]
    
    C --> C1[Resource Presets]
    C --> C2[Custom Resource Limits]
    C --> C3[System Requirements Check]
    
    D --> D1[Windows Containers]
    D --> D2[Linux Containers]
    D --> D3[macOS Containers]
    
    D1 --> D1a[x86 Architecture]
    D1 --> D1b[x64 Architecture]
    D1 --> D1c[ARM Architecture]
    D1 --> D1d[ARM64 Architecture]
    
    D2 --> D2a[Multiple Distributions]
    D2 --> D2b[Multiple Versions]
    
    D3 --> D3a[Intel-based macOS]
    D3 --> D3b[Apple Silicon-based macOS]
    
    E --> E1[Filesystem Isolation]
    E --> E2[Network Isolation]
    E --> E3[Process Isolation]
```

#### Container Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant AnalysisService
    participant ContainerService
    participant Container
    participant AIModel
    
    User->>AnalysisService: Request Analysis with Container Isolation
    AnalysisService->>ContainerService: Create Container
    ContainerService->>Container: Initialize Container
    
    AnalysisService->>ContainerService: Upload Malware File
    ContainerService->>Container: Store File
    
    AnalysisService->>ContainerService: Run Analysis
    ContainerService->>Container: Execute Malware (Controlled)
    Container->>Container: Monitor Behavior
    
    Container->>ContainerService: Collect Behavior Data
    ContainerService->>AnalysisService: Return Behavior Data
    
    AnalysisService->>AIModel: Send Code + Behavior Data
    AIModel->>AnalysisService: Return Analysis Results
    
    AnalysisService->>ContainerService: Destroy Container
    ContainerService->>Container: Terminate
    
    AnalysisService->>User: Display Results
```

#### OS-Specific Resource Management

The container isolation feature includes OS-specific resource management to ensure optimal performance for each operating system:

```mermaid
graph TD
    A[Resource Management] --> B[Windows Resources]
    A --> C[Linux Resources]
    A --> D[macOS Resources]
    
    B --> B1[Minimal: 1 CPU, 2GB RAM]
    B --> B2[Standard: 2 CPU, 4GB RAM]
    B --> B3[Performance: 4 CPU, 8GB RAM]
    B --> B4[Intensive: 8 CPU, 16GB RAM]
    
    C --> C1[Minimal: 0.5 CPU, 1GB RAM]
    C --> C2[Standard: 1 CPU, 2GB RAM]
    C --> C3[Performance: 2 CPU, 4GB RAM]
    C --> C4[Intensive: 4 CPU, 8GB RAM]
    
    D --> D1[Minimal: 2 CPU, 4GB RAM]
    D --> D2[Standard: 4 CPU, 8GB RAM]
    D --> D3[Performance: 6 CPU, 12GB RAM]
    D --> D4[Intensive: 8 CPU, 16GB RAM]
```

#### Container Service Integration

The Container Service integrates with the Analysis Service to provide a seamless experience for users:

```mermaid
flowchart TD
    A[Analysis Service] --> B[Container Service]
    A --> C[AI Model Services]
    
    B --> B1[Container Creation]
    B --> B2[Container Execution]
    B --> B3[Container Monitoring]
    B --> B4[Container Destruction]
    
    B1 --> B1a[Windows Container]
    B1 --> B1b[Linux Container]
    B1 --> B1c[macOS Container]
    
    B2 --> B2a[File Transfer]
    B2 --> B2b[Command Execution]
    B2 --> B2c[Behavior Monitoring]
    
    B3 --> B3a[Status Checking]
    B3 --> B3b[Log Collection]
    B3 --> B3c[Resource Monitoring]
    
    C --> C1[OpenAI Service]
    C --> C2[Claude Service]
    C --> C3[DeepSeek Service]
    C --> C4[Local Models Service]
```

This approach provides an additional layer of security when analyzing potentially dangerous malware samples, while also offering flexibility in terms of target environment selection and resource allocation.
