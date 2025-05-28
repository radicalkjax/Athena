# API Integration Architecture

## Table of Contents

- [Overview](#overview)
- [API Gateway Architecture](#api-gateway-architecture)
- [AI Provider Integration](#ai-provider-integration)
- [Resilience Patterns](#resilience-patterns)
- [Streaming Analysis](#streaming-analysis)
- [Caching Strategy](#caching-strategy)
- [Security & Authentication](#security--authentication)
- [Performance Optimization](#performance-optimization)
- [Error Handling](#error-handling)
- [Monitoring & Observability](#monitoring--observability)
- [Adding New Providers](#adding-new-providers)

## Overview

Athena's API integration architecture provides a robust, scalable foundation for interacting with multiple AI providers and internal services. The system implements enterprise-grade patterns including circuit breakers, bulkheads, distributed caching, and comprehensive monitoring.

### Key Features

- **Unified API Gateway** with CORS handling and rate limiting
- **Multi-Provider Support** with automatic failover
- **Streaming Analysis** via WebSocket and SSE
- **Resilience Patterns** for fault tolerance
- **Distributed Caching** with Redis
- **Real-time Monitoring** with APM integration

### High-Level API Flow

```mermaid
graph TB
    subgraph "Client Applications"
        Web[Web App]
        Mobile[Mobile App]
        CLI[CLI Tools]
        SDK[SDK/Library]
    end
    
    subgraph "API Gateway Layer"
        LB[Load Balancer]
        Gateway[API Gateway]
        
        subgraph "Gateway Components"
            Auth[Authentication]
            RateLimit[Rate Limiter]
            Validator[Request Validator]
            Router[Request Router]
            Cache[Cache Manager]
        end
    end
    
    subgraph "Service Mesh"
        Discovery[Service Discovery]
        Config[Config Service]
        Health[Health Monitor]
    end
    
    subgraph "Business Services"
        Analysis[Analysis Service]
        AI[AI Manager]
        Container[Container Service]
        Batch[Batch Processor]
        Stream[Stream Manager]
    end
    
    subgraph "Infrastructure Services"
        Queue[Message Queue]
        Redis[(Redis Cache)]
        DB[(PostgreSQL)]
        Files[File Storage]
    end
    
    Web --> LB
    Mobile --> LB
    CLI --> LB
    SDK --> LB
    
    LB --> Gateway
    Gateway --> Auth
    Auth --> RateLimit
    RateLimit --> Validator
    Validator --> Router
    Router --> Cache
    
    Router --> Discovery
    Discovery --> Analysis
    Discovery --> AI
    Discovery --> Container
    Discovery --> Batch
    Discovery --> Stream
    
    Analysis --> Queue
    Analysis --> Redis
    Analysis --> DB
    AI --> Redis
    Container --> DB
    Batch --> Queue
    Stream --> Redis
    
    Config --> Gateway
    Health --> Gateway
```

## API Gateway Architecture

The API Gateway serves as the single entry point for all client requests, providing consistent handling of cross-cutting concerns:

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web App]
        Mobile[Mobile App]
        CLI[CLI Tools]
    end
    
    subgraph "API Gateway"
        Gateway[Gateway Router]
        MW[Middleware Stack]
        
        subgraph "Middleware"
            CORS[CORS Handler]
            Auth[Authentication]
            RateLimit[Rate Limiter]
            Logger[Request Logger]
            Error[Error Handler]
        end
    end
    
    subgraph "Service Layer"
        Analysis[Analysis Service]
        AI[AI Manager]
        Container[Container Service]
        Batch[Batch Processor]
    end
    
    Web --> Gateway
    Mobile --> Gateway
    CLI --> Gateway
    
    Gateway --> MW
    MW --> CORS
    MW --> Auth
    MW --> RateLimit
    MW --> Logger
    MW --> Error
    
    MW --> Analysis
    MW --> AI
    MW --> Container
    MW --> Batch
```

### Gateway Implementation

```typescript
// API Gateway with comprehensive middleware
class APIGateway {
  private static instance: APIGateway;
  private errorHandler: APIErrorHandler;
  private cache: AnalysisCacheManager;
  
  async handleRequest(endpoint: string, options: RequestOptions) {
    const span = apmManager.startSpan('api.request', {
      endpoint,
      method: options.method
    });
    
    try {
      // Check cache for GET requests
      if (options.method === 'GET') {
        const cached = await this.cache.get(this.getCacheKey(endpoint, options));
        if (cached) {
          span.tags.cache_hit = true;
          return cached;
        }
      }
      
      // Apply rate limiting
      await this.rateLimiter.check(endpoint);
      
      // Execute request with circuit breaker
      const result = await circuitBreakerFactory.execute(
        `api.${endpoint}`,
        async () => this.executeRequest(endpoint, options)
      );
      
      // Cache successful responses
      if (options.method === 'GET') {
        await this.cache.set(this.getCacheKey(endpoint, options), result);
      }
      
      return result;
    } catch (error) {
      return this.errorHandler.handle(error);
    } finally {
      apmManager.finishSpan(span);
    }
  }
}
```

## AI Provider Integration

The AI integration layer implements a sophisticated manager pattern with automatic failover, load balancing, and provider health monitoring:

### Provider Failover Sequence

```mermaid
sequenceDiagram
    participant Client
    participant AIManager
    participant CircuitBreaker
    participant Bulkhead
    participant Provider1[Claude]
    participant Provider2[OpenAI]
    participant Provider3[DeepSeek]
    participant Cache
    participant APM
    
    Client->>AIManager: analyze(code)
    AIManager->>AIManager: Sort providers by priority
    
    loop For each provider
        AIManager->>CircuitBreaker: check(provider)
        
        alt Circuit Closed
            CircuitBreaker->>Bulkhead: acquire()
            Bulkhead->>Provider1: analyze()
            
            alt Success
                Provider1-->>Bulkhead: result
                Bulkhead-->>CircuitBreaker: release()
                CircuitBreaker->>Cache: store()
                CircuitBreaker->>APM: metrics
                CircuitBreaker-->>AIManager: result
                AIManager-->>Client: result
            else Failure
                Provider1-->>Bulkhead: error
                Bulkhead-->>CircuitBreaker: release()
                CircuitBreaker->>CircuitBreaker: record failure
                CircuitBreaker-->>AIManager: try next
            end
        else Circuit Open
            CircuitBreaker-->>AIManager: skip provider
        end
    end
```

### AI Provider Architecture

```mermaid
graph TB
    subgraph "AI Manager Layer"
        Manager[AI Service Manager]
        Selector[Provider Selector]
        LoadBalancer[Load Balancer]
        HealthCheck[Health Monitor]
    end
    
    subgraph "Provider Pool"
        subgraph "Primary Providers"
            Claude[Claude<br/>Priority: 1<br/>Capacity: High]
            OpenAI[OpenAI<br/>Priority: 2<br/>Capacity: High]
        end
        
        subgraph "Secondary Providers"
            DeepSeek[DeepSeek<br/>Priority: 3<br/>Capacity: Medium]
            Local[Local Models<br/>Priority: 4<br/>Capacity: Low]
        end
    end
    
    subgraph "Resilience Controls"
        CB1[Circuit Breaker<br/>Claude]
        CB2[Circuit Breaker<br/>OpenAI]
        CB3[Circuit Breaker<br/>DeepSeek]
        CB4[Circuit Breaker<br/>Local]
        
        BH1[Bulkhead<br/>20 workers]
        BH2[Bulkhead<br/>20 workers]
        BH3[Bulkhead<br/>10 workers]
        BH4[Bulkhead<br/>5 workers]
    end
    
    subgraph "Monitoring"
        Metrics[Metrics Collector]
        Alerts[Alert Manager]
        Dashboard[Dashboard]
    end
    
    Manager --> Selector
    Selector --> LoadBalancer
    LoadBalancer --> HealthCheck
    
    HealthCheck --> CB1
    HealthCheck --> CB2
    HealthCheck --> CB3
    HealthCheck --> CB4
    
    CB1 --> BH1
    CB2 --> BH2
    CB3 --> BH3
    CB4 --> BH4
    
    BH1 --> Claude
    BH2 --> OpenAI
    BH3 --> DeepSeek
    BH4 --> Local
    
    Claude --> Metrics
    OpenAI --> Metrics
    DeepSeek --> Metrics
    Local --> Metrics
    
    Metrics --> Alerts
    Metrics --> Dashboard
```

### Provider Configuration

```typescript
interface AIProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  models: ModelConfig[];
  limits: {
    maxTokens: number;
    maxRequests: number;
    maxConcurrent: number;
  };
  features: {
    streaming: boolean;
    batching: boolean;
    functionCalling: boolean;
  };
}

// Provider-specific configurations
const PROVIDER_CONFIGS: Record<string, AIProviderConfig> = {
  claude: {
    name: 'Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: env.api.claude.key,
    models: [
      { id: 'claude-3-opus', maxTokens: 200000 },
      { id: 'claude-3-sonnet', maxTokens: 200000 },
      { id: 'claude-3-haiku', maxTokens: 200000 }
    ],
    limits: {
      maxTokens: 200000,
      maxRequests: 1000,
      maxConcurrent: 20
    },
    features: {
      streaming: true,
      batching: false,
      functionCalling: true
    }
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: env.api.openai.key,
    models: [
      { id: 'gpt-4-turbo', maxTokens: 128000 },
      { id: 'gpt-4', maxTokens: 8192 },
      { id: 'gpt-3.5-turbo', maxTokens: 16384 }
    ],
    limits: {
      maxTokens: 128000,
      maxRequests: 5000,
      maxConcurrent: 20
    },
    features: {
      streaming: true,
      batching: true,
      functionCalling: true
    }
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: env.api.deepseek.key,
    models: [
      { id: 'deepseek-coder', maxTokens: 16384 },
      { id: 'deepseek-chat', maxTokens: 32768 }
    ],
    limits: {
      maxTokens: 32768,
      maxRequests: 1000,
      maxConcurrent: 10
    },
    features: {
      streaming: false,
      batching: true,
      functionCalling: false
    }
  }
};
```

## Resilience Patterns

### Circuit Breaker Implementation

The system uses adaptive circuit breakers that adjust based on response times and error rates:

```mermaid
stateDiagram-v2
    [*] --> Closed: Initial State
    
    Closed --> Open: Failures > Threshold OR Response Time > Target
    Closed --> Closed: Success
    
    Open --> HalfOpen: After Backoff Period
    Open --> Open: Reject Requests
    
    HalfOpen --> Closed: Success Count > Threshold
    HalfOpen --> Open: Any Failure
    
    note right of Open
        Backoff Strategies:
        - Linear: 1s, 2s, 3s
        - Exponential: 1s, 2s, 4s, 8s
        - Fibonacci: 1s, 1s, 2s, 3s, 5s
    end note
```

### Bulkhead Pattern

Service isolation prevents cascade failures:

```mermaid
graph TB
    subgraph "Request Flow"
        Req[Incoming Request]
        Queue[Request Queue]
        Workers[Worker Pool]
        Semaphore[Global Semaphore]
    end
    
    subgraph "Bulkhead Configuration"
        AI[AI Service<br/>Workers: 20<br/>Queue: 100]
        Container[Container Service<br/>Workers: 10<br/>Queue: 50]
        Cache[Cache Service<br/>Workers: 30<br/>Queue: 200]
    end
    
    subgraph "Resource Limits"
        CPU[CPU Intensive: 5]
        Memory[Memory Intensive: 3]
        Network[Network: 50]
    end
    
    Req --> Queue
    Queue --> Workers
    Workers --> Semaphore
    
    AI --> CPU
    Container --> Memory
    Cache --> Network
```

## Streaming Analysis

Support for real-time streaming responses via WebSocket and Server-Sent Events:

### Streaming Protocol Flow

```mermaid
sequenceDiagram
    participant Client
    participant StreamManager
    participant Protocol[Protocol Selector]
    participant WS[WebSocket]
    participant SSE[SSE]
    participant Provider
    
    Client->>StreamManager: requestStream(analysis)
    StreamManager->>Protocol: selectProtocol(provider)
    
    alt WebSocket Available
        Protocol->>WS: createConnection()
        WS->>Provider: establish WebSocket
        
        loop Streaming
            Provider-->>WS: data chunk
            WS-->>StreamManager: onMessage(chunk)
            StreamManager-->>Client: updateUI(chunk)
        end
    else SSE Available
        Protocol->>SSE: createConnection()
        SSE->>Provider: establish SSE
        
        loop Streaming
            Provider-->>SSE: event stream
            SSE-->>StreamManager: onMessage(event)
            StreamManager-->>Client: updateUI(event)
        end
    else Polling Fallback
        loop Until Complete
            StreamManager->>Provider: poll()
            Provider-->>StreamManager: partial result
            StreamManager-->>Client: updateUI(partial)
        end
    end
```

### Streaming Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        UI[UI Components]
        StreamHook[useStreamingAnalysis Hook]
        EventHandler[Event Handler]
    end
    
    subgraph "Stream Management"
        Manager[Stream Manager]
        
        subgraph "Protocol Handlers"
            WSHandler[WebSocket Handler]
            SSEHandler[SSE Handler]
            PollingHandler[Polling Handler]
        end
        
        subgraph "Stream Processing"
            Parser[Chunk Parser]
            Buffer[Stream Buffer]
            Aggregator[Result Aggregator]
        end
    end
    
    subgraph "Connection Management"
        ConnectionPool[Connection Pool]
        Reconnect[Reconnect Logic]
        Heartbeat[Heartbeat Monitor]
    end
    
    subgraph "Stream Features"
        Backpressure[Backpressure Control]
        Compression[Compression]
        Encryption[Encryption]
    end
    
    subgraph "Providers"
        Claude[Claude Stream]
        OpenAI[OpenAI Stream]
        DeepSeek[DeepSeek API]
    end
    
    UI --> StreamHook
    StreamHook --> EventHandler
    EventHandler --> Manager
    
    Manager --> WSHandler
    Manager --> SSEHandler
    Manager --> PollingHandler
    
    WSHandler --> Parser
    SSEHandler --> Parser
    PollingHandler --> Parser
    
    Parser --> Buffer
    Buffer --> Aggregator
    
    WSHandler --> ConnectionPool
    SSEHandler --> ConnectionPool
    
    ConnectionPool --> Reconnect
    ConnectionPool --> Heartbeat
    
    ConnectionPool --> Backpressure
    ConnectionPool --> Compression
    ConnectionPool --> Encryption
    
    ConnectionPool --> Claude
    ConnectionPool --> OpenAI
    PollingHandler --> DeepSeek
```

### Stream State Management

```mermaid
stateDiagram-v2
    [*] --> Idle: Initial State
    
    Idle --> Connecting: requestStream()
    Connecting --> Connected: Connection Success
    Connecting --> Error: Connection Failed
    
    Connected --> Streaming: Start Stream
    Streaming --> Buffering: High Load
    Buffering --> Streaming: Load Normal
    
    Streaming --> Paused: Pause Request
    Paused --> Streaming: Resume Request
    
    Streaming --> Completed: Stream End
    Streaming --> Error: Stream Error
    
    Error --> Reconnecting: Auto Retry
    Reconnecting --> Connected: Reconnect Success
    Reconnecting --> Failed: Max Retries
    
    Completed --> Idle: Reset
    Failed --> Idle: Reset
    
    note right of Buffering
        Implements backpressure
        when client can't keep up
    end note
    
    note right of Reconnecting
        Exponential backoff:
        1s, 2s, 4s, 8s, 16s
    end note
```

### Streaming Implementation

```typescript
class StreamingAnalysis {
  async analyzeWithStream(
    code: string,
    provider: string,
    onChunk: (chunk: AnalysisChunk) => void
  ): Promise<void> {
    const connection = await this.streamManager.connect(provider, {
      url: this.getStreamingEndpoint(provider),
      protocol: this.getPreferredProtocol(provider)
    });
    
    connection.on('message', (data) => {
      const chunk = this.parseChunk(data);
      onChunk(chunk);
      
      // Update partial results in cache
      this.cache.updatePartial(this.getCacheKey(), chunk);
    });
    
    connection.on('complete', async (finalResult) => {
      // Store complete result
      await this.cache.set(this.getCacheKey(), finalResult);
      connection.close();
    });
    
    // Send analysis request
    await connection.send({
      type: 'analyze',
      code,
      streaming: true
    });
  }
}
```

## Caching Strategy

Multi-tier caching with automatic fallback and synchronization:

### Cache Hierarchy

```mermaid
graph TB
    subgraph "Cache Hierarchy"
        L1[L1: Memory Cache<br/>TTL: 5 min<br/>Size: 100MB]
        L2[L2: IndexedDB<br/>TTL: 1 hour<br/>Size: 1GB]
        L3[L3: Redis<br/>TTL: 24 hours<br/>Size: 10GB]
    end
    
    subgraph "Cache Operations"
        Get[Get Request]
        Set[Set Result]
        Invalidate[Invalidate]
        Sync[Sync Between Tiers]
    end
    
    Get --> L1
    L1 -->|Miss| L2
    L2 -->|Miss| L3
    L3 -->|Miss| Origin[AI Provider]
    
    Origin --> Set
    Set --> L3
    Set --> L2
    Set --> L1
    
    L3 --> Sync
    Sync --> L2
    Sync --> L1
```

### Cache Integration Flow

```mermaid
sequenceDiagram
    participant Client
    participant API[API Gateway]
    participant CacheManager
    participant Memory[Memory Cache]
    participant IndexedDB
    participant Redis
    participant Provider[AI Provider]
    participant Monitor[Cache Monitor]
    
    Client->>API: Request Analysis
    API->>CacheManager: get(key)
    
    CacheManager->>Memory: check(key)
    alt Memory Hit
        Memory-->>CacheManager: cached result
        CacheManager->>Monitor: recordHit(L1)
        CacheManager-->>API: result
        API-->>Client: response
    else Memory Miss
        CacheManager->>IndexedDB: check(key)
        alt IndexedDB Hit
            IndexedDB-->>CacheManager: cached result
            CacheManager->>Memory: populate(key)
            CacheManager->>Monitor: recordHit(L2)
            CacheManager-->>API: result
            API-->>Client: response
        else IndexedDB Miss
            CacheManager->>Redis: check(key)
            alt Redis Hit
                Redis-->>CacheManager: cached result
                CacheManager->>IndexedDB: populate(key)
                CacheManager->>Memory: populate(key)
                CacheManager->>Monitor: recordHit(L3)
                CacheManager-->>API: result
                API-->>Client: response
            else Cache Miss
                CacheManager->>Provider: request()
                Provider-->>CacheManager: fresh result
                
                par Async Cache Population
                    CacheManager->>Redis: set(key, result, ttl)
                and
                    CacheManager->>IndexedDB: set(key, result, ttl)
                and
                    CacheManager->>Memory: set(key, result, ttl)
                and
                    CacheManager->>Monitor: recordMiss()
                end
                
                CacheManager-->>API: result
                API-->>Client: response
            end
        end
    end
```

### Cache Invalidation Strategy

```mermaid
graph TB
    subgraph "Invalidation Triggers"
        Manual[Manual Invalidation]
        TTL[TTL Expiry]
        Event[Event-Based]
        Size[Size Limit]
    end
    
    subgraph "Invalidation Patterns"
        Single[Single Key]
        Pattern[Pattern Match]
        Tag[Tag-Based]
        All[Clear All]
    end
    
    subgraph "Invalidation Process"
        Coordinator[Invalidation Coordinator]
        
        subgraph "Cache Layers"
            MemInv[Memory Invalidate]
            IDBInv[IndexedDB Invalidate]
            RedisInv[Redis Invalidate]
        end
        
        Broadcast[Event Broadcast]
    end
    
    Manual --> Single
    TTL --> Single
    Event --> Pattern
    Size --> Tag
    
    Single --> Coordinator
    Pattern --> Coordinator
    Tag --> Coordinator
    All --> Coordinator
    
    Coordinator --> MemInv
    Coordinator --> IDBInv
    Coordinator --> RedisInv
    
    Coordinator --> Broadcast
    
    note right of Broadcast
        Notifies other instances
        for distributed cache
        consistency
    end note
```

### Cache Key Strategy

```typescript
class CacheKeyBuilder {
  static buildKey(params: {
    provider: string;
    model: string;
    code: string;
    analysisType: string;
    options?: Record<string, any>;
  }): string {
    const codeHash = this.hashCode(params.code);
    const optionsHash = params.options 
      ? this.hashObject(params.options) 
      : 'default';
    
    return `analysis:${params.provider}:${params.model}:${params.analysisType}:${codeHash}:${optionsHash}`;
  }
  
  private static hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex').substring(0, 16);
  }
  
  private static hashObject(obj: Record<string, any>): string {
    const sorted = JSON.stringify(this.sortObject(obj));
    return createHash('md5').update(sorted).digest('hex').substring(0, 8);
  }
}
```

## Security & Authentication

### API Key Management

```mermaid
graph LR
    subgraph "Key Sources"
        Env[Environment Variables]
        UI[User Interface]
        Vault[Secret Manager]
    end
    
    subgraph "Storage Layers"
        Memory[Memory Cache<br/>Encrypted]
        Local[Local Storage<br/>Encrypted]
        Remote[Remote Config<br/>Encrypted]
    end
    
    subgraph "Usage"
        Service[Service Layer]
        Validator[Key Validator]
        Rotator[Key Rotator]
    end
    
    Env --> Memory
    UI --> Local
    Vault --> Remote
    
    Memory --> Validator
    Local --> Validator
    Remote --> Validator
    
    Validator --> Service
    Validator --> Rotator
```

### Complete Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway[API Gateway]
    participant Auth[Auth Middleware]
    participant KeyStore[Key Store]
    participant Validator[Key Validator]
    participant RateLimit[Rate Limiter]
    participant Provider[AI Provider]
    participant Audit[Audit Logger]
    
    Client->>Gateway: Request + API Key
    Gateway->>Auth: authenticate(request)
    
    Auth->>Auth: Extract API Key
    alt No API Key
        Auth-->>Gateway: 401 Unauthorized
        Gateway-->>Client: Missing API Key
    else Has API Key
        Auth->>KeyStore: getKeyInfo(key)
        
        alt Key Not Found
            Auth->>Audit: logFailedAuth(key)
            Auth-->>Gateway: 401 Unauthorized
            Gateway-->>Client: Invalid API Key
        else Key Found
            KeyStore-->>Auth: keyInfo + permissions
            
            Auth->>Validator: validateKey(key, provider)
            alt Invalid Format
                Auth->>Audit: logInvalidFormat(key)
                Auth-->>Gateway: 401 Unauthorized
                Gateway-->>Client: Invalid Key Format
            else Valid Format
                Auth->>RateLimit: checkLimit(key)
                
                alt Rate Limit Exceeded
                    RateLimit-->>Auth: limitExceeded
                    Auth->>Audit: logRateLimitExceeded(key)
                    Auth-->>Gateway: 429 Too Many Requests
                    Gateway-->>Client: Rate Limit Exceeded
                else Within Limit
                    Auth->>Provider: validateWithProvider(key)
                    
                    alt Provider Validation Failed
                        Provider-->>Auth: invalid
                        Auth->>Audit: logProviderValidationFailed(key)
                        Auth-->>Gateway: 401 Unauthorized
                        Gateway-->>Client: Provider Validation Failed
                    else Provider Validation Success
                        Provider-->>Auth: valid + quotas
                        Auth->>Audit: logSuccessfulAuth(key)
                        Auth-->>Gateway: AuthContext
                        Gateway->>Gateway: Proceed with request
                    end
                end
            end
        end
    end
```

### Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        subgraph "Transport Security"
            TLS[TLS 1.3]
            HSTS[HSTS Headers]
            CSP[Content Security Policy]
        end
        
        subgraph "Authentication"
            APIKeys[API Key Auth]
            JWT[JWT Tokens]
            OAuth[OAuth 2.0]
        end
        
        subgraph "Authorization"
            RBAC[Role-Based Access]
            Permissions[Permission System]
            Scopes[API Scopes]
        end
        
        subgraph "Data Protection"
            Encryption[At-Rest Encryption]
            Transit[In-Transit Encryption]
            Masking[Data Masking]
        end
    end
    
    subgraph "Security Controls"
        subgraph "Input Validation"
            Schema[Schema Validation]
            Sanitize[Input Sanitization]
            Size[Size Limits]
        end
        
        subgraph "Rate Limiting"
            PerKey[Per-Key Limits]
            PerIP[Per-IP Limits]
            Global[Global Limits]
        end
        
        subgraph "Monitoring"
            IDS[Intrusion Detection]
            Anomaly[Anomaly Detection]
            Alerts[Security Alerts]
        end
    end
    
    subgraph "Compliance"
        GDPR[GDPR Compliance]
        SOC2[SOC2 Controls]
        PCI[PCI Standards]
    end
    
    TLS --> APIKeys
    APIKeys --> RBAC
    RBAC --> Schema
    Schema --> PerKey
    PerKey --> IDS
    
    Encryption --> Transit
    Transit --> Masking
    
    IDS --> Alerts
    Anomaly --> Alerts
    
    Alerts --> GDPR
    Alerts --> SOC2
    Alerts --> PCI
```

### Request Authentication

```typescript
class AuthenticationMiddleware {
  async authenticate(request: Request): Promise<AuthResult> {
    // Check API key
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      throw new UnauthorizedError('API key required');
    }
    
    // Validate key format
    if (!this.isValidKeyFormat(apiKey)) {
      throw new UnauthorizedError('Invalid API key format');
    }
    
    // Check rate limits
    const rateLimitStatus = await this.rateLimiter.check(apiKey);
    if (rateLimitStatus.exceeded) {
      throw new RateLimitError(rateLimitStatus);
    }
    
    // Validate against provider
    const provider = await this.validateWithProvider(apiKey);
    if (!provider) {
      throw new UnauthorizedError('Invalid API key');
    }
    
    return {
      authenticated: true,
      provider,
      limits: rateLimitStatus
    };
  }
}
```

## Performance Optimization

### Request Batching

Automatic batching of multiple requests for efficiency:

```mermaid
graph LR
    subgraph "Request Queue"
        R1[Request 1]
        R2[Request 2]
        R3[Request 3]
        Rn[Request N]
    end
    
    subgraph "Batch Processor"
        Collector[Batch Collector<br/>Window: 100ms]
        Optimizer[Batch Optimizer]
        Executor[Batch Executor]
    end
    
    subgraph "Results"
        Result[Batched Response]
        Splitter[Result Splitter]
        C1[Client 1]
        C2[Client 2]
        C3[Client 3]
    end
    
    R1 --> Collector
    R2 --> Collector
    R3 --> Collector
    Rn --> Collector
    
    Collector --> Optimizer
    Optimizer --> Executor
    Executor --> Result
    Result --> Splitter
    
    Splitter --> C1
    Splitter --> C2
    Splitter --> C3
```

### Connection Pooling

```typescript
class ConnectionPool {
  private pools: Map<string, Pool> = new Map();
  
  async getConnection(provider: string): Promise<Connection> {
    const pool = this.getPool(provider);
    
    // Try to get an idle connection
    const idle = pool.getIdle();
    if (idle) {
      return idle;
    }
    
    // Check if we can create a new connection
    if (pool.size < pool.maxSize) {
      return this.createConnection(provider);
    }
    
    // Wait for a connection to become available
    return pool.waitForAvailable();
  }
  
  private getPool(provider: string): Pool {
    if (!this.pools.has(provider)) {
      this.pools.set(provider, new Pool({
        maxSize: this.getMaxPoolSize(provider),
        idleTimeout: 60000,
        connectionTimeout: 30000
      }));
    }
    return this.pools.get(provider)!;
  }
}
```

## Error Handling

### Comprehensive Error Hierarchy

```mermaid
graph TD
    BaseError[APIError]
    
    BaseError --> NetworkError
    BaseError --> ValidationError
    BaseError --> AuthError
    BaseError --> RateLimitError
    BaseError --> ProviderError
    
    NetworkError --> TimeoutError
    NetworkError --> ConnectionError
    
    ValidationError --> InvalidRequestError
    ValidationError --> InvalidResponseError
    
    AuthError --> UnauthorizedError
    AuthError --> ForbiddenError
    
    ProviderError --> ServiceUnavailableError
    ProviderError --> QuotaExceededError
```

### Error Recovery Strategies

```typescript
class ErrorRecoveryStrategy {
  async handle(error: APIError, context: RequestContext): Promise<any> {
    const strategy = this.selectStrategy(error);
    
    switch (strategy) {
      case 'retry':
        return this.retryWithBackoff(context);
        
      case 'failover':
        return this.failoverToNextProvider(context);
        
      case 'degrade':
        return this.degradeGracefully(context);
        
      case 'cache':
        return this.serveCachedResponse(context);
        
      case 'queue':
        return this.queueForLater(context);
        
      default:
        throw error;
    }
  }
  
  private selectStrategy(error: APIError): RecoveryStrategy {
    if (error instanceof TimeoutError) return 'retry';
    if (error instanceof ServiceUnavailableError) return 'failover';
    if (error instanceof RateLimitError) return 'queue';
    if (error instanceof NetworkError) return 'cache';
    return 'none';
  }
}
```

## Monitoring & Observability

### APM Integration

```mermaid
graph TB
    subgraph "Metrics Collection"
        Request[Request Metrics]
        Response[Response Metrics]
        Error[Error Metrics]
        Business[Business Metrics]
    end
    
    subgraph "APM Pipeline"
        Collector[Metric Collector]
        Aggregator[Aggregator]
        Exporter[Exporter]
    end
    
    subgraph "Destinations"
        StatsD[StatsD]
        Prometheus[Prometheus]
        DataDog[DataDog]
        Console[Console]
    end
    
    Request --> Collector
    Response --> Collector
    Error --> Collector
    Business --> Collector
    
    Collector --> Aggregator
    Aggregator --> Exporter
    
    Exporter --> StatsD
    Exporter --> Prometheus
    Exporter --> DataDog
    Exporter --> Console
```

### Key Metrics

```typescript
interface APIMetrics {
  // Request metrics
  requestCount: Counter;
  requestDuration: Histogram;
  requestSize: Histogram;
  
  // Response metrics
  responseTime: Histogram;
  responseSize: Histogram;
  statusCodes: Counter;
  
  // Error metrics
  errorRate: Gauge;
  errorsByType: Counter;
  
  // Business metrics
  analysisSuccess: Counter;
  providerUsage: Counter;
  cacheHitRate: Gauge;
  
  // Circuit breaker metrics
  circuitState: Gauge;
  circuitFailures: Counter;
  
  // Resource metrics
  poolUtilization: Gauge;
  queueDepth: Gauge;
}
```

## Adding New Providers

### Provider Interface

```typescript
interface AIProvider {
  // Metadata
  readonly name: string;
  readonly version: string;
  readonly features: ProviderFeatures;
  
  // Core methods
  analyze(request: AnalysisRequest): Promise<AnalysisResult>;
  analyzeStream(request: AnalysisRequest): AsyncGenerator<AnalysisChunk>;
  
  // Health checks
  healthCheck(): Promise<HealthStatus>;
  validateApiKey(key: string): Promise<boolean>;
  
  // Resource management
  getUsage(): Promise<UsageStats>;
  getRateLimits(): Promise<RateLimits>;
}
```

### Implementation Template

```typescript
export class NewAIProvider extends BaseAIService implements AIProvider {
  readonly name = 'NewProvider';
  readonly version = '1.0.0';
  readonly features = {
    streaming: true,
    batching: true,
    functionCalling: false
  };
  
  constructor(config: AIProviderConfig) {
    super(config);
    this.initializeClient();
  }
  
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    // Validate request
    this.validateRequest(request);
    
    // Check circuit breaker
    return circuitBreakerFactory.execute(
      `ai.${this.name}.analyze`,
      async () => {
        // Execute with bulkhead protection
        return bulkheadManager.execute(
          `ai.${this.name}`,
          async () => {
            // Make API call
            const response = await this.client.complete({
              model: request.model,
              messages: this.formatMessages(request),
              temperature: 0.3,
              max_tokens: 4000
            });
            
            // Parse and return result
            return this.parseResponse(response);
          }
        );
      }
    );
  }
  
  async *analyzeStream(request: AnalysisRequest): AsyncGenerator<AnalysisChunk> {
    const stream = await this.client.streamComplete({
      model: request.model,
      messages: this.formatMessages(request),
      stream: true
    });
    
    for await (const chunk of stream) {
      yield this.parseChunk(chunk);
    }
  }
}
```

## Best Practices

### 1. **Always Use Circuit Breakers**
```typescript
// ✅ Good
const result = await circuitBreakerFactory.execute('api.endpoint', operation);

// ❌ Bad
const result = await operation();
```

### 2. **Implement Proper Caching**
```typescript
// ✅ Good
const cacheKey = CacheKeyBuilder.buildKey(params);
const cached = await cache.get(cacheKey);
if (cached) return cached;

// ❌ Bad
// No caching
```

### 3. **Handle Streaming Gracefully**
```typescript
// ✅ Good
try {
  for await (const chunk of stream) {
    processChunk(chunk);
  }
} catch (error) {
  handleStreamError(error);
} finally {
  cleanupStream();
}

// ❌ Bad
// No error handling for streams
```

### 4. **Monitor Everything**
```typescript
// ✅ Good
const span = apmManager.startSpan('operation');
try {
  const result = await operation();
  span.tags.success = true;
  return result;
} catch (error) {
  span.tags.error = true;
  throw error;
} finally {
  apmManager.finishSpan(span);
}

// ❌ Bad
// No monitoring
```

### 5. **Validate Early**
```typescript
// ✅ Good
this.validateRequest(request);
this.validateApiKey(apiKey);

// ❌ Bad
// Assume valid input
```

## Complete API Request Lifecycle

This diagram shows how all components work together to process an API request:

```mermaid
graph TB
    subgraph "Request Initiation"
        Client[Client Application]
        Request[API Request]
    end
    
    subgraph "API Gateway"
        CORS[CORS Check]
        Auth[Authentication]
        RateLimit[Rate Limiting]
        Validate[Validation]
    end
    
    subgraph "Request Processing"
        Cache[Cache Check]
        Router[Request Router]
        
        subgraph "Service Selection"
            Analysis[Analysis Service]
            AI[AI Manager]
            Container[Container Service]
        end
    end
    
    subgraph "AI Processing"
        CircuitBreaker[Circuit Breaker]
        Bulkhead[Bulkhead]
        Provider[AI Provider]
        Failover[Failover Logic]
    end
    
    subgraph "Response Path"
        Transform[Response Transform]
        CacheWrite[Cache Write]
        Compress[Compression]
    end
    
    subgraph "Monitoring"
        APM[APM Tracking]
        Metrics[Metrics]
        Logs[Logging]
    end
    
    Client --> Request
    Request --> CORS
    CORS -->|Pass| Auth
    CORS -->|Fail| Client
    
    Auth -->|Pass| RateLimit
    Auth -->|Fail| Client
    
    RateLimit -->|Pass| Validate
    RateLimit -->|Fail| Client
    
    Validate -->|Pass| Cache
    Validate -->|Fail| Client
    
    Cache -->|Hit| Transform
    Cache -->|Miss| Router
    
    Router --> Analysis
    Router --> AI
    Router --> Container
    
    AI --> CircuitBreaker
    CircuitBreaker --> Bulkhead
    Bulkhead --> Provider
    
    Provider -->|Success| Transform
    Provider -->|Fail| Failover
    Failover --> Provider
    
    Analysis --> Transform
    Container --> Transform
    
    Transform --> CacheWrite
    CacheWrite --> Compress
    Compress --> Client
    
    Request -.-> APM
    Auth -.-> APM
    Provider -.-> APM
    Transform -.-> APM
    
    APM --> Metrics
    APM --> Logs
```

## Conclusion

The modernized API integration architecture provides:

- **High Availability**: Through circuit breakers and failover
- **Performance**: Via caching, batching, and pooling
- **Observability**: With comprehensive monitoring
- **Security**: Through proper authentication and validation
- **Flexibility**: Easy to add new providers and features

For implementation details, see:
- [API Gateway Implementation](/Athena/services/api/gateway.ts)
- [AI Manager](/Athena/services/ai/manager.ts)
- [Circuit Breaker Factory](/Athena/services/ai/circuitBreakerFactory.ts)
- [Cache Manager](/Athena/services/cache/manager.ts)
- [Stream Manager](/Athena/services/streaming/manager.ts)