# WASM Module Loading and Usage Guide

This guide explains how to use the real WASM module loading implementation in Athena v2.

## Overview

The `wasmService` now provides proper WASM module loading via Tauri commands that interact with the Rust backend's Wasmtime runtime. The stub `loadAnalysisModule()` function has been replaced with real module loading from compiled WASM files.

## Architecture

```
Frontend (TypeScript)
    ↓
wasmService.ts
    ↓
Tauri Commands (invoke)
    ↓
Backend (Rust)
    ↓
Wasmtime Runtime
    ↓
WASM Modules (Component Model)
```

## Available WASM Modules

The following WASM modules are available:

1. **analysis-engine** - Code analysis, CFG, disassembly, deobfuscation
2. **file-processor** - PE/ELF/Mach-O parsing, format detection
3. **pattern-matcher** - YARA scanning and pattern detection
4. **crypto** - Hashing, encryption, HMAC operations
5. **network** - Protocol parsing (DNS, HTTP, etc.)
6. **sandbox** - Execution isolation and monitoring
7. **deobfuscator** - Code deobfuscation techniques

## Basic Usage

### Option 1: High-Level Module Bindings (Recommended)

```typescript
import { wasmService } from '@/services/wasmService';

// Load a crypto module with typed bindings
const cryptoModule = await wasmService.loadCryptoModule();

// Use the module
const hash = await cryptoModule.sha256(fileData);
const base64 = await cryptoModule.sha256Base64(fileData);

// Cleanup when done
await cryptoModule.unload();
```

### Option 2: Low-Level Module Loading

```typescript
import { wasmService } from '@/services/wasmService';

// Initialize runtime (automatic on first use)
await wasmService.initializeRuntime();

// Load a module from file (backend resolves path relative to project root)
const moduleId = 'my-crypto-module';
const filePath = 'crypto/target/wasm32-wasip1/release/athena_crypto.wasm';
await wasmService.loadModuleFromFile(moduleId, filePath);

// Execute a function
const result = await wasmService.executeFunction(
  moduleId,
  'sha256',
  [Array.from(fileData)]
);

console.log(result.output); // Hash result
console.log(result.execution_time_ms); // Performance metrics
console.log(result.memory_used); // Memory consumption

// Cleanup
await wasmService.unloadModule(moduleId);
```

## Module-Specific Examples

### Crypto Module

```typescript
const crypto = await wasmService.loadCryptoModule();

// Hash operations
const sha256Hash = await crypto.sha256(data);
const md5Hash = await crypto.md5(data);

// HMAC operations
const key = new Uint8Array(32); // Your HMAC key
const hmac = await crypto.hmacSha256(key, data);
const isValid = await crypto.verifyHmac(key, data, hmac);

// Utility functions
const randomBytes = await crypto.generateRandomBytes(32);
const encoded = await crypto.base64Encode(data);
const decoded = await crypto.base64Decode(encoded);

await crypto.unload();
```

### File Processor Module

```typescript
const fileProcessor = await wasmService.loadFileProcessorModule();

// Detect file format
const format = await fileProcessor.detectFormat(fileBuffer, 'example.exe');
console.log(format); // "pe32", "elf64", etc.

// Parse file structure
const parsed = await fileProcessor.parseFile(fileBuffer);
console.log(parsed.sections); // File sections
console.log(parsed.embedded_files); // Embedded resources
console.log(parsed.suspicious_indicators); // Suspicious patterns

// Extract strings
const strings = await fileProcessor.extractStrings(fileBuffer, 4);
console.log(strings); // List of extracted strings

// Validate file
const validation = await fileProcessor.validateFile(fileBuffer, format);
console.log(validation.is_valid);
console.log(validation.errors);

await fileProcessor.unload();
```

### Analysis Engine Module

```typescript
const analysisEngine = await wasmService.loadAnalysisEngineModule();

// Analyze for threats
const analysis = await analysisEngine.analyze(malwareBytes);
console.log(analysis.severity); // "low", "medium", "high", "critical"
console.log(analysis.threats); // Detected threats
console.log(analysis.deobfuscated_content); // Deobfuscated code if applicable

// Disassemble code
const instructions = await analysisEngine.disassemble(
  codeBytes,
  0x1000, // Offset
  { arch: 'x64', syntax: 'intel', show_bytes: true, max_instructions: 100 }
);

// Control flow analysis
const basicBlocks = await analysisEngine.analyzeControlFlow(
  codeBytes,
  0x1000, // Entry point
  'x64'
);

// Deobfuscation
const deobfuscated = await analysisEngine.deobfuscate(obfuscatedCode, {
  max_iterations: 10,
  decode_base64: true,
  decode_hex: true,
});

await analysisEngine.unload();
```

### Pattern Matcher Module

```typescript
const patternMatcher = await wasmService.loadPatternMatcherModule();

// Scan with built-in patterns
const matches = await patternMatcher.scan(fileBytes);
matches.forEach(match => {
  console.log(match.category); // "obfuscation", "shellcode", etc.
  console.log(match.severity);
  console.log(match.description);
});

// Scan with custom YARA rules
const yaraRules = `
  rule SuspiciousString {
    strings:
      $a = "malware" nocase
    condition:
      $a
  }
`;
const customMatches = await patternMatcher.scanWithRules(fileBytes, yaraRules);

await patternMatcher.unload();
```

### Network Module

```typescript
const network = await wasmService.loadNetworkModule();

// Parse DNS packet
const dnsPacket = await network.parseDns(packetBytes);
console.log(dnsPacket.queries);
console.log(dnsPacket.answers);

// Parse HTTP data
const httpData = await network.parseHttp(httpBytes);
console.log(httpData.method);
console.log(httpData.headers);
console.log(httpData.body);

// Extract URLs from content
const urls = await network.extractUrls(textContent);
console.log(urls); // Array of extracted URLs

await network.unload();
```

### Sandbox Module

```typescript
const sandbox = await wasmService.loadSandboxModule();

// Execute code in sandbox
const result = await sandbox.executeSandboxed(malwareBytes, {
  timeout: 30000, // 30 seconds
  memory_limit: 100 * 1024 * 1024, // 100MB
});

console.log(result.exit_code);
console.log(result.stdout);
console.log(result.stderr);

// Get execution log
const log = await sandbox.getExecutionLog();
console.log(log); // API calls, file operations, etc.

await sandbox.unload();
```

### Deobfuscator Module

```typescript
const deobfuscator = await wasmService.loadDeobfuscatorModule();

// Check if code is obfuscated
const isObfuscated = await deobfuscator.isObfuscated(codeString);

// Detect obfuscation techniques
const techniques = await deobfuscator.detectObfuscationTechniques(codeString);
console.log(techniques); // ["base64", "hex-encoding", etc.]

// Deobfuscate
const result = await deobfuscator.deobfuscate(codeString, {
  max_iterations: 10,
  decode_base64: true,
  decode_hex: true,
});
console.log(result.deobfuscated);
console.log(result.techniques_applied);
console.log(result.confidence);

await deobfuscator.unload();
```

## Session-Based Execution

For stateful operations where you need to maintain resources across multiple function calls, use sessions:

```typescript
import { wasmService } from '@/services/wasmService';

// Create a session for a module
const session = await wasmService.createSession('analysis-engine');
console.log(session.session_id);

// Execute functions within the session
const result1 = await wasmService.executeSessionFunction(
  session.session_id,
  'analyze',
  [Array.from(data1)]
);

// Resources from result1 can be passed to subsequent calls
const result2 = await wasmService.executeSessionFunction(
  session.session_id,
  'find-xrefs',
  [/* previous results */]
);

// Get session info
const info = await wasmService.getSessionInfo(session.session_id);
console.log(info.resource_count);
console.log(info.resource_handles);

// Drop specific resources if needed
await wasmService.dropSessionResource(session.session_id, handleId);

// Destroy session when done
await wasmService.destroySession(session.session_id);
```

## Metrics and Monitoring

```typescript
// Get metrics for a specific module
const metrics = await wasmService.getMetrics('crypto');
console.log(metrics.call_count);
console.log(metrics.error_count);
console.log(metrics.execution_time_ms);
console.log(metrics.memory_used);
console.log(metrics.throughput);
console.log(metrics.confidence);

// Get all metrics
const allMetrics = await wasmService.getAllMetrics();
Object.entries(allMetrics).forEach(([moduleId, metrics]) => {
  console.log(`${moduleId}: ${metrics.call_count} calls`);
});

// Reset metrics
await wasmService.resetMetrics('crypto');
await wasmService.resetAllMetrics();
```

## Runtime Status

```typescript
// Get overall runtime status
const status = await wasmService.getRuntimeStatus();
console.log(status.initialized);
console.log(status.totalMemory);
console.log(status.modules); // List of loaded modules

// List all loaded modules
const modules = await wasmService.getModules();
modules.forEach(module => {
  console.log(`${module.name}: ${module.loaded ? 'loaded' : 'unloaded'}`);
});
```

## Error Handling

```typescript
try {
  const crypto = await wasmService.loadCryptoModule();
  const hash = await crypto.sha256(data);
  await crypto.unload();
} catch (error) {
  if (error instanceof Error) {
    console.error('WASM operation failed:', error.message);
    // Check if it's a trap or execution error
    if (error.message.includes('trap')) {
      console.error('WebAssembly trap occurred');
    }
  }
}
```

## Best Practices

1. **Always unload modules** when done to free resources
2. **Use high-level bindings** (e.g., `loadCryptoModule()`) for cleaner code
3. **Handle errors gracefully** - WASM operations can fail
4. **Monitor metrics** to track performance
5. **Use sessions** for stateful operations
6. **Initialize runtime early** (e.g., on app startup) for better performance
7. **Cleanup sessions** to prevent resource leaks

## Performance Tips

1. Pre-load frequently used modules at startup
2. Reuse loaded modules instead of loading/unloading repeatedly
3. Use sessions for complex workflows with multiple function calls
4. Monitor memory usage with `getMemoryUsage()`
5. Check metrics to identify slow operations

## Module Location

WASM modules are built and located at:
```
wasm-modules/core/<module-name>/target/wasm32-wasip1/release/athena_<module_name>.wasm
```

For example:
- `wasm-modules/core/crypto/target/wasm32-wasip1/release/athena_crypto.wasm`
- `wasm-modules/core/file-processor/target/wasm32-wasip1/release/athena_file_processor.wasm`

**Note:** When using the frontend service, module paths are relative to the module name only (e.g., `crypto/target/...`). The backend resolves the full path relative to the project root (`wasm-modules/core/`).

## Troubleshooting

### Module not found
- Ensure the WASM module has been built with `cargo component build --release`
- Check the file path exists at the expected location
- Verify the module ID matches the expected name

### Function not found
- Check the WIT interface definition for the correct function name
- Component Model functions may be in interfaces (e.g., `hash#sha256`)
- Use kebab-case for function names (e.g., `sha256-base64`)

### Memory limit exceeded
- Reduce the size of data being processed
- Process data in chunks
- Increase memory limits in the WASM runtime configuration

### Execution timeout
- Break long operations into smaller chunks
- Use sessions for multi-step operations
- Consider using async/await properly to avoid blocking
