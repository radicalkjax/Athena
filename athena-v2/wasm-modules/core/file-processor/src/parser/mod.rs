use crate::types::{FileFormat, ParsedFile, FileMetadata, ProcessorResult};
use std::collections::HashMap;

pub mod pe;
pub mod elf;
pub mod macho;
pub mod pdf;
pub mod script;
pub mod authenticode;
pub mod codesign;

/// Parse a file based on its format
pub fn parse_file(buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
    match format {
        FileFormat::PE32 | FileFormat::PE64 => pe::parse_pe(buffer, format),
        FileFormat::ELF32 | FileFormat::ELF64 => elf::parse_elf(buffer, format),
        FileFormat::MachO => macho::parse_macho(buffer, format),
        FileFormat::PDF => pdf::parse_pdf(buffer),
        FileFormat::JavaScript | FileFormat::TypeScript | FileFormat::Python |
        FileFormat::PowerShell | FileFormat::Shell | FileFormat::Batch => {
            script::parse_script(buffer, format)
        }
        _ => {
            // For unsupported formats, return a basic parsed file
            Ok(create_basic_parsed_file(buffer, format))
        }
    }
}

/// Extract metadata from a file
pub fn extract_metadata(buffer: &[u8], format: FileFormat) -> ProcessorResult<FileMetadata> {
    let hash = calculate_sha256(buffer);
    let mime_type = crate::detector::FileDetector::new().get_mime_type(format.clone());
    
    let mut metadata = FileMetadata {
        size: buffer.len(),
        hash,
        mime_type,
        created_at: None,
        modified_at: None,
        attributes: HashMap::new(),
    };

    // Format-specific metadata extraction
    match format {
        FileFormat::PE32 | FileFormat::PE64 => {
            pe::extract_pe_metadata(buffer, &mut metadata)?;
        }
        FileFormat::ELF32 | FileFormat::ELF64 => {
            elf::extract_elf_metadata(buffer, &mut metadata)?;
        }
        FileFormat::MachO => {
            macho::extract_macho_metadata(buffer, &mut metadata)?;
        }
        FileFormat::PDF => {
            pdf::extract_pdf_metadata(buffer, &mut metadata)?;
        }
        _ => {
            // No specific metadata extraction for other formats yet
        }
    }

    Ok(metadata)
}

/// Create a basic parsed file structure for unsupported formats
fn create_basic_parsed_file(buffer: &[u8], format: FileFormat) -> ParsedFile {
    let metadata = FileMetadata {
        size: buffer.len(),
        hash: calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(format.clone()),
        created_at: None,
        modified_at: None,
        attributes: HashMap::new(),
    };

    ParsedFile {
        format,
        metadata,
        sections: Vec::new(),
        embedded_files: Vec::new(),
        strings: Vec::new(),
        suspicious_indicators: Vec::new(),
        integrity: crate::types::FileIntegrity {
            valid_structure: true,
            checksum_valid: None,
            signature_valid: None,
            issues: Vec::new(),
        },
    }
}

/// Calculate SHA256 hash of buffer
fn calculate_sha256(buffer: &[u8]) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(buffer);
    hex::encode(hasher.finalize())
}

/// Calculate entropy of data
pub fn calculate_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }

    let mut frequency = [0u64; 256];
    for &byte in data {
        frequency[byte as usize] += 1;
    }

    let len = data.len() as f64;
    let mut entropy = 0.0;

    for &count in &frequency {
        if count > 0 {
            let probability = count as f64 / len;
            entropy -= probability * probability.log2();
        }
    }

    entropy
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_calculation() {
        let data = b"Hello, World!";
        let hash = calculate_sha256(data);
        assert_eq!(hash.len(), 64); // SHA256 produces 64 hex characters
    }

    #[test]
    fn test_entropy_calculation() {
        // All same bytes = 0 entropy
        let data1 = vec![0x41; 100]; // All 'A's
        assert_eq!(calculate_entropy(&data1), 0.0);

        // Random data = high entropy
        let data2: Vec<u8> = (0..256).map(|i| i as u8).collect();
        let entropy = calculate_entropy(&data2);
        assert!(entropy > 7.0); // Should be close to 8.0 for perfect distribution
    }
}