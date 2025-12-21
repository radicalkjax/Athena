// Component Model implementation for athena:pattern-matcher

wit_bindgen::generate!({
    world: "pattern-matcher-component",
    path: "wit",
});

use crate::types::*;
use crate::matcher::PatternMatcher as InternalMatcher;
use crate::signatures::SignatureDatabase;
use std::cell::RefCell;

// ============================================================================
// Component Implementation
// ============================================================================

struct Component;

// ============================================================================
// Matcher Instance
// ============================================================================

struct MatcherInstance {
    internal: InternalMatcher,
}

impl MatcherInstance {
    fn new() -> Self {
        Self {
            internal: InternalMatcher::new(),
        }
    }

    fn load_default_rules_internal(&mut self) -> std::result::Result<(), String> {
        let rules = SignatureDatabase::get_default_rules();
        self.internal.load_rules(rules)
            .map_err(|e| e.to_string())
    }

    fn add_rule_text_internal(&mut self, rule_text: &str) -> std::result::Result<String, String> {
        self.internal.parse_and_add_rule(rule_text)
            .map_err(|e| e.to_string())
    }

    fn scan_internal(&mut self, data: &[u8]) -> std::result::Result<exports::athena::pattern_matcher::pattern_matcher::ScanResult, String> {
        let result = self.internal.scan(data)
            .map_err(|e| e.to_string())?;

        Ok(convert_scan_result(result))
    }

    fn get_rule_count_internal(&self) -> u32 {
        self.internal.get_rule_count() as u32
    }

    fn get_stats_internal(&self) -> exports::athena::pattern_matcher::pattern_matcher::PatternStats {
        let (scans, matches, _avg_time) = self.internal.get_stats();

        // Calculate pattern stats (simplified)
        let rule_count = self.internal.get_rule_count() as u32;

        exports::athena::pattern_matcher::pattern_matcher::PatternStats {
            total_patterns: rule_count,
            exact_patterns: rule_count / 2,  // Approximation
            regex_patterns: rule_count / 4,
            binary_patterns: rule_count / 8,
            fuzzy_patterns: rule_count / 8,
        }
    }

    fn clear_rules_internal(&mut self) {
        self.internal.clear_rules();
    }
}

// ============================================================================
// Pattern Matcher Interface Implementation
// ============================================================================

impl exports::athena::pattern_matcher::pattern_matcher::Guest for Component {
    type Matcher = MatcherResource;
    type StreamingScanner = StreamingScannerResource;

    fn new() -> exports::athena::pattern_matcher::pattern_matcher::Matcher {
        let mut instance = MatcherInstance::new();
        let _ = instance.load_default_rules_internal();
        exports::athena::pattern_matcher::pattern_matcher::Matcher::new(
            MatcherResource::new(instance)
        )
    }

    fn new_empty() -> exports::athena::pattern_matcher::pattern_matcher::Matcher {
        exports::athena::pattern_matcher::pattern_matcher::Matcher::new(
            MatcherResource::new(MatcherInstance::new())
        )
    }

    fn load_default_rules(handle: exports::athena::pattern_matcher::pattern_matcher::Matcher) -> std::result::Result<(), String> {
        handle.get::<MatcherResource>().instance.borrow_mut().load_default_rules_internal()
    }

    fn add_rule_text(handle: exports::athena::pattern_matcher::pattern_matcher::Matcher, rule_text: String) -> std::result::Result<String, String> {
        handle.get::<MatcherResource>().instance.borrow_mut().add_rule_text_internal(&rule_text)
    }

    fn scan(handle: exports::athena::pattern_matcher::pattern_matcher::Matcher, data: Vec<u8>) -> std::result::Result<exports::athena::pattern_matcher::pattern_matcher::ScanResult, String> {
        handle.get::<MatcherResource>().instance.borrow_mut().scan_internal(&data)
    }

    fn get_rule_count(handle: exports::athena::pattern_matcher::pattern_matcher::Matcher) -> u32 {
        handle.get::<MatcherResource>().instance.borrow().get_rule_count_internal()
    }

    fn get_stats(handle: exports::athena::pattern_matcher::pattern_matcher::Matcher) -> exports::athena::pattern_matcher::pattern_matcher::PatternStats {
        handle.get::<MatcherResource>().instance.borrow().get_stats_internal()
    }

    fn clear_rules(handle: exports::athena::pattern_matcher::pattern_matcher::Matcher) {
        handle.get::<MatcherResource>().instance.borrow_mut().clear_rules_internal();
    }
}

// ============================================================================
// Matcher Resource Implementation
// ============================================================================

struct MatcherResource {
    instance: RefCell<MatcherInstance>,
}

impl MatcherResource {
    fn new(instance: MatcherInstance) -> Self {
        Self {
            instance: RefCell::new(instance),
        }
    }
}

impl exports::athena::pattern_matcher::pattern_matcher::GuestMatcher for MatcherResource {
    fn new() -> Self {
        let mut instance = MatcherInstance::new();
        let _ = instance.load_default_rules_internal();
        Self::new(instance)
    }

    fn load_default_rules(&self) -> std::result::Result<(), String> {
        self.instance.borrow_mut().load_default_rules_internal()
    }

    fn add_rule_text(&self, rule_text: String) -> std::result::Result<String, String> {
        self.instance.borrow_mut().add_rule_text_internal(&rule_text)
    }

    fn scan(&self, data: Vec<u8>) -> std::result::Result<exports::athena::pattern_matcher::pattern_matcher::ScanResult, String> {
        self.instance.borrow_mut().scan_internal(&data)
    }

    fn get_rule_count(&self) -> u32 {
        self.instance.borrow().get_rule_count_internal()
    }

    fn get_stats(&self) -> exports::athena::pattern_matcher::pattern_matcher::PatternStats {
        self.instance.borrow().get_stats_internal()
    }

    fn clear_rules(&self) {
        self.instance.borrow_mut().clear_rules_internal();
    }
}

// ============================================================================
// Streaming Scanner Resource Implementation
// ============================================================================

struct StreamingScannerResource {
    matcher: RefCell<InternalMatcher>,
    buffer: RefCell<Vec<u8>>,
    chunk_size: usize,
}

impl StreamingScannerResource {
    fn new(chunk_size: u32) -> std::result::Result<Self, String> {
        let mut matcher = InternalMatcher::new();
        let rules = SignatureDatabase::get_default_rules();
        matcher.load_rules(rules)
            .map_err(|e| e.to_string())?;

        Ok(Self {
            matcher: RefCell::new(matcher),
            buffer: RefCell::new(Vec::new()),
            chunk_size: chunk_size as usize,
        })
    }
}

impl exports::athena::pattern_matcher::pattern_matcher::GuestStreamingScanner for StreamingScannerResource {
    fn new(chunk_size: u32) -> Self {
        Self::new(chunk_size).expect("Failed to create streaming scanner")
    }

    fn process_chunk(&self, chunk: Vec<u8>) -> std::result::Result<exports::athena::pattern_matcher::pattern_matcher::ScanChunk, String> {
        let mut buffer = self.buffer.borrow_mut();
        buffer.extend_from_slice(&chunk);

        if buffer.len() >= self.chunk_size {
            let result = self.matcher.borrow_mut().scan(&buffer)
                .map_err(|e| e.to_string())?;

            // Keep last 1KB for overlap detection
            let overlap_size = 1024.min(buffer.len());
            let new_buffer = buffer[buffer.len() - overlap_size..].to_vec();
            *buffer = new_buffer;

            Ok(exports::athena::pattern_matcher::pattern_matcher::ScanChunk {
                has_result: true,
                scan_result: Some(convert_scan_result(result)),
            })
        } else {
            Ok(exports::athena::pattern_matcher::pattern_matcher::ScanChunk {
                has_result: false,
                scan_result: None,
            })
        }
    }

    fn finish(&self) -> std::result::Result<exports::athena::pattern_matcher::pattern_matcher::ScanChunk, String> {
        let mut buffer = self.buffer.borrow_mut();

        if !buffer.is_empty() {
            let result = self.matcher.borrow_mut().scan(&buffer)
                .map_err(|e| e.to_string())?;
            buffer.clear();

            Ok(exports::athena::pattern_matcher::pattern_matcher::ScanChunk {
                has_result: true,
                scan_result: Some(convert_scan_result(result)),
            })
        } else {
            Ok(exports::athena::pattern_matcher::pattern_matcher::ScanChunk {
                has_result: false,
                scan_result: None,
            })
        }
    }
}

// ============================================================================
// Helper Functions - Conversion
// ============================================================================

fn convert_scan_result(result: ScanResult) -> exports::athena::pattern_matcher::pattern_matcher::ScanResult {
    exports::athena::pattern_matcher::pattern_matcher::ScanResult {
        matches: result.matches.into_iter().map(convert_match).collect(),
        total_rules_evaluated: result.total_rules_evaluated as u32,
        scan_time_ms: result.scan_time_ms,
        bytes_scanned: result.bytes_scanned as u64,
        threat_score: result.threat_score,
    }
}

fn convert_match(m: Match) -> exports::athena::pattern_matcher::pattern_matcher::PatternMatch {
    exports::athena::pattern_matcher::pattern_matcher::PatternMatch {
        rule_id: m.rule_id,
        rule_name: m.rule_name,
        pattern_id: m.pattern_id,
        offset: m.offset as u64,
        length: m.length as u64,
        matched_data: m.matched_data,
        severity: convert_severity(m.severity),
        category: convert_category(m.category),
        confidence: m.confidence,
    }
}

fn convert_severity(severity: Severity) -> exports::athena::pattern_matcher::pattern_matcher::Severity {
    use exports::athena::pattern_matcher::pattern_matcher::Severity as WitSeverity;
    match severity {
        Severity::Critical => WitSeverity::Critical,
        Severity::High => WitSeverity::High,
        Severity::Medium => WitSeverity::Medium,
        Severity::Low => WitSeverity::Low,
        Severity::Info => WitSeverity::Info,
    }
}

fn convert_category(category: ThreatCategory) -> exports::athena::pattern_matcher::pattern_matcher::ThreatCategory {
    use exports::athena::pattern_matcher::pattern_matcher::ThreatCategory as WitCategory;
    match category {
        ThreatCategory::Malware => WitCategory::Malware,
        ThreatCategory::Exploit => WitCategory::Exploit,
        ThreatCategory::Obfuscation => WitCategory::Obfuscation,
        ThreatCategory::Suspicious => WitCategory::Suspicious,
        ThreatCategory::PII => WitCategory::Pii,
        ThreatCategory::Secret => WitCategory::Secret,
    }
}

// ============================================================================
// Export Component Implementations
// ============================================================================

export!(Component);
