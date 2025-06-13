use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};
use rustc_hash::FxHashMap;
use std::sync::Arc;

use crate::types::*;

pub struct PatternEngine {
    exact_matcher: Option<AhoCorasick>,
    exact_patterns: Vec<(String, String, f32)>, // (pattern_id, rule_id, weight)
    regex_patterns: Vec<(String, String, regex::Regex, f32)>, // (pattern_id, rule_id, regex, weight)
    binary_patterns: Vec<(String, String, Vec<u8>, Vec<u8>, f32)>, // (pattern_id, rule_id, pattern, mask, weight)
    rule_map: FxHashMap<String, Arc<CompiledRule>>,
}

impl PatternEngine {
    pub fn new() -> Self {
        Self {
            exact_matcher: None,
            exact_patterns: Vec::new(),
            regex_patterns: Vec::new(),
            binary_patterns: Vec::new(),
            rule_map: FxHashMap::default(),
        }
    }

    pub fn add_rule(&mut self, rule: CompiledRule) -> Result<()> {
        let rule_id = rule.id.clone();
        self.rule_map.insert(rule_id.clone(), Arc::new(rule));
        Ok(())
    }

    pub fn compile(&mut self, rules: &[CompiledRule]) -> Result<()> {
        let mut exact_patterns_bytes = Vec::new();
        let mut exact_pattern_info = Vec::new();

        for rule in rules {
            self.rule_map.insert(rule.id.clone(), Arc::new(rule.clone()));

            for pattern in &rule.patterns {
                match pattern.pattern_type {
                    PatternType::Exact => {
                        if let Some(bytes) = &pattern.bytes {
                            exact_patterns_bytes.push(bytes.clone());
                            exact_pattern_info.push((
                                pattern.id.clone(),
                                rule.id.clone(),
                                pattern.weight,
                            ));
                        }
                    }
                    PatternType::Regex => {
                        if let Some(regex) = &pattern.regex {
                            self.regex_patterns.push((
                                pattern.id.clone(),
                                rule.id.clone(),
                                regex.clone(),
                                pattern.weight,
                            ));
                        }
                    }
                    PatternType::Binary => {
                        if let (Some(bytes), Some(mask)) = (&pattern.bytes, &pattern.mask) {
                            self.binary_patterns.push((
                                pattern.id.clone(),
                                rule.id.clone(),
                                bytes.clone(),
                                mask.clone(),
                                pattern.weight,
                            ));
                        }
                    }
                    PatternType::Fuzzy => {
                        // TODO: Implement fuzzy matching
                    }
                }
            }
        }

        self.exact_patterns = exact_pattern_info;

        if !exact_patterns_bytes.is_empty() {
            let ac = AhoCorasickBuilder::new()
                .match_kind(MatchKind::Standard)
                .build(&exact_patterns_bytes)
                .map_err(|e| PatternMatcherError::CompilationError(e.to_string()))?;
            self.exact_matcher = Some(ac);
        }

        Ok(())
    }

    pub fn scan(&self, data: &[u8]) -> Result<Vec<Match>> {
        let mut matches = Vec::new();
        let mut pattern_matches: FxHashMap<String, Vec<(usize, usize)>> = FxHashMap::default();

        // Scan with Aho-Corasick for exact patterns
        if let Some(ref ac) = self.exact_matcher {
            for mat in ac.find_iter(data) {
                let pattern_idx = mat.pattern().as_usize();
                if let Some((pattern_id, rule_id, weight)) = self.exact_patterns.get(pattern_idx) {
                    let offset = mat.start();
                    let length = mat.end() - mat.start();
                    
                    pattern_matches
                        .entry(pattern_id.clone())
                        .or_insert_with(Vec::new)
                        .push((offset, length));

                    if let Some(rule) = self.rule_map.get(rule_id) {
                        matches.push(Match {
                            rule_id: rule_id.clone(),
                            rule_name: rule.name.clone(),
                            pattern_id: pattern_id.clone(),
                            offset,
                            length,
                            matched_data: data[offset..offset + length].to_vec(),
                            severity: rule.severity,
                            category: rule.category,
                            confidence: *weight,
                        });
                    }
                }
            }
        }

        // Scan regex patterns
        for (pattern_id, rule_id, regex, weight) in &self.regex_patterns {
            // Convert bytes to string for regex matching
            if let Ok(text) = std::str::from_utf8(data) {
                for mat in regex.find_iter(text) {
                    let offset = mat.start();
                    let length = mat.len();
                    
                    pattern_matches
                        .entry(pattern_id.clone())
                        .or_insert_with(Vec::new)
                        .push((offset, length));

                    if let Some(rule) = self.rule_map.get(rule_id) {
                        matches.push(Match {
                            rule_id: rule_id.clone(),
                            rule_name: rule.name.clone(),
                            pattern_id: pattern_id.clone(),
                            offset,
                            length,
                            matched_data: data[offset..offset + length].to_vec(),
                            severity: rule.severity,
                            category: rule.category,
                            confidence: *weight,
                        });
                    }
                }
            }
        }

        // Scan binary patterns with masks
        for (pattern_id, rule_id, pattern, mask, weight) in &self.binary_patterns {
            for offset in 0..data.len().saturating_sub(pattern.len() - 1) {
                if Self::matches_with_mask(&data[offset..], pattern, mask) {
                    let length = pattern.len();
                    
                    pattern_matches
                        .entry(pattern_id.clone())
                        .or_insert_with(Vec::new)
                        .push((offset, length));

                    if let Some(rule) = self.rule_map.get(rule_id) {
                        matches.push(Match {
                            rule_id: rule_id.clone(),
                            rule_name: rule.name.clone(),
                            pattern_id: pattern_id.clone(),
                            offset,
                            length,
                            matched_data: data[offset..offset + length].to_vec(),
                            severity: rule.severity,
                            category: rule.category,
                            confidence: *weight,
                        });
                    }
                }
            }
        }

        // TODO: Evaluate rule conditions and filter matches based on them

        Ok(matches)
    }

    fn matches_with_mask(data: &[u8], pattern: &[u8], mask: &[u8]) -> bool {
        if data.len() < pattern.len() {
            return false;
        }

        for i in 0..pattern.len() {
            if (data[i] & mask[i]) != (pattern[i] & mask[i]) {
                return false;
            }
        }

        true
    }

    pub fn get_stats(&self) -> PatternStats {
        let mut stats = PatternStats::new();
        
        stats.exact_patterns = self.exact_patterns.len();
        stats.regex_patterns = self.regex_patterns.len();
        stats.binary_patterns = self.binary_patterns.len();
        stats.total_patterns = stats.exact_patterns + stats.regex_patterns + stats.binary_patterns;
        
        stats
    }

    pub fn clear(&mut self) {
        self.exact_matcher = None;
        self.exact_patterns.clear();
        self.regex_patterns.clear();
        self.binary_patterns.clear();
        self.rule_map.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_pattern_matching() {
        let mut engine = PatternEngine::new();
        
        let pattern = CompiledPattern {
            id: "test_pattern".to_string(),
            pattern_type: PatternType::Exact,
            regex: None,
            bytes: Some(b"malware".to_vec()),
            mask: None,
            weight: 1.0,
        };
        
        let rule = CompiledRule {
            id: "test_rule".to_string(),
            name: "Test Rule".to_string(),
            patterns: vec![pattern],
            condition: Condition::All,
            severity: Severity::High,
            category: ThreatCategory::Malware,
        };
        
        engine.compile(&[rule]).unwrap();
        
        let data = b"This is a malware test string";
        let matches = engine.scan(data).unwrap();
        
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pattern_id, "test_pattern");
        assert_eq!(matches[0].offset, 10);
        assert_eq!(matches[0].length, 7);
    }

    #[test]
    fn test_binary_pattern_with_mask() {
        let mut engine = PatternEngine::new();
        
        let pattern = CompiledPattern {
            id: "binary_pattern".to_string(),
            pattern_type: PatternType::Binary,
            regex: None,
            bytes: Some(vec![0x41, 0x42, 0x43]),
            mask: Some(vec![0xFF, 0x00, 0xFF]),
            weight: 1.0,
        };
        
        let rule = CompiledRule {
            id: "binary_rule".to_string(),
            name: "Binary Rule".to_string(),
            patterns: vec![pattern],
            condition: Condition::All,
            severity: Severity::Medium,
            category: ThreatCategory::Suspicious,
        };
        
        engine.compile(&[rule]).unwrap();
        
        let data = vec![0x41, 0xFF, 0x43]; // A?C where ? can be anything
        let matches = engine.scan(&data).unwrap();
        
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].pattern_id, "binary_pattern");
    }
}