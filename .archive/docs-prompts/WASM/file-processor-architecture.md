# File-Processor Module Architecture Design

## Overview
The file-processor module will be the second WASM module in the Athena platform, responsible for safe and efficient file parsing, format detection, and content extraction. Based on the existing TypeScript implementation analysis, this module will handle various file formats with a focus on security and performance.

## Module Structure

```
/wasm-modules/core/file-processor/
├── Cargo.toml
├── src/
│   ├── lib.rs              # Module entry point and exports
│   ├── detector.rs         # File format detection
│   ├── parser/
│   │   ├── mod.rs         # Parser module organization
│   │   ├── pe.rs          # PE format parser
│   │   ├── elf.rs         # ELF format parser
│   │   ├── pdf.rs         # PDF format parser
│   │   ├── office.rs      # Office document parser
│   │   ├── archive.rs     # Archive format parser
│   │   └── script.rs      # Script file parser
│   ├── validator.rs        # File validation and integrity
│   ├── extractor.rs        # Content extraction utilities
│   ├── types.rs           # Rust type definitions
│   └── utils.rs           # Helper functions
├── tests/
│   ├── detector_tests.rs
│   ├── parser_tests.rs
│   └── fixtures/          # Test files
└── benches/
    └── parser_bench.rs
```

## Core Components

### 1. File Format Detector (`detector.rs`)

```rust
pub struct FileDetector {
    magic_bytes: HashMap<Vec<u8>, FileFormat>,
    extension_map: HashMap<String, FileFormat>,
}

impl FileDetector {
    pub fn detect_format(&self, buffer: &[u8], filename: Option<&str>) -> FileFormat {
        // Magic byte detection first
        // Fall back to extension if needed
        // Return Unknown if can't determine
    }
    
    pub fn is_text_file(&self, buffer: &[u8]) -> bool {
        // UTF-8 validation and text heuristics
    }
    
    pub fn get_mime_type(&self, format: FileFormat) -> String {
        // Return MIME type for format
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum FileFormat {
    // Executables
    PE32,
    PE64,
    ELF32,
    ELF64,
    MachO,
    
    // Documents
    PDF,
    DOCX,
    XLSX,
    PPTX,
    
    // Archives
    ZIP,
    RAR,
    SevenZ,
    TAR,
    GZIP,
    
    // Scripts
    JavaScript,
    Python,
    PowerShell,
    Batch,
    Shell,
    PHP,
    
    // Other
    HTML,
    XML,
    JSON,
    PlainText,
    Binary,
    Unknown,
}
```

### 2. File Parsers (`parser/`)

Each parser implements a common trait:

```rust
pub trait FileParser {
    fn parse(&self, buffer: &[u8]) -> Result<ParsedFile, ParseError>;
    fn validate_structure(&self, buffer: &[u8]) -> Result<bool, ParseError>;
    fn extract_metadata(&self, buffer: &[u8]) -> Result<FileMetadata, ParseError>;
}

pub struct ParsedFile {
    pub format: FileFormat,
    pub metadata: FileMetadata,
    pub sections: Vec<FileSection>,
    pub embedded_files: Vec<EmbeddedFile>,
    pub strings: Vec<ExtractedString>,
    pub suspicious_indicators: Vec<SuspiciousIndicator>,
}
```

### 3. Content Validator (`validator.rs`)

```rust
pub struct FileValidator {
    max_file_size: usize,
    allowed_formats: HashSet<FileFormat>,
}

impl FileValidator {
    pub fn validate_file(&self, buffer: &[u8], format: FileFormat) -> ValidationResult {
        // Size limits
        // Format restrictions
        // Structure validation
        // Integrity checks
    }
    
    pub fn check_integrity(&self, buffer: &[u8]) -> Result<FileIntegrity, ValidationError> {
        // CRC/checksum validation
        // Structure consistency
        // Format-specific checks
    }
}
```

### 4. Content Extractor (`extractor.rs`)

```rust
pub struct ContentExtractor {
    string_min_length: usize,
    extract_urls: bool,
    extract_ips: bool,
    extract_base64: bool,
}

impl ContentExtractor {
    pub fn extract_strings(&self, buffer: &[u8]) -> Vec<ExtractedString> {
        // ASCII/UTF-8 string extraction
        // Wide string extraction (UTF-16)
        // Filtered by minimum length
    }
    
    pub fn extract_suspicious_patterns(&self, content: &str) -> Vec<SuspiciousPattern> {
        // URLs, IPs, domains
        // Base64 encoded data
        // Obfuscation patterns
        // Known malware signatures
    }
    
    pub fn extract_embedded_content(&self, parsed: &ParsedFile) -> Vec<EmbeddedContent> {
        // Scripts in documents
        // Macros
        // Embedded executables
        // Hidden data streams
    }
}
```

## Integration with TypeScript

### TypeScript Interface

```typescript
// file-processor-bridge.ts
export interface FileProcessor {
  // Core functions
  detectFormat(buffer: ArrayBuffer, filename?: string): FileFormat;
  parseFile(buffer: ArrayBuffer, format?: FileFormat): Promise<ParsedFile>;
  validateFile(buffer: ArrayBuffer, options?: ValidationOptions): ValidationResult;
  
  // Extraction functions
  extractStrings(buffer: ArrayBuffer, options?: ExtractionOptions): string[];
  extractMetadata(buffer: ArrayBuffer): FileMetadata;
  extractEmbedded(buffer: ArrayBuffer): EmbeddedFile[];
  
  // Utility functions
  isTextFile(buffer: ArrayBuffer): boolean;
  getMimeType(format: FileFormat): string;
  
  // Streaming support
  parseFileStream(stream: ReadableStream): AsyncIterable<ParseChunk>;
}

export interface ParsedFile {
  format: FileFormat;
  metadata: FileMetadata;
  sections: FileSection[];
  embeddedFiles: EmbeddedFile[];
  strings: ExtractedString[];
  suspiciousIndicators: SuspiciousIndicator[];
  integrity: FileIntegrity;
}
```

## Performance Considerations

### Memory Management
- Streaming parser for large files
- Bounded memory allocation
- Incremental parsing where possible
- Memory-mapped file access for large binaries

### Optimization Strategies
1. **Format Detection**
   - Magic byte trie for O(1) lookup
   - Cached detection results
   - Early termination on match

2. **Parsing Performance**
   - Parallel section parsing
   - Lazy evaluation for metadata
   - Skip unnecessary sections based on analysis needs

3. **String Extraction**
   - SIMD-accelerated string scanning
   - Bloom filters for duplicate detection
   - Incremental extraction for large files

## Security Features

### Safe Parsing
- All parsers use bounded reads
- No unsafe memory operations
- Panic-free error handling
- Resource limits enforcement

### Malicious File Handling
- Zip bomb detection
- Recursive embedding limits
- Memory exhaustion prevention
- CPU time limits

### Input Validation
- Buffer bounds checking
- Format consistency validation
- Suspicious pattern detection
- Anomaly reporting

## Migration from TypeScript

### Current TypeScript Functionality to Port
1. **File Type Detection** (fileManager.ts:48-66)
   - MIME type checking
   - Extension-based detection
   - Text vs binary determination

2. **Content Reading** (fileManager.ts:69)
   - Text file content extraction
   - Size-based reading decisions
   - Error handling for corrupt files

3. **Pattern Detection** (helpers.ts:147-201)
   - Obfuscation detection
   - URL/IP/domain extraction
   - Base64 pattern matching

### Enhanced WASM Features
1. **Binary Format Parsing**
   - PE/ELF header analysis
   - Section extraction
   - Import/export table parsing

2. **Document Analysis**
   - PDF stream extraction
   - Office macro detection
   - Embedded script extraction

3. **Archive Handling**
   - Safe extraction
   - Nested archive support
   - Compression ratio analysis

## Testing Strategy

### Unit Tests
- Format detection accuracy
- Parser correctness
- Extractor completeness
- Validator strictness

### Integration Tests
- TypeScript bridge functionality
- Streaming performance
- Error propagation
- Memory usage

### Fuzz Testing
- Malformed file handling
- Memory safety verification
- Crash resistance
- Performance degradation

### Benchmarks
- Format detection speed
- Parsing throughput
- String extraction performance
- Memory efficiency

## Implementation Priority

### Phase 1 (Week 5)
1. Basic detector implementation
2. Text file parser
3. String extractor
4. TypeScript bridge

### Phase 2 (Week 6)
1. Binary format parsers (PE/ELF)
2. Archive support (ZIP)
3. Enhanced validation
4. Streaming support

### Phase 3 (Week 6+)
1. Document parsers (PDF/Office)
2. Advanced extraction
3. Performance optimization
4. Security hardening

## Success Metrics
- Detection accuracy: >99% for common formats
- Parsing speed: >500MB/s for text files
- Memory usage: <50MB for 1GB file
- Zero crashes on malformed input
- 100% TypeScript feature parity

---
*Created: 2025-06-12*
*Module: file-processor*
*Version: 1.0*