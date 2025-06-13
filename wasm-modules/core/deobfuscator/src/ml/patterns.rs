use regex::Regex;
use once_cell::sync::Lazy;

#[derive(Debug, Clone)]
pub struct PatternFeatures {
    pub obfuscation_score: f32,
    pub base64_likelihood: f32,
    pub hex_likelihood: f32,
    pub js_obfuscation_score: f32,
    pub ps_obfuscation_score: f32,
    pub suspicious_pattern_score: f32,
}

static BASE64_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"[A-Za-z0-9+/]{20,}={0,2}").unwrap()
});

static HEX_PATTERN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?:\\x[0-9a-fA-F]{2}|0x[0-9a-fA-F]+|[0-9a-fA-F]{8,})").unwrap()
});

pub struct PatternDetector {
    suspicious_patterns: Vec<(Regex, f32, &'static str)>,
    js_patterns: Vec<(Regex, f32)>,
    ps_patterns: Vec<(Regex, f32)>,
}

impl PatternDetector {
    pub fn new() -> Self {
        let suspicious_patterns = vec![
            (Regex::new(r"(?i)(eval|execute|invoke)").unwrap(), 0.3, "code execution"),
            (Regex::new(r"(?i)(download|wget|curl)").unwrap(), 0.3, "download capability"),
            (Regex::new(r"(?i)(cmd|powershell|bash|sh)").unwrap(), 0.2, "shell execution"),
            (Regex::new(r"(?i)(password|credential|token)").unwrap(), 0.2, "credential access"),
            (Regex::new(r"(?i)(registry|reg\s+add)").unwrap(), 0.2, "registry manipulation"),
            (Regex::new(r"(?i)(schtasks|crontab|systemctl)").unwrap(), 0.3, "persistence"),
            (Regex::new(r"(?i)(base64|atob|btoa)").unwrap(), 0.2, "encoding functions"),
            (Regex::new(r"(?i)(encrypt|decrypt|cipher)").unwrap(), 0.2, "cryptographic operations"),
        ];
        
        let js_patterns = vec![
            (Regex::new(r"_0x[a-f0-9]+").unwrap(), 0.4),
            (Regex::new(r"\['\\x[0-9a-f]+'\]").unwrap(), 0.3),
            (Regex::new(r"String\.fromCharCode").unwrap(), 0.3),
            (Regex::new(r"Function\s*\(").unwrap(), 0.3),
            (Regex::new(r"unescape\s*\(").unwrap(), 0.2),
            (Regex::new(r"parseInt\s*\(.+?,\s*16\s*\)").unwrap(), 0.2),
        ];
        
        let ps_patterns = vec![
            (Regex::new(r"(?i)-e(?:nc(?:odedcommand)?)?").unwrap(), 0.4),
            (Regex::new(r"(?i)invoke-expression|iex").unwrap(), 0.3),
            (Regex::new(r"(?i)\[convert\]::").unwrap(), 0.3),
            (Regex::new(r"(?i)-replace").unwrap(), 0.2),
            (Regex::new(r"`").unwrap(), 0.2),
            (Regex::new(r"(?i)\$env:").unwrap(), 0.1),
        ];
        
        Self {
            suspicious_patterns,
            js_patterns,
            ps_patterns,
        }
    }

    pub fn detect(&self, content: &str) -> PatternFeatures {
        let base64_likelihood = self.calculate_base64_likelihood(content);
        let hex_likelihood = self.calculate_hex_likelihood(content);
        let js_obfuscation_score = self.calculate_js_score(content);
        let ps_obfuscation_score = self.calculate_ps_score(content);
        let suspicious_pattern_score = self.calculate_suspicious_score(content);
        
        let obfuscation_score = self.calculate_overall_obfuscation_score(
            base64_likelihood,
            hex_likelihood,
            js_obfuscation_score,
            ps_obfuscation_score
        );
        
        PatternFeatures {
            obfuscation_score,
            base64_likelihood,
            hex_likelihood,
            js_obfuscation_score,
            ps_obfuscation_score,
            suspicious_pattern_score,
        }
    }

    fn calculate_base64_likelihood(&self, content: &str) -> f32 {
        let matches: Vec<_> = BASE64_PATTERN.find_iter(content).collect();
        if matches.is_empty() {
            return 0.0;
        }
        
        let total_match_len: usize = matches.iter().map(|m| m.len()).sum();
        let coverage = total_match_len as f32 / content.len() as f32;
        
        // Check if matches are valid base64
        let valid_count = matches.iter()
            .filter(|m| {
                let s = m.as_str();
                s.len() % 4 == 0 || s.ends_with('=') || s.ends_with("==")
            })
            .count();
        
        let validity_ratio = valid_count as f32 / matches.len() as f32;
        
        (coverage * validity_ratio * 2.0).min(1.0)
    }

    fn calculate_hex_likelihood(&self, content: &str) -> f32 {
        let matches = HEX_PATTERN.find_iter(content).count();
        if matches == 0 {
            return 0.0;
        }
        
        let density = matches as f32 / (content.len() as f32 / 100.0);
        density.min(1.0)
    }

    fn calculate_js_score(&self, content: &str) -> f32 {
        let mut score = 0.0;
        let mut pattern_count = 0;
        
        for (pattern, weight) in &self.js_patterns {
            if pattern.is_match(content) {
                score += weight;
                pattern_count += 1;
            }
        }
        
        // Bonus for multiple patterns
        if pattern_count >= 3 {
            score *= 1.2;
        }
        
        score.min(1.0)
    }

    fn calculate_ps_score(&self, content: &str) -> f32 {
        let mut score = 0.0;
        
        for (pattern, weight) in &self.ps_patterns {
            let matches = pattern.find_iter(content).count();
            if matches > 0 {
                score += weight * (1.0 + (matches as f32 - 1.0) * 0.1).min(2.0);
            }
        }
        
        score.min(1.0)
    }

    fn calculate_suspicious_score(&self, content: &str) -> f32 {
        let mut score = 0.0;
        let mut detected_categories = std::collections::HashSet::new();
        
        for (pattern, weight, category) in &self.suspicious_patterns {
            if pattern.is_match(content) {
                score += weight;
                detected_categories.insert(category);
            }
        }
        
        // Bonus for multiple categories
        if detected_categories.len() >= 3 {
            score *= 1.3;
        }
        
        score.min(1.0)
    }

    fn calculate_overall_obfuscation_score(&self, base64: f32, hex: f32, js: f32, ps: f32) -> f32 {
        let max_score = base64.max(hex).max(js).max(ps);
        let avg_score = (base64 + hex + js + ps) / 4.0;
        
        // Weight towards the maximum with some influence from average
        (max_score * 0.7 + avg_score * 0.3).min(1.0)
    }

    pub fn extract_iocs(&self, content: &str) -> Vec<String> {
        let mut iocs = Vec::new();
        
        // Extract URLs
        if let Ok(url_pattern) = Regex::new(r"https?://[^\s<>]+") {
            for mat in url_pattern.find_iter(content) {
                iocs.push(format!("URL: {}", mat.as_str()));
            }
        }
        
        // Extract IPs - simplified pattern
        if let Ok(ip_pattern) = Regex::new(r"\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}") {
            for mat in ip_pattern.find_iter(content) {
                let ip = mat.as_str();
                // Basic validation
                let valid = ip.split('.').all(|octet| {
                    octet.parse::<u8>().is_ok()
                });
                if valid {
                    iocs.push(format!("IP: {}", ip));
                }
            }
        }
        
        // Extract file paths - Windows style (simplified)
        if let Ok(win_path_pattern) = Regex::new(r#"[A-Za-z]:[/\\][^<>"\|\*\?]+"#) {
            for mat in win_path_pattern.find_iter(content) {
                if mat.as_str().len() > 5 {
                    iocs.push(format!("Path: {}", mat.as_str()));
                }
            }
        }
        
        // Extract file paths - Unix style
        if let Ok(unix_path_pattern) = Regex::new(r"/[A-Za-z0-9_\-./]+") {
            for mat in unix_path_pattern.find_iter(content) {
                let path = mat.as_str();
                if path.len() > 5 && !path.starts_with("//") {
                    iocs.push(format!("Path: {}", path));
                }
            }
        }
        
        iocs
    }
}