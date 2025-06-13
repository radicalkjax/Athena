use super::{DeobfuscationTechnique, TechniqueResult};
use crate::types::ObfuscationTechnique;
use regex::Regex;

pub struct JsDeobfuscator {
    eval_pattern: Regex,
    string_concat_pattern: Regex,
    charcode_pattern: Regex,
}

impl JsDeobfuscator {
    pub fn new() -> Self {
        Self {
            eval_pattern: Regex::new(r"(?i)eval\s*\(\s*(.+?)\s*\)").unwrap(),
            string_concat_pattern: Regex::new(r#"["']([^"']+)["']\s*\+\s*["']([^"']+)["']"#).unwrap(),
            charcode_pattern: Regex::new(r"String\.fromCharCode\s*\(\s*((?:\d+\s*,?\s*)+)\s*\)").unwrap(),
        }
    }

    fn deobfuscate_string_concat(&self, content: &str) -> String {
        let mut result = content.to_string();
        
        // Handle simple string concatenation
        while let Some(caps) = self.string_concat_pattern.captures(&result) {
            if let (Some(str1), Some(str2)) = (caps.get(1), caps.get(2)) {
                let combined = format!("\"{}{}\"", str1.as_str(), str2.as_str());
                result = result.replace(&caps[0], &combined);
            } else {
                break;
            }
        }
        
        result
    }

    fn deobfuscate_charcode(&self, content: &str) -> String {
        let mut result = content.to_string();
        
        for cap in self.charcode_pattern.captures_iter(content) {
            if let Some(codes) = cap.get(1) {
                let decoded: String = codes.as_str()
                    .split(',')
                    .filter_map(|s| s.trim().parse::<u8>().ok())
                    .map(|b| b as char)
                    .collect();
                
                if !decoded.is_empty() {
                    result = result.replace(&cap[0], &format!("\"{}\"", decoded));
                }
            }
        }
        
        result
    }

    fn deobfuscate_array_notation(&self, content: &str) -> String {
        let mut result = content.to_string();
        
        // Handle array notation like ["e"]["v"]["a"]["l"]
        let array_pattern = Regex::new(r#"\[["'](\w)["']\](?:\[["'](\w)["']\])+"#).unwrap();
        
        for mat in array_pattern.find_iter(content) {
            let chars: String = mat.as_str()
                .split("][")
                .filter_map(|s| {
                    s.trim_matches(|c| c == '[' || c == ']' || c == '"' || c == '\'')
                        .chars()
                        .next()
                })
                .collect();
            
            if !chars.is_empty() {
                result = result.replace(mat.as_str(), &format!("\"{}\"", chars));
            }
        }
        
        result
    }

    fn deobfuscate_function_constructor(&self, content: &str) -> String {
        let mut result = content.to_string();
        
        // Handle Function constructor pattern
        let func_pattern = Regex::new(r#"(?i)Function\s*\(\s*["'](.+?)["']\s*\)"#).unwrap();
        
        for cap in func_pattern.captures_iter(content) {
            if let Some(code) = cap.get(1) {
                result = result.replace(&cap[0], &format!("(function() {{ {} }})", code.as_str()));
            }
        }
        
        result
    }
}

impl DeobfuscationTechnique for JsDeobfuscator {
    fn name(&self) -> &'static str {
        "JavaScript Deobfuscator"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        let mut confidence: f32 = 0.0;
        let mut indicators = 0;
        
        // Check for eval usage
        if self.eval_pattern.is_match(content) {
            confidence += 0.3;
            indicators += 1;
        }
        
        // Check for string concatenation
        if self.string_concat_pattern.is_match(content) {
            confidence += 0.2;
            indicators += 1;
        }
        
        // Check for fromCharCode
        if self.charcode_pattern.is_match(content) {
            confidence += 0.3;
            indicators += 1;
        }
        
        // Check for other JS obfuscation patterns
        let js_patterns = [
            r"_0x[a-f0-9]+",  // Obfuscator.io pattern
            r"\['\\x[0-9a-f]+'\]",  // Hex array access
            r"atob\s*\(",  // Base64 decode
            r"unescape\s*\(",  // URL decode
            r"parseInt\s*\(.+?,\s*16\s*\)",  // Hex parsing
        ];
        
        for pattern in &js_patterns {
            if let Ok(re) = Regex::new(pattern) {
                if re.is_match(content) {
                    confidence += 0.1;
                    indicators += 1;
                }
            }
        }
        
        if indicators > 0 {
            Some(confidence.min(1.0))
        } else {
            None
        }
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        let mut result = content.to_string();
        let mut changes_made = false;
        
        // Apply various deobfuscation techniques
        let before = result.clone();
        
        // 1. Deobfuscate string concatenation
        result = self.deobfuscate_string_concat(&result);
        if result != before {
            changes_made = true;
        }
        
        // 2. Deobfuscate character codes
        let before = result.clone();
        result = self.deobfuscate_charcode(&result);
        if result != before {
            changes_made = true;
        }
        
        // 3. Deobfuscate array notation
        let before = result.clone();
        result = self.deobfuscate_array_notation(&result);
        if result != before {
            changes_made = true;
        }
        
        // 4. Deobfuscate Function constructor
        let before = result.clone();
        result = self.deobfuscate_function_constructor(&result);
        if result != before {
            changes_made = true;
        }
        
        Ok(TechniqueResult {
            success: changes_made,
            output: result,
            context: Some("JavaScript deobfuscation applied".to_string()),
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(
            technique_type,
            ObfuscationTechnique::JsEvalChain |
            ObfuscationTechnique::JsObfuscatorIo |
            ObfuscationTechnique::JsFunctionConstructor |
            ObfuscationTechnique::CharCodeConcat
        )
    }
}

pub struct JsUnpacker {
    packed_pattern: Regex,
}

impl JsUnpacker {
    pub fn new() -> Self {
        Self {
            packed_pattern: Regex::new(
                r"eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,?\s*e?\s*,?\s*[dr]?\s*\)"
            ).unwrap(),
        }
    }

    fn unpack_packed_js(&self, content: &str) -> Option<String> {
        // This is a simplified unpacker - in production, we'd need a full JS parser
        // For now, we'll detect the pattern and mark it
        if self.packed_pattern.is_match(content) {
            Some(format!("/* DETECTED PACKED JS - Unpacking needed */\n{}", content))
        } else {
            None
        }
    }
}

impl DeobfuscationTechnique for JsUnpacker {
    fn name(&self) -> &'static str {
        "JavaScript Unpacker"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        if self.packed_pattern.is_match(content) {
            Some(0.95)
        } else {
            None
        }
    }

    fn deobfuscate(&self, content: &str) -> Result<TechniqueResult, String> {
        if let Some(unpacked) = self.unpack_packed_js(content) {
            Ok(TechniqueResult {
                success: true,
                output: unpacked,
                context: Some("Detected packed JavaScript".to_string()),
            })
        } else {
            Ok(TechniqueResult {
                success: false,
                output: content.to_string(),
                context: None,
            })
        }
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(technique_type, ObfuscationTechnique::JsPackedCode)
    }
}