use crate::types::{
    FileFormat, ParsedFile, FileMetadata, FileSection,
    SuspiciousIndicator, SuspiciousSeverity, FileIntegrity, ProcessorResult
};
use crate::extractor::ContentExtractor;
use std::collections::HashMap;

/// Parse script files (JavaScript, Python, PowerShell, etc.)
pub fn parse_script(buffer: &[u8], format: FileFormat) -> ProcessorResult<ParsedFile> {
    let content = std::str::from_utf8(buffer)
        .map_err(|e| crate::types::FileProcessorError::ParseError(format!("Invalid UTF-8: {}", e)))?;

    let metadata = FileMetadata {
        size: buffer.len(),
        hash: super::calculate_sha256(buffer),
        mime_type: crate::detector::FileDetector::new().get_mime_type(format.clone()),
        created_at: None,
        modified_at: None,
        attributes: extract_script_attributes(content, &format),
    };

    let sections = vec![FileSection {
        name: "Script Content".to_string(),
        offset: 0,
        size: buffer.len(),
        entropy: super::calculate_entropy(buffer),
        flags: detect_script_flags(content, &format),
    }];

    let extractor = ContentExtractor::new();
    let strings = extractor.extract_strings(buffer, 4);
    let suspicious_indicators = detect_suspicious_script_patterns(content, &format);

    let integrity = FileIntegrity {
        valid_structure: true,
        checksum_valid: None,
        signature_valid: None,
        issues: validate_script_syntax(content, &format),
    };

    Ok(ParsedFile {
        format,
        metadata,
        sections,
        embedded_files: Vec::new(),
        strings,
        suspicious_indicators,
        integrity,
    })
}

/// Extract script-specific attributes
fn extract_script_attributes(content: &str, format: &FileFormat) -> HashMap<String, String> {
    let mut attributes = HashMap::new();

    // Line count
    let line_count = content.lines().count();
    attributes.insert("line_count".to_string(), line_count.to_string());

    // Language-specific attributes
    match format {
        FileFormat::JavaScript | FileFormat::TypeScript => {
            extract_js_attributes(content, &mut attributes);
        }
        FileFormat::Python => {
            extract_python_attributes(content, &mut attributes);
        }
        FileFormat::PowerShell => {
            extract_powershell_attributes(content, &mut attributes);
        }
        _ => {}
    }

    attributes
}

/// Extract JavaScript/TypeScript attributes
fn extract_js_attributes(content: &str, attributes: &mut HashMap<String, String>) {
    // Count functions
    let function_count = content.matches("function").count() + 
                        content.matches("=>").count();
    attributes.insert("function_count".to_string(), function_count.to_string());

    // Check for imports/requires
    let has_imports = content.contains("import ") || content.contains("require(");
    attributes.insert("has_imports".to_string(), has_imports.to_string());

    // Check for exports
    let has_exports = content.contains("export ") || content.contains("module.exports");
    attributes.insert("has_exports".to_string(), has_exports.to_string());

    // Detect framework
    if content.contains("React") || content.contains("useState") {
        attributes.insert("framework".to_string(), "React".to_string());
    } else if content.contains("Vue") || content.contains("v-model") {
        attributes.insert("framework".to_string(), "Vue".to_string());
    } else if content.contains("@angular") {
        attributes.insert("framework".to_string(), "Angular".to_string());
    }
}

/// Extract Python attributes
fn extract_python_attributes(content: &str, attributes: &mut HashMap<String, String>) {
    // Count functions and classes
    let function_count = content.matches("def ").count();
    let class_count = content.matches("class ").count();
    attributes.insert("function_count".to_string(), function_count.to_string());
    attributes.insert("class_count".to_string(), class_count.to_string());

    // Check for imports
    let import_count = content.matches("import ").count() + content.matches("from ").count();
    attributes.insert("import_count".to_string(), import_count.to_string());

    // Detect common libraries
    if content.contains("import numpy") || content.contains("from numpy") {
        attributes.insert("uses_numpy".to_string(), "true".to_string());
    }
    if content.contains("import pandas") || content.contains("from pandas") {
        attributes.insert("uses_pandas".to_string(), "true".to_string());
    }
    if content.contains("import tensorflow") || content.contains("import torch") {
        attributes.insert("uses_ml_framework".to_string(), "true".to_string());
    }
}

/// Extract PowerShell attributes
fn extract_powershell_attributes(content: &str, attributes: &mut HashMap<String, String>) {
    // Count cmdlets
    let cmdlet_count = content.matches("Get-").count() + 
                      content.matches("Set-").count() +
                      content.matches("New-").count();
    attributes.insert("cmdlet_count".to_string(), cmdlet_count.to_string());

    // Check for dangerous operations
    let has_invoke = content.contains("Invoke-Expression") || content.contains("iex");
    attributes.insert("has_invoke_expression".to_string(), has_invoke.to_string());

    // Check for remote operations
    let has_remote = content.contains("Invoke-WebRequest") || 
                    content.contains("Invoke-RestMethod");
    attributes.insert("has_remote_operations".to_string(), has_remote.to_string());
}

/// Detect script flags
fn detect_script_flags(content: &str, format: &FileFormat) -> Vec<String> {
    let mut flags = Vec::new();

    // Common flags
    if content.len() < 100 {
        flags.push("SMALL_SCRIPT".to_string());
    }
    if content.len() > 100000 {
        flags.push("LARGE_SCRIPT".to_string());
    }

    // Obfuscation detection
    if is_likely_obfuscated(content) {
        flags.push("OBFUSCATED".to_string());
    }

    // Minification detection
    if is_likely_minified(content, format) {
        flags.push("MINIFIED".to_string());
    }

    // Language-specific flags
    match format {
        FileFormat::JavaScript | FileFormat::TypeScript => {
            if content.contains("eval(") {
                flags.push("USES_EVAL".to_string());
            }
            if content.contains("Function(") {
                flags.push("DYNAMIC_FUNCTION".to_string());
            }
        }
        FileFormat::PowerShell => {
            if content.contains("-EncodedCommand") {
                flags.push("ENCODED_COMMAND".to_string());
            }
            if content.contains("-NoProfile") {
                flags.push("NO_PROFILE".to_string());
            }
        }
        _ => {}
    }

    flags
}

/// Detect suspicious patterns in scripts
fn detect_suspicious_script_patterns(
    content: &str,
    format: &FileFormat
) -> Vec<SuspiciousIndicator> {
    let mut indicators = Vec::new();

    // Common suspicious patterns
    let patterns = [
        ("eval(", "Dynamic code execution via eval()", SuspiciousSeverity::High),
        ("Function(", "Dynamic function creation", SuspiciousSeverity::High),
        ("child_process", "Process execution capability", SuspiciousSeverity::High),
        ("exec(", "Command execution", SuspiciousSeverity::High),
        ("system(", "System command execution", SuspiciousSeverity::High),
        (".download", "Download capability", SuspiciousSeverity::Medium),
        ("atob(", "Base64 decoding", SuspiciousSeverity::Low),
        ("btoa(", "Base64 encoding", SuspiciousSeverity::Low),
    ];

    for (pattern, description, severity) in &patterns {
        if let Some(pos) = content.find(pattern) {
            let line_number = content[..pos].lines().count();
            indicators.push(SuspiciousIndicator {
                indicator_type: "suspicious_function".to_string(),
                description: description.to_string(),
                severity: severity.clone(),
                location: Some(format!("line {}", line_number)),
                evidence: pattern.to_string(),
            });
        }
    }

    // Language-specific patterns
    match format {
        FileFormat::PowerShell => {
            detect_powershell_suspicious_patterns(content, &mut indicators);
        }
        FileFormat::Python => {
            detect_python_suspicious_patterns(content, &mut indicators);
        }
        _ => {}
    }

    indicators
}

/// Detect PowerShell-specific suspicious patterns
fn detect_powershell_suspicious_patterns(
    content: &str,
    indicators: &mut Vec<SuspiciousIndicator>
) {
    let patterns = [
        ("Invoke-Expression", "Dynamic code execution", SuspiciousSeverity::Critical),
        ("iex ", "Shortened Invoke-Expression", SuspiciousSeverity::Critical),
        ("-EncodedCommand", "Encoded command execution", SuspiciousSeverity::High),
        ("Add-MpPreference", "Modifying Windows Defender", SuspiciousSeverity::Critical),
        ("Disable-WindowsDefender", "Disabling security", SuspiciousSeverity::Critical),
        ("DownloadString", "Remote code download", SuspiciousSeverity::High),
    ];

    for (pattern, description, severity) in &patterns {
        if content.contains(pattern) {
            indicators.push(SuspiciousIndicator {
                indicator_type: "powershell_suspicious".to_string(),
                description: description.to_string(),
                severity: severity.clone(),
                location: None,
                evidence: pattern.to_string(),
            });
        }
    }
}

/// Detect Python-specific suspicious patterns
fn detect_python_suspicious_patterns(
    content: &str,
    indicators: &mut Vec<SuspiciousIndicator>
) {
    let patterns = [
        ("__import__", "Dynamic import", SuspiciousSeverity::Medium),
        ("compile(", "Dynamic code compilation", SuspiciousSeverity::High),
        ("pickle.loads", "Pickle deserialization", SuspiciousSeverity::High),
        ("os.system", "System command execution", SuspiciousSeverity::High),
        ("subprocess", "Process execution", SuspiciousSeverity::Medium),
    ];

    for (pattern, description, severity) in &patterns {
        if content.contains(pattern) {
            indicators.push(SuspiciousIndicator {
                indicator_type: "python_suspicious".to_string(),
                description: description.to_string(),
                severity: severity.clone(),
                location: None,
                evidence: pattern.to_string(),
            });
        }
    }
}

/// Simple syntax validation
fn validate_script_syntax(content: &str, format: &FileFormat) -> Vec<String> {
    let mut issues = Vec::new();

    match format {
        FileFormat::JavaScript | FileFormat::TypeScript => {
            // Check for basic syntax issues
            let open_braces = content.matches('{').count();
            let close_braces = content.matches('}').count();
            if open_braces != close_braces {
                issues.push(format!("Mismatched braces: {} open, {} close", open_braces, close_braces));
            }

            let open_parens = content.matches('(').count();
            let close_parens = content.matches(')').count();
            if open_parens != close_parens {
                issues.push(format!("Mismatched parentheses: {} open, {} close", open_parens, close_parens));
            }
        }
        FileFormat::Python => {
            // Check for indentation issues (very basic)
            for (i, line) in content.lines().enumerate() {
                if line.starts_with(' ') && !line.starts_with("    ") {
                    issues.push(format!("Line {}: Possible indentation error", i + 1));
                    break; // Only report once
                }
            }
        }
        _ => {}
    }

    issues
}

/// Check if script is likely obfuscated
fn is_likely_obfuscated(content: &str) -> bool {
    let indicators = [
        content.matches("\\x").count() > 20,
        content.matches("\\u").count() > 20,
        content.contains("atob") || content.contains("btoa"),
        has_excessive_variable_obfuscation(content),
    ];

    indicators.iter().filter(|&&x| x).count() >= 2
}

/// Check for variable name obfuscation
fn has_excessive_variable_obfuscation(content: &str) -> bool {
    // Look for patterns like _0x1234, $a$b$c, etc.
    let obfuscated_var_pattern = regex::Regex::new(r"\b[_$][0-9a-fA-F]{4,}\b").unwrap();
    obfuscated_var_pattern.find_iter(content).count() > 10
}

/// Check if script is likely minified
fn is_likely_minified(content: &str, format: &FileFormat) -> bool {
    match format {
        FileFormat::JavaScript | FileFormat::TypeScript => {
            // Minified JS typically has very long lines
            content.lines().any(|line| line.len() > 500)
        }
        _ => false,
    }
}