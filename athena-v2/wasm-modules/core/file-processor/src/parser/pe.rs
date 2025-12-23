use crate::types::{
    FileFormat, ParsedFile, FileMetadata, FileSection, ProcessorResult, FileProcessorError,
    SuspiciousIndicator, SuspiciousSeverity, FileIntegrity
};
use crate::extractor::ContentExtractor;
use crate::parser::authenticode;
use std::collections::HashMap;
use goblin::pe::PE;

/// Parse PE (Portable Executable) files using goblin
pub fn parse_pe(buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
    // Parse PE using goblin
    let pe = PE::parse(buffer).map_err(|e| {
        FileProcessorError::MalformedStructure(format!("Failed to parse PE: {}", e))
    })?;

    // Create metadata
    let mut attributes = HashMap::new();

    // Add PE-specific attributes
    if let Some(header) = pe.header.optional_header {
        attributes.insert("subsystem".to_string(), format!("{:?}", header.windows_fields.subsystem));
        attributes.insert("dll_characteristics".to_string(), format!("{:#x}", header.windows_fields.dll_characteristics));
        attributes.insert("image_base".to_string(), format!("{:#x}", header.windows_fields.image_base));
        attributes.insert("entry_point".to_string(), format!("{:#x}", pe.entry));
        attributes.insert("size_of_image".to_string(), header.windows_fields.size_of_image.to_string());
        attributes.insert("linker_version".to_string(),
            format!("{}.{}", header.standard_fields.major_linker_version, header.standard_fields.minor_linker_version));
    }

    // Add COFF header info
    attributes.insert("machine".to_string(), format!("{:?}", pe.header.coff_header.machine));
    attributes.insert("number_of_sections".to_string(), pe.header.coff_header.number_of_sections.to_string());
    attributes.insert("timestamp".to_string(), pe.header.coff_header.time_date_stamp.to_string());
    attributes.insert("characteristics".to_string(), format!("{:#x}", pe.header.coff_header.characteristics));

    // Determine if DLL or EXE
    let is_dll = pe.is_lib;
    attributes.insert("is_dll".to_string(), is_dll.to_string());

    let mut metadata = FileMetadata {
        size: buffer.len(),
        hash: super::calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(format.clone()),
        created_at: None,
        modified_at: None,
        attributes,
    };

    // Parse sections
    let mut sections = Vec::new();
    let mut suspicious_indicators = Vec::new();

    for section in &pe.sections {
        let name = section.name().unwrap_or("").to_string();
        let offset = section.pointer_to_raw_data as usize;
        let size = section.size_of_raw_data as usize;

        // Calculate entropy for this section with overflow protection
        let end = offset.checked_add(size).unwrap_or(usize::MAX);
        if end > buffer.len() {
            // Section extends beyond file bounds - skip or use available data
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "malformed_section".to_string(),
                description: format!("Section '{}' extends beyond file bounds", name),
                severity: SuspiciousSeverity::High,
                location: Some(format!("Section: {}", name)),
                evidence: format!("Offset: {:#x}, Size: {:#x}, File size: {:#x}", offset, size, buffer.len()),
            });
        }
        let section_data = buffer.get(offset..end.min(buffer.len()))
            .unwrap_or(&[]);
        let entropy = calculate_entropy(section_data);

        // Parse section flags
        let mut section_flags = Vec::new();
        let characteristics = section.characteristics;

        if characteristics & 0x00000020 != 0 { section_flags.push("CODE".to_string()); }
        if characteristics & 0x00000040 != 0 { section_flags.push("INITIALIZED_DATA".to_string()); }
        if characteristics & 0x00000080 != 0 { section_flags.push("UNINITIALIZED_DATA".to_string()); }
        if characteristics & 0x20000000 != 0 { section_flags.push("EXECUTABLE".to_string()); }
        if characteristics & 0x40000000 != 0 { section_flags.push("READABLE".to_string()); }
        if characteristics & 0x80000000 != 0 { section_flags.push("WRITABLE".to_string()); }

        // Detect suspicious characteristics
        if characteristics & 0x20000000 != 0 && characteristics & 0x80000000 != 0 {
            // Writable + Executable = suspicious
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "suspicious_section_flags".to_string(),
                description: format!("Section '{}' is both writable and executable", name),
                severity: SuspiciousSeverity::High,
                location: Some(format!("Section: {}", name)),
                evidence: format!("Characteristics: {:#x}", characteristics),
            });
        }

        // High entropy in executable sections = possible packing/encryption
        if entropy > 7.2 && characteristics & 0x00000020 != 0 {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "high_entropy_code".to_string(),
                description: format!("Code section '{}' has high entropy ({:.2}), possibly packed/encrypted", name, entropy),
                severity: SuspiciousSeverity::Medium,
                location: Some(format!("Section: {}", name)),
                evidence: format!("Entropy: {:.2}", entropy),
            });
        }

        sections.push(FileSection {
            name,
            offset,
            size,
            entropy,
            flags: section_flags,
        });
    }

    // Extract imports (DLLs and functions)
    for import in &pe.imports {
        // Check for suspicious imports
        let dll_name = import.name.to_lowercase().to_string();

        if dll_name.contains("urlmon") || dll_name.contains("wininet") {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "network_capability".to_string(),
                description: format!("Imports network library: {}", import.name),
                severity: SuspiciousSeverity::Low,
                location: Some("Imports".to_string()),
                evidence: import.name.to_string(),
            });
        }

        if dll_name.contains("psapi") || dll_name.contains("toolhelp") {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "process_enumeration".to_string(),
                description: format!("Imports process enumeration library: {}", import.name),
                severity: SuspiciousSeverity::Medium,
                location: Some("Imports".to_string()),
                evidence: import.name.to_string(),
            });
        }

        // Check for suspicious function imports
        // Note: goblin's PE imports don't directly expose function names in the simple iterator
        // For complete function-level analysis, you'd need to parse import_data directly
    }

    // Extract exports
    for export in &pe.exports {
        if let Some(name) = export.name {
            // Check for suspicious export names
            let export_name = name.to_lowercase();
            if export_name.contains("dll") && export_name.contains("main") {
                // DllMain is normal, but other dll* functions might be suspicious
            }
        }
    }

    // Check for overlay (data after last section) with overflow protection
    if let Some(last_section) = pe.sections.last() {
        let offset = last_section.pointer_to_raw_data as usize;
        let size = last_section.size_of_raw_data as usize;
        if let Some(last_section_end) = offset.checked_add(size) {
            if last_section_end < buffer.len() {
                let overlay_size = buffer.len() - last_section_end;
                if overlay_size > 1024 { // More than 1KB overlay is suspicious
                    suspicious_indicators.push(SuspiciousIndicator {
                        indicator_type: "overlay_data".to_string(),
                        description: format!("PE has {} bytes of overlay data after last section", overlay_size),
                        severity: SuspiciousSeverity::Medium,
                        location: Some(format!("Offset: {:#x}", last_section_end)),
                        evidence: format!("Overlay size: {} bytes", overlay_size),
                    });
                }
            }
        }
    }

    // Check certificates (Authenticode signatures) - comprehensive malware analysis
    let signature_valid = if !pe.certificates.is_empty() {
        // Use comprehensive Authenticode analysis for malware detection
        let auth_result = authenticode::analyze_authenticode(&pe, buffer);

        // Add signer certificate info to attributes
        if let Some(signer) = auth_result.certificate_chain.first() {
            if let Some(ref cn) = signer.subject_cn {
                metadata.attributes.insert("cert_subject".to_string(), cn.clone());
            }
            if let Some(ref org) = signer.organization {
                metadata.attributes.insert("cert_organization".to_string(), org.clone());
            }
            if let Some(ref issuer) = signer.issuer_cn {
                metadata.attributes.insert("cert_issuer".to_string(), issuer.clone());
            }
            metadata.attributes.insert("cert_serial".to_string(), signer.serial_number.clone());
            if let Some(ref not_before) = signer.not_before {
                metadata.attributes.insert("cert_not_before".to_string(), not_before.clone());
            }
            if let Some(ref not_after) = signer.not_after {
                metadata.attributes.insert("cert_not_after".to_string(), not_after.clone());
            }
            metadata.attributes.insert("cert_thumbprint_sha1".to_string(), signer.thumbprint_sha1.clone());
            metadata.attributes.insert("cert_thumbprint_sha256".to_string(), signer.thumbprint_sha256.clone());
            metadata.attributes.insert("cert_has_code_signing_eku".to_string(), signer.has_code_signing_eku.to_string());
            metadata.attributes.insert("cert_is_self_signed".to_string(), signer.is_self_signed.to_string());
        }

        metadata.attributes.insert("cert_chain_length".to_string(), auth_result.chain_length.to_string());
        metadata.attributes.insert("cert_chain_complete".to_string(), auth_result.chain_complete.to_string());
        metadata.attributes.insert("cert_trust_level".to_string(), format!("{:?}", auth_result.trust_level));

        // Add hash verification results
        if let Some(valid) = auth_result.hash_valid {
            metadata.attributes.insert("authenticode_hash_valid".to_string(), valid.to_string());
        }
        if let Some(ref algo) = auth_result.hash_algorithm {
            metadata.attributes.insert("authenticode_hash_algorithm".to_string(), algo.clone());
        }

        // Add counter-signature info if present
        if let Some(ref cs) = auth_result.counter_signature {
            if let Some(ref ts) = cs.timestamp {
                metadata.attributes.insert("cert_timestamp".to_string(), ts.clone());
            }
            if let Some(ref signer) = cs.signer_cn {
                metadata.attributes.insert("timestamp_signer".to_string(), signer.clone());
            }
        }

        // Add all suspicious indicators from Authenticode analysis
        for indicator in &auth_result.suspicious_indicators {
            let severity = match indicator.severity.as_str() {
                "Critical" => SuspiciousSeverity::Critical,
                "High" => SuspiciousSeverity::High,
                "Medium" => SuspiciousSeverity::Medium,
                _ => SuspiciousSeverity::Low,
            };
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: indicator.indicator_type.clone(),
                description: indicator.description.clone(),
                severity,
                location: Some("Authenticode signature".to_string()),
                evidence: indicator.evidence.clone(),
            });
        }

        // Add any errors as indicators
        for error in &auth_result.errors {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "certificate_error".to_string(),
                description: error.clone(),
                severity: SuspiciousSeverity::Medium,
                location: Some("Certificate table".to_string()),
                evidence: format!("Chain length: {}", auth_result.chain_length),
            });
        }

        // Check for known bad certificate
        if auth_result.known_bad_cert {
            metadata.attributes.insert("known_bad_certificate".to_string(), "true".to_string());
            if let Some(ref name) = auth_result.known_bad_cert_name {
                metadata.attributes.insert("known_bad_cert_name".to_string(), name.clone());
            }
        }

        // Determine signature validity
        Some(auth_result.hash_valid.unwrap_or(false) && auth_result.structure_valid)
    } else {
        // No signature
        if !is_dll {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "unsigned_executable".to_string(),
                description: "Executable is not digitally signed".to_string(),
                severity: SuspiciousSeverity::Low,
                location: None,
                evidence: "No certificate table found".to_string(),
            });
        }
        None
    };

    // Extract strings
    let extractor = ContentExtractor::new();
    let strings = extractor.extract_strings(buffer, 4);
    let strings = strings.into_iter().take(100).collect();

    // File integrity
    let integrity = FileIntegrity {
        valid_structure: true, // goblin successfully parsed it
        checksum_valid: None, // Could validate PE checksum if needed
        signature_valid,
        issues: Vec::new(),
    };

    Ok(ParsedFile {
        format,
        metadata,
        sections,
        embedded_files: Vec::new(), // Could extract resources/embedded files
        strings,
        suspicious_indicators,
        integrity,
    })
}

/// Extract PE metadata only (lighter weight than full parsing)
pub fn extract_pe_metadata(buffer: &[u8], metadata: &mut FileMetadata) -> ProcessorResult<()> {
    let pe = PE::parse(buffer).map_err(|e| {
        FileProcessorError::MalformedStructure(format!("Failed to parse PE: {}", e))
    })?;

    // Add PE-specific attributes
    if let Some(header) = pe.header.optional_header {
        metadata.attributes.insert("subsystem".to_string(), format!("{:?}", header.windows_fields.subsystem));
        metadata.attributes.insert("image_base".to_string(), format!("{:#x}", header.windows_fields.image_base));
        metadata.attributes.insert("entry_point".to_string(), format!("{:#x}", pe.entry));
    }

    metadata.attributes.insert("machine".to_string(), format!("{:?}", pe.header.coff_header.machine));
    metadata.attributes.insert("is_dll".to_string(), pe.is_lib.to_string());

    Ok(())
}

/// Calculate Shannon entropy of data (0.0 to 8.0)
fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let mut counts = [0u32; 256];
    for &byte in data {
        counts[byte as usize] += 1;
    }

    let len = data.len() as f64;
    let mut entropy = 0.0;

    for &count in &counts {
        if count > 0 {
            let p = count as f64 / len;
            entropy -= p * p.log2();
        }
    }

    entropy
}
