use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeobfuscationResult {
    pub original: String,
    pub deobfuscated: String,
    pub techniques_applied: Vec<AppliedTechnique>,
    pub confidence: f32,
    pub metadata: DeobfuscationMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppliedTechnique {
    pub technique: ObfuscationTechnique,
    pub confidence: f32,
    pub layer: u32,
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ObfuscationTechnique {
    // Encoding techniques
    Base64Encoding,
    HexEncoding,
    UnicodeEscape,
    UrlEncoding,
    HtmlEntityEncoding,
    
    // String manipulation
    CharCodeConcat,
    StringReverse,
    StringSplit,
    StringReplace,
    
    // Encryption techniques
    XorEncryption { key: Vec<u8> },
    Rc4Encryption,
    SimpleSubstitution,
    
    // JavaScript specific
    JsEvalChain,
    JsPackedCode,
    JsObfuscatorIo,
    JsFunctionConstructor,
    JsUglified,
    
    // PowerShell specific
    PsEncodedCommand,
    PsCompressed,
    PsStringReplace,
    PsInvokeExpression,
    
    // Binary techniques
    BinaryPacked,
    BinaryCompressed,
    BinaryEncrypted,
    
    // Control flow
    ControlFlowFlattening,
    DeadCodeInjection,
    OpaquePredicates,
    
    // Custom/Unknown
    CustomEncoding(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeobfuscationMetadata {
    pub entropy_before: f32,
    pub entropy_after: f32,
    pub layers_detected: u32,
    pub processing_time_ms: u64,
    pub suspicious_patterns: Vec<String>,
    pub extracted_strings: Vec<ExtractedString>,
    pub ml_predictions: Option<MlPredictions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedString {
    pub value: String,
    pub confidence: f32,
    pub context: String,
    pub offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MlPredictions {
    pub obfuscation_probability: f32,
    pub technique_probabilities: HashMap<String, f32>,
    pub malware_probability: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObfuscationAnalysis {
    pub detected_techniques: Vec<(ObfuscationTechnique, f32)>,
    pub recommended_order: Vec<ObfuscationTechnique>,
    pub complexity_score: f32,
    pub ml_hints: Option<MlPredictions>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeobfuscatorConfig {
    pub max_layers: u32,
    pub min_confidence: f32,
    pub enable_ml: bool,
    pub timeout_ms: u64,
    pub extract_strings: bool,
    pub detect_packers: bool,
}

impl Default for DeobfuscatorConfig {
    fn default() -> Self {
        Self {
            max_layers: 10,
            min_confidence: 0.3,
            enable_ml: true,
            timeout_ms: 30000,
            extract_strings: true,
            detect_packers: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamingDeobfuscationChunk {
    pub offset: usize,
    pub size: usize,
    pub result: Option<DeobfuscationResult>,
    pub error: Option<String>,
}

pub type Result<T> = std::result::Result<T, DeobfuscationError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeobfuscationError {
    InvalidInput(String),
    TechniqueError { technique: String, error: String },
    TimeoutError,
    MemoryLimitExceeded,
    UnsupportedFormat(String),
    ParseError(String),
}

impl std::fmt::Display for DeobfuscationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            Self::TechniqueError { technique, error } => {
                write!(f, "Technique {} failed: {}", technique, error)
            }
            Self::TimeoutError => write!(f, "Deobfuscation timeout"),
            Self::MemoryLimitExceeded => write!(f, "Memory limit exceeded"),
            Self::UnsupportedFormat(fmt) => write!(f, "Unsupported format: {}", fmt),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for DeobfuscationError {}