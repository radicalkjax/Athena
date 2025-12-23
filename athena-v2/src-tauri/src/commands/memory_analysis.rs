use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Read, BufReader, BufRead};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use crate::commands::file_analysis::ExtractedString;

/// Validate that a path is within allowed directories to prevent directory traversal
fn validate_path(path: &str, app: &AppHandle) -> Result<PathBuf, String> {
    let path_buf = Path::new(path);

    // Canonicalize the path to resolve any .. or symlinks
    let canonical = path_buf.canonicalize()
        .map_err(|e| format!("Invalid path '{}': {}", path, e))?;

    // Get allowed directories
    let temp_dir = std::env::temp_dir();
    let app_data_dir = app.path().app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let app_cache_dir = app.path().app_cache_dir()
        .map_err(|e| format!("Failed to get app cache directory: {}", e))?;
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;

    // Check if path is within any allowed directory
    let allowed_dirs = vec![temp_dir, app_data_dir, app_cache_dir, home_dir];

    for allowed in &allowed_dirs {
        if canonical.starts_with(allowed) {
            return Ok(canonical);
        }
    }

    Err(format!(
        "Path traversal detected: '{}' is outside allowed directories. Files must be in temp directory, app data directory, or user home directory.",
        path
    ))
}

const MAX_MEMORY_DUMP_SIZE: u64 = 500 * 1024 * 1024; // 500MB limit
const MIN_STRING_LENGTH: usize = 4;
const MAX_STRING_LENGTH: usize = 512;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryRegion {
    pub start_address: u64,
    pub end_address: u64,
    pub size: u64,
    pub permissions: String,
    pub region_type: String,
    pub mapped_file: Option<String>,
}

/// Get memory regions from a process dump or memory map file
///
/// Supports parsing:
/// - /proc/[pid]/maps format (Linux)
/// - Raw memory dumps with basic region detection
///
/// # Arguments
/// * `file_path` - Path to memory dump or maps file
///
/// # Returns
/// * `Result<Vec<MemoryRegion>, String>` - List of memory regions or error
#[tauri::command]
pub async fn get_memory_regions(app: AppHandle, file_path: String) -> Result<Vec<MemoryRegion>, String> {
    // Validate path to prevent directory traversal
    let path = validate_path(&file_path, &app)?;

    // Validate file exists
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Check file size
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    if metadata.len() > MAX_MEMORY_DUMP_SIZE {
        return Err(format!(
            "File too large: {} bytes (max: {} bytes)",
            metadata.len(),
            MAX_MEMORY_DUMP_SIZE
        ));
    }

    // Try parsing as /proc/maps format first
    if let Ok(regions) = parse_proc_maps(&path) {
        if !regions.is_empty() {
            return Ok(regions);
        }
    }

    // Fallback to raw memory dump analysis
    parse_raw_memory_dump(&path, metadata.len())
}

/// Extract strings from memory dump
///
/// Extracts ASCII and Unicode strings from a memory dump file.
/// Flags suspicious strings based on common malware patterns.
///
/// # Arguments
/// * `file_path` - Path to memory dump file
/// * `min_length` - Minimum string length (default: 4)
/// * `encoding` - "ascii", "unicode", or "both"
///
/// # Returns
/// * `Result<Vec<ExtractedString>, String>` - Extracted strings or error
#[tauri::command]
pub async fn extract_strings_from_dump(
    app: AppHandle,
    file_path: String,
    min_length: usize,
    encoding: String,
) -> Result<Vec<ExtractedString>, String> {
    // Validate path to prevent directory traversal
    let path = validate_path(&file_path, &app)?;

    // Validate file exists
    if !path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Check file size
    let metadata = std::fs::metadata(&path)
        .map_err(|e| format!("Failed to get file metadata: {}", e))?;

    if metadata.len() > MAX_MEMORY_DUMP_SIZE {
        return Err(format!(
            "File too large: {} bytes (max: {} bytes)",
            metadata.len(),
            MAX_MEMORY_DUMP_SIZE
        ));
    }

    // Validate min_length
    let min_len = if min_length < MIN_STRING_LENGTH {
        MIN_STRING_LENGTH
    } else {
        min_length
    };

    // Validate encoding
    let enc = encoding.to_lowercase();
    if enc != "ascii" && enc != "unicode" && enc != "both" {
        return Err(format!("Invalid encoding: {}. Must be 'ascii', 'unicode', or 'both'", encoding));
    }

    // Read file
    let mut file = File::open(&path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let mut strings = Vec::new();

    // Extract ASCII strings
    if enc == "ascii" || enc == "both" {
        strings.extend(extract_ascii_strings(&buffer, min_len));
    }

    // Extract Unicode strings
    if enc == "unicode" || enc == "both" {
        strings.extend(extract_unicode_strings(&buffer, min_len));
    }

    // Sort by offset
    strings.sort_by_key(|s| s.offset);

    // Deduplicate consecutive identical strings
    strings.dedup_by(|a, b| a.value == b.value && a.offset.abs_diff(b.offset) < 10);

    Ok(strings)
}

// Parse /proc/[pid]/maps format
fn parse_proc_maps(path: &Path) -> Result<Vec<MemoryRegion>, String> {
    let file = File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let reader = BufReader::new(file);
    let mut regions = Vec::new();

    for (line_num, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("Failed to read line {}: {}", line_num, e))?;

        // Format: address perms offset dev inode pathname
        // Example: 7f1234567000-7f123456a000 r-xp 00001000 08:01 123456 /lib/x86_64-linux-gnu/libc.so.6
        let parts: Vec<&str> = line.split_whitespace().collect();

        if parts.len() < 2 {
            continue;
        }

        // Parse address range
        let addr_range: Vec<&str> = parts[0].split('-').collect();
        if addr_range.len() != 2 {
            continue;
        }

        let start_address = u64::from_str_radix(addr_range[0], 16)
            .map_err(|_| format!("Invalid start address at line {}", line_num))?;

        let end_address = u64::from_str_radix(addr_range[1], 16)
            .map_err(|_| format!("Invalid end address at line {}", line_num))?;

        let size = end_address - start_address;
        let permissions = parts[1].to_string();

        // Determine region type based on pathname
        let (region_type, mapped_file) = if parts.len() > 5 {
            let pathname = parts[5..].join(" ");
            let rtype = classify_region_type(&pathname);
            (rtype, Some(pathname))
        } else {
            ("anonymous".to_string(), None)
        };

        regions.push(MemoryRegion {
            start_address,
            end_address,
            size,
            permissions,
            region_type,
            mapped_file,
        });
    }

    Ok(regions)
}

// Classify memory region type based on pathname
fn classify_region_type(pathname: &str) -> String {
    if pathname.starts_with("[stack") {
        "stack".to_string()
    } else if pathname.starts_with("[heap") {
        "heap".to_string()
    } else if pathname.starts_with("[vdso") {
        "vdso".to_string()
    } else if pathname.starts_with("[vvar") {
        "vvar".to_string()
    } else if pathname.contains(".so") {
        "shared_library".to_string()
    } else if pathname.starts_with('/') {
        "mapped_file".to_string()
    } else {
        "anonymous".to_string()
    }
}

// Parse raw memory dump by analyzing content patterns
fn parse_raw_memory_dump(path: &Path, file_size: u64) -> Result<Vec<MemoryRegion>, String> {
    let mut file = File::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let mut buffer = vec![0u8; 4096];
    let mut regions = Vec::new();
    let mut current_offset = 0u64;
    let mut region_start = 0u64;
    let mut last_non_zero = false;

    // Simple heuristic: identify regions based on zero/non-zero patterns
    while current_offset < file_size {
        let bytes_read = file.read(&mut buffer)
            .map_err(|e| format!("Failed to read at offset {}: {}", current_offset, e))?;

        if bytes_read == 0 {
            break;
        }

        let has_data = buffer[..bytes_read].iter().any(|&b| b != 0);

        if has_data && !last_non_zero {
            region_start = current_offset;
        } else if !has_data && last_non_zero {
            // End of region
            regions.push(MemoryRegion {
                start_address: region_start,
                end_address: current_offset,
                size: current_offset - region_start,
                permissions: "r--".to_string(), // Unknown, assume read-only
                region_type: "data".to_string(),
                mapped_file: None,
            });
        }

        last_non_zero = has_data;
        current_offset += bytes_read as u64;
    }

    // Handle final region
    if last_non_zero {
        regions.push(MemoryRegion {
            start_address: region_start,
            end_address: current_offset,
            size: current_offset - region_start,
            permissions: "r--".to_string(),
            region_type: "data".to_string(),
            mapped_file: None,
        });
    }

    // If no regions found, treat entire file as single region
    if regions.is_empty() {
        regions.push(MemoryRegion {
            start_address: 0,
            end_address: file_size,
            size: file_size,
            permissions: "r--".to_string(),
            region_type: "unknown".to_string(),
            mapped_file: None,
        });
    }

    Ok(regions)
}

// Extract ASCII strings from binary data
fn extract_ascii_strings(data: &[u8], min_length: usize) -> Vec<ExtractedString> {
    let mut strings = Vec::new();
    let mut current_string = String::new();
    let mut string_start = 0usize;

    for (offset, &byte) in data.iter().enumerate() {
        if is_printable_ascii(byte) {
            if current_string.is_empty() {
                string_start = offset;
            }
            current_string.push(byte as char);
        } else {
            if current_string.len() >= min_length && current_string.len() <= MAX_STRING_LENGTH {
                let is_suspicious = is_suspicious_string(&current_string);
                let category = categorize_string(&current_string);
                strings.push(ExtractedString {
                    offset: string_start as u64,
                    value: current_string.clone(),
                    encoding: "ascii".to_string(),
                    suspicious: is_suspicious,
                    category,
                });
            }
            current_string.clear();
        }
    }

    // Handle final string
    if current_string.len() >= min_length && current_string.len() <= MAX_STRING_LENGTH {
        let is_suspicious = is_suspicious_string(&current_string);
        let category = categorize_string(&current_string);
        strings.push(ExtractedString {
            offset: string_start as u64,
            value: current_string,
            encoding: "ascii".to_string(),
            suspicious: is_suspicious,
            category,
        });
    }

    strings
}

// Extract Unicode (UTF-16 LE) strings from binary data
fn extract_unicode_strings(data: &[u8], min_length: usize) -> Vec<ExtractedString> {
    let mut strings = Vec::new();
    let mut current_string = String::new();
    let mut string_start = 0usize;
    let mut i = 0;

    while i + 1 < data.len() {
        let low = data[i];
        let high = data[i + 1];

        // Check for printable ASCII in UTF-16 LE (high byte should be 0)
        if high == 0 && is_printable_ascii(low) {
            if current_string.is_empty() {
                string_start = i;
            }
            current_string.push(low as char);
            i += 2;
        } else {
            if current_string.len() >= min_length && current_string.len() <= MAX_STRING_LENGTH {
                let is_suspicious = is_suspicious_string(&current_string);
                let category = categorize_string(&current_string);
                strings.push(ExtractedString {
                    offset: string_start as u64,
                    value: current_string.clone(),
                    encoding: "unicode".to_string(),
                    suspicious: is_suspicious,
                    category,
                });
            }
            current_string.clear();
            i += 1;
        }
    }

    // Handle final string
    if current_string.len() >= min_length && current_string.len() <= MAX_STRING_LENGTH {
        let is_suspicious = is_suspicious_string(&current_string);
        let category = categorize_string(&current_string);
        strings.push(ExtractedString {
            offset: string_start as u64,
            value: current_string,
            encoding: "unicode".to_string(),
            suspicious: is_suspicious,
            category,
        });
    }

    strings
}

// Check if byte is printable ASCII
fn is_printable_ascii(byte: u8) -> bool {
    (byte >= 32 && byte <= 126) || byte == 9 || byte == 10 || byte == 13
}

// Check if string matches suspicious patterns
fn is_suspicious_string(s: &str) -> bool {
    let lower = s.to_lowercase();

    // Suspicious patterns
    let suspicious_patterns = [
        "cmd.exe", "powershell", "wscript", "cscript",
        "http://", "https://", "ftp://",
        "temp\\", "\\system32\\", "\\windows\\",
        "regsvr32", "rundll32", "mshta",
        "password", "passwd", "credential",
        "admin", "administrator",
        "exploit", "payload", "shellcode",
        "inject", "hook", "bypass",
        ".exe", ".dll", ".bat", ".vbs", ".ps1",
        "backdoor", "trojan", "malware",
        "keylog", "rootkit", "ransomware",
    ];

    for pattern in &suspicious_patterns {
        if lower.contains(pattern) {
            return true;
        }
    }

    // Check for Base64-like strings (long alphanumeric with +/=)
    if s.len() > 20 {
        let base64_chars = s.chars().filter(|c| c.is_alphanumeric() || *c == '+' || *c == '/' || *c == '=').count();
        if base64_chars as f64 / s.len() as f64 > 0.95 {
            return true;
        }
    }

    // Check for long hex strings
    if s.len() > 32 && s.chars().all(|c| c.is_ascii_hexdigit()) {
        return true;
    }

    false
}

// Categorize string by type
fn categorize_string(s: &str) -> Option<String> {
    if s.starts_with("http://") || s.starts_with("https://") || s.starts_with("ftp://") {
        return Some("url".to_string());
    }

    if s.contains('\\') && (s.contains(".exe") || s.contains(".dll") || s.contains(".sys")) {
        return Some("file_path".to_string());
    }

    if s.contains("HKEY_") || s.contains("\\Software\\") || s.contains("\\CurrentVersion\\") {
        return Some("registry".to_string());
    }

    // IP address pattern
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() == 4 && parts.iter().all(|p| p.parse::<u8>().is_ok()) {
        return Some("ip_address".to_string());
    }

    // Email pattern
    if s.contains('@') && s.contains('.') && s.chars().filter(|c| *c == '@').count() == 1 {
        return Some("email".to_string());
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_printable_ascii() {
        assert!(is_printable_ascii(65)); // 'A'
        assert!(is_printable_ascii(32)); // space
        assert!(!is_printable_ascii(0));
        assert!(!is_printable_ascii(255));
    }

    #[test]
    fn test_is_suspicious_string() {
        assert!(is_suspicious_string("cmd.exe"));
        assert!(is_suspicious_string("http://malware.com"));
        assert!(is_suspicious_string("password123"));
        assert!(!is_suspicious_string("hello world"));
    }

    #[test]
    fn test_categorize_string() {
        assert_eq!(categorize_string("http://example.com"), Some("url".to_string()));
        assert_eq!(categorize_string("C:\\Windows\\System32\\kernel32.dll"), Some("file_path".to_string()));
        assert_eq!(categorize_string("192.168.1.1"), Some("ip_address".to_string()));
        assert_eq!(categorize_string("user@example.com"), Some("email".to_string()));
        assert_eq!(categorize_string("hello"), None);
    }

    #[test]
    fn test_extract_ascii_strings() {
        let data = b"Hello\x00World\x00\x00Test123";
        let strings = extract_ascii_strings(data, 4);

        assert_eq!(strings.len(), 2);
        assert_eq!(strings[0].value, "Hello");
        assert_eq!(strings[1].value, "World");
    }

    #[test]
    fn test_classify_region_type() {
        assert_eq!(classify_region_type("[stack]"), "stack");
        assert_eq!(classify_region_type("[heap]"), "heap");
        assert_eq!(classify_region_type("/lib/x86_64-linux-gnu/libc.so.6"), "shared_library");
        assert_eq!(classify_region_type("/usr/bin/program"), "mapped_file");
    }
}
