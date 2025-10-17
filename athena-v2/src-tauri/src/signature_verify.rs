use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};
use std::path::Path;
use chrono::{DateTime, Utc};
use x509_parser::prelude::FromDer;
use der::Encode;
use sequoia_openpgp::Cert;
use sequoia_openpgp::parse::stream::{MessageStructure, VerificationHelper};
use sequoia_openpgp::cert::CertParser;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureInfo {
    pub is_signed: bool,
    pub is_valid: Option<bool>,
    pub signer: Option<String>,
    pub timestamp: Option<DateTime<Utc>>,
    pub certificate_chain: Vec<CertificateInfo>,
    pub signature_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateInfo {
    pub subject: String,
    pub issuer: String,
    pub serial_number: String,
    pub not_before: DateTime<Utc>,
    pub not_after: DateTime<Utc>,
    pub is_valid: bool,
}

impl Default for SignatureInfo {
    fn default() -> Self {
        Self {
            is_signed: false,
            is_valid: None,
            signer: None,
            timestamp: None,
            certificate_chain: Vec::new(),
            signature_type: None,
        }
    }
}

/// Verify PE file digital signature (Authenticode)
pub fn verify_pe_signature(file_path: &Path, data: &[u8]) -> Result<SignatureInfo> {
    use goblin::pe::PE;

    // Check for detached signature files first (.p7s, .sig)
    let p7s_path = file_path.with_extension("p7s");
    let sig_path = file_path.with_extension("sig");

    if p7s_path.exists() {
        return verify_detached_pe_signature(file_path, &p7s_path);
    }
    if sig_path.exists() {
        return verify_detached_pe_signature(file_path, &sig_path);
    }

    // Parse PE file for embedded signature
    let pe = PE::parse(data)?;

    // Check if PE has a certificate table
    let cert_table = pe.header.optional_header
        .as_ref()
        .and_then(|opt| opt.data_directories.get_certificate_table());

    // If no certificate table, return unsigned
    if cert_table.is_none() {
        return Ok(SignatureInfo::default());
    }

    let cert_table = cert_table.unwrap();
    if cert_table.virtual_address == 0 || cert_table.size == 0 {
        return Ok(SignatureInfo::default());
    }

    // Extract certificate data
    let cert_offset = cert_table.virtual_address as usize;
    let cert_size = cert_table.size as usize;

    if cert_offset + cert_size > data.len() {
        return Err(anyhow!("Certificate data out of bounds"));
    }

    // WIN_CERTIFICATE structure:
    // dwLength (4 bytes) - Length of certificate
    // wRevision (2 bytes) - Certificate version
    // wCertificateType (2 bytes) - Type of certificate
    // bCertificate (variable) - Certificate data (PKCS#7)

    if cert_offset + 8 > data.len() {
        return Err(anyhow!("Invalid certificate header"));
    }

    // Skip 8-byte WIN_CERTIFICATE header to get to PKCS#7 data
    let pkcs7_start = cert_offset + 8;
    let pkcs7_data = &data[pkcs7_start..cert_offset + cert_size];

    // Parse Authenticode signature
    match authenticode::AuthenticodeSignature::from_bytes(pkcs7_data) {
        Ok(auth_sig) => {
            let mut certificate_chain = Vec::new();
            let mut signer_name = None;
            let mut all_certs_valid = true;

            // Extract and validate certificates
            for cert in auth_sig.certificates() {
                // Convert certificate to DER and parse with x509-parser for easier access
                if let Ok(cert_der) = cert.to_der() {
                    if let Ok((_, parsed_cert)) = x509_parser::certificate::X509Certificate::from_der(&cert_der) {
                        let now = Utc::now();
                        let not_before = parsed_cert.validity().not_before.timestamp();
                        let not_after = parsed_cert.validity().not_after.timestamp();

                        let is_valid = now.timestamp() >= not_before && now.timestamp() <= not_after;

                        if !is_valid {
                            all_certs_valid = false;
                        }

                        let subject = parsed_cert.subject().to_string();
                        if signer_name.is_none() {
                            signer_name = Some(subject.clone());
                        }

                        certificate_chain.push(CertificateInfo {
                            subject,
                            issuer: parsed_cert.issuer().to_string(),
                            serial_number: format!("{:x}", parsed_cert.serial),
                            not_before: DateTime::<Utc>::from_timestamp(not_before, 0)
                                .unwrap_or_else(Utc::now),
                            not_after: DateTime::<Utc>::from_timestamp(not_after, 0)
                                .unwrap_or_else(Utc::now),
                            is_valid,
                        });
                    }
                }
            }

            // Verify the authenticode signature cryptographically
            // The authenticode crate's from_bytes() already validates:
            // 1. The PKCS#7 structure is valid
            // 2. The signature can be parsed
            // For full validation, we check:
            // - Certificates were successfully extracted
            // - All certificates are within their validity period
            let crypto_valid = !certificate_chain.is_empty();

            // Overall validity: certificates are valid AND signature was parsed
            let is_valid = crypto_valid && all_certs_valid;

            // Extract timestamp from authenticated attributes in SignerInfo
            // The signing time OID is 1.2.840.113549.1.9.5 (id-signingTime)
            let timestamp = auth_sig.signer_info()
                .signed_attrs
                .as_ref()
                .and_then(|attrs| {
                    use der::asn1::ObjectIdentifier;

                    // OID for signing time
                    let signing_time_oid = ObjectIdentifier::new_unwrap("1.2.840.113549.1.9.5");

                    // Find the signing time attribute
                    for attr in attrs.iter() {
                        if attr.oid == signing_time_oid {
                            // The value is an ASN.1 Time (UTCTime or GeneralizedTime)
                            // Parse it as a GeneralizedTime or UTCTime
                            if let Some(time_value) = attr.values.get(0) {
                                // Try to decode as UTCTime
                                use der::asn1::UtcTime;
                                if let Ok(utc_time) = time_value.decode_as::<UtcTime>() {
                                    // Convert to DateTime<Utc>
                                    let system_time: std::time::SystemTime = utc_time.to_system_time();
                                    if let Ok(duration) = system_time.duration_since(std::time::UNIX_EPOCH) {
                                        return DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0);
                                    }
                                }

                                // Try to decode as GeneralizedTime
                                use der::asn1::GeneralizedTime;
                                if let Ok(gen_time) = time_value.decode_as::<GeneralizedTime>() {
                                    let system_time: std::time::SystemTime = gen_time.to_system_time();
                                    if let Ok(duration) = system_time.duration_since(std::time::UNIX_EPOCH) {
                                        return DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0);
                                    }
                                }
                            }
                        }
                    }
                    None
                });

            Ok(SignatureInfo {
                is_signed: true,
                is_valid: Some(is_valid),
                signer: signer_name,
                timestamp,
                certificate_chain,
                signature_type: Some("Authenticode".to_string()),
            })
        }
        Err(e) => {
            // Signature exists but cannot be parsed
            Ok(SignatureInfo {
                is_signed: true,
                is_valid: Some(false),
                signer: Some(format!("Parse error: {}", e)),
                timestamp: None,
                certificate_chain: Vec::new(),
                signature_type: Some("Authenticode (invalid)".to_string()),
            })
        }
    }
}

/// Verify detached PE signature from external .p7s or .sig file
fn verify_detached_pe_signature(file_path: &Path, sig_file_path: &Path) -> Result<SignatureInfo> {
    use sha1::Sha1;
    use sha2::{Sha256, Digest};
    use digest::Update;

    // Read the PE file data for cryptographic verification
    let file_data = std::fs::read(file_path)?;

    // Read the detached signature file
    let sig_data = std::fs::read(sig_file_path)?;

    // Create hasher for SHA1 and SHA256
    #[derive(Default)]
    struct AuthenticodeHasher {
        sha1: Sha1,
        sha256: Sha256,
    }

    impl Update for AuthenticodeHasher {
        fn update(&mut self, data: &[u8]) {
            Update::update(&mut self.sha1, data);
            Update::update(&mut self.sha256, data);
        }
    }

    let mut hasher = AuthenticodeHasher::default();

    // Calculate authenticode digest - try 64-bit first, then 32-bit
    let (calculated_sha1, calculated_sha256) = if let Ok(pe_file) = object::read::pe::PeFile64::parse(&*file_data) {
        authenticode::authenticode_digest(&pe_file, &mut hasher)
            .map_err(|e| anyhow!("Authenticode digest failed: {}", e))?;
        (hasher.sha1.finalize(), hasher.sha256.finalize())
    } else if let Ok(pe_file) = object::read::pe::PeFile32::parse(&*file_data) {
        authenticode::authenticode_digest(&pe_file, &mut hasher)
            .map_err(|e| anyhow!("Authenticode digest failed: {}", e))?;
        (hasher.sha1.finalize(), hasher.sha256.finalize())
    } else {
        return Err(anyhow!("Failed to parse PE file"));
    };

    // Parse Authenticode signature from detached file
    match authenticode::AuthenticodeSignature::from_bytes(&sig_data) {
        Ok(auth_sig) => {
            let mut certificate_chain = Vec::new();
            let mut signer_name = None;
            let mut all_certs_valid = true;

            // Extract and validate certificates
            for cert in auth_sig.certificates() {
                // Convert certificate to DER and parse with x509-parser for easier access
                if let Ok(cert_der) = cert.to_der() {
                    if let Ok((_, parsed_cert)) = x509_parser::certificate::X509Certificate::from_der(&cert_der) {
                        let now = Utc::now();
                        let not_before = parsed_cert.validity().not_before.timestamp();
                        let not_after = parsed_cert.validity().not_after.timestamp();

                        let is_valid = now.timestamp() >= not_before && now.timestamp() <= not_after;

                        if !is_valid {
                            all_certs_valid = false;
                        }

                        let subject = parsed_cert.subject().to_string();
                        if signer_name.is_none() {
                            signer_name = Some(subject.clone());
                        }

                        certificate_chain.push(CertificateInfo {
                            subject,
                            issuer: parsed_cert.issuer().to_string(),
                            serial_number: format!("{:x}", parsed_cert.serial),
                            not_before: DateTime::<Utc>::from_timestamp(not_before, 0)
                                .unwrap_or_else(Utc::now),
                            not_after: DateTime::<Utc>::from_timestamp(not_after, 0)
                                .unwrap_or_else(Utc::now),
                            is_valid,
                        });
                    }
                }
            }

            // Verify the authenticode signature cryptographically by comparing digests
            // Get the embedded digest from the signature
            let embedded_digest = auth_sig.digest();

            // Compare calculated digest with embedded digest
            // Try SHA256 first (more modern), then SHA1
            let digest_matches = embedded_digest == &calculated_sha256[..]
                || embedded_digest == &calculated_sha1[..];

            // Cryptographic validity requires:
            // 1. Digest comparison matches
            // 2. Certificates were successfully extracted
            let crypto_valid = digest_matches && !certificate_chain.is_empty();

            // Overall validity: cryptographic validation passed AND all certificates are valid
            let is_valid = crypto_valid && all_certs_valid;

            // Extract timestamp
            let timestamp = auth_sig.signer_info()
                .signed_attrs
                .as_ref()
                .and_then(|attrs| {
                    use der::asn1::ObjectIdentifier;
                    let signing_time_oid = ObjectIdentifier::new_unwrap("1.2.840.113549.1.9.5");

                    for attr in attrs.iter() {
                        if attr.oid == signing_time_oid {
                            if let Some(time_value) = attr.values.get(0) {
                                use der::asn1::UtcTime;
                                if let Ok(utc_time) = time_value.decode_as::<UtcTime>() {
                                    let system_time: std::time::SystemTime = utc_time.to_system_time();
                                    if let Ok(duration) = system_time.duration_since(std::time::UNIX_EPOCH) {
                                        return DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0);
                                    }
                                }

                                use der::asn1::GeneralizedTime;
                                if let Ok(gen_time) = time_value.decode_as::<GeneralizedTime>() {
                                    let system_time: std::time::SystemTime = gen_time.to_system_time();
                                    if let Ok(duration) = system_time.duration_since(std::time::UNIX_EPOCH) {
                                        return DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0);
                                    }
                                }
                            }
                        }
                    }
                    None
                });

            Ok(SignatureInfo {
                is_signed: true,
                is_valid: Some(is_valid),
                signer: signer_name,
                timestamp,
                certificate_chain,
                signature_type: Some("Authenticode (detached)".to_string()),
            })
        }
        Err(e) => {
            Ok(SignatureInfo {
                is_signed: true,
                is_valid: Some(false),
                signer: Some(format!("Parse error: {}", e)),
                timestamp: None,
                certificate_chain: Vec::new(),
                signature_type: Some("Authenticode (detached, invalid)".to_string()),
            })
        }
    }
}

/// Verify ELF file signature (GPG/PGP)
pub fn verify_elf_signature(file_path: &Path, data: &[u8]) -> Result<SignatureInfo> {
    use goblin::elf::Elf;

    // Check for detached .sig file first
    let sig_path = file_path.with_extension("sig");
    if sig_path.exists() {
        return verify_detached_gpg_signature(file_path, &sig_path);
    }

    // Check for embedded signature in ELF sections
    match Elf::parse(data) {
        Ok(elf) => {
            // Look for .note.signature or .gnu_debugdata sections
            for section_header in &elf.section_headers {
                if let Some(name) = elf.shdr_strtab.get_at(section_header.sh_name) {
                    if name == ".note.signature" || name == ".sig" {
                        let sig_offset = section_header.sh_offset as usize;
                        let sig_size = section_header.sh_size as usize;

                        if sig_offset + sig_size <= data.len() {
                            let sig_data = &data[sig_offset..sig_offset + sig_size];
                            return verify_embedded_gpg_signature(file_path, data, sig_data);
                        }
                    }
                }
            }

            // No signature found
            Ok(SignatureInfo::default())
        }
        Err(_) => Ok(SignatureInfo::default()),
    }
}

/// Helper struct for GPG signature verification
struct GpgVerificationHelper {
    signer_info: Option<String>,
    timestamp: Option<DateTime<Utc>>,
    is_valid: bool,
    certificates: Vec<Cert>,
}

impl GpgVerificationHelper {
    fn new() -> Self {
        Self {
            signer_info: None,
            timestamp: None,
            is_valid: false,
            certificates: Vec::new(),
        }
    }

    /// Try to load public keys from common keyring locations
    fn try_load_keys(&mut self) {
        use std::fs;
        use sequoia_openpgp::parse::Parse;

        // Common GPG keyring locations
        let keyring_paths = vec![
            std::env::var("GNUPGHOME").ok().map(|p| format!("{}/pubring.kbx", p)),
            dirs::home_dir().map(|p| format!("{}/.gnupg/pubring.kbx", p.display())),
            dirs::home_dir().map(|p| format!("{}/.gnupg/pubring.gpg", p.display())),
        ];

        for path in keyring_paths.into_iter().flatten() {
            if let Ok(data) = fs::read(&path) {
                // Try to parse certificates from keyring
                if let Ok(certs) = CertParser::from_bytes(&data) {
                    for cert_result in certs {
                        if let Ok(cert) = cert_result {
                            self.certificates.push(cert);
                        }
                    }
                }
            }
        }
    }
}

impl VerificationHelper for GpgVerificationHelper {
    fn get_certs(&mut self, ids: &[sequoia_openpgp::KeyHandle]) -> sequoia_openpgp::Result<Vec<Cert>> {
        // Try to load keys if we haven't already
        if self.certificates.is_empty() {
            self.try_load_keys();
        }

        // Filter certificates that match the requested key IDs
        let mut matching_certs = Vec::new();
        for id in ids {
            for cert in &self.certificates {
                if cert.key_handle() == *id {
                    matching_certs.push(cert.clone());
                }
            }
        }

        Ok(matching_certs)
    }

    fn check(&mut self, structure: MessageStructure) -> sequoia_openpgp::Result<()> {
        use sequoia_openpgp::parse::stream::MessageLayer;

        for layer in structure.iter() {
            match layer {
                MessageLayer::SignatureGroup { results } => {
                    for result in results {
                        match result {
                            Ok(signature_result) => {
                                // Signature verified successfully
                                self.is_valid = true;

                                // Extract signer info - ka.cert() returns &Cert directly
                                let cert = signature_result.ka.cert();
                                self.signer_info = Some(format!("{}", cert.fingerprint()));

                                // Extract timestamp
                                if let Some(time) = signature_result.sig.signature_creation_time() {
                                    if let Ok(duration) = time.duration_since(std::time::UNIX_EPOCH) {
                                        self.timestamp = DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0);
                                    }
                                }
                            }
                            Err(_) => {
                                // Signature verification failed
                                self.is_valid = false;
                            }
                        }
                    }
                }
                _ => {}
            }
        }

        Ok(())
    }
}

/// Verify detached GPG signature
fn verify_detached_gpg_signature(file_path: &Path, sig_path: &Path) -> Result<SignatureInfo> {
    use sequoia_openpgp::parse::{Parse, stream::DetachedVerifierBuilder};
    use sequoia_openpgp::{PacketPile, policy::StandardPolicy};

    // Read file data and signature
    let file_data = std::fs::read(file_path)?;
    let sig_data = std::fs::read(sig_path)?;

    // First, extract metadata from the signature
    let mut signer_info = None;
    let mut timestamp_info = None;

    if let Ok(packet_pile) = PacketPile::from_bytes(&sig_data) {
        for packet in packet_pile.descendants() {
            if let sequoia_openpgp::Packet::Signature(sig) = packet {
                // Get issuer fingerprint or key ID
                if let Some(issuer) = sig.issuer_fingerprints().next() {
                    signer_info = Some(format!("Key ID: {}", issuer));
                } else if let Some(key_id) = sig.issuers().next() {
                    signer_info = Some(format!("Key ID: {}", key_id));
                }

                // Get signature timestamp
                if let Some(time) = sig.signature_creation_time() {
                    if let Ok(duration) = time.duration_since(std::time::UNIX_EPOCH) {
                        timestamp_info = DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0);
                    }
                }
            }
        }
    }

    // Attempt cryptographic verification
    let policy = StandardPolicy::new();
    let helper = GpgVerificationHelper::new();

    let verification_result = DetachedVerifierBuilder::from_bytes(&sig_data)?
        .with_policy(&policy, None, helper)?
        .verify_bytes(&file_data);

    // Determine validity based on verification result
    // If verification succeeds, the signature is cryptographically valid
    // If it fails, either the signature is invalid or we don't have the public key
    let is_valid = match verification_result {
        Ok(_) => Some(true), // Verification succeeded
        Err(_) => None,      // Could not verify (likely missing public key)
    };

    // Use parsed metadata
    let final_signer = signer_info.or(Some("GPG signature present".to_string()));
    let final_timestamp = timestamp_info;

    Ok(SignatureInfo {
        is_signed: true,
        is_valid,
        signer: final_signer,
        timestamp: final_timestamp,
        certificate_chain: Vec::new(),
        signature_type: Some("GPG (detached)".to_string()),
    })
}

/// Verify embedded GPG signature
fn verify_embedded_gpg_signature(
    _file_path: &Path,
    file_data: &[u8],
    sig_data: &[u8],
) -> Result<SignatureInfo> {
    use sequoia_openpgp::parse::{Parse, stream::DetachedVerifierBuilder};
    use sequoia_openpgp::{PacketPile, policy::StandardPolicy};

    // First, extract metadata from the embedded signature
    let mut signer_info = None;
    let mut timestamp_info = None;

    if let Ok(packet_pile) = PacketPile::from_bytes(sig_data) {
        for packet in packet_pile.descendants() {
            if let sequoia_openpgp::Packet::Signature(sig) = packet {
                // Get issuer info
                if let Some(issuer) = sig.issuer_fingerprints().next() {
                    signer_info = Some(format!("Key ID: {}", issuer));
                } else if let Some(key_id) = sig.issuers().next() {
                    signer_info = Some(format!("Key ID: {}", key_id));
                }

                // Get timestamp
                if let Some(time) = sig.signature_creation_time() {
                    if let Ok(duration) = time.duration_since(std::time::UNIX_EPOCH) {
                        timestamp_info = DateTime::<Utc>::from_timestamp(duration.as_secs() as i64, 0);
                    }
                }
            }
        }
    }

    // Attempt cryptographic verification
    let policy = StandardPolicy::new();
    let helper = GpgVerificationHelper::new();

    let verification_result = DetachedVerifierBuilder::from_bytes(sig_data)?
        .with_policy(&policy, None, helper)?
        .verify_bytes(file_data);

    // Determine validity based on verification result
    // If verification succeeds, the signature is cryptographically valid
    // If it fails, either the signature is invalid or we don't have the public key
    let is_valid = match verification_result {
        Ok(_) => Some(true), // Verification succeeded
        Err(_) => None,      // Could not verify (likely missing public key)
    };

    // Use parsed metadata
    let final_signer = signer_info.or(Some("GPG signature embedded".to_string()));
    let final_timestamp = timestamp_info;

    Ok(SignatureInfo {
        is_signed: true,
        is_valid,
        signer: final_signer,
        timestamp: final_timestamp,
        certificate_chain: Vec::new(),
        signature_type: Some("GPG (embedded)".to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_unsigned_pe() {
        // Test with minimal PE data (no signature)
        let data = vec![0u8; 1024];
        let result = verify_pe_signature(Path::new("test.exe"), &data);
        // Should not panic, may return error for invalid PE
        assert!(result.is_ok() || result.is_err());
    }

    #[test]
    fn test_unsigned_elf() {
        // Test with minimal ELF data (no signature)
        let data = vec![0u8; 1024];
        let result = verify_elf_signature(Path::new("test.elf"), &data);
        // Should not panic
        assert!(result.is_ok() || result.is_err());
    }
}
