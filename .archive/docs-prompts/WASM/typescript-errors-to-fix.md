# TypeScript Errors to Fix - WASM Integration

## Overview
These TypeScript errors appeared during compilation but don't prevent the application from running. They need to be fixed for proper type safety and development experience.

## Error Categories and Solutions

### 1. Missing Type Exports in `./types` Module

**Files Affected:**
- `services/aiProviders/api/router.ts`
- `services/aiProviders/cache-integration.ts`
- `services/aiProviders/index.ts`

**Errors:**
```
Module '"../types"' has no exported member 'OrchestrationStrategy'
Module '"../types"' has no exported member 'AIOrchestratorConfig'
Module '"../types"' has no exported member 'AIAnalysisRequest'
Module '"../types"' has no exported member 'AIAnalysisResponse'
```

**Solution:**
Add missing type definitions to `services/aiProviders/types.ts`:
```typescript
export interface OrchestrationStrategy {
  type: 'round-robin' | 'performance-based' | 'cost-optimized';
  // Add other properties
}

export interface AIOrchestratorConfig {
  providers: ProviderConfig;
  strategy?: OrchestrationStrategy;
  // Add other config options
}

export interface AIAnalysisRequest {
  content: string | ArrayBuffer;
  analysisType: string;
  provider?: string;
  // Add other request properties
}

export interface AIAnalysisResponse {
  result: any;
  provider: string;
  // Add other response properties
}
```

### 2. AIOrchestrator Method Visibility Issues

**Files Affected:**
- `services/aiProviders/api/router.ts`

**Errors:**
```
Property 'getProviderStatus' does not exist on type 'AIOrchestrator'
Property 'selectBestProvider' is private and only accessible within class
Property 'getAvailableProviders' does not exist on type 'AIOrchestrator'
```

**Solution:**
Update `services/aiProviders/orchestrator.ts`:
```typescript
class AIOrchestrator {
  // Change from private to public
  public selectBestProvider(request: AnalysisRequest): string { /* ... */ }
  
  // Add missing methods
  public getProviderStatus(): any { /* ... */ }
  public getAvailableProviders(): string[] { /* ... */ }
}
```

### 3. WASM Bridge Type Issues

**Files Affected:**
- `services/aiProviders/preprocessing/wasmPipeline.ts`

**Errors:**
```
Type 'void' is not assignable to type 'AnalysisEngineBridge | undefined'
Property 'processFile' does not exist on type 'IFileProcessor'
Property 'analyzeCode' does not exist on type 'AnalysisEngineBridge'
Property 'analyzeDomain' does not exist on type 'NetworkBridge'
```

**Solution:**
1. Fix initialization assignment:
```typescript
// Change from:
this.analysisEngine = await initializeAnalysisEngine();
// To:
await initializeAnalysisEngine();
this.analysisEngine = analysisEngine; // Use the singleton
```

2. Update interface definitions in bridge files to include missing methods

### 4. WASMErrorCode Enum Issues

**Files Affected:**
- `wasm-modules/bridge/file-processor-bridge.ts`

**Errors:**
```
Property 'INIT_FAILED' does not exist on type 'typeof WASMErrorCode'
Property 'LOAD_FAILED' does not exist on type 'typeof WASMErrorCode'
Property 'NOT_INITIALIZED' does not exist on type 'typeof WASMErrorCode'
```

**Solution:**
Update `wasm-modules/bridge/types.ts` to include all error codes:
```typescript
export enum WASMErrorCode {
  InitializationFailed = 'INITIALIZATION_FAILED',
  InvalidInput = 'INVALID_INPUT',
  AnalysisFailed = 'ANALYSIS_FAILED',
  TimeoutError = 'TIMEOUT_ERROR',
  // Add missing codes:
  INIT_FAILED = 'INIT_FAILED',
  LOAD_FAILED = 'LOAD_FAILED',
  NOT_INITIALIZED = 'NOT_INITIALIZED',
  SIZE_LIMIT_EXCEEDED = 'SIZE_LIMIT_EXCEEDED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  TIMEOUT = 'TIMEOUT'
}
```

### 5. Express Route Handler Type Issues

**Multiple Files Affected**

**Error Pattern:**
```
No overload matches this call... Type 'Response<any, Record<string, any>> | undefined' is not assignable to type 'void | Promise<void>'
```

**Solution:**
Ensure all route handlers don't return the response object:
```typescript
// Instead of:
router.get('/path', (req, res) => {
  return res.json({ data }); // Wrong
});

// Use:
router.get('/path', (req, res) => {
  res.json({ data }); // Correct - no return
});
```

### 6. Performance Metrics Type Issues

**Files Affected:**
- Bridge files with performance tracking

**Errors:**
```
Property 'initTime' does not exist on type 'Partial<PerformanceMetrics>'
Property 'lastOperationTime' does not exist on type 'Partial<PerformanceMetrics>'
Property 'executionTime' does not exist on type 'PerformanceMetrics'
```

**Solution:**
Update `PerformanceMetrics` interface in types.ts:
```typescript
export interface PerformanceMetrics {
  initializationTime?: number;
  analysisTime?: number;
  throughput?: number;
  memoryUsage?: number;
  // Add missing properties:
  initTime?: number;
  lastOperationTime?: number;
  executionTime?: number;
}
```

## Quick Fix Script

Create a script to fix common issues:
```bash
#!/bin/bash
# fix-typescript-errors.sh

# Fix decorator compilation
sed -i 's/INVALID_INPUT/InvalidInput/g' wasm-modules/bridge/*.ts

# Add missing return type annotations
find services -name "*.ts" -exec sed -i 's/router\.\(get\|post\|put\|delete\)(\(.*\)) {/router.\1(\2): void {/g' {} \;

# Update tsconfig for better error handling
echo "Updating tsconfig.json..."
```

## Testing After Fixes

1. Run TypeScript compilation:
```bash
npx tsc --noEmit
```

2. Check specific files:
```bash
npx tsc services/aiProviders/types.ts --noEmit
```

3. Rebuild Docker container:
```bash
docker compose build api --no-cache
```

## Priority Order

1. **High Priority**: Fix missing type exports (blocks development)
2. **Medium Priority**: Fix method visibility issues (affects API functionality)
3. **Low Priority**: Fix route handler returns (cosmetic but good practice)

## Notes for Next Session

- All TypeScript errors are in the services directory
- The WASM bridge files compile despite errors
- Focus on types.ts first as it cascades to other files
- Consider using `strict: false` temporarily in tsconfig.json if needed