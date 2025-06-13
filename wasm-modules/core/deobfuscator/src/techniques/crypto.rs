use super::{DeobfuscationTechnique, TechniqueResult};
use crate::types::ObfuscationTechnique;

pub struct XorDecryptor {
    common_keys: Vec<u8>,
}

impl XorDecryptor {
    pub fn new() -> Self {
        Self {
            common_keys: vec![
                0x00, 0x01, 0x13, 0x37, 0x42, 0x69, 0xAA, 0xCC, 0xDD, 0xEE, 0xFF,
                0x12, 0x34, 0x56, 0x78, 0x9A, 0xBC, 0xDE, 0xF0,
            ],
        }
    }

    fn try_xor_key(&self, data: &[u8], key: u8) -> (Vec<u8>, f32) {
        let decrypted: Vec<u8> = data.iter().map(|&b| b ^ key).collect();
        
        // Calculate readability score
        let printable_count = decrypted.iter()
            .filter(|&&b| b.is_ascii() && !b.is_ascii_control())
            .count();
        
        let score = printable_count as f32 / decrypted.len() as f32;
        (decrypted, score)
    }

    fn detect_xor_key(&self, data: &[u8]) -> Option<(u8, f32)> {
        let mut best_key = None;
        let mut best_score = 0.0;

        // Try common keys first
        for &key in &self.common_keys {
            let (_, score) = self.try_xor_key(data, key);
            if score > best_score && score > 0.7 {
                best_score = score;
                best_key = Some(key);
            }
        }

        // If no good match with common keys, try frequency analysis
        if best_key.is_none() && data.len() > 50 {
            // Try all possible byte values
            for key in 0u8..=255u8 {
                let (decrypted, score) = self.try_xor_key(data, key);
                
                // Additional check: look for common English words
                if score > 0.7 {
                    if let Ok(text) = String::from_utf8(decrypted.clone()) {
                        let words = ["the", "and", "is", "in", "to", "of", "var", "function", "return"];
                        let contains_words = words.iter().any(|&word| text.contains(word));
                        
                        if contains_words && score > best_score {
                            best_score = score;
                            best_key = Some(key);
                        }
                    }
                }
            }
        }

        best_key.map(|key| (key, best_score))
    }
}

impl DeobfuscationTechnique for XorDecryptor {
    fn name(&self) -> &'static str {
        "XOR Decryptor"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        let bytes = content.as_bytes();
        
        // Check entropy - XOR encrypted data often has high entropy
        let entropy = calculate_entropy(bytes);
        if entropy < 5.0 {
            return None;
        }

        // Try to detect XOR key
        if let Some((_, confidence)) = self.detect_xor_key(bytes) {
            Some(confidence * 0.9)
        } else {
            None
        }
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let bytes = content.as_bytes();
        
        if let Some((key, _)) = self.detect_xor_key(bytes) {
            let decrypted: Vec<u8> = bytes.iter().map(|&b| b ^ key).collect();
            
            match String::from_utf8(decrypted) {
                Ok(decrypted_string) => Ok(TechniqueResult {
                    success: true,
                    output: decrypted_string,
                    context: Some(format!("XOR decrypted with key 0x{:02X}", key)),
                }),
                Err(_) => Err("Failed to decode XOR result as UTF-8".to_string()),
            }
        } else {
            Err("Could not find suitable XOR key".to_string())
        }
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::XorEncryption { .. })
    }
}

pub struct Rc4Decryptor;

impl Rc4Decryptor {
    pub fn new() -> Self {
        Self
    }

    fn rc4_decrypt(&self, data: &[u8], key: &[u8]) -> Vec<u8> {
        let mut s: Vec<u8> = (0..=255).collect();
        let mut j = 0u8;

        // Key scheduling
        for i in 0..256 {
            j = j.wrapping_add(s[i]).wrapping_add(key[i % key.len()]);
            s.swap(i, j as usize);
        }

        // Pseudo-random generation
        let mut i = 0u8;
        let mut j = 0u8;
        let mut output = Vec::with_capacity(data.len());

        for &byte in data {
            i = i.wrapping_add(1);
            j = j.wrapping_add(s[i as usize]);
            s.swap(i as usize, j as usize);
            
            let k = s[(s[i as usize].wrapping_add(s[j as usize])) as usize];
            output.push(byte ^ k);
        }

        output
    }

    fn try_common_rc4_keys(&self, data: &[u8]) -> Option<(Vec<u8>, Vec<u8>)> {
        let common_keys: Vec<&[u8]> = vec![
            b"key",
            b"password",
            b"secret",
            b"malware",
            b"infected",
            b"encrypt",
            b"decode",
            b"1234567890",
            b"qwerty",
        ];

        for key in &common_keys {
            let decrypted = self.rc4_decrypt(data, key);
            
            // Check if result is readable
            let printable_ratio = decrypted.iter()
                .filter(|&&b| b.is_ascii() && !b.is_ascii_control())
                .count() as f32 / decrypted.len() as f32;
            
            if printable_ratio > 0.8 {
                return Some((key.to_vec(), decrypted));
            }
        }

        None
    }
}

impl DeobfuscationTechnique for Rc4Decryptor {
    fn name(&self) -> &'static str {
        "RC4 Decryptor"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        // RC4 is harder to detect without context
        // Look for high entropy and certain patterns
        let bytes = content.as_bytes();
        let entropy = calculate_entropy(bytes);
        
        if entropy > 6.5 && bytes.len() > 50 {
            // Try common keys
            if self.try_common_rc4_keys(bytes).is_some() {
                Some(0.8)
            } else {
                Some(0.3) // Low confidence without successful decryption
            }
        } else {
            None
        }
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let bytes = content.as_bytes();
        
        if let Some((key, decrypted)) = self.try_common_rc4_keys(bytes) {
            match String::from_utf8(decrypted) {
                Ok(decrypted_string) => Ok(TechniqueResult {
                    success: true,
                    output: decrypted_string,
                    context: Some(format!("RC4 decrypted with key: {:?}", String::from_utf8_lossy(&key))),
                }),
                Err(_) => Err("Failed to decode RC4 result as UTF-8".to_string()),
            }
        } else {
            Err("Could not decrypt with common RC4 keys".to_string())
        }
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::Rc4Encryption)
    }
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