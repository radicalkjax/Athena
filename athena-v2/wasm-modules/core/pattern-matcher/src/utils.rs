// Utility functions for pattern matching

pub fn calculate_entropy(data: &[u8]) -> f32 {
    if data.is_empty() {
        return 0.0;
    }
    
    let mut byte_counts = [0u32; 256];
    for &byte in data {
        byte_counts[byte as usize] += 1;
    }
    
    let len = data.len() as f32;
    let mut entropy = 0.0;
    
    for count in byte_counts.iter() {
        if *count > 0 {
            let p = *count as f32 / len;
            entropy -= p * p.log2();
        }
    }
    
    entropy
}

pub fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    let hex = hex.trim();
    if hex.len() % 2 != 0 {
        return Err("Hex string must have even length".to_string());
    }
    
    (0..hex.len())
        .step_by(2)
        .map(|i| {
            u8::from_str_radix(&hex[i..i + 2], 16)
                .map_err(|_| format!("Invalid hex byte at position {}", i))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_entropy_calculation() {
        // All same bytes = 0 entropy
        let data = vec![0x41; 100];
        assert_eq!(calculate_entropy(&data), 0.0);
        
        // Random data should have high entropy
        let data: Vec<u8> = (0..256).map(|i| i as u8).collect();
        let entropy = calculate_entropy(&data);
        assert!(entropy > 7.0); // Should be close to 8.0
    }
    
    #[test]
    fn test_hex_to_bytes() {
        assert_eq!(hex_to_bytes("4142").unwrap(), vec![0x41, 0x42]);
        assert_eq!(hex_to_bytes("deadbeef").unwrap(), vec![0xde, 0xad, 0xbe, 0xef]);
        assert!(hex_to_bytes("41G").is_err());
        assert!(hex_to_bytes("123").is_err());
    }
}