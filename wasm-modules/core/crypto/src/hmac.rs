use wasm_bindgen::prelude::*;
use hmac::{Hmac, Mac};
use sha2::{Sha256, Sha512, Sha384};
use rand::{thread_rng, RngCore};
use hex;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[wasm_bindgen]
pub struct HmacModule;

#[wasm_bindgen]
impl HmacModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> HmacModule {
        HmacModule
    }
    
    #[wasm_bindgen]
    pub fn hmac_sha256(&self, key: &[u8], data: &[u8]) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(key)
            .expect("HMAC can take key of any size");
        mac.update(data);
        let result = mac.finalize();
        hex::encode(result.into_bytes())
    }
    
    #[wasm_bindgen]
    pub fn hmac_sha256_base64(&self, key: &[u8], data: &[u8]) -> String {
        let mut mac = Hmac::<Sha256>::new_from_slice(key)
            .expect("HMAC can take key of any size");
        mac.update(data);
        let result = mac.finalize();
        BASE64.encode(result.into_bytes())
    }
    
    #[wasm_bindgen]
    pub fn hmac_sha512(&self, key: &[u8], data: &[u8]) -> String {
        let mut mac = Hmac::<Sha512>::new_from_slice(key)
            .expect("HMAC can take key of any size");
        mac.update(data);
        let result = mac.finalize();
        hex::encode(result.into_bytes())
    }
    
    #[wasm_bindgen]
    pub fn hmac_sha384(&self, key: &[u8], data: &[u8]) -> String {
        let mut mac = Hmac::<Sha384>::new_from_slice(key)
            .expect("HMAC can take key of any size");
        mac.update(data);
        let result = mac.finalize();
        hex::encode(result.into_bytes())
    }
    
    #[wasm_bindgen]
    pub fn verify_hmac(&self, algorithm: &str, key: &[u8], data: &[u8], expected_hex: &str) -> bool {
        let expected_bytes = match hex::decode(expected_hex) {
            Ok(bytes) => bytes,
            Err(_) => return false,
        };
        
        let computed = match algorithm {
            "hmac-sha256" => {
                let mac = Hmac::<Sha256>::new_from_slice(key).ok();
                mac.map(|mut m| {
                    m.update(data);
                    m.finalize().into_bytes().to_vec()
                })
            },
            "hmac-sha512" => {
                let mac = Hmac::<Sha512>::new_from_slice(key).ok();
                mac.map(|mut m| {
                    m.update(data);
                    m.finalize().into_bytes().to_vec()
                })
            },
            "hmac-sha384" => {
                let mac = Hmac::<Sha384>::new_from_slice(key).ok();
                mac.map(|mut m| {
                    m.update(data);
                    m.finalize().into_bytes().to_vec()
                })
            },
            _ => None,
        };
        
        match computed {
            Some(bytes) => bytes == expected_bytes,
            None => false,
        }
    }
    
    #[wasm_bindgen]
    pub fn generate_hmac_key(&self, algorithm: &str) -> Result<Vec<u8>, JsValue> {
        let key_len = match algorithm {
            "hmac-sha256" => 32,
            "hmac-sha512" => 64,
            "hmac-sha384" => 48,
            _ => return Err(JsValue::from_str("Unsupported algorithm")),
        };
        
        let mut key = vec![0u8; key_len];
        thread_rng().fill_bytes(&mut key);
        Ok(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_hmac_sha256() {
        let hmac_module = HmacModule::new();
        let key = b"secret_key";
        let data = b"hello world";
        let hmac = hmac_module.hmac_sha256(key, data);
        assert_eq!(hmac.len(), 64); // SHA256 HMAC produces 32 bytes = 64 hex chars
    }
    
    #[test]
    fn test_verify_hmac() {
        let hmac_module = HmacModule::new();
        let key = b"secret_key";
        let data = b"hello world";
        let hmac = hmac_module.hmac_sha256(key, data);
        assert!(hmac_module.verify_hmac("hmac-sha256", key, data, &hmac));
    }
    
    #[test]
    fn test_generate_key() {
        let hmac_module = HmacModule::new();
        let key = hmac_module.generate_hmac_key("hmac-sha256").unwrap();
        assert_eq!(key.len(), 32);
    }
}