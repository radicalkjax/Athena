use base64::{Engine as _, engine::general_purpose};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeobfuscationResult {
    pub original: String,
    pub deobfuscated: String,
    pub techniques_found: Vec<ObfuscationTechnique>,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ObfuscationTechnique {
    Base64Encoding,
    HexEncoding,
    UnicodeEscape,
    CharCodeConcat,
    StringReverse,
    XorEncryption(u8),
    CustomEncoding,
}

pub struct Deobfuscator;

impl Deobfuscator {
    pub fn new() -> Self {
        Deobfuscator
    }

    pub fn deobfuscate(&self, content: &str) -> DeobfuscationResult {
        let mut deobfuscated = content.to_string();
        let mut techniques_found = Vec::new();
        let mut confidence: f32 = 0.0;

        // Try Base64 decoding
        if let Some(decoded) = self.try_base64_decode(&deobfuscated) {
            if self.is_readable(&decoded) {
                deobfuscated = decoded;
                techniques_found.push(ObfuscationTechnique::Base64Encoding);
                confidence += 0.3;
            }
        }

        // Try hex decoding
        if let Some(decoded) = self.try_hex_decode(&deobfuscated) {
            if self.is_readable(&decoded) {
                deobfuscated = decoded;
                techniques_found.push(ObfuscationTechnique::HexEncoding);
                confidence += 0.3;
            }
        }

        // Try Unicode unescape
        if let Some(decoded) = self.try_unicode_unescape(&deobfuscated) {
            deobfuscated = decoded;
            techniques_found.push(ObfuscationTechnique::UnicodeEscape);
            confidence += 0.2;
        }

        // Try character code concatenation
        if let Some(decoded) = self.try_charcode_decode(&deobfuscated) {
            deobfuscated = decoded;
            techniques_found.push(ObfuscationTechnique::CharCodeConcat);
            confidence += 0.2;
        }

        // Try XOR with common keys
        for key in &[0x13, 0x37, 0x42, 0xAA, 0xFF] {
            if let Some(decoded) = self.try_xor_decode(&deobfuscated, *key) {
                if self.is_readable(&decoded) && self.has_improved(&content, &decoded) {
                    deobfuscated = decoded;
                    techniques_found.push(ObfuscationTechnique::XorEncryption(*key));
                    confidence += 0.3;
                    break;
                }
            }
        }

        // Adjust confidence based on improvement
        if self.has_improved(content, &deobfuscated) {
            confidence = confidence.min(1.0);
        } else {
            confidence = 0.0;
        }

        DeobfuscationResult {
            original: content.to_string(),
            deobfuscated,
            techniques_found,
            confidence,
        }
    }

    fn try_base64_decode(&self, input: &str) -> Option<String> {
        // Extract potential base64 strings
        let base64_pattern = regex::Regex::new(r"[A-Za-z0-9+/]{4,}={0,2}").ok()?;
        
        for mat in base64_pattern.find_iter(input) {
            if let Ok(decoded) = general_purpose::STANDARD.decode(mat.as_str()) {
                if let Ok(string) = String::from_utf8(decoded) {
                    return Some(input.replace(mat.as_str(), &string));
                }
            }
        }
        
        None
    }

    fn try_hex_decode(&self, input: &str) -> Option<String> {
        let hex_pattern = regex::Regex::new(r"\\x([0-9a-fA-F]{2})").ok()?;
        let mut result = input.to_string();
        
        for cap in hex_pattern.captures_iter(input) {
            if let Some(hex) = cap.get(1) {
                if let Ok(byte) = u8::from_str_radix(hex.as_str(), 16) {
                    result = result.replace(&cap[0], &(byte as char).to_string());
                }
            }
        }
        
        if result != input {
            Some(result)
        } else {
            None
        }
    }

    fn try_unicode_unescape(&self, input: &str) -> Option<String> {
        let unicode_pattern = regex::Regex::new(r"\\u([0-9a-fA-F]{4})").ok()?;
        let mut result = input.to_string();
        
        for cap in unicode_pattern.captures_iter(input) {
            if let Some(hex) = cap.get(1) {
                if let Ok(code) = u32::from_str_radix(hex.as_str(), 16) {
                    if let Some(ch) = char::from_u32(code) {
                        result = result.replace(&cap[0], &ch.to_string());
                    }
                }
            }
        }
        
        if result != input {
            Some(result)
        } else {
            None
        }
    }

    fn try_charcode_decode(&self, input: &str) -> Option<String> {
        // Detect patterns like String.fromCharCode(72,101,108,108,111)
        let charcode_pattern = regex::Regex::new(
            r"String\.fromCharCode\s*\(\s*((?:\d+\s*,?\s*)+)\s*\)"
        ).ok()?;
        
        let mut result = input.to_string();
        
        for cap in charcode_pattern.captures_iter(input) {
            if let Some(codes) = cap.get(1) {
                let decoded: String = codes.as_str()
                    .split(',')
                    .filter_map(|s| s.trim().parse::<u8>().ok())
                    .map(|b| b as char)
                    .collect();
                
                if !decoded.is_empty() {
                    result = result.replace(&cap[0], &decoded);
                }
            }
        }
        
        if result != input {
            Some(result)
        } else {
            None
        }
    }

    fn try_xor_decode(&self, input: &str, key: u8) -> Option<String> {
        let bytes = input.as_bytes();
        let decoded: Vec<u8> = bytes.iter().map(|&b| b ^ key).collect();
        
        String::from_utf8(decoded).ok()
    }

    fn is_readable(&self, text: &str) -> bool {
        let printable_ratio = text.chars()
            .filter(|c| c.is_ascii() && !c.is_control())
            .count() as f32 / text.len() as f32;
        
        printable_ratio > 0.8
    }

    fn has_improved(&self, original: &str, decoded: &str) -> bool {
        // Check if the decoded version has more readable content
        let original_readable = self.count_readable_words(original);
        let decoded_readable = self.count_readable_words(decoded);
        
        decoded_readable > original_readable
    }

    fn count_readable_words(&self, text: &str) -> usize {
        // Simple heuristic: count space-separated tokens that look like words
        text.split_whitespace()
            .filter(|word| {
                word.len() > 2 && 
                word.chars().any(|c| c.is_alphabetic())
            })
            .count()
    }
}