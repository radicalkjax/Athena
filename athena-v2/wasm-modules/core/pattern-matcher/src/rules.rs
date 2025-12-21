use crate::types::*;
use regex::Regex;
use std::str;

pub struct RuleParser;

impl RuleParser {
    pub fn parse_yara_like(rule_text: &str) -> Result<Rule> {
        // This is a simplified YARA-like parser
        // Real implementation would use a proper parser like nom
        
        let lines: Vec<&str> = rule_text.lines()
            .filter(|line| !line.trim().is_empty())
            .collect();
        let mut rule = Rule {
            id: String::new(),
            name: String::new(),
            description: String::new(),
            patterns: Vec::new(),
            condition: Condition::All,
            severity: Severity::Medium,
            category: ThreatCategory::Suspicious,
            tags: Vec::new(),
            metadata: serde_json::Value::Object(serde_json::Map::new()),
        };
        
        // Parse rule header
        if let Some(header_line) = lines.get(0) {
            if header_line.starts_with("rule ") {
                let parts: Vec<&str> = header_line.split_whitespace().collect();
                if parts.len() >= 2 {
                    rule.name = parts[1].to_string();
                    rule.id = rule.name.clone().to_lowercase().replace(' ', "_");
                }
            }
        }
        
        // Parse patterns and metadata
        let mut in_strings_section = false;
        let mut in_condition_section = false;
        
        for line in lines.iter().skip(1) {
            let trimmed = line.trim();
            
            if trimmed == "strings:" {
                in_strings_section = true;
                in_condition_section = false;
                continue;
            }
            
            if trimmed == "condition:" {
                in_strings_section = false;
                in_condition_section = true;
                continue;
            }
            
            if in_strings_section && trimmed.starts_with('$') {
                if let Some(pattern) = Self::parse_pattern_line(trimmed)? {
                    rule.patterns.push(pattern);
                }
            }
            
            if in_condition_section {
                rule.condition = Self::parse_condition(trimmed)?;
            }
        }
        
        Ok(rule)
    }
    
    fn parse_pattern_line(line: &str) -> Result<Option<Pattern>> {
        // Parse patterns like:
        // $str1 = "malware"
        // $hex1 = { 4D 5A }
        // $re1 = /evil.*pattern/
        
        let parts: Vec<&str> = line.splitn(3, '=').collect();
        if parts.len() < 2 {
            return Ok(None);
        }
        
        let id = parts[0].trim().trim_start_matches('$');
        let value_part = parts[1].trim();
        
        let pattern = if value_part.starts_with('"') && value_part.ends_with('"') {
            // String pattern
            let string_value = value_part.trim_matches('"');
            Pattern {
                id: id.to_string(),
                pattern_type: PatternType::Exact,
                value: string_value.as_bytes().to_vec(),
                mask: None,
                description: format!("String pattern: {}", string_value),
                weight: 1.0,
            }
        } else if value_part.starts_with('{') && value_part.ends_with('}') {
            // Hex pattern
            let hex_str = value_part.trim_matches(|c| c == '{' || c == '}');
            let bytes = Self::parse_hex_string(hex_str)?;
            Pattern {
                id: id.to_string(),
                pattern_type: PatternType::Binary,
                value: bytes,
                mask: None,
                description: "Binary pattern".to_string(),
                weight: 1.0,
            }
        } else if value_part.starts_with('/') && value_part.ends_with('/') {
            // Regex pattern
            let regex_str = value_part.trim_matches('/');
            Pattern {
                id: id.to_string(),
                pattern_type: PatternType::Regex,
                value: regex_str.as_bytes().to_vec(),
                mask: None,
                description: format!("Regex pattern: {}", regex_str),
                weight: 1.0,
            }
        } else {
            return Ok(None);
        };
        
        Ok(Some(pattern))
    }
    
    fn parse_hex_string(hex: &str) -> Result<Vec<u8>> {
        let hex_chars: Vec<&str> = hex.split_whitespace().collect();
        let mut bytes = Vec::new();
        
        for hex_byte in hex_chars {
            if hex_byte == "??" {
                // Wildcard byte
                bytes.push(0x00);
            } else {
                let byte = u8::from_str_radix(hex_byte, 16)
                    .map_err(|_| PatternMatcherError::InvalidPattern(
                        format!("Invalid hex byte: {}", hex_byte)
                    ))?;
                bytes.push(byte);
            }
        }
        
        Ok(bytes)
    }
    
    fn parse_condition(condition_str: &str) -> Result<Condition> {
        let trimmed = condition_str.trim();
        
        if trimmed == "all" || trimmed == "all of them" {
            Ok(Condition::All)
        } else if trimmed.starts_with("any of") {
            Ok(Condition::Any(1))
        } else if trimmed.contains(" and ") {
            // Parse AND conditions
            let parts: Vec<&str> = trimmed.split(" and ").collect();
            let conditions: Vec<Condition> = parts.iter()
                .map(|p| Condition::PatternRef(p.trim().trim_start_matches('$').to_string()))
                .collect();
            Ok(Condition::And(conditions))
        } else if trimmed.contains(" or ") {
            // Parse OR conditions
            let parts: Vec<&str> = trimmed.split(" or ").collect();
            let conditions: Vec<Condition> = parts.iter()
                .map(|p| Condition::PatternRef(p.trim().trim_start_matches('$').to_string()))
                .collect();
            Ok(Condition::Or(conditions))
        } else {
            // Single pattern reference
            Ok(Condition::PatternRef(trimmed.trim_start_matches('$').to_string()))
        }
    }
}

pub struct RuleCompiler;

impl RuleCompiler {
    pub fn compile(rule: &Rule) -> Result<CompiledRule> {
        let mut compiled_patterns = Vec::new();
        
        for pattern in &rule.patterns {
            let compiled = Self::compile_pattern(pattern)?;
            compiled_patterns.push(compiled);
        }
        
        Ok(CompiledRule {
            id: rule.id.clone(),
            name: rule.name.clone(),
            patterns: compiled_patterns,
            condition: rule.condition.clone(),
            severity: rule.severity,
            category: rule.category,
        })
    }
    
    fn compile_pattern(pattern: &Pattern) -> Result<CompiledPattern> {
        let compiled = match pattern.pattern_type {
            PatternType::Exact => CompiledPattern {
                id: pattern.id.clone(),
                pattern_type: PatternType::Exact,
                regex: None,
                bytes: Some(pattern.value.clone()),
                mask: pattern.mask.clone(),
                weight: pattern.weight,
            },
            PatternType::Regex => {
                let regex_str = str::from_utf8(&pattern.value)
                    .map_err(|_| PatternMatcherError::InvalidPattern(
                        "Invalid UTF-8 in regex pattern".to_string()
                    ))?;
                let regex = Regex::new(regex_str)
                    .map_err(|e| PatternMatcherError::CompilationError(
                        format!("Regex compilation error: {}", e)
                    ))?;
                CompiledPattern {
                    id: pattern.id.clone(),
                    pattern_type: PatternType::Regex,
                    regex: Some(regex),
                    bytes: None,
                    mask: None,
                    weight: pattern.weight,
                }
            },
            PatternType::Binary => CompiledPattern {
                id: pattern.id.clone(),
                pattern_type: PatternType::Binary,
                regex: None,
                bytes: Some(pattern.value.clone()),
                mask: pattern.mask.clone(),
                weight: pattern.weight,
            },
            PatternType::Fuzzy => {
                // Fuzzy patterns use the original bytes for Levenshtein distance matching
                // The actual fuzzy matching logic is in the matcher module using strsim
                CompiledPattern {
                    id: pattern.id.clone(),
                    pattern_type: PatternType::Fuzzy,
                    regex: None,
                    bytes: Some(pattern.value.clone()),
                    mask: None,
                    weight: pattern.weight * 0.8, // Reduce weight slightly for fuzzy matches
                }
            }
        };
        
        Ok(compiled)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_parse_simple_rule() {
        let rule_text = r#"
rule test_malware
strings:
    $str1 = "malicious"
    $hex1 = { 4D 5A 90 00 }
    $re1 = /evil.*code/
condition:
    all of them
"#;
        
        let rule = RuleParser::parse_yara_like(rule_text).unwrap();
        assert_eq!(rule.name, "test_malware");
        assert_eq!(rule.patterns.len(), 3);
        assert_eq!(rule.patterns[0].id, "str1");
        assert_eq!(rule.patterns[1].id, "hex1");
        assert_eq!(rule.patterns[2].id, "re1");
    }
    
    #[test]
    fn test_compile_rule() {
        let pattern = Pattern {
            id: "test".to_string(),
            pattern_type: PatternType::Exact,
            value: b"test".to_vec(),
            mask: None,
            description: "Test pattern".to_string(),
            weight: 1.0,
        };
        
        let rule = Rule {
            id: "test_rule".to_string(),
            name: "Test Rule".to_string(),
            description: "A test rule".to_string(),
            patterns: vec![pattern],
            condition: Condition::All,
            severity: Severity::Low,
            category: ThreatCategory::Suspicious,
            tags: vec![],
            metadata: serde_json::Value::Null,
        };
        
        let compiled = RuleCompiler::compile(&rule).unwrap();
        assert_eq!(compiled.patterns.len(), 1);
        assert_eq!(compiled.patterns[0].id, "test");
    }
}