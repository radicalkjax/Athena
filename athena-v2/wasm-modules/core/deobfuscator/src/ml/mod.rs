pub mod entropy;
pub mod patterns;

use crate::types::MlPredictions;
use std::collections::HashMap;

pub struct MlPredictor {
    entropy_analyzer: entropy::EntropyAnalyzer,
    pattern_detector: patterns::PatternDetector,
}

impl MlPredictor {
    pub fn new() -> Self {
        Self {
            entropy_analyzer: entropy::EntropyAnalyzer::new(),
            pattern_detector: patterns::PatternDetector::new(),
        }
    }

    pub fn predict(&self, content: &str) -> MlPredictions {
        // Analyze entropy features
        let entropy_features = self.entropy_analyzer.analyze(content.as_bytes());
        
        // Detect patterns
        let pattern_features = self.pattern_detector.detect(content);
        
        // Calculate probabilities based on features
        let obfuscation_probability = self.calculate_obfuscation_probability(
            &entropy_features,
            &pattern_features
        );
        
        let technique_probabilities = self.calculate_technique_probabilities(
            &entropy_features,
            &pattern_features
        );
        
        let malware_probability = self.calculate_malware_probability(
            &entropy_features,
            &pattern_features
        );
        
        MlPredictions {
            obfuscation_probability,
            technique_probabilities,
            malware_probability,
        }
    }

    fn calculate_obfuscation_probability(
        &self,
        entropy: &entropy::EntropyFeatures,
        patterns: &patterns::PatternFeatures,
    ) -> f32 {
        let mut score = 0.0;
        
        // High entropy indicates obfuscation
        if entropy.global_entropy > 6.0 {
            score += 0.3;
        } else if entropy.global_entropy > 5.0 {
            score += 0.2;
        }
        
        // Chunk variance indicates uneven distribution
        if entropy.chunk_variance > 2.0 {
            score += 0.2;
        }
        
        // Pattern features
        score += patterns.obfuscation_score * 0.5;
        
        score.min(1.0)
    }

    fn calculate_technique_probabilities(
        &self,
        entropy: &entropy::EntropyFeatures,
        patterns: &patterns::PatternFeatures,
    ) -> HashMap<String, f32> {
        let mut probs = HashMap::new();
        
        // Base64 - moderate entropy, specific character distribution
        if entropy.global_entropy > 4.0 && entropy.global_entropy < 6.5 {
            if patterns.base64_likelihood > 0.5 {
                probs.insert("base64".to_string(), patterns.base64_likelihood);
            }
        }
        
        // Encryption - high entropy
        if entropy.global_entropy > 7.0 {
            probs.insert("encryption".to_string(), 0.8);
            probs.insert("xor".to_string(), 0.6);
        }
        
        // Hex encoding
        if patterns.hex_likelihood > 0.5 {
            probs.insert("hex".to_string(), patterns.hex_likelihood);
        }
        
        // JavaScript obfuscation
        if patterns.js_obfuscation_score > 0.5 {
            probs.insert("javascript".to_string(), patterns.js_obfuscation_score);
        }
        
        // PowerShell
        if patterns.ps_obfuscation_score > 0.5 {
            probs.insert("powershell".to_string(), patterns.ps_obfuscation_score);
        }
        
        probs
    }

    fn calculate_malware_probability(
        &self,
        entropy: &entropy::EntropyFeatures,
        patterns: &patterns::PatternFeatures,
    ) -> f32 {
        let mut score = 0.0;
        
        // High entropy sections
        if entropy.max_chunk_entropy > 7.5 {
            score += 0.2;
        }
        
        // Suspicious patterns
        score += patterns.suspicious_pattern_score * 0.6;
        
        // Multiple obfuscation techniques
        if patterns.obfuscation_score > 0.7 {
            score += 0.2;
        }
        
        score.min(1.0)
    }
}