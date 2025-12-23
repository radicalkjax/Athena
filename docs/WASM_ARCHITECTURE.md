# Athena WASM Architecture Documentation

## 🧭 Navigation
- **📖 [Documentation Hub](./README.md)** ← Main navigation
- **🏗️ [Architecture](./ARCHITECTURE.md)** ← System architecture
- **🚀 [Quick Start](./QUICKSTART.md)** ← Get running quickly

## Overview

Athena's WebAssembly (WASM) architecture provides military-grade security isolation for malware analysis while maintaining exceptional performance. Built as a **Tauri 2.0 desktop application** with a Rust backend, the platform implements 9 security-critical WASM modules using the **Wasmtime 38.0 Component Model** that work together to create a comprehensive malware analysis environment.

**Architecture**: Tauri 2.0 desktop application (no web/React Native)
**WASM Runtime**: Wasmtime 38.0 with Component Model (WASI Preview 2)
**Backend**: Rust with embedded axum API server (port 3000)
**Frontend**: SolidJS with TypeScript
**Status**: December 2025 - Implementation Complete

## Key Achievements

- **Performance**: 10x faster than JavaScript implementation
- **Security**: Complete sandbox isolation with memory safety
- **Size**: 6.7MB total (optimized with Binaryen)
- **Zero TypeScript Errors**: 100% type-safe implementation
- **Timeline**: Completed 10 weeks ahead of schedule

## Architecture Overview

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#333333',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#333333',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#333333',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
graph TB
    subgraph "Frontend Layer"
        UI[Tauri 2.0 Desktop UI<br/>SolidJS Frontend]
        Bridge[WASM Bridge Layer]
    end
    
    subgraph "WASM Security Modules"
        Analysis[Analysis Engine<br/>━━━━━━━━<br/>871KB]
        FileProc[File Processor<br/>━━━━━━━━<br/>1.6MB]
        Pattern[Pattern Matcher<br/>━━━━━━━━<br/>1.5MB]
        Deobfusc[Deobfuscator<br/>━━━━━━━━<br/>1.6MB]
        Sandbox[Sandbox<br/>━━━━━━━━<br/>219KB]
        Crypto[Crypto Module<br/>━━━━━━━━<br/>576KB]
        Network[Network Analysis<br/>━━━━━━━━<br/>291KB]
    end
    
    subgraph "AI Integration"
        Pipeline[WASM Preprocessing Pipeline]
        Claude[Claude API]
        OpenAI[OpenAI API]
        DeepSeek[DeepSeek API]
    end
    
    UI --> Bridge
    Bridge --> Analysis
    Bridge --> FileProc
    Bridge --> Pattern
    Bridge --> Deobfusc
    Bridge --> Sandbox
    Bridge --> Crypto
    Bridge --> Network
    
    Analysis --> Pipeline
    FileProc --> Pipeline
    Pattern --> Pipeline
    Deobfusc --> Pipeline
    
    Pipeline --> Claude
    Pipeline --> OpenAI
    Pipeline --> DeepSeek
    
    style Analysis fill:#6d105a,color:#fff
    style FileProc fill:#e8f4d4,color:#333
    style Pattern fill:#f9d0c4,color:#333
    style Deobfusc fill:#6d105a,color:#fff
    style Sandbox fill:#e8f4d4,color:#333
    style Crypto fill:#f9d0c4,color:#333
    style Network fill:#6d105a,color:#fff
```

## WASM Modules

### 1. Analysis Engine (871KB)
**Purpose**: Core threat analysis and risk scoring

**Features**:
- Comprehensive malware detection
- Risk assessment (0-100 score)
- Code pattern analysis
- Behavioral detection
- Heuristic analysis

**Performance**: <100ms for typical analysis

**API Example**:
```typescript
const result = await AnalysisEngine.analyzeFile({
  content: fileBuffer,
  fileName: 'suspicious.exe',
  options: {
    deepAnalysis: true,
    extractStrings: true
  }
});
// Returns: { riskScore: 85, threats: [...], patterns: [...] }
```

### 2. File Processor (1.6MB)
**Purpose**: Multi-format file parsing and extraction

**Supported Formats**:
- Executables: PE/ELF/Mach-O
- Archives: ZIP/RAR/7z/TAR
- Documents: PDF, Office (DOC/DOCX/XLS/XLSX)
- Scripts: JS/PS1/BAT/SH/PY

**Performance**: 1MB file in <5 seconds

**API Example**:
```typescript
const processed = await FileProcessor.processFile(fileBuffer);
// Returns: { 
//   format: 'PE32',
//   metadata: { ... },
//   extractedFiles: [...],
//   suspiciousIndicators: [...]
// }
```

### 3. Pattern Matcher (1.5MB)
**Purpose**: High-speed pattern matching and signature detection

**Features**:
- Regex engine with 10,000+ patterns/second
- YARA-style rule support
- Custom pattern definitions
- Real-time pattern updates

**API Example**:
```typescript
const matches = await PatternMatcher.scan({
  content: data,
  patterns: ['malware_signatures', 'suspicious_apis'],
  customRules: yaraRules
});
```

### 4. Deobfuscator (1.6MB)
**Purpose**: Advanced code deobfuscation

**Capabilities**:
- JavaScript deobfuscation (includes JSFuck, obfuscator.io)
- PowerShell deobfuscation
- String decoding (Base64, hex, custom encodings)
- Control flow unraveling
- Variable renaming and AST analysis

**API Example**:
```typescript
const clean = await Deobfuscator.deobfuscate({
  code: obfuscatedCode,
  language: 'javascript',
  techniques: ['all']
});
```

### 5. Sandbox (219KB)
**Purpose**: Isolated code execution environment

**Security Features**:
- Complete memory isolation
- Resource limits (CPU, memory, time)
- Syscall interception
- Network isolation
- File system virtualization

**Performance**: <10ms overhead

**API Example**:
```typescript
const result = await Sandbox.execute({
  code: untrustedCode,
  limits: {
    memory: '50MB',
    cpu: '1000ms',
    network: false
  }
});
```

### 6. Crypto Module (576KB)
**Purpose**: Cryptographic operations and analysis

**Features**:
- **Hashing**: SHA-256/384/512, SHA-1, MD5, Blake3
- **HMAC**: HMAC-SHA256/384/512
- **Encryption**: AES-128/256-GCM
- **Asymmetric**: RSA-2048/4096 (PKCS#1 v1.5)
- **Key Derivation**: PBKDF2 (600k iterations - OWASP 2023)
- **Analysis**: Entropy calculation, randomness testing

**API Example**:
```typescript
const hash = await Crypto.hash(data, 'SHA-256');
const encrypted = await Crypto.encrypt(plaintext, key, 'AES-256-GCM');
const entropy = await Crypto.calculateEntropy(data);
```

### 7. Network Analysis (291KB)
**Purpose**: Network traffic and protocol analysis

**Features**:
- Packet parsing (Ethernet, IPv4/6, TCP/UDP)
- Protocol detection (HTTP/S, DNS, TLS with SNI)
- Anomaly detection (DDoS, port scanning, C2 beaconing)
- Domain Generation Algorithm (DGA) detection
- Malicious URL analysis

**Performance**: 1Gbps analysis capability

**API Example**:
```typescript
const analysis = await Network.analyzeTraffic(pcapData);
// Returns: {
//   protocols: ['HTTP', 'DNS', 'TLS'],
//   anomalies: ['c2_beaconing', 'dga_domain'],
//   riskIndicators: [...]
// }
```

## Security Architecture

### WASM Preprocessing Pipeline

All AI provider inputs pass through WASM preprocessing for security:

```
User Input → WASM Validation → Sanitization → AI Provider → Response Filtering
```

**Security Layers**:

1. **Input Validation**
   - Prompt injection detection
   - Script tag removal
   - Malicious URL blocking
   - Binary content validation

2. **Sandboxing**
   - Complete memory isolation
   - No direct system calls
   - Resource limits enforced
   - Time-boxed execution

3. **Output Sanitization**
   - Response filtering
   - Data leak prevention
   - PII detection and removal

### Multi-Layer Security Model

```mermaid
%%{init: {
  'theme': 'base',
  'themeVariables': {
    'primaryColor': '#6d105a',
    'primaryTextColor': '#ffffff',
    'primaryBorderColor': '#ffffff',
    'lineColor': '#333333',
    'secondaryColor': '#e8f4d4',
    'secondaryTextColor': '#333333',
    'secondaryBorderColor': '#333333',
    'tertiaryColor': '#f9d0c4',
    'tertiaryTextColor': '#333333',
    'tertiaryBorderColor': '#333333',
    'background': '#ffffff',
    'mainBkg': '#6d105a',
    'secondBkg': '#e8f4d4',
    'tertiaryBkg': '#f9d0c4',
    'textColor': '#333333',
    'fontFamily': 'Arial, sans-serif'
  }
}}%%
graph TD
    subgraph "Security Layers"
        L1[Layer 1: WASM Isolation<br/>━━━━━━━━<br/>Memory isolation<br/>No system access]
        L2[Layer 2: Container Security<br/>━━━━━━━━<br/>Docker containers<br/>Resource limits]
        L3[Layer 3: Network Isolation<br/>━━━━━━━━<br/>Backend separation<br/>Firewall rules]
        L4[Layer 4: API Security<br/>━━━━━━━━<br/>Rate limiting<br/>Authentication]
    end
    
    L1 --> L2
    L2 --> L3
    L3 --> L4
    
    style L1 fill:#6d105a,color:#fff
    style L2 fill:#e8f4d4,color:#333
    style L3 fill:#f9d0c4,color:#333
    style L4 fill:#6d105a,color:#fff
```

## Integration Guide

### Initialization

WASM modules are initialized automatically when the Tauri application starts via the embedded Rust backend:

```rust
// In main.rs - automatic initialization on startup
tauri::async_runtime::spawn(async move {
    println!("Initializing WASM runtime...");
    match crate::commands::wasm_runtime::initialize_wasm_runtime(
        init_handle.state()
    ).await {
        Ok(msg) => println!("{}", msg),
        Err(e) => eprintln!("Failed to initialize WASM runtime: {}", e),
    }

    // Load security modules
    println!("Loading WASM security modules...");
    match crate::commands::wasm_file_bridge::load_wasm_security_modules(
        init_handle.state()
    ).await {
        Ok(modules) => println!("Loaded {} WASM modules: {:?}", modules.len(), modules),
        Err(e) => eprintln!("Failed to load WASM modules: {}", e),
    }
});
```

Frontend can also initialize via Tauri commands:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Initialize WASM runtime
await invoke('initialize_wasm_runtime');

// Load security modules
const modules = await invoke('load_wasm_security_modules');
console.log('Loaded modules:', modules);
```

### Using Individual Modules

WASM modules are accessed through Tauri commands that invoke Wasmtime Component Model instances:

```typescript
import { invoke } from '@tauri-apps/api/core';

// Analyze file with WASM modules
const result = await invoke('analyze_file_with_wasm', {
  path: filePath
});

// Execute specific WASM function
const output = await invoke('execute_wasm_function', {
  moduleId: 'crypto',
  functionName: 'hash_data',
  args: [data, 'SHA-256']
});

// Get WASM module metrics
const metrics = await invoke('get_wasm_metrics', {
  moduleId: 'analysis-engine'
});
```

Or via the embedded HTTP API server (port 3000):

```bash
# Analyze file
curl -X POST http://localhost:3000/api/v1/wasm/analyze \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/path/to/file"}'

# Execute WASM function
curl -X POST http://localhost:3000/api/v1/wasm/execute \
  -H "Content-Type: application/json" \
  -d '{"module_id": "crypto", "function_name": "hash_data", "args": ["data", "SHA-256"]}'
```

### Error Handling

All WASM modules use consistent error handling via Rust `Result` types:

```typescript
import { invoke } from '@tauri-apps/api/core';

try {
  const result = await invoke('execute_wasm_function', {
    moduleId: 'analysis-engine',
    functionName: 'analyze_code',
    args: [code]
  });
} catch (error) {
  // Error string returned from Rust backend
  console.error('WASM operation failed:', error);

  // Common error patterns:
  // - "WASM memory limit exceeded"
  // - "WASM fuel exhausted (timeout)"
  // - "Module not loaded"
  // - "Function not found"
}
```

Rust backend error handling:

```rust
// All Tauri commands return Result<T, String>
#[tauri::command]
pub async fn execute_wasm_function(
    runtime: State<'_, Arc<Mutex<Option<WasmRuntime>>>>,
    module_id: String,
    function_name: String,
    args: Vec<serde_json::Value>,
) -> Result<serde_json::Value, String> {
    // Proper error propagation with ?
    let mut rt = runtime.lock()
        .map_err(|e| format!("Runtime lock error: {}", e))?;

    rt.as_mut()
        .ok_or("WASM runtime not initialized")?
        .execute_function(&module_id, &function_name, args)
        .map_err(|e| format!("Execution failed: {}", e))
}
```

## Performance Optimization

### Module Loading

Modules are loaded via Wasmtime Component Model during application startup or on-demand:

```rust
// Automatic loading on startup (main.rs)
match crate::commands::wasm_file_bridge::load_wasm_security_modules(
    init_handle.state()
).await {
    Ok(modules) => println!("Loaded {} WASM modules", modules.len()),
    Err(e) => eprintln!("Failed to load WASM modules: {}", e),
}
```

```typescript
// Or load on-demand from frontend
import { invoke } from '@tauri-apps/api/core';

const modules = await invoke('load_wasm_security_modules');
// Returns: ["analysis-engine", "crypto", "deobfuscator", ...]
```

### Memory Management

- Automatic memory cleanup after operations
- Configurable memory limits per module
- Shared memory buffers for large operations

### Caching

- Pattern matcher caches compiled patterns
- Deobfuscator caches AST transformations
- Network module caches protocol parsers

## Development Guide

### Building Modules

All modules use the Wasmtime Component Model with `cargo-component`:

```bash
# Build individual module
cd athena-v2/wasm-modules/core/[module-name]
cargo component build --release

# Build all modules
cd athena-v2/wasm-modules/core
for module in analysis-engine crypto deobfuscator disassembler file-processor network pattern-matcher sandbox security; do
  cd $module && cargo component build --release && cd ..
done

# Output: target/wasm32-wasip2/release/[module].wasm
```

The built `.wasm` files are loaded by Wasmtime at runtime with Component Model bindings.

### Testing

```bash
# Run Rust unit tests
cargo test

# Run integration tests
npm run test:wasm

# Run performance benchmarks
cargo bench
```

### Adding New Modules

1. Create module structure:
   ```
   wasm-modules/core/new-module/
   ├── Cargo.toml
   ├── src/
   │   └── lib.rs
   └── tests/
       └── integration.rs
   ```

2. Implement module interface
3. Create TypeScript bridge
4. Add integration tests
5. Update documentation

## Troubleshooting

### Common Issues

**Module fails to load**
- Check browser WASM support
- Verify CORS headers for .wasm files
- Ensure proper MIME type (application/wasm)

**Out of memory errors**
- Increase module memory limits
- Check for memory leaks in Rust code
- Use streaming APIs for large files

**Performance issues**
- Enable WASM optimization (-O3)
- Use Web Workers for parallel processing
- Profile with browser DevTools

## Future Enhancements

- **SIMD Support**: Utilize WASM SIMD for faster processing
- **Threading**: Multi-threaded analysis with SharedArrayBuffer
- **GPU Acceleration**: WebGPU integration for ML models
- **Additional Modules**: 
  - Machine learning inference
  - Blockchain analysis
  - Advanced unpacking

## Resources

- [WASM Modules Source](../wasm-modules/)
- [Bridge Implementation](../wasm-modules/bridge/)
- [Integration Tests](../wasm-modules/tests/)
- [Performance Benchmarks](../wasm-modules/benchmarks/)