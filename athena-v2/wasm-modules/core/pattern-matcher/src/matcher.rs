use crate::engine::PatternEngine;
use crate::rules::{RuleCompiler, RuleParser};
use crate::types::*;
use rustc_hash::FxHashMap;
use std::time::Instant;

pub struct PatternMatcher {
    engine: PatternEngine,
    rules: Vec<Rule>,
    compiled_rules: Vec<CompiledRule>,
    rule_index: FxHashMap<String, usize>,
    stats: MatcherStats,
}

#[derive(Debug, Default)]
struct MatcherStats {
    total_scans: usize,
    total_bytes_scanned: usize,
    total_matches: usize,
    total_time_ms: u64,
}

impl PatternMatcher {
    pub fn new() -> Self {
        Self {
            engine: PatternEngine::new(),
            rules: Vec::new(),
            compiled_rules: Vec::new(),
            rule_index: FxHashMap::default(),
            stats: MatcherStats::default(),
        }
    }

    pub fn load_rules(&mut self, rules: Vec<Rule>) -> Result<()> {
        self.rules = rules;
        self.compile_all_rules()?;
        Ok(())
    }

    pub fn add_rule(&mut self, rule: Rule) -> Result<()> {
        let rule_id = rule.id.clone();
        self.rules.push(rule);
        
        // Compile and add the new rule
        if let Some(rule) = self.rules.last() {
            let compiled = RuleCompiler::compile(rule)?;
            self.compiled_rules.push(compiled.clone());
            self.rule_index.insert(rule_id, self.compiled_rules.len() - 1);
            
            // Recompile the engine with all rules
            self.engine.compile(&self.compiled_rules)?;
        }
        
        Ok(())
    }

    pub fn parse_and_add_rule(&mut self, rule_text: &str) -> Result<String> {
        let rule = RuleParser::parse_yara_like(rule_text)?;
        let rule_id = rule.id.clone();
        self.add_rule(rule)?;
        Ok(rule_id)
    }

    fn compile_all_rules(&mut self) -> Result<()> {
        self.compiled_rules.clear();
        self.rule_index.clear();
        
        for (idx, rule) in self.rules.iter().enumerate() {
            let compiled = RuleCompiler::compile(rule)?;
            self.rule_index.insert(rule.id.clone(), idx);
            self.compiled_rules.push(compiled);
        }
        
        self.engine.compile(&self.compiled_rules)?;
        Ok(())
    }

    pub fn scan(&mut self, data: &[u8]) -> Result<ScanResult> {
        let start = Instant::now();
        
        let matches = self.engine.scan(data)?;
        let matches_with_confidence = self.apply_confidence_scoring(matches, data);
        
        let scan_time_ms = start.elapsed().as_millis() as u64;
        let threat_score = self.calculate_threat_score(&matches_with_confidence);
        
        // Update stats
        self.stats.total_scans += 1;
        self.stats.total_bytes_scanned += data.len();
        self.stats.total_matches += matches_with_confidence.len();
        self.stats.total_time_ms += scan_time_ms;
        
        Ok(ScanResult {
            matches: matches_with_confidence,
            total_rules_evaluated: self.compiled_rules.len(),
            scan_time_ms,
            bytes_scanned: data.len(),
            threat_score,
        })
    }

    fn apply_confidence_scoring(&self, mut matches: Vec<Match>, data: &[u8]) -> Vec<Match> {
        for match_item in &mut matches {
            // Apply confidence modifiers based on context
            let mut confidence = match_item.confidence;
            
            // Check if match is at file start (often more significant)
            if match_item.offset == 0 {
                confidence *= 1.2;
            }
            
            // Check entropy around the match
            let entropy = self.calculate_local_entropy(data, match_item.offset, 256);
            if entropy > 7.0 {
                // High entropy suggests encryption/packing
                confidence *= 1.3;
            }
            
            // Adjust based on severity
            confidence *= match match_item.severity {
                Severity::Critical => 1.5,
                Severity::High => 1.3,
                Severity::Medium => 1.0,
                Severity::Low => 0.8,
                Severity::Info => 0.5,
            };
            
            match_item.confidence = confidence.min(1.0);
        }
        
        matches
    }

    fn calculate_local_entropy(&self, data: &[u8], offset: usize, window: usize) -> f32 {
        let start = offset.saturating_sub(window / 2);
        let end = (offset + window / 2).min(data.len());
        
        if start >= end {
            return 0.0;
        }
        
        let window_data = &data[start..end];
        let mut byte_counts = [0u32; 256];
        
        for &byte in window_data {
            byte_counts[byte as usize] += 1;
        }
        
        let len = window_data.len() as f32;
        let mut entropy = 0.0;
        
        for count in byte_counts.iter() {
            if *count > 0 {
                let p = *count as f32 / len;
                entropy -= p * p.log2();
            }
        }
        
        entropy
    }

    fn calculate_threat_score(&self, matches: &[Match]) -> f32 {
        if matches.is_empty() {
            return 0.0;
        }
        
        let mut score = 0.0;
        let mut weights = 0.0;
        
        for match_item in matches {
            let severity_weight = match match_item.severity {
                Severity::Critical => 10.0,
                Severity::High => 5.0,
                Severity::Medium => 2.0,
                Severity::Low => 1.0,
                Severity::Info => 0.5,
            };
            
            let category_weight = match match_item.category {
                ThreatCategory::Malware => 2.0,
                ThreatCategory::Exploit => 1.8,
                ThreatCategory::Obfuscation => 1.5,
                ThreatCategory::Suspicious => 1.2,
                ThreatCategory::PII => 1.0,
                ThreatCategory::Secret => 1.3,
            };
            
            let match_score = match_item.confidence * severity_weight * category_weight;
            score += match_score;
            weights += severity_weight * category_weight;
        }
        
        // Normalize to 0-100 scale
        let normalized = (score / weights * 100.0).min(100.0);
        normalized
    }

    pub fn get_rule_count(&self) -> usize {
        self.rules.len()
    }

    pub fn get_stats(&self) -> (usize, usize, f64) {
        let avg_time = if self.stats.total_scans > 0 {
            self.stats.total_time_ms as f64 / self.stats.total_scans as f64
        } else {
            0.0
        };
        
        (self.stats.total_scans, self.stats.total_matches, avg_time)
    }

    pub fn clear_rules(&mut self) {
        self.rules.clear();
        self.compiled_rules.clear();
        self.rule_index.clear();
        self.engine.clear();
    }

    pub fn get_throughput_mbps(&self) -> f64 {
        if self.stats.total_time_ms == 0 {
            return 0.0;
        }
        
        let bytes_per_second = (self.stats.total_bytes_scanned as f64 * 1000.0) / self.stats.total_time_ms as f64;
        bytes_per_second / (1024.0 * 1024.0) // Convert to MB/s
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pattern_matcher() {
        let mut matcher = PatternMatcher::new();
        
        let rule = Rule {
            id: "test_rule".to_string(),
            name: "Test Rule".to_string(),
            description: "Test description".to_string(),
            patterns: vec![Pattern {
                id: "p1".to_string(),
                pattern_type: PatternType::Exact,
                value: b"malware".to_vec(),
                mask: None,
                description: "Test pattern".to_string(),
                weight: 1.0,
            }],
            condition: Condition::All,
            severity: Severity::High,
            category: ThreatCategory::Malware,
            tags: vec![],
            metadata: serde_json::Value::Null,
        };
        
        matcher.load_rules(vec![rule]).unwrap();
        
        let data = b"This file contains malware code";
        let result = matcher.scan(data).unwrap();
        
        assert_eq!(result.matches.len(), 1);
        assert_eq!(result.matches[0].rule_id, "test_rule");
        assert!(result.threat_score > 0.0);
    }

    #[test]
    fn test_confidence_scoring() {
        let mut matcher = PatternMatcher::new();
        
        let rule = Rule {
            id: "high_conf_rule".to_string(),
            name: "High Confidence Rule".to_string(),
            description: "Test".to_string(),
            patterns: vec![Pattern {
                id: "p1".to_string(),
                pattern_type: PatternType::Exact,
                value: b"CRITICAL".to_vec(),
                mask: None,
                description: "Critical pattern".to_string(),
                weight: 0.8,
            }],
            condition: Condition::All,
            severity: Severity::Critical,
            category: ThreatCategory::Malware,
            tags: vec![],
            metadata: serde_json::Value::Null,
        };
        
        matcher.load_rules(vec![rule]).unwrap();
        
        let data = b"CRITICAL security issue found";
        let result = matcher.scan(data).unwrap();
        
        assert_eq!(result.matches.len(), 1);
        // Confidence should be boosted by severity
        assert!(result.matches[0].confidence > 0.8);
    }
}