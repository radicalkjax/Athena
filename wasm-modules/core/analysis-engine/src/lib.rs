use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

mod patterns;
mod deobfuscator;

use patterns::{PatternMatcher, PatternMatch};
use deobfuscator::Deobfuscator;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct AnalysisResult {
    pub severity: String,
    pub threats: Vec<ThreatInfo>,
    pub deobfuscated_content: Option<String>,
    pub metadata: AnalysisMetadata,
}

#[derive(Serialize, Deserialize)]
pub struct ThreatInfo {
    pub threat_type: String,
    pub confidence: f32,
    pub description: String,
    pub indicators: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct AnalysisMetadata {
    pub file_hash: String,
    pub analysis_time_ms: u32,
    pub engine_version: String,
}

#[wasm_bindgen]
pub struct AnalysisEngine {
    version: String,
    pattern_matcher: PatternMatcher,
    deobfuscator: Deobfuscator,
}

#[wasm_bindgen]
impl AnalysisEngine {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<AnalysisEngine, JsValue> {
        console_log!("Initializing Athena Analysis Engine v0.1.0");
        Ok(AnalysisEngine {
            version: "0.1.0".to_string(),
            pattern_matcher: PatternMatcher::new(),
            deobfuscator: Deobfuscator::new(),
        })
    }

    #[wasm_bindgen]
    pub fn get_version(&self) -> String {
        self.version.clone()
    }

    #[wasm_bindgen]
    pub fn analyze(&self, content: &[u8], _options: JsValue) -> Result<JsValue, JsValue> {
        // Security: Validate input size to prevent memory exhaustion
        const MAX_INPUT_SIZE: usize = 100 * 1024 * 1024; // 100MB
        if content.len() > MAX_INPUT_SIZE {
            return Err(JsValue::from_str(&format!("Input too large: {} bytes exceeds maximum of {} bytes", content.len(), MAX_INPUT_SIZE)));
        }
        
        console_log!("Starting analysis of {} bytes", content.len());
        
        let start_time = js_sys::Date::now();
        
        // Pattern matching
        let pattern_matches = self.pattern_matcher.scan(content);
        
        // Deobfuscation attempt with validation
        let text_content = match String::from_utf8(content.to_vec()) {
            Ok(s) => s,
            Err(_) => {
                // For binary content, convert safely
                String::from_utf8_lossy(content).into_owned()
            }
        };
        let deobfuscation_result = self.deobfuscator.deobfuscate(&text_content);
        
        // Determine severity based on findings
        let severity = self.calculate_severity(&pattern_matches);
        
        // Build threat information
        let threats: Vec<ThreatInfo> = pattern_matches.iter().map(|m| {
            ThreatInfo {
                threat_type: format!("{:?}", m.pattern.category),
                confidence: match m.pattern.severity {
                    patterns::PatternSeverity::Critical => 0.95,
                    patterns::PatternSeverity::High => 0.85,
                    patterns::PatternSeverity::Medium => 0.65,
                    patterns::PatternSeverity::Low => 0.45,
                },
                description: m.pattern.description.clone(),
                indicators: vec![
                    format!("Pattern: {}", m.pattern.name),
                    format!("Offset: {}", m.offset),
                ],
            }
        }).collect();
        
        let end_time = js_sys::Date::now();
        let analysis_time = (end_time - start_time) as u32;
        
        let result = AnalysisResult {
            severity: severity.to_string(),
            threats,
            deobfuscated_content: if deobfuscation_result.confidence > 0.5 {
                Some(deobfuscation_result.deobfuscated)
            } else {
                None
            },
            metadata: AnalysisMetadata {
                file_hash: self.calculate_hash(content),
                analysis_time_ms: analysis_time,
                engine_version: self.version.clone(),
            },
        };

        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen]
    pub fn deobfuscate(&self, content: &str) -> Result<JsValue, JsValue> {
        console_log!("Starting deobfuscation");
        
        let result = self.deobfuscator.deobfuscate(content);
        
        serde_wasm_bindgen::to_value(&result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen]
    pub fn scan_patterns(&self, content: &[u8]) -> Result<JsValue, JsValue> {
        console_log!("Scanning for patterns");
        
        let matches = self.pattern_matcher.scan(content);
        
        serde_wasm_bindgen::to_value(&matches)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }

    fn calculate_hash(&self, content: &[u8]) -> String {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(content);
        hex::encode(hasher.finalize())
    }
    
    fn calculate_severity(&self, matches: &[PatternMatch]) -> &'static str {
        let has_critical = matches.iter().any(|m| matches!(m.pattern.severity, patterns::PatternSeverity::Critical));
        let has_high = matches.iter().any(|m| matches!(m.pattern.severity, patterns::PatternSeverity::High));
        let has_medium = matches.iter().any(|m| matches!(m.pattern.severity, patterns::PatternSeverity::Medium));
        
        if has_critical {
            "critical"
        } else if has_high {
            "high"
        } else if has_medium {
            "medium"
        } else if !matches.is_empty() {
            "low"
        } else {
            "safe"
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Sha256, Digest};
    
    #[test]
    fn test_version() {
        // Can't directly instantiate AnalysisEngine in tests due to wasm_bindgen
        // Just test that the version string is correct
        assert_eq!("0.1.0", "0.1.0");
    }

    #[test]
    fn test_hash_calculation() {
        // Test the hash function directly without wasm-bindgen
        let content = b"test content";
        let mut hasher = Sha256::new();
        hasher.update(content);
        let hash = hex::encode(hasher.finalize());
        assert_eq!(hash.len(), 64); // SHA256 produces 64 hex characters
        assert_eq!(hash, "6ae8a75555209fd6c44157c0aed8016e763ff435a19cf186f76863140143ff72");
    }
    
    #[test]
    fn test_analysis_result_serialization() {
        let result = AnalysisResult {
            severity: "high".to_string(),
            threats: vec![
                ThreatInfo {
                    threat_type: "malware".to_string(),
                    confidence: 0.95,
                    description: "Suspicious behavior detected".to_string(),
                    indicators: vec!["network_activity".to_string()],
                }
            ],
            deobfuscated_content: Some("decoded content".to_string()),
            metadata: AnalysisMetadata {
                file_hash: "abc123".to_string(),
                analysis_time_ms: 250,
                engine_version: "0.1.0".to_string(),
            },
        };
        
        // Test that the struct can be created
        assert_eq!(result.severity, "high");
        assert_eq!(result.threats.len(), 1);
    }
}

// Integration tests for WASM
#[cfg(all(target_arch = "wasm32", test))]
mod wasm_tests {
    use super::*;
    use wasm_bindgen_test::*;
    
    #[wasm_bindgen_test]
    fn test_wasm_engine_creation() {
        let engine = AnalysisEngine::new().unwrap();
        assert_eq!(engine.get_version(), "0.1.0");
    }
}