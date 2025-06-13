use super::{DeobfuscationTechnique, TechniqueResult};
use crate::types::ObfuscationTechnique;
use base64::{Engine as _, engine::general_purpose};
use regex::Regex;

pub struct Base64Decoder {
    pattern: Regex,
}

impl Base64Decoder {
    pub fn new() -> Self {
        Self {
            pattern: Regex::new(r"[A-Za-z0-9+/]{20,}={0,2}").unwrap(),
        }
    }
}

impl DeobfuscationTechnique for Base64Decoder {
    fn name(&self) -> &'static str {
        "Base64 Decoder"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        let matches: Vec<_> = self.pattern.find_iter(content).collect();
        if matches.is_empty() {
            return None;
        }

        // Test if the matches are valid base64
        let mut valid_count = 0;
        for m in &matches {
            if general_purpose::STANDARD.decode(m.as_str()).is_ok() {
                valid_count += 1;
            }
        }

        if valid_count == 0 {
            return None;
        }

        let confidence = (valid_count as f32 / matches.len() as f32) * 0.9;
        Some(confidence)
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let mut result = content.to_string();
        let mut decoded_count = 0;

        for mat in self.pattern.find_iter(content) {
            if let Ok(decoded_bytes) = general_purpose::STANDARD.decode(mat.as_str()) {
                if let Ok(decoded_string) = String::from_utf8(decoded_bytes) {
                    // Check if decoded string is mostly printable
                    let printable_ratio = decoded_string.chars()
                        .filter(|c| c.is_ascii() && !c.is_control())
                        .count() as f32 / decoded_string.len() as f32;
                    
                    if printable_ratio > 0.8 {
                        result = result.replace(mat.as_str(), &decoded_string);
                        decoded_count += 1;
                    }
                }
            }
        }

        Ok(TechniqueResult {
            success: decoded_count > 0,
            output: result,
            context: Some(format!("Decoded {} base64 strings", decoded_count)),
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::Base64Encoding)
    }
}

pub struct HexDecoder {
    patterns: Vec<Regex>,
}

impl HexDecoder {
    pub fn new() -> Self {
        Self {
            patterns: vec![
                Regex::new(r"\\x([0-9a-fA-F]{2})").unwrap(),
                Regex::new(r"0x([0-9a-fA-F]{2})").unwrap(),
                Regex::new(r"([0-9a-fA-F]{2})\s*").unwrap(),
            ],
        }
    }
}

impl DeobfuscationTechnique for HexDecoder {
    fn name(&self) -> &'static str {
        "Hex Decoder"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        for pattern in &self.patterns {
            if pattern.is_match(content) {
                return Some(0.8);
            }
        }
        None
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let mut result = content.to_string();
        let mut decoded_count = 0;

        // Try \x hex notation
        let hex_pattern = &self.patterns[0];
        for cap in hex_pattern.captures_iter(content) {
            if let Some(hex) = cap.get(1) {
                if let Ok(byte) = u8::from_str_radix(hex.as_str(), 16) {
                    if byte.is_ascii() && !byte.is_ascii_control() {
                        result = result.replace(&cap[0], &(byte as char).to_string());
                        decoded_count += 1;
                    }
                }
            }
        }

        // Try continuous hex strings
        let continuous_hex = Regex::new(r"([0-9a-fA-F]{8,})").unwrap();
        for mat in continuous_hex.find_iter(content) {
            let hex_str = mat.as_str();
            if hex_str.len() % 2 == 0 {
                let mut decoded = String::new();
                let mut valid = true;
                
                for i in (0..hex_str.len()).step_by(2) {
                    if let Ok(byte) = u8::from_str_radix(&hex_str[i..i+2], 16) {
                        if byte.is_ascii() && !byte.is_ascii_control() {
                            decoded.push(byte as char);
                        } else {
                            valid = false;
                            break;
                        }
                    }
                }
                
                if valid && !decoded.is_empty() {
                    result = result.replace(hex_str, &decoded);
                    decoded_count += 1;
                }
            }
        }

        Ok(TechniqueResult {
            success: decoded_count > 0,
            output: result,
            context: Some(format!("Decoded {} hex sequences", decoded_count)),
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::HexEncoding)
    }
}

pub struct UnicodeDecoder {
    pattern: Regex,
}

impl UnicodeDecoder {
    pub fn new() -> Self {
        Self {
            pattern: Regex::new(r"\\u([0-9a-fA-F]{4})").unwrap(),
        }
    }
}

impl DeobfuscationTechnique for UnicodeDecoder {
    fn name(&self) -> &'static str {
        "Unicode Decoder"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        if self.pattern.is_match(content) {
            let count = self.pattern.find_iter(content).count();
            let confidence = (count as f32 / 10.0).min(1.0) * 0.9;
            Some(confidence)
        } else {
            None
        }
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let mut result = content.to_string();
        let mut decoded_count = 0;

        for cap in self.pattern.captures_iter(content) {
            if let Some(hex) = cap.get(1) {
                if let Ok(code) = u32::from_str_radix(hex.as_str(), 16) {
                    if let Some(ch) = char::from_u32(code) {
                        result = result.replace(&cap[0], &ch.to_string());
                        decoded_count += 1;
                    }
                }
            }
        }

        Ok(TechniqueResult {
            success: decoded_count > 0,
            output: result,
            context: Some(format!("Decoded {} unicode escapes", decoded_count)),
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::UnicodeEscape)
    }
}

pub struct UrlDecoder;

impl UrlDecoder {
    pub fn new() -> Self {
        Self
    }
}

impl DeobfuscationTechnique for UrlDecoder {
    fn name(&self) -> &'static str {
        "URL Decoder"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        let url_pattern = Regex::new(r"%[0-9A-Fa-f]{2}").unwrap();
        let matches = url_pattern.find_iter(content).count();
        
        if matches >= 3 {
            let confidence = (matches as f32 / 10.0).min(1.0) * 0.8;
            Some(confidence)
        } else {
            None
        }
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let url_pattern = Regex::new(r"%[0-9A-Fa-f]{2}").unwrap();
        let mut result = content.to_string();
        let mut decoded_count = 0;
        
        for cap in url_pattern.captures_iter(content) {
            if let Some(encoded) = cap.get(0) {
                let hex_str = &encoded.as_str()[1..]; // Skip the %
                if let Ok(byte_val) = u8::from_str_radix(hex_str, 16) {
                    result = result.replace(encoded.as_str(), &(byte_val as char).to_string());
                    decoded_count += 1;
                }
            }
        }
        
        Ok(TechniqueResult {
            success: decoded_count > 0,
            output: result,
            context: Some(format!("URL decoded {} sequences", decoded_count)),
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::UrlEncoding)
    }
}

pub struct HtmlEntityDecoder {
    patterns: Vec<(Regex, fn(&str) -> Option<char>)>,
}

impl HtmlEntityDecoder {
    pub fn new() -> Self {
        Self {
            patterns: vec![
                (
                    Regex::new(r"&#(\d+);").unwrap(),
                    |s: &str| s.parse::<u32>().ok().and_then(char::from_u32),
                ),
                (
                    Regex::new(r"&#x([0-9a-fA-F]+);").unwrap(),
                    |s: &str| u32::from_str_radix(s, 16).ok().and_then(char::from_u32),
                ),
            ],
        }
    }
}

impl DeobfuscationTechnique for HtmlEntityDecoder {
    fn name(&self) -> &'static str {
        "HTML Entity Decoder"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        for (pattern, _) in &self.patterns {
            if pattern.is_match(content) {
                return Some(0.85);
            }
        }
        
        // Check for named entities
        if content.contains("&amp;") || content.contains("&lt;") || content.contains("&gt;") {
            return Some(0.9);
        }
        
        None
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let mut result = content.to_string();
        let mut decoded_count = 0;

        // Decode numeric entities
        for (pattern, decoder) in &self.patterns {
            for cap in pattern.captures_iter(content) {
                if let Some(code_match) = cap.get(1) {
                    if let Some(ch) = decoder(code_match.as_str()) {
                        result = result.replace(&cap[0], &ch.to_string());
                        decoded_count += 1;
                    }
                }
            }
        }

        // Decode common named entities
        let replacements = [
            ("&amp;", "&"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&quot;", "\""),
            ("&apos;", "'"),
            ("&nbsp;", " "),
        ];

        for (entity, replacement) in &replacements {
            if result.contains(entity) {
                result = result.replace(entity, replacement);
                decoded_count += 1;
            }
        }

        Ok(TechniqueResult {
            success: decoded_count > 0,
            output: result,
            context: Some(format!("Decoded {} HTML entities", decoded_count)),
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::HtmlEntityEncoding)
    }
}