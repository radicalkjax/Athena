mod types;
mod analyzer;
mod chain;
mod techniques;
mod ml;
mod tests;

use wasm_bindgen::prelude::*;
use serde_wasm_bindgen::{from_value, to_value};
use types::*;

#[wasm_bindgen]
pub struct Deobfuscator {
    config: DeobfuscatorConfig,
    analyzer: analyzer::ObfuscationAnalyzer,
    chain: chain::DeobfuscationChain,
    ml_predictor: Option<ml::MlPredictor>,
}

#[wasm_bindgen]
impl Deobfuscator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self::with_config(DeobfuscatorConfig::default())
    }

    #[wasm_bindgen(js_name = withConfig)]
    pub fn with_config_js(config: JsValue) -> std::result::Result<Deobfuscator, JsValue> {
        let config: DeobfuscatorConfig = from_value(config)?;
        Ok(Self::with_config(config))
    }

    fn with_config(config: DeobfuscatorConfig) -> Self {
        let ml_predictor = if config.enable_ml {
            Some(ml::MlPredictor::new())
        } else {
            None
        };

        Self {
            analyzer: analyzer::ObfuscationAnalyzer::new(),
            chain: chain::DeobfuscationChain::new(config.clone()),
            config,
            ml_predictor,
        }
    }

    #[wasm_bindgen(js_name = detectObfuscation)]
    pub fn detect_obfuscation(&self, content: &str) -> std::result::Result<JsValue, JsValue> {
        let mut analysis = self.analyzer.analyze(content);
        
        // Add ML predictions if enabled
        if let Some(ref predictor) = self.ml_predictor {
            let predictions = predictor.predict(content);
            analysis.ml_hints = Some(predictions);
        }
        
        to_value(&analysis).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen]
    pub fn deobfuscate(&self, content: &str) -> std::result::Result<JsValue, JsValue> {
        // First analyze the content
        let mut analysis = self.analyzer.analyze(content);
        
        // Add ML predictions if enabled
        if let Some(ref predictor) = self.ml_predictor {
            let predictions = predictor.predict(content);
            analysis.ml_hints = Some(predictions);
        }
        
        // Perform deobfuscation
        match self.chain.deobfuscate(content, &analysis) {
            Ok(mut result) => {
                // Add ML predictions to result
                if let Some(ref predictor) = self.ml_predictor {
                    let final_predictions = predictor.predict(&result.deobfuscated);
                    result.metadata.ml_predictions = Some(final_predictions);
                }
                
                to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
            }
            Err(e) => Err(JsValue::from_str(&e.to_string())),
        }
    }

    #[wasm_bindgen(js_name = analyzeEntropy)]
    pub fn analyze_entropy(&self, content: &str) -> std::result::Result<JsValue, JsValue> {
        let analyzer = ml::entropy::EntropyAnalyzer::new();
        let features = analyzer.analyze(content.as_bytes());
        let anomalies = analyzer.detect_entropy_anomalies(&features);
        
        let result = serde_json::json!({
            "entropy": features.global_entropy,
            "maxChunkEntropy": features.max_chunk_entropy,
            "minChunkEntropy": features.min_chunk_entropy,
            "variance": features.chunk_variance,
            "anomalies": anomalies,
        });
        
        to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = extractStrings)]
    pub fn extract_strings(&self, content: &str) -> std::result::Result<JsValue, JsValue> {
        let mut strings = Vec::new();
        
        // Extract printable strings (minimum length 4)
        let bytes = content.as_bytes();
        let mut current_string = String::new();
        let mut start_offset = 0;
        
        for (i, &byte) in bytes.iter().enumerate() {
            if byte.is_ascii() && !byte.is_ascii_control() {
                if current_string.is_empty() {
                    start_offset = i;
                }
                current_string.push(byte as char);
            } else if current_string.len() >= 4 {
                strings.push(ExtractedString {
                    value: current_string.clone(),
                    confidence: 1.0,
                    context: "ASCII string".to_string(),
                    offset: start_offset,
                });
                current_string.clear();
            } else {
                current_string.clear();
            }
        }
        
        // Don't forget the last string
        if current_string.len() >= 4 {
            strings.push(ExtractedString {
                value: current_string,
                confidence: 1.0,
                context: "ASCII string".to_string(),
                offset: start_offset,
            });
        }
        
        to_value(&strings).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = extractIOCs)]
    pub fn extract_iocs(&self, content: &str) -> std::result::Result<JsValue, JsValue> {
        let detector = ml::patterns::PatternDetector::new();
        let iocs = detector.extract_iocs(content);
        
        to_value(&iocs).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = getConfig)]
    pub fn get_config(&self) -> std::result::Result<JsValue, JsValue> {
        to_value(&self.config).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = updateConfig)]
    pub fn update_config(&mut self, config: JsValue) -> std::result::Result<(), JsValue> {
        let new_config: DeobfuscatorConfig = from_value(config)?;
        
        // Update ML predictor if needed
        if new_config.enable_ml != self.config.enable_ml {
            self.ml_predictor = if new_config.enable_ml {
                Some(ml::MlPredictor::new())
            } else {
                None
            };
        }
        
        self.config = new_config.clone();
        self.chain = chain::DeobfuscationChain::new(new_config);
        
        Ok(())
    }
}

// Streaming support for large files
#[wasm_bindgen]
pub struct StreamingDeobfuscator {
    deobfuscator: Deobfuscator,
    buffer: Vec<u8>,
    chunk_size: usize,
}

#[wasm_bindgen]
impl StreamingDeobfuscator {
    #[wasm_bindgen(constructor)]
    pub fn new(chunk_size: Option<usize>) -> Self {
        Self {
            deobfuscator: Deobfuscator::new(),
            buffer: Vec::new(),
            chunk_size: chunk_size.unwrap_or(1024 * 1024), // 1MB default
        }
    }

    #[wasm_bindgen(js_name = processChunk)]
    pub fn process_chunk(&mut self, chunk: &[u8]) -> std::result::Result<JsValue, JsValue> {
        self.buffer.extend_from_slice(chunk);
        
        if self.buffer.len() >= self.chunk_size {
            let to_process = self.buffer.drain(..self.chunk_size).collect::<Vec<u8>>();
            
            match String::from_utf8(to_process) {
                Ok(content) => {
                    let result = self.deobfuscator.deobfuscate(&content)?;
                    
                    let chunk_result = StreamingDeobfuscationChunk {
                        offset: 0,
                        size: self.chunk_size,
                        result: Some(from_value(result)?),
                        error: None,
                    };
                    
                    to_value(&chunk_result).map_err(|e| JsValue::from_str(&e.to_string()))
                }
                Err(e) => {
                    let chunk_result = StreamingDeobfuscationChunk {
                        offset: 0,
                        size: self.chunk_size,
                        result: None,
                        error: Some(format!("UTF-8 decode error: {}", e)),
                    };
                    
                    to_value(&chunk_result).map_err(|e| JsValue::from_str(&e.to_string()))
                }
            }
        } else {
            // Not enough data yet
            Ok(JsValue::NULL)
        }
    }

    #[wasm_bindgen]
    pub fn flush(&mut self) -> std::result::Result<JsValue, JsValue> {
        if self.buffer.is_empty() {
            return Ok(JsValue::NULL);
        }
        
        let remaining = self.buffer.drain(..).collect::<Vec<u8>>();
        
        match String::from_utf8(remaining) {
            Ok(content) => {
                let result = self.deobfuscator.deobfuscate(&content)?;
                
                let chunk_result = StreamingDeobfuscationChunk {
                    offset: 0,
                    size: content.len(),
                    result: Some(from_value(result)?),
                    error: None,
                };
                
                to_value(&chunk_result).map_err(|e| JsValue::from_str(&e.to_string()))
            }
            Err(e) => {
                let chunk_result = StreamingDeobfuscationChunk {
                    offset: 0,
                    size: self.buffer.len(),
                    result: None,
                    error: Some(format!("UTF-8 decode error: {}", e)),
                };
                
                to_value(&chunk_result).map_err(|e| JsValue::from_str(&e.to_string()))
            }
        }
    }
}

// Helper functions exposed to JS
#[wasm_bindgen(js_name = getSupportedTechniques)]
pub fn get_supported_techniques() -> JsValue {
    let techniques = vec![
        "Base64 Encoding",
        "Hex Encoding",
        "Unicode Escape",
        "URL Encoding",
        "HTML Entity Encoding",
        "Character Code Concatenation",
        "String Reverse",
        "XOR Encryption",
        "RC4 Encryption",
        "JavaScript Eval Chains",
        "JavaScript Packing",
        "PowerShell Encoded Commands",
        "PowerShell Compression",
        "Binary Packing",
        "Control Flow Obfuscation",
    ];
    
    to_value(&techniques).unwrap()
}

#[wasm_bindgen(js_name = getVersion)]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}