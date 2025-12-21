/// Format bytes as human-readable size
#[allow(dead_code)]
pub fn format_bytes(bytes: usize) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", size as usize, UNITS[unit_index])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

/// Sanitize a string for safe display
#[allow(dead_code)]
pub fn sanitize_string(s: &str, max_length: usize) -> String {
    let sanitized: String = s
        .chars()
        .filter(|c| c.is_ascii_graphic() || c.is_whitespace())
        .take(max_length)
        .collect();

    if s.len() > max_length {
        format!("{}...", sanitized)
    } else {
        sanitized
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(1023), "1023 B");
        assert_eq!(format_bytes(1024), "1.00 KB");
        assert_eq!(format_bytes(1536), "1.50 KB");
        assert_eq!(format_bytes(1048576), "1.00 MB");
        assert_eq!(format_bytes(1073741824), "1.00 GB");
    }

    #[test]
    fn test_sanitize_string() {
        assert_eq!(sanitize_string("Hello World", 20), "Hello World");
        assert_eq!(sanitize_string("Hello World", 5), "Hello...");
        assert_eq!(sanitize_string("Hello\x00World", 20), "HelloWorld");
        assert_eq!(sanitize_string("Hello\nWorld", 20), "Hello\nWorld");
    }
}
