# External Agent Integration Guide

This guide explains how to implement an external security agent that integrates with the Athena platform.

## Overview

Athena supports six external security agents that operate as independent services:

1. **OWL** - Observational Window Learning (Pattern Detection)
2. **DORU** - Dynamic Operational Response Unit (Malware Analysis)
3. **AEGIS** - Automated Exploit Generation & Intelligence System (Threat Intelligence)
4. **WEAVER** - Web Extraction & Vulnerability Enumeration (Network Analysis)
5. **FORGE** - Forensic Output & Report Generation (Report Generation)
6. **POLIS** - Policy Optimization & Learning Intelligence System (Compliance)

## Implementation Requirements

Each agent must implement the `ISecurityAgent` interface defined in `services/agents/base/agent-interface.ts`.

### Example Agent Implementation (TypeScript)

```typescript
import axios from 'axios';
import { ISecurityAgent, AgentConfiguration, AgentRequest, AgentResponse } from '@athena/agent-interface';

export class OWLAgent implements ISecurityAgent {
  private config: AgentConfiguration;
  private athenaClient: AxiosInstance;

  getId(): AgentId {
    return 'OWL';
  }

  getName(): string {
    return 'Observational Window Learning';
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCapabilities(): AgentCapabilities {
    return {
      wasmModules: ['pattern-matcher', 'analysis-engine'],
      aiProviders: ['claude', 'deepseek', 'openai'],
      supportedOperations: [
        'pattern-matching',
        'vulnerability-assessment',
        'real-time-detection'
      ],
      realTimeProcessing: true,
      batchProcessing: true,
      maxConcurrentRequests: 10
    };
  }

  async initialize(config: AgentConfiguration): Promise<void> {
    this.config = config;
    
    // Set up Athena client for callbacks
    this.athenaClient = axios.create({
      baseURL: config.athenaEndpoint,
      headers: {
        'Authorization': `Bearer ${config.authToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Initialize WASM module connections
    await this.connectToWasmModules();
    
    // Initialize AI provider connections
    await this.connectToAIProviders();
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Use WASM modules for initial analysis
      const patternResults = await this.analyzeWithWasm(request.data);
      
      // 2. Use AI providers for intelligent analysis
      const aiResults = await this.analyzeWithAI(patternResults);
      
      // 3. Compile comprehensive response
      return {
        id: uuidv4(),
        requestId: request.id,
        status: 'success',
        data: {
          threats: aiResults.threats,
          riskScore: aiResults.riskScore,
          recommendations: aiResults.recommendations
        },
        processingTime: Date.now() - startTime,
        wasmMetrics: {
          executionTime: patternResults.executionTime,
          memoryUsed: patternResults.memoryUsed,
          modulesInvoked: ['pattern-matcher', 'analysis-engine']
        }
      };
    } catch (error) {
      return {
        id: uuidv4(),
        requestId: request.id,
        status: 'error',
        error: {
          code: 'PROCESSING_ERROR',
          message: error.message,
          recoverable: true
        },
        processingTime: Date.now() - startTime
      };
    }
  }

  // ... additional implementation details
}
```

## Registration Process

1. **Start your agent service**
2. **Register with Athena**:

```bash
curl -X POST http://athena-server:3000/api/v1/agents/register \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "OWL",
    "name": "Observational Window Learning",
    "version": "1.0.0",
    "endpoint": "http://owl-agent:8080",
    "capabilities": {
      "wasmModules": ["pattern-matcher", "analysis-engine"],
      "aiProviders": ["claude", "deepseek", "openai"],
      "supportedOperations": ["pattern-matching", "vulnerability-assessment"],
      "realTimeProcessing": true,
      "batchProcessing": true,
      "maxConcurrentRequests": 10
    },
    "requiredWasmModules": ["pattern-matcher", "analysis-engine"],
    "requiredAiProviders": ["claude"]
  }'
```

3. **Maintain heartbeat** (every 30 seconds):

```bash
curl -X POST http://athena-server:3000/api/v1/agents/OWL/heartbeat \
  -H "Content-Type: application/json" \
  -d '{
    "token": "your-registration-token"
  }'
```

## Communication Protocols

### 1. HTTP REST Endpoints

Your agent must expose these endpoints:

- `POST /process` - Process analysis requests
- `GET /health` - Health check
- `GET /metrics` - Performance metrics

### 2. Server-Sent Events

Subscribe to real-time updates:

```javascript
const eventSource = new EventSource('http://athena-server:3000/api/v1/agents/events');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Agent event:', data);
};
```

### 3. Inter-Agent Communication

Agents can communicate through Athena's message bus:

```typescript
// Send message to another agent
await this.athenaClient.post('/api/v1/messages', {
  from: 'OWL',
  to: 'DORU',
  type: 'request',
  payload: {
    action: 'analyze-sample',
    data: sampleData
  }
});
```

## WASM Module Integration

Access WASM modules through the provided endpoints:

```typescript
private async callWasmModule(module: string, method: string, data: any) {
  const endpoint = this.config.wasmEndpoints[module];
  const response = await axios.post(`${endpoint}/${method}`, data);
  return response.data;
}

// Example usage
const patterns = await this.callWasmModule('patternMatcher', 'scan', {
  data: Buffer.from(request.data).toString('base64')
});
```

## AI Provider Integration

Use the configured AI providers:

```typescript
private async callAIProvider(provider: string, prompt: string) {
  const config = this.config.aiProviders[provider];
  
  // Example for Claude
  if (provider === 'claude') {
    const response = await axios.post(config.endpoint, {
      model: config.model || 'claude-3-opus-20240229',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens || 4096
    }, {
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json'
      }
    });
    
    return response.data;
  }
}
```

## Best Practices

1. **Error Handling**: Always return proper error responses
2. **Timeouts**: Respect the timeout specified in requests
3. **Metrics**: Report performance metrics regularly
4. **Health Checks**: Implement comprehensive health checks
5. **Logging**: Log all significant events for debugging
6. **Security**: Validate all inputs and sanitize outputs
7. **Scalability**: Design for horizontal scaling

## Testing Your Agent

Use the analysis endpoint to test integration:

```bash
curl -X POST http://athena-server:3000/api/v1/analysis \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key-123" \
  -d '{
    "type": "vulnerability",
    "payload": {
      "target": "example.com",
      "depth": "full"
    },
    "options": {
      "agents": ["OWL"],
      "priority": "high"
    }
  }'
```

## Deployment

Each agent should be deployed as an independent service, preferably in containers:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]
```

## Support

For questions about agent integration:
1. Check the API documentation at `/api/v1/docs`
2. Monitor the SSE endpoint for system events
3. Review logs from the Athena platform

Remember: Each agent operates independently but collaborates through Athena's orchestration layer to provide comprehensive security analysis.