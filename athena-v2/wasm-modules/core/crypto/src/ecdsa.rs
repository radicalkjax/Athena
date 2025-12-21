/// Elliptic Curve Digital Signature Algorithm (ECDSA) implementation
/// Supports P-256 (NIST P-256, secp256r1) and P-384 (NIST P-384, secp384r1)

use p256::ecdsa::{
    SigningKey as P256SigningKey,
    VerifyingKey as P256VerifyingKey,
    Signature as P256Signature,
    signature::Signer as P256Signer,
    signature::Verifier as P256Verifier,
};
use p384::ecdsa::{
    SigningKey as P384SigningKey,
    VerifyingKey as P384VerifyingKey,
    Signature as P384Signature,
    signature::Signer as P384Signer,
    signature::Verifier as P384Verifier,
};
use p256::pkcs8::{EncodePrivateKey, EncodePublicKey, DecodePrivateKey, DecodePublicKey};
use p384::pkcs8::{EncodePrivateKey as EncodePrivateKeyP384, EncodePublicKey as EncodePublicKeyP384, DecodePrivateKey as DecodePrivateKeyP384, DecodePublicKey as DecodePublicKeyP384};
use rand::rngs::OsRng;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// ECDSA P-256 (secp256r1) operations
pub struct EcdsaP256;

impl EcdsaP256 {
    /// Generate a new P-256 key pair
    /// Returns (private_key_b64, public_key_b64)
    pub fn generate_keypair() -> Result<(String, String), String> {
        let signing_key = P256SigningKey::random(&mut OsRng);
        let verifying_key = signing_key.verifying_key();

        // Encode keys as DER then base64
        let private_der = signing_key.to_pkcs8_der()
            .map_err(|e| format!("Failed to encode private key: {}", e))?;
        let private_b64 = BASE64.encode(private_der.as_bytes());

        let public_der = verifying_key.to_public_key_der()
            .map_err(|e| format!("Failed to encode public key: {}", e))?;
        let public_b64 = BASE64.encode(public_der.as_bytes());

        Ok((private_b64, public_b64))
    }

    /// Sign data with P-256 private key
    /// Returns signature in DER format (base64 encoded)
    pub fn sign(private_key_b64: &str, data: &[u8]) -> Result<String, String> {
        let private_der = BASE64.decode(private_key_b64)
            .map_err(|e| format!("Failed to decode private key: {}", e))?;
        let signing_key = P256SigningKey::from_pkcs8_der(&private_der)
            .map_err(|e| format!("Failed to parse private key: {}", e))?;

        let signature: P256Signature = signing_key.sign(data);

        // Return signature in DER format, base64 encoded
        Ok(BASE64.encode(signature.to_der()))
    }

    /// Verify P-256 signature
    pub fn verify(public_key_b64: &str, data: &[u8], signature_b64: &str) -> Result<bool, String> {
        let public_der = BASE64.decode(public_key_b64)
            .map_err(|e| format!("Failed to decode public key: {}", e))?;
        let verifying_key = P256VerifyingKey::from_public_key_der(&public_der)
            .map_err(|e| format!("Failed to parse public key: {}", e))?;

        let signature_der = BASE64.decode(signature_b64)
            .map_err(|e| format!("Failed to decode signature: {}", e))?;

        let signature = P256Signature::from_der(&signature_der)
            .map_err(|e| format!("Failed to parse signature: {}", e))?;

        match verifying_key.verify(data, &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get public key from private key
    pub fn public_key_from_private(private_key_b64: &str) -> Result<String, String> {
        let private_der = BASE64.decode(private_key_b64)
            .map_err(|e| format!("Failed to decode private key: {}", e))?;
        let signing_key = P256SigningKey::from_pkcs8_der(&private_der)
            .map_err(|e| format!("Failed to parse private key: {}", e))?;

        let verifying_key = signing_key.verifying_key();

        let public_der = verifying_key.to_public_key_der()
            .map_err(|e| format!("Failed to encode public key: {}", e))?;

        Ok(BASE64.encode(public_der.as_bytes()))
    }
}

/// ECDSA P-384 (secp384r1) operations
pub struct EcdsaP384;

impl EcdsaP384 {
    /// Generate a new P-384 key pair
    /// Returns (private_key_b64, public_key_b64)
    pub fn generate_keypair() -> Result<(String, String), String> {
        let signing_key = P384SigningKey::random(&mut OsRng);
        let verifying_key = signing_key.verifying_key();

        // Encode keys as DER then base64
        let private_der = signing_key.to_pkcs8_der()
            .map_err(|e| format!("Failed to encode private key: {}", e))?;
        let private_b64 = BASE64.encode(private_der.as_bytes());

        let public_der = verifying_key.to_public_key_der()
            .map_err(|e| format!("Failed to encode public key: {}", e))?;
        let public_b64 = BASE64.encode(public_der.as_bytes());

        Ok((private_b64, public_b64))
    }

    /// Sign data with P-384 private key
    /// Returns signature in DER format (base64 encoded)
    pub fn sign(private_key_b64: &str, data: &[u8]) -> Result<String, String> {
        let private_der = BASE64.decode(private_key_b64)
            .map_err(|e| format!("Failed to decode private key: {}", e))?;
        let signing_key = P384SigningKey::from_pkcs8_der(&private_der)
            .map_err(|e| format!("Failed to parse private key: {}", e))?;

        let signature: P384Signature = signing_key.sign(data);

        // Return signature in DER format, base64 encoded
        Ok(BASE64.encode(signature.to_der()))
    }

    /// Verify P-384 signature
    pub fn verify(public_key_b64: &str, data: &[u8], signature_b64: &str) -> Result<bool, String> {
        let public_der = BASE64.decode(public_key_b64)
            .map_err(|e| format!("Failed to decode public key: {}", e))?;
        let verifying_key = P384VerifyingKey::from_public_key_der(&public_der)
            .map_err(|e| format!("Failed to parse public key: {}", e))?;

        let signature_der = BASE64.decode(signature_b64)
            .map_err(|e| format!("Failed to decode signature: {}", e))?;

        let signature = P384Signature::from_der(&signature_der)
            .map_err(|e| format!("Failed to parse signature: {}", e))?;

        match verifying_key.verify(data, &signature) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get public key from private key
    pub fn public_key_from_private(private_key_b64: &str) -> Result<String, String> {
        let private_der = BASE64.decode(private_key_b64)
            .map_err(|e| format!("Failed to decode private key: {}", e))?;
        let signing_key = P384SigningKey::from_pkcs8_der(&private_der)
            .map_err(|e| format!("Failed to parse private key: {}", e))?;

        let verifying_key = signing_key.verifying_key();

        let public_der = verifying_key.to_public_key_der()
            .map_err(|e| format!("Failed to encode public key: {}", e))?;

        Ok(BASE64.encode(public_der.as_bytes()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_p256_keypair_generation() {
        let result = EcdsaP256::generate_keypair();
        assert!(result.is_ok());
        let (private_pem, public_pem) = result.unwrap();
        assert!(private_pem.contains("BEGIN PRIVATE KEY"));
        assert!(public_pem.contains("BEGIN PUBLIC KEY"));
    }

    #[test]
    fn test_p256_sign_verify() {
        let (private_pem, public_pem) = EcdsaP256::generate_keypair().unwrap();
        let data = b"test message";

        let signature = EcdsaP256::sign(&private_pem, data).unwrap();
        let verified = EcdsaP256::verify(&public_pem, data, &signature).unwrap();

        assert!(verified);

        // Verify wrong data fails
        let wrong_data = b"wrong message";
        let verified_wrong = EcdsaP256::verify(&public_pem, wrong_data, &signature).unwrap();
        assert!(!verified_wrong);
    }

    #[test]
    fn test_p384_keypair_generation() {
        let result = EcdsaP384::generate_keypair();
        assert!(result.is_ok());
        let (private_pem, public_pem) = result.unwrap();
        assert!(private_pem.contains("BEGIN PRIVATE KEY"));
        assert!(public_pem.contains("BEGIN PUBLIC KEY"));
    }

    #[test]
    fn test_p384_sign_verify() {
        let (private_pem, public_pem) = EcdsaP384::generate_keypair().unwrap();
        let data = b"test message";

        let signature = EcdsaP384::sign(&private_pem, data).unwrap();
        let verified = EcdsaP384::verify(&public_pem, data, &signature).unwrap();

        assert!(verified);

        // Verify wrong data fails
        let wrong_data = b"wrong message";
        let verified_wrong = EcdsaP384::verify(&public_pem, wrong_data, &signature).unwrap();
        assert!(!verified_wrong);
    }

    #[test]
    fn test_public_key_derivation_p256() {
        let (private_pem, expected_public_pem) = EcdsaP256::generate_keypair().unwrap();
        let derived_public_pem = EcdsaP256::public_key_from_private(&private_pem).unwrap();

        // Both should produce valid public keys
        assert!(derived_public_pem.contains("BEGIN PUBLIC KEY"));
        assert_eq!(expected_public_pem, derived_public_pem);
    }

    #[test]
    fn test_public_key_derivation_p384() {
        let (private_pem, expected_public_pem) = EcdsaP384::generate_keypair().unwrap();
        let derived_public_pem = EcdsaP384::public_key_from_private(&private_pem).unwrap();

        // Both should produce valid public keys
        assert!(derived_public_pem.contains("BEGIN PUBLIC KEY"));
        assert_eq!(expected_public_pem, derived_public_pem);
    }
}
