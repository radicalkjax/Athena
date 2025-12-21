use crate::types::{
    FileFormat, ParsedFile, FileMetadata, FileSection, ProcessorResult, FileProcessorError,
    SuspiciousIndicator, SuspiciousSeverity, FileIntegrity
};
use crate::extractor::ContentExtractor;
use std::collections::HashMap;
use goblin::mach::{Mach, MachO};

/// Parse Mach-O (macOS/iOS executables) files using goblin
pub fn parse_macho(buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
    // Parse Mach-O using goblin (handles both single and fat binaries)
    let mach = Mach::parse(buffer).map_err(|e| {
        FileProcessorError::MalformedStructure(format!("Failed to parse Mach-O: {}", e))
    })?;

    match mach {
        Mach::Binary(macho) => parse_single_macho(buffer, &macho, format),
        Mach::Fat(multi) => parse_fat_macho(buffer, multi, format),
    }
}

/// Parse a single Mach-O binary
fn parse_single_macho(buffer: &[u8], macho: &MachO, format: FileFormat) -> ProcessorResult<ParsedFile> {
    // Create metadata
    let mut attributes = HashMap::new();

    // Add Mach-O header attributes
    attributes.insert("cputype".to_string(), format!("{:#x}", macho.header.cputype));
    attributes.insert("cpusubtype".to_string(), format!("{:#x}", macho.header.cpusubtype));
    attributes.insert("filetype".to_string(), format!("{:#x}", macho.header.filetype));
    attributes.insert("ncmds".to_string(), macho.header.ncmds.to_string());
    attributes.insert("flags".to_string(), format!("{:#x}", macho.header.flags));
    attributes.insert("is_64".to_string(), macho.is_64.to_string());
    attributes.insert("little_endian".to_string(), macho.little_endian.to_string());
    attributes.insert("entry".to_string(), format!("{:#x}", macho.entry));

    let metadata = FileMetadata {
        size: buffer.len(),
        hash: super::calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(format.clone()),
        created_at: None,
        modified_at: None,
        attributes,
    };

    // Parse sections from segments
    let mut sections = Vec::new();
    let mut suspicious_indicators = Vec::new();

    for segment in &macho.segments {
        let segment_name = segment.name().unwrap_or("");

        for section_result in segment {
            if let Ok((section, data)) = section_result {
                let section_name = section.name().unwrap_or("");
                let full_name = format!("{},{}", segment_name, section_name);

                let entropy = super::calculate_entropy(data);

                // Parse section flags
                let mut flags = Vec::new();
                let section_flags = section.flags;

                // Check for executable sections
                if section_flags & 0x80000000 != 0 { // S_ATTR_PURE_INSTRUCTIONS
                    flags.push("EXECUTABLE".to_string());
                }
                if section_flags & 0x00000400 != 0 { // S_ATTR_SOME_INSTRUCTIONS
                    flags.push("SOME_INSTRUCTIONS".to_string());
                }

                // Detect suspicious characteristics
                // High entropy in executable sections
                if entropy > 7.2 && (section_flags & 0x80000000 != 0 || section_flags & 0x00000400 != 0) {
                    suspicious_indicators.push(SuspiciousIndicator {
                        indicator_type: "high_entropy_code".to_string(),
                        description: format!("Executable section '{}' has high entropy ({:.2}), possibly packed/encrypted", full_name, entropy),
                        severity: SuspiciousSeverity::Medium,
                        location: Some(format!("Section: {}", full_name)),
                        evidence: format!("Entropy: {:.2}", entropy),
                    });
                }

                sections.push(FileSection {
                    name: full_name,
                    offset: section.offset as usize,
                    size: section.size as usize,
                    entropy,
                    flags,
                });
            }
        }
    }

    // Extract imports
    if let Ok(imports) = macho.imports() {
        for import in imports {
            let import_name = import.name.to_lowercase();

            // Check for suspicious imports
            if import_name.contains("dlopen") || import_name.contains("dlsym") {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "dynamic_loading".to_string(),
                    description: format!("Uses dynamic library loading: {}", import.name),
                    severity: SuspiciousSeverity::Medium,
                    location: Some("Imports".to_string()),
                    evidence: import.name.to_string(),
                });
            }

            if import_name.contains("ptrace") {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "anti_debug".to_string(),
                    description: format!("Uses ptrace (anti-debugging): {}", import.name),
                    severity: SuspiciousSeverity::High,
                    location: Some("Imports".to_string()),
                    evidence: import.name.to_string(),
                });
            }
        }
    }

    // Extract symbols
    if let Some(symbols) = &macho.symbols {
        let symbol_count = symbols.iter().count();
        if symbol_count == 0 {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "stripped_binary".to_string(),
                description: "Binary is stripped (no symbols)".to_string(),
                severity: SuspiciousSeverity::Low,
                location: Some("Symbol Table".to_string()),
                evidence: "Makes reverse engineering harder".to_string(),
            });
        }
    }

    // Check code signature
    let has_codesign = macho.load_commands.iter().any(|cmd| {
        matches!(cmd.command, goblin::mach::load_command::CommandVariant::CodeSignature(_))
    });

    if !has_codesign {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "unsigned_binary".to_string(),
            description: "Binary is not code-signed".to_string(),
            severity: SuspiciousSeverity::Medium,
            location: Some("Load Commands".to_string()),
            evidence: "No LC_CODE_SIGNATURE found".to_string(),
        });
    }

    // Extract strings
    let extractor = ContentExtractor::new();
    let strings = extractor.extract_strings(buffer, 4);
    let strings = strings.into_iter().take(100).collect();

    // File integrity
    let integrity = FileIntegrity {
        valid_structure: true, // goblin successfully parsed it
        checksum_valid: None,
        signature_valid: if has_codesign { Some(false) } else { None }, // Placeholder
        issues: Vec::new(),
    };

    Ok(ParsedFile {
        format,
        metadata,
        sections,
        embedded_files: Vec::new(),
        strings,
        suspicious_indicators,
        integrity,
    })
}

/// Parse a fat Mach-O binary (universal binary with multiple architectures)
fn parse_fat_macho(buffer: &[u8], multi: goblin::mach::MultiArch, format: FileFormat) -> ProcessorResult<ParsedFile> {
    let mut attributes = HashMap::new();
    let arch_count = multi.iter_arches().count();

    attributes.insert("fat_binary".to_string(), "true".to_string());
    attributes.insert("architecture_count".to_string(), arch_count.to_string());

    let metadata = FileMetadata {
        size: buffer.len(),
        hash: super::calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(format.clone()),
        created_at: None,
        modified_at: None,
        attributes,
    };

    let mut suspicious_indicators = Vec::new();

    // Detect if fat binary contains unusual number of architectures
    if arch_count > 4 {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "unusual_fat_binary".to_string(),
            description: format!("Fat binary contains {} architectures (unusually high)", arch_count),
            severity: SuspiciousSeverity::Low,
            location: Some("Fat Header".to_string()),
            evidence: format!("{} architectures", arch_count),
        });
    }

    // Extract strings
    let extractor = ContentExtractor::new();
    let strings = extractor.extract_strings(buffer, 4);
    let strings = strings.into_iter().take(100).collect();

    // File integrity
    let integrity = FileIntegrity {
        valid_structure: true,
        checksum_valid: None,
        signature_valid: None,
        issues: Vec::new(),
    };

    Ok(ParsedFile {
        format,
        metadata,
        sections: Vec::new(), // Could parse individual architectures
        embedded_files: Vec::new(),
        strings,
        suspicious_indicators,
        integrity,
    })
}

/// Extract Mach-O metadata only (lighter weight than full parsing)
pub fn extract_macho_metadata(buffer: &[u8], metadata: &mut FileMetadata) -> ProcessorResult<()> {
    let mach = Mach::parse(buffer).map_err(|e| {
        FileProcessorError::MalformedStructure(format!("Failed to parse Mach-O: {}", e))
    })?;

    match mach {
        Mach::Binary(macho) => {
            metadata.attributes.insert("cputype".to_string(), format!("{:#x}", macho.header.cputype));
            metadata.attributes.insert("filetype".to_string(), format!("{:#x}", macho.header.filetype));
            metadata.attributes.insert("is_64".to_string(), macho.is_64.to_string());
            metadata.attributes.insert("entry".to_string(), format!("{:#x}", macho.entry));
        }
        Mach::Fat(multi) => {
            let arch_count = multi.iter_arches().count();
            metadata.attributes.insert("fat_binary".to_string(), "true".to_string());
            metadata.attributes.insert("architecture_count".to_string(), arch_count.to_string());
        }
    }

    Ok(())
}
