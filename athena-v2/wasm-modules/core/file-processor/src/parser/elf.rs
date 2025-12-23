use crate::types::{
    FileFormat, ParsedFile, FileMetadata, FileSection, ProcessorResult, FileProcessorError,
    SuspiciousIndicator, SuspiciousSeverity, FileIntegrity
};
use crate::extractor::ContentExtractor;
use std::collections::HashMap;
use goblin::elf::Elf;

/// Parse ELF (Executable and Linkable Format) files using goblin
pub fn parse_elf(buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
    // Parse ELF using goblin
    let elf = Elf::parse(buffer).map_err(|e| {
        FileProcessorError::MalformedStructure(format!("Failed to parse ELF: {}", e))
    })?;

    // Create metadata
    let mut attributes = HashMap::new();

    // Add ELF-specific attributes
    attributes.insert("class".to_string(),
        if elf.is_64 { "ELF64" } else { "ELF32" }.to_string()
    );
    attributes.insert("endianness".to_string(),
        if elf.little_endian { "little" } else { "big" }.to_string()
    );

    // ELF header info
    let file_type = match elf.header.e_type {
        goblin::elf::header::ET_NONE => "None",
        goblin::elf::header::ET_REL => "Relocatable",
        goblin::elf::header::ET_EXEC => "Executable",
        goblin::elf::header::ET_DYN => "Shared Object",
        goblin::elf::header::ET_CORE => "Core Dump",
        _ => "Unknown",
    };
    attributes.insert("file_type".to_string(), file_type.to_string());

    let arch = match elf.header.e_machine {
        goblin::elf::header::EM_NONE => "None",
        goblin::elf::header::EM_386 => "x86",
        goblin::elf::header::EM_ARM => "ARM",
        goblin::elf::header::EM_X86_64 => "x86-64",
        goblin::elf::header::EM_AARCH64 => "AArch64",
        _ => "Unknown",
    };
    attributes.insert("architecture".to_string(), arch.to_string());
    attributes.insert("entry_point".to_string(), format!("{:#x}", elf.entry));
    attributes.insert("is_lib".to_string(), elf.is_lib.to_string());

    // Extract library dependencies (DT_NEEDED entries)
    let libraries: Vec<String> = elf.libraries.iter()
        .map(|lib| lib.to_string())
        .collect();

    if !libraries.is_empty() {
        attributes.insert("libraries".to_string(), libraries.join(", "));
        attributes.insert("library_count".to_string(), libraries.len().to_string());
    }

    let metadata = FileMetadata {
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

    for section in &elf.section_headers {
        let name = elf.shdr_strtab.get_at(section.sh_name)
            .unwrap_or("")
            .to_string();
        let offset = section.sh_offset as usize;
        let size = section.sh_size as usize;

        // Calculate entropy for this section with overflow protection
        let end = offset.checked_add(size).unwrap_or(usize::MAX);
        if end > buffer.len() {
            // Section extends beyond file bounds - mark as suspicious
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
        let flags = section.sh_flags;

        if flags & goblin::elf::section_header::SHF_WRITE as u64 != 0 {
            section_flags.push("WRITE".to_string());
        }
        if flags & goblin::elf::section_header::SHF_ALLOC as u64 != 0 {
            section_flags.push("ALLOC".to_string());
        }
        if flags & goblin::elf::section_header::SHF_EXECINSTR as u64 != 0 {
            section_flags.push("EXEC".to_string());
        }

        // Detect suspicious characteristics
        if flags & goblin::elf::section_header::SHF_WRITE as u64 != 0
            && flags & goblin::elf::section_header::SHF_EXECINSTR as u64 != 0 {
            // Writable + Executable = suspicious
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "suspicious_section_flags".to_string(),
                description: format!("Section '{}' is both writable and executable", name),
                severity: SuspiciousSeverity::High,
                location: Some(format!("Section: {}", name)),
                evidence: format!("Flags: {:#x}", flags),
            });
        }

        // High entropy in executable sections = possible packing/encryption
        if entropy > 7.2 && flags & goblin::elf::section_header::SHF_EXECINSTR as u64 != 0 {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "high_entropy_code".to_string(),
                description: format!("Executable section '{}' has high entropy ({:.2}), possibly packed/encrypted", name, entropy),
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

    // Extract dynamic symbols for suspicious function detection
    for sym in &elf.dynsyms {
        if let Some(name) = elf.dynstrtab.get_at(sym.st_name) {
            let sym_name = name.to_lowercase();

            // Check for anti-debugging functions
            if sym_name.contains("ptrace") {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "anti_debug".to_string(),
                    description: format!("Uses ptrace (anti-debugging): {}", name),
                    severity: SuspiciousSeverity::Medium,
                    location: Some("Dynamic Symbols".to_string()),
                    evidence: name.to_string(),
                });
            }

            // Check for network functions
            if sym_name.contains("socket") || sym_name.contains("connect") || sym_name.contains("sendto") {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "network_capability".to_string(),
                    description: format!("Uses network functions: {}", name),
                    severity: SuspiciousSeverity::Low,
                    location: Some("Dynamic Symbols".to_string()),
                    evidence: name.to_string(),
                });
            }

            // Check for process execution
            if sym_name == "execve" || sym_name == "system" || sym_name.contains("popen") {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "process_execution".to_string(),
                    description: format!("Can execute processes: {}", name),
                    severity: SuspiciousSeverity::Medium,
                    location: Some("Dynamic Symbols".to_string()),
                    evidence: name.to_string(),
                });
            }
        }
    }

    // Check for stripped binary (no symbol table)
    if elf.syms.is_empty() && !elf.is_lib {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "stripped_binary".to_string(),
            description: "Binary is stripped (no symbol table)".to_string(),
            severity: SuspiciousSeverity::Low,
            location: Some("ELF Header".to_string()),
            evidence: "Makes reverse engineering harder".to_string(),
        });
    }

    // Check for null entry point in executable
    if elf.entry == 0 && elf.header.e_type == goblin::elf::header::ET_EXEC {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "null_entry_point".to_string(),
            description: "Executable has null entry point".to_string(),
            severity: SuspiciousSeverity::High,
            location: Some("ELF Header".to_string()),
            evidence: "Possible packer or corrupted file".to_string(),
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
        signature_valid: None, // ELF doesn't have built-in signatures like PE
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

/// Extract ELF metadata only (lighter weight than full parsing)
pub fn extract_elf_metadata(buffer: &[u8], metadata: &mut FileMetadata) -> ProcessorResult<()> {
    let elf = Elf::parse(buffer).map_err(|e| {
        FileProcessorError::MalformedStructure(format!("Failed to parse ELF: {}", e))
    })?;

    metadata.attributes.insert("class".to_string(),
        if elf.is_64 { "ELF64" } else { "ELF32" }.to_string()
    );

    let arch = match elf.header.e_machine {
        goblin::elf::header::EM_386 => "x86",
        goblin::elf::header::EM_X86_64 => "x86-64",
        goblin::elf::header::EM_ARM => "ARM",
        goblin::elf::header::EM_AARCH64 => "AArch64",
        _ => "Unknown",
    };
    metadata.attributes.insert("architecture".to_string(), arch.to_string());
    metadata.attributes.insert("entry_point".to_string(), format!("{:#x}", elf.entry));
    metadata.attributes.insert("is_lib".to_string(), elf.is_lib.to_string());

    // Extract library dependencies (DT_NEEDED entries)
    let libraries: Vec<String> = elf.libraries.iter()
        .map(|lib| lib.to_string())
        .collect();

    if !libraries.is_empty() {
        metadata.attributes.insert("libraries".to_string(), libraries.join(", "));
        metadata.attributes.insert("library_count".to_string(), libraries.len().to_string());
    }

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
