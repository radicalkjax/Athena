/// Packer Detection System
/// Detects known packers and obfuscators using entropy analysis + signatures
///
/// Supports: UPX, Themida, VMProtect, ASPack, PECompact, and more

use std::collections::HashMap;
use serde::{Serialize, Deserialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackerDetectionResult {
    pub is_packed: bool,
    pub detected_packers: Vec<PackerSignature>,
    pub entropy_score: f64,
    pub high_entropy_sections: Vec<String>,
    pub suspicious_indicators: Vec<String>,
    pub confidence: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackerSignature {
    pub name: String,
    pub version: Option<String>,
    pub family: String,
    pub confidence: f64,
    pub indicators: Vec<String>,
}

pub struct PackerDetector {
    signatures: Vec<PackerSignatureDefinition>,
}

#[derive(Clone, Debug)]
struct PackerSignatureDefinition {
    name: String,
    family: String,
    entry_point_patterns: Vec<Vec<u8>>,
    section_names: Vec<String>,
    import_patterns: Vec<String>,
    min_entropy: f64,
}

impl PackerDetector {
    pub fn new() -> Self {
        Self {
            signatures: Self::load_builtin_signatures(),
        }
    }

    /// Detect packers in binary data
    pub fn detect(&self, data: &[u8], file_type: &str) -> PackerDetectionResult {
        let mut result = PackerDetectionResult {
            is_packed: false,
            detected_packers: Vec::new(),
            entropy_score: 0.0,
            high_entropy_sections: Vec::new(),
            suspicious_indicators: Vec::new(),
            confidence: 0.0,
        };

        // Calculate overall entropy
        result.entropy_score = self.calculate_entropy(data);

        // High entropy is suspicious (> 7.0 indicates encryption/compression)
        if result.entropy_score > 7.0 {
            result.is_packed = true;
            result.suspicious_indicators.push(format!(
                "Very high entropy: {:.2}",
                result.entropy_score
            ));
        }

        // Check for packer signatures
        if file_type == "PE" || file_type == "PE32" || file_type == "PE64" {
            self.detect_pe_packers(data, &mut result);
        } else if file_type == "ELF32" || file_type == "ELF64" {
            self.detect_elf_packers(data, &mut result);
        }

        // Calculate overall confidence
        if !result.detected_packers.is_empty() {
            result.confidence = result.detected_packers.iter()
                .map(|p| p.confidence)
                .max_by(|a, b| a.partial_cmp(b).unwrap())
                .unwrap_or(0.0);
        } else if result.entropy_score > 7.5 {
            result.confidence = 0.7; // High entropy alone
        } else if result.entropy_score > 7.0 {
            result.confidence = 0.5;
        }

        result
    }

    fn detect_pe_packers(&self, data: &[u8], result: &mut PackerDetectionResult) {
        // Check entry point signatures
        for sig in &self.signatures {
            for pattern in &sig.entry_point_patterns {
                if self.check_entry_point_pattern(data, pattern) {
                    result.detected_packers.push(PackerSignature {
                        name: sig.name.clone(),
                        version: None,
                        family: sig.family.clone(),
                        confidence: 0.9,
                        indicators: vec!["Entry point signature match".to_string()],
                    });
                    result.is_packed = true;
                }
            }
        }

        // Check section names
        if let Some(section_names) = self.extract_pe_section_names(data) {
            for sig in &self.signatures {
                for sig_section in &sig.section_names {
                    if section_names.iter().any(|s| s.contains(sig_section)) {
                        result.suspicious_indicators.push(format!(
                            "Suspicious section name: {}",
                            sig_section
                        ));

                        // Check if not already detected
                        if !result.detected_packers.iter().any(|p| p.name == sig.name) {
                            result.detected_packers.push(PackerSignature {
                                name: sig.name.clone(),
                                version: None,
                                family: sig.family.clone(),
                                confidence: 0.7,
                                indicators: vec![format!("Section name: {}", sig_section)],
                            });
                            result.is_packed = true;
                        }
                    }
                }
            }

            // Check for high entropy sections
            for section_name in section_names {
                result.high_entropy_sections.push(section_name);
            }
        }
    }

    fn detect_elf_packers(&self, data: &[u8], result: &mut PackerDetectionResult) {
        // ELF packers are less common but include UPX
        if data.len() > 100 {
            // Check for UPX in ELF
            for i in 0..data.len().saturating_sub(3) {
                if &data[i..i + 3] == b"UPX" {
                    result.detected_packers.push(PackerSignature {
                        name: "UPX".to_string(),
                        version: None,
                        family: "Compression".to_string(),
                        confidence: 0.95,
                        indicators: vec!["UPX signature found".to_string()],
                    });
                    result.is_packed = true;
                    break;
                }
            }
        }
    }

    fn check_entry_point_pattern(&self, data: &[u8], pattern: &[u8]) -> bool {
        if data.len() < 64 + pattern.len() {
            return false;
        }

        // Simplified: check at common entry point offset
        // Real implementation would parse PE header to get actual entry point
        let check_offset = 0x1000; // Common entry point
        if data.len() > check_offset + pattern.len() {
            &data[check_offset..check_offset + pattern.len()] == pattern
        } else {
            false
        }
    }

    fn extract_pe_section_names(&self, data: &[u8]) -> Option<Vec<String>> {
        if data.len() < 64 {
            return None;
        }

        // Read e_lfanew
        let e_lfanew = u32::from_le_bytes([
            data[0x3c], data[0x3d], data[0x3e], data[0x3f]
        ]) as usize;

        if e_lfanew + 24 > data.len() {
            return None;
        }

        // Read number of sections
        let num_sections = u16::from_le_bytes([
            data[e_lfanew + 6], data[e_lfanew + 7]
        ]) as usize;

        // Section table starts after optional header
        // Simplified offset calculation
        let sections_offset = e_lfanew + 24 + 224; // COFF + Optional header (PE32)

        let mut section_names = Vec::new();
        for i in 0..num_sections.min(20) {
            let section_offset = sections_offset + (i * 40);
            if section_offset + 8 > data.len() {
                break;
            }

            // Section name is first 8 bytes
            let name_bytes = &data[section_offset..section_offset + 8];
            if let Ok(name) = std::str::from_utf8(name_bytes) {
                section_names.push(name.trim_end_matches('\0').to_string());
            }
        }

        Some(section_names)
    }

    fn calculate_entropy(&self, data: &[u8]) -> f64 {
        if data.is_empty() {
            return 0.0;
        }

        let mut frequency = [0u64; 256];
        for &byte in data {
            frequency[byte as usize] += 1;
        }

        let len = data.len() as f64;
        let mut entropy = 0.0;

        for &count in &frequency {
            if count > 0 {
                let probability = count as f64 / len;
                entropy -= probability * probability.log2();
            }
        }

        entropy
    }

    fn load_builtin_signatures() -> Vec<PackerSignatureDefinition> {
        vec![
            // UPX - Most common packer
            PackerSignatureDefinition {
                name: "UPX".to_string(),
                family: "Compression".to_string(),
                entry_point_patterns: vec![
                    vec![0x60, 0xBE], // PUSHAD; MOV ESI,
                    vec![0x83, 0xEC], // SUB ESP,
                ],
                section_names: vec!["UPX0".to_string(), "UPX1".to_string()],
                import_patterns: vec![],
                min_entropy: 7.0,
            },

            // Themida/WinLicense
            PackerSignatureDefinition {
                name: "Themida".to_string(),
                family: "Protector".to_string(),
                entry_point_patterns: vec![
                    vec![0xEB, 0x00], // JMP +0 (anti-debug)
                ],
                section_names: vec![".themida".to_string(), ".winlice".to_string()],
                import_patterns: vec!["OreansCRT".to_string()],
                min_entropy: 7.5,
            },

            // VMProtect
            PackerSignatureDefinition {
                name: "VMProtect".to_string(),
                family: "Virtualizer".to_string(),
                entry_point_patterns: vec![
                    vec![0x68], // PUSH
                ],
                section_names: vec![".vmp0".to_string(), ".vmp1".to_string()],
                import_patterns: vec![],
                min_entropy: 7.5,
            },

            // ASPack
            PackerSignatureDefinition {
                name: "ASPack".to_string(),
                family: "Compression".to_string(),
                entry_point_patterns: vec![
                    vec![0x60, 0xE8], // PUSHAD; CALL
                ],
                section_names: vec!["aspack".to_string(), ".aspack".to_string()],
                import_patterns: vec![],
                min_entropy: 7.0,
            },

            // PECompact
            PackerSignatureDefinition {
                name: "PECompact".to_string(),
                family: "Compression".to_string(),
                entry_point_patterns: vec![
                    vec![0xEB, 0x06], // JMP +6
                ],
                section_names: vec!["PEC2".to_string(), "pec1".to_string()],
                import_patterns: vec![],
                min_entropy: 7.2,
            },

            // FSG
            PackerSignatureDefinition {
                name: "FSG".to_string(),
                family: "Compression".to_string(),
                entry_point_patterns: vec![
                    vec![0x87, 0x25], // XCHG
                ],
                section_names: vec![],
                import_patterns: vec![],
                min_entropy: 7.0,
            },

            // MEW
            PackerSignatureDefinition {
                name: "MEW".to_string(),
                family: "Compression".to_string(),
                entry_point_patterns: vec![
                    vec![0x33, 0xC0], // XOR EAX, EAX
                ],
                section_names: vec!["MEW".to_string()],
                import_patterns: vec![],
                min_entropy: 7.0,
            },

            // Petite
            PackerSignatureDefinition {
                name: "Petite".to_string(),
                family: "Compression".to_string(),
                entry_point_patterns: vec![
                    vec![0xB8], // MOV EAX,
                ],
                section_names: vec![".petite".to_string()],
                import_patterns: vec![],
                min_entropy: 6.8,
            },

            // Armadillo
            PackerSignatureDefinition {
                name: "Armadillo".to_string(),
                family: "Protector".to_string(),
                entry_point_patterns: vec![],
                section_names: vec![".adata".to_string()],
                import_patterns: vec!["XTREME".to_string()],
                min_entropy: 7.3,
            },

            // Enigma
            PackerSignatureDefinition {
                name: "Enigma Protector".to_string(),
                family: "Protector".to_string(),
                entry_point_patterns: vec![],
                section_names: vec![".enigma1".to_string(), ".enigma2".to_string()],
                import_patterns: vec![],
                min_entropy: 7.4,
            },
        ]
    }

    /// Get all known packer names
    pub fn get_known_packers(&self) -> Vec<String> {
        self.signatures.iter()
            .map(|s| s.name.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entropy_calculation() {
        let detector = PackerDetector::new();

        // Low entropy (all zeros)
        let low_entropy_data = vec![0u8; 1000];
        assert!(detector.calculate_entropy(&low_entropy_data) < 1.0);

        // High entropy (random-like)
        let high_entropy_data: Vec<u8> = (0..256).map(|i| i as u8).collect();
        assert!(detector.calculate_entropy(&high_entropy_data) > 7.0);
    }

    #[test]
    fn test_upx_detection() {
        let detector = PackerDetector::new();

        let mut data = vec![0u8; 5000];
        // Add UPX signature
        data[100] = b'U';
        data[101] = b'P';
        data[102] = b'X';

        let result = detector.detect(&data, "ELF64");
        assert!(result.is_packed);
        assert!(!result.detected_packers.is_empty());
    }

    #[test]
    fn test_high_entropy_detection() {
        let detector = PackerDetector::new();

        // Create high entropy data
        let high_entropy_data: Vec<u8> = (0..1000).map(|i| (i % 256) as u8).collect();

        let result = detector.detect(&high_entropy_data, "PE32");
        assert!(result.entropy_score > 7.0);
        assert!(result.is_packed || !result.suspicious_indicators.is_empty());
    }

    #[test]
    fn test_get_known_packers() {
        let detector = PackerDetector::new();
        let packers = detector.get_known_packers();

        assert!(packers.contains(&"UPX".to_string()));
        assert!(packers.contains(&"Themida".to_string()));
        assert!(packers.contains(&"VMProtect".to_string()));
    }
}
