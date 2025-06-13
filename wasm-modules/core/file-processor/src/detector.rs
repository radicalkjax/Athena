use crate::types::{FileFormat};
use std::collections::HashMap;
use once_cell::sync::Lazy;

/// Magic byte signatures for file format detection
static MAGIC_BYTES: Lazy<HashMap<Vec<u8>, FileFormat>> = Lazy::new(|| {
    let mut m = HashMap::new();
    
    // Executables
    m.insert(vec![0x4D, 0x5A], FileFormat::PE32); // MZ header
    m.insert(vec![0x7F, 0x45, 0x4C, 0x46], FileFormat::ELF32); // ELF
    m.insert(vec![0xFE, 0xED, 0xFA, 0xCE], FileFormat::MachO); // Mach-O 32-bit
    m.insert(vec![0xFE, 0xED, 0xFA, 0xCF], FileFormat::MachO); // Mach-O 64-bit
    m.insert(vec![0xCE, 0xFA, 0xED, 0xFE], FileFormat::MachO); // Mach-O reverse
    m.insert(vec![0xCF, 0xFA, 0xED, 0xFE], FileFormat::MachO); // Mach-O 64-bit reverse
    
    // Documents
    m.insert(vec![0x25, 0x50, 0x44, 0x46], FileFormat::PDF); // %PDF
    m.insert(vec![0x50, 0x4B, 0x03, 0x04], FileFormat::ZIP); // ZIP (also DOCX, XLSX, etc.)
    m.insert(vec![0x50, 0x4B, 0x05, 0x06], FileFormat::ZIP); // ZIP empty
    m.insert(vec![0x50, 0x4B, 0x07, 0x08], FileFormat::ZIP); // ZIP spanned
    
    // Archives
    m.insert(vec![0x52, 0x61, 0x72, 0x21], FileFormat::RAR); // Rar!
    m.insert(vec![0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], FileFormat::SevenZ); // 7z
    m.insert(vec![0x1F, 0x8B], FileFormat::GZIP); // GZIP
    
    // Web formats
    m.insert(vec![0x3C, 0x68, 0x74, 0x6D, 0x6C], FileFormat::HTML); // <html
    m.insert(vec![0x3C, 0x21, 0x44, 0x4F, 0x43, 0x54, 0x59, 0x50, 0x45], FileFormat::HTML); // <!DOCTYPE
    m.insert(vec![0x3C, 0x3F, 0x78, 0x6D, 0x6C], FileFormat::XML); // <?xml
    
    m
});

/// File extension to format mapping
static EXTENSION_MAP: Lazy<HashMap<&'static str, FileFormat>> = Lazy::new(|| {
    let mut m = HashMap::new();
    
    // Executables
    m.insert("exe", FileFormat::PE32);
    m.insert("dll", FileFormat::PE32);
    m.insert("sys", FileFormat::PE32);
    m.insert("elf", FileFormat::ELF32);
    m.insert("so", FileFormat::ELF32);
    m.insert("dylib", FileFormat::MachO);
    
    // Documents
    m.insert("pdf", FileFormat::PDF);
    m.insert("docx", FileFormat::DOCX);
    m.insert("xlsx", FileFormat::XLSX);
    m.insert("pptx", FileFormat::PPTX);
    m.insert("odt", FileFormat::ODT);
    
    // Archives
    m.insert("zip", FileFormat::ZIP);
    m.insert("rar", FileFormat::RAR);
    m.insert("7z", FileFormat::SevenZ);
    m.insert("tar", FileFormat::TAR);
    m.insert("gz", FileFormat::GZIP);
    
    // Scripts
    m.insert("js", FileFormat::JavaScript);
    m.insert("mjs", FileFormat::JavaScript);
    m.insert("ts", FileFormat::TypeScript);
    m.insert("tsx", FileFormat::TypeScript);
    m.insert("py", FileFormat::Python);
    m.insert("ps1", FileFormat::PowerShell);
    m.insert("bat", FileFormat::Batch);
    m.insert("cmd", FileFormat::Batch);
    m.insert("sh", FileFormat::Shell);
    m.insert("bash", FileFormat::Shell);
    m.insert("php", FileFormat::PHP);
    m.insert("rb", FileFormat::Ruby);
    
    // Web
    m.insert("html", FileFormat::HTML);
    m.insert("htm", FileFormat::HTML);
    m.insert("xml", FileFormat::XML);
    m.insert("json", FileFormat::JSON);
    m.insert("css", FileFormat::CSS);
    
    // Text
    m.insert("txt", FileFormat::PlainText);
    m.insert("log", FileFormat::PlainText);
    m.insert("md", FileFormat::PlainText);
    
    m
});

pub struct FileDetector {
    magic_bytes: &'static HashMap<Vec<u8>, FileFormat>,
    extension_map: &'static HashMap<&'static str, FileFormat>,
}

impl FileDetector {
    pub fn new() -> Self {
        Self {
            magic_bytes: &MAGIC_BYTES,
            extension_map: &EXTENSION_MAP,
        }
    }

    /// Detect file format from buffer and optional filename
    pub fn detect_format(&self, buffer: &[u8], filename: Option<&str>) -> FileFormat {
        // Try magic bytes first
        if let Some(format) = self.detect_by_magic(buffer) {
            // Special handling for ZIP-based formats
            if format == FileFormat::ZIP {
                if let Some(name) = filename {
                    if name.ends_with(".docx") {
                        return FileFormat::DOCX;
                    } else if name.ends_with(".xlsx") {
                        return FileFormat::XLSX;
                    } else if name.ends_with(".pptx") {
                        return FileFormat::PPTX;
                    }
                }
            }
            return format;
        }

        // Try content-based detection
        if let Some(format) = self.detect_by_content(buffer) {
            return format;
        }

        // Fall back to extension
        if let Some(name) = filename {
            if let Some(format) = self.detect_by_extension(name) {
                return format;
            }
        }

        // Check if it's text
        if self.is_text_file(buffer) {
            FileFormat::PlainText
        } else {
            FileFormat::Binary
        }
    }

    /// Detect format by magic bytes
    fn detect_by_magic(&self, buffer: &[u8]) -> Option<FileFormat> {
        for (magic, format) in self.magic_bytes.iter() {
            if buffer.len() >= magic.len() && buffer.starts_with(magic) {
                return Some(format.clone());
            }
        }
        None
    }

    /// Detect format by file extension
    fn detect_by_extension(&self, filename: &str) -> Option<FileFormat> {
        let extension = filename
            .rsplit('.')
            .next()?
            .to_lowercase();
        
        self.extension_map.get(extension.as_str()).cloned()
    }

    /// Detect format by content analysis
    fn detect_by_content(&self, buffer: &[u8]) -> Option<FileFormat> {
        if buffer.is_empty() {
            return None;
        }

        // Try to detect as text and check for specific patterns
        if let Ok(text) = std::str::from_utf8(buffer) {
            // JSON detection
            if (text.trim().starts_with('{') && text.trim().ends_with('}')) ||
               (text.trim().starts_with('[') && text.trim().ends_with(']')) {
                if serde_json::from_str::<serde_json::Value>(text).is_ok() {
                    return Some(FileFormat::JSON);
                }
            }

            // JavaScript detection
            if text.contains("function") || text.contains("const ") || 
               text.contains("let ") || text.contains("var ") ||
               text.contains("=>") || text.contains("require(") {
                return Some(FileFormat::JavaScript);
            }

            // Python detection
            if text.contains("def ") || text.contains("import ") ||
               text.contains("from ") || text.contains("class ") ||
               text.contains("if __name__") {
                return Some(FileFormat::Python);
            }

            // PowerShell detection
            if text.contains("$") && (text.contains("Get-") || 
               text.contains("Set-") || text.contains("New-")) {
                return Some(FileFormat::PowerShell);
            }

            // HTML detection
            if text.contains("<html") || text.contains("<!DOCTYPE") ||
               text.contains("<body") || text.contains("<head") {
                return Some(FileFormat::HTML);
            }

            // CSS detection
            if text.contains("{") && text.contains("}") &&
               (text.contains("color:") || text.contains("font-") || 
                text.contains("margin:") || text.contains("padding:")) {
                return Some(FileFormat::CSS);
            }
        }

        None
    }

    /// Check if file appears to be text
    pub fn is_text_file(&self, buffer: &[u8]) -> bool {
        if buffer.is_empty() {
            return true;
        }

        // Sample up to 8KB
        let sample_size = buffer.len().min(8192);
        let sample = &buffer[..sample_size];

        // Check for null bytes (common in binary files)
        if sample.contains(&0) {
            return false;
        }

        // Try UTF-8 decoding
        if std::str::from_utf8(sample).is_ok() {
            return true;
        }

        // Check if mostly printable ASCII
        let printable_count = sample.iter()
            .filter(|&&b| (b >= 0x20 && b <= 0x7E) || b == b'\n' || b == b'\r' || b == b'\t')
            .count();

        // If more than 95% printable, consider it text
        printable_count as f64 / sample.len() as f64 > 0.95
    }

    /// Get MIME type for file format
    pub fn get_mime_type(&self, format: FileFormat) -> String {
        match format {
            FileFormat::PE32 | FileFormat::PE64 => "application/x-msdownload",
            FileFormat::ELF32 | FileFormat::ELF64 => "application/x-executable",
            FileFormat::MachO => "application/x-mach-binary",
            FileFormat::PDF => "application/pdf",
            FileFormat::DOCX => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            FileFormat::XLSX => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            FileFormat::PPTX => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            FileFormat::ZIP => "application/zip",
            FileFormat::RAR => "application/x-rar-compressed",
            FileFormat::SevenZ => "application/x-7z-compressed",
            FileFormat::TAR => "application/x-tar",
            FileFormat::GZIP => "application/gzip",
            FileFormat::JavaScript => "application/javascript",
            FileFormat::TypeScript => "application/typescript",
            FileFormat::Python => "text/x-python",
            FileFormat::PowerShell => "application/x-powershell",
            FileFormat::HTML => "text/html",
            FileFormat::XML => "application/xml",
            FileFormat::JSON => "application/json",
            FileFormat::CSS => "text/css",
            FileFormat::PlainText => "text/plain",
            _ => "application/octet-stream",
        }.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_magic_byte_detection() {
        let detector = FileDetector::new();
        
        // Test PDF
        assert_eq!(detector.detect_format(b"%PDF-1.4", None), FileFormat::PDF);
        
        // Test ELF
        assert_eq!(detector.detect_format(b"\x7FELF", None), FileFormat::ELF32);
        
        // Test ZIP
        assert_eq!(detector.detect_format(b"PK\x03\x04", None), FileFormat::ZIP);
    }

    #[test]
    fn test_extension_detection() {
        let detector = FileDetector::new();
        
        assert_eq!(detector.detect_format(b"", Some("test.js")), FileFormat::JavaScript);
        assert_eq!(detector.detect_format(b"", Some("script.py")), FileFormat::Python);
        assert_eq!(detector.detect_format(b"", Some("document.pdf")), FileFormat::PDF);
    }

    #[test]
    fn test_content_detection() {
        let detector = FileDetector::new();
        
        // JavaScript
        let js_code = b"function test() { return true; }";
        assert_eq!(detector.detect_format(js_code, None), FileFormat::JavaScript);
        
        // JSON
        let json_data = b"{\"key\": \"value\"}";
        assert_eq!(detector.detect_format(json_data, None), FileFormat::JSON);
        
        // HTML
        let html = b"<html><body>Test</body></html>";
        assert_eq!(detector.detect_format(html, None), FileFormat::HTML);
    }

    #[test]
    fn test_text_detection() {
        let detector = FileDetector::new();
        
        assert!(detector.is_text_file(b"Hello, world!"));
        assert!(detector.is_text_file(b"Line 1\nLine 2\nLine 3"));
        assert!(!detector.is_text_file(b"\x00\x01\x02\x03"));
        assert!(!detector.is_text_file(b"Text\x00with\x00nulls"));
    }
}