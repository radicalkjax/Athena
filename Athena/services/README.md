# Athena Services

This directory contains service modules that handle API communication and data processing for the Athena application.

## API Client Architecture

The API client architecture is designed to provide a consistent, secure, and efficient way to communicate with various APIs used by the application. The architecture is built around the following components:

### `apiClient.ts`

The core of the API client architecture is the `apiClient.ts` file, which provides:

- A configurable axios instance factory with built-in interceptors for authentication, logging, and error handling
- Specialized client factories for each API (OpenAI, Claude, DeepSeek, etc.)
- Utility functions for safe API calls and request data sanitization
- Caching mechanism to avoid recreating clients unnecessarily

### Service Modules

Each service module (e.g., `openai.ts`, `claude.ts`, etc.) provides:

- API key management (storage, retrieval, validation)
- Service-specific API calls
- Response parsing and error handling
- Domain-specific functionality

## Using the API Client

### Creating a Client

```typescript
import { createApiClient } from './apiClient';

// Create a generic API client
const client = createApiClient({
  baseURL: 'https://api.example.com',
  apiKey: 'your-api-key',
  apiKeyHeader: 'Authorization',
  additionalHeaders: {
    'Custom-Header': 'value',
  },
});

// Or use a specialized client factory
import { createOpenAIClient } from './apiClient';

const openaiClient = createOpenAIClient('your-openai-api-key');
```

### Making API Calls

```typescript
import { safeApiCall, sanitizeRequestData } from './apiClient';

// Safely make an API call with error handling
const response = await safeApiCall(
  () => client.post('/endpoint', sanitizeRequestData({
    param1: 'value1',
    param2: 'value2',
  })),
  'Descriptive error message'
);

// Use the response data
console.log(response.data);
```

## Available Services

### OpenAI Service (`openai.ts`)

Handles communication with the OpenAI API for AI model interactions.

```typescript
import * as openaiService from './openai';

// Initialize the client
const client = await openaiService.initOpenAI();

// Use the service
const result = await openaiService.deobfuscateCode(code, 'gpt-4-turbo');
```

### Claude Service (`claude.ts`)

Handles communication with the Anthropic Claude API for AI model interactions.

```typescript
import * as claudeService from './claude';

// Initialize the client
const client = await claudeService.initClaude();

// Use the service
const result = await claudeService.analyzeVulnerabilities(code, 'claude-3-opus-20240229');
```

### DeepSeek Service (`deepseek.ts`)

Handles communication with the DeepSeek API for AI model interactions.

```typescript
import * as deepseekService from './deepseek';

// Initialize the client
const client = await deepseekService.initDeepSeek();

// Use the service
const result = await deepseekService.deobfuscateCode(code, 'deepseek-coder');
```

### Local Models Service (`localModels.ts`)

Handles communication with locally running AI models.

```typescript
import * as localModelsService from './localModels';

// Get local model configurations
const models = await localModelsService.getLocalModelsConfig();

// Use a local model
const result = await localModelsService.deobfuscateCode(code, modelId);
```

### Metasploit Service (`metasploit.ts`)

Handles communication with the Metasploit API for vulnerability information.

```typescript
import * as metasploitService from './metasploit';

// Search for modules
const modules = await metasploitService.searchModules('cve:2023');

// Enrich vulnerability data
const enrichedVulnerabilities = await metasploitService.enrichVulnerabilityData(vulnerabilities);
```

### Container Service (`container.ts`)

Handles communication with the container API for malware analysis in isolated environments.

```typescript
import * as containerService from './container';

// Create a container
const container = await containerService.createContainer(malwareId, malwareContent, malwareName);

// Run analysis
const results = await containerService.runMalwareAnalysis(container.id);
```

### File Manager Service (`fileManager.ts`)

Handles file system operations for the application.

```typescript
import * as fileManagerService from './fileManager';

// Pick a file
const file = await fileManagerService.pickFile();

// Read file content
const content = await fileManagerService.readFileContent(file.uri);
```

### Analysis Service (`analysisService.ts`)

Coordinates the analysis process using the other services.

```typescript
import * as analysisService from './analysisService';

// Run a full analysis
const result = await analysisService.runAnalysis(malwareFile, model, useContainer);
```

## Security Considerations

- All API keys are stored securely using appropriate storage mechanisms (SecureStore for native, localStorage for web)
- All request data is sanitized before sending to prevent injection attacks
- Error handling is consistent across all services to prevent information leakage
- API responses are validated before processing to prevent unexpected behavior
