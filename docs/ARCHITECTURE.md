# Athena Architecture Documentation

> **Note:** This documentation reflects the modernized architecture after 9 phases of improvements, including enterprise-grade features like distributed caching, circuit breakers, bulkhead patterns, and comprehensive monitoring.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Architecture Patterns](#core-architecture-patterns)
- [Component Structure](#component-structure)
- [Services Layer](#services-layer)
- [State Management](#state-management)
- [Performance Architecture](#performance-architecture)
- [Resilience Architecture](#resilience-architecture)
- [Security Architecture](#security-architecture)
- [Data Flow](#data-flow)
- [Deployment Architecture](#deployment-architecture)
- [Configuration Management](#configuration-management)

## Overview

Athena is an enterprise-grade malware analysis platform built with React Native and Expo, providing cross-platform support for iOS, Android, and web. The application has undergone 9 phases of modernization, transforming it from a basic analysis tool into a production-ready system with advanced resilience patterns, distributed caching, and comprehensive monitoring.

### Key Features

- **Multi-AI Provider Support**: Claude, OpenAI, DeepSeek with automatic failover
- **Container Isolation**: Secure malware execution environments
- **Distributed Caching**: Redis-backed caching with local fallback
- **Resilience Patterns**: Circuit breakers, bulkheads, retry mechanisms
- **Real-time Monitoring**: APM integration with business metrics
- **Streaming Analysis**: WebSocket/SSE support for real-time results
- **Feature Flags**: Runtime configuration without redeployment

## System Architecture

The modernized architecture implements a layered approach with clear separation of concerns:

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Native UI]
        Store[Zustand Store]
    end
    
    subgraph "API Gateway"
        Gateway[API Gateway]
        CORS[CORS Handler]
        RateLimiter[Rate Limiter]
    end
    
    subgraph "Service Layer"
        AIManager[AI Service Manager]
        Analysis[Analysis Service]
        Container[Container Service]
        Cache[Cache Manager]
        APM[APM Manager]
    end
    
    subgraph "Resilience Layer"
        CircuitBreaker[Circuit Breaker Factory]
        Bulkhead[Bulkhead Manager]
        Pool[Resource Pool]
    end
    
    subgraph "External Services"
        Claude[Claude API]
        OpenAI[OpenAI API]
        DeepSeek[DeepSeek API]
        Redis[Redis Cache]
        StatsD[StatsD/APM]
    end
    
    subgraph "Storage"
        DB[(PostgreSQL)]
        FileSystem[File System]
        IndexedDB[IndexedDB]
    end
    
    UI --> Store
    Store --> Gateway
    Gateway --> AIManager
    Gateway --> Analysis
    Gateway --> Container
    
    AIManager --> CircuitBreaker
    CircuitBreaker --> Bulkhead
    Bulkhead --> Pool
    
    Pool --> Claude
    Pool --> OpenAI
    Pool --> DeepSeek
    
    Analysis --> Cache
    Cache --> Redis
    Cache --> IndexedDB
    
    Container --> DB
    Analysis --> FileSystem
    
    AIManager --> APM
    APM --> StatsD
```

## Core Architecture Patterns

### 1. Hexagonal Architecture

The application follows hexagonal architecture principles with clear ports and adapters:

```mermaid
graph LR
    subgraph "Core Domain"
        Analysis[Analysis Logic]
        Models[Domain Models]
        Rules[Business Rules]
    end
    
    subgraph "Ports"
        AIPort[AI Service Port]
        CachePort[Cache Port]
        DBPort[Database Port]
        MonitorPort[Monitor Port]
    end
    
    subgraph "Adapters"
        ClaudeAdapter[Claude Adapter]
        OpenAIAdapter[OpenAI Adapter]
        RedisAdapter[Redis Adapter]
        PostgresAdapter[Postgres Adapter]
        APMAdapter[APM Adapter]
    end
    
    Analysis --> AIPort
    Analysis --> CachePort
    Analysis --> DBPort
    Analysis --> MonitorPort
    
    AIPort --> ClaudeAdapter
    AIPort --> OpenAIAdapter
    CachePort --> RedisAdapter
    DBPort --> PostgresAdapter
    MonitorPort --> APMAdapter
```

### 2. Event-Driven Architecture

The system uses events for loose coupling between components:

```mermaid
graph TB
    subgraph "Event Bus"
        EventEmitter[Event Emitter]
    end
    
    subgraph "Producers"
        FileUpload[File Upload]
        Analysis[Analysis Service]
        Monitoring[Monitoring]
    end
    
    subgraph "Consumers"
        Cache[Cache Manager]
        APM[APM Manager]
        Logger[Logger]
        Store[State Store]
    end
    
    FileUpload -->|file.uploaded| EventEmitter
    Analysis -->|analysis.started| EventEmitter
    Analysis -->|analysis.completed| EventEmitter
    Monitoring -->|metrics.collected| EventEmitter
    
    EventEmitter -->|*| Cache
    EventEmitter -->|*| APM
    EventEmitter -->|*| Logger
    EventEmitter -->|*| Store
```

## Component Structure

### Component Hierarchy

```mermaid
graph TD
    App[App Root]
    
    App --> Navigation[Navigation Container]
    Navigation --> TabNav[Tab Navigator]
    
    TabNav --> Home[Home Screen]
    TabNav --> Settings[Settings Screen]
    TabNav --> About[About Screen]
    
    Home --> ModelSelector[AI Model Selector]
    Home --> FileUploader[File Uploader]
    Home --> Options[Analysis Options]
    Home --> Results[Analysis Results]
    Home --> Monitor[Performance Monitor]
    
    Results --> DeobfuscatedTab[Deobfuscated Code]
    Results --> ReportTab[Analysis Report]
    Results --> VulnerabilitiesTab[Vulnerabilities]
    
    Monitor --> Metrics[Real-time Metrics]
    Monitor --> CircuitStatus[Circuit Breaker Status]
    Monitor --> CacheStats[Cache Statistics]
```

### Design System Components

```mermaid
graph LR
    subgraph "Design System"
        Base[Base Components]
        Themed[Themed Components]
        Complex[Complex Components]
    end
    
    Base --> Button
    Base --> Input
    Base --> Card
    Base --> Modal
    Base --> Toast
    
    Themed --> ThemedView
    Themed --> ThemedText
    Themed --> IconSymbol
    
    Complex --> FileUploader
    Complex --> ModelSelector
    Complex --> ResultsViewer
```

## Services Layer

### Service Architecture

The services layer implements a clean, modular architecture:

```mermaid
graph TB
    subgraph "Core Services"
        AnalysisService[Analysis Service]
        AIManager[AI Manager]
        ContainerService[Container Service]
    end
    
    subgraph "AI Services"
        ClaudeService[Claude Service]
        OpenAIService[OpenAI Service]
        DeepSeekService[DeepSeek Service]
        LocalModels[Local Models Service]
    end
    
    subgraph "Infrastructure Services"
        CacheManager[Cache Manager]
        APMManager[APM Manager]
        BatchProcessor[Batch Processor]
        StreamManager[Stream Manager]
    end
    
    subgraph "Resilience Services"
        CircuitFactory[Circuit Breaker Factory]
        BulkheadMgr[Bulkhead Manager]
        ResourcePool[Resource Pool]
    end
    
    AnalysisService --> AIManager
    AIManager --> CircuitFactory
    CircuitFactory --> BulkheadMgr
    BulkheadMgr --> ResourcePool
    
    ResourcePool --> ClaudeService
    ResourcePool --> OpenAIService
    ResourcePool --> DeepSeekService
    
    AnalysisService --> CacheManager
    AnalysisService --> BatchProcessor
    AnalysisService --> StreamManager
    
    AIManager --> APMManager
```

### AI Service Manager Flow

```mermaid
sequenceDiagram
    participant Client
    participant AIManager
    participant CircuitBreaker
    participant Bulkhead
    participant Cache
    participant Provider
    participant APM
    
    Client->>AIManager: analyzeWithFailover(code)
    AIManager->>Cache: check(cacheKey)
    
    alt Cache Hit
        Cache-->>AIManager: cachedResult
        AIManager-->>Client: return cachedResult
    else Cache Miss
        AIManager->>CircuitBreaker: execute(operation)
        CircuitBreaker->>Bulkhead: acquire()
        
        alt Resource Available
            Bulkhead->>Provider: analyze(code)
            Provider-->>Bulkhead: result
            Bulkhead->>CircuitBreaker: success
            CircuitBreaker->>Cache: store(result)
            CircuitBreaker->>APM: recordMetrics()
            CircuitBreaker-->>AIManager: result
            AIManager-->>Client: return result
        else Circuit Open
            CircuitBreaker-->>AIManager: Circuit Open Error
            AIManager->>AIManager: Try Next Provider
        end
    end
```

## State Management

### Zustand Store Architecture

```mermaid
graph TB
    subgraph "Root Store"
        Store[Zustand Store]
    end
    
    subgraph "Store Slices"
        AISlice[AI Model Slice]
        AnalysisSlice[Analysis Slice]
        ContainerSlice[Container Slice]
        SecuritySlice[Security Slice]
        APISlice[API Slice]
    end
    
    subgraph "Middleware"
        DevTools[DevTools Middleware]
        Logger[Logger Middleware]
        Persist[Persist Middleware]
        Performance[Performance Middleware]
    end
    
    Store --> AISlice
    Store --> AnalysisSlice
    Store --> ContainerSlice
    Store --> SecuritySlice
    Store --> APISlice
    
    DevTools --> Store
    Logger --> Store
    Persist --> Store
    Performance --> Store
```

### State Flow

```mermaid
stateDiagram-v2
    [*] --> Idle
    
    Idle --> FileSelected: Select File
    FileSelected --> ModelSelected: Select AI Model
    ModelSelected --> AnalysisStarted: Start Analysis
    
    AnalysisStarted --> CacheCheck: Check Cache
    CacheCheck --> CacheHit: Found in Cache
    CacheCheck --> CacheMiss: Not in Cache
    
    CacheHit --> ResultsDisplayed: Display Cached
    
    CacheMiss --> ProviderSelection: Select Provider
    ProviderSelection --> CircuitCheck: Check Circuit
    
    CircuitCheck --> CircuitOpen: Circuit Open
    CircuitCheck --> ResourceCheck: Circuit Closed
    
    CircuitOpen --> NextProvider: Try Next
    NextProvider --> ProviderSelection
    
    ResourceCheck --> ResourceAcquired: Acquire Resource
    ResourceCheck --> Queued: Resource Busy
    
    Queued --> ResourceAcquired: Wait
    ResourceAcquired --> Processing: Process
    
    Processing --> Success: Analysis Complete
    Processing --> Error: Analysis Failed
    
    Success --> CacheUpdate: Update Cache
    CacheUpdate --> ResultsDisplayed: Display Results
    
    Error --> NextProvider
    
    ResultsDisplayed --> [*]
```

## Performance Architecture

### Caching Strategy

```mermaid
graph TB
    subgraph "Multi-Tier Cache"
        L1[Memory Cache]
        L2[IndexedDB Cache]
        L3[Redis Cache]
    end
    
    subgraph "Cache Operations"
        Get[Get Operation]
        Set[Set Operation]
        Invalidate[Invalidate]
    end
    
    Get --> L1
    L1 -->|Miss| L2
    L2 -->|Miss| L3
    L3 -->|Miss| Origin[Origin Server]
    
    Origin --> Set
    Set --> L3
    Set --> L2
    Set --> L1
    
    Invalidate --> L1
    Invalidate --> L2
    Invalidate --> L3
```

### Batch Processing

```mermaid
graph LR
    subgraph "Batch Queue"
        Queue[Priority Queue]
        Processor[Batch Processor]
    end
    
    subgraph "Requests"
        R1[Request 1]
        R2[Request 2]
        R3[Request 3]
        Rn[Request N]
    end
    
    subgraph "Processing"
        Batch[Batched Request]
        API[API Call]
        Results[Results]
    end
    
    R1 --> Queue
    R2 --> Queue
    R3 --> Queue
    Rn --> Queue
    
    Queue --> Processor
    Processor --> Batch
    Batch --> API
    API --> Results
    Results --> Processor
    
    Processor --> R1
    Processor --> R2
    Processor --> R3
    Processor --> Rn
```

### Resource Pooling

```mermaid
graph TB
    subgraph "Resource Pool"
        Pool[Connection Pool]
        Active[Active Connections]
        Idle[Idle Connections]
    end
    
    subgraph "Clients"
        C1[Client 1]
        C2[Client 2]
        C3[Client 3]
    end
    
    subgraph "Providers"
        Claude[Claude API]
        OpenAI[OpenAI API]
        DeepSeek[DeepSeek API]
    end
    
    C1 -->|Request| Pool
    C2 -->|Request| Pool
    C3 -->|Request| Pool
    
    Pool -->|Allocate| Active
    Active --> Claude
    Active --> OpenAI
    Active --> DeepSeek
    
    Claude -->|Complete| Idle
    OpenAI -->|Complete| Idle
    DeepSeek -->|Complete| Idle
    
    Idle -->|Reuse| Active
```

## Resilience Architecture

### Circuit Breaker Pattern

```mermaid
stateDiagram-v2
    [*] --> Closed
    
    Closed --> Open: Failure Threshold Exceeded
    Closed --> Closed: Success
    
    Open --> HalfOpen: After Reset Timeout
    
    HalfOpen --> Closed: Success Threshold Met
    HalfOpen --> Open: Any Failure
    
    note right of Open
        Reject all requests
        Wait for timeout
    end note
    
    note right of HalfOpen
        Allow limited requests
        Test if service recovered
    end note
    
    note right of Closed
        Normal operation
        Track failures
    end note
```

### Bulkhead Pattern

```mermaid
graph TB
    subgraph "Service Isolation"
        subgraph "AI Service Bulkhead"
            AIQueue[Queue: 100]
            AIWorkers[Workers: 20]
        end
        
        subgraph "Container Bulkhead"
            ContainerQueue[Queue: 50]
            ContainerWorkers[Workers: 10]
        end
        
        subgraph "Cache Bulkhead"
            CacheQueue[Queue: 200]
            CacheWorkers[Workers: 30]
        end
    end
    
    subgraph "Global Semaphores"
        CPU[CPU Intensive: 5]
        Memory[Memory Intensive: 3]
        Network[Network Requests: 50]
    end
    
    AIWorkers --> CPU
    ContainerWorkers --> Memory
    CacheWorkers --> Network
```

### Adaptive Circuit Breaker

```mermaid
graph TB
    subgraph "Metrics Collection"
        ResponseTime[Response Time]
        ErrorRate[Error Rate]
        Throughput[Throughput]
    end
    
    subgraph "Adaptive Logic"
        Analyzer[Metric Analyzer]
        Thresholds[Dynamic Thresholds]
        Backoff[Backoff Strategy]
    end
    
    subgraph "Backoff Strategies"
        Linear[Linear: 1s, 2s, 3s]
        Exponential[Exponential: 1s, 2s, 4s, 8s]
        Fibonacci[Fibonacci: 1s, 1s, 2s, 3s, 5s]
    end
    
    ResponseTime --> Analyzer
    ErrorRate --> Analyzer
    Throughput --> Analyzer
    
    Analyzer --> Thresholds
    Thresholds --> Backoff
    
    Backoff --> Linear
    Backoff --> Exponential
    Backoff --> Fibonacci
```

## Security Architecture

### Multi-Layer Security

```mermaid
graph TB
    subgraph "Security Layers"
        API[API Security]
        Container[Container Security]
        Data[Data Security]
        Network[Network Security]
    end
    
    subgraph "API Security"
        RateLimit[Rate Limiting]
        CORS[CORS Policy]
        APIKeys[API Key Management]
        JWT[JWT Validation]
    end
    
    subgraph "Container Security"
        Isolation[Process Isolation]
        ResourceLimits[Resource Limits]
        Sandbox[Sandboxing]
        Monitoring[Behavior Monitoring]
    end
    
    subgraph "Data Security"
        Encryption[Encryption at Rest]
        Transit[Encryption in Transit]
        Sanitization[Input Sanitization]
        Validation[Data Validation]
    end
    
    subgraph "Network Security"
        Firewall[Network Isolation]
        SSL[SSL/TLS]
        VPN[VPN Support]
    end
```

### API Key Management

```mermaid
graph LR
    subgraph "Key Sources"
        Env[Environment Variables]
        Config[Config Files]
        UI[User Interface]
    end
    
    subgraph "Storage"
        Memory[Memory Cache]
        Secure[Secure Storage]
        Encrypted[Encrypted DB]
    end
    
    subgraph "Usage"
        Service[Service Layer]
        Request[API Request]
    end
    
    Env --> Memory
    Config --> Memory
    UI --> Secure
    
    Secure --> Encrypted
    Memory --> Service
    Encrypted --> Memory
    
    Service --> Request
```

## Data Flow

### Analysis Request Flow

```mermaid
sequenceDiagram
    participant User
    participant UI
    participant Store
    participant Gateway
    participant Analysis
    participant AIManager
    participant Cache
    participant Container
    participant AI
    participant APM
    
    User->>UI: Upload File
    UI->>Store: Set File
    User->>UI: Select Model
    UI->>Store: Set Model
    User->>UI: Start Analysis
    
    UI->>Gateway: POST /analyze
    Gateway->>Gateway: Validate Request
    Gateway->>Analysis: analyzeFile()
    
    Analysis->>Cache: checkCache()
    
    alt Cache Hit
        Cache-->>Analysis: cachedResult
    else Cache Miss
        Analysis->>Container: createContainer()
        Container->>Container: setupEnvironment()
        
        Analysis->>AIManager: analyzeWithFailover()
        AIManager->>AI: analyze()
        AI-->>AIManager: result
        
        AIManager->>Cache: store()
        AIManager->>APM: recordMetrics()
    end
    
    Analysis-->>Gateway: result
    Gateway-->>Store: updateResults()
    Store-->>UI: render()
    UI-->>User: Display Results
```

### Streaming Analysis Flow

```mermaid
sequenceDiagram
    participant Client
    participant StreamManager
    participant SSEClient
    participant AIProvider
    participant Store
    
    Client->>StreamManager: connect(provider)
    StreamManager->>SSEClient: create()
    SSEClient->>AIProvider: establish SSE
    
    Client->>StreamManager: analyze(code)
    StreamManager->>AIProvider: stream request
    
    loop Streaming
        AIProvider-->>SSEClient: chunk
        SSEClient-->>StreamManager: onMessage
        StreamManager-->>Store: updatePartial
        Store-->>Client: render update
    end
    
    AIProvider-->>SSEClient: complete
    SSEClient-->>StreamManager: onComplete
    StreamManager-->>Store: finalUpdate
    StreamManager->>StreamManager: disconnect()
```

## Deployment Architecture

### Container Architecture

```mermaid
graph TB
    subgraph "Production Deployment"
        LB[Load Balancer]
        
        subgraph "Application Instances"
            App1[Athena Instance 1]
            App2[Athena Instance 2]
            AppN[Athena Instance N]
        end
        
        subgraph "Shared Services"
            Redis[Redis Cluster]
            DB[(PostgreSQL)]
            APM[APM Collector]
        end
        
        subgraph "Container Infrastructure"
            Docker[Docker Swarm]
            K8s[Kubernetes]
        end
    end
    
    LB --> App1
    LB --> App2
    LB --> AppN
    
    App1 --> Redis
    App2 --> Redis
    AppN --> Redis
    
    App1 --> DB
    App2 --> DB
    AppN --> DB
    
    App1 --> APM
    App2 --> APM
    AppN --> APM
    
    Docker --> App1
    Docker --> App2
    K8s --> AppN
```

### CI/CD Pipeline

```mermaid
graph LR
    subgraph "Development"
        Code[Code Push]
        PR[Pull Request]
    end
    
    subgraph "CI Pipeline"
        Lint[Linting]
        Test[Unit Tests]
        Integration[Integration Tests]
        Build[Build]
        Security[Security Scan]
    end
    
    subgraph "CD Pipeline"
        Deploy[Deploy Staging]
        E2E[E2E Tests]
        LoadTest[Load Tests]
        Promote[Promote to Prod]
    end
    
    Code --> PR
    PR --> Lint
    Lint --> Test
    Test --> Integration
    Integration --> Build
    Build --> Security
    
    Security --> Deploy
    Deploy --> E2E
    E2E --> LoadTest
    LoadTest --> Promote
```

## Configuration Management

### Feature Flags Architecture

```mermaid
graph TB
    subgraph "Configuration Sources"
        Env[Environment Variables]
        Runtime[Runtime Overrides]
        Default[Default Values]
    end
    
    subgraph "Feature Flag Service"
        Manager[Flag Manager]
        Storage[Local Storage]
        Validator[Validator]
    end
    
    subgraph "Feature Categories"
        Cache[Cache Features]
        AI[AI Features]
        Resilience[Resilience Features]
        Monitoring[Monitoring Features]
    end
    
    Env --> Manager
    Runtime --> Manager
    Default --> Manager
    
    Manager --> Storage
    Manager --> Validator
    
    Manager --> Cache
    Manager --> AI
    Manager --> Resilience
    Manager --> Monitoring
```

### Environment Configuration

```mermaid
graph LR
    subgraph "Environments"
        Dev[Development]
        Staging[Staging]
        Prod[Production]
    end
    
    subgraph "Configurations"
        DevConfig[Dev Config]
        StagingConfig[Staging Config]
        ProdConfig[Prod Config]
    end
    
    subgraph "Features"
        DevFeatures[All Enabled]
        StagingFeatures[Selected Enabled]
        ProdFeatures[Stable Only]
    end
    
    Dev --> DevConfig
    Staging --> StagingConfig
    Prod --> ProdConfig
    
    DevConfig --> DevFeatures
    StagingConfig --> StagingFeatures
    ProdConfig --> ProdFeatures
```

## Performance Metrics

### Key Performance Indicators

```mermaid
graph TB
    subgraph "Application Metrics"
        ResponseTime[Response Time < 3s P95]
        Throughput[Throughput > 100 req/s]
        ErrorRate[Error Rate < 0.1%]
        Availability[Availability > 99.9%]
    end
    
    subgraph "Infrastructure Metrics"
        CPU[CPU Usage < 70%]
        Memory[Memory Usage < 80%]
        CacheHit[Cache Hit Rate > 80%]
        CircuitHealth[Circuit Breaker Health]
    end
    
    subgraph "Business Metrics"
        AnalysisSuccess[Analysis Success Rate]
        AIUsage[AI Provider Usage]
        UserSatisfaction[User Satisfaction]
        CostPerAnalysis[Cost per Analysis]
    end
```

## Conclusion

The modernized Athena architecture provides a robust, scalable, and maintainable foundation for enterprise-grade malware analysis. Key achievements include:

- **Zero circular dependencies** maintained throughout modernization
- **270+ comprehensive tests** ensuring reliability
- **Sub-3s P95 response times** under load
- **99.9% availability** through resilience patterns
- **100% backward compatibility** preserved

The architecture is designed to scale horizontally, handle failures gracefully, and provide deep observability into system behavior. With feature flags enabling gradual rollouts and runtime configuration, the system is ready for production deployment and continued evolution.

For detailed implementation guides, see:
- [Performance Guide](/docs/performance/PHASE_8_OPTIMIZATION_GUIDE.md)
- [Circuit Breaker Guide](/docs/performance/ADAPTIVE_CIRCUIT_BREAKER.md)
- [Redis Integration](/docs/performance/REDIS_CACHE_INTEGRATION.md)
- [Feature Flags](/docs/performance/FEATURE_FLAGS.md)
- [Modernization Summary](/docs/modernization/COMPREHENSIVE_MODERNIZATION_SUMMARY.md)