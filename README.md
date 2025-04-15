# Athena - AI-Powered Malware Analysis Assistant

Athena is a React Native application designed to help security researchers analyze and deobfuscate malware using various AI models. It provides a secure environment for malware analysis with features like isolated container execution and integration with the Metasploit database.

## Features

- **Multiple AI Models**: Connect to different AI models including OpenAI GPT-4, Claude 3 Opus, DeepSeek Coder, and local models
- **Secure Container Analysis**: Run malware in an isolated container environment for safer analysis
- **Metasploit Integration**: Access the Metasploit database to identify vulnerabilities and related exploits
- **Deobfuscation**: Convert obfuscated malicious code into readable, understandable code
- **Vulnerability Detection**: Identify potential security vulnerabilities in the analyzed code
- **Cross-Platform**: Works on iOS, Android, and web platforms

## Application Screenshots

### Home Screen

![Home Screen](./Athena/screenshots/Screenshot 2025-04-14 at 10.56.47 PM.png)

The Home screen is the main interface for analyzing malware files. It features:
- AI Model selection
- File upload functionality
- Container isolation option
- Analysis button
- Results display area

### About Screen

![About Screen](./Athena/screenshots/Screenshot 2025-04-14 at 10.55.53 PM.png)

The About screen provides information about Athena and its features:
- Overview of Athena's purpose
- Detailed information about AI models
- Secure container analysis features
- Metasploit integration details
- Security features

### Settings Screen

![Settings Screen](./Athena/screenshots/Screenshot 2025-04-14 at 10.56.25 PM.png)

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
    C --> D[External APIs]
    C --> E[Local Storage]
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
    Services->>External APIs: Send to AI Model
    External APIs->>Services: Return Results
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
```

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
```

## Key Components

### FileUploader

The FileUploader component handles file selection and management, with separate implementations for web and native platforms.

- **Web Implementation**: Uses the browser's File API to select files
- **Native Implementation**: Uses Expo's DocumentPicker and FileSystem APIs

### AIModelSelector

The AIModelSelector component allows users to select from available AI models for analysis.

- Displays a list of configured AI models
- Checks for API key availability
- Allows selection of a model for analysis

### AnalysisResults

The AnalysisResults component displays the results of malware analysis in three tabs:

- **Deobfuscated Code**: Shows the cleaned, readable version of the malware code
- **Analysis Report**: Provides a detailed report of the analysis findings
- **Vulnerabilities**: Lists detected vulnerabilities with severity ratings and details

## Analysis Process

1. **File Selection**: User selects a malware file for analysis
2. **AI Model Selection**: User selects an AI model for analysis
3. **Container Configuration**: User decides whether to use container isolation
4. **Analysis Execution**:
   - If container isolation is enabled, the file is uploaded to a secure container
   - The AI model analyzes the file for malicious patterns
   - Deobfuscation is performed to make the code readable
   - Vulnerability analysis identifies potential security issues
5. **Results Display**: The analysis results are displayed to the user

## License

This project is intended to serve the infosec community. No more wasted hours ripping apart and reordering code. Let Athena guide your way and unwravel the mysteries of obfuscated code so that you can be the best researcher you can be.
