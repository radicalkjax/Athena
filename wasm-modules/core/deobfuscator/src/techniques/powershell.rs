use super::{DeobfuscationTechnique, TechniqueResult};
use crate::types::ObfuscationTechnique;
use base64::{Engine as _, engine::general_purpose};
use regex::Regex;

pub struct PsDeobfuscator {
    encoded_cmd_pattern: Regex,
    compressed_pattern: Regex,
    string_replace_pattern: Regex,
    invoke_pattern: Regex,
}

impl PsDeobfuscator {
    pub fn new() -> Self {
        Self {
            encoded_cmd_pattern: Regex::new(r"(?i)(?:-e(?:nc(?:odedcommand)?)?|/e(?:nc)?)\s+([A-Za-z0-9+/=]+)").unwrap(),
            compressed_pattern: Regex::new(r"(?i)System\.IO\.Compression|GzipStream|DeflateStream").unwrap(),
            string_replace_pattern: Regex::new(r#"(?i)-replace\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)"#).unwrap(),
            invoke_pattern: Regex::new(r"(?i)(?:invoke-expression|iex|&|\.)").unwrap(),
        }
    }

    fn decode_powershell_base64(&self, encoded: &str) -> Option<String> {
        // PowerShell uses UTF-16LE encoding for base64
        match general_purpose::STANDARD.decode(encoded) {
            Ok(decoded_bytes) => {
                // Convert UTF-16LE to UTF-8
                let utf16_pairs: Vec<u16> = decoded_bytes
                    .chunks_exact(2)
                    .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
                    .collect();
                
                match String::from_utf16(&utf16_pairs) {
                    Ok(decoded) => Some(decoded),
                    Err(_) => {
                        // Try as UTF-8 fallback
                        String::from_utf8(decoded_bytes).ok()
                    }
                }
            }
            Err(_) => None,
        }
    }

    fn deobfuscate_string_replace(&self, content: &str) -> String {
        let mut result = content.to_string();
        
        // Handle PowerShell -replace operations
        for cap in self.string_replace_pattern.captures_iter(content) {
            if let (Some(pattern), Some(replacement)) = (cap.get(1), cap.get(2)) {
                // In real implementation, we'd need to track the variable being modified
                // For now, we'll just note the replacement
                let comment = format!("/* -replace '{}' with '{}' */", pattern.as_str(), replacement.as_str());
                result = format!("{}\n{}", comment, result);
            }
        }
        
        result
    }

    fn deobfuscate_case_randomization(&self, content: &str) -> String {
        // PowerShell is case-insensitive, so randomized case is often used
        let mut result = content.to_string();
        
        // Normalize common PowerShell commands
        let commands = [
            "Invoke-Expression",
            "Invoke-Command",
            "New-Object",
            "Set-Variable",
            "Get-Variable",
            "Add-Type",
            "Start-Process",
            "Download-File",
            "DownloadString",
            "FromBase64String",
        ];
        
        for cmd in &commands {
            let pattern = Regex::new(&format!(r"(?i)\b{}\b", regex::escape(cmd))).unwrap();
            result = pattern.replace_all(&result, *cmd).to_string();
        }
        
        result
    }

    fn deobfuscate_tick_marks(&self, content: &str) -> String {
        // Remove backticks used for obfuscation in PowerShell
        content.replace("`", "")
    }

    fn deobfuscate_concatenation(&self, content: &str) -> String {
        let mut result = content.to_string();
        
        // Handle PowerShell string concatenation with +
        let concat_pattern = Regex::new(r#"['"]([^'"]+)['"]\s*\+\s*['"]([^'"]+)['"]"#).unwrap();
        
        while let Some(caps) = concat_pattern.captures(&result) {
            if let (Some(str1), Some(str2)) = (caps.get(1), caps.get(2)) {
                let combined = format!("'{}{}'", str1.as_str(), str2.as_str());
                result = result.replace(&caps[0], &combined);
            } else {
                break;
            }
        }
        
        result
    }
}

impl DeobfuscationTechnique for PsDeobfuscator {
    fn name(&self) -> &'static str {
        "PowerShell Deobfuscator"
    }

    fn can_deobfuscate(&self, content: &str) -> Option<f32> {
        let mut confidence: f32 = 0.0;
        let mut indicators = 0;
        
        // Check for encoded command
        if self.encoded_cmd_pattern.is_match(content) {
            confidence += 0.4;
            indicators += 1;
        }
        
        // Check for compression indicators
        if self.compressed_pattern.is_match(content) {
            confidence += 0.3;
            indicators += 1;
        }
        
        // Check for string replacement
        if self.string_replace_pattern.is_match(content) {
            confidence += 0.2;
            indicators += 1;
        }
        
        // Check for invoke patterns
        if self.invoke_pattern.is_match(content) {
            confidence += 0.2;
            indicators += 1;
        }
        
        // Check for other PowerShell indicators
        let ps_indicators = [
            "powershell",
            "pwsh",
            "-nop",
            "-noni",
            "-w hidden",
            "-windowstyle",
            "-executionpolicy",
            "$env:",
            "[System.",
            "[Convert]::",
        ];
        
        for indicator in &ps_indicators {
            if content.to_lowercase().contains(indicator) {
                confidence += 0.1;
                indicators += 1;
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
        let mut context_parts = Vec::new();
        
        // 1. Decode encoded commands
        if let Some(caps) = self.encoded_cmd_pattern.captures(&result) {
            if let Some(encoded) = caps.get(1) {
                if let Some(decoded) = self.decode_powershell_base64(encoded.as_str()) {
                    result = result.replace(encoded.as_str(), &format!("/* DECODED: {} */", decoded));
                    changes_made = true;
                    context_parts.push("decoded base64 command");
                    
                    // Recursively deobfuscate the decoded content
                    if let Ok(recursive_result) = self.deobfuscate(&decoded) {
                        if recursive_result.success {
                            result = format!("{}\n/* FURTHER DEOBFUSCATED: {} */", result, recursive_result.output);
                        }
                    }
                }
            }
        }
        
        // 2. Remove tick marks
        let before = result.clone();
        result = self.deobfuscate_tick_marks(&result);
        if result != before {
            changes_made = true;
            context_parts.push("removed tick marks");
        }
        
        // 3. Normalize case
        let before = result.clone();
        result = self.deobfuscate_case_randomization(&result);
        if result != before {
            changes_made = true;
            context_parts.push("normalized case");
        }
        
        // 4. Handle string concatenation
        let before = result.clone();
        result = self.deobfuscate_concatenation(&result);
        if result != before {
            changes_made = true;
            context_parts.push("resolved concatenation");
        }
        
        // 5. Note string replacements
        let before = result.clone();
        result = self.deobfuscate_string_replace(&result);
        if result != before {
            changes_made = true;
            context_parts.push("identified string replacements");
        }
        
        let context = if !context_parts.is_empty() {
            Some(format!("PowerShell deobfuscation: {}", context_parts.join(", ")))
        } else {
            None
        };
        
        Ok(TechniqueResult {
            success: changes_made,
            output: result,
            context,
        })
    }

    fn matches_type(&self, technique_type: &ObfuscationTechnique) -> bool {
        matches!(
            technique_type,
            ObfuscationTechnique::PsEncodedCommand |
            ObfuscationTechnique::PsCompressed |
            ObfuscationTechnique::PsStringReplace |
            ObfuscationTechnique::PsInvokeExpression
        )
    }
}