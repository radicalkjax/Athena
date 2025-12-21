use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// File format enumeration
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
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
    ODT,
    
    // Archives
    ZIP,
    RAR,
    SevenZ,
    TAR,
    GZIP,
    
    // Scripts
    JavaScript,
    TypeScript,
    Python,
    PowerShell,
    Batch,
    Shell,
    PHP,
    Ruby,
    
    // Web
    HTML,
    XML,
    JSON,
    CSS,
    
    // Other
    PlainText,
    Binary,
    Unknown,
}

/// Parsed file structure
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFile {
    pub format: FileFormat,
    pub metadata: FileMetadata,
    pub sections: Vec<FileSection>,
    pub embedded_files: Vec<EmbeddedFile>,
    pub strings: Vec<ExtractedString>,
    pub suspicious_indicators: Vec<SuspiciousIndicator>,
    pub integrity: FileIntegrity,
}

/// File metadata
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub size: usize,
    pub hash: String,
    pub mime_type: String,
    pub created_at: Option<String>,
    pub modified_at: Option<String>,
    pub attributes: HashMap<String, String>,
}

/// File section information
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSection {
    pub name: String,
    pub offset: usize,
    pub size: usize,
    pub entropy: f64,
    pub flags: Vec<String>,
}

/// Embedded file information
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddedFile {
    pub name: Option<String>,
    pub format: FileFormat,
    pub offset: usize,
    pub size: usize,
    pub hash: String,
}

/// Extracted string with context
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedString {
    pub value: String,
    pub offset: usize,
    pub encoding: String,
    pub suspicious: bool,
}

/// Suspicious indicator
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousIndicator {
    pub indicator_type: String,
    pub description: String,
    pub severity: SuspiciousSeverity,
    pub location: Option<String>,
    pub evidence: String,
}

/// Suspicious severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SuspiciousSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// File integrity information
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileIntegrity {
    pub valid_structure: bool,
    pub checksum_valid: Option<bool>,
    pub signature_valid: Option<bool>,
    pub issues: Vec<String>,
}

/// Validation result
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationResult {
    pub is_valid: bool,
    pub format_valid: bool,
    pub size_valid: bool,
    pub content_safe: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

/// Suspicious pattern types
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SuspiciousPattern {
    pub pattern_type: PatternType,
    pub value: String,
    pub context: Option<String>,
    pub confidence: f32,
}

/// Pattern types
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PatternType {
    URL,
    IPAddress,
    Domain,
    Email,
    Base64,
    HexEncoded,
    ObfuscatedCode,
    CryptoWallet,
    APIKey,
    Password,
}

/// Error types for file processing
#[derive(Error, Debug)]
pub enum FileProcessorError {
    #[error("Invalid file format: {0}")]
    InvalidFormat(String),
    
    #[error("Parse error: {0}")]
    ParseError(String),
    
    #[error("Validation failed: {0}")]
    ValidationFailed(String),
    
    #[error("Size limit exceeded: {0} bytes")]
    SizeLimitExceeded(usize),
    
    #[error("Malformed file structure: {0}")]
    MalformedStructure(String),
    
    #[error("Unsupported format: {0:?}")]
    UnsupportedFormat(FileFormat),
    
    #[error("IO error: {0}")]
    IoError(String),
}

/// Result type for file processor operations
pub type ProcessorResult<T> = Result<T, FileProcessorError>;

/// Options for file processing
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessingOptions {
    pub max_depth: usize,
    pub extract_strings: bool,
    pub extract_metadata: bool,
    pub validate_structure: bool,
    pub timeout_ms: Option<u32>,
}

impl Default for ProcessingOptions {
    fn default() -> Self {
        Self {
            max_depth: 10,
            extract_strings: true,
            extract_metadata: true,
            validate_structure: true,
            timeout_ms: Some(30000), // 30 seconds
        }
    }
}