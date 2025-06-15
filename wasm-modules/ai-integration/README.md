# AI Provider Integration for Athena

## 🎯 Overview

This directory contains the AI provider integration layer that Athena provides for external security agents. The six specialized agents (OWL, WEAVER, AEGIS, FORGE, POLIS, DORU) will be implemented in their own repositories and will consume these AI services via Athena's API.

## 📁 Structure

```
ai-integration/
├── providers/           # AI provider implementations
│   ├── claude.ts       # Anthropic Claude integration
│   ├── deepseek.ts     # DeepSeek integration
│   ├── openai.ts       # OpenAI/ChatGPT integration
│   └── base.ts         # Base provider interface
│
├── preprocessing/       # WASM-based security preprocessing
│   ├── sanitizer.ts    # Input sanitization
│   ├── validator.ts    # Prompt injection detection
│   └── extractor.ts    # Safe content extraction
│
├── ensemble/           # Multi-provider consensus
│   ├── aggregator.ts   # Result aggregation
│   ├── voting.ts       # Consensus algorithms
│   └── confidence.ts   # Confidence scoring
│
└── api/               # External API for agents
    ├── endpoints.ts    # REST API definitions
    ├── streaming.ts    # WebSocket support
    └── auth.ts        # Authentication middleware
```

## 🔧 What Athena Provides

### 1. AI Provider Abstraction
```typescript
interface AIProviderService {
  // Core analysis function
  analyze(input: SanitizedInput, options: AnalysisOptions): Promise<AIResult>;
  
  // Streaming for real-time analysis
  stream(input: SanitizedInput): AsyncIterator<AIChunk>;
  
  // Provider health and capabilities
  getStatus(): ProviderStatus;
  getCapabilities(): ProviderCapabilities;
}
```

### 2. Security Preprocessing
All inputs are sanitized through our WASM modules before reaching AI providers:

- **Pattern Matcher**: Detects prompt injection attempts
- **Deobfuscator**: Cleans obfuscated inputs
- **File Processor**: Extracts analyzable content safely
- **Validator**: Ensures input compliance

### 3. Ensemble Analysis
Combine results from multiple providers for higher accuracy:

```typescript
const ensemble = new ProviderEnsemble([
  new ClaudeProvider(),
  new DeepSeekProvider(),
  new OpenAIProvider()
]);

const result = await ensemble.analyze(input, {
  mode: 'consensus',
  minAgreement: 0.7,
  timeout: 5000
});
```

## 🚀 API Endpoints for External Agents

### Authentication
```bash
POST /api/v1/auth/token
Authorization: Bearer <api-key>
```

### AI Analysis
```bash
# Single provider analysis
POST /api/v1/ai/analyze
{
  "input": "base64-encoded-content",
  "provider": "claude",
  "options": {
    "model": "claude-3-opus-20240229",
    "temperature": 0.7
  }
}

# Multi-provider ensemble
POST /api/v1/ai/ensemble
{
  "input": "base64-encoded-content",
  "providers": ["claude", "deepseek", "openai"],
  "mode": "consensus"
}

# Streaming analysis
WS /api/v1/ai/stream
```

### Preprocessing
```bash
# Sanitize input before AI analysis
POST /api/v1/preprocess
{
  "input": "raw-content",
  "checks": ["injection", "obfuscation", "malware"]
}
```

## 📊 Integration Examples

### For External Agents
```typescript
// Example: DORU agent calling Athena's AI service
class DOROAgent {
  private athenaClient: AthenaClient;
  
  async analyzeMalware(sample: Buffer) {
    // 1. Preprocess through Athena
    const sanitized = await this.athenaClient.preprocess(sample, {
      checks: ['malware', 'obfuscation']
    });
    
    // 2. Get AI analysis
    const aiResult = await this.athenaClient.analyzeWithAI(sanitized, {
      providers: ['deepseek'],  // Best for code analysis
      model: 'deepseek-coder-33b'
    });
    
    // 3. Agent-specific processing
    return this.processMalwareInsights(aiResult);
  }
}
```

## 🔐 Security Model

### API Authentication
- JWT tokens with 1-hour expiry
- API key rotation every 30 days
- Rate limiting per agent
- IP allowlisting available

### Data Protection
- All inputs sanitized via WASM
- Encrypted in transit (TLS 1.3)
- No persistent storage of raw inputs
- Audit logs for all API calls

## 📈 Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Preprocessing | < 100ms | Via WASM modules |
| AI Response | < 2s | Including network latency |
| Streaming Latency | < 500ms | First chunk |
| Concurrent Requests | 1000 | Per provider |
| Cache Hit Rate | > 80% | For repeated analyses |

## 🛠️ Configuration

### Provider Settings
```yaml
# config/providers.yaml
providers:
  claude:
    endpoint: ${CLAUDE_API_ENDPOINT}
    apiKey: ${CLAUDE_API_KEY}
    models:
      - claude-3-opus-20240229
      - claude-3-sonnet-20240229
    rateLimit:
      requestsPerMinute: 60
      tokensPerMinute: 100000
      
  deepseek:
    endpoint: ${DEEPSEEK_API_ENDPOINT}
    apiKey: ${DEEPSEEK_API_KEY}
    models:
      - deepseek-coder-33b
      - deepseek-chat
    specialization: code_analysis
    
  openai:
    endpoint: ${OPENAI_API_ENDPOINT}
    apiKey: ${OPENAI_API_KEY}
    models:
      - gpt-4-turbo
      - gpt-3.5-turbo
    features:
      - function_calling
      - json_mode
```

## 🚦 Development Status

### Phase 4 Milestones
- [ ] Week 17-18: Provider abstraction layer
- [ ] Week 19-20: Multi-provider ensemble
- [ ] Week 21-22: WASM preprocessing pipeline
- [ ] Week 23-24: API development
- [ ] Week 25-26: Performance optimization

### Current Focus
Building the provider abstraction layer with Claude as the first integration.

## 📚 Resources

- [API Documentation](./api/docs/)
- [Provider Integration Guide](./providers/INTEGRATION.md)
- [Security Best Practices](./SECURITY.md)
- [Performance Tuning](./PERFORMANCE.md)

---

**Note**: The six specialized agents (OWL, WEAVER, AEGIS, FORGE, POLIS, DORU) will be implemented in separate repositories and will consume these services via Athena's API.