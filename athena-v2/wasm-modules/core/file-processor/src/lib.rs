// Component Model implementation
mod component;

pub mod detector;
pub mod parser;
pub mod validator;
pub mod extractor;
pub mod types;
pub mod utils;
pub mod packer_detection;
pub mod pdb_parser;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::detector::FileDetector;
    use crate::parser::{calculate_entropy, parse_file};
    use crate::types::FileFormat;

    #[test]
    fn test_pe_magic_bytes_detection() {
        let detector = FileDetector::new();
        let pe_header = b"MZ\x90\x00\x03\x00\x00\x00";

        let format = detector.detect_format(pe_header, Some("test.exe"));
        assert!(matches!(format, FileFormat::PE32));
    }

    #[test]
    fn test_elf_magic_bytes_detection() {
        let detector = FileDetector::new();
        let elf_header = b"\x7FELF\x01\x01\x01\x00";

        let format = detector.detect_format(elf_header, None);
        assert!(matches!(format, FileFormat::ELF32));
    }

    #[test]
    fn test_pdf_detection() {
        let detector = FileDetector::new();
        let pdf_header = b"%PDF-1.4\n";

        let format = detector.detect_format(pdf_header, Some("document.pdf"));
        assert_eq!(format, FileFormat::PDF);
    }

    #[test]
    fn test_javascript_content_detection() {
        let detector = FileDetector::new();
        let js_code = b"function test() { return true; }";

        let format = detector.detect_format(js_code, None);
        assert_eq!(format, FileFormat::JavaScript);
    }

    #[test]
    fn test_python_content_detection() {
        let detector = FileDetector::new();
        let py_code = b"def test():\n    return True\n";

        let format = detector.detect_format(py_code, None);
        assert_eq!(format, FileFormat::Python);
    }

    #[test]
    fn test_entropy_zero_for_uniform_data() {
        let uniform_data = vec![0x41; 1000]; // All 'A's
        let entropy = calculate_entropy(&uniform_data);

        assert_eq!(entropy, 0.0);
    }

    #[test]
    fn test_entropy_high_for_random_data() {
        let random_data: Vec<u8> = (0..256).map(|i| i as u8).collect();
        let entropy = calculate_entropy(&random_data);

        assert!(entropy > 7.0); // Should be close to 8.0 for perfect distribution
        assert!(entropy <= 8.0);
    }

    #[test]
    fn test_entropy_medium_for_text() {
        let text_data = b"The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.";
        let entropy = calculate_entropy(text_data);

        // English text typically has entropy around 4-5
        assert!(entropy > 3.0 && entropy < 6.0);
    }

    #[test]
    fn test_hash_calculation_consistency() {
        use sha2::{Sha256, Digest};

        let data = b"Hello, World!";

        let mut hasher1 = Sha256::new();
        hasher1.update(data);
        let hash1 = hex::encode(hasher1.finalize());

        let mut hasher2 = Sha256::new();
        hasher2.update(data);
        let hash2 = hex::encode(hasher2.finalize());

        assert_eq!(hash1, hash2);
        assert_eq!(hash1.len(), 64); // SHA256 produces 64 hex characters
    }

    #[test]
    fn test_hash_different_for_different_data() {
        use sha2::{Sha256, Digest};

        let data1 = b"Hello, World!";
        let data2 = b"Hello, World?";

        let mut hasher1 = Sha256::new();
        hasher1.update(data1);
        let hash1 = hex::encode(hasher1.finalize());

        let mut hasher2 = Sha256::new();
        hasher2.update(data2);
        let hash2 = hex::encode(hasher2.finalize());

        assert_ne!(hash1, hash2);
    }

    #[test]
    fn test_text_file_detection() {
        let detector = FileDetector::new();

        // Plain text should be detected
        assert!(detector.is_text_file(b"Hello, world!"));
        assert!(detector.is_text_file(b"Line 1\nLine 2\nLine 3"));

        // Binary data with null bytes should not be text
        assert!(!detector.is_text_file(b"\x00\x01\x02\x03"));
        assert!(!detector.is_text_file(b"Text\x00with\x00nulls"));
    }

    #[test]
    fn test_mime_type_mapping() {
        let detector = FileDetector::new();

        assert_eq!(detector.get_mime_type(FileFormat::PE32), "application/x-msdownload");
        assert_eq!(detector.get_mime_type(FileFormat::ELF32), "application/x-executable");
        assert_eq!(detector.get_mime_type(FileFormat::PDF), "application/pdf");
        assert_eq!(detector.get_mime_type(FileFormat::JavaScript), "application/javascript");
        assert_eq!(detector.get_mime_type(FileFormat::PlainText), "text/plain");
    }

    #[test]
    fn test_extension_detection() {
        let detector = FileDetector::new();

        assert_eq!(detector.detect_format(b"", Some("test.js")), FileFormat::JavaScript);
        assert_eq!(detector.detect_format(b"", Some("script.py")), FileFormat::Python);
        assert_eq!(detector.detect_format(b"", Some("program.exe")), FileFormat::PE32);
        assert_eq!(detector.detect_format(b"", Some("binary.elf")), FileFormat::ELF32);
    }

    #[test]
    fn test_json_content_detection() {
        let detector = FileDetector::new();
        let json_data = br#"{"key": "value", "number": 42}"#;

        let format = detector.detect_format(json_data, None);
        assert_eq!(format, FileFormat::JSON);
    }

    #[test]
    fn test_html_content_detection() {
        let detector = FileDetector::new();
        let html = b"<html><head><title>Test</title></head><body>Content</body></html>";

        let format = detector.detect_format(html, None);
        assert_eq!(format, FileFormat::HTML);
    }
}
