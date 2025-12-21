use strsim::{levenshtein, hamming};

/// Fuzzy match configuration
#[derive(Debug, Clone)]
pub struct FuzzyConfig {
    /// Maximum edit distance (0 = exact match)
    pub max_distance: usize,
    /// Match algorithm
    pub algorithm: FuzzyAlgorithm,
}

impl Default for FuzzyConfig {
    fn default() -> Self {
        Self {
            max_distance: 1,
            algorithm: FuzzyAlgorithm::Levenshtein,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FuzzyAlgorithm {
    Exact,           // No fuzzy matching
    Levenshtein,     // Edit distance
    Hamming,         // Same-length comparison
    Wildcard,        // * and ? support
}

/// Fuzzy string matcher
pub struct FuzzyMatcher {
    config: FuzzyConfig,
}

impl FuzzyMatcher {
    pub fn new(config: FuzzyConfig) -> Self {
        Self { config }
    }

    /// Check if haystack contains pattern with fuzzy logic
    pub fn find_all(&self, pattern: &[u8], haystack: &[u8]) -> Vec<usize> {
        let mut positions = Vec::new();

        match self.config.algorithm {
            FuzzyAlgorithm::Exact => {
                positions.extend(self.find_exact(pattern, haystack));
            }
            FuzzyAlgorithm::Levenshtein => {
                positions.extend(self.find_levenshtein(pattern, haystack));
            }
            FuzzyAlgorithm::Hamming => {
                positions.extend(self.find_hamming(pattern, haystack));
            }
            FuzzyAlgorithm::Wildcard => {
                positions.extend(self.find_wildcard(pattern, haystack));
            }
        }

        positions
    }

    /// Check if pattern matches at specific offset
    pub fn matches_at(&self, pattern: &[u8], haystack: &[u8], offset: usize) -> bool {
        if offset + pattern.len() > haystack.len() {
            return false;
        }

        let substring = &haystack[offset..offset + pattern.len()];

        match self.config.algorithm {
            FuzzyAlgorithm::Exact => pattern == substring,
            FuzzyAlgorithm::Levenshtein => {
                if let (Ok(p_str), Ok(h_str)) = (
                    std::str::from_utf8(pattern),
                    std::str::from_utf8(substring)
                ) {
                    levenshtein(p_str, h_str) <= self.config.max_distance
                } else {
                    // Fallback to byte-by-byte comparison
                    self.byte_distance(pattern, substring) <= self.config.max_distance
                }
            }
            FuzzyAlgorithm::Hamming => {
                if pattern.len() != substring.len() {
                    return false;
                }
                if let (Ok(p_str), Ok(h_str)) = (
                    std::str::from_utf8(pattern),
                    std::str::from_utf8(substring)
                ) {
                    hamming(p_str, h_str).unwrap_or(usize::MAX) <= self.config.max_distance
                } else {
                    self.hamming_distance_bytes(pattern, substring) <= self.config.max_distance
                }
            }
            FuzzyAlgorithm::Wildcard => {
                self.wildcard_match(pattern, substring)
            }
        }
    }

    fn find_exact(&self, pattern: &[u8], haystack: &[u8]) -> Vec<usize> {
        let mut positions = Vec::new();
        if pattern.is_empty() {
            return positions;
        }

        for i in 0..=haystack.len().saturating_sub(pattern.len()) {
            if haystack[i..i + pattern.len()] == *pattern {
                positions.push(i);
            }
        }

        positions
    }

    fn find_levenshtein(&self, pattern: &[u8], haystack: &[u8]) -> Vec<usize> {
        let mut positions = Vec::new();
        let pattern_len = pattern.len();

        if pattern_len == 0 {
            return positions;
        }

        // Search with variable window size to account for edits
        for start in 0..haystack.len() {
            for window_len in pattern_len.saturating_sub(self.config.max_distance)
                ..=pattern_len.saturating_add(self.config.max_distance) {

                let end = start + window_len;
                if end > haystack.len() {
                    continue;
                }

                let substring = &haystack[start..end];

                if let (Ok(p_str), Ok(h_str)) = (
                    std::str::from_utf8(pattern),
                    std::str::from_utf8(substring)
                ) {
                    if levenshtein(p_str, h_str) <= self.config.max_distance {
                        positions.push(start);
                        break; // Found a match at this position
                    }
                } else {
                    // Fallback for binary data
                    if self.byte_distance(pattern, substring) <= self.config.max_distance {
                        positions.push(start);
                        break;
                    }
                }
            }
        }

        positions
    }

    fn find_hamming(&self, pattern: &[u8], haystack: &[u8]) -> Vec<usize> {
        let mut positions = Vec::new();
        let pattern_len = pattern.len();

        if pattern_len == 0 || pattern_len > haystack.len() {
            return positions;
        }

        for i in 0..=haystack.len() - pattern_len {
            let substring = &haystack[i..i + pattern_len];

            if let (Ok(p_str), Ok(h_str)) = (
                std::str::from_utf8(pattern),
                std::str::from_utf8(substring)
            ) {
                if let Ok(dist) = hamming(p_str, h_str) {
                    if dist <= self.config.max_distance {
                        positions.push(i);
                    }
                }
            } else {
                if self.hamming_distance_bytes(pattern, substring) <= self.config.max_distance {
                    positions.push(i);
                }
            }
        }

        positions
    }

    fn find_wildcard(&self, pattern: &[u8], haystack: &[u8]) -> Vec<usize> {
        let mut positions = Vec::new();
        let pattern_len = pattern.len();

        if pattern_len == 0 {
            return positions;
        }

        for i in 0..=haystack.len().saturating_sub(pattern_len) {
            if self.wildcard_match_at(pattern, haystack, i) {
                positions.push(i);
            }
        }

        positions
    }

    /// Wildcard pattern matching (* matches any, ? matches one)
    fn wildcard_match(&self, pattern: &[u8], text: &[u8]) -> bool {
        self.wildcard_match_recursive(pattern, text, 0, 0)
    }

    fn wildcard_match_at(&self, pattern: &[u8], haystack: &[u8], offset: usize) -> bool {
        if offset >= haystack.len() {
            return false;
        }
        self.wildcard_match_recursive(pattern, &haystack[offset..], 0, 0)
    }

    fn wildcard_match_recursive(&self, pattern: &[u8], text: &[u8], p_idx: usize, t_idx: usize) -> bool {
        // End of both pattern and text
        if p_idx == pattern.len() && t_idx == text.len() {
            return true;
        }

        // End of pattern but not text
        if p_idx == pattern.len() {
            return false;
        }

        // Handle '*' wildcard (matches any sequence)
        if pattern[p_idx] == b'*' {
            // Try matching zero characters
            if self.wildcard_match_recursive(pattern, text, p_idx + 1, t_idx) {
                return true;
            }

            // Try matching one or more characters
            if t_idx < text.len() {
                return self.wildcard_match_recursive(pattern, text, p_idx, t_idx + 1);
            }

            return false;
        }

        // End of text but not pattern
        if t_idx == text.len() {
            return false;
        }

        // Handle '?' wildcard (matches one character) or exact match
        if pattern[p_idx] == b'?' || pattern[p_idx] == text[t_idx] {
            return self.wildcard_match_recursive(pattern, text, p_idx + 1, t_idx + 1);
        }

        false
    }

    /// Calculate byte-level edit distance (for binary data)
    fn byte_distance(&self, a: &[u8], b: &[u8]) -> usize {
        let len_a = a.len();
        let len_b = b.len();

        if len_a == 0 {
            return len_b;
        }
        if len_b == 0 {
            return len_a;
        }

        let mut matrix = vec![vec![0; len_b + 1]; len_a + 1];

        for i in 0..=len_a {
            matrix[i][0] = i;
        }
        for j in 0..=len_b {
            matrix[0][j] = j;
        }

        for i in 1..=len_a {
            for j in 1..=len_b {
                let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
                matrix[i][j] = (matrix[i - 1][j] + 1)
                    .min(matrix[i][j - 1] + 1)
                    .min(matrix[i - 1][j - 1] + cost);
            }
        }

        matrix[len_a][len_b]
    }

    /// Calculate Hamming distance for bytes
    fn hamming_distance_bytes(&self, a: &[u8], b: &[u8]) -> usize {
        if a.len() != b.len() {
            return usize::MAX;
        }

        a.iter().zip(b.iter()).filter(|(x, y)| x != y).count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exact_match() {
        let matcher = FuzzyMatcher::new(FuzzyConfig {
            max_distance: 0,
            algorithm: FuzzyAlgorithm::Exact,
        });

        let pattern = b"hello";
        let haystack = b"hello world hello";
        let positions = matcher.find_all(pattern, haystack);

        assert_eq!(positions.len(), 2);
        assert_eq!(positions[0], 0);
        assert_eq!(positions[1], 12);
    }

    #[test]
    fn test_levenshtein_fuzzy() {
        let matcher = FuzzyMatcher::new(FuzzyConfig {
            max_distance: 1,
            algorithm: FuzzyAlgorithm::Levenshtein,
        });

        let pattern = b"hello";
        let positions = matcher.find_all(pattern, b"hallo world");

        assert!(!positions.is_empty(), "Should find 'hallo' with edit distance 1");
    }

    #[test]
    fn test_hamming_match() {
        let matcher = FuzzyMatcher::new(FuzzyConfig {
            max_distance: 1,
            algorithm: FuzzyAlgorithm::Hamming,
        });

        let pattern = b"hello";
        let positions = matcher.find_all(pattern, b"hallo world");

        assert!(!positions.is_empty(), "Should find 'hallo' with Hamming distance 1");
    }

    #[test]
    fn test_wildcard_match() {
        let matcher = FuzzyMatcher::new(FuzzyConfig {
            max_distance: 0,
            algorithm: FuzzyAlgorithm::Wildcard,
        });

        assert!(matcher.matches_at(b"hel*", b"hello", 0));
        assert!(matcher.matches_at(b"h?llo", b"hello", 0));
        assert!(!matcher.matches_at(b"hel*", b"world", 0));
    }

    #[test]
    fn test_binary_fuzzy() {
        let matcher = FuzzyMatcher::new(FuzzyConfig {
            max_distance: 1,
            algorithm: FuzzyAlgorithm::Levenshtein,
        });

        let pattern = &[0x4D, 0x5A, 0x90]; // MZ header with byte
        let data = &[0x4D, 0x5A, 0x91, 0x00]; // Slightly different

        let positions = matcher.find_all(pattern, data);
        assert!(!positions.is_empty(), "Should match with 1 byte difference");
    }
}
