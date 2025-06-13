use crate::types::{
    FileFormat, ParsedFile, FileMetadata, FileSection, ProcessorResult, FileProcessorError,
    SuspiciousIndicator, SuspiciousSeverity, FileIntegrity
};
use crate::extractor::ContentExtractor;
use std::collections::HashMap;

// PE Constants
const DOS_HEADER_SIZE: usize = 64;
const PE_SIGNATURE: &[u8] = b"PE\0\0";
const IMAGE_FILE_MACHINE_I386: u16 = 0x014c;
const IMAGE_FILE_MACHINE_AMD64: u16 = 0x8664;
const IMAGE_FILE_MACHINE_ARM: u16 = 0x01c0;
const IMAGE_FILE_MACHINE_ARM64: u16 = 0xaa64;

// Section characteristics flags
const IMAGE_SCN_CNT_CODE: u32 = 0x00000020;
const IMAGE_SCN_CNT_INITIALIZED_DATA: u32 = 0x00000040;
const IMAGE_SCN_CNT_UNINITIALIZED_DATA: u32 = 0x00000080;
const IMAGE_SCN_MEM_EXECUTE: u32 = 0x20000000;
const IMAGE_SCN_MEM_READ: u32 = 0x40000000;
const IMAGE_SCN_MEM_WRITE: u32 = 0x80000000;

/// Parse PE (Portable Executable) files
pub fn parse_pe(buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
    let mut metadata = FileMetadata {
        size: buffer.len(),
        hash: super::calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(format.clone()),
        created_at: None,
        modified_at: None,
        attributes: HashMap::new(),
    };

    // Validate DOS header
    if buffer.len() < DOS_HEADER_SIZE {
        return Err(FileProcessorError::MalformedStructure(
            "PE file too small for DOS header".to_string()
        ));
    }

    // Check DOS signature
    if &buffer[0..2] != b"MZ" {
        return Err(FileProcessorError::InvalidFormat(
            "Missing MZ signature".to_string()
        ));
    }

    // Get PE header offset
    let pe_offset = u32::from_le_bytes([
        buffer[0x3C], buffer[0x3D], buffer[0x3E], buffer[0x3F]
    ]) as usize;

    if pe_offset + 24 > buffer.len() {
        return Err(FileProcessorError::MalformedStructure(
            "Invalid PE header offset".to_string()
        ));
    }

    // Check PE signature
    if &buffer[pe_offset..pe_offset + 4] != PE_SIGNATURE {
        return Err(FileProcessorError::InvalidFormat(
            "Missing PE signature".to_string()
        ));
    }

    // Parse COFF header
    let coff_header_offset = pe_offset + 4;
    let machine = u16::from_le_bytes([
        buffer[coff_header_offset], 
        buffer[coff_header_offset + 1]
    ]);
    
    let num_sections = u16::from_le_bytes([
        buffer[coff_header_offset + 2], 
        buffer[coff_header_offset + 3]
    ]);
    
    let timestamp = u32::from_le_bytes([
        buffer[coff_header_offset + 4],
        buffer[coff_header_offset + 5],
        buffer[coff_header_offset + 6],
        buffer[coff_header_offset + 7]
    ]);

    let size_of_optional_header = u16::from_le_bytes([
        buffer[coff_header_offset + 16],
        buffer[coff_header_offset + 17]
    ]);

    let characteristics = u16::from_le_bytes([
        buffer[coff_header_offset + 18],
        buffer[coff_header_offset + 19]
    ]);

    // Set architecture
    let arch = match machine {
        IMAGE_FILE_MACHINE_I386 => "x86",
        IMAGE_FILE_MACHINE_AMD64 => "x64",
        IMAGE_FILE_MACHINE_ARM => "ARM",
        IMAGE_FILE_MACHINE_ARM64 => "ARM64",
        _ => "Unknown",
    };
    metadata.attributes.insert("architecture".to_string(), arch.to_string());
    metadata.attributes.insert("timestamp".to_string(), timestamp.to_string());
    metadata.attributes.insert("characteristics".to_string(), format!("0x{:04x}", characteristics));

    // Parse optional header if present
    let mut sections = Vec::new();
    let mut suspicious_indicators = Vec::new();
    
    if size_of_optional_header > 0 {
        let opt_header_offset = coff_header_offset + 20;
        if opt_header_offset + size_of_optional_header as usize > buffer.len() {
            return Err(FileProcessorError::MalformedStructure(
                "Optional header extends beyond file".to_string()
            ));
        }

        // Read magic number to determine PE32 or PE32+
        let magic = u16::from_le_bytes([
            buffer[opt_header_offset],
            buffer[opt_header_offset + 1]
        ]);

        let is_pe32_plus = match magic {
            0x10b => false, // PE32
            0x20b => true,  // PE32+
            _ => {
                return Err(FileProcessorError::InvalidFormat(
                    format!("Invalid optional header magic: 0x{:04x}", magic)
                ));
            }
        };

        metadata.attributes.insert("pe_type".to_string(), 
            if is_pe32_plus { "PE32+" } else { "PE32" }.to_string()
        );

        // Parse entry point and other important fields
        let entry_point_offset = opt_header_offset + 16;
        if entry_point_offset + 4 <= buffer.len() {
            let entry_point = u32::from_le_bytes([
                buffer[entry_point_offset],
                buffer[entry_point_offset + 1],
                buffer[entry_point_offset + 2],
                buffer[entry_point_offset + 3]
            ]);
            metadata.attributes.insert("entry_point".to_string(), format!("0x{:08x}", entry_point));
        }

        // Parse subsystem
        let subsystem_offset = opt_header_offset + if is_pe32_plus { 88 } else { 68 };
        if subsystem_offset + 2 <= buffer.len() {
            let subsystem = u16::from_le_bytes([
                buffer[subsystem_offset],
                buffer[subsystem_offset + 1]
            ]);
            
            let subsystem_name = match subsystem {
                1 => "Native",
                2 => "Windows GUI",
                3 => "Windows Console",
                5 => "OS/2 Console",
                7 => "POSIX Console",
                9 => "Windows CE GUI",
                10 => "EFI Application",
                11 => "EFI Boot Service Driver",
                12 => "EFI Runtime Driver",
                13 => "EFI ROM",
                14 => "Xbox",
                16 => "Windows Boot Application",
                _ => "Unknown",
            };
            
            metadata.attributes.insert("subsystem".to_string(), subsystem_name.to_string());
        }
    }

    // Parse section headers
    let section_header_offset = coff_header_offset + 20 + size_of_optional_header as usize;
    let section_header_size = 40;

    for i in 0..num_sections as usize {
        let section_offset = section_header_offset + (i * section_header_size);
        if section_offset + section_header_size > buffer.len() {
            break;
        }

        let name_bytes = &buffer[section_offset..section_offset + 8];
        let name = String::from_utf8_lossy(name_bytes)
            .trim_end_matches('\0')
            .to_string();

        let _virtual_size = u32::from_le_bytes([
            buffer[section_offset + 8],
            buffer[section_offset + 9],
            buffer[section_offset + 10],
            buffer[section_offset + 11]
        ]);

        let _virtual_address = u32::from_le_bytes([
            buffer[section_offset + 12],
            buffer[section_offset + 13],
            buffer[section_offset + 14],
            buffer[section_offset + 15]
        ]);

        let raw_data_size = u32::from_le_bytes([
            buffer[section_offset + 16],
            buffer[section_offset + 17],
            buffer[section_offset + 18],
            buffer[section_offset + 19]
        ]);

        let raw_data_offset = u32::from_le_bytes([
            buffer[section_offset + 20],
            buffer[section_offset + 21],
            buffer[section_offset + 22],
            buffer[section_offset + 23]
        ]);

        let characteristics = u32::from_le_bytes([
            buffer[section_offset + 36],
            buffer[section_offset + 37],
            buffer[section_offset + 38],
            buffer[section_offset + 39]
        ]);

        // Calculate section entropy if possible
        let section_entropy = if raw_data_offset as usize + raw_data_size as usize <= buffer.len() {
            super::calculate_entropy(&buffer[raw_data_offset as usize..(raw_data_offset + raw_data_size) as usize])
        } else {
            0.0
        };

        // Create section flags
        let mut flags = Vec::new();
        if characteristics & IMAGE_SCN_CNT_CODE != 0 { flags.push("CODE".to_string()); }
        if characteristics & IMAGE_SCN_CNT_INITIALIZED_DATA != 0 { flags.push("INITIALIZED_DATA".to_string()); }
        if characteristics & IMAGE_SCN_CNT_UNINITIALIZED_DATA != 0 { flags.push("UNINITIALIZED_DATA".to_string()); }
        if characteristics & IMAGE_SCN_MEM_EXECUTE != 0 { flags.push("EXECUTE".to_string()); }
        if characteristics & IMAGE_SCN_MEM_READ != 0 { flags.push("READ".to_string()); }
        if characteristics & IMAGE_SCN_MEM_WRITE != 0 { flags.push("WRITE".to_string()); }

        // Check for suspicious section characteristics
        if characteristics & IMAGE_SCN_MEM_WRITE != 0 && characteristics & IMAGE_SCN_MEM_EXECUTE != 0 {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "Writable+Executable Section".to_string(),
                description: format!("Section '{}' is both writable and executable", name),
                severity: SuspiciousSeverity::High,
                location: Some(format!("Section {}", name)),
                evidence: format!("Characteristics: 0x{:08x}", characteristics),
            });
        }

        // Check for high entropy sections (possible packing)
        if section_entropy > 7.5 {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "High Entropy Section".to_string(),
                description: format!("Section '{}' has unusually high entropy ({:.2})", name, section_entropy),
                severity: SuspiciousSeverity::Medium,
                location: Some(format!("Section {}", name)),
                evidence: format!("Possible packing or encryption"),
            });
        }

        // Check for suspicious section names
        let suspicious_names = [".vmp", ".themida", ".aspack", ".upx", ".petite", ".nspack"];
        for suspicious_name in &suspicious_names {
            if name.to_lowercase().contains(suspicious_name) {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "Known Packer Section".to_string(),
                    description: format!("Section '{}' matches known packer pattern", name),
                    severity: SuspiciousSeverity::Medium,
                    location: Some(format!("Section {}", name)),
                    evidence: format!("Known packer: {}", suspicious_name),
                });
            }
        }

        sections.push(FileSection {
            name: name.clone(),
            offset: raw_data_offset as usize,
            size: raw_data_size as usize,
            entropy: section_entropy,
            flags,
        });
    }

    // Extract strings from the file
    let extractor = ContentExtractor::new();
    let strings = extractor.extract_strings(buffer, 5);

    // Check file integrity
    let integrity = FileIntegrity {
        valid_structure: true, // We got this far, so basic structure is valid
        checksum_valid: None, // TODO: Implement PE checksum validation
        signature_valid: None, // TODO: Implement digital signature checking
        issues: Vec::new(),
    };

    // Add PE-specific metadata
    extract_pe_metadata(buffer, &mut metadata)?;

    Ok(ParsedFile {
        format,
        metadata,
        sections,
        embedded_files: Vec::new(), // TODO: Extract embedded resources
        strings,
        suspicious_indicators,
        integrity,
    })
}

/// Extract PE-specific metadata
pub fn extract_pe_metadata(_buffer: &[u8], metadata: &mut FileMetadata) -> ProcessorResult<()> {
    metadata.attributes.insert("format".to_string(), "PE".to_string());
    
    // Try to extract version information from resources
    // TODO: Implement resource parsing
    
    // Try to extract import/export information
    // TODO: Implement import/export table parsing
    
    Ok(())
}

