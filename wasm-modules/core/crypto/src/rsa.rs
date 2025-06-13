use wasm_bindgen::prelude::*;
use rsa::{RsaPrivateKey, RsaPublicKey, Pkcs1v15Sign};
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, DecodePrivateKey, DecodePublicKey};
use sha2::{Sha256, Sha512, Digest};
use rand::thread_rng;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[wasm_bindgen]
pub struct RsaModule;

#[wasm_bindgen]
pub struct RsaKeyPairWrapper {
    private_key: Vec<u8>,
    public_key: Vec<u8>,
}

#[wasm_bindgen]
impl RsaModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> RsaModule {
        RsaModule
    }
    
    #[wasm_bindgen]
    pub fn generate_key_pair(&self, key_size: u32) -> Result<RsaKeyPairWrapper, JsValue> {
        let bits = match key_size {
            2048 | 4096 => key_size as usize,
            _ => return Err(JsValue::from_str("Invalid key size. Use 2048 or 4096")),
        };
        
        let mut rng = thread_rng();
        let private_key = RsaPrivateKey::new(&mut rng, bits)
            .map_err(|_| JsValue::from_str("Failed to generate RSA key pair"))?;
        
        let public_key = RsaPublicKey::from(&private_key);
        
        let private_key_der = private_key.to_pkcs8_der()
            .map_err(|_| JsValue::from_str("Failed to encode private key"))?;
        
        let public_key_der = public_key.to_public_key_der()
            .map_err(|_| JsValue::from_str("Failed to encode public key"))?;
        
        Ok(RsaKeyPairWrapper {
            private_key: private_key_der.as_bytes().to_vec(),
            public_key: public_key_der.as_bytes().to_vec(),
        })
    }
    
    #[wasm_bindgen]
    pub fn sign_sha256(&self, private_key_der: &[u8], message: &[u8]) -> Result<String, JsValue> {
        let private_key = RsaPrivateKey::from_pkcs8_der(private_key_der)
            .map_err(|_| JsValue::from_str("Invalid private key"))?;
        
        let padding = Pkcs1v15Sign::new_unprefixed();
        let digest = Sha256::digest(message);
        
        let signature = private_key.sign(padding, &digest)
            .map_err(|_| JsValue::from_str("Signing failed"))?;
        
        Ok(BASE64.encode(&signature))
    }
    
    #[wasm_bindgen]
    pub fn sign_sha512(&self, private_key_der: &[u8], message: &[u8]) -> Result<String, JsValue> {
        let private_key = RsaPrivateKey::from_pkcs8_der(private_key_der)
            .map_err(|_| JsValue::from_str("Invalid private key"))?;
        
        let padding = Pkcs1v15Sign::new_unprefixed();
        let digest = Sha512::digest(message);
        
        let signature = private_key.sign(padding, &digest)
            .map_err(|_| JsValue::from_str("Signing failed"))?;
        
        Ok(BASE64.encode(&signature))
    }
    
    #[wasm_bindgen]
    pub fn verify_sha256(&self, public_key_der: &[u8], message: &[u8], signature_base64: &str) -> Result<bool, JsValue> {
        let signature = BASE64.decode(signature_base64)
            .map_err(|_| JsValue::from_str("Invalid base64 signature"))?;
        
        let public_key = RsaPublicKey::from_public_key_der(public_key_der)
            .map_err(|_| JsValue::from_str("Invalid public key"))?;
        
        let padding = Pkcs1v15Sign::new_unprefixed();
        let digest = Sha256::digest(message);
        
        match public_key.verify(padding, &digest, &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
    
    #[wasm_bindgen]
    pub fn verify_sha512(&self, public_key_der: &[u8], message: &[u8], signature_base64: &str) -> Result<bool, JsValue> {
        let signature = BASE64.decode(signature_base64)
            .map_err(|_| JsValue::from_str("Invalid base64 signature"))?;
        
        let public_key = RsaPublicKey::from_public_key_der(public_key_der)
            .map_err(|_| JsValue::from_str("Invalid public key"))?;
        
        let padding = Pkcs1v15Sign::new_unprefixed();
        let digest = Sha512::digest(message);
        
        match public_key.verify(padding, &digest, &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

#[wasm_bindgen]
impl RsaKeyPairWrapper {
    #[wasm_bindgen(getter)]
    pub fn public_key(&self) -> Vec<u8> {
        self.public_key.clone()
    }
    
    #[wasm_bindgen(getter)]
    pub fn private_key(&self) -> Vec<u8> {
        self.private_key.clone()
    }
    
    #[wasm_bindgen]
    pub fn public_key_base64(&self) -> String {
        BASE64.encode(&self.public_key)
    }
    
    #[wasm_bindgen]
    pub fn private_key_base64(&self) -> String {
        BASE64.encode(&self.private_key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_rsa_module_creation() {
        let _rsa = RsaModule::new();
    }
    
    #[test]
    fn test_generate_key_pair() {
        let rsa = RsaModule::new();
        let key_pair = rsa.generate_key_pair(2048).unwrap();
        
        assert!(!key_pair.public_key.is_empty());
        assert!(!key_pair.private_key.is_empty());
    }
    
    #[test]
    fn test_sign_verify_sha256() {
        let rsa = RsaModule::new();
        let key_pair = rsa.generate_key_pair(2048).unwrap();
        let message = b"Test message";
        
        let signature = rsa.sign_sha256(&key_pair.private_key, message).unwrap();
        let valid = rsa.verify_sha256(&key_pair.public_key, message, &signature).unwrap();
        
        assert!(valid);
    }
}