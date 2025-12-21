use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PatternType {
    Exact,
    Regex,
    Binary,
    Fuzzy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ThreatCategory {
    Malware,
    Exploit,
    Obfuscation,
    Suspicious,
    PII,
    Secret,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    pub id: String,
    pub pattern_type: PatternType,
    pub value: Vec<u8>,
    pub mask: Option<Vec<u8>>,
    pub description: String,
    pub weight: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Condition {
    All,
    Any(usize),
    Not(Box<Condition>),
    And(Vec<Condition>),
    Or(Vec<Condition>),
    PatternRef(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub patterns: Vec<Pattern>,
    pub condition: Condition,
    pub severity: Severity,
    pub category: ThreatCategory,
    pub tags: Vec<String>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub rule_id: String,
    pub rule_name: String,
    pub pattern_id: String,
    pub offset: usize,
    pub length: usize,
    pub matched_data: Vec<u8>,
    pub severity: Severity,
    pub category: ThreatCategory,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub matches: Vec<Match>,
    pub total_rules_evaluated: usize,
    pub scan_time_ms: u64,
    pub bytes_scanned: usize,
    pub threat_score: f32,
}

#[derive(Debug, Clone)]
pub struct CompiledRule {
    pub id: String,
    pub name: String,
    pub patterns: Vec<CompiledPattern>,
    pub condition: Condition,
    pub severity: Severity,
    pub category: ThreatCategory,
}

#[derive(Debug, Clone)]
pub struct CompiledPattern {
    pub id: String,
    pub pattern_type: PatternType,
    pub regex: Option<regex::Regex>,
    pub bytes: Option<Vec<u8>>,
    pub mask: Option<Vec<u8>>,
    pub weight: f32,
}

// Custom serde implementation for CompiledPattern since regex::Regex doesn't implement Serialize
impl Serialize for CompiledPattern {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("CompiledPattern", 6)?;
        state.serialize_field("id", &self.id)?;
        state.serialize_field("pattern_type", &self.pattern_type)?;
        state.serialize_field("regex", &self.regex.as_ref().map(|r| r.as_str()))?;
        state.serialize_field("bytes", &self.bytes)?;
        state.serialize_field("mask", &self.mask)?;
        state.serialize_field("weight", &self.weight)?;
        state.end()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternMatcherError {
    InvalidRule(String),
    InvalidPattern(String),
    CompilationError(String),
    ScanError(String),
    InvalidInput(String),
}

pub type Result<T> = std::result::Result<T, PatternMatcherError>;

impl std::fmt::Display for PatternMatcherError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidRule(msg) => write!(f, "Invalid rule: {}", msg),
            Self::InvalidPattern(msg) => write!(f, "Invalid pattern: {}", msg),
            Self::CompilationError(msg) => write!(f, "Compilation error: {}", msg),
            Self::ScanError(msg) => write!(f, "Scan error: {}", msg),
            Self::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
        }
    }
}

impl std::error::Error for PatternMatcherError {}

pub struct PatternStats {
    pub total_patterns: usize,
    pub exact_patterns: usize,
    pub regex_patterns: usize,
    pub binary_patterns: usize,
    pub fuzzy_patterns: usize,
}

impl PatternStats {
    pub fn new() -> Self {
        Self {
            total_patterns: 0,
            exact_patterns: 0,
            regex_patterns: 0,
            binary_patterns: 0,
            fuzzy_patterns: 0,
        }
    }
}