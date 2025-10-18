use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};

mod engine;
mod fuzzy;
mod matcher;
mod rules;
mod signatures;
mod types;
mod utils;

use matcher::PatternMatcher as InternalMatcher;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct PatternMatcher {
    internal: InternalMatcher,
}

#[wasm_bindgen]
impl PatternMatcher {
    #[wasm_bindgen(constructor)]
    pub fn new() -> std::result::Result<PatternMatcher, JsValue> {
        console_log!("Initializing Pattern Matcher v0.1.0");
        Ok(PatternMatcher {
            internal: InternalMatcher::new(),
        })
    }
    
    #[wasm_bindgen]
    pub fn load_default_rules(&mut self) -> std::result::Result<(), JsValue> {
        console_log!("Loading default malware signatures");
        let rules = signatures::SignatureDatabase::get_default_rules();
        self.internal.load_rules(rules)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        console_log!("Loaded {} rules", self.internal.get_rule_count());
        Ok(())
    }
    
    #[wasm_bindgen]
    pub fn add_rule_text(&mut self, rule_text: &str) -> std::result::Result<String, JsValue> {
        self.internal.parse_and_add_rule(rule_text)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen]
    pub fn scan(&mut self, data: &[u8]) -> std::result::Result<JsValue, JsValue> {
        console_log!("Scanning {} bytes", data.len());
        let result = self.internal.scan(data)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        // Convert to JS-friendly format
        let js_result = ScanResultJS {
            matches: result.matches.into_iter().map(|m| MatchJS {
                rule_id: m.rule_id,
                rule_name: m.rule_name,
                pattern_id: m.pattern_id,
                offset: m.offset as u32,
                length: m.length as u32,
                severity: format!("{:?}", m.severity),
                category: format!("{:?}", m.category),
                confidence: m.confidence,
                matched_data_base64: {
                    // Security: Limit matched data size to prevent memory issues
                    const MAX_MATCH_DATA: usize = 1024; // 1KB max
                    let data_to_encode = if m.matched_data.len() > MAX_MATCH_DATA {
                        &m.matched_data[..MAX_MATCH_DATA]
                    } else {
                        &m.matched_data
                    };
                    base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        data_to_encode
                    )
                },
            }).collect(),
            total_rules_evaluated: result.total_rules_evaluated as u32,
            scan_time_ms: result.scan_time_ms as u32,
            bytes_scanned: result.bytes_scanned as u32,
            threat_score: result.threat_score,
        };
        
        serde_wasm_bindgen::to_value(&js_result)
            .map_err(|e| JsValue::from_str(&e.to_string()))
    }
    
    #[wasm_bindgen]
    pub fn get_rule_count(&self) -> u32 {
        self.internal.get_rule_count() as u32
    }
    
    #[wasm_bindgen]
    pub fn get_stats(&self) -> Stats {
        let (scans, matches, avg_time) = self.internal.get_stats();
        let throughput_mbps = self.internal.get_throughput_mbps();
        
        Stats {
            total_scans: scans as u32,
            total_matches: matches as u32,
            average_scan_time_ms: avg_time as f32,
            throughput_mbps: throughput_mbps as f32,
        }
    }
    
    #[wasm_bindgen]
    pub fn clear_rules(&mut self) {
        self.internal.clear_rules();
    }
}

#[derive(Serialize, Deserialize)]
struct MatchJS {
    rule_id: String,
    rule_name: String,
    pattern_id: String,
    offset: u32,
    length: u32,
    severity: String,
    category: String,
    confidence: f32,
    matched_data_base64: String,
}

#[derive(Serialize, Deserialize)]
struct ScanResultJS {
    matches: Vec<MatchJS>,
    total_rules_evaluated: u32,
    scan_time_ms: u32,
    bytes_scanned: u32,
    threat_score: f32,
}

#[wasm_bindgen]
pub struct Stats {
    total_scans: u32,
    total_matches: u32,
    average_scan_time_ms: f32,
    throughput_mbps: f32,
}

#[wasm_bindgen]
impl Stats {
    #[wasm_bindgen(getter)]
    pub fn total_scans(&self) -> u32 {
        self.total_scans
    }
    
    #[wasm_bindgen(getter)]
    pub fn total_matches(&self) -> u32 {
        self.total_matches
    }
    
    #[wasm_bindgen(getter)]
    pub fn average_scan_time_ms(&self) -> f32 {
        self.average_scan_time_ms
    }
    
    #[wasm_bindgen(getter)]
    pub fn throughput_mbps(&self) -> f32 {
        self.throughput_mbps
    }
}

// Streaming support for large files
#[wasm_bindgen]
pub struct StreamingScanner {
    matcher: InternalMatcher,
    buffer: Vec<u8>,
    chunk_size: usize,
}

#[wasm_bindgen]
impl StreamingScanner {
    #[wasm_bindgen(constructor)]
    pub fn new(chunk_size: u32) -> std::result::Result<StreamingScanner, JsValue> {
        let mut matcher = InternalMatcher::new();
        let rules = signatures::SignatureDatabase::get_default_rules();
        matcher.load_rules(rules)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        
        Ok(StreamingScanner {
            matcher,
            buffer: Vec::new(),
            chunk_size: chunk_size as usize,
        })
    }
    
    #[wasm_bindgen]
    pub fn process_chunk(&mut self, chunk: &[u8]) -> std::result::Result<JsValue, JsValue> {
        self.buffer.extend_from_slice(chunk);
        
        // Process if we have enough data
        if self.buffer.len() >= self.chunk_size {
            let result = self.matcher.scan(&self.buffer)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            
            // Keep last 1KB for overlap detection
            let overlap_size = 1024.min(self.buffer.len());
            let new_buffer = self.buffer[self.buffer.len() - overlap_size..].to_vec();
            self.buffer = new_buffer;
            
            let js_result = ScanResultJS {
                matches: result.matches.into_iter().map(|m| MatchJS {
                    rule_id: m.rule_id,
                    rule_name: m.rule_name,
                    pattern_id: m.pattern_id,
                    offset: m.offset as u32,
                    length: m.length as u32,
                    severity: format!("{:?}", m.severity),
                    category: format!("{:?}", m.category),
                    confidence: m.confidence,
                    matched_data_base64: base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        &m.matched_data
                    ),
                }).collect(),
                total_rules_evaluated: result.total_rules_evaluated as u32,
                scan_time_ms: result.scan_time_ms as u32,
                bytes_scanned: result.bytes_scanned as u32,
                threat_score: result.threat_score,
            };
            
            serde_wasm_bindgen::to_value(&js_result)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        } else {
            // Not enough data yet, return empty result
            Ok(JsValue::NULL)
        }
    }
    
    #[wasm_bindgen]
    pub fn finish(&mut self) -> std::result::Result<JsValue, JsValue> {
        if !self.buffer.is_empty() {
            let result = self.matcher.scan(&self.buffer)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
            self.buffer.clear();
            
            let js_result = ScanResultJS {
                matches: result.matches.into_iter().map(|m| MatchJS {
                    rule_id: m.rule_id,
                    rule_name: m.rule_name,
                    pattern_id: m.pattern_id,
                    offset: m.offset as u32,
                    length: m.length as u32,
                    severity: format!("{:?}", m.severity),
                    category: format!("{:?}", m.category),
                    confidence: m.confidence,
                    matched_data_base64: base64::Engine::encode(
                        &base64::engine::general_purpose::STANDARD,
                        &m.matched_data
                    ),
                }).collect(),
                total_rules_evaluated: result.total_rules_evaluated as u32,
                scan_time_ms: result.scan_time_ms as u32,
                bytes_scanned: result.bytes_scanned as u32,
                threat_score: result.threat_score,
            };
            
            serde_wasm_bindgen::to_value(&js_result)
                .map_err(|e| JsValue::from_str(&e.to_string()))
        } else {
            Ok(JsValue::NULL)
        }
    }
}