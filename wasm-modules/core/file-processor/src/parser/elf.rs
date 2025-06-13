use crate::types::{
    FileFormat, ParsedFile, FileMetadata, FileSection, ProcessorResult, FileProcessorError,
    SuspiciousIndicator, SuspiciousSeverity, FileIntegrity
};
use crate::extractor::ContentExtractor;
use std::collections::HashMap;

// ELF Constants
const ELF_MAGIC: &[u8] = b"\x7FELF";
const EI_CLASS: usize = 4;     // File class
const EI_DATA: usize = 5;      // Data encoding
const EI_VERSION: usize = 6;   // File version
const EI_OSABI: usize = 7;     // OS/ABI identification

// ELF Classes
const ELFCLASS32: u8 = 1;
const ELFCLASS64: u8 = 2;

// ELF Data encodings
const ELFDATA2LSB: u8 = 1;     // Little-endian
const ELFDATA2MSB: u8 = 2;     // Big-endian

// ELF Types
const ET_NONE: u16 = 0;        // No file type
const ET_REL: u16 = 1;         // Relocatable file
const ET_EXEC: u16 = 2;        // Executable file
const ET_DYN: u16 = 3;         // Shared object file
const ET_CORE: u16 = 4;        // Core file

// ELF Machine types
const EM_NONE: u16 = 0;        // No machine
const EM_386: u16 = 3;         // Intel 80386
const EM_ARM: u16 = 40;        // ARM
const EM_X86_64: u16 = 62;     // AMD x86-64
const EM_AARCH64: u16 = 183;   // ARM AARCH64

// Section header flags
const SHF_WRITE: u64 = 0x1;      // Writable
const SHF_ALLOC: u64 = 0x2;      // Occupies memory during execution
const SHF_EXECINSTR: u64 = 0x4;  // Executable

/// Parse ELF (Executable and Linkable Format) files
pub fn parse_elf(buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
    let mut metadata = FileMetadata {
        size: buffer.len(),
        hash: super::calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(format.clone()),
        created_at: None,
        modified_at: None,
        attributes: HashMap::new(),
    };

    // Validate ELF header minimum size
    if buffer.len() < 52 {
        return Err(FileProcessorError::MalformedStructure(
            "ELF file too small for header".to_string()
        ));
    }

    // Check ELF magic
    if &buffer[0..4] != ELF_MAGIC {
        return Err(FileProcessorError::InvalidFormat(
            "Missing ELF magic".to_string()
        ));
    }

    // Parse ELF identification
    let ei_class = buffer[EI_CLASS];
    let ei_data = buffer[EI_DATA];
    let ei_version = buffer[EI_VERSION];
    let ei_osabi = buffer[EI_OSABI];

    let is_64bit = match ei_class {
        ELFCLASS32 => false,
        ELFCLASS64 => true,
        _ => {
            return Err(FileProcessorError::InvalidFormat(
                format!("Invalid ELF class: {}", ei_class)
            ));
        }
    };

    let is_little_endian = match ei_data {
        ELFDATA2LSB => true,
        ELFDATA2MSB => false,
        _ => {
            return Err(FileProcessorError::InvalidFormat(
                format!("Invalid ELF data encoding: {}", ei_data)
            ));
        }
    };

    metadata.attributes.insert("class".to_string(), 
        if is_64bit { "ELF64" } else { "ELF32" }.to_string()
    );
    metadata.attributes.insert("endianness".to_string(),
        if is_little_endian { "little" } else { "big" }.to_string()
    );
    metadata.attributes.insert("version".to_string(), ei_version.to_string());
    metadata.attributes.insert("osabi".to_string(), get_osabi_name(ei_osabi));

    // Parse ELF header based on class
    let (e_type, e_machine, e_entry, _e_phoff, e_shoff, _e_phnum, e_shnum, _e_shstrndx) = 
        if is_64bit {
            parse_elf64_header(buffer, is_little_endian)?
        } else {
            parse_elf32_header(buffer, is_little_endian)?
        };

    // Set file type
    let file_type = match e_type {
        ET_NONE => "None",
        ET_REL => "Relocatable",
        ET_EXEC => "Executable",
        ET_DYN => "Shared Object",
        ET_CORE => "Core Dump",
        _ => "Unknown",
    };
    metadata.attributes.insert("file_type".to_string(), file_type.to_string());

    // Set machine architecture
    let arch = match e_machine {
        EM_NONE => "None",
        EM_386 => "x86",
        EM_ARM => "ARM",
        EM_X86_64 => "x86-64",
        EM_AARCH64 => "AArch64",
        _ => "Unknown",
    };
    metadata.attributes.insert("architecture".to_string(), arch.to_string());
    metadata.attributes.insert("entry_point".to_string(), format!("0x{:x}", e_entry));

    let mut sections = Vec::new();
    let mut suspicious_indicators = Vec::new();

    // Parse section headers if present
    if e_shoff > 0 && e_shnum > 0 {
        let section_header_size = if is_64bit { 64 } else { 40 };
        
        // Parse section headers
        for i in 0..e_shnum as usize {
            let sh_offset = e_shoff as usize + (i * section_header_size);
            if sh_offset + section_header_size > buffer.len() {
                break;
            }

            let (_sh_name_idx, _sh_type, sh_flags, _sh_addr, sh_offset, sh_size) = 
                if is_64bit {
                    parse_section_header_64(&buffer[sh_offset..], is_little_endian)?
                } else {
                    parse_section_header_32(&buffer[sh_offset..], is_little_endian)?
                };

            // Get section name from string table (simplified - just use index for now)
            let name = format!("section_{}", i);

            // Calculate section entropy if possible
            let section_entropy = if sh_offset as usize + sh_size as usize <= buffer.len() && sh_size > 0 {
                super::calculate_entropy(&buffer[sh_offset as usize..(sh_offset + sh_size) as usize])
            } else {
                0.0
            };

            // Create section flags
            let mut flags = Vec::new();
            if sh_flags & SHF_WRITE != 0 { flags.push("WRITE".to_string()); }
            if sh_flags & SHF_ALLOC != 0 { flags.push("ALLOC".to_string()); }
            if sh_flags & SHF_EXECINSTR != 0 { flags.push("EXEC".to_string()); }

            // Check for suspicious section characteristics
            if sh_flags & SHF_WRITE != 0 && sh_flags & SHF_EXECINSTR != 0 {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "Writable+Executable Section".to_string(),
                    description: format!("Section {} is both writable and executable", name),
                    severity: SuspiciousSeverity::High,
                    location: Some(format!("Section {}", name)),
                    evidence: format!("Flags: 0x{:x}", sh_flags),
                });
            }

            // Check for high entropy sections (possible packing)
            if section_entropy > 7.5 && sh_size > 1024 {
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "High Entropy Section".to_string(),
                    description: format!("Section {} has unusually high entropy ({:.2})", name, section_entropy),
                    severity: SuspiciousSeverity::Medium,
                    location: Some(format!("Section {}", name)),
                    evidence: format!("Possible packing or encryption"),
                });
            }

            sections.push(FileSection {
                name,
                offset: sh_offset as usize,
                size: sh_size as usize,
                entropy: section_entropy,
                flags,
            });
        }
    }

    // Check for packed/encrypted indicators
    if e_entry == 0 && e_type == ET_EXEC {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "Null Entry Point".to_string(),
            description: "Executable has null entry point".to_string(),
            severity: SuspiciousSeverity::High,
            location: Some("ELF Header".to_string()),
            evidence: "Possible packer or corrupted file".to_string(),
        });
    }

    // Extract strings from the file
    let extractor = ContentExtractor::new();
    let strings = extractor.extract_strings(buffer, 5);

    // Check file integrity
    let integrity = FileIntegrity {
        valid_structure: true, // We got this far, so basic structure is valid
        checksum_valid: None, // TODO: Implement ELF checksum validation if applicable
        signature_valid: None, // TODO: Implement digital signature checking
        issues: Vec::new(),
    };

    Ok(ParsedFile {
        format,
        metadata,
        sections,
        embedded_files: Vec::new(), // TODO: Extract embedded files if any
        strings,
        suspicious_indicators,
        integrity,
    })
}

/// Parse 32-bit ELF header
fn parse_elf32_header(buffer: &[u8], is_little_endian: bool) -> ProcessorResult<(u16, u16, u64, u64, u64, u16, u16, u16)> {
    if buffer.len() < 52 {
        return Err(FileProcessorError::MalformedStructure("Buffer too small for ELF32 header".to_string()));
    }

    let read_u16 = |offset: usize| {
        if is_little_endian {
            u16::from_le_bytes([buffer[offset], buffer[offset + 1]])
        } else {
            u16::from_be_bytes([buffer[offset], buffer[offset + 1]])
        }
    };

    let read_u32 = |offset: usize| {
        if is_little_endian {
            u32::from_le_bytes([
                buffer[offset], buffer[offset + 1], 
                buffer[offset + 2], buffer[offset + 3]
            ])
        } else {
            u32::from_be_bytes([
                buffer[offset], buffer[offset + 1], 
                buffer[offset + 2], buffer[offset + 3]
            ])
        }
    };

    let e_type = read_u16(16);
    let e_machine = read_u16(18);
    let e_entry = read_u32(24) as u64;
    let e_phoff = read_u32(28) as u64;
    let e_shoff = read_u32(32) as u64;
    let e_phnum = read_u16(44);
    let e_shnum = read_u16(48);
    let e_shstrndx = read_u16(50);

    Ok((e_type, e_machine, e_entry, e_phoff, e_shoff, e_phnum, e_shnum, e_shstrndx))
}

/// Parse 64-bit ELF header
fn parse_elf64_header(buffer: &[u8], is_little_endian: bool) -> ProcessorResult<(u16, u16, u64, u64, u64, u16, u16, u16)> {
    if buffer.len() < 64 {
        return Err(FileProcessorError::MalformedStructure("Buffer too small for ELF64 header".to_string()));
    }

    let read_u16 = |offset: usize| {
        if is_little_endian {
            u16::from_le_bytes([buffer[offset], buffer[offset + 1]])
        } else {
            u16::from_be_bytes([buffer[offset], buffer[offset + 1]])
        }
    };

    let read_u64 = |offset: usize| {
        if is_little_endian {
            u64::from_le_bytes([
                buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3],
                buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]
            ])
        } else {
            u64::from_be_bytes([
                buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3],
                buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]
            ])
        }
    };

    let e_type = read_u16(16);
    let e_machine = read_u16(18);
    let e_entry = read_u64(24);
    let e_phoff = read_u64(32);
    let e_shoff = read_u64(40);
    let e_phnum = read_u16(56);
    let e_shnum = read_u16(60);
    let e_shstrndx = read_u16(62);

    Ok((e_type, e_machine, e_entry, e_phoff, e_shoff, e_phnum, e_shnum, e_shstrndx))
}

/// Parse 32-bit section header
fn parse_section_header_32(buffer: &[u8], is_little_endian: bool) -> ProcessorResult<(u32, u32, u64, u64, u64, u64)> {
    if buffer.len() < 40 {
        return Err(FileProcessorError::MalformedStructure("Buffer too small for section header".to_string()));
    }

    let read_u32 = |offset: usize| {
        if is_little_endian {
            u32::from_le_bytes([
                buffer[offset], buffer[offset + 1], 
                buffer[offset + 2], buffer[offset + 3]
            ])
        } else {
            u32::from_be_bytes([
                buffer[offset], buffer[offset + 1], 
                buffer[offset + 2], buffer[offset + 3]
            ])
        }
    };

    let sh_name = read_u32(0);
    let sh_type = read_u32(4);
    let sh_flags = read_u32(8) as u64;
    let sh_addr = read_u32(12) as u64;
    let sh_offset = read_u32(16) as u64;
    let sh_size = read_u32(20) as u64;

    Ok((sh_name, sh_type, sh_flags, sh_addr, sh_offset, sh_size))
}

/// Parse 64-bit section header
fn parse_section_header_64(buffer: &[u8], is_little_endian: bool) -> ProcessorResult<(u32, u32, u64, u64, u64, u64)> {
    if buffer.len() < 64 {
        return Err(FileProcessorError::MalformedStructure("Buffer too small for section header".to_string()));
    }

    let read_u32 = |offset: usize| {
        if is_little_endian {
            u32::from_le_bytes([
                buffer[offset], buffer[offset + 1], 
                buffer[offset + 2], buffer[offset + 3]
            ])
        } else {
            u32::from_be_bytes([
                buffer[offset], buffer[offset + 1], 
                buffer[offset + 2], buffer[offset + 3]
            ])
        }
    };

    let read_u64 = |offset: usize| {
        if is_little_endian {
            u64::from_le_bytes([
                buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3],
                buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]
            ])
        } else {
            u64::from_be_bytes([
                buffer[offset], buffer[offset + 1], buffer[offset + 2], buffer[offset + 3],
                buffer[offset + 4], buffer[offset + 5], buffer[offset + 6], buffer[offset + 7]
            ])
        }
    };

    let sh_name = read_u32(0);
    let sh_type = read_u32(4);
    let sh_flags = read_u64(8);
    let sh_addr = read_u64(16);
    let sh_offset = read_u64(24);
    let sh_size = read_u64(32);

    Ok((sh_name, sh_type, sh_flags, sh_addr, sh_offset, sh_size))
}

/// Get OS/ABI name from identifier
fn get_osabi_name(osabi: u8) -> String {
    match osabi {
        0 => "System V",
        1 => "HP-UX",
        2 => "NetBSD",
        3 => "Linux",
        4 => "GNU Hurd",
        6 => "Solaris",
        7 => "AIX",
        8 => "IRIX",
        9 => "FreeBSD",
        10 => "Tru64",
        11 => "Novell Modesto",
        12 => "OpenBSD",
        13 => "OpenVMS",
        14 => "NonStop Kernel",
        15 => "AROS",
        16 => "Fenix OS",
        17 => "CloudABI",
        _ => "Unknown",
    }.to_string()
}