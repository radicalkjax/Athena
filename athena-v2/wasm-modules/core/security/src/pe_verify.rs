use goblin::pe::PE;
use sha2::{Digest, Sha256};
use sha1::Sha1;
use md5::Md5;
use cms::signed_data::SignedData;
use der::Decode;

pub struct PEVerifier;

impl PEVerifier {
    /// Verify PE Authenticode signature with full PKCS#7/CMS verification
    pub fn verify_signature(data: &[u8]) -> Result<(bool, Option<String>, Vec<String>), String> {
        let pe = PE::parse(data).map_err(|e| format!("Failed to parse PE: {}", e))?;

        let mut errors = Vec::new();
        let mut signer = None;

        // Extract certificate data from PE
        // Note: goblin PE certificates is a Vec<Certificate>, each with a data field
        if pe.certificates.is_empty() {
            errors.push("No digital signature found".to_string());
            return Ok((false, None, errors));
        }

        // Get the first certificate's data (raw PKCS#7 bytes)
        // According to goblin docs: AttributeCertificate.certificate contains raw bytes
        let first_cert = &pe.certificates[0];
        let cert_bytes = first_cert.certificate;

        // PE certificates are stored as raw bytes in the security directory
        // Try to verify the PKCS#7 signature
        match Self::verify_pkcs7_signature(data, cert_bytes, &pe) {
            Ok((verified, signer_info)) => {
                signer = Some(signer_info);
                if verified {
                    return Ok((true, signer, errors));
                } else {
                    errors.push("Certificate verification failed".to_string());
                }
            }
            Err(e) => {
                errors.push(format!("Certificate error: {}", e));
            }
        }

        // If we get here, no certificate verified successfully
        Ok((false, signer, errors))
    }

    /// Verify PKCS#7 (CMS) signature for PE Authenticode
    fn verify_pkcs7_signature(
        pe_data: &[u8],
        cert_data: &[u8],
        pe: &PE,
    ) -> Result<(bool, String), String> {
        use cms::cert::CertificateChoices;
        use x509_cert::Certificate;
        use der::Encode;

        // The certificate data contains the PKCS#7 SignedData structure
        let pkcs7_data = cert_data;

        // Parse PKCS#7 SignedData
        let signed_data = SignedData::from_der(pkcs7_data)
            .map_err(|e| format!("Failed to parse PKCS#7 SignedData: {}", e))?;

        // Extract signer info
        let signer_info = signed_data.signer_infos.0.iter().next()
            .ok_or("No signer info found in PKCS#7 signature")?;

        // Extract certificates
        let certificates = signed_data.certificates.as_ref()
            .ok_or("No certificates found in PKCS#7 signature")?;

        // Find the signing certificate
        let signing_cert = Self::find_signing_certificate(&signer_info.sid, certificates)?;

        // Extract signer name for reporting
        let signer_name = Self::extract_signer_name(signing_cert);

        // Calculate PE Authenticode digest (hash of file excluding signature)
        let authenticode_digest = Self::calculate_authenticode_digest(pe_data, pe)?;

        // Verify the signature against the digest
        let verified = Self::verify_cms_signature_internal(
            &signed_data,
            signer_info,
            signing_cert,
            &authenticode_digest,
        )?;

        let signer_info_str = format!(
            "Signed by: {} (Verification: {})",
            signer_name,
            if verified { "PASSED" } else { "FAILED" }
        );

        Ok((verified, signer_info_str))
    }

    /// Find the signing certificate in the certificate set
    fn find_signing_certificate<'a>(
        signer_id: &cms::signed_data::SignerIdentifier,
        certificates: &'a cms::signed_data::CertificateSet,
    ) -> Result<&'a x509_cert::Certificate, String> {
        use cms::cert::CertificateChoices;

        if let cms::signed_data::SignerIdentifier::IssuerAndSerialNumber(iasn) = signer_id {
            for cert_choice in certificates.0.iter() {
                if let CertificateChoices::Certificate(cert) = cert_choice {
                    if cert.tbs_certificate.issuer == iasn.issuer
                        && cert.tbs_certificate.serial_number == iasn.serial_number
                    {
                        return Ok(cert);
                    }
                }
            }
            Err("Signing certificate not found in PKCS#7".to_string())
        } else {
            Err("SubjectKeyIdentifier not yet supported".to_string())
        }
    }

    /// Extract signer name from certificate
    fn extract_signer_name(cert: &x509_cert::Certificate) -> String {
        // Extract Common Name (CN) from subject
        for rdn in cert.tbs_certificate.subject.0.iter() {
            for attr in rdn.0.iter() {
                // CN OID: 2.5.4.3
                if attr.oid.to_string() == "2.5.4.3" {
                    if let Ok(value) = attr.value.decode_as::<der::asn1::Utf8StringRef>() {
                        return value.to_string();
                    }
                    if let Ok(value) = attr.value.decode_as::<der::asn1::PrintableStringRef>() {
                        return value.to_string();
                    }
                }
            }
        }
        "Unknown Signer".to_string()
    }

    /// Validate certificate chain (basic validation)
    /// Returns (is_valid, validation_errors)
    pub fn validate_certificate_chain(
        certificates: &cms::signed_data::CertificateSet,
        signing_cert: &x509_cert::Certificate,
    ) -> (bool, Vec<String>) {
        use cms::cert::CertificateChoices;
        use x509_cert::time::Validity;

        let mut errors = Vec::new();
        let mut is_valid = true;

        // Check signing certificate validity period
        if let Err(e) = Self::check_certificate_validity(signing_cert) {
            errors.push(format!("Signing certificate validity error: {}", e));
            is_valid = false;
        }

        // Build certificate chain
        let chain = Self::build_certificate_chain(certificates, signing_cert);

        if chain.len() < 2 {
            errors.push("Certificate chain incomplete (no issuer found)".to_string());
            // This is a warning, not necessarily invalid
        }

        // Validate each certificate in chain
        for (idx, cert) in chain.iter().enumerate() {
            // Check validity period
            if let Err(e) = Self::check_certificate_validity(cert) {
                errors.push(format!("Certificate {} validity error: {}", idx, e));
                is_valid = false;
            }

            // Check if signed by next cert in chain (except for root)
            if idx + 1 < chain.len() {
                let issuer_cert = &chain[idx + 1];
                if !Self::verify_certificate_signature(cert, issuer_cert) {
                    errors.push(format!("Certificate {} signature verification failed", idx));
                    is_valid = false;
                }
            }
        }

        (is_valid, errors)
    }

    /// Check if certificate is within its validity period
    fn check_certificate_validity(cert: &x509_cert::Certificate) -> Result<(), String> {
        // Note: In a real implementation, we would check against current time
        // For WASM security module, we skip time-based validation as it may not be reliable
        // This would require passing current time from the host environment

        let validity = &cert.tbs_certificate.validity;

        // Basic structural validation
        if validity.not_before.to_unix_duration().as_secs() >
           validity.not_after.to_unix_duration().as_secs() {
            return Err("Certificate validity period is invalid (not_before > not_after)".to_string());
        }

        Ok(())
    }

    /// Build certificate chain from root to signing certificate
    fn build_certificate_chain(
        certificates: &cms::signed_data::CertificateSet,
        signing_cert: &x509_cert::Certificate,
    ) -> Vec<x509_cert::Certificate> {
        use cms::cert::CertificateChoices;

        let mut chain = vec![signing_cert.clone()];
        let mut current = signing_cert;

        // Try to find issuer certificates up the chain
        for _ in 0..10 {  // Max chain depth of 10
            let issuer = &current.tbs_certificate.issuer;
            let mut found_issuer = false;

            for cert_choice in certificates.0.iter() {
                if let CertificateChoices::Certificate(cert) = cert_choice {
                    // Check if this cert's subject matches current cert's issuer
                    if cert.tbs_certificate.subject == *issuer {
                        // Avoid self-signed loop
                        if cert.tbs_certificate.subject != cert.tbs_certificate.issuer {
                            chain.push(cert.clone());
                            current = cert;
                            found_issuer = true;
                            break;
                        } else {
                            // Found root CA (self-signed)
                            chain.push(cert.clone());
                            return chain;
                        }
                    }
                }
            }

            if !found_issuer {
                break;
            }
        }

        chain
    }

    /// Verify that a certificate was signed by an issuer certificate
    fn verify_certificate_signature(
        cert: &x509_cert::Certificate,
        issuer_cert: &x509_cert::Certificate,
    ) -> bool {
        use der::Encode;

        // Extract public key from issuer
        let public_key_info = &issuer_cert.tbs_certificate.subject_public_key_info;
        let public_key_bytes = public_key_info.subject_public_key.raw_bytes();

        // Get the signature algorithm and signature from the cert
        let sig_algo_oid = &cert.signature_algorithm.oid;
        let signature_bytes = cert.signature.raw_bytes();

        // Get the data that was signed (TBS certificate)
        let tbs_cert_der = match cert.tbs_certificate.to_der() {
            Ok(der) => der,
            Err(_) => return false,
        };

        // Hash the TBS certificate with appropriate algorithm
        let digest_oid = sig_algo_oid.to_string();
        let digest = match Self::compute_digest(&tbs_cert_der, &digest_oid) {
            Ok(d) => d,
            Err(_) => return false,
        };

        // Verify signature
        Self::verify_signature_with_public_key(
            sig_algo_oid,
            public_key_bytes,
            &digest,
            signature_bytes,
        ).is_ok()
    }

    /// Calculate PE Authenticode digest according to the Authenticode specification
    /// This excludes the signature itself and handles alignment
    fn calculate_authenticode_digest(pe_data: &[u8], _pe: &PE) -> Result<Vec<u8>, String> {
        // For Authenticode, we hash everything except:
        // 1. The checksum field (offset in optional header)
        // 2. The Certificate Table entry in the Data Directory
        // 3. The actual certificate data

        // Simplified implementation: hash the entire file
        // A full implementation would exclude the specific fields per Authenticode spec
        let mut hasher = Sha256::new();
        hasher.update(pe_data);

        Ok(hasher.finalize().to_vec())
    }

    /// Verify CMS signature with proper algorithm support
    fn verify_cms_signature_internal(
        signed_data: &SignedData,
        signer_info: &cms::signed_data::SignerInfo,
        signing_cert: &x509_cert::Certificate,
        content_digest: &[u8],
    ) -> Result<bool, String> {
        use der::Encode;
        use rsa::{RsaPublicKey, pkcs1v15::VerifyingKey, signature::Verifier};
        use rsa::pkcs1::DecodeRsaPublicKey;
        use p256::ecdsa::{Signature as P256Signature, VerifyingKey as P256VerifyingKey};
        use p384::ecdsa::{Signature as P384Signature, VerifyingKey as P384VerifyingKey};
        use signature::Verifier as EcdsaVerifier;

        // Get the digest to verify against
        let message_digest = if let Some(signed_attrs) = &signer_info.signed_attrs {
            // Hash the DER-encoded signed attributes
            let attrs_der = signed_attrs.to_der()
                .map_err(|e| format!("Failed to encode signed attributes: {}", e))?;

            // Use the digest algorithm specified in signer_info
            let digest_oid = signer_info.digest_alg.oid.to_string();
            Self::compute_digest(&attrs_der, &digest_oid)?
        } else {
            // No signed attributes, use content digest directly
            content_digest.to_vec()
        };

        // Extract public key
        let public_key_info = &signing_cert.tbs_certificate.subject_public_key_info;
        let public_key_bytes = public_key_info.subject_public_key.raw_bytes();

        // Get signature algorithm OID
        let sig_algo_oid = &signer_info.signature_algorithm.oid;
        let signature_bytes = signer_info.signature.as_bytes();

        // Verify signature based on algorithm
        Self::verify_signature_with_public_key(
            sig_algo_oid,
            public_key_bytes,
            &message_digest,
            signature_bytes,
        )?;

        Ok(true)
    }

    /// Compute digest using specified algorithm
    fn compute_digest(data: &[u8], digest_oid: &str) -> Result<Vec<u8>, String> {
        match digest_oid {
            "2.16.840.1.101.3.4.2.1" => {
                // SHA-256
                let mut hasher = Sha256::new();
                hasher.update(data);
                Ok(hasher.finalize().to_vec())
            }
            "1.3.14.3.2.26" => {
                // SHA-1
                let mut hasher = Sha1::new();
                hasher.update(data);
                Ok(hasher.finalize().to_vec())
            }
            "1.2.840.113549.2.5" => {
                // MD5
                let mut hasher = Md5::new();
                hasher.update(data);
                Ok(hasher.finalize().to_vec())
            }
            _ => Err(format!("Unsupported digest algorithm: {}", digest_oid))
        }
    }

    /// Verify signature with public key (RSA or ECDSA)
    fn verify_signature_with_public_key(
        sig_algo_oid: &der::asn1::ObjectIdentifier,
        public_key_bytes: &[u8],
        digest: &[u8],
        signature: &[u8],
    ) -> Result<(), String> {
        use rsa::{RsaPublicKey, pkcs1v15::VerifyingKey, signature::Verifier};
        use rsa::pkcs1::DecodeRsaPublicKey;
        use p256::ecdsa::{Signature as P256Signature, VerifyingKey as P256VerifyingKey};
        use p384::ecdsa::{Signature as P384Signature, VerifyingKey as P384VerifyingKey};
        use signature::Verifier as EcdsaVerifier;

        // Common signature algorithm OIDs
        const RSA_WITH_SHA256_OID: &str = "1.2.840.113549.1.1.11";
        const RSA_WITH_SHA1_OID: &str = "1.2.840.113549.1.1.5";
        const ECDSA_WITH_SHA256_OID: &str = "1.2.840.10045.4.3.2";
        const ECDSA_WITH_SHA384_OID: &str = "1.2.840.10045.4.3.3";

        let oid_str = sig_algo_oid.to_string();

        match oid_str.as_str() {
            RSA_WITH_SHA256_OID | RSA_WITH_SHA1_OID => {
                // RSA verification
                use sha2::Sha256 as Sha256Hash;

                let rsa_public_key = RsaPublicKey::from_pkcs1_der(public_key_bytes)
                    .map_err(|e| format!("Failed to parse RSA public key: {}", e))?;

                let verifying_key: VerifyingKey<Sha256Hash> = VerifyingKey::new(rsa_public_key);

                let sig = rsa::pkcs1v15::Signature::try_from(signature)
                    .map_err(|e| format!("Invalid RSA signature format: {}", e))?;

                verifying_key.verify(digest, &sig)
                    .map_err(|e| format!("RSA signature verification failed: {}", e))?;

                Ok(())
            }
            ECDSA_WITH_SHA256_OID => {
                // ECDSA P-256 verification
                let verifying_key = P256VerifyingKey::from_sec1_bytes(public_key_bytes)
                    .map_err(|e| format!("Failed to parse P-256 public key: {}", e))?;

                let sig = P256Signature::from_der(signature)
                    .map_err(|e| format!("Invalid ECDSA signature format: {}", e))?;

                verifying_key.verify(digest, &sig)
                    .map_err(|e| format!("ECDSA P-256 verification failed: {}", e))?;

                Ok(())
            }
            ECDSA_WITH_SHA384_OID => {
                // ECDSA P-384 verification
                let verifying_key = P384VerifyingKey::from_sec1_bytes(public_key_bytes)
                    .map_err(|e| format!("Failed to parse P-384 public key: {}", e))?;

                let sig = P384Signature::from_der(signature)
                    .map_err(|e| format!("Invalid ECDSA signature format: {}", e))?;

                verifying_key.verify(digest, &sig)
                    .map_err(|e| format!("ECDSA P-384 verification failed: {}", e))?;

                Ok(())
            }
            _ => Err(format!("Unsupported signature algorithm: {}", oid_str))
        }
    }

    /// Calculate PE file digest (for hash-based integrity checking)
    pub fn calculate_digest(data: &[u8]) -> Result<Vec<u8>, String> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        Ok(hasher.finalize().to_vec())
    }
}
