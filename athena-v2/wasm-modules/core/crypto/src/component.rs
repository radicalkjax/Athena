// Component Model implementation for athena:crypto

wit_bindgen::generate!({
    world: "crypto-component",
    path: "wit",
});

use sha2::{Sha256, Sha512, Sha384, Digest};
use sha1::Sha1;
use md5::Md5;
use hmac::{Hmac, Mac};
use aes_gcm::{
    aead::{Aead, KeyInit as AeadKeyInit},
    Aes128Gcm, Aes256Gcm, Nonce,
};
use rsa::{RsaPrivateKey, RsaPublicKey, Pkcs1v15Sign};
use rsa::pkcs8::{EncodePrivateKey, EncodePublicKey, DecodePrivateKey, DecodePublicKey};
use pbkdf2::pbkdf2_hmac;
use rand::{rngs::OsRng, RngCore};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

const AES_128_KEY_LEN: usize = 16;
const AES_256_KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;
const SALT_LEN: usize = 16;
const PBKDF2_ITERATIONS: u32 = 600_000;

// ============================================================================
// Component struct - implements all interfaces
// ============================================================================

struct Component;

// ============================================================================
// Hash Interface Implementation
// ============================================================================

impl exports::athena::crypto::hash::Guest for Component {
    fn sha256(data: Vec<u8>) -> String {
        let mut hasher = Sha256::new();
        hasher.update(&data);
        hex::encode(hasher.finalize())
    }

    fn sha256_base64(data: Vec<u8>) -> String {
        let mut hasher = Sha256::new();
        hasher.update(&data);
        BASE64.encode(hasher.finalize())
    }

    fn sha512(data: Vec<u8>) -> String {
        let mut hasher = Sha512::new();
        hasher.update(&data);
        hex::encode(hasher.finalize())
    }

    fn sha384(data: Vec<u8>) -> String {
        let mut hasher = Sha384::new();
        hasher.update(&data);
        hex::encode(hasher.finalize())
    }

    fn sha1(data: Vec<u8>) -> String {
        let mut hasher = Sha1::new();
        hasher.update(&data);
        hex::encode(hasher.finalize())
    }

    fn md5(data: Vec<u8>) -> String {
        let digest = Md5::digest(&data);
        hex::encode(digest)
    }
}

// ============================================================================
// HMAC Interface Implementation
// ============================================================================

impl exports::athena::crypto::hmac::Guest for Component {
    fn hmac_sha256(key: Vec<u8>, data: Vec<u8>) -> String {
        let mut mac = <Hmac::<Sha256> as Mac>::new_from_slice(&key)
            .expect("HMAC can take key of any size");
        mac.update(&data);
        hex::encode(mac.finalize().into_bytes())
    }

    fn hmac_sha256_base64(key: Vec<u8>, data: Vec<u8>) -> String {
        let mut mac = <Hmac::<Sha256> as Mac>::new_from_slice(&key)
            .expect("HMAC can take key of any size");
        mac.update(&data);
        BASE64.encode(mac.finalize().into_bytes())
    }

    fn hmac_sha512(key: Vec<u8>, data: Vec<u8>) -> String {
        let mut mac = <Hmac::<Sha512> as Mac>::new_from_slice(&key)
            .expect("HMAC can take key of any size");
        mac.update(&data);
        hex::encode(mac.finalize().into_bytes())
    }

    fn hmac_sha384(key: Vec<u8>, data: Vec<u8>) -> String {
        let mut mac = <Hmac::<Sha384> as Mac>::new_from_slice(&key)
            .expect("HMAC can take key of any size");
        mac.update(&data);
        hex::encode(mac.finalize().into_bytes())
    }

    fn verify_hmac(key: Vec<u8>, data: Vec<u8>, expected_hmac: String) -> bool {
        let computed = Self::hmac_sha256(key, data);
        constant_time_compare(&computed.as_bytes(), &expected_hmac.as_bytes())
    }

    fn generate_hmac_key(length: u32) -> Vec<u8> {
        let mut key = vec![0u8; length as usize];
        OsRng.fill_bytes(&mut key);
        key
    }
}

// ============================================================================
// AES Interface Implementation
// ============================================================================

impl exports::athena::crypto::aes::Guest for Component {
    fn encrypt_aes128_gcm(key: Vec<u8>, plaintext: Vec<u8>) -> Result<String, String> {
        if key.len() != AES_128_KEY_LEN {
            return Err("Invalid key length for AES-128 (expected 16 bytes)".to_string());
        }

        let key_array = aes_gcm::Key::<Aes128Gcm>::from_slice(&key);
        let cipher = <Aes128Gcm as AeadKeyInit>::new(key_array);

        let mut nonce_bytes = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_ref())
            .map_err(|_| "Encryption failed".to_string())?;

        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(BASE64.encode(&result))
    }

    fn decrypt_aes128_gcm(key: Vec<u8>, ciphertext_base64: String) -> Result<Vec<u8>, String> {
        if key.len() != AES_128_KEY_LEN {
            return Err("Invalid key length for AES-128 (expected 16 bytes)".to_string());
        }

        let key_array = aes_gcm::Key::<Aes128Gcm>::from_slice(&key);
        let cipher = <Aes128Gcm as AeadKeyInit>::new(key_array);

        let data = BASE64
            .decode(ciphertext_base64)
            .map_err(|_| "Invalid base64".to_string())?;

        if data.len() < NONCE_LEN {
            return Err("Ciphertext too short".to_string());
        }

        let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
        let nonce = Nonce::from_slice(nonce_bytes);

        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed".to_string())
    }

    fn encrypt_aes256_gcm(key: Vec<u8>, plaintext: Vec<u8>) -> Result<String, String> {
        if key.len() != AES_256_KEY_LEN {
            return Err("Invalid key length for AES-256 (expected 32 bytes)".to_string());
        }

        let key_array = aes_gcm::Key::<Aes256Gcm>::from_slice(&key);
        let cipher = <Aes256Gcm as AeadKeyInit>::new(key_array);

        let mut nonce_bytes = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_ref())
            .map_err(|_| "Encryption failed".to_string())?;

        let mut result = nonce_bytes.to_vec();
        result.extend_from_slice(&ciphertext);

        Ok(BASE64.encode(&result))
    }

    fn decrypt_aes256_gcm(key: Vec<u8>, ciphertext_base64: String) -> Result<Vec<u8>, String> {
        if key.len() != AES_256_KEY_LEN {
            return Err("Invalid key length for AES-256 (expected 32 bytes)".to_string());
        }

        let key_array = aes_gcm::Key::<Aes256Gcm>::from_slice(&key);
        let cipher = <Aes256Gcm as AeadKeyInit>::new(key_array);

        let data = BASE64
            .decode(ciphertext_base64)
            .map_err(|_| "Invalid base64".to_string())?;

        if data.len() < NONCE_LEN {
            return Err("Ciphertext too short".to_string());
        }

        let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
        let nonce = Nonce::from_slice(nonce_bytes);

        cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed".to_string())
    }

    fn derive_key_from_password(
        password: String,
        salt: Vec<u8>,
        key_length: u32,
    ) -> Result<Vec<u8>, String> {
        if salt.len() < SALT_LEN {
            return Err("Salt too short (minimum 16 bytes)".to_string());
        }

        let mut key = vec![0u8; key_length as usize];
        pbkdf2_hmac::<Sha256>(
            password.as_bytes(),
            &salt,
            PBKDF2_ITERATIONS,
            &mut key,
        );

        Ok(key)
    }

    fn generate_aes_key(key_length: u32) -> Result<Vec<u8>, String> {
        if key_length != 16 && key_length != 32 {
            return Err("Invalid key length (use 16 for AES-128 or 32 for AES-256)".to_string());
        }

        let mut key = vec![0u8; key_length as usize];
        OsRng.fill_bytes(&mut key);
        Ok(key)
    }
}

// ============================================================================
// RSA Interface Implementation
// ============================================================================

impl exports::athena::crypto::rsa::Guest for Component {
    fn generate_key_pair(key_size: u32) -> Result<exports::athena::crypto::rsa::KeyPair, String> {
        let bits = match key_size {
            2048 | 4096 => key_size as usize,
            _ => return Err("Invalid key size (use 2048 or 4096)".to_string()),
        };

        let mut rng = rand::thread_rng();
        let private_key = RsaPrivateKey::new(&mut rng, bits)
            .map_err(|e| format!("Failed to generate RSA key pair: {}", e))?;

        let public_key = RsaPublicKey::from(&private_key);

        let private_key_der = private_key
            .to_pkcs8_der()
            .map_err(|e| format!("Failed to encode private key: {}", e))?;

        let public_key_der = public_key
            .to_public_key_der()
            .map_err(|e| format!("Failed to encode public key: {}", e))?;

        Ok(exports::athena::crypto::rsa::KeyPair {
            private_key: private_key_der.as_bytes().to_vec(),
            public_key: public_key_der.as_bytes().to_vec(),
        })
    }

    fn sign_sha256(private_key_der: Vec<u8>, message: Vec<u8>) -> Result<String, String> {
        let private_key = RsaPrivateKey::from_pkcs8_der(&private_key_der)
            .map_err(|e| format!("Failed to decode private key: {}", e))?;

        let mut hasher = Sha256::new();
        hasher.update(&message);
        let hashed = hasher.finalize();

        let signature = private_key
            .sign(Pkcs1v15Sign::new::<Sha256>(), &hashed)
            .map_err(|e| format!("Signing failed: {}", e))?;

        Ok(BASE64.encode(&signature))
    }

    fn sign_sha512(private_key_der: Vec<u8>, message: Vec<u8>) -> Result<String, String> {
        let private_key = RsaPrivateKey::from_pkcs8_der(&private_key_der)
            .map_err(|e| format!("Failed to decode private key: {}", e))?;

        let mut hasher = Sha512::new();
        hasher.update(&message);
        let hashed = hasher.finalize();

        let signature = private_key
            .sign(Pkcs1v15Sign::new::<Sha512>(), &hashed)
            .map_err(|e| format!("Signing failed: {}", e))?;

        Ok(BASE64.encode(&signature))
    }

    fn verify_sha256(
        public_key_der: Vec<u8>,
        message: Vec<u8>,
        signature_base64: String,
    ) -> Result<bool, String> {
        let public_key = RsaPublicKey::from_public_key_der(&public_key_der)
            .map_err(|e| format!("Failed to decode public key: {}", e))?;

        let signature = BASE64
            .decode(signature_base64)
            .map_err(|_| "Invalid base64 signature".to_string())?;

        let mut hasher = Sha256::new();
        hasher.update(&message);
        let hashed = hasher.finalize();

        match public_key.verify(Pkcs1v15Sign::new::<Sha256>(), &hashed, &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    fn verify_sha512(
        public_key_der: Vec<u8>,
        message: Vec<u8>,
        signature_base64: String,
    ) -> Result<bool, String> {
        let public_key = RsaPublicKey::from_public_key_der(&public_key_der)
            .map_err(|e| format!("Failed to decode public key: {}", e))?;

        let signature = BASE64
            .decode(signature_base64)
            .map_err(|_| "Invalid base64 signature".to_string())?;

        let mut hasher = Sha512::new();
        hasher.update(&message);
        let hashed = hasher.finalize();

        match public_key.verify(Pkcs1v15Sign::new::<Sha512>(), &hashed, &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

// ============================================================================
// Utils Interface Implementation
// ============================================================================

impl exports::athena::crypto::utils::Guest for Component {
    fn generate_random_bytes(length: u32) -> Result<Vec<u8>, String> {
        let mut bytes = vec![0u8; length as usize];
        OsRng.fill_bytes(&mut bytes);
        Ok(bytes)
    }

    fn generate_random_hex(length: u32) -> Result<String, String> {
        let bytes = Self::generate_random_bytes(length)?;
        Ok(hex::encode(bytes))
    }

    fn generate_random_base64(length: u32) -> Result<String, String> {
        let bytes = Self::generate_random_bytes(length)?;
        Ok(BASE64.encode(bytes))
    }

    fn constant_time_compare(a: Vec<u8>, b: Vec<u8>) -> bool {
        constant_time_compare(&a, &b)
    }

    fn hex_to_bytes(hex_string: String) -> Result<Vec<u8>, String> {
        hex::decode(hex_string).map_err(|e| format!("Invalid hex: {}", e))
    }

    fn bytes_to_hex(bytes: Vec<u8>) -> String {
        hex::encode(bytes)
    }

    fn base64_encode(data: Vec<u8>) -> String {
        BASE64.encode(data)
    }

    fn base64_decode(encoded: String) -> Result<Vec<u8>, String> {
        BASE64
            .decode(encoded)
            .map_err(|e| format!("Invalid base64: {}", e))
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Constant-time comparison to prevent timing attacks
fn constant_time_compare(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut result = 0u8;
    for i in 0..a.len() {
        result |= a[i] ^ b[i];
    }

    result == 0
}

// ============================================================================
// Export Component Implementations
// ============================================================================

export!(Component);
