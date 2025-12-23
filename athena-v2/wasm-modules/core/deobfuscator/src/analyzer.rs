use crate::types::*;
use crate::cfg_analysis::{detect_control_flow_flattening, SimpleCfg};
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

// AES S-box lookup table (first 16 bytes for signature detection)
const AES_SBOX_SIGNATURE: [u8; 16] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5,
    0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76
];

// Full AES S-box for comprehensive detection
const AES_SBOX_FULL: [u8; 256] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
    0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
    0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
    0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
    0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
    0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
    0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
    0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
    0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
];

// DES Initial Permutation table signature
const DES_IP_SIGNATURE: [u8; 8] = [58, 50, 42, 34, 26, 18, 10, 2];

// DES PC1 permutation table (used in key schedule)
const DES_PC1_SIGNATURE: [u8; 8] = [57, 49, 41, 33, 25, 17, 9, 1];

// Common crypto library function names
const CRYPTO_FUNCTION_NAMES: &[&str] = &[
    "AES_encrypt", "AES_decrypt", "AES_set_encrypt_key", "AES_set_decrypt_key",
    "DES_encrypt", "DES_decrypt", "DES_set_key",
    "EVP_EncryptInit", "EVP_DecryptInit", "EVP_CipherInit",
    "CryptEncrypt", "CryptDecrypt", "BCryptEncrypt", "BCryptDecrypt",
    "rijndael", "Rijndael",
];

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

        // Check for crypto constants in binary content
        let crypto_detections = self.detect_crypto_constants(content.as_bytes());
        for detection in crypto_detections {
            let confidence = detection.confidence;
            let technique = match detection.algorithm.as_str() {
                "AES" => ObfuscationTechnique::AesEncryption,
                "DES" => ObfuscationTechnique::DesEncryption,
                _ => ObfuscationTechnique::CryptoConstants {
                    algorithm: detection.algorithm.clone()
                },
            };
            detected_techniques.push((technique, confidence));
        }

        // Check for crypto function names
        if let Some(confidence) = self.detect_crypto_functions(content) {
            detected_techniques.push((
                ObfuscationTechnique::CryptoConstants {
                    algorithm: "library_functions".to_string()
                },
                confidence,
            ));
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

    /// Detect cryptographic constants (AES S-boxes, DES tables, etc.) in binary data
    pub fn detect_crypto_constants(&self, data: &[u8]) -> Vec<crate::types::CryptoDetection> {
        let mut detections = Vec::new();

        // Search for AES S-box signature (first 16 bytes)
        if let Some(offset) = self.find_pattern(data, &AES_SBOX_SIGNATURE) {
            // Verify it's the full S-box by checking more bytes
            let confidence = if offset + 256 <= data.len() {
                let mut matches = 0;
                for i in 0..256 {
                    if data[offset + i] == AES_SBOX_FULL[i] {
                        matches += 1;
                    }
                }
                // Calculate confidence based on how many bytes match
                (matches as f32 / 256.0) * 0.95
            } else {
                // Only found the signature, not the full table
                0.70
            };

            if confidence > 0.5 {
                detections.push(crate::types::CryptoDetection {
                    algorithm: "AES".to_string(),
                    offset,
                    confidence,
                    context: "AES S-box lookup table detected".to_string(),
                });
            }
        }

        // Search for DES Initial Permutation table
        if let Some(offset) = self.find_pattern(data, &DES_IP_SIGNATURE) {
            detections.push(crate::types::CryptoDetection {
                algorithm: "DES".to_string(),
                offset,
                confidence: 0.85,
                context: "DES Initial Permutation table detected".to_string(),
            });
        }

        // Search for DES PC1 permutation table (key schedule)
        if let Some(offset) = self.find_pattern(data, &DES_PC1_SIGNATURE) {
            detections.push(crate::types::CryptoDetection {
                algorithm: "DES".to_string(),
                offset,
                confidence: 0.80,
                context: "DES PC1 key schedule table detected".to_string(),
            });
        }

        // Look for AES key expansion constants (Rcon table)
        let aes_rcon_signature: [u8; 8] = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];
        if let Some(offset) = self.find_pattern(data, &aes_rcon_signature) {
            detections.push(crate::types::CryptoDetection {
                algorithm: "AES".to_string(),
                offset,
                confidence: 0.75,
                context: "AES Rcon key expansion constants detected".to_string(),
            });
        }

        detections
    }

    /// Search for a byte pattern in data, returns offset if found
    fn find_pattern(&self, data: &[u8], pattern: &[u8]) -> Option<usize> {
        if pattern.is_empty() || data.len() < pattern.len() {
            return None;
        }

        for i in 0..=data.len() - pattern.len() {
            if &data[i..i + pattern.len()] == pattern {
                return Some(i);
            }
        }

        None
    }

    /// Detect crypto library function names in text/strings
    fn detect_crypto_functions(&self, content: &str) -> Option<f32> {
        let mut found_count = 0;
        let mut total_occurrences = 0;

        for func_name in CRYPTO_FUNCTION_NAMES {
            if content.contains(func_name) {
                found_count += 1;
                // Count how many times this function appears
                total_occurrences += content.matches(func_name).count();
            }
        }

        if found_count == 0 {
            return None;
        }

        // Higher confidence with more unique function names found
        let base_confidence = (found_count as f32 / 5.0).min(1.0);

        // Boost confidence if multiple occurrences of same functions
        let occurrence_boost = (total_occurrences as f32 / 10.0).min(0.2);

        let confidence = (base_confidence * 0.8 + occurrence_boost).min(0.95);

        Some(confidence)
    }

    /// Analyze binary code for control flow flattening
    ///
    /// This method can accept either raw bytecode or a pre-built CFG structure.
    /// If a CFG is provided, it uses structural analysis for more accurate detection.
    /// Otherwise, it falls back to pattern-based detection on the raw bytes.
    pub fn analyze_binary(&self, code: &[u8], cfg: Option<SimpleCfg>) -> ObfuscationAnalysis {
        let mut detected_techniques = Vec::new();
        let mut scores = HashMap::new();

        // Calculate entropy
        let entropy = self.calculate_entropy(code);

        // Detect control flow flattening
        let cff_result = detect_control_flow_flattening(code, cfg.as_ref());
        if cff_result.detected {
            detected_techniques.push((
                ObfuscationTechnique::ControlFlowFlattening,
                cff_result.confidence as f32,
            ));
            scores.insert("cff", cff_result.confidence as f32);
        }

        // Detect crypto constants
        let crypto_detections = self.detect_crypto_constants(code);
        if !crypto_detections.is_empty() {
            let avg_confidence = crypto_detections.iter()
                .map(|d| d.confidence)
                .sum::<f32>() / crypto_detections.len() as f32;

            detected_techniques.push((
                ObfuscationTechnique::BinaryEncrypted,
                avg_confidence,
            ));
            scores.insert("crypto", avg_confidence);
        }

        // Check for high entropy (possible compression/encryption)
        if entropy > 7.0 {
            detected_techniques.push((
                ObfuscationTechnique::BinaryCompressed,
                (entropy / 8.0).min(1.0),
            ));
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
            ml_hints: None,
        }
    }

    /// Convenience method: detect control flow flattening from bytes only
    pub fn detect_cff_from_bytes(&self, code: &[u8]) -> crate::cfg_analysis::ControlFlowFlatteningDetection {
        detect_control_flow_flattening(code, None)
    }

    /// Convenience method: detect control flow flattening from CFG
    pub fn detect_cff_from_cfg(&self, cfg: &SimpleCfg) -> crate::cfg_analysis::ControlFlowFlatteningDetection {
        detect_control_flow_flattening(&[], Some(cfg))
    }
}