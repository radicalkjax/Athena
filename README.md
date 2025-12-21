# Athena - AI-Powered Malware Analysis Assistant

<div align="center">
  <img src="./athena-v2/src-tauri/icons/logo.png" alt="Athena Logo" width="300" />
</div>

Athena is a cross-platform application designed to help security researchers analyze and deobfuscate malware using various AI models. It provides a secure environment for malware analysis with features like isolated container execution and integration with the Metasploit database.

The foundation of Athena's idea and research comes from this research paper by Kali Jackson: [Deep Learning for Malware Analysis](https://radicalkjax.com/2025/04/21/deep-learning-for-malware-analysis.html).

## 📋 Navigation

<table>
<tr>
<td width="50%" valign="top">

### Table of Contents

- [📄 Overview](#-overview)
- [✨ Features](#-features)
- [🚀 Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
- [📖 User Guide](#-user-guide)
- [🏗️ Architecture](#️-architecture)
- [📚 Documentation](#-documentation)
- [📱 Screenshots](#-screenshots)

</td>
<td width="50%" valign="top">

### 📚 Documentation

- [🚀 Quick Start Guide](./docs/QUICKSTART.md)
- [📘 Getting Started Guide](./docs/GETTING_STARTED.md)
- [📗 User Guide](./docs/USER_GUIDE.md)
- [📐 Architecture Documentation](./docs/ARCHITECTURE.md)
- [🔌 API Integration](./docs/API_INTEGRATION.md)
- [🔒 Container Isolation](./docs/CONTAINER_ISOLATION.md)
- [🔧 Troubleshooting Guide](./docs/TROUBLESHOOTING.md)
- [📊 Container Monitoring](./docs/components/CONTAINER_MONITORING.md)
- [🎨 Font Configuration](./docs/FONT_CONFIGURATION.md)

**Component Documentation:**
- [AIModelSelector](./docs/components/AI_MODEL_SELECTOR.md)
- [AnalysisOptionsPanel](./docs/components/ANALYSIS_OPTIONS_PANEL.md)
- [AnalysisResults](./docs/components/ANALYSIS_RESULTS.md)
- [ContainerConfigSelector](./docs/components/CONTAINER_CONFIG_SELECTOR.md)
- [FileUploader](./docs/components/FILE_UPLOADER.md)
- [ContainerMonitoring](./docs/components/CONTAINER_MONITORING.md)

</td>
</tr>
</table>

## 🔍 Overview

> **IMPORTANT DISCLAIMER:** The containerization and analysis components described in this documentation are still being designed and developed. Their current implementation and documentation are not reflective of what the final design could be. This documentation represents a conceptual overview and may change significantly as development progresses.

Athena is a high-performance native desktop application built with **Tauri 2.0**:

- **Platform Support**:
  - **Desktop**: Windows, macOS (✅ verified), Linux
  - **Mobile** (Beta): iOS and Android with landscape orientation
- **Technology Stack**:
  - **Backend**: Rust for performance and security
  - **Frontend**: SolidJS for reactive UI
  - **Analysis**: WebAssembly (WASM) modules for high-performance malware analysis
- **Launch**: Use `./scripts/athena` → Option 11 (Tauri Desktop App)

Athena leverages multiple AI models including OpenAI's GPT-4, Claude 3 Opus, and DeepSeek Coder to analyze malicious code, deobfuscate it, and identify potential vulnerabilities.

The application is designed with security in mind, providing isolated container execution for safer analysis of potentially harmful code. It also integrates with the Metasploit database to provide additional context about identified vulnerabilities.

### 🤖 Rust: Building for the AI/Agentic Era

Athena's choice of Rust as the core backend technology positions the platform for the future of AI and agentic systems:

- **Memory Safety Without Garbage Collection**: Rust's ownership model provides deterministic memory management crucial for AI workloads where predictable performance matters. No unexpected GC pauses during time-sensitive malware analysis.

- **Fearless Concurrency**: Rust's type system prevents data races at compile time, enabling safe parallel processing of multiple AI model requests, WASM module execution, and concurrent malware analysis without locks or runtime overhead.

- **Zero-Cost Abstractions**: High-level abstractions compile down to efficient machine code, allowing AI agents to interact with low-level malware analysis operations without performance penalties.

- **WebAssembly Integration**: Rust's first-class WASM support enables sandboxed execution of AI-generated analysis code and untrusted binaries with cryptographic verification and component model isolation.

- **Type Safety for AI Interoperability**: Strong typing ensures AI-generated code integrations are verified at compile time, preventing runtime errors when AI agents orchestrate complex analysis workflows.

- **Cross-Platform Native Performance**: Single codebase deploys to desktop (Windows, macOS, Linux) and mobile (iOS, Android) with native performance, allowing AI agents to operate consistently across platforms.

- **Ecosystem for AI/ML**: Growing Rust ecosystem for machine learning (burn, candle, linfa) enables future on-device AI model inference, keeping sensitive malware analysis data local and secure.

By building on Rust, Athena is prepared for future enhancements like autonomous AI agents that can orchestrate multi-stage malware analysis, generate custom YARA rules, and adapt detection strategies—all while maintaining the security guarantees critical for malware analysis platforms.

## ✨ Features

- **🎨 Beautiful Interactive CLI**: New `/scripts/athena` command provides a gorgeous menu-driven interface with:
  - Visual ASCII art banner with trans colors
  - One-click access to all Athena features  
  - Automated setup and configuration
  - System health checks and maintenance tools
- **⚡ WebAssembly (WASM) Integration**: High-performance security analysis modules:
  - **Analysis Engine**: Core malware analysis and threat detection
  - **Crypto Module**: Advanced cryptographic operations and hash verification
  - **Deobfuscator**: Real-time code deobfuscation and unpacking
  - **File Processor**: Binary parsing and format analysis
  - **Pattern Matcher**: Signature-based malware detection
  - **Network Analysis**: Protocol parsing and traffic analysis
  - **Sandbox**: Isolated WASM-based execution environment
  - All modules optimized with Binaryen for maximum performance
- **Multiple AI Models**: Connect to different AI models including:
  - OpenAI GPT-4
  - Claude 3 Opus
  - DeepSeek Coder
- **Secure Container Analysis**: Run malware in an isolated container environment for safer analysis
  - Support for Windows, Linux, and macOS containers
  - Configurable resource limits (CPU, memory, disk)
  - Isolated network environment
  - Real-time container monitoring
- **Advanced Analysis Options**: Configure analysis depth and focus areas
- **Persistent Storage**: SQLite database for storing:
  - Workflow configurations and job status
  - Analysis results and metadata
  - Local caching (with optional Redis for distributed caching)
- **Container Monitoring**: Comprehensive monitoring of container activity:
  - Resource usage (CPU, memory, disk, network)
  - Network connections and traffic
  - File system operations
  - Process creation and execution
  - Suspicious activity detection
- **Metasploit Integration**: Access the Metasploit database to identify vulnerabilities and related exploits
- **Deobfuscation**: Convert obfuscated malicious code into readable, understandable code
- **Vulnerability Detection**: Identify potential security vulnerabilities in the analyzed code
- **Cross-Platform**: Works on iOS, Android, and web platforms

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- [Rust](https://rustup.rs/) (latest stable) - **Required for Tauri backend**
- [Node.js](https://nodejs.org/) (v16 or later) - **Only for building the SolidJS frontend**
- [npm](https://www.npmjs.com/) (v8 or later) - **Only for managing frontend dependencies**
- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) for your platform
- [Docker](https://www.docker.com/products/docker-desktop/) (optional) - Only needed if you want Redis caching
- API keys for the AI models you want to use:
  - [OpenAI API key](https://platform.openai.com/account/api-keys)
  - [Claude API key](https://console.anthropic.com/account/keys)
  - [DeepSeek API key](https://platform.deepseek.com/)

**Note:** Athena is now a **100% Tauri-only application**. The Node.js backend has been completely removed. Node.js is only used for building the frontend UI during development.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/athena.git
   cd athena
   ```

2. **Launch Interactive CLI** (recommended):
   ```bash
   ./scripts/athena
   ```

   The beautiful interactive CLI will:
   - Show you a visual menu with all options
   - Auto-detect and run setup on first use
   - Guide you through API key configuration
   - Provide easy access to all Athena features

   **Quick Start: Select Option 11 (🖥️ Tauri Desktop App)**
   - Build and launch the desktop application

   **That's it!** The script handles everything automatically.

3. **Optional: Manual setup** (if you prefer manual control):
   ```bash
   # Navigate to Tauri app directory
   cd athena-v2

   # Install frontend dependencies (SolidJS)
   npm install

   # Run in development mode
   npm run tauri:dev

   # Or build for production
   npm run tauri:build
   ```

4. **Environment variables**:
   - Copy `.env.example` to `.env` in the root directory
   - Add your API keys (see [Configuration](#configuration))
   - Or use the API key validation script:
     ```bash
     node scripts/check-api-keys.js
     ```

### Configuration

Athena uses environment variables to securely store API keys and database configuration.

1. Create a `.env` file in the root of the Athena directory (this file is already gitignored)
2. Add your API keys and database configuration to the `.env` file using the following format:

```
# API Keys for AI Models
OPENAI_API_KEY=your_openai_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# Optional: Override API Base URLs if needed
# OPENAI_API_BASE_URL=https://api.openai.com/v1
# CLAUDE_API_BASE_URL=https://api.anthropic.com/v1
# DEEPSEEK_API_BASE_URL=https://api.deepseek.com/v1

# Redis Configuration (optional - for caching)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_redis_password_here (if using password authentication)
```

3. You can use the provided `.env.example` file as a template
4. The database is configured using the environment variables above

## 📖 User Guide

### Starting the Application

**Simplest approach** - Use the interactive CLI:
```bash
./scripts/athena
```

Then select **Option 11: 🖥️ Tauri Desktop App**

This will automatically:
- 🔍 **Install** all dependencies if needed
- 🔧 **Build** the Rust backend and SolidJS frontend
- 🚀 **Launch** the desktop application

**Manual commands** (if you prefer manual control):
```bash
cd athena-v2

# Development mode (hot reload)
npm run tauri:dev

# Production build
npm run tauri:build

# Web-only build (for testing UI)
npm run build
```

**Platform-specific builds**:
```bash
# macOS (universal binary)
npm run tauri:build:macos

# Windows
npm run tauri:build:windows

# Linux
npm run tauri:build:linux
```

### Analyzing Malware

1. **Select an AI Model**: Choose from available AI models in the dropdown
2. **Upload a File**: Click the "Upload" button to select a malware file for analysis
3. **Configure Analysis Options**: 
   - **Container Isolation**: Enable to run analysis in an isolated container environment
   - **Container Configuration**: Select the container type (Windows, Linux, or macOS) and configure resource limits
   - **Analysis Depth**: Choose between quick scan or deep analysis
4. **Start Analysis**: Click the "Analyze" button to begin the analysis process
5. **View Results**: Once analysis is complete, view the results in the three tabs:
   - Deobfuscated Code: Shows the cleaned, readable version of the malware code
   - Analysis Report: Provides a detailed report of the analysis findings
   - Vulnerabilities: Lists detected vulnerabilities with severity ratings and details

## 🏗️ Architecture

Athena follows a modular architecture with clear separation of concerns. The application is built using Tauri 2.0 with a Rust backend and SolidJS frontend, enabling high-performance cross-platform compatibility. The core analysis capabilities are powered by high-performance WebAssembly modules.

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#000000',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#000000',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#000000',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#000000',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
flowchart TD
    A[User Interface] --> B[State Management]
    B --> C[Services Layer]
    C --> D[API Client]
    C --> E[Local Storage]
    C --> W[WASM Bridge Layer]
    D --> F[External APIs]
    W --> WM[WASM Modules]
    
    subgraph "Core Architecture"
        A
        B
        C
    end
    
    subgraph "WASM Security Modules"
        WM --> WM1[Analysis Engine]
        WM --> WM2[Crypto Module]
        WM --> WM3[Deobfuscator]
        WM --> WM4[File Processor]
        WM --> WM5[Pattern Matcher]
        WM --> WM6[Network Analysis]
        WM --> WM7[Sandbox]
    end
    
    subgraph "External Communication"
        D
        F
    end
    
    subgraph "Persistence"
        E
    end
```

For more detailed architecture information, see the [Architecture Documentation](./docs/ARCHITECTURE.md).

## 📚 Documentation

Athena comes with comprehensive documentation to help you understand and use the application effectively:

### 🗺️ **[📖 Documentation Hub](./docs/README.md)** ← **Start Here!**
*Complete navigation guide with visual maps, role-based workflows, and quick access to all documentation.*

### 🚀 Quick Access
- **[⚡ QUICKSTART](./docs/QUICKSTART.md)** - Get running in 2 minutes with the new interactive CLI
- **[🔧 Getting Started](./docs/GETTING_STARTED.md)** - Complete setup and configuration guide  
- **[👤 User Guide](./docs/USER_GUIDE.md)** - How to use all features effectively
- **[🐛 Troubleshooting](./docs/TROUBLESHOOTING.md)** - Visual decision trees for common issues

### 🏗️ Technical Documentation
- **[📐 Architecture](./docs/ARCHITECTURE.md)** - System design and component overview
- **[⚡ WASM Architecture](./docs/WASM_ARCHITECTURE.md)** - WebAssembly modules and integration
- **[🤖 Ensemble Architecture](./docs/ENSEMBLE_ARCHITECTURE.md)** - Multi-agent ensemble approach
- **[🔌 API Integration](./docs/API_INTEGRATION.md)** - AI provider integration patterns
- **[🛡️ Container Isolation](./docs/CONTAINER_ISOLATION.md)** - Security and sandboxing
- **[⚡ Performance](./docs/performance/)** - Optimization, caching, and monitoring
- **[🧪 Testing](./docs/testing/)** - Test strategies and execution

### Component Documentation

- [AIModelSelector](./docs/components/AI_MODEL_SELECTOR.md) - Documentation for the AI model selection component
- [AnalysisOptionsPanel](./docs/components/ANALYSIS_OPTIONS_PANEL.md) - Documentation for the analysis options panel component
- [AnalysisResults](./docs/components/ANALYSIS_RESULTS.md) - Documentation for the analysis results component
- [ContainerConfigSelector](./docs/components/CONTAINER_CONFIG_SELECTOR.md) - Documentation for the container configuration component
- [FileUploader](./docs/components/FILE_UPLOADER.md) - Documentation for the file upload component
- [ContainerMonitoring](./docs/components/CONTAINER_MONITORING.md) - Documentation for the container monitoring component

## 📱 Screenshots

### Athena Desktop Application (Tauri 2.0)

<div align="center">
  <img src="./athena-v2/src-tauri/icons/Athena_Desktop_Screenshot.png" alt="Athena Desktop Application" width="100%" />
  <p><em>AI-powered malware analysis platform with WASM-based security modules and real-time analysis</em></p>
</div>

**Platform**: macOS, Windows, Linux
**Tech Stack**: Rust + SolidJS + WebAssembly
**Features Shown**: File upload, AI model selection, analysis workflow, real-time processing
