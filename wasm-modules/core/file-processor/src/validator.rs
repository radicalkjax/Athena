use crate::types::{FileFormat, ValidationResult};
use std::collections::HashSet;
use once_cell::sync::Lazy;

/// Maximum file sizes by format (in bytes)
static MAX_SIZES: Lazy<HashMap<FileFormat, usize>> = Lazy::new(|| {
    use FileFormat::*;
    let mut m = HashMap::new();
    
    // Executables
    m.insert(PE32, 100 * 1024 * 1024);     // 100MB
    m.insert(PE64, 200 * 1024 * 1024);     // 200MB
    m.insert(ELF32, 100 * 1024 * 1024);    // 100MB
    m.insert(ELF64, 200 * 1024 * 1024);    // 200MB
    
    // Documents
    m.insert(PDF, 50 * 1024 * 1024);       // 50MB
    m.insert(DOCX, 25 * 1024 * 1024);      // 25MB
    m.insert(XLSX, 25 * 1024 * 1024);      // 25MB
    
    // Scripts (generally smaller)
    m.insert(JavaScript, 10 * 1024 * 1024); // 10MB
    m.insert(Python, 10 * 1024 * 1024);     // 10MB
    m.insert(PowerShell, 5 * 1024 * 1024);  // 5MB
    
    // Archives
    m.insert(ZIP, 500 * 1024 * 1024);      // 500MB
    m.insert(RAR, 500 * 1024 * 1024);      // 500MB
    
    m
});

use std::collections::HashMap;

pub struct FileValidator {
    max_file_size: usize,
    allowed_formats: Option<HashSet<FileFormat>>,
    check_zip_bombs: bool,
}

impl FileValidator {
    pub fn new() -> Self {
        Self {
            max_file_size: 1024 * 1024 * 1024, // 1GB default
            allowed_formats: None, // Allow all by default
            check_zip_bombs: true,
        }
    }

    /// Validate a file for security and integrity
    pub fn validate_file(&self, buffer: &[u8], format: FileFormat) -> ValidationResult {
        let mut result = ValidationResult {
            is_valid: true,
            format_valid: true,
            size_valid: true,
            content_safe: true,
            errors: Vec::new(),
            warnings: Vec::new(),
        };

        // Check if format is allowed
        if let Some(allowed) = &self.allowed_formats {
            if !allowed.contains(&format) {
                result.format_valid = false;
                result.errors.push(format!("File format {:?} is not allowed", format));
            }
        }

        // Check file size
        if buffer.len() > self.max_file_size {
            result.size_valid = false;
            result.errors.push(format!(
                "File size {} exceeds maximum allowed size {}",
                buffer.len(), self.max_file_size
            ));
        }

        // Check format-specific size limits
        if let Some(&max_size) = MAX_SIZES.get(&format) {
            if buffer.len() > max_size {
                result.warnings.push(format!(
                    "File size {} is unusually large for format {:?}",
                    buffer.len(), format
                ));
            }
        }

        // Validate format-specific structure
        match format {
            FileFormat::PE32 | FileFormat::PE64 => {
                self.validate_pe_structure(buffer, &mut result);
            }
            FileFormat::ELF32 | FileFormat::ELF64 => {
                self.validate_elf_structure(buffer, &mut result);
            }
            FileFormat::PDF => {
                self.validate_pdf_structure(buffer, &mut result);
            }
            FileFormat::ZIP => {
                self.validate_zip_structure(buffer, &mut result);
            }
            FileFormat::JavaScript | FileFormat::TypeScript => {
                self.validate_script_content(buffer, &mut result);
            }
            _ => {
                // No specific validation for other formats yet
            }
        }

        // Check for suspicious patterns
        self.check_suspicious_patterns(buffer, format, &mut result);

        // Set overall validity
        result.is_valid = result.format_valid && result.size_valid && result.content_safe;

        result
    }

    /// Validate PE structure
    fn validate_pe_structure(&self, buffer: &[u8], result: &mut ValidationResult) {
        if buffer.len() < 64 {
            result.format_valid = false;
            result.errors.push("PE file too small to be valid".to_string());
            return;
        }

        // Check MZ header
        if &buffer[0..2] != b"MZ" {
            result.format_valid = false;
            result.errors.push("Invalid PE header: missing MZ signature".to_string());
            return;
        }

        // Check for PE signature offset
        if buffer.len() >= 0x3C + 4 {
            let pe_offset = u32::from_le_bytes([
                buffer[0x3C], buffer[0x3D], buffer[0x3E], buffer[0x3F]
            ]) as usize;

            if pe_offset + 4 <= buffer.len() {
                if &buffer[pe_offset..pe_offset + 4] != b"PE\0\0" {
                    result.warnings.push("PE signature not found at expected offset".to_string());
                }
            }
        }
    }

    /// Validate ELF structure
    fn validate_elf_structure(&self, buffer: &[u8], result: &mut ValidationResult) {
        if buffer.len() < 52 {
            result.format_valid = false;
            result.errors.push("ELF file too small to be valid".to_string());
            return;
        }

        // Check ELF magic
        if &buffer[0..4] != b"\x7FELF" {
            result.format_valid = false;
            result.errors.push("Invalid ELF header: missing magic".to_string());
            return;
        }

        // Check ELF class (32/64 bit)
        match buffer[4] {
            1 => {}, // 32-bit
            2 => {}, // 64-bit
            _ => {
                result.warnings.push("Unknown ELF class".to_string());
            }
        }
    }

    /// Validate PDF structure
    fn validate_pdf_structure(&self, buffer: &[u8], result: &mut ValidationResult) {
        if buffer.len() < 8 {
            result.format_valid = false;
            result.errors.push("PDF file too small to be valid".to_string());
            return;
        }

        // Check PDF header
        if !buffer.starts_with(b"%PDF-") {
            result.format_valid = false;
            result.errors.push("Invalid PDF header".to_string());
            return;
        }

        // Check for EOF marker
        let end = buffer.len().saturating_sub(1024).max(0);
        let tail = &buffer[end..];
        if !tail.windows(5).any(|w| w == b"%%EOF") {
            result.warnings.push("PDF missing EOF marker".to_string());
        }

        // Check for JavaScript (potential security risk)
        if buffer.windows(11).any(|w| w == b"/JavaScript") {
            result.warnings.push("PDF contains JavaScript".to_string());
            result.content_safe = false;
        }

        // Check for embedded files
        if buffer.windows(12).any(|w| w == b"/EmbeddedFile") {
            result.warnings.push("PDF contains embedded files".to_string());
        }
    }

    /// Validate ZIP structure and check for zip bombs
    fn validate_zip_structure(&self, buffer: &[u8], result: &mut ValidationResult) {
        if buffer.len() < 22 {
            result.format_valid = false;
            result.errors.push("ZIP file too small to be valid".to_string());
            return;
        }

        // Check for ZIP signature
        if !buffer.starts_with(b"PK") {
            result.format_valid = false;
            result.errors.push("Invalid ZIP signature".to_string());
            return;
        }

        if self.check_zip_bombs {
            // Simple zip bomb detection: check compression ratio
            // This is a basic check - real implementation would parse ZIP structure
            let compressed_size = buffer.len();
            
            // Look for central directory to estimate uncompressed size
            // This is simplified - real implementation would properly parse ZIP
            if let Some(pos) = buffer.windows(4).position(|w| w == b"PK\x01\x02") {
                if pos + 24 < buffer.len() {
                    let uncompressed_hint = u32::from_le_bytes([
                        buffer[pos + 22], buffer[pos + 23], 
                        buffer[pos + 24], buffer[pos + 25]
                    ]) as usize;
                    
                    if uncompressed_hint > 0 && uncompressed_hint / compressed_size > 100 {
                        result.content_safe = false;
                        result.errors.push("Potential zip bomb detected: extreme compression ratio".to_string());
                    }
                }
            }
        }
    }

    /// Validate script content for dangerous patterns
    fn validate_script_content(&self, buffer: &[u8], result: &mut ValidationResult) {
        if let Ok(content) = std::str::from_utf8(buffer) {
            // Check for dangerous patterns
            let dangerous_patterns = [
                ("eval(", "Use of eval() function"),
                ("Function(", "Dynamic function creation"),
                ("child_process", "Process execution capability"),
                ("require('fs')", "File system access"),
                ("__proto__", "Prototype pollution risk"),
                ("process.env", "Environment variable access"),
            ];

            for (pattern, description) in &dangerous_patterns {
                if content.contains(pattern) {
                    result.warnings.push(format!("{}: {}", description, pattern));
                }
            }

            // Check for obfuscation
            if self.is_likely_obfuscated(content) {
                result.warnings.push("Code appears to be obfuscated".to_string());
                result.content_safe = false;
            }
        } else {
            result.warnings.push("Script file contains non-UTF8 data".to_string());
        }
    }

    /// Check for suspicious patterns in any file type
    fn check_suspicious_patterns(&self, buffer: &[u8], format: FileFormat, result: &mut ValidationResult) {
        // Check for excessive null bytes in text formats
        if matches!(format, FileFormat::JavaScript | FileFormat::Python | FileFormat::PlainText) {
            let null_count = buffer.iter().filter(|&&b| b == 0).count();
            if null_count > buffer.len() / 100 {
                result.warnings.push("Suspicious number of null bytes for text format".to_string());
            }
        }

        // Check for hidden executables in documents
        if matches!(format, FileFormat::PDF | FileFormat::DOCX | FileFormat::XLSX) {
            if buffer.windows(2).any(|w| w == b"MZ") {
                result.warnings.push("Possible embedded executable detected".to_string());
                result.content_safe = false;
            }
        }
    }

    /// Simple obfuscation detection
    fn is_likely_obfuscated(&self, content: &str) -> bool {
        // Check for common obfuscation indicators
        let indicators = [
            content.matches("\\x").count() > 20,
            content.matches("\\u").count() > 20,
            content.contains("atob") || content.contains("btoa"),
            content.matches(r"\b[a-zA-Z_$][a-zA-Z0-9_$]{50,}\b").count() > 5,
        ];

        indicators.iter().filter(|&&x| x).count() >= 2
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pe_validation() {
        let validator = FileValidator::new();
        
        // Valid PE header
        let mut pe_file = vec![0u8; 1024];
        pe_file[0..2].copy_from_slice(b"MZ");
        pe_file[0x3C..0x40].copy_from_slice(&[0x80, 0, 0, 0]);
        pe_file[0x80..0x84].copy_from_slice(b"PE\0\0");
        
        let result = validator.validate_file(&pe_file, FileFormat::PE32);
        assert!(result.format_valid);
        
        // Invalid PE
        let invalid_pe = b"Not a PE file";
        let result = validator.validate_file(invalid_pe, FileFormat::PE32);
        assert!(!result.format_valid);
    }

    #[test]
    fn test_script_validation() {
        let validator = FileValidator::new();
        
        // Safe script
        let safe_script = b"console.log('Hello, world!');";
        let result = validator.validate_file(safe_script, FileFormat::JavaScript);
        assert!(result.content_safe);
        
        // Dangerous script
        let dangerous_script = b"eval(atob('ZGFuZ2Vyb3Vz'));";
        let result = validator.validate_file(dangerous_script, FileFormat::JavaScript);
        assert!(!result.warnings.is_empty());
    }

    #[test]
    fn test_size_validation() {
        let mut validator = FileValidator::new();
        validator.max_file_size = 1024; // 1KB limit
        
        let small_file = vec![0u8; 512];
        let result = validator.validate_file(&small_file, FileFormat::Binary);
        assert!(result.size_valid);
        
        let large_file = vec![0u8; 2048];
        let result = validator.validate_file(&large_file, FileFormat::Binary);
        assert!(!result.size_valid);
    }
}