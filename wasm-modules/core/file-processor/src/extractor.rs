use crate::types::{ExtractedString, SuspiciousPattern, PatternType};
use regex::Regex;
use once_cell::sync::Lazy;
use encoding_rs::{UTF_16LE, UTF_16BE};

/// Regular expressions for pattern detection
static URL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r#"https?://[^\s<>"']+"#).unwrap()
});

static IP_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b").unwrap()
});

static EMAIL_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b").unwrap()
});

static DOMAIN_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\b[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})\b").unwrap()
});

static BASE64_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[A-Za-z0-9+/]{20,}={0,2}").unwrap()
});

static HEX_REGEX: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:0x)?[0-9a-fA-F]{8,}").unwrap()
});

static CRYPTO_WALLET_REGEX: Lazy<Regex> = Lazy::new(|| {
    // Bitcoin, Ethereum, etc.
    Regex::new(r"\b(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|0x[a-fA-F0-9]{40})\b").unwrap()
});

pub struct ContentExtractor {
    min_string_length: usize,
    extract_urls: bool,
    extract_ips: bool,
    extract_emails: bool,
    extract_base64: bool,
    max_string_length: usize,
}

impl ContentExtractor {
    pub fn new() -> Self {
        Self {
            min_string_length: 4,
            extract_urls: true,
            extract_ips: true,
            extract_emails: true,
            extract_base64: true,
            max_string_length: 1024,
        }
    }

    /// Extract strings from binary data
    pub fn extract_strings(&self, buffer: &[u8], min_length: usize) -> Vec<ExtractedString> {
        let mut strings = Vec::new();
        let min_len = min_length.max(self.min_string_length);

        // Extract ASCII strings
        self.extract_ascii_strings(buffer, min_len, &mut strings);

        // Extract UTF-16 strings (common in Windows binaries)
        self.extract_utf16_strings(buffer, min_len, &mut strings);

        // Mark suspicious strings
        for string in &mut strings {
            string.suspicious = self.is_suspicious_string(&string.value);
        }

        // Deduplicate while preserving order
        let mut seen = std::collections::HashSet::new();
        strings.retain(|s| seen.insert(s.value.clone()));

        strings
    }

    /// Extract ASCII strings
    fn extract_ascii_strings(&self, buffer: &[u8], min_length: usize, strings: &mut Vec<ExtractedString>) {
        let mut current = Vec::new();
        let mut start_offset = 0;

        for (offset, &byte) in buffer.iter().enumerate() {
            if byte >= 0x20 && byte <= 0x7E {
                if current.is_empty() {
                    start_offset = offset;
                }
                current.push(byte);
            } else if !current.is_empty() {
                if current.len() >= min_length {
                    if let Ok(s) = String::from_utf8(current.clone()) {
                        if s.len() <= self.max_string_length {
                            strings.push(ExtractedString {
                                value: s,
                                offset: start_offset,
                                encoding: "ASCII".to_string(),
                                suspicious: false,
                            });
                        }
                    }
                }
                current.clear();
            }
        }

        // Handle final string
        if current.len() >= min_length {
            if let Ok(s) = String::from_utf8(current) {
                if s.len() <= self.max_string_length {
                    strings.push(ExtractedString {
                        value: s,
                        offset: start_offset,
                        encoding: "ASCII".to_string(),
                        suspicious: false,
                    });
                }
            }
        }
    }

    /// Extract UTF-16 strings (both LE and BE)
    fn extract_utf16_strings(&self, buffer: &[u8], min_length: usize, strings: &mut Vec<ExtractedString>) {
        // Try UTF-16 LE
        self.extract_utf16_variant(buffer, min_length, strings, UTF_16LE, "UTF-16LE");
        
        // Try UTF-16 BE
        self.extract_utf16_variant(buffer, min_length, strings, UTF_16BE, "UTF-16BE");
    }

    fn extract_utf16_variant(
        &self,
        buffer: &[u8],
        min_length: usize,
        strings: &mut Vec<ExtractedString>,
        encoding: &'static encoding_rs::Encoding,
        encoding_name: &str,
    ) {
        let (decoded, _, had_errors) = encoding.decode(buffer);
        if had_errors {
            return; // Skip if too many errors
        }

        let mut current = String::new();
        let mut start_offset = 0;
        let mut char_count = 0;

        for (idx, ch) in decoded.char_indices() {
            if ch >= ' ' && ch <= '~' {
                if current.is_empty() {
                    start_offset = idx * 2; // UTF-16 uses 2 bytes per char
                }
                current.push(ch);
                char_count += 1;
            } else if !current.is_empty() {
                if char_count >= min_length && current.len() <= self.max_string_length {
                    strings.push(ExtractedString {
                        value: current.clone(),
                        offset: start_offset,
                        encoding: encoding_name.to_string(),
                        suspicious: false,
                    });
                }
                current.clear();
                char_count = 0;
            }
        }

        // Handle final string
        if char_count >= min_length && current.len() <= self.max_string_length {
            strings.push(ExtractedString {
                value: current,
                offset: start_offset,
                encoding: encoding_name.to_string(),
                suspicious: false,
            });
        }
    }

    /// Check if a string is suspicious
    fn is_suspicious_string(&self, s: &str) -> bool {
        // Check for URLs
        if self.extract_urls && URL_REGEX.is_match(s) {
            return true;
        }

        // Check for IPs
        if self.extract_ips && IP_REGEX.is_match(s) {
            return true;
        }

        // Check for long base64 strings
        if self.extract_base64 && BASE64_REGEX.is_match(s) && s.len() > 50 {
            return true;
        }

        // Check for hex strings
        if HEX_REGEX.is_match(s) && s.len() > 16 {
            return true;
        }

        // Check for potential passwords or keys
        if s.contains("password") || s.contains("apikey") || s.contains("secret") {
            return true;
        }

        // Check for suspicious commands
        let suspicious_commands = [
            "powershell", "cmd.exe", "bash", "sh -c",
            "eval", "exec", "system", "popen",
            "Process.Start", "Runtime.exec",
        ];
        
        let s_lower = s.to_lowercase();
        suspicious_commands.iter().any(|&cmd| s_lower.contains(cmd))
    }

    /// Extract suspicious patterns from text content
    pub fn extract_suspicious_patterns(&self, content: &str) -> Vec<SuspiciousPattern> {
        let mut patterns = Vec::new();

        // Extract URLs
        if self.extract_urls {
            for capture in URL_REGEX.find_iter(content) {
                patterns.push(SuspiciousPattern {
                    pattern_type: PatternType::URL,
                    value: capture.as_str().to_string(),
                    context: Some(self.get_context(content, capture.start(), capture.end())),
                    confidence: 0.9,
                });
            }
        }

        // Extract IPs
        if self.extract_ips {
            for capture in IP_REGEX.find_iter(content) {
                let ip = capture.as_str();
                // Filter out version numbers and other false positives
                if self.is_valid_ip(ip) {
                    patterns.push(SuspiciousPattern {
                        pattern_type: PatternType::IPAddress,
                        value: ip.to_string(),
                        context: Some(self.get_context(content, capture.start(), capture.end())),
                        confidence: 0.85,
                    });
                }
            }
        }

        // Extract emails
        if self.extract_emails {
            for capture in EMAIL_REGEX.find_iter(content) {
                patterns.push(SuspiciousPattern {
                    pattern_type: PatternType::Email,
                    value: capture.as_str().to_string(),
                    context: Some(self.get_context(content, capture.start(), capture.end())),
                    confidence: 0.9,
                });
            }
        }

        // Extract domains
        for capture in DOMAIN_REGEX.find_iter(content) {
            let domain = capture.as_str();
            // Filter out common false positives
            if !self.is_common_false_positive(domain) {
                patterns.push(SuspiciousPattern {
                    pattern_type: PatternType::Domain,
                    value: domain.to_string(),
                    context: Some(self.get_context(content, capture.start(), capture.end())),
                    confidence: 0.8,
                });
            }
        }

        // Extract Base64
        if self.extract_base64 {
            for capture in BASE64_REGEX.find_iter(content) {
                let b64 = capture.as_str();
                if b64.len() >= 32 {
                    patterns.push(SuspiciousPattern {
                        pattern_type: PatternType::Base64,
                        value: b64.to_string(),
                        context: Some(self.get_context(content, capture.start(), capture.end())),
                        confidence: 0.7,
                    });
                }
            }
        }

        // Extract crypto wallets
        for capture in CRYPTO_WALLET_REGEX.find_iter(content) {
            patterns.push(SuspiciousPattern {
                pattern_type: PatternType::CryptoWallet,
                value: capture.as_str().to_string(),
                context: Some(self.get_context(content, capture.start(), capture.end())),
                confidence: 0.75,
            });
        }

        patterns
    }

    /// Get context around a match
    fn get_context(&self, content: &str, start: usize, end: usize) -> String {
        let context_chars = 30;
        let context_start = start.saturating_sub(context_chars);
        let context_end = (end + context_chars).min(content.len());
        
        let mut context = content[context_start..context_end].to_string();
        
        // Replace newlines with spaces for readability
        context = context.replace('\n', " ").replace('\r', " ");
        
        // Trim and add ellipsis if needed
        if context_start > 0 {
            context = format!("...{}", context);
        }
        if context_end < content.len() {
            context = format!("{}...", context);
        }
        
        context
    }

    /// Validate IP address
    fn is_valid_ip(&self, ip: &str) -> bool {
        let parts: Vec<&str> = ip.split('.').collect();
        if parts.len() != 4 {
            return false;
        }

        for part in parts {
            match part.parse::<u8>() {
                Ok(_) => continue,
                Err(_) => return false,
            }
        }

        // Filter out common false positives like version numbers
        if ip.starts_with("0.0.") || ip.starts_with("1.0.") || ip.starts_with("2.0.") {
            return false;
        }

        true
    }

    /// Check if domain is a common false positive
    fn is_common_false_positive(&self, domain: &str) -> bool {
        let false_positives = [
            "example.com", "test.com", "localhost.com",
            "index.js", "config.json", "package.json",
            "README.md", "LICENSE.txt",
        ];

        false_positives.iter().any(|&fp| domain == fp)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ascii_string_extraction() {
        let extractor = ContentExtractor::new();
        let data = b"Hello\x00World\x01This is a test\x00";
        
        let strings = extractor.extract_strings(data, 4);
        
        assert_eq!(strings.len(), 3);
        assert_eq!(strings[0].value, "Hello");
        assert_eq!(strings[1].value, "World");
        assert_eq!(strings[2].value, "This is a test");
    }

    #[test]
    fn test_suspicious_pattern_extraction() {
        let extractor = ContentExtractor::new();
        let content = r#"
            Visit https://malicious-site.com/payload
            Connect to 192.168.1.100
            Send bitcoin to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
            Contact admin@example.com
        "#;
        
        let patterns = extractor.extract_suspicious_patterns(content);
        
        // Should find URL, IP, wallet, and email
        assert!(patterns.iter().any(|p| matches!(p.pattern_type, PatternType::URL)));
        assert!(patterns.iter().any(|p| matches!(p.pattern_type, PatternType::IPAddress)));
        assert!(patterns.iter().any(|p| matches!(p.pattern_type, PatternType::CryptoWallet)));
        assert!(patterns.iter().any(|p| matches!(p.pattern_type, PatternType::Email)));
    }

    #[test]
    fn test_base64_detection() {
        let extractor = ContentExtractor::new();
        let content = "SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBiYXNlNjQgZW5jb2RlZCBzdHJpbmc=";
        
        let patterns = extractor.extract_suspicious_patterns(content);
        
        assert_eq!(patterns.len(), 1);
        assert!(matches!(patterns[0].pattern_type, PatternType::Base64));
    }

    #[test]
    fn test_suspicious_string_detection() {
        let extractor = ContentExtractor::new();
        
        assert!(extractor.is_suspicious_string("https://example.com"));
        assert!(extractor.is_suspicious_string("192.168.1.1"));
        assert!(extractor.is_suspicious_string("powershell -encodedCommand"));
        assert!(extractor.is_suspicious_string("password=secret123"));
        assert!(!extractor.is_suspicious_string("Hello World"));
    }
}