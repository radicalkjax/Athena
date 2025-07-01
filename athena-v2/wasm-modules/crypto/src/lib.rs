use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct CryptoDetectionResult {
    pub algorithms_detected: Vec<String>,
    pub crypto_constants: Vec<CryptoConstant>,
    pub key_schedules: Vec<String>,
    pub entropy_analysis: EntropyInfo,
    pub ransomware_indicators: Vec<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CryptoConstant {
    pub name: String,
    pub value: String,
    pub algorithm: String,
    pub offset: usize,
}

#[derive(Serialize, Deserialize)]
pub struct EntropyInfo {
    pub overall_entropy: f64,
    pub block_entropies: Vec<f64>,
    pub high_entropy_regions: Vec<(usize, usize)>,
}

#[wasm_bindgen]
pub fn detect_encryption(data: &[u8]) -> String {
    let result = CryptoDetectionResult {
        algorithms_detected: detect_crypto_algorithms(data),
        crypto_constants: find_crypto_constants(data),
        key_schedules: detect_key_schedules(data),
        entropy_analysis: analyze_entropy(data),
        ransomware_indicators: detect_ransomware_patterns(data),
    };
    
    serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
}

fn detect_crypto_algorithms(data: &[u8]) -> Vec<String> {
    let mut algorithms = Vec::new();
    
    // AES S-box detection
    if contains_aes_sbox(data) {
        algorithms.push("AES".to_string());
    }
    
    // DES S-boxes
    if contains_des_sboxes(data) {
        algorithms.push("DES/3DES".to_string());
    }
    
    // RC4 detection
    if contains_rc4_pattern(data) {
        algorithms.push("RC4".to_string());
    }
    
    // RSA detection (looking for large primes)
    if contains_rsa_patterns(data) {
        algorithms.push("RSA".to_string());
    }
    
    // ChaCha20/Salsa20
    if contains_chacha_constants(data) {
        algorithms.push("ChaCha20/Salsa20".to_string());
    }
    
    algorithms
}

fn find_crypto_constants(data: &[u8]) -> Vec<CryptoConstant> {
    let mut constants = Vec::new();
    
    // AES S-box (first few bytes)
    let aes_sbox_start = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5];
    if let Some(pos) = find_pattern(data, &aes_sbox_start) {
        constants.push(CryptoConstant {
            name: "AES S-box".to_string(),
            value: format!("{:02x?}", &aes_sbox_start),
            algorithm: "AES".to_string(),
            offset: pos,
        });
    }
    
    // SHA-256 K constants (first few)
    let sha256_k = [0x428a2f98u32, 0x71374491u32, 0xb5c0fbcfu32, 0xe9b5dba5u32];
    for (i, &k) in sha256_k.iter().enumerate() {
        if let Some(pos) = find_u32_pattern(data, k) {
            constants.push(CryptoConstant {
                name: format!("SHA-256 K[{}]", i),
                value: format!("0x{:08x}", k),
                algorithm: "SHA-256".to_string(),
                offset: pos,
            });
        }
    }
    
    // MD5 constants
    let md5_constants = [0xd76aa478u32, 0xe8c7b756u32, 0x242070dbu32, 0xc1bdceeeu32];
    for (i, &c) in md5_constants.iter().enumerate() {
        if let Some(pos) = find_u32_pattern(data, c) {
            constants.push(CryptoConstant {
                name: format!("MD5 T[{}]", i + 1),
                value: format!("0x{:08x}", c),
                algorithm: "MD5".to_string(),
                offset: pos,
            });
        }
    }
    
    constants
}

fn detect_key_schedules(data: &[u8]) -> Vec<String> {
    let mut schedules = Vec::new();
    
    // Look for patterns indicating key expansion
    if has_aes_key_schedule_pattern(data) {
        schedules.push("AES Key Schedule".to_string());
    }
    
    if has_des_key_schedule_pattern(data) {
        schedules.push("DES Key Schedule".to_string());
    }
    
    schedules
}

fn analyze_entropy(data: &[u8]) -> EntropyInfo {
    let block_size = 1024;
    let mut block_entropies = Vec::new();
    let mut high_entropy_regions = Vec::new();
    
    // Calculate entropy for blocks
    for (i, chunk) in data.chunks(block_size).enumerate() {
        let entropy = calculate_entropy(chunk);
        block_entropies.push(entropy);
        
        // Mark high entropy regions (likely encrypted)
        if entropy > 7.5 {
            let start = i * block_size;
            let end = start + chunk.len();
            high_entropy_regions.push((start, end));
        }
    }
    
    EntropyInfo {
        overall_entropy: calculate_entropy(data),
        block_entropies,
        high_entropy_regions,
    }
}

fn detect_ransomware_patterns(data: &[u8]) -> Vec<String> {
    let mut indicators = Vec::new();
    let text = String::from_utf8_lossy(data);
    
    // Common ransomware strings
    let ransomware_patterns = vec![
        ("Your files have been encrypted", "Ransom message"),
        ("Bitcoin", "Payment demand"),
        ("BTC wallet", "Payment demand"),
        (".locked", "File extension"),
        (".encrypted", "File extension"),
        ("AES-256", "Encryption mention"),
        ("RSA-2048", "Encryption mention"),
        ("Tor browser", "Communication method"),
        ("onion", "Dark web reference"),
    ];
    
    for (pattern, indicator_type) in ransomware_patterns {
        if text.contains(pattern) {
            indicators.push(format!("{}: {}", indicator_type, pattern));
        }
    }
    
    indicators
}

// Helper functions
fn contains_aes_sbox(data: &[u8]) -> bool {
    let aes_sbox_start = [0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5];
    find_pattern(data, &aes_sbox_start).is_some()
}

fn contains_des_sboxes(data: &[u8]) -> bool {
    // DES S1 box first row
    let des_s1 = [14, 4, 13, 1, 2, 15, 11, 8];
    find_pattern(data, &des_s1).is_some()
}

fn contains_rc4_pattern(data: &[u8]) -> bool {
    // Look for 256-byte permutation patterns
    if data.len() < 256 {
        return false;
    }
    
    // Check for sequences that look like RC4 S-box initialization
    for window in data.windows(256) {
        let mut seen = [false; 256];
        let mut all_unique = true;
        
        for &byte in window {
            if seen[byte as usize] {
                all_unique = false;
                break;
            }
            seen[byte as usize] = true;
        }
        
        if all_unique {
            return true;
        }
    }
    
    false
}

fn contains_rsa_patterns(data: &[u8]) -> bool {
    // Look for large sequences of high-entropy data (potential RSA keys)
    let text = String::from_utf8_lossy(data);
    text.contains("BEGIN RSA") || text.contains("ssh-rsa") || 
    text.contains("MIIEv") // Common RSA key prefix in base64
}

fn contains_chacha_constants(data: &[u8]) -> bool {
    // ChaCha20 "expand 32-byte k" constant
    let chacha_const = b"expand 32-byte k";
    find_pattern(data, chacha_const).is_some()
}

fn find_pattern(data: &[u8], pattern: &[u8]) -> Option<usize> {
    data.windows(pattern.len())
        .position(|window| window == pattern)
}

fn find_u32_pattern(data: &[u8], value: u32) -> Option<usize> {
    let bytes = value.to_le_bytes();
    find_pattern(data, &bytes)
        .or_else(|| {
            let bytes = value.to_be_bytes();
            find_pattern(data, &bytes)
        })
}

fn has_aes_key_schedule_pattern(data: &[u8]) -> bool {
    // Look for Rcon values used in AES key expansion
    let rcon_values = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80];
    let mut found_count = 0;
    
    for &rcon in &rcon_values {
        if data.contains(&rcon) {
            found_count += 1;
        }
    }
    
    found_count >= 4
}

fn has_des_key_schedule_pattern(_data: &[u8]) -> bool {
    // Simplified check - would need more complex pattern matching
    false
}

fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    
    let mut freq = [0u64; 256];
    for &byte in data {
        freq[byte as usize] += 1;
    }
    
    let len = data.len() as f64;
    let mut entropy = 0.0;
    
    for &count in &freq {
        if count > 0 {
            let p = count as f64 / len;
            entropy -= p * p.log2();
        }
    }
    
    entropy
}

#[wasm_bindgen]
pub fn get_version() -> String {
    "1.0.0".to_string()
}