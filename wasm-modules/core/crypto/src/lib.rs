use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

pub mod hash;
pub mod hmac;
pub mod aes;
pub mod rsa;
pub mod utils;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Serialize, Deserialize)]
pub struct CryptoResult {
    pub success: bool,
    pub data: Option<String>,
    pub error: Option<String>,
}

#[wasm_bindgen]
pub struct CryptoModule {
    initialized: bool,
}

#[wasm_bindgen]
impl CryptoModule {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<CryptoModule, JsValue> {
        console_log!("Initializing WASM Crypto Module");
        
        Ok(CryptoModule {
            initialized: true,
        })
    }
    
    #[wasm_bindgen]
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }
    
    #[wasm_bindgen]
    pub fn get_version(&self) -> String {
        "1.0.0".to_string()
    }
    
    #[wasm_bindgen]
    pub fn get_capabilities(&self) -> String {
        serde_json::json!({
            "hash": ["sha256", "sha512", "sha384", "sha1", "md5", "blake3"],
            "hmac": ["hmac-sha256", "hmac-sha512"],
            "symmetric": ["aes-128-gcm", "aes-256-gcm"],
            "asymmetric": ["rsa-2048", "rsa-4096"],
            "kdf": ["pbkdf2"],
            "random": ["secure-random"]
        }).to_string()
    }
}

#[wasm_bindgen]
pub fn init_crypto_module() -> Result<(), JsValue> {
    console_log!("WASM Crypto Module loaded successfully");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_creation() {
        let module = CryptoModule::new().unwrap();
        assert!(module.is_initialized());
    }
}
