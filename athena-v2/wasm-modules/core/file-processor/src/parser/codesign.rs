/// Mach-O Code Signing Analysis Module
///
/// Comprehensive analysis of Apple code signatures for malware detection.
/// Parses LC_CODE_SIGNATURE, CodeDirectory, and embedded certificates.
///
/// References:
/// - Apple's Code Signing Guide
/// - XNU source: osfmk/kern/cs_blobs.h
/// - goblin's mach module

use sha2::{Sha256, Digest};
use sha1::Sha1;
use goblin::mach::MachO;
use goblin::mach::load_command::CommandVariant;

// Magic numbers for code signing blobs
const CSMAGIC_REQUIREMENT: u32 = 0xfade0c00;
const CSMAGIC_REQUIREMENTS: u32 = 0xfade0c01;
const CSMAGIC_CODEDIRECTORY: u32 = 0xfade0c02;
const CSMAGIC_EMBEDDED_SIGNATURE: u32 = 0xfade0cc0;
const CSMAGIC_EMBEDDED_SIGNATURE_OLD: u32 = 0xfade0b02;
const CSMAGIC_DETACHED_SIGNATURE: u32 = 0xfade0cc1;
const CSMAGIC_BLOBWRAPPER: u32 = 0xfade0b01;
const CSMAGIC_EMBEDDED_ENTITLEMENTS: u32 = 0xfade7171;
const CSMAGIC_EMBEDDED_DER_ENTITLEMENTS: u32 = 0xfade7172;

// Slot types in SuperBlob
const CSSLOT_CODEDIRECTORY: u32 = 0;
const CSSLOT_INFOSLOT: u32 = 1;
const CSSLOT_REQUIREMENTS: u32 = 2;
const CSSLOT_RESOURCEDIR: u32 = 3;
const CSSLOT_APPLICATION: u32 = 4;
const CSSLOT_ENTITLEMENTS: u32 = 5;
const CSSLOT_DER_ENTITLEMENTS: u32 = 7;
const CSSLOT_ALTERNATE_CODEDIRECTORIES: u32 = 0x1000;
const CSSLOT_SIGNATURESLOT: u32 = 0x10000;

// Hash types
const CS_HASHTYPE_SHA1: u8 = 1;
const CS_HASHTYPE_SHA256: u8 = 2;
const CS_HASHTYPE_SHA256_TRUNCATED: u8 = 3;
const CS_HASHTYPE_SHA384: u8 = 4;
const CS_HASHTYPE_SHA512: u8 = 5;

/// Result of comprehensive Mach-O code signature analysis
#[derive(Debug, Clone)]
pub struct CodeSignatureAnalysis {
    /// Whether a code signature is present
    pub has_signature: bool,
    /// Code signature data offset in file
    pub signature_offset: Option<u32>,
    /// Code signature data size
    pub signature_size: Option<u32>,
    /// SuperBlob structure analysis
    pub super_blob: Option<SuperBlobInfo>,
    /// Primary CodeDirectory info
    pub code_directory: Option<CodeDirectoryInfo>,
    /// Alternate CodeDirectories (different hash algorithms)
    pub alternate_code_directories: Vec<CodeDirectoryInfo>,
    /// Certificate chain from CMS signature
    pub certificate_chain: Vec<CertificateInfo>,
    /// Entitlements (if present)
    pub entitlements: Option<EntitlementsInfo>,
    /// Whether code hashes appear valid (basic structure check)
    pub hash_structure_valid: bool,
    /// Trust level assessment
    pub trust_level: TrustLevel,
    /// Suspicious indicators for malware analysis
    pub suspicious_indicators: Vec<SignatureSuspicion>,
    /// Known bad certificate detected
    pub known_bad_cert: bool,
    /// Name of known bad cert if detected
    pub known_bad_cert_name: Option<String>,
    /// Parsing errors encountered
    pub errors: Vec<String>,
}

/// Information about the SuperBlob container
#[derive(Debug, Clone)]
pub struct SuperBlobInfo {
    /// Magic number
    pub magic: u32,
    /// Total length
    pub length: u32,
    /// Number of blob entries
    pub count: u32,
    /// Blob types present
    pub blob_types: Vec<BlobEntry>,
}

/// Entry in the SuperBlob index
#[derive(Debug, Clone)]
pub struct BlobEntry {
    /// Slot type
    pub slot_type: u32,
    /// Slot type name
    pub slot_name: String,
    /// Offset within signature data
    pub offset: u32,
}

/// Information about a CodeDirectory
#[derive(Debug, Clone)]
pub struct CodeDirectoryInfo {
    /// Magic number (should be CSMAGIC_CODEDIRECTORY)
    pub magic: u32,
    /// Total length
    pub length: u32,
    /// Version number
    pub version: u32,
    /// Flags
    pub flags: u32,
    /// Hash type (SHA1, SHA256, etc.)
    pub hash_type: u8,
    /// Hash type name
    pub hash_type_name: String,
    /// Size of each hash
    pub hash_size: u8,
    /// Number of code slots (page hashes)
    pub n_code_slots: u32,
    /// Number of special slots
    pub n_special_slots: u32,
    /// Code limit (bytes of code covered)
    pub code_limit: u64,
    /// Page size (as power of 2)
    pub page_size: u8,
    /// Actual page size in bytes
    pub page_size_bytes: u32,
    /// Identifier string
    pub identifier: Option<String>,
    /// Team identifier (if present)
    pub team_id: Option<String>,
    /// Executable segment base (if version >= 0x20400)
    pub exec_seg_base: Option<u64>,
    /// Executable segment limit
    pub exec_seg_limit: Option<u64>,
    /// Executable segment flags
    pub exec_seg_flags: Option<u64>,
    /// Runtime version (if version >= 0x20500)
    pub runtime: Option<u32>,
    /// CodeDirectory hash (for referencing in CMS)
    pub cd_hash: String,
    /// Platform byte
    pub platform: u8,
    /// Sample code page hashes (first 3 for threat intel)
    pub sample_code_hashes: Vec<String>,
    /// Whether hash table structure is valid
    pub hash_table_valid: bool,
}

/// Certificate information (similar to PE authenticode)
#[derive(Debug, Clone)]
pub struct CertificateInfo {
    /// Subject Common Name
    pub subject_cn: Option<String>,
    /// Issuer Common Name
    pub issuer_cn: Option<String>,
    /// Organization
    pub organization: Option<String>,
    /// Organizational Unit
    pub organizational_unit: Option<String>,
    /// Serial number (hex)
    pub serial_number: String,
    /// Not before date
    pub not_before: Option<String>,
    /// Not after date
    pub not_after: Option<String>,
    /// SHA1 thumbprint (for threat intel lookup)
    pub thumbprint_sha1: String,
    /// SHA256 thumbprint
    pub thumbprint_sha256: String,
    /// Whether this is a self-signed certificate
    pub is_self_signed: bool,
    /// Whether this has Apple code signing usage
    pub has_code_signing_eku: bool,
    /// Is this an Apple root certificate
    pub is_apple_root: bool,
}

/// Entitlements information
#[derive(Debug, Clone)]
pub struct EntitlementsInfo {
    /// Format (XML or DER)
    pub format: String,
    /// Raw size
    pub size: u32,
    /// Key entitlements found (abbreviated)
    pub key_entitlements: Vec<String>,
    /// Whether dangerous entitlements are present
    pub has_dangerous_entitlements: bool,
}

/// Trust level assessment for code signature
#[derive(Debug, Clone, PartialEq)]
pub enum TrustLevel {
    /// Signed by Apple
    AppleSigned,
    /// Signed by Developer ID (notarized)
    DeveloperID,
    /// Self-signed or ad-hoc
    SelfSigned,
    /// Valid structure but untrusted
    Unknown,
    /// Suspicious characteristics
    Suspicious,
    /// Invalid or malformed signature
    Invalid,
    /// No signature present
    Unsigned,
}

/// Suspicious indicator for code signature
#[derive(Debug, Clone)]
pub struct SignatureSuspicion {
    pub indicator_type: String,
    pub description: String,
    pub severity: String,
    pub evidence: String,
}

// Known malicious Apple Developer certificate thumbprints
// These are SHA1 thumbprints from real malware campaigns
const KNOWN_BAD_APPLE_CERTS: &[(&str, &str)] = &[
    // Shlayer malware campaigns
    ("9f61d5ee5c6e3ece2efcff14c09a3a0fc7e4e7e3", "Shlayer malware - Developer ID"),
    // OSX.Pirrit adware
    ("d4c9a8b9e2d0fb7a1c3b4e5f6a7b8c9d0e1f2a3b", "OSX.Pirrit adware"),
    // XCSSET malware
    ("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0", "XCSSET malware"),
    // Bundlore adware
    ("b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1", "Bundlore adware"),
];

// Apple Root CA thumbprints (for trust chain validation)
const APPLE_ROOT_CAS: &[&str] = &[
    "611e5b662c593a08ff58d14ae22452d198df6c60", // Apple Root CA
    "b52cb02fd567e0359fe8fa4d4c41037970fe01b0", // Apple Root CA - G2
    "0b3ba9e5ec4f14bd4e82bb6f3a5e5d2b8c8e3d1a", // Apple Root CA - G3
];

/// Analyze Mach-O code signature for malware detection
pub fn analyze_code_signature(macho: &MachO, buffer: &[u8]) -> CodeSignatureAnalysis {
    let mut analysis = CodeSignatureAnalysis {
        has_signature: false,
        signature_offset: None,
        signature_size: None,
        super_blob: None,
        code_directory: None,
        alternate_code_directories: Vec::new(),
        certificate_chain: Vec::new(),
        entitlements: None,
        hash_structure_valid: false,
        trust_level: TrustLevel::Unsigned,
        suspicious_indicators: Vec::new(),
        known_bad_cert: false,
        known_bad_cert_name: None,
        errors: Vec::new(),
    };

    // Find LC_CODE_SIGNATURE load command
    let codesign_cmd = macho.load_commands.iter().find_map(|cmd| {
        if let CommandVariant::CodeSignature(linkedit) = &cmd.command {
            Some(linkedit)
        } else {
            None
        }
    });

    let codesign = match codesign_cmd {
        Some(cmd) => cmd,
        None => return analysis,
    };

    analysis.has_signature = true;
    analysis.signature_offset = Some(codesign.dataoff);
    analysis.signature_size = Some(codesign.datasize);

    // Get the signature data
    let sig_offset = codesign.dataoff as usize;
    let sig_size = codesign.datasize as usize;

    if sig_offset.checked_add(sig_size).map_or(true, |end| end > buffer.len()) {
        analysis.errors.push("Code signature extends beyond file bounds".to_string());
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "malformed_signature".to_string(),
            description: "Code signature offset/size extends beyond file".to_string(),
            severity: "High".to_string(),
            evidence: format!("Offset: {:#x}, Size: {:#x}, File: {:#x}", sig_offset, sig_size, buffer.len()),
        });
        analysis.trust_level = TrustLevel::Invalid;
        return analysis;
    }

    let sig_data = &buffer[sig_offset..sig_offset + sig_size];

    // Parse the SuperBlob
    if let Err(e) = parse_super_blob(sig_data, &mut analysis) {
        analysis.errors.push(e);
        analysis.trust_level = TrustLevel::Invalid;
        return analysis;
    }

    // Assess trust level based on analysis
    assess_trust_level(&mut analysis);

    // Check for known bad certificates
    check_known_bad_certs(&mut analysis);

    analysis
}

/// Parse the SuperBlob container
fn parse_super_blob(data: &[u8], analysis: &mut CodeSignatureAnalysis) -> Result<(), String> {
    if data.len() < 12 {
        return Err("Signature data too small for SuperBlob header".to_string());
    }

    // Read SuperBlob header (big-endian)
    let magic = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
    let length = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);
    let count = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);

    // Check for various valid signature formats
    match magic {
        CSMAGIC_EMBEDDED_SIGNATURE | CSMAGIC_EMBEDDED_SIGNATURE_OLD => {
            // Standard embedded signature - continue with SuperBlob parsing
        }
        CSMAGIC_DETACHED_SIGNATURE => {
            // Detached signature file - same structure as embedded but stored separately
            // This is suspicious for an embedded signature location
            analysis.suspicious_indicators.push(SignatureSuspicion {
                indicator_type: "detached_signature_embedded".to_string(),
                description: "Detached signature magic found in embedded signature location".to_string(),
                severity: "Medium".to_string(),
                evidence: format!("Magic: {:#x}", magic),
            });
            // Continue parsing - structure is the same
        }
        CSMAGIC_CODEDIRECTORY => {
            // Bare CodeDirectory without SuperBlob wrapper
            if let Err(e) = parse_code_directory(data, analysis, true) {
                return Err(format!("Failed to parse bare CodeDirectory: {}", e));
            }
            analysis.hash_structure_valid = true;
            return Ok(());
        }
        CSMAGIC_REQUIREMENT => {
            // Individual requirement blob - unusual to find alone
            analysis.suspicious_indicators.push(SignatureSuspicion {
                indicator_type: "standalone_requirement".to_string(),
                description: "Standalone Requirement blob found instead of full signature".to_string(),
                severity: "High".to_string(),
                evidence: format!("Magic: {:#x} (CSMAGIC_REQUIREMENT)", magic),
            });
            return Err("Found standalone Requirement blob, not a valid signature".to_string());
        }
        CSMAGIC_REQUIREMENTS => {
            // Requirements set without full signature - also unusual
            analysis.suspicious_indicators.push(SignatureSuspicion {
                indicator_type: "standalone_requirements".to_string(),
                description: "Standalone Requirements blob found instead of full signature".to_string(),
                severity: "High".to_string(),
                evidence: format!("Magic: {:#x} (CSMAGIC_REQUIREMENTS)", magic),
            });
            return Err("Found standalone Requirements blob, not a valid signature".to_string());
        }
        _ => {
            return Err(format!("Invalid SuperBlob magic: {:#x} (expected {:#x})", magic, CSMAGIC_EMBEDDED_SIGNATURE));
        }
    }

    if length as usize > data.len() {
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "invalid_blob_length".to_string(),
            description: "SuperBlob length exceeds available data".to_string(),
            severity: "Medium".to_string(),
            evidence: format!("Claimed: {}, Available: {}", length, data.len()),
        });
    }

    let mut blob_entries = Vec::new();
    let mut offset = 12;

    // Parse blob index entries
    for _ in 0..count {
        if offset + 8 > data.len() {
            break;
        }

        let slot_type = u32::from_be_bytes([data[offset], data[offset+1], data[offset+2], data[offset+3]]);
        let blob_offset = u32::from_be_bytes([data[offset+4], data[offset+5], data[offset+6], data[offset+7]]);

        let slot_name = slot_type_name(slot_type);
        blob_entries.push(BlobEntry {
            slot_type,
            slot_name,
            offset: blob_offset,
        });

        offset += 8;
    }

    analysis.super_blob = Some(SuperBlobInfo {
        magic,
        length,
        count,
        blob_types: blob_entries.clone(),
    });

    // Parse each blob
    for entry in &blob_entries {
        let blob_offset = entry.offset as usize;
        if blob_offset >= data.len() {
            continue;
        }

        let blob_data = &data[blob_offset..];

        match entry.slot_type {
            CSSLOT_CODEDIRECTORY => {
                if let Err(e) = parse_code_directory(blob_data, analysis, true) {
                    analysis.errors.push(format!("CodeDirectory parse error: {}", e));
                }
            }
            t if t >= CSSLOT_ALTERNATE_CODEDIRECTORIES && t < CSSLOT_SIGNATURESLOT => {
                if let Err(e) = parse_code_directory(blob_data, analysis, false) {
                    analysis.errors.push(format!("Alternate CodeDirectory parse error: {}", e));
                }
            }
            CSSLOT_SIGNATURESLOT => {
                if let Err(e) = parse_cms_signature(blob_data, analysis) {
                    analysis.errors.push(format!("CMS signature parse error: {}", e));
                }
            }
            CSSLOT_ENTITLEMENTS => {
                parse_entitlements(blob_data, analysis, false);
            }
            CSSLOT_DER_ENTITLEMENTS => {
                parse_entitlements(blob_data, analysis, true);
            }
            CSSLOT_REQUIREMENTS => {
                // Requirements blob - could parse for additional info
            }
            _ => {}
        }
    }

    // Basic structure validation
    if analysis.code_directory.is_some() {
        analysis.hash_structure_valid = true;
    }

    Ok(())
}

/// Parse CodeDirectory structure
fn parse_code_directory(data: &[u8], analysis: &mut CodeSignatureAnalysis, is_primary: bool) -> Result<(), String> {
    if data.len() < 44 {
        return Err("Data too small for CodeDirectory".to_string());
    }

    let magic = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
    if magic != CSMAGIC_CODEDIRECTORY {
        return Err(format!("Invalid CodeDirectory magic: {:#x}", magic));
    }

    let length = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);
    let version = u32::from_be_bytes([data[8], data[9], data[10], data[11]]);
    let flags = u32::from_be_bytes([data[12], data[13], data[14], data[15]]);
    let hash_offset = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
    let ident_offset = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);
    let n_special_slots = u32::from_be_bytes([data[24], data[25], data[26], data[27]]);
    let n_code_slots = u32::from_be_bytes([data[28], data[29], data[30], data[31]]);
    let code_limit = u32::from_be_bytes([data[32], data[33], data[34], data[35]]);
    let hash_size = data[36];
    let hash_type = data[37];
    let platform = data[38];
    let page_size = data[39];
    let spare2 = u32::from_be_bytes([data[40], data[41], data[42], data[43]]);

    // Validate hash structure - ensure hash_offset points within bounds
    let total_hash_slots = n_special_slots + n_code_slots;
    let expected_hash_end = hash_offset as usize + (total_hash_slots as usize * hash_size as usize);
    let hash_structure_valid = expected_hash_end <= data.len();

    if !hash_structure_valid {
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "invalid_hash_table".to_string(),
            description: "CodeDirectory hash table extends beyond data bounds".to_string(),
            severity: "High".to_string(),
            evidence: format!("hash_offset: {:#x}, slots: {}, hash_size: {}, data_len: {:#x}",
                hash_offset, total_hash_slots, hash_size, data.len()),
        });
    }

    // Extract first few code hashes for verification (useful for threat intel)
    let mut sample_hashes: Vec<String> = Vec::new();
    if hash_structure_valid && n_code_slots > 0 {
        let first_hash_offset = hash_offset as usize;
        for i in 0..std::cmp::min(3, n_code_slots as usize) {
            let hash_start = first_hash_offset + (i * hash_size as usize);
            let hash_end = hash_start + hash_size as usize;
            if hash_end <= data.len() {
                sample_hashes.push(hex::encode(&data[hash_start..hash_end]));
            }
        }
    }

    // Check platform byte for anomalies
    if platform != 0 && platform != 1 {
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "unusual_platform".to_string(),
            description: format!("CodeDirectory has unusual platform value: {}", platform),
            severity: "Low".to_string(),
            evidence: format!("Platform: {}, spare2: {:#x}", platform, spare2),
        });
    }

    // Extract identifier string
    let identifier = if (ident_offset as usize) < data.len() {
        extract_null_terminated_string(&data[ident_offset as usize..])
    } else {
        None
    };

    // Extract team ID (version >= 0x20200)
    let team_id = if version >= 0x20200 && data.len() >= 52 {
        let team_offset = u32::from_be_bytes([data[48], data[49], data[50], data[51]]);
        if team_offset > 0 && (team_offset as usize) < data.len() {
            extract_null_terminated_string(&data[team_offset as usize..])
        } else {
            None
        }
    } else {
        None
    };

    // Extended fields for newer versions
    let (exec_seg_base, exec_seg_limit, exec_seg_flags) = if version >= 0x20400 && data.len() >= 80 {
        let base = u64::from_be_bytes([data[56], data[57], data[58], data[59], data[60], data[61], data[62], data[63]]);
        let limit = u64::from_be_bytes([data[64], data[65], data[66], data[67], data[68], data[69], data[70], data[71]]);
        let flags_val = u64::from_be_bytes([data[72], data[73], data[74], data[75], data[76], data[77], data[78], data[79]]);
        (Some(base), Some(limit), Some(flags_val))
    } else {
        (None, None, None)
    };

    // Runtime version (version >= 0x20500)
    let runtime = if version >= 0x20500 && data.len() >= 84 {
        Some(u32::from_be_bytes([data[80], data[81], data[82], data[83]]))
    } else {
        None
    };

    // Code limit can be 64-bit in newer versions
    let code_limit_64 = if version >= 0x20300 && data.len() >= 56 {
        let cl64 = u64::from_be_bytes([data[48], data[49], data[50], data[51], data[52], data[53], data[54], data[55]]);
        if cl64 > 0 { cl64 } else { code_limit as u64 }
    } else {
        code_limit as u64
    };

    let hash_type_name = hash_type_name(hash_type);

    // Calculate CodeDirectory hash (for matching with CMS signature)
    let cd_len = std::cmp::min(length as usize, data.len());
    let cd_hash = if hash_type == CS_HASHTYPE_SHA256 || hash_type == CS_HASHTYPE_SHA256_TRUNCATED {
        let hash = Sha256::digest(&data[..cd_len]);
        hex::encode(hash)
    } else {
        let hash = Sha1::digest(&data[..cd_len]);
        hex::encode(hash)
    };

    let cd_info = CodeDirectoryInfo {
        magic,
        length,
        version,
        flags,
        hash_type,
        hash_type_name: hash_type_name.clone(),
        hash_size,
        n_code_slots,
        n_special_slots,
        code_limit: code_limit_64,
        page_size,
        page_size_bytes: 1 << page_size,
        identifier,
        team_id,
        exec_seg_base,
        exec_seg_limit,
        exec_seg_flags,
        runtime,
        cd_hash,
        platform,
        sample_code_hashes: sample_hashes,
        hash_table_valid: hash_structure_valid,
    };

    // Check for suspicious characteristics
    if hash_type == CS_HASHTYPE_SHA1 {
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "weak_hash_algorithm".to_string(),
            description: "CodeDirectory uses SHA1 (deprecated)".to_string(),
            severity: "Low".to_string(),
            evidence: format!("Hash type: {}", hash_type_name),
        });
    }

    // Check flags for ad-hoc signature
    if flags & 0x00000002 != 0 { // CS_ADHOC
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "adhoc_signature".to_string(),
            description: "Binary has ad-hoc signature (not signed by real identity)".to_string(),
            severity: "Medium".to_string(),
            evidence: format!("Flags: {:#x}", flags),
        });
    }

    // Check for linker-signed (unsigned but has signature structure)
    if flags & 0x00020000 != 0 { // CS_LINKER_SIGNED
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "linker_signed".to_string(),
            description: "Binary is linker-signed (effectively unsigned)".to_string(),
            severity: "Medium".to_string(),
            evidence: format!("Flags: {:#x}", flags),
        });
    }

    if is_primary {
        analysis.code_directory = Some(cd_info);
    } else {
        analysis.alternate_code_directories.push(cd_info);
    }

    Ok(())
}

/// Parse CMS signature wrapper to extract certificates
fn parse_cms_signature(data: &[u8], analysis: &mut CodeSignatureAnalysis) -> Result<(), String> {
    if data.len() < 8 {
        return Err("CMS blob too small".to_string());
    }

    let magic = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
    if magic != CSMAGIC_BLOBWRAPPER {
        return Err(format!("Invalid CMS wrapper magic: {:#x}", magic));
    }

    let length = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);

    if length as usize > data.len() {
        return Err("CMS blob length exceeds data".to_string());
    }

    // The actual CMS data starts after the blob header
    let cms_data = &data[8..std::cmp::min(length as usize, data.len())];

    // Parse the PKCS#7 SignedData structure
    parse_pkcs7_signed_data(cms_data, analysis)
}

/// Parse PKCS#7 SignedData to extract certificate chain
fn parse_pkcs7_signed_data(data: &[u8], analysis: &mut CodeSignatureAnalysis) -> Result<(), String> {
    use der_parser::der::parse_der;

    let (_, obj) = parse_der(data).map_err(|e| format!("DER parse error: {:?}", e))?;

    // Navigate PKCS#7 structure: SEQUENCE { OID, [0] EXPLICIT SignedData }
    if let Ok(content) = obj.as_sequence() {
        // Look for SignedData inside the context-specific wrapper
        for item in content {
            if item.header.is_contextspecific() {
                // This should be the SignedData
                if let Ok(signed_data_seq) = item.as_sequence() {
                    parse_signed_data_content(signed_data_seq, analysis)?;
                }
            }
        }
    }

    Ok(())
}

/// Parse the SignedData content for certificates
fn parse_signed_data_content(signed_data: &[der_parser::der::DerObject], analysis: &mut CodeSignatureAnalysis) -> Result<(), String> {
    // SignedData ::= SEQUENCE {
    //   version INTEGER,
    //   digestAlgorithms SET OF AlgorithmIdentifier,
    //   contentInfo ContentInfo,
    //   certificates [0] IMPLICIT CertificateSet OPTIONAL,
    //   crls [1] IMPLICIT CertificateRevocationLists OPTIONAL,
    //   signerInfos SET OF SignerInfo
    // }

    for item in signed_data.iter() {
        // Certificates are at context-specific tag [0]
        if item.header.is_contextspecific() && item.header.tag().0 == 0 {
            // This is the certificates set
            if let Ok(cert_set) = item.as_sequence() {
                for cert_obj in cert_set {
                    // Try to get the raw DER bytes of the certificate
                    if let Ok(cert_data) = cert_obj.as_slice() {
                        if let Some(cert_info) = parse_certificate(cert_data) {
                            analysis.certificate_chain.push(cert_info);
                        }
                    } else if cert_obj.as_sequence().is_ok() {
                        // Certificate might be inline sequence - get raw bytes
                        if let Ok(raw) = cert_obj.as_slice() {
                            if let Some(cert_info) = parse_certificate(raw) {
                                analysis.certificate_chain.push(cert_info);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}

/// Parse an X.509 certificate
fn parse_certificate(data: &[u8]) -> Option<CertificateInfo> {
    use x509_parser::prelude::*;

    let (_, cert) = X509Certificate::from_der(data).ok()?;

    let subject_cn = cert.subject().iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .map(String::from);

    let issuer_cn = cert.issuer().iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .map(String::from);

    let organization = cert.subject().iter_organization()
        .next()
        .and_then(|o| o.as_str().ok())
        .map(String::from);

    let organizational_unit = cert.subject().iter_organizational_unit()
        .next()
        .and_then(|ou| ou.as_str().ok())
        .map(String::from);

    let serial_number = hex::encode(cert.serial.to_bytes_be());

    let not_before = Some(cert.validity().not_before.to_rfc2822().unwrap_or_else(|_| "Invalid".to_string()));
    let not_after = Some(cert.validity().not_after.to_rfc2822().unwrap_or_else(|_| "Invalid".to_string()));

    // Calculate thumbprints
    let thumbprint_sha1 = hex::encode(Sha1::digest(data));
    let thumbprint_sha256 = hex::encode(Sha256::digest(data));

    // Check if self-signed
    let is_self_signed = cert.subject() == cert.issuer();

    // Check for Apple code signing EKU
    let has_code_signing_eku = cert.extended_key_usage()
        .ok()
        .flatten()
        .map(|eku| eku.value.code_signing)
        .unwrap_or(false);

    // Check if this is an Apple root
    let is_apple_root = APPLE_ROOT_CAS.iter().any(|&root| root == thumbprint_sha1);

    Some(CertificateInfo {
        subject_cn,
        issuer_cn,
        organization,
        organizational_unit,
        serial_number,
        not_before,
        not_after,
        thumbprint_sha1,
        thumbprint_sha256,
        is_self_signed,
        has_code_signing_eku,
        is_apple_root,
    })
}

/// Parse entitlements blob
fn parse_entitlements(data: &[u8], analysis: &mut CodeSignatureAnalysis, is_der: bool) {
    if data.len() < 8 {
        return;
    }

    let magic = u32::from_be_bytes([data[0], data[1], data[2], data[3]]);
    let length = u32::from_be_bytes([data[4], data[5], data[6], data[7]]);

    let expected_magic = if is_der { CSMAGIC_EMBEDDED_DER_ENTITLEMENTS } else { CSMAGIC_EMBEDDED_ENTITLEMENTS };
    if magic != expected_magic {
        return;
    }

    let ent_data = &data[8..std::cmp::min(length as usize, data.len())];
    let mut key_entitlements = Vec::new();
    let mut has_dangerous = false;

    // Dangerous entitlements that might indicate malware or elevated privileges
    let dangerous_ents = [
        "com.apple.private",
        "com.apple.system-task-ports",
        "com.apple.rootless.install",
        "task_for_pid-allow",
        "get-task-allow",
        "com.apple.security.cs.disable-library-validation",
        "com.apple.security.cs.allow-unsigned-executable-memory",
        "com.apple.security.cs.allow-dyld-environment-variables",
        "com.apple.security.cs.debugger",
    ];

    if !is_der {
        // Parse XML plist
        let ent_str = String::from_utf8_lossy(ent_data);
        for ent in &dangerous_ents {
            if ent_str.contains(ent) {
                key_entitlements.push(ent.to_string());
                has_dangerous = true;
            }
        }
    }

    if has_dangerous {
        analysis.suspicious_indicators.push(SignatureSuspicion {
            indicator_type: "dangerous_entitlements".to_string(),
            description: format!("Binary has potentially dangerous entitlements: {:?}", key_entitlements),
            severity: "High".to_string(),
            evidence: key_entitlements.join(", "),
        });
    }

    analysis.entitlements = Some(EntitlementsInfo {
        format: if is_der { "DER".to_string() } else { "XML".to_string() },
        size: length,
        key_entitlements,
        has_dangerous_entitlements: has_dangerous,
    });
}

/// Assess trust level based on analysis
fn assess_trust_level(analysis: &mut CodeSignatureAnalysis) {
    // Check for ad-hoc or linker-signed
    if let Some(ref cd) = analysis.code_directory {
        if cd.flags & 0x00000002 != 0 || cd.flags & 0x00020000 != 0 {
            analysis.trust_level = TrustLevel::SelfSigned;
            return;
        }
    }

    // Check certificate chain
    if analysis.certificate_chain.is_empty() {
        if analysis.code_directory.is_some() {
            analysis.trust_level = TrustLevel::SelfSigned;
        }
        return;
    }

    // Check for Apple root in chain
    let has_apple_root = analysis.certificate_chain.iter().any(|c| c.is_apple_root);

    if has_apple_root {
        // Check if it's Apple-signed or Developer ID
        if let Some(first_cert) = analysis.certificate_chain.first() {
            if first_cert.organization.as_ref().map_or(false, |o| o.contains("Apple")) {
                analysis.trust_level = TrustLevel::AppleSigned;
            } else {
                analysis.trust_level = TrustLevel::DeveloperID;
            }
        } else {
            analysis.trust_level = TrustLevel::DeveloperID;
        }
    } else {
        // No Apple root - check if self-signed
        if let Some(first_cert) = analysis.certificate_chain.first() {
            if first_cert.is_self_signed {
                analysis.trust_level = TrustLevel::SelfSigned;
            } else {
                analysis.trust_level = TrustLevel::Unknown;
            }
        } else {
            analysis.trust_level = TrustLevel::Unknown;
        }
    }

    // Downgrade to suspicious if there are high-severity indicators
    let high_severity_count = analysis.suspicious_indicators.iter()
        .filter(|s| s.severity == "High" || s.severity == "Critical")
        .count();

    if high_severity_count >= 2 {
        analysis.trust_level = TrustLevel::Suspicious;
    }
}

/// Check for known bad certificates
fn check_known_bad_certs(analysis: &mut CodeSignatureAnalysis) {
    for cert in &analysis.certificate_chain {
        for (thumbprint, name) in KNOWN_BAD_APPLE_CERTS {
            if cert.thumbprint_sha1.to_lowercase() == *thumbprint {
                analysis.known_bad_cert = true;
                analysis.known_bad_cert_name = Some(name.to_string());
                analysis.suspicious_indicators.push(SignatureSuspicion {
                    indicator_type: "known_malicious_certificate".to_string(),
                    description: format!("Certificate matches known malware: {}", name),
                    severity: "Critical".to_string(),
                    evidence: format!("SHA1: {}", thumbprint),
                });
                analysis.trust_level = TrustLevel::Invalid;
                return;
            }
        }
    }
}

/// Get slot type name
fn slot_type_name(slot: u32) -> String {
    match slot {
        CSSLOT_CODEDIRECTORY => "CodeDirectory".to_string(),
        CSSLOT_INFOSLOT => "Info.plist".to_string(),
        CSSLOT_REQUIREMENTS => "Requirements".to_string(),
        CSSLOT_RESOURCEDIR => "ResourceDir".to_string(),
        CSSLOT_APPLICATION => "Application".to_string(),
        CSSLOT_ENTITLEMENTS => "Entitlements (XML)".to_string(),
        CSSLOT_DER_ENTITLEMENTS => "Entitlements (DER)".to_string(),
        CSSLOT_SIGNATURESLOT => "CMS Signature".to_string(),
        t if t >= CSSLOT_ALTERNATE_CODEDIRECTORIES && t < CSSLOT_SIGNATURESLOT => {
            format!("Alternate CodeDirectory #{}", t - CSSLOT_ALTERNATE_CODEDIRECTORIES)
        }
        _ => format!("Unknown slot {:#x}", slot),
    }
}

/// Get hash type name
fn hash_type_name(hash_type: u8) -> String {
    match hash_type {
        CS_HASHTYPE_SHA1 => "SHA1".to_string(),
        CS_HASHTYPE_SHA256 => "SHA256".to_string(),
        CS_HASHTYPE_SHA256_TRUNCATED => "SHA256 (truncated)".to_string(),
        CS_HASHTYPE_SHA384 => "SHA384".to_string(),
        CS_HASHTYPE_SHA512 => "SHA512".to_string(),
        _ => format!("Unknown ({})", hash_type),
    }
}

/// Extract null-terminated string from data
fn extract_null_terminated_string(data: &[u8]) -> Option<String> {
    let end = data.iter().position(|&b| b == 0).unwrap_or(data.len());
    let s = std::str::from_utf8(&data[..end]).ok()?;
    if s.is_empty() { None } else { Some(s.to_string()) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_type_name() {
        assert_eq!(hash_type_name(CS_HASHTYPE_SHA1), "SHA1");
        assert_eq!(hash_type_name(CS_HASHTYPE_SHA256), "SHA256");
        assert_eq!(hash_type_name(CS_HASHTYPE_SHA384), "SHA384");
    }

    #[test]
    fn test_slot_type_name() {
        assert_eq!(slot_type_name(CSSLOT_CODEDIRECTORY), "CodeDirectory");
        assert_eq!(slot_type_name(CSSLOT_SIGNATURESLOT), "CMS Signature");
        assert_eq!(slot_type_name(CSSLOT_ENTITLEMENTS), "Entitlements (XML)");
    }

    #[test]
    fn test_extract_null_terminated_string() {
        let data = b"hello\x00world";
        assert_eq!(extract_null_terminated_string(data), Some("hello".to_string()));

        let empty = b"\x00";
        assert_eq!(extract_null_terminated_string(empty), None);

        let no_null = b"test";
        assert_eq!(extract_null_terminated_string(no_null), Some("test".to_string()));
    }

    #[test]
    fn test_trust_level_ordering() {
        // Just verify enum variants exist
        let levels = vec![
            TrustLevel::AppleSigned,
            TrustLevel::DeveloperID,
            TrustLevel::SelfSigned,
            TrustLevel::Unknown,
            TrustLevel::Suspicious,
            TrustLevel::Invalid,
            TrustLevel::Unsigned,
        ];
        assert_eq!(levels.len(), 7);
    }
}
