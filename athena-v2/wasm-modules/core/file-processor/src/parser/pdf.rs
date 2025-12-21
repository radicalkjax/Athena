use crate::types::{
    FileFormat, ParsedFile, FileMetadata, FileSection, ProcessorResult, FileProcessorError,
    SuspiciousIndicator, SuspiciousSeverity, FileIntegrity, EmbeddedFile
};
use crate::extractor::ContentExtractor;
use std::collections::HashMap;

/// Parse PDF files with security analysis
pub fn parse_pdf(buffer: &[u8]) -> ProcessorResult<ParsedFile> {
    let mut metadata = FileMetadata {
        size: buffer.len(),
        hash: super::calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(FileFormat::PDF),
        created_at: None,
        modified_at: None,
        attributes: HashMap::new(),
    };

    let mut sections = Vec::new();
    let mut embedded_files = Vec::new();
    let mut suspicious_indicators = Vec::new();

    // Validate minimum size
    if buffer.len() < 20 {
        return Err(FileProcessorError::MalformedStructure(
            "PDF file too small".to_string()
        ));
    }

    // Check PDF header
    if !buffer.starts_with(b"%PDF-") {
        return Err(FileProcessorError::InvalidFormat(
            "Missing PDF header".to_string()
        ));
    }

    // Extract PDF version
    let version = extract_pdf_version(buffer);
    if let Some(v) = &version {
        metadata.attributes.insert("pdf_version".to_string(), v.clone());
    }

    // Find PDF trailer and xref
    let trailer_info = find_trailer_and_xref(buffer);
    if let Some((xref_offset, trailer_offset)) = trailer_info {
        metadata.attributes.insert("xref_offset".to_string(), xref_offset.to_string());
        metadata.attributes.insert("trailer_offset".to_string(), trailer_offset.to_string());
    }

    // Parse PDF structure and look for suspicious elements
    analyze_pdf_structure(buffer, &mut sections, &mut suspicious_indicators, &mut embedded_files);

    // Extract metadata from PDF info dictionary
    extract_pdf_metadata(buffer, &mut metadata)?;

    // Check for JavaScript
    detect_javascript(buffer, &mut suspicious_indicators);

    // Check for embedded files
    detect_embedded_files(buffer, &mut suspicious_indicators, &mut embedded_files);

    // Check for suspicious form actions
    detect_form_actions(buffer, &mut suspicious_indicators);

    // Check for unusual compression/encoding
    detect_suspicious_encoding(buffer, &mut suspicious_indicators);

    // Extract strings
    let extractor = ContentExtractor::new();
    let strings = extractor.extract_strings(buffer, 5);

    // Check file integrity
    let integrity = FileIntegrity {
        valid_structure: trailer_info.is_some(),
        checksum_valid: None,
        signature_valid: None,
        issues: Vec::new(),
    };

    Ok(ParsedFile {
        format: FileFormat::PDF,
        metadata,
        sections,
        embedded_files,
        strings,
        suspicious_indicators,
        integrity,
    })
}

/// Extract PDF version from header
fn extract_pdf_version(buffer: &[u8]) -> Option<String> {
    if buffer.len() >= 8 {
        if let Ok(header) = std::str::from_utf8(&buffer[0..8]) {
            if header.starts_with("%PDF-") {
                let version = &header[5..];
                return Some(version.trim().to_string());
            }
        }
    }
    None
}

/// Find trailer and xref table
fn find_trailer_and_xref(buffer: &[u8]) -> Option<(usize, usize)> {
    // Search for "%%EOF" from the end
    let eof_pattern = b"%%EOF";
    let mut eof_pos = None;
    
    for i in (0..buffer.len().saturating_sub(eof_pattern.len())).rev() {
        if &buffer[i..i + eof_pattern.len()] == eof_pattern {
            eof_pos = Some(i);
            break;
        }
    }

    if eof_pos.is_none() {
        return None;
    }

    // Search for "trailer" before EOF
    let trailer_pattern = b"trailer";
    let mut trailer_pos = None;
    
    let search_start = eof_pos.unwrap().saturating_sub(1024);
    for i in (search_start..eof_pos.unwrap()).rev() {
        if i + trailer_pattern.len() <= buffer.len() && 
           &buffer[i..i + trailer_pattern.len()] == trailer_pattern {
            trailer_pos = Some(i);
            break;
        }
    }

    // Search for "xref" before trailer
    let xref_pattern = b"xref";
    let mut xref_pos = None;
    
    if let Some(tp) = trailer_pos {
        let search_start = tp.saturating_sub(10000);
        for i in (search_start..tp).rev() {
            if i + xref_pattern.len() <= buffer.len() && 
               &buffer[i..i + xref_pattern.len()] == xref_pattern {
                xref_pos = Some(i);
                break;
            }
        }
    }

    match (xref_pos, trailer_pos) {
        (Some(x), Some(t)) => Some((x, t)),
        _ => None,
    }
}

/// Analyze PDF structure for suspicious elements
fn analyze_pdf_structure(
    buffer: &[u8], 
    sections: &mut Vec<FileSection>,
    suspicious_indicators: &mut Vec<SuspiciousIndicator>,
    _embedded_files: &mut Vec<EmbeddedFile>
) {
    // Look for object streams
    let obj_pattern = b" obj";
    let endobj_pattern = b"endobj";
    let mut object_count = 0;
    let mut stream_count = 0;
    
    let mut i = 0;
    while i < buffer.len().saturating_sub(obj_pattern.len()) {
        if &buffer[i..i + obj_pattern.len()] == obj_pattern {
            object_count += 1;
            
            // Find end of this object
            let mut j = i + obj_pattern.len();
            while j < buffer.len().saturating_sub(endobj_pattern.len()) {
                if &buffer[j..j + endobj_pattern.len()] == endobj_pattern {
                    // Check for streams within this object
                    let obj_content = &buffer[i..j];
                    if contains_pattern(obj_content, b"stream") {
                        stream_count += 1;
                        
                        // Calculate entropy of stream content
                        if let Some(stream_data) = extract_stream_data(obj_content) {
                            let entropy = super::calculate_entropy(stream_data);
                            
                            sections.push(FileSection {
                                name: format!("Stream_{}", stream_count),
                                offset: i,
                                size: j - i,
                                entropy,
                                flags: vec!["STREAM".to_string()],
                            });
                            
                            // High entropy might indicate encryption or compression
                            if entropy > 7.5 {
                                suspicious_indicators.push(SuspiciousIndicator {
                                    indicator_type: "High Entropy Stream".to_string(),
                                    description: format!("Stream {} has high entropy ({:.2})", stream_count, entropy),
                                    severity: SuspiciousSeverity::Low,
                                    location: Some(format!("Object at offset {}", i)),
                                    evidence: "Possible encryption or obfuscation".to_string(),
                                });
                            }
                        }
                    }
                    break;
                }
                j += 1;
            }
        }
        i += 1;
    }

    // Add general PDF structure section
    sections.push(FileSection {
        name: "PDF_Structure".to_string(),
        offset: 0,
        size: buffer.len(),
        entropy: super::calculate_entropy(buffer),
        flags: vec![
            format!("Objects: {}", object_count),
            format!("Streams: {}", stream_count),
        ],
    });
}

/// Extract stream data from object content
fn extract_stream_data(obj_content: &[u8]) -> Option<&[u8]> {
    let stream_start = b"stream";
    let stream_end = b"endstream";
    
    if let Some(start_pos) = find_pattern(obj_content, stream_start) {
        let start = start_pos + stream_start.len();
        // Skip whitespace after "stream"
        let mut actual_start = start;
        while actual_start < obj_content.len() && 
              (obj_content[actual_start] == b'\n' || 
               obj_content[actual_start] == b'\r' || 
               obj_content[actual_start] == b' ') {
            actual_start += 1;
        }
        
        if let Some(end_pos) = find_pattern(&obj_content[actual_start..], stream_end) {
            return Some(&obj_content[actual_start..actual_start + end_pos]);
        }
    }
    None
}

/// Detect JavaScript in PDF
fn detect_javascript(buffer: &[u8], suspicious_indicators: &mut Vec<SuspiciousIndicator>) {
    let js_patterns: Vec<&[u8]> = vec![
        b"/JS",
        b"/JavaScript",
        b"<</JS",
        b"<</JavaScript",
    ];
    
    for pattern in &js_patterns {
        if contains_pattern(buffer, pattern) {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "JavaScript Detected".to_string(),
                description: "PDF contains JavaScript code".to_string(),
                severity: SuspiciousSeverity::High,
                location: Some("PDF Document".to_string()),
                evidence: format!("Found {} pattern", String::from_utf8_lossy(pattern)),
            });
            
            // Try to extract some JS content for evidence
            if let Some(pos) = find_pattern(buffer, pattern) {
                let sample_start = pos;
                let sample_end = (pos + 100).min(buffer.len());
                let sample = String::from_utf8_lossy(&buffer[sample_start..sample_end]);
                suspicious_indicators.push(SuspiciousIndicator {
                    indicator_type: "JavaScript Sample".to_string(),
                    description: "Sample of JavaScript content".to_string(),
                    severity: SuspiciousSeverity::Medium,
                    location: Some(format!("Offset {}", pos)),
                    evidence: sample.to_string(),
                });
            }
        }
    }
    
    // Check for OpenAction which can trigger JS
    if contains_pattern(buffer, b"/OpenAction") {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "OpenAction Detected".to_string(),
            description: "PDF has OpenAction that executes on document open".to_string(),
            severity: SuspiciousSeverity::Medium,
            location: Some("PDF Document".to_string()),
            evidence: "Automatic action execution".to_string(),
        });
    }
}

/// Detect embedded files
fn detect_embedded_files(
    buffer: &[u8], 
    suspicious_indicators: &mut Vec<SuspiciousIndicator>,
    embedded_files: &mut Vec<EmbeddedFile>
) {
    let embed_patterns: Vec<&[u8]> = vec![
        b"/EmbeddedFiles",
        b"/EmbeddedFile",
        b"/FileAttachment",
    ];
    
    for pattern in &embed_patterns {
        if contains_pattern(buffer, pattern) {
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "Embedded Files".to_string(),
                description: "PDF contains embedded files".to_string(),
                severity: SuspiciousSeverity::Medium,
                location: Some("PDF Document".to_string()),
                evidence: format!("Found {} pattern", String::from_utf8_lossy(pattern)),
            });
            
            // Try to identify embedded file types
            if let Some(pos) = find_pattern(buffer, pattern) {
                // Look for file specifications nearby
                let search_start = pos.saturating_sub(100);
                let search_end = (pos + 500).min(buffer.len());
                let search_area = &buffer[search_start..search_end];
                
                // Check for executable patterns
                if contains_pattern(search_area, b".exe") || 
                   contains_pattern(search_area, b".dll") ||
                   contains_pattern(search_area, b".scr") {
                    suspicious_indicators.push(SuspiciousIndicator {
                        indicator_type: "Embedded Executable".to_string(),
                        description: "PDF may contain embedded executable file".to_string(),
                        severity: SuspiciousSeverity::High,
                        location: Some(format!("Near offset {}", pos)),
                        evidence: "Executable file extension detected".to_string(),
                    });
                }
                
                // Add to embedded files list (simplified - real implementation would parse properly)
                embedded_files.push(EmbeddedFile {
                    name: Some("Unknown Embedded File".to_string()),
                    format: FileFormat::Unknown,
                    offset: pos,
                    size: 0, // Would need proper parsing to determine
                    hash: String::new(),
                });
            }
        }
    }
}

/// Detect suspicious form actions
fn detect_form_actions(buffer: &[u8], suspicious_indicators: &mut Vec<SuspiciousIndicator>) {
    let form_patterns: Vec<&[u8]> = vec![
        b"/SubmitForm",
        b"/Launch",
        b"/URI",
        b"/GoToR",
        b"/ImportData",
    ];
    
    for pattern in &form_patterns {
        if contains_pattern(buffer, pattern) {
            let severity = match pattern.as_ref() {
                b"/Launch" => SuspiciousSeverity::High,
                b"/ImportData" => SuspiciousSeverity::High,
                _ => SuspiciousSeverity::Medium,
            };
            
            suspicious_indicators.push(SuspiciousIndicator {
                indicator_type: "Suspicious Action".to_string(),
                description: format!("PDF contains {} action", String::from_utf8_lossy(pattern)),
                severity,
                location: Some("PDF Form/Action".to_string()),
                evidence: "Can perform external actions".to_string(),
            });
        }
    }
}

/// Detect suspicious encoding or compression
fn detect_suspicious_encoding(buffer: &[u8], suspicious_indicators: &mut Vec<SuspiciousIndicator>) {
    // Check for multiple levels of encoding
    let encoding_patterns: Vec<&[u8]> = vec![
        b"/FlateDecode",
        b"/ASCIIHexDecode", 
        b"/ASCII85Decode",
        b"/LZWDecode",
        b"/RunLengthDecode",
        b"/CCITTFaxDecode",
        b"/JBIG2Decode",
        b"/DCTDecode",
        b"/JPXDecode",
        b"/Crypt",
    ];
    
    let mut encoding_count = 0;
    let mut found_encodings = Vec::new();
    
    for pattern in &encoding_patterns {
        if contains_pattern(buffer, pattern) {
            encoding_count += 1;
            found_encodings.push(String::from_utf8_lossy(pattern).to_string());
        }
    }
    
    // Multiple encodings might indicate obfuscation
    if encoding_count > 3 {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "Multiple Encodings".to_string(),
            description: format!("PDF uses {} different encodings", encoding_count),
            severity: SuspiciousSeverity::Medium,
            location: Some("PDF Streams".to_string()),
            evidence: found_encodings.join(", "),
        });
    }
    
    // Crypt filter indicates encryption
    if contains_pattern(buffer, b"/Crypt") {
        suspicious_indicators.push(SuspiciousIndicator {
            indicator_type: "Encrypted Content".to_string(),
            description: "PDF contains encrypted streams".to_string(),
            severity: SuspiciousSeverity::Low,
            location: Some("PDF Streams".to_string()),
            evidence: "Crypt filter detected".to_string(),
        });
    }
}

/// Helper function to check if pattern exists in buffer
fn contains_pattern(buffer: &[u8], pattern: &[u8]) -> bool {
    find_pattern(buffer, pattern).is_some()
}

/// Helper function to find pattern in buffer
fn find_pattern(buffer: &[u8], pattern: &[u8]) -> Option<usize> {
    if pattern.is_empty() || pattern.len() > buffer.len() {
        return None;
    }
    
    for i in 0..=buffer.len() - pattern.len() {
        if &buffer[i..i + pattern.len()] == pattern {
            return Some(i);
        }
    }
    None
}

/// Extract PDF-specific metadata
pub fn extract_pdf_metadata(buffer: &[u8], metadata: &mut FileMetadata) -> ProcessorResult<()> {
    metadata.attributes.insert("format".to_string(), "PDF".to_string());
    
    // Look for Info dictionary
    let info_pattern = b"/Info";
    if let Some(info_pos) = find_pattern(buffer, info_pattern) {
        // Try to extract metadata fields
        let search_start = info_pos;
        let search_end = (info_pos + 1000).min(buffer.len());
        let info_area = &buffer[search_start..search_end];
        
        // Extract common metadata fields
        extract_metadata_field(info_area, b"/Title", metadata, "title");
        extract_metadata_field(info_area, b"/Author", metadata, "author");
        extract_metadata_field(info_area, b"/Subject", metadata, "subject");
        extract_metadata_field(info_area, b"/Keywords", metadata, "keywords");
        extract_metadata_field(info_area, b"/Creator", metadata, "creator");
        extract_metadata_field(info_area, b"/Producer", metadata, "producer");
        extract_metadata_field(info_area, b"/CreationDate", metadata, "creation_date");
        extract_metadata_field(info_area, b"/ModDate", metadata, "modification_date");
    }
    
    // Count pages (simplified)
    let page_count = buffer.windows(6).filter(|w| w == b"/Page ").count();
    if page_count > 0 {
        metadata.attributes.insert("page_count".to_string(), page_count.to_string());
    }
    
    Ok(())
}

/// Extract a metadata field value
fn extract_metadata_field(
    buffer: &[u8], 
    field: &[u8], 
    metadata: &mut FileMetadata, 
    attribute_name: &str
) {
    if let Some(pos) = find_pattern(buffer, field) {
        let start = pos + field.len();
        // Skip whitespace
        let mut actual_start = start;
        while actual_start < buffer.len() && buffer[actual_start] == b' ' {
            actual_start += 1;
        }
        
        // Look for string delimiters
        if actual_start < buffer.len() {
            if buffer[actual_start] == b'(' {
                // Literal string
                let mut end = actual_start + 1;
                let mut escape = false;
                while end < buffer.len() {
                    if !escape && buffer[end] == b')' {
                        let value = String::from_utf8_lossy(&buffer[actual_start + 1..end]);
                        metadata.attributes.insert(attribute_name.to_string(), value.to_string());
                        break;
                    }
                    escape = !escape && buffer[end] == b'\\';
                    end += 1;
                }
            } else if buffer[actual_start] == b'<' {
                // Hex string
                let mut end = actual_start + 1;
                while end < buffer.len() && buffer[end] != b'>' {
                    end += 1;
                }
                if end < buffer.len() {
                    let hex_str = &buffer[actual_start + 1..end];
                    if let Ok(value) = std::str::from_utf8(hex_str) {
                        metadata.attributes.insert(attribute_name.to_string(), value.to_string());
                    }
                }
            }
        }
    }
}