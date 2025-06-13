use wasm_bindgen::prelude::*;
use rand::{rngs::OsRng, RngCore};
use zeroize::Zeroize;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use hex;

#[wasm_bindgen]
pub struct CryptoUtils;

#[wasm_bindgen]
impl CryptoUtils {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CryptoUtils {
        CryptoUtils
    }
    
    #[wasm_bindgen]
    pub fn generate_random_bytes(&self, length: usize) -> Result<Vec<u8>, JsValue> {
        let mut bytes = vec![0u8; length];
        OsRng.fill_bytes(&mut bytes);
        Ok(bytes)
    }
    
    #[wasm_bindgen]
    pub fn generate_random_hex(&self, length: usize) -> Result<String, JsValue> {
        let bytes = self.generate_random_bytes(length)?;
        Ok(hex::encode(bytes))
    }
    
    #[wasm_bindgen]
    pub fn generate_random_base64(&self, length: usize) -> Result<String, JsValue> {
        let bytes = self.generate_random_bytes(length)?;
        Ok(BASE64.encode(bytes))
    }
    
    #[wasm_bindgen]
    pub fn constant_time_compare(&self, a: &[u8], b: &[u8]) -> bool {
        if a.len() != b.len() {
            return false;
        }
        
        let mut result = 0u8;
        for i in 0..a.len() {
            result |= a[i] ^ b[i];
        }
        
        result == 0
    }
    
    #[wasm_bindgen]
    pub fn secure_wipe(&self, data: &mut [u8]) {
        // Use volatile writes to prevent optimization
        unsafe {
            std::ptr::write_volatile(data.as_mut_ptr(), 0);
            for i in 0..data.len() {
                std::ptr::write_volatile(data.as_mut_ptr().add(i), 0);
            }
        }
        
        std::sync::atomic::compiler_fence(std::sync::atomic::Ordering::SeqCst);
    }
    
    #[wasm_bindgen]
    pub fn hex_to_bytes(&self, hex_string: &str) -> Result<Vec<u8>, JsValue> {
        hex::decode(hex_string)
            .map_err(|_| JsValue::from_str("Invalid hex string"))
    }
    
    #[wasm_bindgen]
    pub fn bytes_to_hex(&self, bytes: &[u8]) -> String {
        hex::encode(bytes)
    }
    
    #[wasm_bindgen]
    pub fn base64_to_bytes(&self, base64_string: &str) -> Result<Vec<u8>, JsValue> {
        BASE64.decode(base64_string)
            .map_err(|_| JsValue::from_str("Invalid base64 string"))
    }
    
    #[wasm_bindgen]
    pub fn bytes_to_base64(&self, bytes: &[u8]) -> String {
        BASE64.encode(bytes)
    }
    
    #[wasm_bindgen]
    pub fn calculate_entropy(&self, data: &[u8]) -> f64 {
        if data.is_empty() {
            return 0.0;
        }
        
        let mut frequency = [0u32; 256];
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
}

pub fn zeroize_on_drop<T: Zeroize>(mut data: Vec<T>) {
    data.zeroize();
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_random_generation() {
        let utils = CryptoUtils::new();
        
        let bytes1 = utils.generate_random_bytes(32).unwrap();
        let bytes2 = utils.generate_random_bytes(32).unwrap();
        
        assert_eq!(bytes1.len(), 32);
        assert_eq!(bytes2.len(), 32);
        assert_ne!(bytes1, bytes2);
    }
    
    #[test]
    fn test_constant_time_compare() {
        let utils = CryptoUtils::new();
        
        let a = vec![1, 2, 3, 4, 5];
        let b = vec![1, 2, 3, 4, 5];
        let c = vec![1, 2, 3, 4, 6];
        
        assert!(utils.constant_time_compare(&a, &b));
        assert!(!utils.constant_time_compare(&a, &c));
    }
    
    #[test]
    fn test_entropy_calculation() {
        let utils = CryptoUtils::new();
        
        let low_entropy = vec![0u8; 100];
        let high_entropy = utils.generate_random_bytes(100).unwrap();
        
        let low = utils.calculate_entropy(&low_entropy);
        let high = utils.calculate_entropy(&high_entropy);
        
        assert_eq!(low, 0.0);
        assert!(high > 5.0); // Random data should have high entropy
    }
    
    #[test]
    fn test_encoding_conversions() {
        let utils = CryptoUtils::new();
        let data = vec![1, 2, 3, 4, 5];
        
        let hex = utils.bytes_to_hex(&data);
        let decoded_hex = utils.hex_to_bytes(&hex).unwrap();
        assert_eq!(data, decoded_hex);
        
        let base64 = utils.bytes_to_base64(&data);
        let decoded_base64 = utils.base64_to_bytes(&base64).unwrap();
        assert_eq!(data, decoded_base64);
    }
}