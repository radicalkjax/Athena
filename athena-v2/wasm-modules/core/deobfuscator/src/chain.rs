use crate::types::*;
use crate::techniques;
use std::time::{Duration, Instant};

pub struct DeobfuscationChain {
    config: DeobfuscatorConfig,
    techniques: Vec<Box<dyn techniques::DeobfuscationTechnique>>,
}

impl DeobfuscationChain {
    pub fn new(config: DeobfuscatorConfig) -> Self {
        let techniques = Self::initialize_techniques(&config);
        Self {
            config,
            techniques,
        }
    }

    fn initialize_techniques(config: &DeobfuscatorConfig) -> Vec<Box<dyn techniques::DeobfuscationTechnique>> {
        use crate::techniques::*;
        
        let mut techs: Vec<Box<dyn DeobfuscationTechnique>> = vec![
            Box::new(encoding::UrlDecoder::new()),
            Box::new(encoding::Base64Decoder::new()),
            Box::new(encoding::HexDecoder::new()),
            Box::new(encoding::UnicodeDecoder::new()),
            Box::new(encoding::HtmlEntityDecoder::new()),
            Box::new(crypto::XorDecryptor::new()),
            Box::new(crypto::Rc4Decryptor::new()),
            Box::new(javascript::JsDeobfuscator::new()),
            Box::new(javascript::JsUnpacker::new()),
            Box::new(powershell::PsDeobfuscator::new()),
        ];

        if config.detect_packers {
            techs.push(Box::new(binary::BinaryUnpacker::new()));
        }

        techs
    }

    pub fn deobfuscate(&self, content: &str, analysis: &ObfuscationAnalysis) -> Result<DeobfuscationResult> {
        let start_time = Instant::now();
        let original_entropy = self.calculate_entropy(content.as_bytes());
        
        let mut current_content = content.to_string();
        let mut applied_techniques = Vec::new();
        let mut extracted_strings = Vec::new();
        let mut layer = 0u32;

        // Apply techniques in recommended order
        for technique_type in &analysis.recommended_order {
            if layer >= self.config.max_layers {
                break;
            }

            if let Some(technique) = self.find_technique(technique_type) {
                match technique.can_deobfuscate(&current_content) {
                    Some(confidence) if confidence >= self.config.min_confidence => {
                        match technique.deobfuscate(&current_content) {
                            Ok(result) => {
                                if result.success {
                                    let new_content = result.output.clone();
                                    if new_content != current_content {
                                        // Extract strings if enabled
                                        if self.config.extract_strings {
                                            extracted_strings.extend(
                                                self.extract_strings_from_result(&new_content, &result)
                                            );
                                        }
                                        
                                        current_content = new_content;
                                        applied_techniques.push(AppliedTechnique {
                                            technique: technique_type.clone(),
                                            confidence,
                                            layer,
                                            context: result.context,
                                        });
                                        
                                        layer += 1;
                                    }
                                }
                            }
                            Err(e) => {
                                // Log error but continue with other techniques
                                eprintln!("Technique {:?} failed: {:?}", technique_type, e);
                            }
                        }
                    }
                    _ => {}
                }
            }

            // Check timeout
            if start_time.elapsed() > Duration::from_millis(self.config.timeout_ms) {
                return Err(DeobfuscationError::TimeoutError);
            }
        }

        // Try recursive deobfuscation if we made progress
        if layer > 0 && layer < self.config.max_layers {
            // Re-analyze the deobfuscated content
            let new_analysis = crate::analyzer::ObfuscationAnalyzer::new().analyze(&current_content);
            if !new_analysis.detected_techniques.is_empty() {
                // Recursively deobfuscate
                match self.deobfuscate(&current_content, &new_analysis) {
                    Ok(recursive_result) => {
                        // Merge results
                        for tech in recursive_result.techniques_applied {
                            applied_techniques.push(AppliedTechnique {
                                layer: tech.layer + layer,
                                ..tech
                            });
                        }
                        current_content = recursive_result.deobfuscated;
                        extracted_strings.extend(recursive_result.metadata.extracted_strings);
                        layer += recursive_result.metadata.layers_detected;
                    }
                    Err(_) => {
                        // Ignore recursive errors
                    }
                }
            }
        }

        let final_entropy = self.calculate_entropy(current_content.as_bytes());
        let processing_time_ms = start_time.elapsed().as_millis() as u64;

        // Detect suspicious patterns in final result
        let suspicious_patterns = self.detect_suspicious_patterns(&current_content);

        // Calculate overall confidence
        let confidence = self.calculate_overall_confidence(&applied_techniques, original_entropy, final_entropy);

        Ok(DeobfuscationResult {
            original: content.to_string(),
            deobfuscated: current_content,
            techniques_applied: applied_techniques,
            confidence,
            metadata: DeobfuscationMetadata {
                entropy_before: original_entropy,
                entropy_after: final_entropy,
                layers_detected: layer,
                processing_time_ms,
                suspicious_patterns,
                extracted_strings,
                ml_predictions: None,
            },
        })
    }

    fn find_technique(&self, technique_type: &ObfuscationTechnique) -> Option<&dyn techniques::DeobfuscationTechnique> {
        // This is a simplified version - in reality we'd match based on technique type
        for tech in &self.techniques {
            if tech.matches_type(technique_type) {
                return Some(tech.as_ref());
            }
        }
        None
    }

    fn calculate_entropy(&self, data: &[u8]) -> f32 {
        if data.is_empty() {
            return 0.0;
        }

        let mut frequency = [0u64; 256];
        for &byte in data {
            frequency[byte as usize] += 1;
        }

        let len = data.len() as f32;
        let mut entropy = 0.0;

        for &count in &frequency {
            if count > 0 {
                let probability = count as f32 / len;
                entropy -= probability * probability.log2();
            }
        }

        entropy
    }

    fn extract_strings_from_result(&self, content: &str, result: &techniques::TechniqueResult) -> Vec<ExtractedString> {
        let mut strings = Vec::new();
        
        // Extract printable strings
        let string_regex = regex::Regex::new(r#"["']([^"']{4,})["']"#).unwrap();
        for cap in string_regex.captures_iter(content) {
            if let Some(string_match) = cap.get(1) {
                strings.push(ExtractedString {
                    value: string_match.as_str().to_string(),
                    confidence: 0.8,
                    context: format!("Extracted from {:?}", result.context.as_ref().unwrap_or(&"deobfuscation".to_string())),
                    offset: string_match.start(),
                });
            }
        }
        
        strings
    }

    fn detect_suspicious_patterns(&self, content: &str) -> Vec<String> {
        let mut patterns = Vec::new();
        
        let suspicious_regexes = [
            (r"(?i)(powershell|cmd|wscript|cscript|mshta)", "Script interpreter"),
            (r"(?i)(download|wget|curl|invoke-webrequest)", "Download capability"),
            (r"(?i)(eval|execute|invoke-expression)", "Code execution"),
            (r"(?i)(registry|reg\s+add|reg\s+query)", "Registry manipulation"),
            (r"(?i)(scheduled\s*task|schtasks|at\s+)", "Persistence mechanism"),
            (r"(?i)(mimikatz|lazagne|pwdump)", "Credential theft tool"),
            (r"(?i)(\\x[0-9a-f]{2}){10,}", "Hex encoded payload"),
            (r"(?i)(frombase64string|convert.*base64)", "Base64 decoding"),
        ];
        
        for (pattern, description) in &suspicious_regexes {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if regex.is_match(content) {
                    patterns.push(description.to_string());
                }
            }
        }
        
        patterns
    }

    fn calculate_overall_confidence(&self, techniques: &[AppliedTechnique], entropy_before: f32, entropy_after: f32) -> f32 {
        if techniques.is_empty() {
            return 0.0;
        }

        // Average technique confidence
        let avg_confidence = techniques.iter()
            .map(|t| t.confidence)
            .sum::<f32>() / techniques.len() as f32;

        // Entropy improvement factor
        let entropy_improvement = if entropy_before > 0.0 {
            ((entropy_before - entropy_after) / entropy_before).max(0.0)
        } else {
            0.0
        };

        // Combine factors
        (avg_confidence * 0.7 + entropy_improvement * 0.3).min(1.0)
    }
}