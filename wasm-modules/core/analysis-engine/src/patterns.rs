use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    pub id: String,
    pub name: String,
    pub pattern: String,
    pub severity: PatternSeverity,
    pub category: PatternCategory,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternSeverity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PatternCategory {
    Obfuscation,
    Exploit,
    Backdoor,
    Dropper,
    Trojan,
    Ransomware,
    CryptoMiner,
    Phishing,
}

pub struct PatternMatcher {
    patterns: Vec<CompiledPattern>,
}

struct CompiledPattern {
    pattern: Pattern,
    regex: Regex,
}

impl PatternMatcher {
    pub fn new() -> Self {
        let patterns = Self::load_default_patterns();
        PatternMatcher { patterns }
    }

    fn load_default_patterns() -> Vec<CompiledPattern> {
        vec![
            // JavaScript obfuscation patterns
            CompiledPattern {
                pattern: Pattern {
                    id: "js-eval-base64".to_string(),
                    name: "Eval with Base64".to_string(),
                    pattern: r"eval\s*\(\s*atob\s*\(".to_string(),
                    severity: PatternSeverity::High,
                    category: PatternCategory::Obfuscation,
                    description: "Evaluating base64 decoded content".to_string(),
                },
                regex: Regex::new(r"eval\s*\(\s*atob\s*\(").unwrap(),
            },
            CompiledPattern {
                pattern: Pattern {
                    id: "js-hex-obfuscation".to_string(),
                    name: "Hex String Obfuscation".to_string(),
                    pattern: r"\\x[0-9a-fA-F]{2}".to_string(),
                    severity: PatternSeverity::Medium,
                    category: PatternCategory::Obfuscation,
                    description: "Hex encoded strings".to_string(),
                },
                regex: Regex::new(r"\\x[0-9a-fA-F]{2}").unwrap(),
            },
            CompiledPattern {
                pattern: Pattern {
                    id: "js-unicode-obfuscation".to_string(),
                    name: "Unicode Obfuscation".to_string(),
                    pattern: r"\\u[0-9a-fA-F]{4}".to_string(),
                    severity: PatternSeverity::Medium,
                    category: PatternCategory::Obfuscation,
                    description: "Unicode encoded strings".to_string(),
                },
                regex: Regex::new(r"\\u[0-9a-fA-F]{4}").unwrap(),
            },
            
            // Exploit patterns
            CompiledPattern {
                pattern: Pattern {
                    id: "js-document-write".to_string(),
                    name: "Dynamic Script Injection".to_string(),
                    pattern: r#"document\.write\s*\(\s*['"]\s*<script"#.to_string(),
                    severity: PatternSeverity::High,
                    category: PatternCategory::Exploit,
                    description: "Dynamic script injection via document.write".to_string(),
                },
                regex: Regex::new(r#"document\.write\s*\(\s*['"]\s*<script"#).unwrap(),
            },
            CompiledPattern {
                pattern: Pattern {
                    id: "js-activex".to_string(),
                    name: "ActiveX Object Creation".to_string(),
                    pattern: r"new\s+ActiveXObject".to_string(),
                    severity: PatternSeverity::High,
                    category: PatternCategory::Exploit,
                    description: "Creating ActiveX objects (Windows specific)".to_string(),
                },
                regex: Regex::new(r"new\s+ActiveXObject").unwrap(),
            },
            
            // Backdoor patterns
            CompiledPattern {
                pattern: Pattern {
                    id: "php-backdoor-eval".to_string(),
                    name: "PHP Eval Backdoor".to_string(),
                    pattern: r"@?eval\s*\(\s*\$_(POST|GET|REQUEST)".to_string(),
                    severity: PatternSeverity::Critical,
                    category: PatternCategory::Backdoor,
                    description: "PHP backdoor using eval with user input".to_string(),
                },
                regex: Regex::new(r"@?eval\s*\(\s*\$_(POST|GET|REQUEST)").unwrap(),
            },
            CompiledPattern {
                pattern: Pattern {
                    id: "shell-reverse".to_string(),
                    name: "Reverse Shell".to_string(),
                    pattern: r"(nc|netcat|bash|sh)\s+.*\s+\d+\.\d+\.\d+\.\d+\s+\d+".to_string(),
                    severity: PatternSeverity::Critical,
                    category: PatternCategory::Backdoor,
                    description: "Potential reverse shell connection".to_string(),
                },
                regex: Regex::new(r"(nc|netcat|bash|sh)\s+.*\s+\d+\.\d+\.\d+\.\d+\s+\d+").unwrap(),
            },
            
            // Crypto miner patterns
            CompiledPattern {
                pattern: Pattern {
                    id: "crypto-coinhive".to_string(),
                    name: "Coinhive Miner".to_string(),
                    pattern: r"coinhive\.com/lib/coinhive\.min\.js".to_string(),
                    severity: PatternSeverity::High,
                    category: PatternCategory::CryptoMiner,
                    description: "Coinhive cryptocurrency miner".to_string(),
                },
                regex: Regex::new(r"coinhive\.com/lib/coinhive\.min\.js").unwrap(),
            },
            
            // Binary patterns (PE header)
            CompiledPattern {
                pattern: Pattern {
                    id: "pe-header".to_string(),
                    name: "PE Executable".to_string(),
                    pattern: r"MZ.{58}PE\x00\x00".to_string(),
                    severity: PatternSeverity::Medium,
                    category: PatternCategory::Dropper,
                    description: "Windows PE executable header".to_string(),
                },
                regex: Regex::new(r"MZ.{58}PE\x00\x00").unwrap(),
            },
        ]
    }

    pub fn scan(&self, content: &[u8]) -> Vec<PatternMatch> {
        let text = String::from_utf8_lossy(content);
        let mut matches = Vec::new();

        for compiled in &self.patterns {
            if let Some(m) = compiled.regex.find(&text) {
                matches.push(PatternMatch {
                    pattern: compiled.pattern.clone(),
                    offset: m.start(),
                    length: m.len(),
                    context: self.extract_context(&text, m.start(), m.len()),
                });
            }
        }

        matches
    }

    fn extract_context(&self, text: &str, offset: usize, length: usize) -> String {
        const CONTEXT_SIZE: usize = 50;
        
        let start = offset.saturating_sub(CONTEXT_SIZE);
        let end = (offset + length + CONTEXT_SIZE).min(text.len());
        
        text[start..end].to_string()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternMatch {
    pub pattern: Pattern,
    pub offset: usize,
    pub length: usize,
    pub context: String,
}