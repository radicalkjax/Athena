use wasm_bindgen::prelude::*;

pub mod detector;
pub mod parser;
pub mod validator;
pub mod extractor;
pub mod types;
pub mod utils;

use detector::FileDetector;
use types::{FileFormat, ParsedFile, FileProcessorError, ProcessorResult};
use validator::FileValidator;
use extractor::ContentExtractor;

#[wasm_bindgen]
pub struct FileProcessor {
    detector: FileDetector,
    validator: FileValidator,
    extractor: ContentExtractor,
}

#[wasm_bindgen]
impl FileProcessor {
    /// Create a new FileProcessor instance
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        utils::set_panic_hook();
        
        Self {
            detector: FileDetector::new(),
            validator: FileValidator::new(),
            extractor: ContentExtractor::new(),
        }
    }

    /// Detect the format of a file from its content and optional filename
    #[wasm_bindgen(js_name = detectFormat)]
    pub fn detect_format(&self, buffer: &[u8], filename: Option<String>) -> String {
        let format = self.detector.detect_format(buffer, filename.as_deref());
        serde_json::to_string(&format).unwrap_or_else(|_| "\"Unknown\"".to_string())
    }

    /// Parse a file and extract its content
    #[wasm_bindgen(js_name = parseFile)]
    pub fn parse_file(&self, buffer: &[u8], format_hint: Option<String>) -> Result<String, JsValue> {
        let format = if let Some(hint) = format_hint {
            serde_json::from_str(&hint).unwrap_or(FileFormat::Unknown)
        } else {
            self.detector.detect_format(buffer, None)
        };

        match self.parse_file_internal(buffer, format) {
            Ok(parsed) => Ok(serde_json::to_string(&parsed)
                .map_err(|e| JsValue::from_str(&e.to_string()))?),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    /// Validate a file for security and integrity
    #[wasm_bindgen(js_name = validateFile)]
    pub fn validate_file(&self, buffer: &[u8]) -> String {
        let format = self.detector.detect_format(buffer, None);
        let result = self.validator.validate_file(buffer, format);
        serde_json::to_string(&result).unwrap_or_else(|_| "{}".to_string())
    }

    /// Extract strings from a file
    #[wasm_bindgen(js_name = extractStrings)]
    pub fn extract_strings(&self, buffer: &[u8], min_length: Option<usize>) -> String {
        let strings = self.extractor.extract_strings(buffer, min_length.unwrap_or(4));
        serde_json::to_string(&strings).unwrap_or_else(|_| "[]".to_string())
    }

    /// Extract metadata from a file
    #[wasm_bindgen(js_name = extractMetadata)]
    pub fn extract_metadata(&self, buffer: &[u8]) -> Result<String, JsValue> {
        let format = self.detector.detect_format(buffer, None);
        
        match parser::extract_metadata(buffer, format) {
            Ok(metadata) => Ok(serde_json::to_string(&metadata)
                .map_err(|e| JsValue::from_str(&e.to_string()))?),
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    /// Check if a file appears to be text
    #[wasm_bindgen(js_name = isTextFile)]
    pub fn is_text_file(&self, buffer: &[u8]) -> bool {
        self.detector.is_text_file(buffer)
    }

    /// Get MIME type for a file format
    #[wasm_bindgen(js_name = getMimeType)]
    pub fn get_mime_type(&self, format: &str) -> String {
        let file_format: FileFormat = serde_json::from_str(format).unwrap_or(FileFormat::Unknown);
        self.detector.get_mime_type(file_format)
    }

    /// Extract suspicious patterns from content
    #[wasm_bindgen(js_name = extractSuspiciousPatterns)]
    pub fn extract_suspicious_patterns(&self, content: &str) -> String {
        let patterns = self.extractor.extract_suspicious_patterns(content);
        serde_json::to_string(&patterns).unwrap_or_else(|_| "[]".to_string())
    }
}

impl FileProcessor {
    /// Internal file parsing logic
    fn parse_file_internal(&self, buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
        // Validate the file first
        let validation = self.validator.validate_file(buffer, format.clone());
        if !validation.is_valid {
            return Err(FileProcessorError::ValidationFailed(validation.errors.join(", ")));
        }

        // Parse based on format
        let parsed = parser::parse_file(buffer, format)?;

        Ok(parsed)
    }
}

/// Initialize the WASM module
#[wasm_bindgen(start)]
pub fn init() {
    utils::set_panic_hook();
    web_sys::console::log_1(&"File Processor WASM module initialized".into());
}

/// Get version information
#[wasm_bindgen(js_name = getVersion)]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_processor_creation() {
        let processor = FileProcessor::new();
        assert!(processor.is_text_file(b"Hello, world!"));
    }

    #[test]
    fn test_format_detection() {
        let processor = FileProcessor::new();
        
        // Test PDF detection
        let pdf_magic = b"%PDF-1.4";
        let format_json = processor.detect_format(pdf_magic, None);
        assert!(format_json.contains("\"pDF\""));
        
        // Test with filename hint
        let format_json = processor.detect_format(b"", Some("test.js".to_string()));
        assert!(format_json.contains("\"javaScript\""));
    }

    #[test]
    fn test_string_extraction() {
        let processor = FileProcessor::new();
        let content = b"Hello World! This is a test string.";
        
        let strings_json = processor.extract_strings(content, Some(5));
        let strings: Vec<types::ExtractedString> = serde_json::from_str(&strings_json).unwrap();
        
        let string_values: Vec<String> = strings.iter().map(|s| s.value.clone()).collect();
        assert!(string_values.contains(&"Hello World! This is a test string.".to_string()));
    }
}