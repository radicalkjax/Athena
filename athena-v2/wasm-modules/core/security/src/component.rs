// Component Model implementation for athena:security

wit_bindgen::generate!({
    world: "security-component",
    path: "wit",
});

use crate::pe_verify::PEVerifier;
use crate::elf_verify::ELFVerifier;
use crate::macho_verify::MachOVerifier;
use goblin::Object;
use sha2::{Digest, Sha256};

const VERSION: &str = "0.1.0";

struct Component;

impl exports::athena::security::security::Guest for Component {
    fn verify_pe_signature(pe_data: Vec<u8>) -> Result<exports::athena::security::security::VerificationResult, String> {
        let (is_valid, signer, errors) = PEVerifier::verify_signature(&pe_data)?;

        Ok(exports::athena::security::security::VerificationResult {
            is_valid,
            signer,
            timestamp: None,
            algorithm: Some("Authenticode".to_string()),
            errors,
            warnings: vec![],
        })
    }

    fn verify_elf_signature(
        elf_data: Vec<u8>,
        signature: Option<Vec<u8>>,
    ) -> Result<exports::athena::security::security::VerificationResult, String> {
        let sig_ref = signature.as_ref().map(|s| s.as_slice());
        let (is_valid, signer, errors) = ELFVerifier::verify_signature(&elf_data, sig_ref)?;

        Ok(exports::athena::security::security::VerificationResult {
            is_valid,
            signer,
            timestamp: None,
            algorithm: Some("GPG/PGP".to_string()),
            errors,
            warnings: vec![],
        })
    }

    fn verify_macho_signature(macho_data: Vec<u8>) -> Result<exports::athena::security::security::VerificationResult, String> {
        let (is_valid, signer, errors) = MachOVerifier::verify_signature(&macho_data)?;

        Ok(exports::athena::security::security::VerificationResult {
            is_valid,
            signer,
            timestamp: None,
            algorithm: Some("Apple Code Signature".to_string()),
            errors,
            warnings: vec![],
        })
    }

    fn detect_format(data: Vec<u8>) -> exports::athena::security::security::FileFormat {
        use exports::athena::security::security::FileFormat;

        match Object::parse(&data) {
            Ok(Object::PE(_)) => FileFormat::Pe,
            Ok(Object::Elf(_)) => FileFormat::Elf,
            Ok(Object::Mach(_)) => FileFormat::Macho,
            _ => FileFormat::Unknown,
        }
    }

    fn calculate_hash(data: Vec<u8>) -> String {
        let mut hasher = Sha256::new();
        hasher.update(&data);
        hex::encode(hasher.finalize())
    }

    fn get_version() -> String {
        VERSION.to_string()
    }
}

export!(Component);
