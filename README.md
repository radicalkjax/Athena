# Athena - AI-Powered Malware Analysis Assistant

Athena is a React Native application designed to help security researchers analyze and deobfuscate malware using various AI models. It provides a secure environment for malware analysis with features like isolated container execution and integration with the Metasploit database.

## Features

> **Note:** Local model functionality is currently disabled to focus on connecting to online AI agents. The codebase includes the infrastructure for local models, but this feature is not active in the current version.

- **Multiple AI Models**: Connect to different AI models including OpenAI GPT-4, Claude 3 Opus, and DeepSeek Coder
- **Secure Container Analysis**: Run malware in an isolated container environment for safer analysis
- **Metasploit Integration**: Access the Metasploit database to identify vulnerabilities and related exploits
- **Deobfuscation**: Convert obfuscated malicious code into readable, understandable code
- **Vulnerability Detection**: Identify potential security vulnerabilities in the analyzed code
- **Cross-Platform**: Works on iOS, Android, and web platforms

## Application Screenshots

### Home Screen

![Home Screen](./Athena/screenshots/home2.png)

The Home screen is the main interface for analyzing malware files. It features:
- AI Model selection
- File upload functionality
- Container isolation option
- Analysis button
- Results display area

### About Screen

![About Screen](./Athena/screenshots/about2.png)

The About screen provides information about Athena and its features:
- Overview of Athena's purpose
- Detailed information about AI models
- Secure container analysis features
- Metasploit integration details
- Security features

### Settings Screen

![Settings Screen](./Athena/screenshots/settings2.png)

The Settings screen allows configuration of API keys and other settings:
- OpenAI API key configuration
- Claude API key configuration
- DeepSeek API key configuration
- Local model settings
- Save and clear options

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the app:
   ```bash
   npx expo start
   ```

3. Open the app in your preferred environment:
   - iOS simulator
   - Android emulator
   - Web browser
   - Expo Go app on a physical device

## Technical Documentation

### Architecture Overview

Athena follows a modular architecture with clear separation of concerns. The application is built using React Native with Expo, enabling cross-platform compatibility across iOS, Android, and web platforms.

```mermaid
flowchart TD
    A[User Interface] --> B[State Management]
    B --> C[Services Layer]
    C --> D[API Client]
    C --> E[Local Storage]
    D --> F[External APIs]
    
    subgraph "Core Architecture"
        A
        B
        C
    end
    
    subgraph "External Communication"
        D
        F
    end
    
    subgraph "Persistence"
        E
    end
```

### Data Flow

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
        Services->>API Client: Prepare Request
        API Client->>API Client: Sanitize Data
        API Client->>API Client: Add Auth Headers
        API Client->>External APIs: Send to Cloud API
        External APIs->>API Client: Return Response
        API Client->>API Client: Handle Errors
        API Client->>Services: Return Results
    else Local AI Model
        Services->>API Client: Prepare Request
        API Client->>Local Model: Send to Local Model API
        Local Model->>API Client: Return Results
        API Client->>Services: Return Results
    end
    
    Services->>Store: Add Analysis Result
    Store->>UI: Update UI with Results
    UI->>User: Display Analysis Results
```

### Component Structure

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
```

### State Management

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

### Services Layer

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
    
    I[API Client] --> I1[Client Factory]
    I --> I2[Request Interceptors]
    I --> I3[Response Interceptors]
    I --> I4[Error Handling]
    I --> I5[Client Cache]
    
    I1 --> B
    I1 --> C
    I1 --> D
    I1 --> E
    I1 --> F
    I1 --> H
    
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

#### API Client Architecture

Athena uses a centralized API client architecture to provide consistent, secure, and efficient communication with various APIs. The architecture includes:

- A configurable axios instance factory with built-in interceptors for authentication, logging, and error handling
- Specialized client factories for each API (OpenAI, Claude, DeepSeek, etc.)
- Utility functions for safe API calls and request data sanitization
- Caching mechanism to avoid recreating clients unnecessarily

For detailed documentation on the API client architecture and service implementations, see the [Services README](./Athena/services/README.md).

### Cross-Platform Implementation

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

### Security Architecture

Athena implements several security measures to protect sensitive data and provide a secure environment for malware analysis.

```mermaid
flowchart TD
    A[Security Features] --> B[API Key Security]
    A --> C[Container Isolation]
    A --> D[Input Sanitization]
    A --> E[Secure Storage]
    
    B --> B1[Secure API Key Storage]
    B --> B2[API Key Validation]
    
    D --> D1[Request Data Sanitization]
    D --> D2[Response Validation]
    
    F[API Client Security] --> F1[Request Interceptors]
    F --> F2[Error Handling]
    F --> F3[Logging Controls]
    
    F1 --> B
    F1 --> D
```

## Key Components

### FileUploader

The FileUploader component handles file selection and management, with separate implementations for web and native platforms.

- **Web Implementation**: Uses the browser's File API to select files
- **Native Implementation**: Uses Expo's DocumentPicker and FileSystem APIs

### AIModelSelector

The AIModelSelector component allows users to select from available AI models for analysis.

- Displays a list of configured AI models (cloud and local)
- Checks for API key availability for cloud models
- Verifies connectivity for local models
- Allows selection of a model for analysis
- Provides configuration options for local models including:
  - Model path
  - API URL and port
  - Model type (llama, gpt4all, deepseek, other)

### AnalysisResults

The AnalysisResults component displays the results of malware analysis in three tabs:

- **Deobfuscated Code**: Shows the cleaned, readable version of the malware code
- **Analysis Report**: Provides a detailed report of the analysis findings
- **Vulnerabilities**: Lists detected vulnerabilities with severity ratings and details

## Analysis Process

1. **File Selection**: User selects a malware file for analysis
2. **AI Model Selection**: User selects an AI model for analysis (cloud-based or local)
3. **Container Configuration**: User decides whether to use container isolation
4. **Analysis Execution**:
   - If container isolation is enabled, the file is uploaded to a secure container
   - For cloud models:
     - The file is sent to the appropriate cloud API (OpenAI, Claude, or DeepSeek)
     - The API analyzes the file and returns results
   - For local models:
     - The file is sent to the local model API running on the specified port
     - The local model performs analysis using the configured model
     - Results are returned via the local API endpoint
   - Deobfuscation is performed to make the code readable
   - Vulnerability analysis identifies potential security issues
5. **Results Display**: The analysis results are displayed to the user in the AnalysisResults component

## License

This project is intended to serve the infosec community. No more wasted hours ripping apart and reordering code. Let Athena guide your way and unwravel the mysteries of obfuscated code so that you can be the best researcher you can be.
