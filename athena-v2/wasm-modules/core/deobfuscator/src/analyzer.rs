use crate::types::*;
use regex::Regex;
use std::collections::HashMap;
use once_cell::sync::Lazy;

static BASE64_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[A-Za-z0-9+/]{20,}={0,2}").unwrap()
});

static HEX_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:\\x[0-9a-fA-F]{2}){4,}|(?:[0-9a-fA-F]{2}){8,}").unwrap()
});

static UNICODE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:\\u[0-9a-fA-F]{4}){3,}").unwrap()
});

static EVAL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(eval|execute|invoke-expression|iex)\s*\(").unwrap()
});

static CHARCODE_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"String\.fromCharCode\s*\(\s*(?:\d+\s*,?\s*){3,}\s*\)").unwrap()
});

pub struct ObfuscationAnalyzer;

impl ObfuscationAnalyzer {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze(&self, content: &str) -> ObfuscationAnalysis {
        let mut detected_techniques = Vec::new();
        let mut scores = HashMap::new();

        // Calculate entropy
        let entropy = self.calculate_entropy(content.as_bytes());
        
        // Check for Base64
        if let Some(confidence) = self.detect_base64(content) {
            detected_techniques.push((ObfuscationTechnique::Base64Encoding, confidence));
            scores.insert("base64", confidence);
        }

        // Check for Hex encoding
        if let Some(confidence) = self.detect_hex_encoding(content) {
            detected_techniques.push((ObfuscationTechnique::HexEncoding, confidence));
            scores.insert("hex", confidence);
        }

        // Check for Unicode escapes
        if let Some(confidence) = self.detect_unicode_escape(content) {
            detected_techniques.push((ObfuscationTechnique::UnicodeEscape, confidence));
            scores.insert("unicode", confidence);
        }

        // Check for character code concatenation
        if let Some(confidence) = self.detect_charcode_concat(content) {
            detected_techniques.push((ObfuscationTechnique::CharCodeConcat, confidence));
            scores.insert("charcode", confidence);
        }

        // Check for eval chains
        if let Some(confidence) = self.detect_eval_chain(content) {
            detected_techniques.push((ObfuscationTechnique::JsEvalChain, confidence));
            scores.insert("eval", confidence);
        }

        // Check for PowerShell encoding
        if let Some(confidence) = self.detect_powershell_encoding(content) {
            detected_techniques.push((ObfuscationTechnique::PsEncodedCommand, confidence));
            scores.insert("ps_encoded", confidence);
        }

        // Check for URL encoding
        if let Some(confidence) = self.detect_url_encoding(content) {
            detected_techniques.push((ObfuscationTechnique::UrlEncoding, confidence));
            scores.insert("url", confidence);
        }

        // Check for high entropy (possible encryption)
        if entropy > 6.0 {
            let xor_confidence = self.detect_xor_patterns(content);
            if xor_confidence > 0.5 {
                detected_techniques.push((
                    ObfuscationTechnique::XorEncryption { key: vec![] },
                    xor_confidence,
                ));
                scores.insert("xor", xor_confidence);
            }
        }

        // Sort by confidence
        detected_techniques.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

        // Determine recommended order
        let recommended_order = self.determine_deobfuscation_order(&detected_techniques);

        // Calculate complexity score
        let complexity_score = self.calculate_complexity_score(&detected_techniques, entropy);

        ObfuscationAnalysis {
            detected_techniques,
            recommended_order,
            complexity_score,
            ml_hints: None, // Will be populated by ML module
        }
    }

    fn calculate_entropy(&self, data: &[u8]) -> f32 {
        if data.is_empty() {
            return 0.0;
        }

        let mut frequency = [0u64; 256];
        for &byte in data {
            frequency[byte as usize] += 1;
        }

        let len = data.len() as f32;
        let mut entropy = 0.0;

        for &count in &frequency {
            if count > 0 {
                let probability = count as f32 / len;
                entropy -= probability * probability.log2();
            }
        }

        entropy
    }

    fn detect_base64(&self, content: &str) -> Option<f32> {
        let matches: Vec<_> = BASE64_REGEX.find_iter(content).collect();
        if matches.is_empty() {
            return None;
        }

        let total_match_len: usize = matches.iter().map(|m| m.len()).sum();
        let content_len = content.len();
        
        let coverage = total_match_len as f32 / content_len as f32;
        let confidence = (coverage * 2.0).min(1.0);

        Some(confidence)
    }

    fn detect_hex_encoding(&self, content: &str) -> Option<f32> {
        let matches: Vec<_> = HEX_REGEX.find_iter(content).collect();
        if matches.is_empty() {
            return None;
        }

        let avg_match_len = matches.iter().map(|m| m.len()).sum::<usize>() as f32 / matches.len() as f32;
        let confidence = (avg_match_len / 50.0).min(1.0) * 0.8;

        Some(confidence)
    }

    fn detect_unicode_escape(&self, content: &str) -> Option<f32> {
        let matches = UNICODE_REGEX.find_iter(content).count();
        if matches == 0 {
            return None;
        }

        let confidence = (matches as f32 / 10.0).min(1.0) * 0.9;
        Some(confidence)
    }

    fn detect_charcode_concat(&self, content: &str) -> Option<f32> {
        let matches = CHARCODE_REGEX.find_iter(content).count();
        if matches == 0 {
            return None;
        }

        Some(0.95) // High confidence when found
    }

    fn detect_eval_chain(&self, content: &str) -> Option<f32> {
        let eval_count = EVAL_REGEX.find_iter(content).count();
        if eval_count == 0 {
            return None;
        }

        let confidence = match eval_count {
            1 => 0.6,
            2 => 0.8,
            _ => 0.95,
        };

        Some(confidence)
    }

    fn detect_powershell_encoding(&self, content: &str) -> Option<f32> {
        let ps_indicators = [
            "-EncodedCommand",
            "-enc",
            "-e ",
            "powershell.exe",
            "pwsh",
        ];

        let mut found = 0;
        for indicator in &ps_indicators {
            if content.contains(indicator) {
                found += 1;
            }
        }

        if found == 0 {
            return None;
        }

        let confidence = (found as f32 / 3.0).min(1.0);
        Some(confidence)
    }

    fn detect_url_encoding(&self, content: &str) -> Option<f32> {
        let url_pattern = Regex::new(r"%[0-9A-Fa-f]{2}").unwrap();
        let matches = url_pattern.find_iter(content).count();
        
        if matches < 5 {
            return None;
        }

        let confidence = (matches as f32 / 20.0).min(1.0) * 0.8;
        Some(confidence)
    }

    fn detect_xor_patterns(&self, content: &str) -> f32 {
        // Simple heuristic: look for repeating patterns that might indicate XOR
        let bytes = content.as_bytes();
        if bytes.len() < 16 {
            return 0.0;
        }

        let mut pattern_score: f32 = 0.0;
        let chunk_size = 8;
        
        for i in 0..bytes.len().saturating_sub(chunk_size * 2) {
            let chunk1 = &bytes[i..i + chunk_size];
            let chunk2 = &bytes[i + chunk_size..i + chunk_size * 2];
            
            let mut diff_count = 0;
            for j in 0..chunk_size {
                if chunk1[j] != chunk2[j] {
                    diff_count += 1;
                }
            }
            
            // If chunks are similar but not identical, might be XOR
            if diff_count > 2 && diff_count < chunk_size - 2 {
                pattern_score += 0.1;
            }
        }

        pattern_score.min(1.0)
    }

    fn determine_deobfuscation_order(&self, techniques: &[(ObfuscationTechnique, f32)]) -> Vec<ObfuscationTechnique> {
        // Define priority order for techniques
        let priority_map: HashMap<&str, i32> = [
            ("url", 1),
            ("base64", 2),
            ("hex", 3),
            ("unicode", 4),
            ("charcode", 5),
            ("xor", 6),
            ("eval", 7),
            ("ps_encoded", 8),
        ].iter().cloned().collect();

        let mut ordered_techniques: Vec<_> = techniques.iter()
            .map(|(tech, _)| tech.clone())
            .collect();

        ordered_techniques.sort_by_key(|tech| {
            let tech_name = match tech {
                ObfuscationTechnique::UrlEncoding => "url",
                ObfuscationTechnique::Base64Encoding => "base64",
                ObfuscationTechnique::HexEncoding => "hex",
                ObfuscationTechnique::UnicodeEscape => "unicode",
                ObfuscationTechnique::CharCodeConcat => "charcode",
                ObfuscationTechnique::XorEncryption { .. } => "xor",
                ObfuscationTechnique::JsEvalChain => "eval",
                ObfuscationTechnique::PsEncodedCommand => "ps_encoded",
                _ => "other",
            };
            
            priority_map.get(tech_name).copied().unwrap_or(99)
        });

        ordered_techniques
    }

    fn calculate_complexity_score(&self, techniques: &[(ObfuscationTechnique, f32)], entropy: f32) -> f32 {
        let technique_score = techniques.iter()
            .map(|(_, confidence)| confidence)
            .sum::<f32>() / techniques.len().max(1) as f32;

        let entropy_score = (entropy / 8.0).min(1.0);
        
        (technique_score * 0.7 + entropy_score * 0.3).min(1.0)
    }
}