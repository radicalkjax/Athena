// Component Model implementation for athena:file-processor

wit_bindgen::generate!({
    world: "file-processor-component",
    path: "wit",
});

use crate::detector::FileDetector;
use crate::validator::FileValidator;
use crate::extractor::ContentExtractor;
use crate::types::FileFormat as InternalFileFormat;
use crate::parser;

// ============================================================================
// Component struct - implements all interfaces
// ============================================================================

struct Component;

// ============================================================================
// Detector Interface Implementation
// ============================================================================

impl exports::athena::file_processor::detector::Guest for Component {
    fn detect_format(buffer: Vec<u8>, filename: Option<String>) -> exports::athena::file_processor::detector::FileFormat {
        let detector = FileDetector::new();
        let format = detector.detect_format(&buffer, filename.as_deref());
        convert_format_to_wit(format)
    }

    fn is_text_file(buffer: Vec<u8>) -> bool {
        let detector = FileDetector::new();
        detector.is_text_file(&buffer)
    }

    fn get_mime_type(format: exports::athena::file_processor::detector::FileFormat) -> String {
        let detector = FileDetector::new();
        let internal_format = convert_format_from_wit(format);
        detector.get_mime_type(internal_format)
    }
}

// ============================================================================
// Validator Interface Implementation
// ============================================================================

impl exports::athena::file_processor::validator::Guest for Component {
    fn validate_file(
        buffer: Vec<u8>,
        format: exports::athena::file_processor::detector::FileFormat,
    ) -> exports::athena::file_processor::validator::ValidationResult {
        let validator = FileValidator::new();
        let internal_format = convert_format_from_wit(format);
        let result = validator.validate_file(&buffer, internal_format);

        exports::athena::file_processor::validator::ValidationResult {
            is_valid: result.is_valid,
            format_valid: result.format_valid,
            size_valid: result.size_valid,
            content_safe: result.content_safe,
            errors: result.errors,
            warnings: result.warnings,
        }
    }
}

// ============================================================================
// Parser Interface Implementation
// ============================================================================

impl exports::athena::file_processor::parser::Guest for Component {
    fn parse_file(
        buffer: Vec<u8>,
        format_hint: Option<exports::athena::file_processor::detector::FileFormat>,
    ) -> Result<exports::athena::file_processor::parser::ParsedFile, String> {
        let detector = FileDetector::new();
        let format = if let Some(hint) = format_hint {
            convert_format_from_wit(hint)
        } else {
            detector.detect_format(&buffer, None)
        };

        match parser::parse_file(&buffer, format) {
            Ok(parsed) => {
                // Convert parsed file to WIT format
                Ok(exports::athena::file_processor::parser::ParsedFile {
                    format: convert_format_to_wit(parsed.format),
                    metadata: exports::athena::file_processor::parser::FileMetadata {
                        size: parsed.metadata.size as u64,
                        hash: parsed.metadata.hash,
                        mime_type: parsed.metadata.mime_type,
                        created_at: parsed.metadata.created_at,
                        modified_at: parsed.metadata.modified_at,
                        attributes: parsed.metadata.attributes.into_iter().collect(),
                    },
                    sections: parsed.sections.into_iter().map(|s| {
                        exports::athena::file_processor::parser::FileSection {
                            name: s.name,
                            offset: s.offset as u64,
                            size: s.size as u64,
                            entropy: s.entropy,
                            section_flags: s.flags,
                        }
                    }).collect(),
                    embedded_files: parsed.embedded_files.into_iter().map(|e| {
                        exports::athena::file_processor::parser::EmbeddedFile {
                            name: e.name,
                            format: convert_format_to_wit(e.format),
                            offset: e.offset as u64,
                            size: e.size as u64,
                            hash: e.hash,
                        }
                    }).collect(),
                    strings: parsed.strings.into_iter().map(|s| s.value).collect(),
                    suspicious_indicators: parsed.suspicious_indicators.into_iter().map(|i| {
                        exports::athena::file_processor::parser::SuspiciousIndicator {
                            indicator_type: i.indicator_type,
                            description: i.description,
                            severity: convert_severity_to_wit(i.severity),
                            location: i.location,
                            evidence: i.evidence,
                        }
                    }).collect(),
                    integrity: exports::athena::file_processor::parser::FileIntegrity {
                        valid_structure: parsed.integrity.valid_structure,
                        checksum_valid: parsed.integrity.checksum_valid,
                        signature_valid: parsed.integrity.signature_valid,
                        issues: parsed.integrity.issues,
                    },
                })
            }
            Err(e) => Err(e.to_string()),
        }
    }

    fn extract_metadata(
        buffer: Vec<u8>,
        format: exports::athena::file_processor::detector::FileFormat,
    ) -> Result<exports::athena::file_processor::parser::FileMetadata, String> {
        let internal_format = convert_format_from_wit(format);

        match parser::extract_metadata(&buffer, internal_format) {
            Ok(metadata) => {
                Ok(exports::athena::file_processor::parser::FileMetadata {
                    size: metadata.size as u64,
                    hash: metadata.hash,
                    mime_type: metadata.mime_type,
                    created_at: metadata.created_at,
                    modified_at: metadata.modified_at,
                    attributes: metadata.attributes.into_iter().collect(),
                })
            }
            Err(e) => Err(e.to_string()),
        }
    }
}

// ============================================================================
// Extractor Interface Implementation
// ============================================================================

impl exports::athena::file_processor::extractor::Guest for Component {
    fn extract_strings(buffer: Vec<u8>, min_length: u32) -> Vec<exports::athena::file_processor::extractor::ExtractedString> {
        let extractor = ContentExtractor::new();
        let strings = extractor.extract_strings(&buffer, min_length as usize);

        strings.into_iter().map(|s| {
            exports::athena::file_processor::extractor::ExtractedString {
                value: s.value,
                offset: s.offset as u64,
                encoding: s.encoding,
                suspicious: s.suspicious,
            }
        }).collect()
    }

    fn extract_suspicious_patterns(content: String) -> Vec<exports::athena::file_processor::extractor::SuspiciousPattern> {
        let extractor = ContentExtractor::new();
        let patterns = extractor.extract_suspicious_patterns(&content);

        patterns.into_iter().map(|p| {
            exports::athena::file_processor::extractor::SuspiciousPattern {
                pattern_type: convert_pattern_type_to_wit(p.pattern_type),
                value: p.value,
                context: p.context,
                confidence: p.confidence,
            }
        }).collect()
    }
}

// ============================================================================
// Helper Functions - Format Conversion
// ============================================================================

fn convert_format_to_wit(format: InternalFileFormat) -> exports::athena::file_processor::detector::FileFormat {
    use exports::athena::file_processor::detector::FileFormat as WitFormat;

    match format {
        InternalFileFormat::PE32 => WitFormat::Pe32,
        InternalFileFormat::PE64 => WitFormat::Pe64,
        InternalFileFormat::ELF32 => WitFormat::Elf32,
        InternalFileFormat::ELF64 => WitFormat::Elf64,
        InternalFileFormat::MachO => WitFormat::Macho,
        InternalFileFormat::PDF => WitFormat::Pdf,
        InternalFileFormat::DOCX => WitFormat::Docx,
        InternalFileFormat::XLSX => WitFormat::Xlsx,
        InternalFileFormat::PPTX => WitFormat::Pptx,
        InternalFileFormat::ODT => WitFormat::Odt,
        InternalFileFormat::ZIP => WitFormat::Zip,
        InternalFileFormat::RAR => WitFormat::Rar,
        InternalFileFormat::SevenZ => WitFormat::Sevenz,
        InternalFileFormat::TAR => WitFormat::Tar,
        InternalFileFormat::GZIP => WitFormat::Gzip,
        InternalFileFormat::JavaScript => WitFormat::Javascript,
        InternalFileFormat::TypeScript => WitFormat::Typescript,
        InternalFileFormat::Python => WitFormat::Python,
        InternalFileFormat::PowerShell => WitFormat::Powershell,
        InternalFileFormat::Batch => WitFormat::Batch,
        InternalFileFormat::Shell => WitFormat::Shell,
        InternalFileFormat::PHP => WitFormat::Php,
        InternalFileFormat::Ruby => WitFormat::Ruby,
        InternalFileFormat::HTML => WitFormat::Html,
        InternalFileFormat::XML => WitFormat::Xml,
        InternalFileFormat::JSON => WitFormat::Json,
        InternalFileFormat::CSS => WitFormat::Css,
        InternalFileFormat::PlainText => WitFormat::PlainText,
        InternalFileFormat::Binary => WitFormat::Binary,
        InternalFileFormat::Unknown => WitFormat::Unknown,
    }
}

fn convert_format_from_wit(format: exports::athena::file_processor::detector::FileFormat) -> InternalFileFormat {
    use exports::athena::file_processor::detector::FileFormat as WitFormat;

    match format {
        WitFormat::Pe32 => InternalFileFormat::PE32,
        WitFormat::Pe64 => InternalFileFormat::PE64,
        WitFormat::Elf32 => InternalFileFormat::ELF32,
        WitFormat::Elf64 => InternalFileFormat::ELF64,
        WitFormat::Macho => InternalFileFormat::MachO,
        WitFormat::Pdf => InternalFileFormat::PDF,
        WitFormat::Docx => InternalFileFormat::DOCX,
        WitFormat::Xlsx => InternalFileFormat::XLSX,
        WitFormat::Pptx => InternalFileFormat::PPTX,
        WitFormat::Odt => InternalFileFormat::ODT,
        WitFormat::Zip => InternalFileFormat::ZIP,
        WitFormat::Rar => InternalFileFormat::RAR,
        WitFormat::Sevenz => InternalFileFormat::SevenZ,
        WitFormat::Tar => InternalFileFormat::TAR,
        WitFormat::Gzip => InternalFileFormat::GZIP,
        WitFormat::Javascript => InternalFileFormat::JavaScript,
        WitFormat::Typescript => InternalFileFormat::TypeScript,
        WitFormat::Python => InternalFileFormat::Python,
        WitFormat::Powershell => InternalFileFormat::PowerShell,
        WitFormat::Batch => InternalFileFormat::Batch,
        WitFormat::Shell => InternalFileFormat::Shell,
        WitFormat::Php => InternalFileFormat::PHP,
        WitFormat::Ruby => InternalFileFormat::Ruby,
        WitFormat::Html => InternalFileFormat::HTML,
        WitFormat::Xml => InternalFileFormat::XML,
        WitFormat::Json => InternalFileFormat::JSON,
        WitFormat::Css => InternalFileFormat::CSS,
        WitFormat::PlainText => InternalFileFormat::PlainText,
        WitFormat::Binary => InternalFileFormat::Binary,
        WitFormat::Unknown => InternalFileFormat::Unknown,
    }
}

fn convert_severity_to_wit(severity: crate::types::SuspiciousSeverity) -> exports::athena::file_processor::parser::SuspiciousSeverity {
    use exports::athena::file_processor::parser::SuspiciousSeverity as WitSeverity;

    match severity {
        crate::types::SuspiciousSeverity::Low => WitSeverity::Low,
        crate::types::SuspiciousSeverity::Medium => WitSeverity::Medium,
        crate::types::SuspiciousSeverity::High => WitSeverity::High,
        crate::types::SuspiciousSeverity::Critical => WitSeverity::Critical,
    }
}

fn convert_pattern_type_to_wit(pattern_type: crate::types::PatternType) -> exports::athena::file_processor::extractor::PatternType {
    use exports::athena::file_processor::extractor::PatternType as WitPatternType;

    match pattern_type {
        crate::types::PatternType::URL => WitPatternType::Url,
        crate::types::PatternType::IPAddress => WitPatternType::IpAddress,
        crate::types::PatternType::Domain => WitPatternType::Domain,
        crate::types::PatternType::Email => WitPatternType::Email,
        crate::types::PatternType::Base64 => WitPatternType::Base64,
        crate::types::PatternType::HexEncoded => WitPatternType::HexEncoded,
        crate::types::PatternType::ObfuscatedCode => WitPatternType::ObfuscatedCode,
        crate::types::PatternType::CryptoWallet => WitPatternType::CryptoWallet,
        crate::types::PatternType::APIKey => WitPatternType::ApiKey,
        crate::types::PatternType::Password => WitPatternType::Password,
    }
}

// ============================================================================
// Export Component Implementations
// ============================================================================

export!(Component);
