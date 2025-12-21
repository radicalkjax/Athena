use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct EntropyFeatures {
    pub global_entropy: f32,
    pub chunk_entropies: Vec<f32>,
    pub max_chunk_entropy: f32,
    pub min_chunk_entropy: f32,
    pub chunk_variance: f32,
    pub byte_distribution: HashMap<u8, f32>,
}

pub struct EntropyAnalyzer {
    chunk_size: usize,
}

impl EntropyAnalyzer {
    pub fn new() -> Self {
        Self {
            chunk_size: 256,
        }
    }

    pub fn analyze(&self, data: &[u8]) -> EntropyFeatures {
        let global_entropy = self.calculate_entropy(data);
        let chunk_entropies = self.calculate_chunk_entropies(data);
        let byte_distribution = self.calculate_byte_distribution(data);
        
        let max_chunk_entropy = chunk_entropies.iter().cloned().fold(0.0, f32::max);
        let min_chunk_entropy = chunk_entropies.iter().cloned().fold(8.0, f32::min);
        let chunk_variance = self.calculate_variance(&chunk_entropies);
        
        EntropyFeatures {
            global_entropy,
            chunk_entropies,
            max_chunk_entropy,
            min_chunk_entropy,
            chunk_variance,
            byte_distribution,
        }
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

    fn calculate_chunk_entropies(&self, data: &[u8]) -> Vec<f32> {
        let mut entropies = Vec::new();
        
        for chunk in data.chunks(self.chunk_size) {
            if chunk.len() >= self.chunk_size / 2 {
                entropies.push(self.calculate_entropy(chunk));
            }
        }
        
        entropies
    }

    fn calculate_byte_distribution(&self, data: &[u8]) -> HashMap<u8, f32> {
        let mut frequency = HashMap::new();
        let len = data.len() as f32;
        
        for &byte in data {
            *frequency.entry(byte).or_insert(0.0) += 1.0;
        }
        
        // Normalize to probabilities
        for count in frequency.values_mut() {
            *count /= len;
        }
        
        frequency
    }

    fn calculate_variance(&self, values: &[f32]) -> f32 {
        if values.is_empty() {
            return 0.0;
        }
        
        let mean = values.iter().sum::<f32>() / values.len() as f32;
        let variance = values.iter()
            .map(|&x| (x - mean).powi(2))
            .sum::<f32>() / values.len() as f32;
        
        variance
    }

    pub fn detect_entropy_anomalies(&self, features: &EntropyFeatures) -> Vec<String> {
        let mut anomalies = Vec::new();
        
        // High global entropy
        if features.global_entropy > 7.5 {
            anomalies.push("Very high entropy - likely encrypted or compressed".to_string());
        }
        
        // Uneven entropy distribution
        if features.chunk_variance > 3.0 {
            anomalies.push("Uneven entropy distribution - mixed content types".to_string());
        }
        
        // Sudden entropy changes
        let mut prev_entropy = 0.0;
        for (i, &entropy) in features.chunk_entropies.iter().enumerate() {
            if i > 0 && (entropy - prev_entropy).abs() > 4.0 {
                anomalies.push(format!("Sudden entropy change at chunk {}", i));
            }
            prev_entropy = entropy;
        }
        
        // Check for specific byte patterns
        let printable_ratio = features.byte_distribution.iter()
            .filter(|(&byte, _)| byte.is_ascii() && !byte.is_ascii_control())
            .map(|(_, &prob)| prob)
            .sum::<f32>();
        
        if printable_ratio < 0.3 {
            anomalies.push("Low printable character ratio - likely binary data".to_string());
        }
        
        anomalies
    }
}