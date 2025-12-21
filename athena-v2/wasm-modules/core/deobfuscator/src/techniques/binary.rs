use super::{DeobfuscationTechnique, TechniqueResult};
use crate::types::ObfuscationTechnique;
use flate2::read::GzDecoder;
use std::io::Read;

pub struct BinaryUnpacker {
    pe_signature: Vec<u8>,
    elf_signature: Vec<u8>,
    upx_signatures: Vec<Vec<u8>>,
}

impl BinaryUnpacker {
    pub fn new() -> Self {
        Self {
            pe_signature: vec![0x4D, 0x5A], // MZ
            elf_signature: vec![0x7F, 0x45, 0x4C, 0x46], // .ELF
            upx_signatures: vec![
                vec![0x55, 0x50, 0x58, 0x21], // UPX!
                vec![0x55, 0x50, 0x58, 0x30], // UPX0
                vec![0x55, 0x50, 0x58, 0x31], // UPX1
            ],
        }
    }

    fn detect_packer_type(&self, data: &[u8]) -> Option<String> {
        // Check for UPX
        for sig in &self.upx_signatures {
            if Self::contains_signature(data, sig) {
                return Some("UPX".to_string());
            }
        }

        // Check for other packers
        let packer_signatures: Vec<(&[u8], &str)> = vec![
            (b"PEC2", "PECompact"),
            (b"PECo", "PECompact"),
            (b"ASPack", "ASPack"),
            (b"NSPack", "NSPack"),
            (b"MEW", "MEW"),
            (b"UPX!", "UPX"),
            (b"Themida", "Themida"),
            (b"VMProtect", "VMProtect"),
        ];

        for (sig, name) in &packer_signatures {
            if Self::contains_signature(data, sig) {
                return Some(name.to_string());
            }
        }

        // Check for compression indicators
        if data.starts_with(&[0x1F, 0x8B]) {
            return Some("GZIP".to_string());
        }

        if data.starts_with(&[0x50, 0x4B, 0x03, 0x04]) {
            return Some("ZIP".to_string());
        }

        None
    }

    fn contains_signature(data: &[u8], signature: &[u8]) -> bool {
        data.windows(signature.len())
            .any(|window| window == signature)
    }

    fn try_decompress_gzip(&self, data: &[u8]) -> Option<Vec<u8>> {
        let mut decoder = GzDecoder::new(data);
        let mut decompressed = Vec::new();
        
        match decoder.read_to_end(&mut decompressed) {
            Ok(_) => Some(decompressed),
            Err(_) => None,
        }
    }

    fn detect_pe_anomalies(&self, data: &[u8]) -> Vec<String> {
        let mut anomalies = Vec::new();

        if !data.starts_with(&self.pe_signature) {
            return anomalies;
        }

        // Check DOS header
        if data.len() > 0x3C {
            let pe_offset_bytes = &data[0x3C..0x40];
            let pe_offset = u32::from_le_bytes([
                pe_offset_bytes[0],
                pe_offset_bytes[1],
                pe_offset_bytes[2],
                pe_offset_bytes[3],
            ]) as usize;

            if pe_offset < data.len() - 4 {
                // Check PE signature
                if &data[pe_offset..pe_offset + 4] != b"PE\0\0" {
                    anomalies.push("Invalid PE signature".to_string());
                }

                // Check for packed sections
                if data.len() > pe_offset + 0x100 {
                    let section_data = &data[pe_offset + 0xF8..];
                    
                    // Look for high entropy sections (likely packed)
                    let entropy = Self::calculate_entropy(section_data);
                    if entropy > 7.0 {
                        anomalies.push("High entropy sections (likely packed)".to_string());
                    }
                }
            }
        }

        anomalies
    }

    fn calculate_entropy(data: &[u8]) -> f32 {
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
}

impl DeobfuscationTechnique for BinaryUnpacker {
    fn name(&self) -> &'static str {
        "Binary Unpacker"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        let bytes = content.as_bytes();
        
        // Check if this looks like binary data
        let non_ascii_count = bytes.iter()
            .filter(|&&b| !b.is_ascii() || b.is_ascii_control())
            .count();
        
        let binary_ratio = non_ascii_count as f32 / bytes.len() as f32;
        
        if binary_ratio < 0.3 {
            return None; // Likely text, not binary
        }

        // Check for known signatures
        if bytes.starts_with(&self.pe_signature) || bytes.starts_with(&self.elf_signature) {
            // Check for packer
            if let Some(packer) = self.detect_packer_type(bytes) {
                match packer.as_str() {
                    "UPX" => return Some(0.9),
                    "GZIP" => return Some(0.85),
                    _ => return Some(0.7),
                }
            }
            
            // Check for anomalies
            let anomalies = self.detect_pe_anomalies(bytes);
            if !anomalies.is_empty() {
                return Some(0.6);
            }
        }

        // Check entropy
        let entropy = Self::calculate_entropy(bytes);
        if entropy > 7.0 {
            return Some(0.5);
        }

        None
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let bytes = content.as_bytes();
        
        // Detect packer type
        if let Some(packer) = self.detect_packer_type(bytes) {
            match packer.as_str() {
                "GZIP" => {
                    if let Some(decompressed) = self.try_decompress_gzip(bytes) {
                        match String::from_utf8(decompressed) {
                            Ok(decompressed_str) => {
                                return Ok(TechniqueResult {
                                    success: true,
                                    output: decompressed_str,
                                    context: Some("Decompressed GZIP data".to_string()),
                                });
                            }
                            Err(_) => {
                                return Ok(TechniqueResult {
                                    success: true,
                                    output: format!("/* Binary data decompressed ({} bytes) */", bytes.len()),
                                    context: Some("Decompressed binary GZIP data".to_string()),
                                });
                            }
                        }
                    }
                }
                _ => {
                    // For other packers, we can't unpack but we can identify
                    return Ok(TechniqueResult {
                        success: true,
                        output: format!("/* DETECTED {} PACKED BINARY */\n{}", packer, content),
                        context: Some(format!("Detected {} packer", packer)),
                    });
                }
            }
        }

        // Check for anomalies
        let anomalies = self.detect_pe_anomalies(bytes);
        if !anomalies.is_empty() {
            return Ok(TechniqueResult {
                success: true,
                output: format!("/* PE ANOMALIES: {} */\n{}", anomalies.join(", "), content),
                context: Some("Detected PE anomalies".to_string()),
            });
        }

        Ok(TechniqueResult {
            success: false,
            output: content.to_string(),
            context: None,
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(
            technique_type,
            ObfuscationTechnique::BinaryPacked |
            ObfuscationTechnique::BinaryCompressed |
            ObfuscationTechnique::BinaryEncrypted
        )
    }
}