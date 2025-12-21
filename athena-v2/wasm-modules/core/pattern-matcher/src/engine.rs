use aho_corasick::{AhoCorasick, AhoCorasickBuilder, MatchKind};
use rustc_hash::FxHashMap;
use std::sync::Arc;

use crate::types::*;
use crate::fuzzy::{FuzzyMatcher, FuzzyConfig, FuzzyAlgorithm};

pub struct PatternEngine {
    exact_matcher: Option<AhoCorasick>,
    exact_patterns: Vec<(String, String, f32)>, // (pattern_id, rule_id, weight)
    regex_patterns: Vec<(String, String, regex::Regex, f32)>, // (pattern_id, rule_id, regex, weight)
    binary_patterns: Vec<(String, String, Vec<u8>, Vec<u8>, f32)>, // (pattern_id, rule_id, pattern, mask, weight)
    fuzzy_patterns: Vec<(String, String, Vec<u8>, f32)>, // (pattern_id, rule_id, pattern, weight)
    fuzzy_matcher: FuzzyMatcher,
    rule_map: FxHashMap<String, Arc<CompiledRule>>,
}

impl PatternEngine {
    pub fn new() -> Self {
        Self {
            exact_matcher: None,
            exact_patterns: Vec::new(),
            regex_patterns: Vec::new(),
            binary_patterns: Vec::new(),
            fuzzy_patterns: Vec::new(),
            fuzzy_matcher: FuzzyMatcher::new(FuzzyConfig {
                max_distance: 2,
                algorithm: FuzzyAlgorithm::Levenshtein,
            }),
            rule_map: FxHashMap::default(),
        }
    }

    pub fn set_fuzzy_config(&mut self, config: FuzzyConfig) {
        self.fuzzy_matcher = FuzzyMatcher::new(config);
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
                        if let Some(bytes) = &pattern.bytes {
                            self.fuzzy_patterns.push((
                                pattern.id.clone(),
                                rule.id.clone(),
                                bytes.clone(),
                                pattern.weight,
                            ));
                        }
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

        // Scan fuzzy patterns
        for (pattern_id, rule_id, pattern, weight) in &self.fuzzy_patterns {
            let positions = self.fuzzy_matcher.find_all(pattern, data);

            for offset in positions {
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

        // Evaluate rule conditions and filter matches
        matches = self.evaluate_conditions(&matches, &pattern_matches);

        Ok(matches)
    }

    /// Evaluate rule conditions and filter matches
    fn evaluate_conditions(
        &self,
        matches: &[Match],
        pattern_matches: &FxHashMap<String, Vec<(usize, usize)>>,
    ) -> Vec<Match> {
        let mut filtered_matches = Vec::new();
        let mut processed_rules = FxHashMap::default();

        for mat in matches {
            // Skip if we've already processed this rule
            if processed_rules.contains_key(&mat.rule_id) {
                continue;
            }

            if let Some(rule) = self.rule_map.get(&mat.rule_id) {
                if self.evaluate_condition(&rule.condition, pattern_matches) {
                    // Rule condition satisfied, include all matches for this rule
                    processed_rules.insert(mat.rule_id.clone(), true);

                    for m in matches {
                        if m.rule_id == mat.rule_id {
                            filtered_matches.push(m.clone());
                        }
                    }
                }
            }
        }

        filtered_matches
    }

    /// Recursively evaluate a condition
    fn evaluate_condition(
        &self,
        condition: &Condition,
        pattern_matches: &FxHashMap<String, Vec<(usize, usize)>>,
    ) -> bool {
        match condition {
            Condition::All => {
                // All patterns must match
                if let Some(rule) = self.rule_map.values().next() {
                    rule.patterns.iter().all(|p| pattern_matches.contains_key(&p.id))
                } else {
                    false
                }
            }

            Condition::Any(count) => {
                // At least 'count' patterns must match
                if let Some(rule) = self.rule_map.values().next() {
                    let match_count = rule.patterns.iter()
                        .filter(|p| pattern_matches.contains_key(&p.id))
                        .count();
                    match_count >= *count
                } else {
                    false
                }
            }

            Condition::Not(inner) => {
                !self.evaluate_condition(inner, pattern_matches)
            }

            Condition::And(conditions) => {
                conditions.iter().all(|c| self.evaluate_condition(c, pattern_matches))
            }

            Condition::Or(conditions) => {
                conditions.iter().any(|c| self.evaluate_condition(c, pattern_matches))
            }

            Condition::PatternRef(pattern_id) => {
                pattern_matches.contains_key(pattern_id)
            }
        }
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
        stats.fuzzy_patterns = self.fuzzy_patterns.len();
        stats.total_patterns = stats.exact_patterns + stats.regex_patterns + stats.binary_patterns + stats.fuzzy_patterns;

        stats
    }

    pub fn clear(&mut self) {
        self.exact_matcher = None;
        self.exact_patterns.clear();
        self.regex_patterns.clear();
        self.binary_patterns.clear();
        self.fuzzy_patterns.clear();
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

    #[test]
    fn test_fuzzy_pattern_matching() {
        let mut engine = PatternEngine::new();
        engine.set_fuzzy_config(FuzzyConfig {
            max_distance: 2,
            algorithm: FuzzyAlgorithm::Levenshtein,
        });

        let pattern = CompiledPattern {
            id: "fuzzy_pattern".to_string(),
            pattern_type: PatternType::Fuzzy,
            regex: None,
            bytes: Some(b"malware".to_vec()),
            mask: None,
            weight: 0.85,
        };

        let rule = CompiledRule {
            id: "fuzzy_rule".to_string(),
            name: "Fuzzy Rule".to_string(),
            patterns: vec![pattern],
            condition: Condition::All,
            severity: Severity::High,
            category: ThreatCategory::Malware,
        };

        engine.compile(&[rule]).unwrap();

        // Test with slightly different string (edit distance = 2)
        let data = b"This contains mlware in the text";
        let matches = engine.scan(data).unwrap();

        assert!(!matches.is_empty(), "Should find fuzzy match with edit distance 2");
        assert_eq!(matches[0].pattern_id, "fuzzy_pattern");
    }

    #[test]
    fn test_condition_evaluation_all() {
        let mut engine = PatternEngine::new();

        let pattern1 = CompiledPattern {
            id: "pattern1".to_string(),
            pattern_type: PatternType::Exact,
            regex: None,
            bytes: Some(b"hello".to_vec()),
            mask: None,
            weight: 1.0,
        };

        let pattern2 = CompiledPattern {
            id: "pattern2".to_string(),
            pattern_type: PatternType::Exact,
            regex: None,
            bytes: Some(b"world".to_vec()),
            mask: None,
            weight: 1.0,
        };

        let rule = CompiledRule {
            id: "cond_rule".to_string(),
            name: "Conditional Rule".to_string(),
            patterns: vec![pattern1, pattern2],
            condition: Condition::All,
            severity: Severity::Medium,
            category: ThreatCategory::Suspicious,
        };

        engine.compile(&[rule]).unwrap();

        // Both patterns present - should match
        let data1 = b"hello world";
        let matches1 = engine.scan(data1).unwrap();
        assert_eq!(matches1.len(), 2, "Should find both patterns");

        // Only one pattern present - should not match after condition filtering
        let data2 = b"hello there";
        let matches2 = engine.scan(data2).unwrap();
        assert_eq!(matches2.len(), 0, "Condition 'All' not satisfied");
    }

    #[test]
    fn test_condition_evaluation_any() {
        let mut engine = PatternEngine::new();

        let pattern1 = CompiledPattern {
            id: "pattern1".to_string(),
            pattern_type: PatternType::Exact,
            regex: None,
            bytes: Some(b"malware".to_vec()),
            mask: None,
            weight: 1.0,
        };

        let pattern2 = CompiledPattern {
            id: "pattern2".to_string(),
            pattern_type: PatternType::Exact,
            regex: None,
            bytes: Some(b"virus".to_vec()),
            mask: None,
            weight: 1.0,
        };

        let rule = CompiledRule {
            id: "any_rule".to_string(),
            name: "Any Rule".to_string(),
            patterns: vec![pattern1, pattern2],
            condition: Condition::Any(1),
            severity: Severity::High,
            category: ThreatCategory::Malware,
        };

        engine.compile(&[rule]).unwrap();

        // One pattern present - should match
        let data = b"This file contains malware";
        let matches = engine.scan(data).unwrap();
        assert!(!matches.is_empty(), "Condition 'Any(1)' satisfied");
    }
}