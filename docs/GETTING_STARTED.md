# Getting Started with Athena

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Running Your First Analysis](#running-your-first-analysis)
- [Advanced Features](#advanced-features)
- [Architecture Overview](#architecture-overview)
- [Troubleshooting](#troubleshooting)
- [Next Steps](#next-steps)

## Overview

Athena is an enterprise-grade malware analysis platform that leverages multiple AI providers (Claude, OpenAI, DeepSeek) to analyze and deobfuscate potentially malicious code. The platform has been modernized with production-ready features including:

- **Multi-AI Provider Support** with automatic failover
- **Distributed Caching** with Redis
- **Resilience Patterns** (Circuit Breakers, Bulkheads)
- **Real-time Streaming** analysis
- **Container Isolation** for secure execution
- **Comprehensive Monitoring** with APM integration
- **Feature Flags** for runtime configuration

### Complete Setup Flow

```mermaid
flowchart TB
    Start([Start]) --> CheckNode{Node.js Installed?}
    
    CheckNode -->|No| InstallNode[Install Node.js v18+]
    CheckNode -->|Yes| CheckGit{Git Installed?}
    
    InstallNode --> CheckGit
    
    CheckGit -->|No| InstallGit[Install Git]
    CheckGit -->|Yes| Clone[Clone Repository]
    
    InstallGit --> Clone
    
    Clone --> RunScript[Run /scripts/athena]
    
    RunScript --> CheckFirstTime{First Time Setup?}
    
    CheckFirstTime -->|Yes| InstallDeps[Install Dependencies]
    CheckFirstTime -->|No| CheckEnv{.env Exists?}
    
    InstallDeps --> CreateEnv[Create .env File]
    CreateEnv --> ConfigureKeys[Configure API Keys]
    
    CheckEnv -->|No| CreateEnv
    CheckEnv -->|Yes| ValidateKeys{API Keys Valid?}
    
    ConfigureKeys --> ValidateKeys
    
    ValidateKeys -->|No| UpdateKeys[Update API Keys]
    ValidateKeys -->|Yes| CheckOptional{Configure Optional Services?}
    
    UpdateKeys --> ValidateKeys
    
    CheckOptional -->|Yes| ConfigureOptional[Configure Redis/DB/APM]
    CheckOptional -->|No| BuildApp[Build Application]
    
    ConfigureOptional --> BuildApp
    
    BuildApp --> LaunchApp[Launch Athena]
    LaunchApp --> Ready([Ready to Use!])
    
    style Start fill:#e1f5e1
    style Ready fill:#e1f5e1
    style ConfigureKeys fill:#ffe4e1
    style ValidateKeys fill:#fff4e1
```

## Prerequisites

### System Requirements

```mermaid
graph LR
    subgraph "Required Software"
        Node[Node.js v18+]
        NPM[npm v8+]
        Git[Git]
    end
    
    subgraph "Optional Services"
        Docker[Docker]
        Redis[Redis]
        PostgreSQL[PostgreSQL]
    end
    
    subgraph "AI API Keys"
        Claude[Claude API]
        OpenAI[OpenAI API]
        DeepSeek[DeepSeek API]
    end
```

### Installation Checklist

- [ ] **Node.js** (v18 or later): [Download](https://nodejs.org/)
- [ ] **npm** (v8 or later): Included with Node.js
- [ ] **Git**: [Download](https://git-scm.com/downloads)
- [ ] **Docker** (optional): [Download](https://www.docker.com/products/docker-desktop/)
- [ ] **Redis** (optional): For distributed caching

### API Keys

Obtain API keys from:
- **Claude**: [Anthropic Console](https://console.anthropic.com/account/keys)
- **OpenAI**: [OpenAI Platform](https://platform.openai.com/account/api-keys)
- **DeepSeek**: [DeepSeek Platform](https://platform.deepseek.com/)

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/athena.git
cd athena

# Launch interactive CLI
/scripts/athena
```

The interactive CLI provides a beautiful menu to:
- 🚀 Start Athena Web (with auto-setup on first run)
- 🔑 Check and validate API keys
- 📦 Update everything to latest versions
- 🔧 Run setup, tests, and maintenance tasks
- 📱 Launch iOS/Android versions

### 2. Configure API Keys

Edit the auto-generated `.env` file:

```bash
# Athena/.env
OPENAI_API_KEY=your_openai_key_here
CLAUDE_API_KEY=your_claude_key_here
DEEPSEEK_API_KEY=your_deepseek_key_here

# Optional: Enable enterprise features
REDIS_ENABLED=true
APM_ENABLED=true
FEATURE_ENABLESTREAMINGANALYSIS=true
```

### 3. Launch Application

**Interactive CLI (Recommended):**
```bash
/scripts/athena
# Then select option 1 for web, 4 for iOS, 5 for Android
```

**Direct Commands:**
```bash
./scripts/run.sh web      # Web version (default)
./scripts/run.sh ios      # iOS simulator  
./scripts/run.sh android  # Android emulator
```

## Configuration

### Configuration Dependencies

```mermaid
graph TB
    subgraph "Core Requirements"
        APIKeys[API Keys<br/>At least one required]
        NodeEnv[NODE_ENV<br/>development/production]
    end
    
    subgraph "AI Provider Config"
        Claude[CLAUDE_API_KEY]
        OpenAI[OPENAI_API_KEY]
        DeepSeek[DEEPSEEK_API_KEY]
        Priority[AI_PROVIDER_PRIORITY]
    end
    
    subgraph "Optional Services"
        subgraph "Redis Cache"
            RedisEnabled[REDIS_ENABLED]
            RedisHost[REDIS_HOST]
            RedisPort[REDIS_PORT]
            RedisPassword[REDIS_PASSWORD]
        end
        
        subgraph "Database"
            DBEnabled[DB_ENABLED]
            DBHost[DATABASE_URL]
            DBPool[DB_POOL_SIZE]
        end
        
        subgraph "APM"
            APMEnabled[APM_ENABLED]
            APMProvider[APM_PROVIDER]
            APMEndpoint[APM_ENDPOINT]
        end
    end
    
    subgraph "Feature Flags"
        CircuitBreaker[FEATURE_ENABLECIRCUITBREAKER]
        Bulkhead[FEATURE_ENABLEBULKHEAD]
        Streaming[FEATURE_ENABLESTREAMINGANALYSIS]
        BatchProcessing[FEATURE_ENABLEBATCHPROCESSING]
    end
    
    APIKeys --> Claude
    APIKeys --> OpenAI
    APIKeys --> DeepSeek
    
    Claude --> Priority
    OpenAI --> Priority
    DeepSeek --> Priority
    
    RedisEnabled -->|true| RedisHost
    RedisEnabled -->|true| RedisPort
    RedisHost --> RedisPassword
    
    DBEnabled -->|true| DBHost
    DBEnabled -->|true| DBPool
    
    APMEnabled -->|true| APMProvider
    APMProvider --> APMEndpoint
    
    NodeEnv --> CircuitBreaker
    NodeEnv --> Bulkhead
    NodeEnv --> Streaming
    NodeEnv --> BatchProcessing
    
    style APIKeys fill:#ffe4e1
    style Claude fill:#e1f5e1
    style OpenAI fill:#e1f5e1
    style DeepSeek fill:#e1f5e1
```

### Environment Configuration

```mermaid
graph TB
    subgraph "Configuration Sources"
        ENV[.env File]
        Runtime[Runtime Config]
        Features[Feature Flags]
    end
    
    subgraph "Service Configuration"
        AI[AI Providers]
        Cache[Caching]
        Monitor[Monitoring]
        Security[Security]
    end
    
    ENV --> AI
    ENV --> Cache
    ENV --> Monitor
    
    Runtime --> Features
    Features --> AI
    Features --> Cache
    Features --> Monitor
```

### Key Configuration Options

```bash
# AI Provider Configuration
OPENAI_API_KEY=sk-...
CLAUDE_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=...

# Redis Cache (Optional)
REDIS_ENABLED=true
REDIS_HOST=localhost
REDIS_PORT=6379

# APM Monitoring (Optional)
APM_ENABLED=true
APM_PROVIDER=console  # or statsd, datadog
APM_ENDPOINT=localhost:8125

# Feature Flags
FEATURE_ENABLECIRCUITBREAKER=true
FEATURE_ENABLEBULKHEAD=true
FEATURE_ENABLESTREAMINGANALYSIS=true
FEATURE_AIPROVIDERPRIORITY=claude,openai,deepseek
```

### Database Setup (Optional)

For persistent storage and container monitoring:

```bash
# Using Docker Compose (recommended)
cd Athena
docker-compose up -d

# Initialize database
npm run db:init
npm run db:test
```

### Redis Setup (Optional)

For distributed caching across instances:

```bash
# Using Docker
docker run -d \
  --name athena-redis \
  -p 6379:6379 \
  redis:alpine

# Verify connection
docker exec athena-redis redis-cli ping
# Should return: PONG
```

## Running Your First Analysis

### Complete Analysis Walkthrough

```mermaid
stateDiagram-v2
    [*] --> HomePage: Launch Athena
    
    HomePage --> FileSelection: Click Upload
    
    state FileSelection {
        [*] --> BrowseFiles
        BrowseFiles --> ValidateFile: Select File
        ValidateFile --> FileReady: Valid
        ValidateFile --> BrowseFiles: Invalid
        FileReady --> [*]
    }
    
    FileSelection --> ModelSelection: File Uploaded
    
    state ModelSelection {
        [*] --> SelectProvider
        SelectProvider --> SelectModel: Choose Provider
        SelectModel --> ConfigureOptions: Choose Model
        ConfigureOptions --> [*]: Set Options
    }
    
    ModelSelection --> AnalysisConfig: Model Selected
    
    state AnalysisConfig {
        [*] --> BasicOptions
        BasicOptions --> AdvancedOptions: Show Advanced
        AdvancedOptions --> ContainerConfig: Enable Container
        ContainerConfig --> StreamConfig: Configure Resources
        StreamConfig --> [*]: Enable Streaming
    }
    
    AnalysisConfig --> RunAnalysis: Start Analysis
    
    state RunAnalysis {
        [*] --> CheckCache
        CheckCache --> CacheHit: Found
        CheckCache --> CacheMiss: Not Found
        
        CacheHit --> DisplayCached
        
        CacheMiss --> ExecuteAnalysis
        ExecuteAnalysis --> Streaming: If Enabled
        ExecuteAnalysis --> BatchResult: If Disabled
        
        Streaming --> UpdateUI: Chunks
        UpdateUI --> Streaming: More Data
        UpdateUI --> Complete: Done
        
        BatchResult --> Complete
        Complete --> StoreCache
        StoreCache --> [*]
    }
    
    RunAnalysis --> ViewResults: Analysis Complete
    
    state ViewResults {
        [*] --> DeobfuscatedTab
        DeobfuscatedTab --> VulnerabilitiesTab: Switch Tab
        VulnerabilitiesTab --> ReportTab: Switch Tab
        ReportTab --> DeobfuscatedTab: Switch Tab
        
        DeobfuscatedTab --> Export: Download
        VulnerabilitiesTab --> Export: Download
        ReportTab --> Export: Download
    }
    
    ViewResults --> [*]: Done

### Step-by-Step Analysis Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant FileUploader
    participant AISelector
    participant Analysis
    participant Results
    
    User->>UI: Open Athena
    UI->>User: Display Home Screen
    
    User->>FileUploader: Upload malware sample
    FileUploader->>UI: Show uploaded file
    
    User->>AISelector: Select AI provider
    AISelector->>UI: Show selected model
    
    User->>Analysis: Click Analyze
    Analysis->>Analysis: Check cache
    Analysis->>Analysis: Run analysis
    Analysis->>Results: Display results
    
    Results->>User: Show deobfuscated code
    Results->>User: Show vulnerabilities
    Results->>User: Show analysis report
```

### 1. Upload a File

Navigate to the home screen and upload a file:

```typescript
// Supported file types
const ALLOWED_EXTENSIONS = [
  '.exe', '.dll', '.js', '.py', '.sh', 
  '.bat', '.ps1', '.vbs', '.jar', '.apk'
];
```

### 2. Select AI Model

Choose from available providers:

```mermaid
graph LR
    subgraph "AI Providers"
        Claude[Claude 3<br/>Best for complex analysis]
        OpenAI[GPT-4<br/>Good general purpose]
        DeepSeek[DeepSeek<br/>Fast and efficient]
    end
    
    subgraph "Selection Factors"
        Complexity[Code Complexity]
        Speed[Speed Requirements]
        Cost[Cost Considerations]
    end
    
    Complexity --> Claude
    Speed --> DeepSeek
    Cost --> OpenAI
```

### 3. Configure Analysis Options

- **Enable Container Isolation**: Run in secure environment
- **Enable Streaming**: Get real-time results
- **Select Analysis Type**: Deobfuscation or vulnerability scan

### 4. View Results

Results are displayed in three tabs:

1. **Deobfuscated Code**: Cleaned, readable version
2. **Analysis Report**: Detailed behavioral analysis
3. **Vulnerabilities**: Security issues with severity ratings

## Advanced Features

### Streaming Analysis

Enable real-time streaming for immediate feedback:

```typescript
// Enable in analysis options
const options = {
  streaming: true,
  onChunk: (chunk) => {
    updateUI(chunk); // Real-time updates
  }
};
```

### Container Isolation

Run analysis in isolated environments:

```mermaid
graph TB
    subgraph "Container Options"
        Windows[Windows Container]
        Linux[Linux Container]
        macOS[macOS Container]
    end
    
    subgraph "Resource Limits"
        CPU[CPU: 2-8 cores]
        Memory[RAM: 2-16 GB]
        Time[Timeout: 5 min]
    end
    
    subgraph "Security"
        Network[Network Isolation]
        FileSystem[FS Isolation]
        Process[Process Monitoring]
    end
```

### Performance Monitoring

View real-time metrics:

```mermaid
graph LR
    subgraph "Metrics Dashboard"
        Response[Response Time]
        Cache[Cache Hit Rate]
        Circuit[Circuit Status]
        Errors[Error Rate]
    end
    
    subgraph "Thresholds"
        RT[< 3s P95]
        CHR[> 80%]
        CS[Closed/Open]
        ER[< 0.1%]
    end
    
    Response --> RT
    Cache --> CHR
    Circuit --> CS
    Errors --> ER
```

### Feature Flags

Runtime configuration without redeployment:

```mermaid
graph TB
    subgraph "Feature Flag System"
        Manager[Feature Flag Manager]
        
        subgraph "Configuration Sources"
            Env[Environment Variables]
            Remote[Remote Config]
            Local[Local Overrides]
        end
        
        subgraph "Feature Categories"
            Performance[Performance Features]
            Resilience[Resilience Features]
            Experimental[Experimental Features]
            UI[UI Features]
        end
    end
    
    subgraph "Performance Features"
        Streaming[enableStreamingAnalysis]
        BatchProc[enableBatchProcessing]
        RedisCache[enableRedisCache]
        ConnPool[enableConnectionPooling]
    end
    
    subgraph "Resilience Features"
        CircuitBreaker[enableCircuitBreaker]
        Bulkhead[enableBulkhead]
        RetryLogic[enableRetryLogic]
        Failover[enableAutoFailover]
    end
    
    subgraph "Experimental Features"
        NewUI[enableNewUI]
        AdvAnalysis[enableAdvancedAnalysis]
        MLModels[enableMLModels]
    end
    
    Env --> Manager
    Remote --> Manager
    Local --> Manager
    
    Manager --> Performance
    Manager --> Resilience
    Manager --> Experimental
    Manager --> UI
    
    Performance --> Streaming
    Performance --> BatchProc
    Performance --> RedisCache
    Performance --> ConnPool
    
    Resilience --> CircuitBreaker
    Resilience --> Bulkhead
    Resilience --> RetryLogic
    Resilience --> Failover
    
    Experimental --> NewUI
    Experimental --> AdvAnalysis
    Experimental --> MLModels
    
    style Manager fill:#e1e5ff
    style Env fill:#ffe4e1
    style Remote fill:#e1f5e1
    style Local fill:#fff4e1
```

```typescript
// Check feature status
if (featureFlags.isEnabled('enableStreamingAnalysis')) {
  // Use streaming
}

// Development mode: Override features
featureFlags.setOverride('enableRedisCache', true);
```

## Architecture Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend"
        UI[React Native UI]
        Store[Zustand Store]
    end
    
    subgraph "Gateway Layer"
        API[API Gateway]
        MW[Middleware Stack]
    end
    
    subgraph "Service Layer"
        AIManager[AI Manager]
        Cache[Cache Manager]
        Container[Container Service]
    end
    
    subgraph "Resilience Layer"
        CB[Circuit Breakers]
        BH[Bulkheads]
        Pool[Resource Pools]
    end
    
    subgraph "External Services"
        Claude[Claude API]
        OpenAI[OpenAI API]
        Redis[Redis Cache]
        DB[(PostgreSQL)]
    end
    
    UI --> Store
    Store --> API
    API --> MW
    MW --> AIManager
    
    AIManager --> CB
    CB --> BH
    BH --> Pool
    
    Pool --> Claude
    Pool --> OpenAI
    
    Cache --> Redis
    Container --> DB
```

### Request Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant CircuitBreaker
    participant Cache
    participant AIProvider
    
    Client->>Gateway: POST /analyze
    Gateway->>Cache: Check cache
    
    alt Cache Hit
        Cache-->>Gateway: Cached result
        Gateway-->>Client: Return result
    else Cache Miss
        Gateway->>CircuitBreaker: Check circuit
        
        alt Circuit Closed
            CircuitBreaker->>AIProvider: Analyze
            AIProvider-->>CircuitBreaker: Result
            CircuitBreaker->>Cache: Store
            CircuitBreaker-->>Gateway: Result
            Gateway-->>Client: Return result
        else Circuit Open
            CircuitBreaker-->>Gateway: Fallback
            Gateway-->>Client: Cached/degraded result
        end
    end
```

## Troubleshooting

### Common Issues

#### API Key Issues
```bash
# Validate API keys
node scripts/check-api-keys.js

# Check specific provider
curl -H "Authorization: Bearer $CLAUDE_API_KEY" \
  https://api.anthropic.com/v1/messages
```

#### Redis Connection Issues
```bash
# Check Redis connection
redis-cli ping

# Test cache functionality
npm run test:redis-cache
```

#### Performance Issues
```bash
# Run load tests
npm run load-test

# Check circuit breaker status
curl http://localhost:3000/health/circuit-breakers
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug environment
export NODE_ENV=development
export LOG_LEVEL=debug

# Run with verbose output
npm run dev -- --verbose
```

### Health Checks

Monitor system health:

```bash
# Overall health
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/health/detailed
```

## Next Steps

### 1. Production Deployment

See [Deployment Guide](/docs/DEPLOYMENT.md) for:
- Docker containerization
- Kubernetes deployment
- Load balancing setup
- SSL/TLS configuration

### 2. Advanced Configuration

Explore:
- [Feature Flags Guide](/docs/performance/FEATURE_FLAGS.md)
- [Circuit Breaker Configuration](/docs/performance/ADAPTIVE_CIRCUIT_BREAKER.md)
- [Redis Cache Tuning](/docs/performance/REDIS_CACHE_INTEGRATION.md)
- [APM Integration](/docs/performance/APM_INTEGRATION.md)

### 3. Development

For contributors:
- [Architecture Documentation](/docs/ARCHITECTURE.md)
- [API Integration Guide](/docs/API_INTEGRATION.md)
- [Testing Guide](/docs/testing/README.md)
- [Contributing Guidelines](/CONTRIBUTING.md)

### 4. Monitoring & Operations

Set up production monitoring:
- Configure APM provider (DataDog, New Relic)
- Set up alerts for circuit breaker trips
- Monitor cache hit rates
- Track AI provider usage and costs

## Support

- **Documentation**: Check `/docs` folder
- **Issues**: [GitHub Issues](https://github.com/yourusername/athena/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/athena/discussions)

## Quick Reference

### Essential Commands

```bash
# Interactive CLI (recommended)
/scripts/athena

# Direct commands
./scripts/run.sh web    # Start web version
./scripts/run.sh setup  # Setup only

# Development (from Athena/ directory)
npm run dev
npm test
npm run lint

# Production
npm run build
npm run test:production

# Database
npm run db:init
npm run db:migrate

# Monitoring
npm run monitor:start
npm run load-test
```

### Configuration Reference

```bash
# Required
OPENAI_API_KEY=...
CLAUDE_API_KEY=...
DEEPSEEK_API_KEY=...

# Optional but recommended
REDIS_ENABLED=true
APM_ENABLED=true
FEATURE_ENABLECIRCUITBREAKER=true
FEATURE_ENABLESTREAMINGANALYSIS=true
```

Welcome to Athena - your enterprise-grade malware analysis platform!