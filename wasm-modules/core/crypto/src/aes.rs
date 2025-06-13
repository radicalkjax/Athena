use wasm_bindgen::prelude::*;
use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes128Gcm, Aes256Gcm, Key, Nonce
};
use pbkdf2::pbkdf2_hmac;
use sha2::Sha256;
use rand::{rngs::OsRng, RngCore};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

const AES_128_KEY_LEN: usize = 16;
const AES_256_KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const SALT_LEN: usize = 16;
const PBKDF2_ITERATIONS: u32 = 600_000; // OWASP 2023 recommendation

#[wasm_bindgen]
pub struct AesModule;

#[wasm_bindgen]
impl AesModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> AesModule {
        AesModule
    }
    
    #[wasm_bindgen]
    pub fn encrypt_aes_128_gcm(&self, key: &[u8], plaintext: &[u8]) -> Result<String, JsValue> {
        if key.len() != AES_128_KEY_LEN {
            return Err(JsValue::from_str("Invalid key length for AES-128"));
        }
        
        let key = Key::<Aes128Gcm>::from_slice(key);
        let cipher = Aes128Gcm::new(key);
        
        let mut nonce_bytes = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher.encrypt(nonce, plaintext)
            .map_err(|_| JsValue::from_str("Encryption failed"))?;
        
        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);
        
        Ok(BASE64.encode(&result))
    }
    
    #[wasm_bindgen]
    pub fn decrypt_aes_128_gcm(&self, key: &[u8], ciphertext_base64: &str) -> Result<Vec<u8>, JsValue> {
        if key.len() != AES_128_KEY_LEN {
            return Err(JsValue::from_str("Invalid key length for AES-128"));
        }
        
        let data = BASE64.decode(ciphertext_base64)
            .map_err(|_| JsValue::from_str("Invalid base64 encoding"))?;
        
        if data.len() < NONCE_LEN {
            return Err(JsValue::from_str("Invalid ciphertext length"));
        }
        
        let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        let key = Key::<Aes128Gcm>::from_slice(key);
        let cipher = Aes128Gcm::new(key);
        
        cipher.decrypt(nonce, ciphertext)
            .map_err(|_| JsValue::from_str("Decryption failed"))
    }
    
    #[wasm_bindgen]
    pub fn encrypt_aes_256_gcm(&self, key: &[u8], plaintext: &[u8]) -> Result<String, JsValue> {
        if key.len() != AES_256_KEY_LEN {
            return Err(JsValue::from_str("Invalid key length for AES-256"));
        }
        
        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);
        
        let mut nonce_bytes = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);
        
        let ciphertext = cipher.encrypt(nonce, plaintext)
            .map_err(|_| JsValue::from_str("Encryption failed"))?;
        
        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);
        
        Ok(BASE64.encode(&result))
    }
    
    #[wasm_bindgen]
    pub fn decrypt_aes_256_gcm(&self, key: &[u8], ciphertext_base64: &str) -> Result<Vec<u8>, JsValue> {
        if key.len() != AES_256_KEY_LEN {
            return Err(JsValue::from_str("Invalid key length for AES-256"));
        }
        
        let data = BASE64.decode(ciphertext_base64)
            .map_err(|_| JsValue::from_str("Invalid base64 encoding"))?;
        
        if data.len() < NONCE_LEN {
            return Err(JsValue::from_str("Invalid ciphertext length"));
        }
        
        let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
        let nonce = Nonce::from_slice(nonce_bytes);
        
        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);
        
        cipher.decrypt(nonce, ciphertext)
            .map_err(|_| JsValue::from_str("Decryption failed"))
    }
    
    #[wasm_bindgen]
    pub fn generate_key(&self, key_size: u32) -> Result<Vec<u8>, JsValue> {
        let key_len = match key_size {
            128 => AES_128_KEY_LEN,
            256 => AES_256_KEY_LEN,
            _ => return Err(JsValue::from_str("Invalid key size. Use 128 or 256")),
        };
        
        let mut key = vec![0u8; key_len];
        OsRng.fill_bytes(&mut key);
        Ok(key)
    }
    
    #[wasm_bindgen]
    pub fn derive_key_from_password(&self, password: &str, salt: Option<Vec<u8>>, key_size: u32) -> Result<Vec<u8>, JsValue> {
        let key_len = match key_size {
            128 => AES_128_KEY_LEN,
            256 => AES_256_KEY_LEN,
            _ => return Err(JsValue::from_str("Invalid key size. Use 128 or 256")),
        };
        
        let salt = match salt {
            Some(s) => s,
            None => {
                let mut s = vec![0u8; SALT_LEN];
                OsRng.fill_bytes(&mut s);
                s
            }
        };
        
        let mut key = vec![0u8; key_len];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);
        
        Ok(key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_aes_128_encrypt_decrypt() {
        let aes = AesModule::new();
        let key = aes.generate_key(128).unwrap();
        let plaintext = b"Hello, World!";
        
        let ciphertext = aes.encrypt_aes_128_gcm(&key, plaintext).unwrap();
        let decrypted = aes.decrypt_aes_128_gcm(&key, &ciphertext).unwrap();
        
        assert_eq!(plaintext, &decrypted[..]);
    }
    
    #[test]
    fn test_aes_256_encrypt_decrypt() {
        let aes = AesModule::new();
        let key = aes.generate_key(256).unwrap();
        let plaintext = b"Secret message";
        
        let ciphertext = aes.encrypt_aes_256_gcm(&key, plaintext).unwrap();
        let decrypted = aes.decrypt_aes_256_gcm(&key, &ciphertext).unwrap();
        
        assert_eq!(plaintext, &decrypted[..]);
    }
    
    #[test]
    fn test_key_derivation() {
        let aes = AesModule::new();
        let password = "strong_password";
        let salt = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
        
        let key1 = aes.derive_key_from_password(password, Some(salt.clone()), 256).unwrap();
        let key2 = aes.derive_key_from_password(password, Some(salt), 256).unwrap();
        
        assert_eq!(key1, key2);
        assert_eq!(key1.len(), 32);
    }
}