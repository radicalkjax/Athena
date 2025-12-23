use athena_file_processor::{FileProcessor, get_version};

#[test]
fn test_file_processor_creation() {
    let _processor = FileProcessor::new();
    // Test version using the module-level function
    assert_eq!(get_version(), env!("CARGO_PKG_VERSION"));
}

#[test]
fn test_format_detection() {
    let processor = FileProcessor::new();
    
    // Test PDF detection
    let pdf_data = b"%PDF-1.4 some content";
    let format = processor.detect_format(pdf_data, None);
    assert!(format.contains("pDF"));
    
    // Test with filename
    let format = processor.detect_format(b"", Some("test.js".to_string()));
    assert!(format.contains("javaScript"));
}

#[test]
fn test_text_file_detection() {
    let processor = FileProcessor::new();
    
    assert!(processor.is_text_file(b"Hello, World!"));
    assert!(!processor.is_text_file(b"\x00\x01\x02\x03"));
}

#[test]
fn test_string_extraction() {
    let processor = FileProcessor::new();
    
    let data = b"Hello World! This is a test.";
    let strings_json = processor.extract_strings(data, Some(5));
    
    // Should be valid JSON
    let parsed: serde_json::Value = serde_json::from_str(&strings_json).unwrap();
    assert!(parsed.is_array());
}