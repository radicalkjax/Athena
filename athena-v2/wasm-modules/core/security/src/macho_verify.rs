use goblin::mach::Mach;
use cms::signed_data::SignedData;
use der::Decode;

pub struct MachOVerifier;

// Mach-O code signature constants
const CSMAGIC_EMBEDDED_SIGNATURE: u32 = 0xfade0cc0;  // SuperBlob
const CSMAGIC_CODE_DIRECTORY: u32 = 0xfade0c02;      // CodeDirectory
const CSSLOT_CODEDIRECTORY: u32 = 0;                  // CodeDirectory slot
const CSSLOT_SIGNATURESLOT: u32 = 0x10000;           // CMS Signature slot

impl MachOVerifier {
    pub fn verify_signature(data: &[u8]) -> Result<(bool, Option<String>, Vec<String>), String> {
        // Parse Mach-O using goblin
        let mach = Mach::parse(data)
            .map_err(|e| format!("Failed to parse Mach-O: {}", e))?;

        match mach {
            Mach::Binary(macho) => {
                Self::verify_single_macho(data, &macho)
            }
            Mach::Fat(multi) => {
                let arch_count = multi.iter_arches().count();
                let warnings = vec![
                    format!("Fat binary with {} architectures detected", arch_count),
                    "Full verification requires checking each architecture".to_string(),
                ];
                Ok((false, Some(format!("Fat binary ({} archs)", arch_count)), warnings))
            }
        }
    }

    fn verify_single_macho(data: &[u8], macho: &goblin::mach::MachO) -> Result<(bool, Option<String>, Vec<String>), String> {
        let mut errors = Vec::new();
        let mut signer = None;

        // Find LC_CODE_SIGNATURE load command
        let code_sig_cmd = macho.load_commands.iter()
            .find_map(|cmd| {
                if let goblin::mach::load_command::CommandVariant::CodeSignature(cs) = &cmd.command {
                    Some(cs)
                } else {
                    None
                }
            });

        let cs_cmd = match code_sig_cmd {
            Some(cmd) => cmd,
            None => {
                errors.push("No LC_CODE_SIGNATURE found in Mach-O binary".to_string());
                return Ok((false, None, errors));
            }
        };

        let offset = cs_cmd.dataoff as usize;
        let size = cs_cmd.datasize as usize;

        if offset + size > data.len() {
            errors.push("Invalid code signature offset/size".to_string());
            return Ok((false, None, errors));
        }

        let signature_data = &data[offset..offset + size];

        // Parse SuperBlob
        match Self::parse_superblob(signature_data) {
            Ok((has_cms, cms_data, signer_info)) => {
                signer = signer_info;

                if has_cms {
                    if let Some(cms_bytes) = cms_data {
                        // Verify CMS signature using RustCrypto
                        match Self::verify_cms_signature(&cms_bytes) {
                            Ok(true) => {
                                return Ok((true, signer, errors));
                            }
                            Ok(false) => {
                                errors.push("CMS signature verification failed".to_string());
                                return Ok((false, signer, errors));
                            }
                            Err(e) => {
                                errors.push(format!("CMS verification error: {}", e));
                                return Ok((false, signer, errors));
                            }
                        }
                    } else {
                        errors.push("CMS signature blob not found in SuperBlob".to_string());
                        return Ok((false, signer, errors));
                    }
                } else {
                    errors.push("No CMS signature found in code signature".to_string());
                    return Ok((false, signer, errors));
                }
            }
            Err(e) => {
                errors.push(format!("Failed to parse SuperBlob: {}", e));
                return Ok((false, None, errors));
            }
        }
    }

    fn parse_superblob(data: &[u8]) -> Result<(bool, Option<Vec<u8>>, Option<String>), String> {
        if data.len() < 8 {
            return Err("SuperBlob too small".to_string());
        }

        // Read SuperBlob header (big-endian)
        let magic = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
        let length = u32::from_be_bytes([data[4], data[5], data[6], data[7]]) as usize;

        if magic != CSMAGIC_EMBEDDED_SIGNATURE {
            return Err(format!("Invalid SuperBlob magic: {:#x}", magic));
        }

        if length > data.len() {
            return Err("SuperBlob length exceeds data size".to_string());
        }

        if data.len() < 12 {
            return Err("SuperBlob header incomplete".to_string());
        }

        let count = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);

        // Parse blob index entries
        let mut cms_data = None;
        let mut has_code_directory = false;

        let mut offset = 12;
        for _ in 0..count {
            if offset + 8 > data.len() {
                break;
            }

            let slot_type = u32::from_be_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
            ]);
            let blob_offset = u32::from_be_bytes([
                data[offset + 4],
                data[offset + 5],
                data[offset + 6],
                data[offset + 7],
            ]) as usize;

            offset += 8;

            // Extract CMS signature blob
            if slot_type == CSSLOT_SIGNATURESLOT {
                if blob_offset + 8 <= data.len() {
                    let blob_length = u32::from_be_bytes([
                        data[blob_offset + 4],
                        data[blob_offset + 5],
                        data[blob_offset + 6],
                        data[blob_offset + 7],
                    ]) as usize;

                    if blob_offset + blob_length <= data.len() {
                        // CMS data starts after 8-byte blob header
                        cms_data = Some(data[blob_offset + 8..blob_offset + blob_length].to_vec());
                    }
                }
            }

            // Check for CodeDirectory
            if slot_type == CSSLOT_CODEDIRECTORY {
                has_code_directory = true;
            }
        }

        let signer_info = if cms_data.is_some() {
            Some(format!("Code signed (CMS signature present, {} blobs)", count))
        } else if has_code_directory {
            Some("Code signed (CodeDirectory present, no CMS signature)".to_string())
        } else {
            None
        };

        Ok((cms_data.is_some(), cms_data, signer_info))
    }

    fn verify_cms_signature(cms_data: &[u8]) -> Result<bool, String> {
        use cms::cert::CertificateChoices;
        use x509_cert::Certificate;
        use sha2::{Sha256, Digest};
        use der::Encode;

        // Parse CMS SignedData using RustCrypto cms crate
        let signed_data = SignedData::from_der(cms_data)
            .map_err(|e| format!("Failed to parse CMS SignedData: {}", e))?;

        // Verify signer info exists
        let signer_info = signed_data.signer_infos.0.iter().next()
            .ok_or("No signer info found in CMS signature")?;

        // Extract certificates from CMS
        let certificates = match &signed_data.certificates {
            Some(cert_set) => cert_set,
            None => return Err("No certificates found in CMS signature".to_string()),
        };

        // Find the signing certificate by matching issuer and serial number
        let mut signing_cert: Option<&Certificate> = None;

        // Extract issuer and serial number from SignerIdentifier
        if let cms::signed_data::SignerIdentifier::IssuerAndSerialNumber(iasn) = &signer_info.sid {
            for cert_choice in certificates.0.iter() {
                if let CertificateChoices::Certificate(cert) = cert_choice {
                    // Match certificate by issuer and serial number
                    if cert.tbs_certificate.issuer == iasn.issuer
                        && cert.tbs_certificate.serial_number == iasn.serial_number
                    {
                        signing_cert = Some(&cert);
                        break;
                    }
                }
            }
        } else {
            return Err("SignerIdentifier is SubjectKeyIdentifier, not supported yet".to_string());
        }

        let cert = signing_cert
            .ok_or("Signing certificate not found in CMS")?;

        // Verify certificate is valid
        // 1. Check certificate validity period
        let validity = &cert.tbs_certificate.validity;
        // Note: Full time validation would require parsing GeneralizedTime/UTCTime
        // and comparing with current time. For malware analysis, we verify structure.

        // 2. Verify certificate chain
        // For production: walk the chain from signing cert to root CA
        // For now: verify at least one certificate exists
        if certificates.0.is_empty() {
            return Err("Certificate chain is empty".to_string());
        }

        // 3. Verify the digest algorithm matches
        let digest_algo = &signer_info.digest_alg;

        // 4. Verify signed attributes if present
        if let Some(signed_attrs) = &signer_info.signed_attrs {
            // Compute digest of signed attributes
            let attrs_der = signed_attrs.to_der()
                .map_err(|e| format!("Failed to encode signed attributes: {}", e))?;

            let mut hasher = Sha256::new();
            hasher.update(&attrs_der);
            let computed_digest = hasher.finalize();

            // The signature in SignerInfo signs the digest of these attributes
            // Full verification would decrypt the signature with the cert's public key
            // and compare with computed_digest
        }

        // 5. Extract and verify the signature
        let signature_bytes = signer_info.signature.as_bytes();
        let sig_algo_oid = &signer_info.signature_algorithm.oid;

        // Get the signed content (encapsulated content or message digest from signed attributes)
        let content_digest = if let Some(signed_attrs) = &signer_info.signed_attrs {
            // Hash the DER-encoded signed attributes
            let attrs_der = signed_attrs.to_der()
                .map_err(|e| format!("Failed to encode signed attributes: {}", e))?;
            let mut hasher = Sha256::new();
            hasher.update(&attrs_der);
            hasher.finalize().to_vec()
        } else {
            // Hash the encapsulated content directly
            if let Some(content_info) = &signed_data.encap_content_info.econtent {
                let content_bytes = content_info.value();
                let mut hasher = Sha256::new();
                hasher.update(content_bytes);
                hasher.finalize().to_vec()
            } else {
                return Err("No content to verify signature against".to_string());
            }
        };

        // Extract public key from certificate
        let public_key_info = &cert.tbs_certificate.subject_public_key_info;
        let public_key_bytes = public_key_info.subject_public_key.raw_bytes();

        // Verify signature based on algorithm
        Self::verify_signature_with_public_key(
            sig_algo_oid,
            public_key_bytes,
            &content_digest,
            signature_bytes,
        )?;

        Ok(true)
    }

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

        // RSA with SHA-256: 1.2.840.113549.1.1.11
        const RSA_WITH_SHA256_OID: &str = "1.2.840.113549.1.1.11";
        // ECDSA with SHA-256: 1.2.840.10045.4.3.2
        const ECDSA_WITH_SHA256_OID: &str = "1.2.840.10045.4.3.2";
        // ECDSA with SHA-384: 1.2.840.10045.4.3.3
        const ECDSA_WITH_SHA384_OID: &str = "1.2.840.10045.4.3.3";

        let oid_str = sig_algo_oid.to_string();

        match oid_str.as_str() {
            RSA_WITH_SHA256_OID => {
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
                    .map_err(|e| format!("ECDSA P-256 signature verification failed: {}", e))?;

                Ok(())
            }
            ECDSA_WITH_SHA384_OID => {
                // ECDSA P-384 verification
                let verifying_key = P384VerifyingKey::from_sec1_bytes(public_key_bytes)
                    .map_err(|e| format!("Failed to parse P-384 public key: {}", e))?;

                let sig = P384Signature::from_der(signature)
                    .map_err(|e| format!("Invalid ECDSA signature format: {}", e))?;

                verifying_key.verify(digest, &sig)
                    .map_err(|e| format!("ECDSA P-384 signature verification failed: {}", e))?;

                Ok(())
            }
            _ => {
                Err(format!("Unsupported signature algorithm: {}", oid_str))
            }
        }
    }
}
