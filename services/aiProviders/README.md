# AI Provider Integration Service

This service provides a unified interface for integrating multiple AI providers (Claude, DeepSeek, OpenAI) with intelligent orchestration and security preprocessing.

## Architecture

### Components

1. **Providers**: Individual AI provider implementations
   - Claude: Best for reasoning and code analysis
   - DeepSeek: Specialized in malware analysis and deobfuscation
   - OpenAI: General-purpose analysis and report generation

2. **Orchestrator**: Intelligent routing and coordination
   - Single provider with fallback
   - Ensemble voting for consensus
   - Sequential processing for complex workflows
   - Specialized routing based on task type

3. **WASM Preprocessing**: Security layer using WebAssembly modules
   - Prompt injection detection
   - URL sanitization
   - Binary content analysis
   - Obfuscation detection

4. **API Layer**: RESTful endpoints for external access
   - Authentication and rate limiting
   - Workflow execution
   - Streaming support

## Usage

### Initialize Providers

```typescript
import { initializeAIProviders } from './services/aiProviders';

// Initialize with API keys
await initializeAIProviders({
  claude: { apiKey: process.env.CLAUDE_API_KEY },
  deepseek: { apiKey: process.env.DEEPSEEK_API_KEY },
  openai: { apiKey: process.env.OPENAI_API_KEY }
});
```

### Analyze Content

```typescript
import { analyzeContent } from './services/aiProviders';

// Simple analysis
const result = await analyzeContent('suspicious code here', {
  analysisType: 'CODE_SECURITY_REVIEW',
  priority: 'high'
});

// Binary analysis
const binaryData = await fs.readFile('malware.exe');
const result = await analyzeContent(binaryData, {
  analysisType: 'MALWARE_ANALYSIS',
  strategy: 'specialized'
});
```

### API Endpoints

Start the server:
```bash
npm run start:server
```

Available endpoints:

- `GET /api/v1/health` - Health check
- `POST /api/v1/analyze` - Analyze content
- `GET /api/v1/workflows/:agentId` - List agent workflows
- `POST /api/v1/workflows/:agentId/:workflowName/execute` - Execute workflow
- `POST /api/v1/analyze/stream` - Stream analysis results
- `GET /api/v1/providers` - List provider capabilities

### Example API Request

```bash
curl -X POST http://localhost:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "content": "function maliciousCode() { eval(atob('...')); }",
    "analysisType": "CODE_SECURITY_REVIEW",
    "priority": "high",
    "strategy": "ensemble"
  }'
```

## Orchestration Strategies

### 1. Single Provider (with fallback)
Best for: Quick analysis, cost optimization
```typescript
{ type: 'single', providers: ['claude'] }
```

### 2. Ensemble
Best for: Critical decisions, high-stakes analysis
```typescript
{ type: 'ensemble', providers: ['claude', 'deepseek', 'openai'], consensusThreshold: 0.7 }
```

### 3. Sequential
Best for: Complex multi-step analysis
```typescript
{ type: 'sequential', providers: ['deepseek', 'claude', 'openai'] }
```

### 4. Specialized (default)
Best for: Automatic optimal routing
```typescript
{ type: 'specialized' }
```

## Security Features

1. **WASM Preprocessing**
   - All inputs are preprocessed through WebAssembly modules
   - Detects and blocks prompt injection attempts
   - Sanitizes malicious URLs
   - Identifies obfuscated content

2. **Rate Limiting**
   - Per-API-key rate limits
   - Different limits for different endpoints
   - Automatic retry with backoff

3. **Authentication**
   - API key required for all endpoints
   - Support for Bearer tokens
   - Agent-specific authentication

## Configuration

Environment variables:
```bash
# AI Provider API Keys
CLAUDE_API_KEY=your-claude-key
DEEPSEEK_API_KEY=your-deepseek-key
OPENAI_API_KEY=your-openai-key

# Optional configuration
CLAUDE_MODEL=claude-3-opus-20240229
DEEPSEEK_MODEL=deepseek-coder
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_ORGANIZATION=your-org-id

# Server configuration
PORT=3000
CORS_ORIGIN=http://localhost:3001,https://yourdomain.com
NODE_ENV=production

# Default provider (claude, deepseek, or openai)
DEFAULT_AI_PROVIDER=claude
```

## Testing

Run integration tests:
```bash
npm test services/aiProviders/tests/integration.test.ts
```

Run basic smoke test:
```bash
node services/aiProviders/tests/integration.test.ts
```

## Performance Optimization

1. **Caching**: Responses are cached for 5 minutes by default
2. **Parallel Processing**: Ensemble mode runs providers in parallel
3. **Streaming**: Support for real-time streaming responses
4. **Connection Pooling**: Reuses HTTP connections

## Error Handling

- Automatic fallback to secondary providers
- Graceful degradation when preprocessing fails
- Detailed error messages in development mode
- Retry logic for transient failures

## Monitoring

The service logs:
- All API requests with response times
- Provider usage and costs
- Error rates and types
- Rate limit violations

Use the `/health` endpoint for monitoring provider status.

## Future Enhancements

1. Additional providers (Gemini, Mistral, etc.)
2. Custom model fine-tuning integration
3. Result caching with Redis
4. WebSocket support for real-time analysis
5. Batch processing endpoints
6. Cost optimization algorithms