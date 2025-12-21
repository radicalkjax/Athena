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
    pub mitre_attack: Option<Vec<String>>, // MITRE ATT&CK technique IDs
    pub mitre_tactics: Option<Vec<String>>, // MITRE ATT&CK tactics
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

pub struct CompiledPattern {
    pub pattern: Pattern,
    pub regex: Regex,
}

impl PatternMatcher {
    pub fn new() -> Self {
        let patterns = Self::load_default_patterns();
        PatternMatcher { patterns }
    }

    fn load_default_patterns() -> Vec<CompiledPattern> {
        // Load basic patterns for bootstrapping
        // For production: integrate YARA rules (see YARA_INTEGRATION.md)
        vec![
            CompiledPattern {
                pattern: Pattern {
                    id: "js-eval-base64".to_string(),
                    name: "Eval with Base64".to_string(),
                    pattern: r"eval\s*\(\s*atob\s*\(".to_string(),
                    severity: PatternSeverity::High,
                    category: PatternCategory::Obfuscation,
                    description: "Evaluating base64 decoded content".to_string(),
                    mitre_attack: Some(vec!["T1027".to_string()]),
                    mitre_tactics: Some(vec!["Defense Evasion".to_string()]),
                },
                regex: Regex::new(r"eval\s*\(\s*atob\s*\(").unwrap(),
            },
            CompiledPattern {
                pattern: Pattern {
                    id: "php-backdoor-eval".to_string(),
                    name: "PHP Eval Backdoor".to_string(),
                    pattern: r"eval\s*\(\s*\$_(POST|GET|REQUEST)".to_string(),
                    severity: PatternSeverity::Critical,
                    category: PatternCategory::Backdoor,
                    description: "PHP backdoor using eval with user input".to_string(),
                    mitre_attack: Some(vec!["T1505.003".to_string()]),
                    mitre_tactics: Some(vec!["Persistence".to_string()]),
                },
                regex: Regex::new(r"eval\s*\(\s*\$_(POST|GET|REQUEST)").unwrap(),
            },
            CompiledPattern {
                pattern: Pattern {
                    id: "powershell-download".to_string(),
                    name: "PowerShell Download String".to_string(),
                    pattern: r"DownloadString\s*\(".to_string(),
                    severity: PatternSeverity::High,
                    category: PatternCategory::Dropper,
                    description: "PowerShell downloading remote code".to_string(),
                    mitre_attack: Some(vec!["T1059.001".to_string(), "T1105".to_string()]),
                    mitre_tactics: Some(vec!["Execution".to_string(), "Command and Control".to_string()]),
                },
                regex: Regex::new(r"DownloadString\s*\(").unwrap(),
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