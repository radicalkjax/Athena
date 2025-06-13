use wasm_bindgen::prelude::*;
use sha2::{Sha256, Sha512, Sha384, Digest};
use sha1::Sha1;
use md5::Md5;
use hex;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[wasm_bindgen]
pub struct HashModule;

#[wasm_bindgen]
impl HashModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> HashModule {
        HashModule
    }
    
    #[wasm_bindgen]
    pub fn sha256(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        hex::encode(result)
    }
    
    #[wasm_bindgen]
    pub fn sha256_base64(&self, data: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        BASE64.encode(result)
    }
    
    #[wasm_bindgen]
    pub fn sha512(&self, data: &[u8]) -> String {
        let mut hasher = Sha512::new();
        hasher.update(data);
        let result = hasher.finalize();
        hex::encode(result)
    }
    
    #[wasm_bindgen]
    pub fn sha384(&self, data: &[u8]) -> String {
        let mut hasher = Sha384::new();
        hasher.update(data);
        let result = hasher.finalize();
        hex::encode(result)
    }
    
    #[wasm_bindgen]
    pub fn sha1(&self, data: &[u8]) -> String {
        let mut hasher = Sha1::new();
        hasher.update(data);
        let result = hasher.finalize();
        hex::encode(result)
    }
    
    #[wasm_bindgen]
    pub fn md5(&self, data: &[u8]) -> String {
        let mut hasher = Md5::new();
        hasher.update(data);
        let result = hasher.finalize();
        hex::encode(result)
    }
    
    #[wasm_bindgen]
    pub fn verify_hash(&self, algorithm: &str, data: &[u8], expected_hex: &str) -> bool {
        let computed = match algorithm {
            "sha256" => self.sha256(data),
            "sha512" => self.sha512(data),
            "sha384" => self.sha384(data),
            "sha1" => self.sha1(data),
            "md5" => self.md5(data),
            _ => return false,
        };
        
        computed.eq_ignore_ascii_case(expected_hex)
    }
    
    #[wasm_bindgen]
    pub fn hash_file_chunks(&self, algorithm: &str, chunks_json: &str) -> Result<String, JsValue> {
        let chunks: Vec<Vec<u8>> = serde_json::from_str(chunks_json)
            .map_err(|_| JsValue::from_str("Invalid chunks JSON"))?;
        
        match algorithm {
            "sha256" => {
                let mut hasher = Sha256::new();
                for chunk in chunks {
                    hasher.update(&chunk);
                }
                Ok(hex::encode(hasher.finalize()))
            },
            "sha512" => {
                let mut hasher = Sha512::new();
                for chunk in chunks {
                    hasher.update(&chunk);
                }
                Ok(hex::encode(hasher.finalize()))
            },
            "sha384" => {
                let mut hasher = Sha384::new();
                for chunk in chunks {
                    hasher.update(&chunk);
                }
                Ok(hex::encode(hasher.finalize()))
            },
            "sha1" => {
                let mut hasher = Sha1::new();
                for chunk in chunks {
                    hasher.update(&chunk);
                }
                Ok(hex::encode(hasher.finalize()))
            },
            "md5" => {
                let mut hasher = Md5::new();
                for chunk in chunks {
                    hasher.update(&chunk);
                }
                Ok(hex::encode(hasher.finalize()))
            },
            _ => Err(JsValue::from_str("Unsupported algorithm")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sha256() {
        let hasher = HashModule::new();
        let data = b"hello world";
        let hash = hasher.sha256(data);
        assert_eq!(hash, "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    }
    
    #[test]
    fn test_sha512() {
        let hasher = HashModule::new();
        let data = b"hello world";
        let hash = hasher.sha512(data);
        assert_eq!(hash.len(), 128); // SHA512 produces 64 bytes = 128 hex chars
    }
    
    #[test]
    fn test_verify_hash() {
        let hasher = HashModule::new();
        let data = b"hello world";
        let expected = "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9";
        assert!(hasher.verify_hash("sha256", data, expected));
    }
}